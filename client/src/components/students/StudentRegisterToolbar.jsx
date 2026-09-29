import { SlidersHorizontal } from 'lucide-react';

import { SearchInput } from '../ui/SearchInput.jsx';
import { Select } from '../ui/Field.jsx';
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
 *   Narrow   — the filters that change *which* students are listed
 *   Show     — the choices that only change how the same students are presented
 *
 * The hierarchy is what stops the toolbar reading as a collection of unrelated
 * controls, and it survives the move to one column on a phone without any
 * additional state.
 *
 * It owns nothing: every value comes from the URL through the register hook, and
 * every change goes straight back through it.
 */
export const StudentRegisterToolbar = ({
  query,
  searchTerm,
  isSearching,
  onSearchChange,
  onSearchClear,
  options,
  onFilterChange,
}) => (
  <div className="border-b border-line/60">
    <div className="flex flex-col gap-3 px-panel py-4 lg:flex-row lg:items-center lg:justify-between">
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter by enrollment status"
          value={query.status}
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
    </div>
  </div>
);
