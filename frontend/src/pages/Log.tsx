/** Meeting log page - shows history of past meetings. */

import { useEffect, useState } from "react";
import {
  getCsvExportUrl,
  getMeetingLog,
  getPrintableExportUrl,
} from "../api/index";
import type { MeetingLogEntry } from "../types/index";

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

      {entries.length === 0 ? (
        <p>No meetings recorded yet.</p>
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
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.meeting_date}</td>
                  <td>{entry.format_type}</td>
                  <td>
                    {entry.speaker_name ??
                      entry.topic_name ??
                      entry.content_summary ??
                      "—"}
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
