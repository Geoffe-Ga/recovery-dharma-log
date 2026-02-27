/** Meeting log page - shows history of past meetings. */

import React, { useEffect, useState } from "react";
import {
  getCsvExportUrl,
  getMeetingLog,
  getPrintableExportUrl,
  updateMeetingLogEntry,
} from "../api/index";
import { useShowToast } from "../contexts/ToastContext";
import { useLogFilters } from "../hooks/useLogFilters";
import type { MeetingLogEntry, MeetingLogUpdate } from "../types/index";
import { Skeleton } from "../components/Skeleton";
import { formatLogDate } from "../utils/dates";

const FORMAT_OPTIONS = ["", "Speaker", "Topic", "Book Study"];

export function Log(): React.ReactElement {
  const [entries, setEntries] = useState<MeetingLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<MeetingLogUpdate>({});
  const showToast = useShowToast();

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

  function startEditing(entry: MeetingLogEntry): void {
    setEditingId(entry.id);
    setEditForm({
      speaker_name: entry.speaker_name ?? "",
      content_summary: entry.content_summary ?? "",
      is_cancelled: entry.is_cancelled,
    });
  }

  function cancelEditing(): void {
    setEditingId(null);
    setEditForm({});
  }

  async function saveEdit(entryId: number): Promise<void> {
    try {
      const updated = await updateMeetingLogEntry(entryId, editForm);
      setEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
      setEditingId(null);
      setEditForm({});
      showToast("success", "Entry updated");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      showToast("error", message);
    }
  }

  if (loading) return <Skeleton lines={4} />;
  if (error) return <p role="alert">{error}</p>;

  return (
    <main className="rd-log">
      <h1>Meeting Log</h1>
      <nav>
        <a href={getCsvExportUrl(filters.startDate, filters.endDate)}>
          Export CSV
        </a>
        <a
          href={getPrintableExportUrl(filters.startDate, filters.endDate)}
          target="_blank"
          rel="noreferrer"
        >
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
                <th>Attendance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr>
                    <td>{formatLogDate(entry.meeting_date)}</td>
                    <td>{entry.format_type}</td>
                    <td>
                      {entry.speaker_name ??
                        entry.topic_name ??
                        entry.content_summary ??
                        "\u2014"}
                    </td>
                    <td>{entry.is_cancelled ? "Cancelled" : "Held"}</td>
                    <td>{entry.attendance_count ?? "\u2014"}</td>
                    <td>
                      {editingId !== entry.id && (
                        <button
                          type="button"
                          className="outline"
                          onClick={() => startEditing(entry)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                  {editingId === entry.id && (
                    <tr>
                      <td colSpan={6}>
                        <div className="rd-log-edit-form">
                          <label>
                            Speaker Name
                            <input
                              type="text"
                              value={editForm.speaker_name ?? ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  speaker_name: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label>
                            Notes
                            <textarea
                              value={editForm.content_summary ?? ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  content_summary: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="rd-log-edit-form__checkbox">
                            <input
                              type="checkbox"
                              checked={editForm.is_cancelled ?? false}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  is_cancelled: e.target.checked,
                                }))
                              }
                            />
                            Cancelled
                          </label>
                          <div className="rd-log-edit-form__actions">
                            <button
                              type="button"
                              onClick={() => void saveEdit(entry.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="outline"
                              onClick={cancelEditing}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
