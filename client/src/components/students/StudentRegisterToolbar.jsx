import { SlidersHorizontal } from 'lucide-react';

import { SearchInput } from '../ui/SearchInput.jsx';
import { Select } from '../ui/Field.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import {
  ENROLLMENT_STATUSES,
  PAGE_SIZE_OPTIONS,
  SORT_OPTIONS,
} from '../../constants/student.js';

const FILTER_CLASS = 'h-10 w-full text-label sm:w-auto sm:min-w-[9.5rem]';

/**
 * The controls above the register, in three deliberate groups rather than one
 * row of equal boxes:
 *
 *   search   — what the user typed
 *   Sort/Show — how the same students are presented
 *   Narrow   — the filters that change *which* students are listed
 *
 * The hierarchy is what stops the toolbar reading as a collection of unrelated
 * controls, and it survives the move to one column on a phone without any
 * additional state.
 *
 * The toolbar also answers two questions without the user having to open
 * anything: which controls are currently narrowing the register (each carries an
 * active treatment, and the strip counts them), and whether the register is
 * being read again after a change (`isUpdating`, which is not the same as the
 * search box being busy).
 *
 * It owns nothing: every value comes from the URL through the register hook, and
 * every change goes straight back through it.
 */
export const StudentRegisterToolbar = ({
  query,
  searchTerm,
  isSearching,
  isUpdating,
  isFiltered,
  activeFilterCount,
  onSearchChange,
  onSearchClear,
  options,
  onFilterChange,
}) => (
  <div className="border-b border-line/60">
    <div className="flex flex-col gap-3 px-panel py-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="w-full lg:max-w-md">
        <SearchInput
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          onClear={onSearchClear}
          isBusy={isSearching}
          placeholder="Search name, ID, email or phone…"
        />

        <p className="mt-1.5 text-meta leading-relaxed text-muted">
          Matches part of a word, and every word has to match something —{' '}
          <span className="font-medium text-charcoal">kumar cse</span> finds a student by name and
          course together.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:justify-end">
        <div className="flex items-center gap-2">
          <span className="text-meta font-medium text-muted">Sort</span>
          <Select
            aria-label="Sort students"
            value={query.sort}
            isActive={query.sort !== SORT_OPTIONS[0].value}
            onChange={(event) => onFilterChange({ sort: event.target.value })}
            className="h-10 w-full text-label sm:w-[11rem]"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-meta font-medium text-muted">Show</span>
          <Select
            aria-label="Rows per page"
            value={String(query.limit)}
            onChange={(event) => onFilterChange({ limit: Number(event.target.value) })}
            className="h-10 w-full text-label sm:w-[7.5rem]"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>

    <div className="flex flex-col gap-3 border-t border-line/60 bg-surface-muted px-panel py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-chip bg-beige/60 text-charcoal">
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
        </span>
        <span className="eyebrow">Narrow the register</span>
        {activeFilterCount > 0 ? (
          <span className="rounded-full border border-beige-strong/60 bg-beige/60 px-2 py-0.5 text-micro font-semibold tracking-normal text-charcoal">
            {activeFilterCount} active
          </span>
        ) : null}

        {isUpdating ? <Spinner label="Updating results…" className="ml-1 text-muted" /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter by enrollment status"
          value={query.status}
          isActive={Boolean(query.status)}
          onChange={(event) => onFilterChange({ status: event.target.value })}
          className={FILTER_CLASS}
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
          value={query.year}
          isActive={Boolean(query.year)}
          onChange={(event) => onFilterChange({ year: event.target.value })}
          className={FILTER_CLASS}
        >
          <option value="">All years</option>
          {options.years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by department"
          value={query.department}
          isActive={Boolean(query.department)}
          onChange={(event) => onFilterChange({ department: event.target.value })}
          className={FILTER_CLASS}
        >
          <option value="">All departments</option>
          {options.departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by course"
          value={query.course}
          isActive={Boolean(query.course)}
          onChange={(event) => onFilterChange({ course: event.target.value })}
          className={FILTER_CLASS}
        >
          <option value="">All courses</option>
          {options.courses.map((course) => (
            <option key={course} value={course}>
              {course}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-meta leading-relaxed text-muted lg:sr-only">
        {isFiltered
          ? 'Changing a filter, the sort or the page size starts again at page 1.'
          : 'Courses and departments are read from the register itself.'}
      </p>
    </div>
  </div>
);
