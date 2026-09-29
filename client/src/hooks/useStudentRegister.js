import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useDebouncedValue } from './useDebouncedValue.js';
import { useStudentFilters } from './useStudentFilters.js';
import { useStudentList } from './useStudentList.js';
import { useToast } from '../context/toastContext.js';
import { studentService } from '../services/studentService.js';
import { errorMessage } from '../utils/apiErrors.js';
import { DEFAULT_SORT } from '../constants/student.js';
import {
  describeActiveFilters,
  hasActiveListParams,
  hasInvalidListParams,
  readStudentListQuery,
  writeStudentListQuery,
} from '../utils/studentQuery.js';

/** How long typing settles before it becomes a search. */
export const SEARCH_DEBOUNCE_MS = 320;

/**
 * The register's controller: everything the student list needs that is not a
 * piece of markup.
 *
 * The URL stays the single source of truth — search, filters, sort, page and
 * page size are read from it and every change is written back to it through
 * `utils/studentQuery.js`. Nothing here keeps a second copy of that state, so a
 * shared link, a reload and the back button all behave the same way, and the
 * view components below stay presentational.
 *
 * The one piece of local state is the search *input*, which has to keep up with
 * typing while the URL — and therefore the request — waits for the debounce.
 */
export const useStudentRegister = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = readStudentListQuery(searchParams);

  const [searchTerm, setSearchTerm] = useState(query.search);
  const debouncedSearch = useDebouncedValue(searchTerm, SEARCH_DEBOUNCE_MS);

  /**
   * The last search value this hook put in the URL, or read out of it. It is how
   * "the debounce has landed" is told apart from "the user went back", so only
   * typing can start a request and only a real navigation can change the field.
   */
  const committedSearch = useRef(query.search);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { items, meta, status, error, errorKind, isLoading, refresh } = useStudentList(query);
  const options = useStudentFilters();

  /**
   * Replace the whole register state. Page resets to 1 unless the caller says
   * otherwise, so narrowing a search never strands the user on page 4 of a
   * two-page result.
   */
  const applyQuery = useCallback(
    (patch) => {
      const next = { ...query, ...patch };
      if (patch.page === undefined) next.page = 1;
      setSearchParams(writeStudentListQuery(next), { replace: true });
    },
    [query, setSearchParams],
  );

  /** Lift one filter, leaving the rest of the register as it is. */
  const removeFilter = useCallback(
    (key) => {
      if (key === 'search') {
        committedSearch.current = '';
        setSearchTerm('');
        applyQuery({ search: '' });
        return;
      }

      applyQuery({ [key]: key === 'sort' ? DEFAULT_SORT : '' });
    },
    [applyQuery],
  );

  /** Put the register back to how a first-time visitor sees it. */
  const clearFilters = useCallback(() => {
    committedSearch.current = '';
    setSearchTerm('');
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  // Drop anything the API would reject, so an invalid link self-corrects
  // instead of failing the request.
  useEffect(() => {
    if (hasInvalidListParams(searchParams)) {
      setSearchParams(writeStudentListQuery(readStudentListQuery(searchParams)), { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // A URL the user did not type — the back button, a shared link, "clear all" —
  // is followed by the input, so the field always shows what is on screen.
  useEffect(() => {
    if (query.search === committedSearch.current) return;
    committedSearch.current = query.search;
    setSearchTerm(query.search);
  }, [query.search]);

  // The debounce is the only thing that turns typing into a URL, and the URL is
  // the only thing that turns a search into a request.
  useEffect(() => {
    if (debouncedSearch === committedSearch.current) return;
    committedSearch.current = debouncedSearch;
    applyQuery({ search: debouncedSearch });
  }, [applyQuery, debouncedSearch]);

  /**
   * A delete can empty the page the user is standing on. The API is the
   * authority on how many pages remain, so once the refreshed page arrives and
   * the current one no longer exists, step back to the last real page rather
   * than showing an empty register that is not empty.
   */
  useEffect(() => {
    if (status !== 'ready' || !meta) return;
    if (query.page > meta.totalPages) {
      applyQuery({ page: meta.totalPages });
    }
  }, [applyQuery, meta, query.page, status]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      await studentService.remove(deleteTarget.id);
      toast.success(`${deleteTarget.name} was removed from the register.`, 'Student deleted');
      setDeleteTarget(null);
      // The API confirmed the delete, so the page is re-read rather than edited
      // in place — no row can be left behind by a failed request.
      refresh();
    } catch (deleteError) {
      if (deleteError.isNotFound) {
        toast.info('That student was already removed from the register.', 'Already deleted');
        setDeleteTarget(null);
        refresh();
      } else {
        toast.error(errorMessage(deleteError), 'Could not delete student');
      }
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, refresh, toast]);

  return {
    query,
    searchTerm,
    setSearchTerm,
    options,
    items,
    meta,
    status,
    error,
    errorKind,
    isLoading,
    refresh,
    isFiltered: hasActiveListParams(query),
    activeFilters: describeActiveFilters(query),
    applyQuery,
    removeFilter,
    clearFilters,
    deleteTarget,
    requestDelete: setDeleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete,
    isDeleting,
  };
};
