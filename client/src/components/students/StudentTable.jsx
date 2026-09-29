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

/**
 * The register itself: a table on wide screens and a card per row on narrow
 * ones, both showing the same fields and the same actions.
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
          className="group flex items-center gap-3 rounded transition-colors"
        >
          <Avatar name={student.name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-ink group-hover:underline group-hover:underline-offset-4">
              {student.name}
            </span>
            <span className="block truncate text-[12px] text-muted">{student.studentId}</span>
          </span>
        </Link>
      ),
    },
    {
      key: 'course',
      header: 'Course & department',
      render: (student) => (
        <span className="block max-w-[240px]">
          <span className="block truncate text-[13px] text-charcoal">{student.course}</span>
          <span className="block truncate text-[12px] text-muted">{student.department}</span>
        </span>
      ),
    },
    {
      key: 'year',
      header: 'Year',
      render: (student) => <span className="text-[13px] text-charcoal">{student.year}</span>,
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
      render: (student) => (
        <span className="text-[13px] whitespace-nowrap text-muted">
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
        <span className="flex items-center justify-end gap-1">
          <Link
            to={paths.student(student.id)}
            aria-label={`View ${student.name}`}
            title="View student"
            className={buttonClasses({ variant: 'ghost', size: 'icon' })}
          >
            <Eye className="size-4" aria-hidden="true" />
          </Link>
          <Link
            to={paths.editStudent(student.id)}
            aria-label={`Edit ${student.name}`}
            title="Edit student"
            className={buttonClasses({ variant: 'ghost', size: 'icon' })}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Link>
          <IconButton
            icon={Trash2}
            label={`Delete ${student.name}`}
            onClick={() => onDelete(student)}
            className="hover:bg-danger/10 hover:text-danger"
          />
        </span>
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
        <div className="flex items-start gap-3 px-4 py-4">
          <Avatar name={student.name} size="md" />

          <div className="min-w-0 flex-1">
            <Link
              to={paths.student(student.id)}
              className="truncate text-[14px] font-semibold text-ink hover:underline hover:underline-offset-4"
            >
              {student.name}
            </Link>
            <p className="mt-0.5 truncate text-[12px] text-muted">
              {student.studentId} · {student.year}
            </p>
            <p className="mt-1 truncate text-[12px] text-muted">{student.course}</p>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <StatusPill status={student.enrollmentStatus} />

              <span className="flex items-center gap-1">
                <Link
                  to={paths.student(student.id)}
                  aria-label={`View ${student.name}`}
                  className={buttonClasses({ variant: 'ghost', size: 'icon' })}
                >
                  <Eye className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  to={paths.editStudent(student.id)}
                  aria-label={`Edit ${student.name}`}
                  className={buttonClasses({ variant: 'ghost', size: 'icon' })}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Link>
                <IconButton
                  icon={Trash2}
                  label={`Delete ${student.name}`}
                  onClick={() => onDelete(student)}
                  className="hover:bg-danger/10 hover:text-danger"
                />
              </span>
            </div>
          </div>
        </div>
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
