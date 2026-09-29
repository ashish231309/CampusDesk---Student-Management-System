import { Link, useLocation } from 'react-router-dom';
import { UserPlus } from 'lucide-react';

import { PageHeader } from '../components/layout/PageHeader.jsx';
import { ActiveFilterChips } from '../components/students/ActiveFilterChips.jsx';
import { StudentRegisterToolbar } from '../components/students/StudentRegisterToolbar.jsx';
import { StudentTable } from '../components/students/StudentTable.jsx';
import { buttonClasses } from '../components/ui/buttonStyles.js';
import { Card } from '../components/ui/Card.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { errorMessage } from '../utils/apiErrors.js';
import { useStudentRegister } from '../hooks/useStudentRegister.js';
import { currentPath } from '../routes/returnState.js';
import { paths } from '../routes/paths.js';

/**
 * The student register.
 *
 * The page composes: the controller hook owns the register's state (the URL
 * holds it) and the three feature components below it draw the controls, the
 * active filters and the rows. Nothing here holds a second copy of the query, so
 * reload, back/forward and shared links keep working exactly as they did.
 *
 * Every link that leaves this screen carries the register's own URL — search,
 * filters, sort and page included — so coming back from a student, or from
 * adding one, returns to the register the user was working in.
 */
export default function StudentsPage() {
  const register = useStudentRegister();
  const location = useLocation();
  const registerUrl = currentPath(location);

  return (
    <>
      <PageHeader
        title="Students"
        description="Every record on the register. Search, filter and open a student to see their full details."
        actions={
          <Link
            to={paths.newStudent}
            state={{ registerFrom: registerUrl }}
            className={buttonClasses({ size: 'md' })}
          >
            <UserPlus className="size-4" aria-hidden="true" />
            Add student
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <StudentRegisterToolbar
          query={register.query}
          searchTerm={register.searchTerm}
          isSearching={register.isSearching}
          isUpdating={register.isUpdating}
          isFiltered={register.isFiltered}
          activeFilterCount={register.activeFilterCount}
          onSearchChange={register.setSearchTerm}
          onSearchClear={() => register.setSearchTerm('')}
          options={register.options}
          onFilterChange={register.applyQuery}
        />

        <ActiveFilterChips
          filters={register.activeFilters}
          sort={register.activeSort}
          onRemove={register.removeFilter}
          onClearAll={register.clearFilters}
        />

        {/* The visual result is the table itself; this is the same information
            for anyone who cannot see it change under a new search or filter. */}
        <p className="sr-only" role="status" aria-live="polite">
          {register.resultSummary}
        </p>

        {register.status === 'error' ? (
          <ErrorState
            title={
              register.errorKind === 'forbidden'
                ? 'You cannot view this register'
                : 'The register could not be loaded'
            }
            description={errorMessage(register.error)}
            onRetry={register.refresh}
          />
        ) : (
          <div aria-busy={register.isLoading || undefined}>
            <StudentTable
              students={register.items}
              isLoading={register.isLoading}
              limit={register.query.limit}
              isFiltered={register.isFiltered}
              registerFrom={registerUrl}
              onDelete={register.requestDelete}
              onClearFilters={register.clearFilters}
            />

            {register.status === 'ready' && register.items.length > 0 ? (
              <Pagination
                page={register.meta.page}
                totalPages={register.meta.totalPages}
                total={register.meta.total}
                limit={register.meta.limit}
                isFiltered={register.isFiltered}
                onPageChange={(page) => register.applyQuery({ page })}
              />
            ) : null}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(register.deleteTarget)}
        onClose={register.cancelDelete}
        onConfirm={register.confirmDelete}
        isLoading={register.isDeleting}
        title="Delete this student?"
        description={
          register.deleteTarget
            ? `${register.deleteTarget.name} (${register.deleteTarget.studentId}) will be removed from the register. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete student"
      />
    </>
  );
}
