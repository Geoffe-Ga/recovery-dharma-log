/** Settings page - group configuration. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorWithRetry } from "../components/ErrorWithRetry";
import { RotationCalendar } from "../components/RotationCalendar";
import { Skeleton } from "../components/Skeleton";
import {
  addChaptersToPlan,
  advanceBook,
  createTopic,
  deleteAssignment,
  deleteTopic,
  finalizePlan,
  generateInviteCode,
  getBookPosition,
  getChapters,
  getReadingPlan,
  getSettings,
  getTopics,
  reshuffleTopics,
  restartBook,
  revokeInviteCode,
  setBookPosition,
  setChapterMarker,
  updateAssignment,
  updateSettings,
} from "../api/index";
import { useShowToast } from "../contexts/ToastContext";
import type {
  BookChapter,
  BookPosition,
  GroupSettings,
  ReadingPlanStatus,
  Topic,
} from "../types/index";
import { formatLogDate, formatShortDate } from "../utils/dates";
import { formatChapterRange, suggestChapterCount } from "../utils/reading";
import {
  DAYS_OF_WEEK,
  MAX_ROTATION_SLOTS,
  ordinalDayLabel,
} from "../utils/rotation";

export function Settings(): React.ReactElement {
  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<GroupSettings | null>(
    null,
  );
  const [topics, setTopics] = useState<Topic[]>([]);
  const [plan, setPlan] = useState<ReadingPlanStatus | null>(null);
  const [allChapters, setAllChapters] = useState<BookChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(
    null,
  );
  const [editChapterIds, setEditChapterIds] = useState<number[]>([]);
  const [queueMode, setQueueMode] = useState(false);
  const [suggestedCount, setSuggestedCount] = useState(0);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(
    null,
  );
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [position, setPosition] = useState<BookPosition | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [jumpChapter, setJumpChapter] = useState<number | null>(null);
  const [jumpPending, setJumpPending] = useState(false);
  const jumpPendingRef = useRef(false);
  const showToast = useShowToast();

  const isDirty = useMemo(() => {
    if (!settings || !savedSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(savedSettings);
  }, [settings, savedSettings]);

  const loadSettings = useCallback(() => {
    setError(null);
    setLoading(true);
    Promise.all([
      getSettings(),
      getTopics(),
      getReadingPlan(),
      getChapters(),
      getBookPosition(),
    ])
      .then(([s, t, p, c, pos]) => {
        setSettings(s);
        setSavedSettings(s);
        setTopics(t);
        setPlan(p);
        setAllChapters(c);
        setPosition(pos);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Scroll to hash target after data loads (SPA deep-link support)
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash;
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, [loading]);

  // Warn on navigation away with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleSave = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await updateSettings({
        name: settings.name,
        meeting_day: settings.meeting_day,
        format_rotation: settings.format_rotation,
      });
      setSettings(updated);
      setSavedSettings(updated);
      showToast("success", "Settings saved");
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [settings, showToast]);

  const handleDiscard = useCallback(() => {
    if (savedSettings) {
      setSettings(savedSettings);
    }
  }, [savedSettings]);

  const FORMAT_OPTIONS = ["Speaker", "Topic", "Book Study"];

  const handleRotationChange = useCallback(
    (index: number, value: string) => {
      if (!settings) return;
      const updated = [...settings.format_rotation];
      updated[index] = value;
      setSettings({ ...settings, format_rotation: updated });
    },
    [settings],
  );

  const handleAddRotationSlot = useCallback(() => {
    if (!settings || settings.format_rotation.length >= MAX_ROTATION_SLOTS)
      return;
    setSettings({
      ...settings,
      format_rotation: [...settings.format_rotation, "Topic"],
    });
  }, [settings]);

  const handleRemoveRotationSlot = useCallback(
    (index: number) => {
      if (!settings || settings.format_rotation.length <= 1) return;
      const updated = settings.format_rotation.filter((_, i) => i !== index);
      setSettings({ ...settings, format_rotation: updated });
    },
    [settings],
  );

  const handleAddTopic = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTopic.trim()) return;
      try {
        await createTopic(newTopic.trim());
        setNewTopic("");
        setTopics(await getTopics());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to add topic");
      }
    },
    [newTopic],
  );

  const handleDeleteTopic = useCallback(async (topicId: number) => {
    try {
      await deleteTopic(topicId);
      setTopics(await getTopics());
      setConfirmAction(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete topic");
    }
  }, []);

  const handleReshuffle = useCallback(async () => {
    try {
      await reshuffleTopics();
      setTopics(await getTopics());
      setConfirmAction(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reshuffle");
    }
  }, []);

  const enterQueueMode = useCallback(() => {
    if (!plan || plan.unassigned_chapters.length === 0) return;
    setSuggestedCount(suggestChapterCount(plan.unassigned_chapters));
    setQueueMode(true);
  }, [plan]);

  const cancelQueueMode = useCallback(() => {
    setQueueMode(false);
    setSuggestedCount(0);
  }, []);

  const handleMarkDone = useCallback(async () => {
    if (!position || !plan || isPending) return;

    const atEnd =
      position.total_assignments > 0 &&
      position.current_assignment_index >= position.total_assignments - 1;

    if (atEnd) {
      enterQueueMode();
      return;
    }

    setIsPending(true);
    try {
      const updated = await advanceBook();
      setPosition(updated);
      setPlan(await getReadingPlan());
      showToast("success", "Advanced to next reading");
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to advance",
      );
    } finally {
      setIsPending(false);
    }
  }, [position, plan, isPending, enterQueueMode, showToast]);

  const handleConfirmQueue = useCallback(async () => {
    if (suggestedCount === 0 || !plan || isPending) return;
    setIsPending(true);
    const ids = plan.unassigned_chapters
      .slice(0, suggestedCount)
      .map((ch) => ch.id);
    try {
      await addChaptersToPlan(ids);
      try {
        await finalizePlan();
      } catch {
        // Chapters added but plan not finalized — refresh and report
        setPlan(await getReadingPlan());
        showToast("error", "Chapters added but finalize failed — try again");
        return;
      }
      if (position && position.total_assignments > 0) {
        const updated = await advanceBook();
        setPosition(updated);
      } else {
        setPosition(await getBookPosition());
      }
      setPlan(await getReadingPlan());
      setQueueMode(false);
      setSuggestedCount(0);
      showToast("success", "Reading queued");
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to queue reading",
      );
    } finally {
      setIsPending(false);
    }
  }, [suggestedCount, plan, isPending, position, showToast]);

  const handleEditAssignment = useCallback(
    (assignmentId: number, currentChapterIds: number[]) => {
      setEditingAssignmentId(assignmentId);
      setEditChapterIds(currentChapterIds);
    },
    [],
  );

  const handleSaveAssignment = useCallback(async () => {
    if (editingAssignmentId === null) return;
    try {
      await updateAssignment(editingAssignmentId, {
        chapter_ids: editChapterIds,
      });
      setPlan(await getReadingPlan());
      setEditingAssignmentId(null);
      setEditChapterIds([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  }, [editingAssignmentId, editChapterIds]);

  const handleCancelEdit = useCallback(() => {
    setEditingAssignmentId(null);
    setEditChapterIds([]);
  }, []);

  const handleSetAsCurrent = useCallback(
    async (assignmentIndex: number) => {
      try {
        const updated = await setBookPosition(assignmentIndex);
        setPosition(updated);
        showToast("success", "Current assignment updated");
      } catch (err: unknown) {
        showToast(
          "error",
          err instanceof Error ? err.message : "Failed to set position",
        );
      }
    },
    [showToast],
  );

  const handleRestartBook = useCallback(async () => {
    try {
      const updated = await restartBook();
      setPosition(updated);
      setConfirmAction(null);
      showToast("success", "Book restarted");
    } catch (err: unknown) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to restart book",
      );
    }
  }, [showToast]);

  const handleDeleteAssignment = useCallback(async (assignmentId: number) => {
    try {
      await deleteAssignment(assignmentId);
      setPlan(await getReadingPlan());
      setConfirmAction(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }, []);

  const toggleEditChapter = useCallback((chapterId: number) => {
    setEditChapterIds((prev) =>
      prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId],
    );
  }, []);

  const currentChapterOrder = useMemo(() => {
    if (position?.current_assignment?.chapters?.length) {
      return position.current_assignment.chapters[0].order;
    }
    if (position?.chapter_marker != null) {
      return position.chapter_marker;
    }
    return allChapters.length > 0 ? allChapters[0].order : 1;
  }, [position, allChapters]);

  const handleJumpToChapter = useCallback(
    async (targetOrder: number) => {
      if (!plan || jumpPendingRef.current) return;
      jumpPendingRef.current = true;
      setJumpPending(true);
      try {
        const assignmentIndex = plan.completed_assignments.findIndex((a) =>
          a.chapters.some((ch) => ch.order === targetOrder),
        );
        let updated: BookPosition;
        if (assignmentIndex >= 0) {
          updated = await setBookPosition(assignmentIndex);
        } else {
          updated = await setChapterMarker(targetOrder);
        }
        setPosition(updated);
        setJumpChapter(null);
        showToast("success", "Chapter position updated");
      } catch (err: unknown) {
        showToast(
          "error",
          err instanceof Error ? err.message : "Failed to update position",
        );
      } finally {
        jumpPendingRef.current = false;
        setJumpPending(false);
      }
    },
    [plan, showToast],
  );

  if (loading) return <Skeleton lines={4} />;
  if (error) return <ErrorWithRetry message={error} onRetry={loadSettings} />;
  if (!settings) return <p>No settings found.</p>;

  const currentReading = position?.current_assignment ?? null;
  const isLastAssignment =
    position != null &&
    position.total_assignments > 0 &&
    position.current_assignment_index >= position.total_assignments - 1;
  const bookComplete =
    plan != null &&
    plan.unassigned_chapters.length === 0 &&
    plan.current_assignment_chapters.length === 0;
  const suggestedChapters = plan
    ? plan.unassigned_chapters.slice(0, suggestedCount)
    : [];
  const suggestedTotalPages = suggestedChapters.reduce(
    (sum, ch) => sum + ch.page_count,
    0,
  );

  const inDeck = topics.filter((t) => !t.is_drawn);
  const drawn = topics
    .filter((t) => t.is_drawn)
    .sort((a, b) => {
      if (!a.last_used && !b.last_used) return 0;
      if (!a.last_used) return 1;
      if (!b.last_used) return -1;
      return b.last_used.localeCompare(a.last_used);
    });

  return (
    <main className="rd-settings">
      <h1>Settings</h1>

      <nav className="rd-section-nav" aria-label="Section navigation">
        <a className="rd-section-nav__link" href="#meeting">
          Meeting
        </a>
        <a className="rd-section-nav__link" href="#rotation">
          Rotation
        </a>
        <a className="rd-section-nav__link" href="#topics">
          Topics
        </a>
        <a className="rd-section-nav__link" href="#reading-plan">
          Reading Plan
        </a>
        <a className="rd-section-nav__link" href="#danger-zone">
          Danger Zone
        </a>
      </nav>

      <section id="meeting">
        <h2>Meeting Info</h2>
        <label>
          Group Name
          <input
            type="text"
            value={settings.name}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
          />
        </label>
        <label>
          Meeting Day
          <select
            value={settings.meeting_day}
            onChange={(e) =>
              setSettings({
                ...settings,
                meeting_day: Number(e.target.value),
              })
            }
          >
            {DAYS_OF_WEEK.map((day, i) => (
              <option key={day} value={i}>
                {day}
              </option>
            ))}
          </select>
        </label>
        <p className="rd-meta">Start Date: {settings.start_date}</p>
      </section>

      <section id="rotation">
        <h2>Format Rotation</h2>
        <div className="rd-rotation-list">
          {settings.format_rotation.map((format, i) => (
            <div key={i} className="rd-rotation-slot">
              <span className="rd-rotation-slot__label">
                {ordinalDayLabel(i, settings.meeting_day)}
              </span>
              <select
                value={format}
                onChange={(e) => handleRotationChange(i, e.target.value)}
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {settings.format_rotation.length > 1 && (
                <button
                  type="button"
                  className="rd-ghost"
                  onClick={() => handleRemoveRotationSlot(i)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {settings.format_rotation.length < MAX_ROTATION_SLOTS && (
          <button
            type="button"
            className="outline"
            onClick={handleAddRotationSlot}
          >
            + Add{" "}
            {ordinalDayLabel(
              settings.format_rotation.length,
              settings.meeting_day,
            )}
          </button>
        )}
        <RotationCalendar
          meetingDay={settings.meeting_day}
          startDate={settings.start_date}
          formatRotation={settings.format_rotation}
        />
        {settings.format_rotation.length < MAX_ROTATION_SLOTS && (
          <p className="rd-meta">
            Note: Months with a 5th {DAYS_OF_WEEK[settings.meeting_day]} will
            use the{" "}
            {settings.format_rotation[4 % settings.format_rotation.length]}{" "}
            format (
            {ordinalDayLabel(
              4 % settings.format_rotation.length,
              settings.meeting_day,
            )}
            ).
          </p>
        )}
      </section>

      <section id="topics">
        <h2>Topic Deck</h2>
        <div className="rd-deck-counter">
          {inDeck.length} of {topics.length} remaining
        </div>

        <h3>In Deck</h3>
        <ul className="rd-topic-list">
          {inDeck.map((t) => (
            <li key={t.id} className="rd-topic-item">
              <span>
                {t.name}
                {t.last_used && (
                  <span className="rd-topic-item__last-used">
                    {" "}
                    &mdash; last used {formatLogDate(t.last_used)}
                  </span>
                )}
              </span>
              {confirmAction === `delete-topic-${t.id}` ? (
                <span className="rd-inline-confirm">
                  <button
                    type="button"
                    className="rd-danger"
                    onClick={() => handleDeleteTopic(t.id)}
                  >
                    Confirm Remove
                  </button>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => setConfirmAction(null)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="rd-ghost"
                  onClick={() => setConfirmAction(`delete-topic-${t.id}`)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {drawn.length > 0 && (
          <>
            <h3>Drawn This Cycle</h3>
            <ul className="rd-topic-list">
              {drawn.map((t) => (
                <li key={t.id} className="rd-topic-item">
                  <span>
                    {t.name}
                    {t.last_used && (
                      <span className="rd-topic-item__last-used">
                        {" "}
                        &mdash; last used {formatLogDate(t.last_used)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <form onSubmit={handleAddTopic} className="rd-inline-form">
          <input
            type="text"
            placeholder="New topic name"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
          />
          <button type="submit">Add Topic</button>
        </form>
      </section>

      {plan && (
        <section id="reading-plan">
          <h2>Book Reading Plan</h2>

          {plan.total_chapters > 0 && (
            <div className="rd-plan-progress">
              <div className="rd-plan-progress__bar">
                <div
                  className="rd-plan-progress__fill"
                  role="progressbar"
                  aria-valuenow={plan.assigned_pages}
                  aria-valuemin={0}
                  aria-valuemax={plan.total_pages}
                  aria-label="Reading plan progress"
                  style={{
                    width: `${plan.total_pages > 0 ? (plan.assigned_pages / plan.total_pages) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="rd-plan-progress__label">
                {plan.assigned_pages} of {plan.total_pages} pages
                {plan.total_chapters - plan.assigned_chapters > 0 &&
                  ` · ~${plan.total_chapters - plan.assigned_chapters} weeks left`}
              </p>
            </div>
          )}

          {allChapters.length > 0 && (
            <div
              className="rd-inline-form"
              role="group"
              aria-label="Jump to chapter"
            >
              <label>
                Jump to Chapter
                <select
                  value={jumpChapter ?? currentChapterOrder}
                  onChange={(e) => setJumpChapter(Number(e.target.value))}
                >
                  {allChapters.map((ch) => (
                    <option key={ch.order} value={ch.order}>
                      {ch.order}. {ch.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="outline"
                onClick={() =>
                  handleJumpToChapter(jumpChapter ?? currentChapterOrder)
                }
                disabled={
                  jumpPending ||
                  (jumpChapter ?? currentChapterOrder) === currentChapterOrder
                }
              >
                {jumpPending ? "Updating\u2026" : "Go"}
              </button>
            </div>
          )}

          {!queueMode && (
            <div className="rd-reading-card">
              {currentReading ? (
                <>
                  <h3>This Week&#8217;s Reading</h3>
                  <p className="rd-reading-card__chapters">
                    {formatChapterRange(currentReading.chapters)}
                  </p>
                  <p className="rd-reading-card__pages">
                    {currentReading.total_pages} pages
                  </p>
                  {bookComplete && isLastAssignment ? (
                    <p className="rd-meta">
                      You&#8217;ve completed the book! Open the history below to
                      start a new cycle.
                    </p>
                  ) : isLastAssignment ? (
                    <button
                      type="button"
                      onClick={handleMarkDone}
                      disabled={isPending}
                    >
                      Mark Done &amp; Queue Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleMarkDone}
                      disabled={isPending}
                    >
                      Mark Done
                    </button>
                  )}
                </>
              ) : plan.unassigned_chapters.length > 0 ? (
                <>
                  <h3>Start Reading</h3>
                  <p>Queue the first chapters to get started.</p>
                  <button type="button" onClick={enterQueueMode}>
                    Queue First Reading
                  </button>
                </>
              ) : null}
            </div>
          )}

          {queueMode && plan.unassigned_chapters.length > 0 && (
            <div className="rd-queue-next">
              <h3>Next Up</h3>
              <p className="rd-queue-next__preview">
                {formatChapterRange(suggestedChapters)}
              </p>
              <p className="rd-queue-next__pages">
                {suggestedTotalPages} pages
              </p>
              <div className="rd-queue-stepper">
                <button
                  type="button"
                  className="outline"
                  onClick={() => setSuggestedCount((c) => Math.max(1, c - 1))}
                  disabled={suggestedCount <= 1}
                  aria-label="Remove chapter"
                >
                  &minus;
                </button>
                <span className="rd-queue-stepper__label">
                  {suggestedCount}{" "}
                  {suggestedCount === 1 ? "chapter" : "chapters"}
                </span>
                <button
                  type="button"
                  className="outline"
                  onClick={() =>
                    setSuggestedCount((c) =>
                      Math.min(plan.unassigned_chapters.length, c + 1),
                    )
                  }
                  disabled={suggestedCount >= plan.unassigned_chapters.length}
                  aria-label="Add chapter"
                >
                  +
                </button>
              </div>
              <div className="rd-button-row">
                <button
                  type="button"
                  onClick={handleConfirmQueue}
                  disabled={isPending}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="outline"
                  onClick={cancelQueueMode}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {plan.completed_assignments.length > 0 && (
            <details className="rd-reading-history">
              <summary>
                Reading History ({plan.completed_assignments.length}{" "}
                {plan.completed_assignments.length === 1 ? "week" : "weeks"})
                {position && (
                  <span className="rd-meta">
                    {" "}
                    &mdash; Cycle {position.book_cycle}
                  </span>
                )}
              </summary>
              <ol className="rd-reading-history__list">
                {plan.completed_assignments.map((a, i) => (
                  <li
                    key={a.id}
                    className={`rd-reading-history__item${position && position.current_assignment_index === i ? " rd-reading-history__item--current" : ""}`}
                  >
                    {editingAssignmentId === a.id ? (
                      <div>
                        <p>Select chapters:</p>
                        <ul>
                          {allChapters.map((ch) => (
                            <li key={ch.id}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={editChapterIds.includes(ch.id)}
                                  onChange={() => toggleEditChapter(ch.id)}
                                />
                                {ch.title} (pp. {ch.start_page}&ndash;
                                {ch.end_page})
                              </label>
                            </li>
                          ))}
                        </ul>
                        <div className="rd-button-row">
                          <button type="button" onClick={handleSaveAssignment}>
                            Save
                          </button>
                          <button
                            type="button"
                            className="outline"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          className="rd-reading-history__row"
                          aria-expanded={expandedHistoryId === a.id}
                          onClick={() =>
                            setExpandedHistoryId(
                              expandedHistoryId === a.id ? null : a.id,
                            )
                          }
                        >
                          <span className="rd-reading-history__content">
                            {position &&
                              position.current_assignment_index === i && (
                                <strong className="rd-current-marker">
                                  Current:{" "}
                                </strong>
                              )}
                            {a.chapters.map((c) => c.title).join(", ")}
                            <span className="rd-meta">
                              {" "}
                              &mdash; {a.total_pages}pp
                              {a.meeting_date && (
                                <> &mdash; {formatShortDate(a.meeting_date)}</>
                              )}
                            </span>
                          </span>
                        </button>
                        {expandedHistoryId === a.id && (
                          <div className="rd-reading-history__actions">
                            {position &&
                              position.current_assignment_index !== i && (
                                <button
                                  type="button"
                                  className="outline rd-icon-btn"
                                  onClick={() => handleSetAsCurrent(i)}
                                >
                                  Set as Current
                                </button>
                              )}
                            <button
                              type="button"
                              className="outline rd-icon-btn"
                              onClick={() =>
                                handleEditAssignment(
                                  a.id,
                                  a.chapters.map((c) => c.id),
                                )
                              }
                            >
                              Edit
                            </button>
                            {confirmAction === `delete-assignment-${a.id}` ? (
                              <>
                                <button
                                  type="button"
                                  className="rd-danger"
                                  onClick={() => handleDeleteAssignment(a.id)}
                                >
                                  Confirm Delete
                                </button>
                                <button
                                  type="button"
                                  className="outline"
                                  onClick={() => setConfirmAction(null)}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="outline rd-icon-btn rd-danger-outline"
                                onClick={() =>
                                  setConfirmAction(`delete-assignment-${a.id}`)
                                }
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
              {bookComplete && (
                <div className="rd-button-row">
                  {confirmAction === "restart-book" ? (
                    <>
                      <button
                        type="button"
                        className="rd-danger"
                        onClick={handleRestartBook}
                      >
                        Confirm Restart
                      </button>
                      <button
                        type="button"
                        className="outline"
                        onClick={() => setConfirmAction(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="rd-danger-outline"
                      onClick={() => setConfirmAction("restart-book")}
                    >
                      Restart Book
                    </button>
                  )}
                </div>
              )}
            </details>
          )}
        </section>
      )}

      <section id="invite">
        <h2>Invite Members</h2>
        {settings?.invite_code ? (
          <div>
            <p>Share this code with others so they can join your group:</p>
            <div
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              <code style={{ fontSize: "1.2rem", letterSpacing: "0.1em" }}>
                {settings.invite_code}
              </code>
              <button
                type="button"
                className="outline"
                onClick={() => {
                  navigator.clipboard
                    .writeText(settings.invite_code ?? "")
                    .then(() => showToast("success", "Code copied!"))
                    .catch(() => showToast("error", "Failed to copy code"));
                }}
              >
                Copy
              </button>
              <button
                type="button"
                className="outline"
                onClick={() => {
                  revokeInviteCode()
                    .then(() => {
                      setSettings((prev) =>
                        prev ? { ...prev, invite_code: null } : prev,
                      );
                      setSavedSettings((prev) =>
                        prev ? { ...prev, invite_code: null } : prev,
                      );
                      showToast("success", "Invite code revoked");
                    })
                    .catch(() => showToast("error", "Failed to revoke"));
                }}
              >
                Revoke
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              generateInviteCode()
                .then((res) => {
                  setSettings((prev) =>
                    prev ? { ...prev, invite_code: res.invite_code } : prev,
                  );
                  setSavedSettings((prev) =>
                    prev ? { ...prev, invite_code: res.invite_code } : prev,
                  );
                  showToast("success", "Invite code generated!");
                })
                .catch(() =>
                  showToast("error", "Failed to generate invite code"),
                );
            }}
          >
            Generate Invite Code
          </button>
        )}
      </section>

      <section id="danger-zone" className="rd-danger-zone">
        <h2>Danger Zone</h2>
        {confirmAction === "reshuffle" ? (
          <div className="rd-danger-zone__confirm">
            <p>Reshuffle the deck? All drawn topics will return.</p>
            <button
              type="button"
              className="rd-danger"
              onClick={handleReshuffle}
            >
              Confirm Reshuffle
            </button>
            <button
              type="button"
              className="outline"
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="rd-danger-outline"
            onClick={() => setConfirmAction("reshuffle")}
          >
            Reshuffle Deck
          </button>
        )}
      </section>

      {isDirty && (
        <div className="rd-sticky-bar" role="status">
          <span>You have unsaved changes</span>
          <div className="rd-button-row">
            <button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              className="outline"
              onClick={handleDiscard}
              disabled={saving}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
