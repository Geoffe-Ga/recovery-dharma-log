/** Landing page - shows the next upcoming meeting. */

import { useCallback, useEffect, useState } from "react";
import {
  cancelMeeting,
  drawTopic,
  getSpeakerNames,
  getUpcomingMeeting,
  getUpcomingMeetings,
  scheduleSpeaker,
  undoTopicDraw,
  unscheduleSpeaker,
  updateAttendance,
} from "../api/index";
import { useShowToast } from "../contexts/ToastContext";
import type { UpcomingMeeting, UpcomingMeetingBrief } from "../types/index";
import { formatMeetingDate, formatMeetingTime } from "../utils/dates";

export function Landing(): React.ReactElement {
  const [meeting, setMeeting] = useState<UpcomingMeeting | null>(null);
  const [lookahead, setLookahead] = useState<UpcomingMeetingBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speakerInput, setSpeakerInput] = useState("");
  const [showSpeakerForm, setShowSpeakerForm] = useState(false);
  const [speakerNames, setSpeakerNames] = useState<string[]>([]);
  const [isCancelling, setIsCancelling] = useState(false);
  const [attendanceInput, setAttendanceInput] = useState("");
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const showToast = useShowToast();

  const refresh = useCallback(async () => {
    try {
      const [updated, upcoming] = await Promise.all([
        getUpcomingMeeting(),
        getUpcomingMeetings(4),
      ]);
      setMeeting(updated);
      // Exclude the first meeting (already shown as primary card)
      setLookahead(upcoming.slice(1));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (showSpeakerForm) {
      getSpeakerNames()
        .then(setSpeakerNames)
        .catch(() => setSpeakerNames([]));
    }
  }, [showSpeakerForm]);

  const handleDrawTopic = useCallback(async () => {
    try {
      await drawTopic();
      await refresh();
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to draw topic",
      );
    }
  }, [refresh, showToast]);

  const handleUndoDraw = useCallback(async () => {
    try {
      await undoTopicDraw();
      await refresh();
      showToast("info", "Topic returned to deck");
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to undo draw",
      );
    }
  }, [refresh, showToast]);

  const handleRedraw = useCallback(async () => {
    try {
      await undoTopicDraw();
      await drawTopic();
      await refresh();
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to re-draw topic",
      );
    }
  }, [refresh, showToast]);

  const handleScheduleSpeaker = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!meeting || !speakerInput.trim()) return;
      try {
        await scheduleSpeaker(meeting.meeting_date, speakerInput.trim());
        setSpeakerInput("");
        setShowSpeakerForm(false);
        await refresh();
        showToast("success", "Speaker scheduled");
      } catch (err: unknown) {
        showToast(
          "error",
          err instanceof Error ? err.message : "Failed to schedule speaker",
        );
      }
    },
    [meeting, speakerInput, refresh, showToast],
  );

  const handleRemoveSpeaker = useCallback(async () => {
    if (!meeting) return;
    try {
      await unscheduleSpeaker(meeting.meeting_date);
      await refresh();
      showToast("success", "Speaker removed");
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to remove speaker",
      );
    }
  }, [meeting, refresh, showToast]);

  const handleSaveAttendance = useCallback(async () => {
    if (!meeting) return;
    const value = attendanceInput.trim();
    const count = value === "" ? null : parseInt(value, 10);
    if (value !== "" && (isNaN(count as number) || (count as number) < 0)) {
      showToast("error", "Please enter a valid number");
      return;
    }
    try {
      await updateAttendance(meeting.meeting_date, count);
      setShowAttendanceForm(false);
      await refresh();
      showToast(
        "success",
        count === null ? "Attendance cleared" : "Attendance saved",
      );
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to save attendance",
      );
    }
  }, [meeting, attendanceInput, refresh, showToast]);

  const handleToggleCancel = useCallback(async () => {
    if (!meeting || isCancelling) return;
    const newCancelled = !meeting.is_cancelled;
    try {
      setIsCancelling(true);
      setShowSpeakerForm(false);
      await cancelMeeting(meeting.meeting_date, newCancelled);
      await refresh();
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to update meeting",
      );
    } finally {
      setIsCancelling(false);
    }
  }, [meeting, isCancelling, refresh, showToast]);

  if (loading) return <p aria-busy="true">Loading...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!meeting) return <p>No upcoming meeting found.</p>;

  const formattedTime = formatMeetingTime(meeting.meeting_time);

  return (
    <main className="rd-landing">
      {meeting.banners.length > 0 && (
        <div role="alert">
          {meeting.banners.map((banner) => (
            <p key={banner}>
              <strong>{banner}</strong>
            </p>
          ))}
        </div>
      )}

      <article className={meeting.is_cancelled ? "rd-cancelled" : undefined}>
        <header>
          <h2>
            {formatMeetingDate(meeting.meeting_date)}
            {formattedTime && (
              <span className="rd-meeting-time"> at {formattedTime}</span>
            )}
          </h2>
          <span className="rd-format-badge">
            {meeting.is_cancelled ? "Cancelled" : meeting.format_type}
          </span>
        </header>

        {meeting.is_cancelled ? (
          <section>
            <p className="rd-meta">This meeting has been cancelled.</p>
            <button
              type="button"
              className="outline"
              disabled={isCancelling}
              onClick={handleToggleCancel}
            >
              Restore Meeting
            </button>
          </section>
        ) : (
          <>
            {meeting.format_type === "Topic" && (
              <section>
                <div className="rd-deck-meter">
                  <div className="rd-deck-meter__label">
                    {meeting.topics_remaining} of {meeting.topics_total} topics
                    remain
                  </div>
                  <div className="rd-deck-meter__bar">
                    <div
                      className="rd-deck-meter__fill"
                      role="progressbar"
                      aria-valuenow={meeting.topics_remaining}
                      aria-valuemin={0}
                      aria-valuemax={meeting.topics_total}
                      aria-label="Topics remaining in deck"
                      style={{
                        width: `${meeting.topics_total > 0 ? (meeting.topics_remaining / meeting.topics_total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                {meeting.topic_name ? (
                  <>
                    <p>
                      <strong>{meeting.topic_name}</strong>
                    </p>
                    <div className="rd-topic-actions">
                      <button
                        type="button"
                        className="outline"
                        onClick={handleUndoDraw}
                      >
                        Undo
                      </button>
                      <button
                        type="button"
                        className="outline"
                        onClick={handleRedraw}
                      >
                        Re-draw
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={handleDrawTopic}>
                    Draw Topic
                  </button>
                )}
              </section>
            )}

            {meeting.format_type === "Speaker" && (
              <section>
                {meeting.speaker_name ? (
                  <>
                    {showSpeakerForm ? (
                      <form onSubmit={handleScheduleSpeaker}>
                        <input
                          type="text"
                          placeholder="Speaker name"
                          value={speakerInput}
                          onChange={(e) => setSpeakerInput(e.target.value)}
                          list="speaker-names"
                        />
                        <button type="submit">Save</button>
                        <button
                          type="button"
                          className="outline"
                          onClick={() => {
                            setShowSpeakerForm(false);
                            setSpeakerInput("");
                          }}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="rd-speaker-display">
                        <p>
                          <strong>{meeting.speaker_name}</strong>
                        </p>
                        <div className="rd-speaker-actions">
                          <button
                            type="button"
                            className="outline rd-icon-btn"
                            aria-label="Edit speaker"
                            onClick={() => {
                              setSpeakerInput(meeting.speaker_name ?? "");
                              setShowSpeakerForm(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="outline rd-danger-outline rd-icon-btn"
                            aria-label="Remove speaker"
                            onClick={handleRemoveSpeaker}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {showSpeakerForm ? (
                      <form onSubmit={handleScheduleSpeaker}>
                        <input
                          type="text"
                          placeholder="Speaker name"
                          value={speakerInput}
                          onChange={(e) => setSpeakerInput(e.target.value)}
                          list="speaker-names"
                        />
                        <button type="submit">Schedule</button>
                        <button
                          type="button"
                          className="outline"
                          onClick={() => setShowSpeakerForm(false)}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowSpeakerForm(true)}
                      >
                        Schedule Speaker
                      </button>
                    )}
                  </>
                )}
              </section>
            )}

            {meeting.format_type === "Book Study" && meeting.book_chapter && (
              <section>
                <p>
                  <strong>{meeting.book_chapter}</strong>
                </p>
              </section>
            )}

            <section className="rd-attendance">
              {meeting.attendance_count != null && !showAttendanceForm ? (
                <div className="rd-attendance__display">
                  <span>Attendance: {meeting.attendance_count}</span>
                  <button
                    type="button"
                    className="outline rd-icon-btn"
                    aria-label="Edit attendance"
                    onClick={() => {
                      setAttendanceInput(
                        String(meeting.attendance_count ?? ""),
                      );
                      setShowAttendanceForm(true);
                    }}
                  >
                    Edit
                  </button>
                </div>
              ) : showAttendanceForm ? (
                <div className="rd-attendance__form">
                  <input
                    type="number"
                    min="0"
                    aria-label="Attendance count"
                    placeholder="Attendance"
                    value={attendanceInput}
                    onChange={(e) => setAttendanceInput(e.target.value)}
                  />
                  <button type="button" onClick={handleSaveAttendance}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => {
                      setShowAttendanceForm(false);
                      setAttendanceInput("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="outline"
                  onClick={() => setShowAttendanceForm(true)}
                >
                  Record Attendance
                </button>
              )}
            </section>

            <section className="rd-cancel-section">
              <button
                type="button"
                className="outline rd-danger-outline"
                disabled={isCancelling}
                onClick={handleToggleCancel}
              >
                Cancel Meeting
              </button>
            </section>
          </>
        )}
      </article>

      {lookahead.length > 0 && (
        <section className="rd-lookahead">
          <h3>Upcoming Meetings</h3>
          <ul className="rd-lookahead__list">
            {lookahead.map((m) => (
              <li key={m.meeting_date} className="rd-lookahead__item">
                <span className="rd-lookahead__date">
                  {formatMeetingDate(m.meeting_date)}
                </span>
                <span
                  className={`rd-lookahead__badge${m.is_cancelled ? " rd-lookahead__badge--cancelled" : ""}`}
                >
                  {m.is_cancelled ? "Cancelled" : m.format_type}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <datalist id="speaker-names">
        {speakerNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </main>
  );
}
