import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  GraduationCap,
  IdCard,
  Mail,
  Phone,
  Save,
  ShieldAlert,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { buttonClasses } from '../components/ui/buttonStyles.js';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { Field, Select, TextInput } from '../components/ui/Field.jsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.jsx';
import { EmptyState, ErrorState, FormAlert } from '../components/ui/States.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useToast } from '../context/toastContext.js';
import { useAuth } from '../context/authContext.js';
import { errorMessage } from '../utils/apiErrors.js';
import { useForm } from '../hooks/useForm.js';
import { useStudent } from '../hooks/useStudent.js';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.js';
import { studentService } from '../services/studentService.js';
import {
  COURSE_SUGGESTIONS,
  DEPARTMENTS,
  ENROLLMENT_STATUSES,
  STUDENT_YEARS,
} from '../constants/student.js';
import {
  email as emailRule,
  maxLength,
  minLength,
  notFutureDate,
  oneOf,
  phone as phoneRule,
  photoUrl,
  required,
} from '../utils/validation.js';
import { backToRegister, backToStudent } from '../routes/returnState.js';
import { paths } from '../routes/paths.js';
import { routeCrumbs } from '../routes/routeMeta.js';

/** Mirrors the API's student validators so problems surface before the request. */
const schema = {
  name: [required('Enter the student’s full name.'), minLength(2, 'Names are at least 2 characters.'), maxLength(120)],
  email: [required('Enter an email address.'), emailRule()],
  phone: [required('Enter a phone number.'), phoneRule()],
  course: [required('Enter the course the student is enrolled in.'), maxLength(120)],
  year: [required('Select a year of study.'), oneOf(STUDENT_YEARS, 'Select a year of study.')],
  department: [required('Select a department.'), maxLength(120)],
  dateOfRegistration: [required('Choose the date of registration.'), notFutureDate()],
  enrollmentStatus: [required(), oneOf(ENROLLMENT_STATUSES.map((status) => status.value))],
  avatarUrl: [photoUrl()],
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY_STUDENT = {
  name: '',
  email: '',
  phone: '',
  course: '',
  year: '',
  department: '',
  dateOfRegistration: todayIso(),
  enrollmentStatus: 'active',
  avatarUrl: '',
};

export default function StudentFormPage({ mode = 'create' }) {
  const isEdit = mode === 'edit';
  const { id } = useParams();
  const location = useLocation();
  const { pathname } = location;
  const crumbs = routeCrumbs(pathname);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  /**
   * Where leaving this form goes: back to the student it was opened from, or to
   * the register it started in — the same screen the user left, search and
   * filters intact.
   */
  const cancelTo = isEdit
    ? backToStudent(location, paths.student(id))
    : backToRegister(location);
  const registerFrom = backToRegister(location);

  const { student, status: studentStatus, error: studentError, refresh } = useStudent(
    isEdit ? id : null,
  );

  /**
   * The registration date is an administrative fact: the API only lets an
   * administrator change it once a record exists, so a staff account sees it
   * read-only instead of being handed a field that will be refused. The server
   * enforces the same rule regardless of what this screen offers.
   */
  const canEditRegistrationDate = !isEdit || user?.role === 'admin';

  /** The record as the form should hold it, derived rather than stored. */
  const loadedRecord = useMemo(() => {
    if (!isEdit || !student) return null;

    return {
      ...EMPTY_STUDENT,
      ...student,
      dateOfRegistration: student.dateOfRegistration?.slice(0, 10) ?? todayIso(),
      avatarUrl: student.avatarUrl ?? '',
    };
  }, [isEdit, student]);

  /** What was in the form the last time it was in step with the register. */
  const [savedValues, setSavedValues] = useState(null);

  const form = useForm({
    initialValues: EMPTY_STUDENT,
    schema,
    onSubmit: async (values) => {
      // An explicit whitelist: `studentId`, timestamps and anything else the
      // API manages can never be sent from the form, even by accident.
      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        course: values.course,
        year: values.year,
        department: values.department,
        enrollmentStatus: values.enrollmentStatus,
        avatarUrl: values.avatarUrl?.trim() || '',
      };

      const wantsNewDate =
        Boolean(values.dateOfRegistration) &&
        (!isEdit ||
          new Date(values.dateOfRegistration).toISOString() !==
            new Date(student?.dateOfRegistration ?? 0).toISOString());

      if (wantsNewDate) payload.dateOfRegistration = new Date(values.dateOfRegistration).toISOString();
      else delete payload.dateOfRegistration;

      try {
        const saved = isEdit
          ? await studentService.update(id, payload)
          : await studentService.create(payload);

        // The saved values are the new baseline, so the unsaved-changes guard
        // does not chase the user out of the screen they are leaving.
        setSavedValues(values);

        toast.success(
          isEdit
            ? `${saved?.name ?? 'The student'}’s details were saved.`
            : `${saved?.name ?? 'The student'} is on the register as ${saved?.studentId ?? 'a new record'}.`,
          isEdit ? 'Student updated' : 'Student created',
        );

        // Land on the record itself — for a new student that is the only way to
        // see the ID the API just generated.
        navigate(saved?.id ? paths.student(saved.id) : registerFrom, {
          replace: true,
          state: { registerFrom },
        });
      } catch (error) {
        // `useForm` keeps every entered value, merges the API's field-level
        // `details` into the form and moves focus to the first rejected field;
        // the toast carries the summary sentence.
        toast.error(errorMessage(error), isEdit ? 'Could not save changes' : 'Could not add student');
        throw error;
      }
    },
  });

  const { reset, values, isSubmitting } = form;

  // Load the record into the form once the student is available.
  useEffect(() => {
    if (loadedRecord) reset(loadedRecord);
  }, [loadedRecord, reset]);

  /**
   * A form with uncommitted edits is worth protecting: the browser asks before a
   * reload or a closed tab, and Cancel asks before the values are dropped.
   */
  const baseline = savedValues ?? loadedRecord ?? EMPTY_STUDENT;
  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(baseline),
    [baseline, values],
  );
  useUnsavedChanges(isDirty && !isSubmitting);

  const leaveForm = () => {
    if (isDirty) {
      setIsDiscardOpen(true);
      return;
    }
    navigate(cancelTo);
  };

  if (isEdit && studentStatus === 'error') {
    return (
      <>
        <PageHeader
          title="Student unavailable"
          breadcrumbs={[...crumbs.slice(0, -1), { label: 'Unavailable' }]}
        />
        <Card>
          <ErrorState
            title="This student could not be loaded"
            description={errorMessage(studentError)}
            onRetry={refresh}
          />
        </Card>
      </>
    );
  }

  if (isEdit && studentStatus === 'missing') {
    return (
      <>
        <PageHeader
          title="Student not found"
          breadcrumbs={[...crumbs.slice(0, -1), { label: 'Not found' }]}
        />
        <Card>
          <EmptyState
            icon={UserRound}
            title={`No student with the id "${id}"`}
            description="There is nothing to edit — the record may have been removed."
            action={
              <Link to={registerFrom} className={buttonClasses({ size: 'sm' })}>
                Back to the register
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  const isBusy = form.isSubmitting || (isEdit && studentStatus === 'loading');

  return (
    <>
      <PageHeader
        // Editing drops the generic "Student" crumb in favour of the record's
        // name, which is the same place in the trail.
        breadcrumbs={[
          ...(isEdit ? crumbs.slice(0, -1) : crumbs),
          ...(isEdit ? [{ label: student?.name ?? 'Student', to: paths.student(id) }] : []),
          { label: isEdit ? 'Edit' : 'New student' },
        ]}
        title={isEdit ? 'Edit student details' : 'Add a student'}
        description={
          isEdit
            ? 'Update the record and save. The CampusDesk ID stays with the student.'
            : 'Enter the admission details you have. Everything is validated before it reaches the register.'
        }
        actions={
          isEdit && studentStatus === 'loading' ? <Spinner label="Loading record…" /> : null
        }
      />

      <form onSubmit={form.handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-6">
          {form.submitError ? <FormAlert>{form.submitError}</FormAlert> : null}

          <Card>
            <CardHeader
              eyebrow="Section 1"
              title="Student identity"
              description="The name this student is registered under."
              icon={UserRound}
            />

            <CardBody className="space-y-5">
              <Field label="Full name" required error={form.errorFor('name')}>
                <TextInput
                  name="name"
                  autoComplete="name"
                  placeholder="e.g. Ananya Sharma"
                  value={form.values.name}
                  onChange={form.handleChange('name')}
                  onBlur={form.handleBlur('name')}
                  hasError={Boolean(form.errorFor('name'))}
                />
              </Field>

              <Field
                label="Profile photo"
                error={form.errorFor('avatarUrl')}
                hint="Optional. A hosted link, or a path such as /photos/ananya.jpg."
              >
                <TextInput
                  type="text"
                  inputMode="url"
                  name="avatarUrl"
                  placeholder="https://… or /photos/ananya.jpg"
                  value={form.values.avatarUrl}
                  onChange={form.handleChange('avatarUrl')}
                  onBlur={form.handleBlur('avatarUrl')}
                  hasError={Boolean(form.errorFor('avatarUrl'))}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Section 2"
              title="Academic information"
              description="What the student is studying and where they sit in the register."
              icon={GraduationCap}
            />

            <CardBody className="space-y-5">
              <Field
                label="Course"
                required
                error={form.errorFor('course')}
                hint="Start typing to pick a course already on the register, or enter your own."
              >
                <TextInput
                  name="course"
                  list="course-suggestions"
                  placeholder="e.g. B.Tech Computer Science"
                  value={form.values.course}
                  onChange={form.handleChange('course')}
                  onBlur={form.handleBlur('course')}
                  hasError={Boolean(form.errorFor('course'))}
                />
              </Field>

              <datalist id="course-suggestions">
                {COURSE_SUGGESTIONS.map((course) => (
                  <option key={course} value={course} />
                ))}
              </datalist>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Year of study" required error={form.errorFor('year')}>
                  <Select
                    name="year"
                    value={form.values.year}
                    onChange={form.handleChange('year')}
                    onBlur={form.handleBlur('year')}
                    hasError={Boolean(form.errorFor('year'))}
                  >
                    <option value="">Select a year</option>
                    {STUDENT_YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Department" required error={form.errorFor('department')}>
                  <Select
                    name="department"
                    value={form.values.department}
                    onChange={form.handleChange('department')}
                    onBlur={form.handleBlur('department')}
                    hasError={Boolean(form.errorFor('department'))}
                  >
                    <option value="">Select a department</option>
                    {DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Section 3"
              title="Contact information"
              description="How the campus reaches this student."
              icon={Mail}
            />

            <CardBody className="grid gap-5 sm:grid-cols-2">
              <Field label="Email address" required error={form.errorFor('email')}>
                <TextInput
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="student@campusdesk.edu"
                  value={form.values.email}
                  onChange={form.handleChange('email')}
                  onBlur={form.handleBlur('email')}
                  hasError={Boolean(form.errorFor('email'))}
                />
              </Field>

              <Field label="Phone number" required error={form.errorFor('phone')}>
                <TextInput
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  placeholder="+91 98220 41182"
                  value={form.values.phone}
                  onChange={form.handleChange('phone')}
                  onBlur={form.handleBlur('phone')}
                  hasError={Boolean(form.errorFor('phone'))}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Section 4"
              title="Registration"
              description="When this record entered the register."
              icon={CalendarDays}
            />

            <CardBody className="space-y-5">
              <Field
                label="Date of registration"
                required
                error={form.errorFor('dateOfRegistration')}
                hint={
                  canEditRegistrationDate
                    ? 'Defaults to today. Future dates are not accepted.'
                    : undefined
                }
              >
                <TextInput
                  type="date"
                  name="dateOfRegistration"
                  max={todayIso()}
                  value={form.values.dateOfRegistration}
                  onChange={form.handleChange('dateOfRegistration')}
                  onBlur={form.handleBlur('dateOfRegistration')}
                  hasError={Boolean(form.errorFor('dateOfRegistration'))}
                  disabled={!canEditRegistrationDate}
                />
              </Field>

              {/* The rule is the server's; this explains it rather than
                  offering a field that would be refused. */}
              {canEditRegistrationDate ? null : (
                <p className="flex items-start gap-3 rounded-card border border-line/70 bg-surface-muted px-4 py-3 text-meta leading-relaxed text-muted">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-charcoal" aria-hidden="true" />
                  The registration date is an administrative fact. It is kept from the original
                  record and only an administrator can change it.
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader
              title="Enrollment status"
              description="Counted in active enrolment or not."
              icon={Sparkles}
            />

            <CardBody className="space-y-4">
              <SegmentedControl
                name="enrollment-status"
                label="Enrollment status"
                options={ENROLLMENT_STATUSES.map((status) => ({
                  value: status.value,
                  label: status.label,
                }))}
                value={form.values.enrollmentStatus}
                onChange={(value) => form.setFieldValue('enrollmentStatus', value)}
              />

              <p className="text-label leading-relaxed text-muted">
                Inactive students stay on record but are excluded from active enrolment counts.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Student ID"
              description="Issued by CampusDesk — never typed by hand."
              icon={IdCard}
            />

            <CardBody>
              {isEdit && student ? (
                <p className="rounded-field border border-dashed border-line-strong bg-canvas/70 px-3.5 py-3 font-mono text-label font-semibold tracking-wide text-ink">
                  {student.studentId}
                </p>
              ) : (
                <p className="rounded-field border border-dashed border-line-strong bg-canvas/70 px-3.5 py-3 text-label leading-relaxed text-muted">
                  CampusDesk generates a unique ID such as{' '}
                  <span className="font-mono font-semibold text-charcoal">
                    CDS-{new Date().getFullYear()}-0001
                  </span>{' '}
                  when the record is saved.
                </p>
              )}
            </CardBody>
          </Card>

          <Card tone="quiet">
            <CardBody className="space-y-2.5">
              <Button
                type="submit"
                size="lg"
                icon={Save}
                isLoading={isBusy}
                disabled={isBusy}
                className="w-full"
              >
                {isEdit ? 'Save changes' : 'Add student'}
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={leaveForm}
                disabled={isSubmitting}
                className="w-full"
              >
                Cancel
              </Button>

              <p className="pt-1 text-center text-meta leading-relaxed text-muted">
                {isEdit
                  ? 'Saving keeps the same record and the same CampusDesk ID.'
                  : 'The student ID is created when you save.'}
              </p>
            </CardBody>
          </Card>
        </div>
      </form>

      {/* Only asked when there is something to lose: Cancel on an untouched
          form simply leaves. */}
      <ConfirmDialog
        open={isDiscardOpen}
        onClose={() => setIsDiscardOpen(false)}
        onConfirm={() => {
          setIsDiscardOpen(false);
          navigate(cancelTo);
        }}
        tone="warning"
        title="Discard these changes?"
        description={
          isEdit
            ? 'The edits you have made to this record will not be saved.'
            : 'The details you have entered will not be added to the register.'
        }
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
      />
    </>
  );
}
