import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, Filter, Pencil, SlidersHorizontal, Trash2, UserPlus, Users } from 'lucide-react';

import { PageHeader } from '../components/layout/PageHeader.jsx';
import { PageTransition } from '../components/motion/PageTransition.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { StatusPill } from '../components/ui/Badge.jsx';
import { Button, IconButton } from '../components/ui/Button.jsx';
import { buttonClasses } from '../components/ui/buttonStyles.js';
import { Card } from '../components/ui/Card.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { DataTable } from '../components/ui/DataTable.jsx';
import { SearchInput } from '../components/ui/SearchInput.jsx';
import { Select } from '../components/ui/Field.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { useToast } from '../context/toastContext.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { useStudentList } from '../hooks/useStudentList.js';
import { studentService } from '../services/studentService.js';
import {
  DEPARTMENTS,
  ENROLLMENT_STATUSES,
  PAGE_SIZE,
  SORT_OPTIONS,
  STUDENT_YEARS,
} from '../constants/student.js';
import { formatDate } from '../utils/format.js';
import { paths } from '../routes/paths.js';

export default function StudentsPage() {
  const toast = useToast();

  // Filters live in the URL so a filtered register can be shared or reloaded.
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(searchTerm, 320);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filters = {
    search: debouncedSearch,
    status: searchParams.get('status') ?? '',
    year: searchParams.get('year') ?? '',
    department: searchParams.get('department') ?? '',
    sort: searchParams.get('sort') ?? SORT_OPTIONS[0].value,
    page: Number(searchParams.get('page') ?? 1),
    limit: PAGE_SIZE,
  };

  const { items, meta, status, error, isFiltered, isLoading } = useStudentList(filters);

  const updateFilter = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries({ ...patch, page: patch.page ?? 1 }).forEach(([key, value]) => {
      if (value === '' || value === undefined || value === null) next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  // Keep the URL's search parameter in step with the debounced input.
  useEffect(() => {
    const current = searchParams.get('search') ?? '';
    if (current === debouncedSearch) return;
    updateFilter({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the debounced term should retrigger this
  }, [debouncedSearch]);

  const clearFilters = () => {
    setSearchTerm('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      await studentService.remove(deleteTarget.id);
      toast.success(`${deleteTarget.name} was removed from the register.`, 'Student deleted');
      setDeleteTarget(null);
    } catch (deleteError) {
      toast.error(deleteError.message, 'Could not delete student');
    } finally {
      setIsDeleting(false);
    }
  };

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
            onClick={() => setDeleteTarget(student)}
            className="hover:bg-danger/10 hover:text-danger"
          />
        </span>
      ),
    },
  ];

  return (
    <PageTransition>
      <PageHeader
        title="Students"
        description="Every record on the register. Search, filter and open a student to see their full details."
        actions={
          <Link to={paths.newStudent} className={buttonClasses({ size: 'md' })}>
            <UserPlus className="size-4" aria-hidden="true" />
            Add student
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line/60 px-5 py-4 lg:flex-row lg:items-center">
          <SearchInput
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onClear={() => setSearchTerm('')}
            className="lg:max-w-sm lg:flex-1"
            placeholder="Search by name, ID, email or course…"
          />

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="sr-only">Filters</span>
            </div>

            <Select
              aria-label="Filter by enrollment status"
              value={filters.status}
              onChange={(event) => updateFilter({ status: event.target.value })}
              className="h-10 w-full text-[13px] sm:w-[150px]"
            >
              <option value="">All statuses</option>
              {ENROLLMENT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Filter by year"
              value={filters.year}
              onChange={(event) => updateFilter({ year: event.target.value })}
              className="h-10 w-full text-[13px] sm:w-[140px]"
            >
              <option value="">All years</option>
              {STUDENT_YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Filter by department"
              value={filters.department}
              onChange={(event) => updateFilter({ department: event.target.value })}
              className="h-10 w-full text-[13px] sm:w-[180px]"
            >
              <option value="">All departments</option>
              {DEPARTMENTS.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Sort students"
              value={filters.sort}
              onChange={(event) => updateFilter({ sort: event.target.value })}
              className="h-10 w-full text-[13px] sm:w-[160px]"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            {isFiltered ? (
              <Button variant="ghost" size="sm" icon={Filter} onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {status === 'error' ? (
          <ErrorState
            title="The register could not be loaded"
            description={error?.message}
            onRetry={() => window.location.reload()}
          />
        ) : (
          <>
            <DataTable
              isLoading={isLoading}
              skeletonRows={PAGE_SIZE}
              rows={items}
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
                          onClick={() => setDeleteTarget(student)}
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
                      <Button variant="secondary" onClick={clearFilters}>
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

            {status === 'ready' && items.length > 0 ? (
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                limit={meta.limit}
                onPageChange={(page) => updateFilter({ page })}
              />
            ) : null}
          </>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete this student?"
        description={
          deleteTarget
            ? `${deleteTarget.name} (${deleteTarget.studentId}) will be removed from the register. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete student"
      />
    </PageTransition>
  );
}
