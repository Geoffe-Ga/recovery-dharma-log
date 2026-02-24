/** Hook for client-side filtering of meeting log entries. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MeetingLogEntry } from "../types/index";

export interface LogFilters {
  startDate: string;
  endDate: string;
  formatType: string;
  search: string;
}

const INITIAL_FILTERS: LogFilters = {
  startDate: "",
  endDate: "",
  formatType: "",
  search: "",
};

export interface UseLogFiltersReturn {
  filters: LogFilters;
  setFilter: (key: keyof LogFilters, value: string) => void;
  clearFilters: () => void;
  filteredEntries: MeetingLogEntry[];
  hasActiveFilters: boolean;
}

function matchesSearch(entry: MeetingLogEntry, term: string): boolean {
  const lower = term.toLowerCase();
  const fields = [
    entry.speaker_name,
    entry.topic_name,
    entry.content_summary,
    entry.format_type,
  ];
  return fields.some((f) => f?.toLowerCase().includes(lower));
}

export function useLogFilters(entries: MeetingLogEntry[]): UseLogFiltersReturn {
  const [filters, setFilters] = useState<LogFilters>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [filters.search]);

  const setFilter = useCallback((key: keyof LogFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setDebouncedSearch("");
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      filters.startDate !== "" ||
      filters.endDate !== "" ||
      filters.formatType !== "" ||
      filters.search !== "",
    [filters],
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (filters.startDate && entry.meeting_date < filters.startDate) {
        return false;
      }
      if (filters.endDate && entry.meeting_date > filters.endDate) {
        return false;
      }
      if (filters.formatType && entry.format_type !== filters.formatType) {
        return false;
      }
      if (debouncedSearch && !matchesSearch(entry, debouncedSearch)) {
        return false;
      }
      return true;
    });
  }, [
    entries,
    filters.startDate,
    filters.endDate,
    filters.formatType,
    debouncedSearch,
  ]);

  return {
    filters,
    setFilter,
    clearFilters,
    filteredEntries,
    hasActiveFilters,
  };
}
