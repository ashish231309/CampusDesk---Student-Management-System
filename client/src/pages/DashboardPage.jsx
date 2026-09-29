import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  CalendarCheck,
  CalendarRange,
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
import { Spinner } from '../components/ui/Spinner.jsx';
import { StatCard } from '../components/ui/StatCard.jsx';
import { useAuth } from '../context/authContext.js';
import { useBarGrowth } from '../hooks/useBarGrowth.js';
import { useDashboardSummary } from '../hooks/useDashboardSummary.js';
import { errorMessage } from '../utils/apiErrors.js';
import { formatCount, formatDate, formatRelative } from '../utils/format.js';
import { paths, studentRegisterHref } from '../routes/paths.js';

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

/**
 * One row of a distribution list, linking into the register already narrowed to
 * whoever that row describes. The link is the row's label, so its accessible
 * name says where it goes ("Computer Science, 42 students"), and long department
 * or course names truncate rather than pushing the count off the panel.
 */
const DistributionRow = ({ label, count, max, to }) => (
  <li>
    <Link
      to={to}
      className="focus-ring group block rounded-field py-1"
      title={`${label} — ${formatCount(count)} ${count === 1 ? 'student' : 'students'}`}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate text-label font-medium text-charcoal group-hover:text-ink group-hover:underline group-hover:underline-offset-4">
          {label}
        </span>
        <span className="shrink-0 text-label font-semibold text-ink tabular-nums">
          {formatCount(count)}
        </span>
      </span>

      <span className="mt-2 block h-2 overflow-hidden rounded-full bg-canvas-deep">
        {/* The width is React's, and it is what the HTML says; GSAP only grows
            the bar towards it. `data-bar` gives the animation a stable name, so
            a refresh slides a bar rather than restarting it. */}
        <span
          data-bar={label}
          className="block h-full rounded-full bg-beige-strong"
          style={{ width: `${Math.max((count / max) * 100, 3)}%` }}
        />
      </span>

      <span className="sr-only">
        {count === 1 ? '1 student' : `${formatCount(count)} students`} — open in the register
      </span>
    </Link>
  </li>
);

/** A distribution panel: the same list, driven by whatever the API grouped by. */
const DistributionCard = ({ eyebrow, title, description, icon, rows, isLoading, emptyText, scopeRef }) => {
  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <Card>
      <CardHeader eyebrow={eyebrow} title={title} description={description} icon={icon} />

      <div className="px-panel py-4">
        {isLoading ? (
          <div className="space-y-4 py-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-1 text-label leading-relaxed text-muted">{emptyText}</p>
        ) : (
          <ul ref={scopeRef} className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {rows.map((row) => (
              <DistributionRow
                key={row.label}
                label={row.label}
                count={row.count}
                max={max}
                to={row.to}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default function DashboardPage() {
  const { user } = useAuth();
  const summary = useDashboardSummary();

  /**
   * Each measured panel gets its own animation scope, and a signature built from
   * the numbers it is showing. The signature is what tells an entrance apart
   * from an update: while it is unchanged, a re-render — a refresh that returned
   * the same figures, the toast list, the user menu — cannot restart anything.
   */
  const departmentBars = useBarGrowth(
    summary.byDepartment.map((row) => `${row.label}:${row.count}`).join('|'),
  );
  const yearBars = useBarGrowth(summary.byYear.map((row) => `${row.label}:${row.count}`).join('|'));
  const statusBar = useBarGrowth(`${summary.active}:${summary.inactive}:${summary.total}`);

  const displayName = user?.name ?? 'there';
  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

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

      {/* A summary that could not be read is not a summary of zero students:
          the figures are withheld and the failure is explained instead. */}
      {summary.isError ? (
        <Card>
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
      ) : (
        <div aria-busy={summary.isLoading || summary.isRefreshing || undefined}>
          {/* The one band in the product that carries the identity: dark ground,
              beige accents, and the two figures someone opens this page to see. */}
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
                  {summary.hasData
                    ? `${formatCount(summary.total)} students on CampusDesk across ${formatCount(
                        summary.departmentCount,
                      )} ${summary.departmentCount === 1 ? 'department' : 'departments'}.`
                    : 'Reading the register…'}
                </p>
                {summary.isRefreshing ? (
                  <Spinner label="Updating figures…" className="mt-3 text-canvas/70" />
                ) : null}
              </div>

              <div className="grid w-full grid-cols-2 gap-3 sm:max-w-md lg:w-auto">
                <BandFigure label="On register" value={summary.total} isLoading={!summary.hasData} />
                <BandFigure label="Active now" value={summary.active} isLoading={!summary.hasData} />
              </div>
            </div>
          </section>

          {/* Each figure is a way into the register, already narrowed to the
              students it describes. */}
          <section
            aria-label="Register summary"
            className="mt-section grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {summary.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)
            ) : (
              <>
                <StatCard
                  index={0}
                  label="Students on register"
                  value={summary.total}
                  hint="Every student record on CampusDesk"
                  icon={GraduationCap}
                  tone="charcoal"
                  to={studentRegisterHref()}
                  toLabel="Open the register"
                />
                <StatCard
                  index={1}
                  label="Active students"
                  value={summary.active}
                  hint="Records whose status is active"
                  icon={UserRoundCheck}
                  tone="success"
                  to={studentRegisterHref({ status: 'active' })}
                  toLabel="Open the active students in the register"
                />
                <StatCard
                  index={2}
                  label="Inactive students"
                  value={summary.inactive}
                  hint="Records whose status is inactive"
                  icon={UserRoundX}
                  tone="warning"
                  to={studentRegisterHref({ status: 'inactive' })}
                  toLabel="Open the inactive students in the register"
                />
                <StatCard
                  index={3}
                  label="Departments represented"
                  value={summary.departmentCount}
                  hint="Departments with students on the register"
                  icon={Building2}
                  tone="beige"
                  to={studentRegisterHref()}
                  toLabel="Open the register to filter by department"
                />
              </>
            )}
          </section>

          <div className="mt-section grid gap-6 xl:grid-cols-[1.35fr_1fr]">
            <Card className="overflow-hidden">
              <CardHeader
                eyebrow="Latest additions"
                title="Recent registrations"
                description="The five newest records, by date of registration."
                icon={CalendarCheck}
                action={
                  <Link
                    to={paths.students}
                    className="focus-ring inline-flex items-center gap-1 rounded text-label font-semibold text-charcoal transition-colors hover:text-ink"
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
                        <span className="sr-only">— open this student</span>
                      </Link>
                    ),
                  },
                  {
                    key: 'course',
                    header: 'Course',
                    render: (student) => (
                      <span className="block max-w-[14rem]">
                        <span className="block truncate text-label font-medium text-charcoal">
                          {student.course}
                        </span>
                        <span className="block truncate text-meta text-muted">
                          {student.department}
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    headerClassName: 'hidden xl:table-cell',
                    cellClassName: 'hidden xl:table-cell',
                    render: (student) => <StatusPill status={student.enrollmentStatus} />,
                  },
                  {
                    key: 'registered',
                    header: 'Registered',
                    render: (student) => (
                      <span className="block whitespace-nowrap">
                        <span className="block text-label text-charcoal">
                          {formatDate(student.dateOfRegistration)}
                        </span>
                        <span className="block text-meta text-muted">
                          {formatRelative(student.dateOfRegistration)}
                        </span>
                      </span>
                    ),
                  },
                ]}
                renderMobileCard={(student) => (
                  <Link
                    to={paths.student(student.id)}
                    className="focus-ring flex items-center gap-3 px-panel py-3.5"
                  >
                    <Avatar name={student.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-ink">
                        {student.name}
                      </span>
                      <span className="block truncate text-meta text-muted">
                        {student.studentId} · {formatRelative(student.dateOfRegistration)}
                      </span>
                    </span>
                    <StatusPill status={student.enrollmentStatus} />
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
              <DistributionCard
                eyebrow="Distribution"
                title="Enrollment by department"
                description="Departments with students, largest first."
                icon={Layers}
                isLoading={summary.isLoading}
                scopeRef={departmentBars}
                rows={summary.byDepartment.map((row) => ({
                  ...row,
                  to: studentRegisterHref({ department: row.label }),
                }))}
                emptyText="No students yet — add one and the distribution appears here."
              />

              <DistributionCard
                eyebrow="Distribution"
                title="Students by year of study"
                description="How the register spreads across the years."
                icon={CalendarRange}
                isLoading={summary.isLoading}
                scopeRef={yearBars}
                rows={summary.byYear.map((row) => ({
                  ...row,
                  to: studentRegisterHref({ year: row.label }),
                }))}
                emptyText="No students yet — add one and the year breakdown appears here."
              />

              <Card>
                <CardHeader
                  eyebrow="Enrolment"
                  title="Active and inactive"
                  description="How the register divides by enrollment status."
                  icon={UserRoundCheck}
                />

                <div className="px-panel py-5">
                  {summary.isLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : !summary.hasData || summary.total === 0 ? (
                    <p className="text-label leading-relaxed text-muted">
                      No students yet — status counts appear once records are added.
                    </p>
                  ) : (
                    <>
                      {/* One bar, two real counts from the API — no fabricated chart. */}
                      <div
                        ref={statusBar}
                        className="flex h-2.5 overflow-hidden rounded-full bg-canvas-deep"
                        role="img"
                        aria-label={`${formatCount(summary.active)} active and ${formatCount(
                          summary.inactive,
                        )} inactive records`}
                      >
                        <span
                          data-bar="active"
                          className="bg-success"
                          style={{ width: `${(summary.active / summary.total) * 100}%` }}
                        />
                        <span
                          data-bar="inactive"
                          className="bg-line-strong"
                          style={{ width: `${(summary.inactive / summary.total) * 100}%` }}
                        />
                      </div>

                      <ul className="mt-4 space-y-1">
                        {[
                          {
                            label: 'Active',
                            value: summary.active,
                            status: 'active',
                            to: studentRegisterHref({ status: 'active' }),
                          },
                          {
                            label: 'Inactive',
                            value: summary.inactive,
                            status: 'inactive',
                            to: studentRegisterHref({ status: 'inactive' }),
                          },
                        ].map((row) => (
                          <li key={row.label}>
                            <Link
                              to={row.to}
                              className="focus-ring flex items-center justify-between gap-3 rounded-field px-1 py-2 transition-colors hover:bg-beige/25"
                            >
                              <StatusPill status={row.status} label={row.label} />
                              <span className="flex items-center gap-2">
                                <span className="text-body font-semibold text-ink tabular-nums">
                                  {formatCount(row.value)}
                                </span>
                                <ArrowUpRight
                                  className="size-3.5 text-muted"
                                  aria-hidden="true"
                                />
                                <span className="sr-only">
                                  Open the {row.label.toLowerCase()} students in the register
                                </span>
                              </span>
                            </Link>
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
        </div>
      )}
    </>
  );
}
