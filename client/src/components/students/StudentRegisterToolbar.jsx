import { SlidersHorizontal } from 'lucide-react';

import { SearchInput } from '../ui/SearchInput.jsx';
import { Select } from '../ui/Field.jsx';
import {
  ENROLLMENT_STATUSES,
  PAGE_SIZE_OPTIONS,
  SORT_OPTIONS,
} from '../../constants/student.js';

/**
 * The controls above the register: one search box, the filters that narrow it,
 * and the two choices that change how the same rows are presented (sort and page
 * size).
 *
 * It owns no state. Every value it shows comes from the URL through the
 * register hook, and every change goes straight back through it.
 */
export const StudentRegisterToolbar = ({
  query,
  searchTerm,
  onSearchChange,
  onSearchClear,
  options,
  onFilterChange,
}) => (
  <div className="flex flex-col gap-3 border-b border-line/60 px-5 py-4 lg:flex-row lg:items-center">
    <SearchInput
      value={searchTerm}
      onChange={(event) => onSearchChange(event.target.value)}
      onClear={onSearchClear}
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
        value={query.status}
        onChange={(event) => onFilterChange({ status: event.target.value })}
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
        value={query.year}
        onChange={(event) => onFilterChange({ year: event.target.value })}
        className="h-10 w-full text-[13px] sm:w-[140px]"
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
        className="h-10 w-full text-[13px] sm:w-[180px]"
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
        className="h-10 w-full text-[13px] sm:w-[200px]"
      >
        <option value="">All courses</option>
        {options.courses.map((course) => (
          <option key={course} value={course}>
            {course}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Sort students"
        value={query.sort}
        onChange={(event) => onFilterChange({ sort: event.target.value })}
        className="h-10 w-full text-[13px] sm:w-[160px]"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Rows per page"
        value={String(query.limit)}
        onChange={(event) => onFilterChange({ limit: Number(event.target.value) })}
        className="h-10 w-full text-[13px] sm:w-[130px]"
      >
        {PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size} per page
          </option>
        ))}
      </Select>
    </div>
  </div>
);
