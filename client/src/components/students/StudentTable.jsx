import { Link } from 'react-router-dom';
import { Eye, Pencil, Trash2, Users } from 'lucide-react';

import { Avatar } from '../ui/Avatar.jsx';
import { StatusPill } from '../ui/Badge.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { buttonClasses } from '../ui/buttonStyles.js';
import { DataTable } from '../ui/DataTable.jsx';
import { EmptyState } from '../ui/States.jsx';
import { PAGE_SIZE } from '../../constants/student.js';
import { formatDate } from '../../utils/format.js';
import { paths } from '../../routes/paths.js';

const RowActions = ({ student, onDelete, registerFrom, className }) => (
  <span className={className}>
    <Link
      to={paths.student(student.id)}
      state={{ registerFrom }}
      aria-label={`View ${student.name}`}
      title="View student"
      className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'px-2' })}
    >
      <Eye className="size-4" aria-hidden="true" />
    </Link>
    <Link
      to={paths.editStudent(student.id)}
      state={{ registerFrom }}
      aria-label={`Edit ${student.name}`}
      title="Edit student"
      className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'px-2' })}
    >
      <Pencil className="size-4" aria-hidden="true" />
    </Link>
    <IconButton
      icon={Trash2}
      label={`Delete ${student.name}`}
      onClick={() => onDelete(student)}
      className="size-9 hover:bg-danger/10 hover:text-danger"
    />
  </span>
);

/**
 * The register itself: a table on wide screens and a card per row on narrow
 * ones, both showing the same fields and the same actions.
 *
 * The two representations are designed for their own context rather than
 * shrunk from one another. The table reads down a column — identity, course,
 * year, status, registration — while the card leads with who the student is and
 * keeps the actions reachable at the bottom where a thumb actually is.
 *
 * It is presentational — the rows come from the API through the register hook,
 * and the two things it can *do* (open the delete confirmation, clear the
 * filters) are passed in, so there is only ever one owner of that state.
 */
export const StudentTable = ({
  students,
  isLoading,
  limit,
  isFiltered,
  registerFrom,
  onDelete,
  onClearFilters,
}) => {
  const columns = [
    {
      key: 'name',
      header: 'Student',
      render: (student) => (
        <Link
          to={paths.student(student.id)}
          state={{ registerFrom }}
          className="group flex items-center gap-3 rounded transition-colors"
        >
          <Avatar name={student.name} size="sm" />
          {/* A long name or ID is shortened to keep the row on one line, so the
              full value is still available on hover and to anyone who zooms. */}
          <span className="min-w-0">
            <span
              className="block truncate text-body font-semibold text-ink group-hover:underline group-hover:underline-offset-4"
              title={student.name}
            >
              {student.name}
            </span>
            <span className="block truncate text-meta text-muted" title={student.studentId}>
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
        <span className="block max-w-[15rem]">
          <span className="block truncate text-label font-medium text-charcoal" title={student.course}>
            {student.course}
          </span>
          <span className="block truncate text-meta text-muted" title={student.department}>
            {student.department}
          </span>
        </span>
      ),
    },
    {
      key: 'year',
      header: 'Year',
      // Optional columns only appear once the table is genuinely wide enough;
      // the mobile card carries every field regardless.
      headerClassName: 'hidden xl:table-cell',
      cellClassName: 'hidden xl:table-cell',
      render: (student) => (
        <span className="text-label whitespace-nowrap text-charcoal">{student.year}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (student) => (
        <StatusPill
          status={student.enrollmentStatus}
          label={student.enrollmentStatus === 'active' ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      key: 'registered',
      header: 'Registered',
      headerClassName: 'hidden xl:table-cell',
      cellClassName: 'hidden xl:table-cell',
      render: (student) => (
        <span className="text-label whitespace-nowrap text-muted">
          {formatDate(student.dateOfRegistration)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      headerClassName: 'sr-only',
      render: (student) => (
        <RowActions
          student={student}
          onDelete={onDelete}
          registerFrom={registerFrom}
          className="flex items-center justify-end gap-1"
        />
      ),
    },
  ];

  return (
    <DataTable
      isLoading={isLoading}
      skeletonRows={Math.min(limit, PAGE_SIZE)}
      rows={students}
      columns={columns}
      getRowKey={(student) => student.id}
      renderMobileCard={(student) => (
        <article className="px-panel py-4">
          <div className="flex items-start gap-3">
            <Avatar name={student.name} size="md" />

            <div className="min-w-0 flex-1">
              <Link
                to={paths.student(student.id)}
                state={{ registerFrom }}
                className="block truncate text-subheading font-semibold text-ink"
                title={student.name}
              >
                {student.name}
              </Link>
              <p className="mt-0.5 text-meta text-muted">{student.studentId}</p>
            </div>

            <StatusPill status={student.enrollmentStatus} />
          </div>

          <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5">
            <div className="min-w-0">
              <dt className="eyebrow">Course</dt>
              <dd className="mt-0.5 truncate text-label font-medium text-charcoal" title={student.course}>
                {student.course}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="eyebrow">Year</dt>
              <dd className="mt-0.5 truncate text-label font-medium text-charcoal" title={student.year}>
                {student.year}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="eyebrow">Department</dt>
              <dd
                className="mt-0.5 truncate text-label font-medium text-charcoal"
                title={student.department}
              >
                {student.department}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="eyebrow">Registered</dt>
              <dd className="mt-0.5 text-label font-medium text-charcoal">
                {formatDate(student.dateOfRegistration)}
              </dd>
            </div>
          </dl>

          <div className="mt-3.5 flex items-center justify-end gap-1 border-t border-line/60 pt-3">
            <Link
              to={paths.student(student.id)}
              state={{ registerFrom }}
              className={buttonClasses({ variant: 'ghost', size: 'sm' })}
            >
              <Eye className="size-4" aria-hidden="true" />
              View
            </Link>
            <Link
              to={paths.editStudent(student.id)}
              state={{ registerFrom }}
              className={buttonClasses({ variant: 'ghost', size: 'sm' })}
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Link>
            <IconButton
              icon={Trash2}
              label={`Delete ${student.name}`}
              onClick={() => onDelete(student)}
              className="size-9 hover:bg-danger/10 hover:text-danger"
            />
          </div>
        </article>
      )}
      emptyState={
        <EmptyState
          icon={Users}
          title={isFiltered ? 'No students match these filters' : 'The register is empty'}
          description={
            isFiltered
              ? 'Try a different search term, or clear the filters to see every record.'
              : 'Add your first student and their CampusDesk ID will be generated automatically.'
          }
          action={
            isFiltered ? (
              <Button variant="secondary" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : (
              <Link to={paths.newStudent} className={buttonClasses({ size: 'sm' })}>
                Add student
              </Link>
            )
          }
        />
      }
    />
  );
};
