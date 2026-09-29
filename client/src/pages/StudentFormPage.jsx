import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CircleAlert, IdCard, Save, Sparkles, UserRound } from 'lucide-react';

import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { buttonClasses } from '../components/ui/buttonStyles.js';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Field, Select, TextInput } from '../components/ui/Field.jsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { useToast } from '../context/toastContext.js';
import { useAuth } from '../context/authContext.js';
import { errorMessage } from '../utils/apiErrors.js';
import { useForm } from '../hooks/useForm.js';
import { useStudent } from '../hooks/useStudent.js';
import { studentService } from '../services/studentService.js';
import {
  COURSE_SUGGESTIONS,
  DEPARTMENTS,
  ENROLLMENT_STATUSES,
  STUDENT_YEARS,
} from '../constants/student.js';
import { email as emailRule, maxLength, minLength, oneOf, phone as phoneRule, required, url } from '../utils/validation.js';
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
  dateOfRegistration: [required('Choose the date of registration.')],
  enrollmentStatus: [required(), oneOf(ENROLLMENT_STATUSES.map((status) => status.value))],
  avatarUrl: [url()],
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
  const { pathname } = useLocation();
  const crumbs = routeCrumbs(pathname);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

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

        toast.success(
          isEdit ? 'Student details updated.' : 'Student added to the register.',
          isEdit ? 'Changes saved' : 'Student added',
        );

        navigate(saved?.id ? paths.student(saved.id) : paths.students, { replace: true });
      } catch (error) {
        // `useForm` merges the API's field-level `details` into the form; the
        // toast carries the summary sentence.
        toast.error(errorMessage(error), isEdit ? 'Could not save changes' : 'Could not add student');
        throw error;
      }
    },
  });

  const { reset } = form;

  // Load the record into the form once the student is available.
  useEffect(() => {
    if (!isEdit || !student) return;
    reset({
      ...EMPTY_STUDENT,
      ...student,
      dateOfRegistration: student.dateOfRegistration?.slice(0, 10) ?? todayIso(),
      avatarUrl: student.avatarUrl ?? '',
    });
  }, [isEdit, reset, student]);

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
              <Link to={paths.students} className={buttonClasses({ size: 'sm' })}>
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

      <form onSubmit={form.handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          {form.submitError ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-card border border-danger/25 bg-danger/[0.06] px-4 py-3"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <p className="text-[13px] leading-relaxed text-ink">{form.submitError}</p>
            </div>
          ) : null}

          <Card>
            <CardHeader
              title="Student details"
              description="Required information for the campus register."
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

              <div className="grid gap-5 sm:grid-cols-2">
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
              </div>

              <Field
                label="Course"
                required
                error={form.errorFor('course')}
                hint="Start typing to pick a common course, or enter your own."
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

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Date of registration"
                  required
                  error={form.errorFor('dateOfRegistration')}
                  hint={
                    canEditRegistrationDate
                      ? undefined
                      : 'Only an administrator can change this after the record exists.'
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

                <Field
                  label="Profile photo"
                  error={form.errorFor('avatarUrl')}
                  hint="Optional link to a hosted photo."
                >
                  <TextInput
                    type="url"
                    name="avatarUrl"
                    placeholder="https://…"
                    value={form.values.avatarUrl}
                    onChange={form.handleChange('avatarUrl')}
                    onBlur={form.handleBlur('avatarUrl')}
                    hasError={Boolean(form.errorFor('avatarUrl'))}
                  />
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Enrollment status" icon={Sparkles} />
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

              <p className="text-[13px] leading-relaxed text-muted">
                Inactive students stay on record but are excluded from active enrolment counts.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Student ID" icon={IdCard} />
            <CardBody>
              {isEdit && student ? (
                <p className="rounded-xl border border-dashed border-line bg-canvas/60 px-3.5 py-3 font-mono text-[13px] font-semibold tracking-wide text-ink">
                  {student.studentId}
                </p>
              ) : (
                <p className="rounded-xl border border-dashed border-line bg-canvas/60 px-3.5 py-3 text-[13px] leading-relaxed text-muted">
                  CampusDesk generates a unique ID such as{' '}
                  <span className="font-mono font-semibold text-charcoal">
                    CDS-{new Date().getFullYear()}-0001
                  </span>{' '}
                  when the record is saved.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex flex-col gap-2.5">
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

              <Link
                to={isEdit ? paths.student(id) : paths.students}
                className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'w-full' })}
              >
                Cancel
              </Link>
            </CardBody>
          </Card>
        </div>
      </form>
    </>
  );
}
