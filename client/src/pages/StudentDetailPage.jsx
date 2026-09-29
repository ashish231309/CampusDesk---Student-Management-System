import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  IdCard,
  Mail,
  Pencil,
  Phone,
  Trash2,
  UserRound,
} from 'lucide-react';

import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { StatusPill } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { buttonClasses } from '../components/ui/buttonStyles.js';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { useToast } from '../context/toastContext.js';
import { errorMessage } from '../utils/apiErrors.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useStudent } from '../hooks/useStudent.js';
import { studentService } from '../services/studentService.js';
import { formatDate, formatRelative } from '../utils/format.js';
import { appConfig } from '../config/app.js';
import { paths } from '../routes/paths.js';
import { routeCrumbs } from '../routes/routeMeta.js';

/** One labelled fact, inside a group's definition list. */
const DetailRow = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 px-panel py-3.5">
    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-chip bg-beige/50 text-charcoal">
      <Icon className="size-4" aria-hidden="true" />
    </span>

    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-body font-medium break-words text-ink">{children}</dd>
    </div>
  </div>
);

/** A group of facts: heading, then the rows, as one list. */
const DetailGroup = ({ icon, title, description, children }) => (
  <Card className="overflow-hidden">
    <CardHeader icon={icon} title={title} description={description} />
    <dl className="divide-y divide-line/50">{children}</dl>
  </Card>
);

export default function StudentDetailPage() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { student, status, error, errorKind, refresh } = useStudent(id);

  // The tab says the student's name once the record has arrived, and the route's
  // own title until then.
  useDocumentTitle(student?.name ? `${student.name} · ${appConfig.name}` : undefined);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await studentService.remove(student.id);
      toast.success(`${student.name} was removed from the register.`, 'Student deleted');
      navigate(paths.students, { replace: true });
    } catch (deleteError) {
      if (deleteError.isNotFound) {
        toast.info('That student has already been removed.', 'Already deleted');
        navigate(paths.students, { replace: true });
      } else {
        toast.error(errorMessage(deleteError), 'Could not delete student');
      }
    } finally {
      setIsDeleting(false);
      setIsConfirmOpen(false);
    }
  };

  if (status === 'missing') {
    return (
      <>
        <PageHeader
          title="Student not found"
          breadcrumbs={[...routeCrumbs(pathname), { label: 'Not found' }]}
        />
        <Card>
          <EmptyState
            icon={UserRound}
            title={`No student with the id "${id}"`}
            description="The record may have been removed, or the link may be out of date."
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

  // The record exists but could not be read — a permission problem, an outage
  // or a lost connection is not the same thing as "no such student".
  if (status === 'error') {
    return (
      <>
        <PageHeader
          title="Student"
          breadcrumbs={[...routeCrumbs(pathname), { label: 'Unavailable' }]}
        />
        <Card>
          <ErrorState
            title={
              errorKind === 'forbidden'
                ? 'You cannot view this student'
                : 'This student could not be loaded'
            }
            description={errorMessage(error)}
            onRetry={refresh}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[...routeCrumbs(pathname), { label: student?.name ?? 'Student' }]}
        title={student?.name ?? 'Loading student…'}
        description={
          student
            ? `On the register since ${formatDate(student.dateOfRegistration)} · ${formatRelative(
                student.dateOfRegistration,
              )}`
            : undefined
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => navigate(paths.students)}
            >
              <span className="hidden sm:inline">Back to register</span>
              <span className="sm:hidden">Back</span>
            </Button>
            {student ? (
              <>
                <Link to={paths.editStudent(student.id)} className={buttonClasses({})}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit details
                </Link>
                <Button variant="dangerGhost" icon={Trash2} onClick={() => setIsConfirmOpen(true)}>
                  Delete
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {/* Who this is and the three facts someone checks first. The name itself
          is the page title above, so it is not repeated here. */}
      <Card tone="accent" className="px-panel py-5">
        {student ? (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar name={student.name} src={student.avatarUrl || undefined} size="lg" />

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong/70 bg-surface px-2.5 py-1 text-meta font-semibold text-charcoal">
                <IdCard className="size-3.5" aria-hidden="true" />
                {student.studentId}
              </span>
              <StatusPill status={student.enrollmentStatus} />
            </div>

            <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {[
                { label: 'Course', value: student.course },
                { label: 'Department', value: student.department },
                { label: 'Year', value: student.year },
              ].map((fact) => (
                <div key={fact.label} className="min-w-0">
                  <dt className="eyebrow">{fact.label}</dt>
                  <dd className="mt-1 truncate text-label font-medium text-ink">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Skeleton className="size-16 rounded-full" />
            <div className="space-y-2.5">
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-5 w-64" />
            </div>
          </div>
        )}
      </Card>

      <div className="mt-section grid gap-6 lg:grid-cols-2">
        <DetailGroup
          icon={GraduationCap}
          title="Academic information"
          description="What the student is studying and where they sit in the register."
        >
          <DetailRow icon={BookOpen} label="Course">
            {student?.course ?? <Skeleton className="h-4 w-40" />}
          </DetailRow>
          <DetailRow icon={Building2} label="Department">
            {student?.department ?? <Skeleton className="h-4 w-40" />}
          </DetailRow>
          <DetailRow icon={GraduationCap} label="Year of study">
            {student?.year ?? <Skeleton className="h-4 w-24" />}
          </DetailRow>
          <DetailRow icon={UserRound} label="Enrollment status">
            {student ? (
              <StatusPill status={student.enrollmentStatus} />
            ) : (
              <Skeleton className="h-6 w-20 rounded-full" />
            )}
          </DetailRow>
        </DetailGroup>

        <DetailGroup
          icon={Mail}
          title="Contact information"
          description="How the student can be reached."
        >
          <DetailRow icon={Mail} label="Email">
            {student ? (
              <a
                href={`mailto:${student.email}`}
                className="rounded transition-colors hover:text-charcoal hover:underline hover:underline-offset-4"
              >
                {student.email}
              </a>
            ) : (
              <Skeleton className="h-4 w-48" />
            )}
          </DetailRow>
          <DetailRow icon={Phone} label="Phone">
            {student ? (
              <a
                href={`tel:${student.phone.replace(/\s/g, '')}`}
                className="rounded transition-colors hover:text-charcoal hover:underline hover:underline-offset-4"
              >
                {student.phone}
              </a>
            ) : (
              <Skeleton className="h-4 w-32" />
            )}
          </DetailRow>
        </DetailGroup>

        <DetailGroup
          icon={CalendarDays}
          title="Registration"
          description="When this record entered the register."
        >
          <DetailRow icon={CalendarDays} label="Date of registration">
            {student ? formatDate(student.dateOfRegistration) : <Skeleton className="h-4 w-28" />}
          </DetailRow>
          <DetailRow icon={IdCard} label="Student ID">
            <span className="font-mono tracking-tight">
              {student?.studentId ?? <Skeleton className="h-4 w-32" />}
            </span>
          </DetailRow>
        </DetailGroup>

        <Card>
          <CardHeader
            eyebrow="About this record"
            title="How CampusDesk keeps it"
            icon={IdCard}
          />

          <div className="px-panel py-5">
            <ul className="space-y-3.5 text-label leading-relaxed text-muted">
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-beige-strong" aria-hidden="true" />
                CampusDesk issues the student ID when a record is created, and it never changes.
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-beige-strong" aria-hidden="true" />
                Edits keep the same record — the registration date is an administrative fact and only
                an administrator can change it.
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-beige-strong" aria-hidden="true" />
                Deleting removes the record from the register for good.
              </li>
            </ul>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete this student?"
        description={
          student
            ? `${student.name} (${student.studentId}) will be removed from the register. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete student"
      />
    </>
  );
}
