/** Meeting log page - shows history of past meetings. */

import { useEffect, useState } from "react";
import {
  getCsvExportUrl,
  getMeetingLog,
  getPrintableExportUrl,
} from "../api/index";
import { useLogFilters } from "../hooks/useLogFilters";
import type { MeetingLogEntry } from "../types/index";
import { formatLogDate } from "../utils/dates";

const FORMAT_OPTIONS = ["", "Speaker", "Topic", "Book Study"];

export function Log(): React.ReactElement {
  const [entries, setEntries] = useState<MeetingLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMeetingLog()
      .then(setEntries)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, []);

  const {
    filters,
    setFilter,
    clearFilters,
    filteredEntries,
    hasActiveFilters,
  } = useLogFilters(entries);

  if (loading) return <p aria-busy="true">Loading...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <main className="rd-log">
      <h1>Meeting Log</h1>
      <nav>
        <a href={getCsvExportUrl()}>Export CSV</a>
        <a href={getPrintableExportUrl()} target="_blank" rel="noreferrer">
          Printable View
        </a>
      </nav>

      {entries.length > 0 && (
        <div className="rd-filter-bar">
          <label>
            From
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilter("startDate", e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilter("endDate", e.target.value)}
            />
          </label>
          <label>
            Format
            <select
              value={filters.formatType}
              onChange={(e) => setFilter("formatType", e.target.value)}
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt || "All"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search
            <input
              type="text"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
            />
          </label>
          {hasActiveFilters && (
            <button type="button" className="outline" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <p>No meetings recorded yet.</p>
      ) : filteredEntries.length === 0 ? (
        <p>No matching meetings.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Format</th>
                <th>Content</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatLogDate(entry.meeting_date)}</td>
                  <td>{entry.format_type}</td>
                  <td>
                    {entry.speaker_name ??
                      entry.topic_name ??
                      entry.content_summary ??
                      "\u2014"}
                  </td>
                  <td>{entry.is_cancelled ? "Cancelled" : "Held"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
