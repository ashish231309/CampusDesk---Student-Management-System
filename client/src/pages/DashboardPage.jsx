import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  CalendarCheck,
  GraduationCap,
  Layers,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
} from 'lucide-react';

import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { StatusPill } from '../components/ui/Badge.jsx';
import { buttonClasses } from '../components/ui/buttonStyles.js';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { DataTable } from '../components/ui/DataTable.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton, StatCardSkeleton } from '../components/ui/Skeleton.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { useAuth } from '../context/authContext.js';
import { useDashboardSummary } from '../hooks/useDashboardSummary.js';
import { errorMessage } from '../utils/apiErrors.js';
import { formatCount, formatDate, formatRelative } from '../utils/format.js';
import { paths } from '../routes/paths.js';

const greetingFor = (hour) => {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/** A single figure read out inside the greeting band. */
const BandFigure = ({ label, value, isLoading }) => (
  <div className="rounded-card border border-canvas/12 bg-canvas/[0.06] px-4 py-3">
    <p className="text-micro font-semibold tracking-[0.12em] text-beige/80 uppercase">{label}</p>
    {isLoading ? (
      <Skeleton className="mt-2 h-7 w-16 bg-canvas/15" />
    ) : (
      <p className="mt-1.5 text-2xl leading-none font-semibold text-canvas tabular-nums">
        {formatCount(value)}
      </p>
    )}
  </div>
);

export default function DashboardPage() {
  const { user } = useAuth();
  const summary = useDashboardSummary();

  const displayName = user?.name ?? 'there';
  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const maxDepartmentCount = Math.max(...summary.byDepartment.map((row) => row.count), 1);
  const activeShare =
    summary.total > 0 ? Math.round((summary.active / summary.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title={`${greetingFor(new Date().getHours())}, ${displayName}`}
        description={`${today} · here is how the register is looking.`}
        actions={
          <>
            <Link to={paths.students} className={buttonClasses({ variant: 'secondary', size: 'md' })}>
              Browse register
            </Link>
            <Link to={paths.newStudent} className={buttonClasses({ size: 'md' })}>
              <UserPlus className="size-4" aria-hidden="true" />
              Add student
            </Link>
          </>
        }
      />

      {summary.isError ? (
        <Card className="mb-section">
          <ErrorState
            title={
              summary.errorKind === 'forbidden'
                ? 'You cannot view register statistics'
                : 'The register summary could not be loaded'
            }
            description={errorMessage(summary.error)}
            onRetry={summary.refresh}
          />
        </Card>
      ) : null}

      {/* The one band in the product that carries the identity: dark ground,
          beige accents, and the four figures someone opens this page to see. */}
      <section
        aria-label="Register at a glance"
        className="rounded-panel border border-charcoal bg-charcoal px-panel py-5 shadow-card sm:px-gutter"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-micro font-semibold tracking-[0.14em] text-beige/80 uppercase">
              Register at a glance
            </p>
            <p className="mt-2 max-w-xl text-subheading leading-relaxed text-canvas/80">
              {summary.isLoading
                ? 'Reading the register…'
                : `${formatCount(summary.total)} students on CampusDesk across ${formatCount(
                    summary.departmentCount,
                  )} ${summary.departmentCount === 1 ? 'department' : 'departments'}.`}
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-3 sm:max-w-md lg:w-auto">
            <BandFigure label="On register" value={summary.total} isLoading={summary.isLoading} />
            <BandFigure label="Active now" value={summary.active} isLoading={summary.isLoading} />
          </div>
        </div>
      </section>

      <section aria-label="Register summary" className="mt-section grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              index={0}
              label="Students on register"
              value={summary.total}
              hint="All records on CampusDesk"
              icon={GraduationCap}
              tone="charcoal"
            />
            <StatCard
              index={1}
              label="Active enrollments"
              value={summary.active}
              hint={`${activeShare}% of the register`}
              icon={UserRoundCheck}
              tone="success"
            />
            <StatCard
              index={2}
              label="Inactive records"
              value={summary.inactive}
              hint="Paused or completed"
              icon={UserRoundX}
              tone="warning"
            />
            <StatCard
              index={3}
              label="Departments"
              value={summary.departmentCount}
              hint="Represented on the register"
              icon={Building2}
              tone="beige"
            />
          </>
        )}
      </section>

      <div className="mt-section grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            eyebrow="Latest activity"
            title="Recent registrations"
            description="The newest students added to CampusDesk."
            icon={CalendarCheck}
            action={
              <Link
                to={paths.students}
                className="inline-flex items-center gap-1 rounded text-label font-semibold text-charcoal transition-colors hover:text-ink"
              >
                View all
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            }
          />

          <DataTable
            isLoading={summary.isLoading}
            skeletonRows={5}
            rows={summary.recent}
            getRowKey={(student) => student.id}
            columns={[
              {
                key: 'name',
                header: 'Student',
                render: (student) => (
                  <Link
                    to={paths.student(student.id)}
                    className="group flex items-center gap-3 rounded transition-colors"
                  >
                    <Avatar name={student.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-body font-semibold text-ink group-hover:underline group-hover:underline-offset-4">
                        {student.name}
                      </span>
                      <span className="block truncate text-meta text-muted">
                        {student.studentId}
                      </span>
                    </span>
                  </Link>
                ),
              },
              {
                key: 'course',
                header: 'Course',
                render: (student) => (
                  <span className="block max-w-[14rem] truncate text-label text-charcoal">
                    {student.course}
                  </span>
                ),
              },
              {
                key: 'registered',
                header: 'Registered',
                render: (student) => (
                  <span className="text-label whitespace-nowrap text-muted">
                    {formatDate(student.dateOfRegistration)}
                  </span>
                ),
              },
            ]}
            renderMobileCard={(student) => (
              <Link to={paths.student(student.id)} className="flex items-center gap-3 px-panel py-3.5">
                <Avatar name={student.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-ink">
                    {student.name}
                  </span>
                  <span className="block truncate text-meta text-muted">
                    {student.studentId} · {formatRelative(student.dateOfRegistration)}
                  </span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
              </Link>
            )}
            emptyState={
              <EmptyState
                icon={GraduationCap}
                title="No students registered yet"
                description="Once records are added they will appear here, newest first."
                action={
                  <Link to={paths.newStudent} className={buttonClasses({ size: 'sm' })}>
                    Add the first student
                  </Link>
                }
              />
            }
          />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              eyebrow="Distribution"
              title="Enrollment by department"
              description="Where the register is concentrated today."
              icon={Layers}
            />

            <div className="space-y-4 px-panel py-5">
              {summary.isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))
              ) : summary.byDepartment.length === 0 ? (
                <p className="text-label text-muted">
                  No students yet — add one and the distribution appears here.
                </p>
              ) : (
                summary.byDepartment.slice(0, 5).map((row) => (
                  <div key={row.label}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-label font-medium text-charcoal">{row.label}</p>
                      <p className="text-label font-semibold text-ink tabular-nums">{row.count}</p>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas-deep">
                      <div
                        className="h-full rounded-full bg-beige-strong transition-[width] duration-700 ease-out"
                        style={{ width: `${(row.count / maxDepartmentCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Enrolment"
              title="Active and inactive"
              description="How the register divides today."
              icon={UserRoundCheck}
            />

            <div className="px-panel py-5">
              {summary.isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <>
                  {/* One bar, two real proportions — no fabricated chart. */}
                  <div
                    className="flex h-2.5 overflow-hidden rounded-full bg-canvas-deep"
                    role="img"
                    aria-label={`${activeShare}% of records are active`}
                  >
                    <span className="bg-success" style={{ width: `${activeShare}%` }} />
                    <span className="bg-line-strong" style={{ width: `${100 - activeShare}%` }} />
                  </div>

                  <ul className="mt-4 space-y-2.5">
                    {[
                      { label: 'Active', value: summary.active, status: 'active' },
                      { label: 'Inactive', value: summary.inactive, status: 'inactive' },
                    ].map((row) => (
                      <li key={row.label} className="flex items-center justify-between gap-3">
                        <StatusPill status={row.status} label={row.label} />
                        <span className="text-body font-semibold text-ink tabular-nums">
                          {formatCount(row.value)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-4 border-t border-line/60 pt-4 text-meta leading-relaxed text-muted">
                    Status controls whether a student is counted in active enrolment figures.
                  </p>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
