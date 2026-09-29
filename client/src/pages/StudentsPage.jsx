import { Link } from 'react-router-dom';
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
import { paths } from '../routes/paths.js';

/**
 * The student register.
 *
 * The page composes: the controller hook owns the register's state (the URL
 * holds it) and the three feature components below it draw the controls, the
 * active filters and the rows. Nothing here holds a second copy of the query, so
 * reload, back/forward and shared links keep working exactly as they did.
 */
export default function StudentsPage() {
  const register = useStudentRegister();

  return (
    <>
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
        <StudentRegisterToolbar
          query={register.query}
          searchTerm={register.searchTerm}
          onSearchChange={register.setSearchTerm}
          onSearchClear={() => register.setSearchTerm('')}
          options={register.options}
          onFilterChange={register.applyQuery}
        />

        <ActiveFilterChips
          filters={register.activeFilters}
          onRemove={register.removeFilter}
          onClearAll={register.clearFilters}
        />

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
          <>
            <StudentTable
              students={register.items}
              isLoading={register.isLoading}
              limit={register.query.limit}
              isFiltered={register.isFiltered}
              onDelete={register.requestDelete}
              onClearFilters={register.clearFilters}
            />

            {register.status === 'ready' && register.items.length > 0 ? (
              <Pagination
                page={register.meta.page}
                totalPages={register.meta.totalPages}
                total={register.meta.total}
                limit={register.meta.limit}
                onPageChange={(page) => register.applyQuery({ page })}
              />
            ) : null}
          </>
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
