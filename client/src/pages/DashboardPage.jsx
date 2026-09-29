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
import { StatCard } from '../components/ui/StatCard.jsx';
import { StatCardSkeleton } from '../components/ui/Skeleton.jsx';
import { useAuth } from '../context/authContext.js';
import { useDashboardSummary } from '../hooks/useDashboardSummary.js';
import { errorMessage } from '../utils/apiErrors.js';
import { formatDate, formatRelative } from '../utils/format.js';
import { paths } from '../routes/paths.js';

const greetingFor = (hour) => {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

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
      ) : null}

      <section aria-label="Register summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              hint={`${Math.round((summary.active / Math.max(summary.total, 1)) * 100)}% of the register`}
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Recent registrations"
            description="The newest students added to CampusDesk."
            icon={CalendarCheck}
            action={
              <Link
                to={paths.students}
                className="inline-flex items-center gap-1 rounded text-[13px] font-semibold text-charcoal transition-colors hover:text-ink"
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
                    className="flex items-center gap-3 rounded transition-colors hover:text-ink"
                  >
                    <Avatar name={student.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {student.name}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
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
                  <span className="block max-w-[220px] truncate text-[13px] text-charcoal">
                    {student.course}
                  </span>
                ),
              },
              {
                key: 'registered',
                header: 'Registered',
                render: (student) => (
                  <span className="text-[13px] text-muted">
                    {formatDate(student.dateOfRegistration)}
                  </span>
                ),
              },
            ]}
            renderMobileCard={(student) => (
              <Link to={paths.student(student.id)} className="flex items-center gap-3 px-4 py-3.5">
                <Avatar name={student.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">
                    {student.name}
                  </span>
                  <span className="block truncate text-[12px] text-muted">
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
              title="Enrollment by department"
              description="Where the register is concentrated today."
              icon={Layers}
            />

            <div className="space-y-3.5 px-5 py-4">
              {summary.isLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="animate-pulse space-y-2">
                      <span className="block h-3 w-32 rounded bg-line/60" />
                      <span className="block h-2 w-full rounded bg-line/50" />
                    </div>
                  ))
                : summary.byDepartment.length === 0
                ? (
                    <p className="text-[13px] text-muted">
                      No students yet — add one and the distribution appears here.
                    </p>
                  )
                : summary.byDepartment.slice(0, 5).map((row) => (
                    <div key={row.label}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-[13px] font-medium text-charcoal">{row.label}</p>
                        <p className="text-[13px] font-semibold text-ink tabular-nums">{row.count}</p>
                      </div>

                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas">
                        <div
                          className="h-full rounded-full bg-beige-strong transition-[width] duration-700 ease-out"
                          style={{ width: `${(row.count / maxDepartmentCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Enrollment status" description="Active versus inactive records." icon={UserRoundCheck} />

            <ul className="divide-y divide-line/60">
              {summary.isLoading ? (
                <li className="px-5 py-4">
                  <span className="block h-4 w-40 animate-pulse rounded bg-line/60" />
                </li>
              ) : (
                [
                  { label: 'Active', value: summary.active, status: 'active' },
                  { label: 'Inactive', value: summary.inactive, status: 'inactive' },
                ].map((row) => (
                  <li key={row.label} className="flex items-center justify-between px-5 py-3.5">
                    <StatusPill status={row.status} label={row.label} />
                    <span className="text-sm font-semibold text-ink tabular-nums">{row.value}</span>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
