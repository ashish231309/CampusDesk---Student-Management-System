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
import { Card } from '../components/ui/Card.jsx';
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

const DetailRow = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 px-5 py-3.5">
    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-beige/50 text-charcoal">
      <Icon className="size-4" aria-hidden="true" />
    </span>

    <div className="min-w-0">
      <dt className="text-[12px] font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-[14px] font-medium break-words text-ink">{children}</dd>
    </div>
  </div>
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
            ? `Registered ${formatDate(student.dateOfRegistration)} · ${formatRelative(student.dateOfRegistration)}`
            : undefined
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => navigate(paths.students)}
              className="hidden sm:inline-flex"
            >
              Back
            </Button>
            {student ? (
              <>
                <Link to={paths.editStudent(student.id)} className={buttonClasses({})}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit details
                </Link>
                <Button variant="ghost" icon={Trash2} onClick={() => setIsConfirmOpen(true)}>
                  Delete
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          {student ? (
            <>
              <div className="flex flex-wrap items-center gap-5 border-b border-line/60 px-5 py-6">
                <Avatar name={student.name} src={student.avatarUrl || undefined} size="xl" />

                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight text-ink">{student.name}</h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[12px] font-semibold text-charcoal">
                      <IdCard className="size-3.5" aria-hidden="true" />
                      {student.studentId}
                    </span>
                    <StatusPill status={student.enrollmentStatus} />
                  </div>
                </div>
              </div>

              <dl className="divide-y divide-line/60">
                <DetailRow icon={Mail} label="Email">
                  <a
                    href={`mailto:${student.email}`}
                    className="rounded transition-colors hover:text-charcoal hover:underline hover:underline-offset-4"
                  >
                    {student.email}
                  </a>
                </DetailRow>

                <DetailRow icon={Phone} label="Phone">
                  <a
                    href={`tel:${student.phone.replace(/\s/g, '')}`}
                    className="rounded transition-colors hover:text-charcoal hover:underline hover:underline-offset-4"
                  >
                    {student.phone}
                  </a>
                </DetailRow>

                <DetailRow icon={BookOpen} label="Course">
                  {student.course}
                </DetailRow>

                <DetailRow icon={GraduationCap} label="Year">
                  {student.year}
                </DetailRow>

                <DetailRow icon={Building2} label="Department">
                  {student.department}
                </DetailRow>

                <DetailRow icon={CalendarDays} label="Date of registration">
                  {formatDate(student.dateOfRegistration)}
                </DetailRow>
              </dl>
            </>
          ) : (
            <div className="space-y-5 px-5 py-6">
              <div className="flex items-center gap-5">
                <Skeleton className="size-20 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-2/3" />
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="border-b border-line/60 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-ink">Enrollment</h2>
              <p className="mt-1 text-[13px] text-muted">
                Status controls whether the student appears in active enrolment counts.
              </p>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium text-charcoal">Current status</span>
                {student ? <StatusPill status={student.enrollmentStatus} /> : <Skeleton className="h-6 w-20 rounded-full" />}
              </div>

              <dl className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Year', value: student?.year },
                  { label: 'Department', value: student?.department },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-line/70 bg-canvas/60 px-3.5 py-3">
                    <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                      {label}
                    </dt>
                    <dd className="mt-1 text-[13px] font-medium text-ink">{value ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>

          <Card>
            <div className="px-5 py-4">
              <h2 className="text-[15px] font-semibold text-ink">Record</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Student IDs are issued by CampusDesk and cannot be edited. Every change to a record is
                stored with a timestamp.
              </p>

              <dl className="mt-4 space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Registration</dt>
                  <dd className="font-medium text-ink">{formatDate(student?.dateOfRegistration)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Student ID</dt>
                  <dd className="font-medium text-ink">{student?.studentId ?? '—'}</dd>
                </div>
              </dl>
            </div>
          </Card>
        </div>
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
