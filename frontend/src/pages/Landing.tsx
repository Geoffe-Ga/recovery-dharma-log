/** Landing page - shows the next upcoming meeting. */

import { useCallback, useEffect, useState } from "react";
import {
  cancelMeeting,
  deleteFormatOverride,
  drawTopic,
  getFormatOverrides,
  getSpeakerNames,
  getUpcomingMeeting,
  getUpcomingMeetings,
  getUpcomingSpeakerDates,
  scheduleSpeaker,
  setFormatOverride,
  undoTopicDraw,
  unscheduleSpeaker,
  updateDana,
} from "../api/index";
import { useShowToast } from "../contexts/ToastContext";
import type {
  FormatOverride,
  SpeakerSchedule,
  UpcomingMeeting,
  UpcomingMeetingBrief,
} from "../types/index";
import { ErrorWithRetry } from "../components/ErrorWithRetry";
import { Skeleton } from "../components/Skeleton";
import { formatMeetingDate, formatMeetingTime } from "../utils/dates";

export function Landing(): React.ReactElement {
  const [meeting, setMeeting] = useState<UpcomingMeeting | null>(null);
  const [lookahead, setLookahead] = useState<UpcomingMeetingBrief[]>([]);
  const [speakerDates, setSpeakerDates] = useState<SpeakerSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speakerInput, setSpeakerInput] = useState("");
  const [showSpeakerForm, setShowSpeakerForm] = useState(false);
  const [speakerNames, setSpeakerNames] = useState<string[]>([]);
  const [scheduleFormDate, setScheduleFormDate] = useState<string | null>(null);
  const [scheduleInput, setScheduleInput] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [danaInput, setDanaInput] = useState("");
  const [showDanaForm, setShowDanaForm] = useState(false);
  const [overrides, setOverrides] = useState<FormatOverride[]>([]);
  const [overrideDropdownDate, setOverrideDropdownDate] = useState<
    string | null
  >(null);
  const showToast = useShowToast();

  const refresh = useCallback(async () => {
    try {
      const [updated, upcoming, speakers, fetchedOverrides] = await Promise.all(
        [
          getUpcomingMeeting(),
          getUpcomingMeetings(4),
          getUpcomingSpeakerDates(8),
          getFormatOverrides(),
        ],
      );
      setMeeting(updated);
      // Exclude the first meeting (already shown as primary card)
      setLookahead(upcoming.slice(1));
      setSpeakerDates(speakers);
      setOverrides(fetchedOverrides);
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

  const handleSaveDana = useCallback(async () => {
    if (!meeting) return;
    const value = danaInput.trim();
    const amount = value === "" ? null : parseFloat(value);
    if (value !== "" && (isNaN(amount as number) || (amount as number) < 0)) {
      showToast("error", "Please enter a valid amount");
      return;
    }
    try {
      await updateDana(meeting.meeting_date, amount);
      setShowDanaForm(false);
      await refresh();
      showToast("success", amount === null ? "Dana cleared" : "Dana saved");
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to save dana",
      );
    }
  }, [meeting, danaInput, refresh, showToast]);

  const handleScheduleFromList = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!scheduleFormDate || !scheduleInput.trim()) return;
      try {
        await scheduleSpeaker(scheduleFormDate, scheduleInput.trim());
        setScheduleInput("");
        setScheduleFormDate(null);
        await refresh();
        showToast("success", "Speaker scheduled");
      } catch (err: unknown) {
        showToast(
          "error",
          err instanceof Error ? err.message : "Failed to schedule speaker",
        );
      }
    },
    [scheduleFormDate, scheduleInput, refresh, showToast],
  );

  const handleSetOverride = useCallback(
    async (meetingDate: string, formatType: string) => {
      try {
        await setFormatOverride(meetingDate, formatType);
        setOverrideDropdownDate(null);
        await refresh();
        showToast("success", `Format changed to ${formatType}`);
      } catch (err: unknown) {
        showToast(
          "error",
          err instanceof Error ? err.message : "Failed to set override",
        );
      }
    },
    [refresh, showToast],
  );

  const handleRemoveOverride = useCallback(
    async (meetingDate: string) => {
      try {
        await deleteFormatOverride(meetingDate);
        setOverrideDropdownDate(null);
        await refresh();
        showToast("info", "Format override removed");
      } catch (err: unknown) {
        showToast(
          "error",
          err instanceof Error ? err.message : "Failed to remove override",
        );
      }
    },
    [refresh, showToast],
  );

  const hasOverride = useCallback(
    (meetingDate: string): boolean => {
      return overrides.some((o) => o.meeting_date === meetingDate);
    },
    [overrides],
  );

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

  if (loading) return <Skeleton lines={4} />;
  if (error)
    return (
      <ErrorWithRetry
        message={error}
        onRetry={() => {
          setError(null);
          setLoading(true);
          refresh().finally(() => setLoading(false));
        }}
      />
    );
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

            <section className="rd-dana">
              {meeting.dana_amount != null && !showDanaForm ? (
                <div className="rd-dana__display">
                  <span>Dana: ${meeting.dana_amount.toFixed(2)}</span>
                  <button
                    type="button"
                    className="outline rd-icon-btn"
                    aria-label="Edit dana"
                    onClick={() => {
                      setDanaInput(
                        meeting.dana_amount != null
                          ? meeting.dana_amount.toFixed(2)
                          : "",
                      );
                      setShowDanaForm(true);
                    }}
                  >
                    Edit
                  </button>
                </div>
              ) : showDanaForm ? (
                <div className="rd-dana__form">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label="Dana amount"
                    placeholder="0.00"
                    value={danaInput}
                    onChange={(e) => setDanaInput(e.target.value)}
                  />
                  <button type="button" onClick={handleSaveDana}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => {
                      setShowDanaForm(false);
                      setDanaInput("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="outline"
                  onClick={() => setShowDanaForm(true)}
                >
                  Record Dana
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
                <span className="rd-lookahead__badge-wrapper">
                  <button
                    type="button"
                    className={`rd-lookahead__badge${m.is_cancelled ? " rd-lookahead__badge--cancelled" : ""}${hasOverride(m.meeting_date) ? " rd-lookahead__badge--override" : ""}`}
                    onClick={() =>
                      setOverrideDropdownDate(
                        overrideDropdownDate === m.meeting_date
                          ? null
                          : m.meeting_date,
                      )
                    }
                    aria-label={`Change format for ${formatMeetingDate(m.meeting_date)}`}
                    disabled={m.is_cancelled}
                  >
                    {m.is_cancelled ? "Cancelled" : m.format_type}
                  </button>
                  {overrideDropdownDate === m.meeting_date && (
                    <div
                      className="rd-override-dropdown"
                      role="menu"
                      aria-label="Format override options"
                    >
                      {["Speaker", "Topic", "Book Study"]
                        .filter((f) => f !== m.format_type)
                        .map((f) => (
                          <button
                            key={f}
                            type="button"
                            role="menuitem"
                            className="rd-override-dropdown__item"
                            onClick={() => handleSetOverride(m.meeting_date, f)}
                          >
                            {f}
                          </button>
                        ))}
                      {hasOverride(m.meeting_date) && (
                        <button
                          type="button"
                          role="menuitem"
                          className="rd-override-dropdown__item rd-override-dropdown__item--reset"
                          onClick={() => handleRemoveOverride(m.meeting_date)}
                        >
                          Reset to rotation
                        </button>
                      )}
                    </div>
                  )}
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

      {speakerDates.length > 0 && (
        <section className="rd-speaker-schedule">
          <h3>Speaker Schedule</h3>
          <ul className="rd-speaker-schedule__list">
            {speakerDates.map((s) => (
              <li key={s.meeting_date} className="rd-speaker-schedule__item">
                <span className="rd-speaker-schedule__date">
                  {formatMeetingDate(s.meeting_date)}
                </span>
                {scheduleFormDate === s.meeting_date ? (
                  <form
                    className="rd-speaker-schedule__form"
                    onSubmit={handleScheduleFromList}
                  >
                    <input
                      type="text"
                      placeholder="Speaker name"
                      aria-label="Speaker name"
                      value={scheduleInput}
                      onChange={(e) => setScheduleInput(e.target.value)}
                    />
                    <button type="submit">Save</button>
                    <button
                      type="button"
                      className="outline"
                      onClick={() => {
                        setScheduleFormDate(null);
                        setScheduleInput("");
                      }}
                    >
                      Cancel
                    </button>
                  </form>
                ) : s.speaker_name ? (
                  <span className="rd-speaker-schedule__name">
                    {s.speaker_name}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="outline rd-icon-btn"
                    onClick={() => setScheduleFormDate(s.meeting_date)}
                  >
                    Assign Speaker
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
