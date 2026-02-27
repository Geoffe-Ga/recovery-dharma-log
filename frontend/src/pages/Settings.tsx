/** Settings page - group configuration. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorWithRetry } from "../components/ErrorWithRetry";
import { RotationCalendar } from "../components/RotationCalendar";
import { Skeleton } from "../components/Skeleton";
import {
  addChapterToPlan,
  createTopic,
  deleteAssignment,
  deleteTopic,
  finalizePlan,
  getChapters,
  getReadingPlan,
  getSettings,
  getTopics,
  reshuffleTopics,
  updateAssignment,
  updateSettings,
} from "../api/index";
import { useShowToast } from "../contexts/ToastContext";
import type {
  BookChapter,
  GroupSettings,
  ReadingPlanStatus,
  Topic,
} from "../types/index";
import { formatLogDate, formatShortDate } from "../utils/dates";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

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
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([]);
  const [addingChapters, setAddingChapters] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const showToast = useShowToast();

  const isDirty = useMemo(() => {
    if (!settings || !savedSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(savedSettings);
  }, [settings, savedSettings]);

  const loadSettings = useCallback(() => {
    setError(null);
    setLoading(true);
    Promise.all([getSettings(), getTopics(), getReadingPlan(), getChapters()])
      .then(([s, t, p, c]) => {
        setSettings(s);
        setSavedSettings(s);
        setTopics(t);
        setPlan(p);
        setAllChapters(c);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
    if (!settings) return;
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

  const handleAddSelectedChapters = useCallback(async () => {
    if (selectedChapterIds.length === 0) return;
    setAddingChapters(true);
    try {
      for (let i = 0; i < selectedChapterIds.length; i++) {
        await addChapterToPlan();
      }
      setPlan(await getReadingPlan());
      setSelectedChapterIds([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add chapters");
    } finally {
      setAddingChapters(false);
    }
  }, [selectedChapterIds]);

  const toggleSelectedChapter = useCallback((chapterId: number) => {
    setSelectedChapterIds((prev) =>
      prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId],
    );
  }, []);

  const handleFinalize = useCallback(async () => {
    try {
      await finalizePlan();
      setPlan(await getReadingPlan());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to finalize");
    }
  }, []);

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

  if (loading) return <Skeleton lines={4} />;
  if (error) return <ErrorWithRetry message={error} onRetry={loadSettings} />;
  if (!settings) return <p>No settings found.</p>;

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
              <span className="rd-rotation-slot__label">{i + 1}.</span>
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
        <button
          type="button"
          className="outline"
          onClick={handleAddRotationSlot}
        >
          + Add Position
        </button>
        <RotationCalendar
          meetingDay={settings.meeting_day}
          startDate={settings.start_date}
          formatRotation={settings.format_rotation}
        />
        {settings.format_rotation.length < 5 && (
          <p className="rd-meta">
            Note: Months with a 5th {DAYS_OF_WEEK[settings.meeting_day]} will
            use the{" "}
            {settings.format_rotation[4 % settings.format_rotation.length]}{" "}
            format (position {(4 % settings.format_rotation.length) + 1}).
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
              <p className="rd-plan-progress__label">
                {plan.assigned_chapters} of {plan.total_chapters} chapters
                assigned &middot; {plan.assigned_pages} of {plan.total_pages}{" "}
                pages assigned
              </p>
              <div className="rd-plan-progress__bar">
                <div
                  className="rd-plan-progress__fill"
                  role="progressbar"
                  aria-valuenow={plan.assigned_chapters}
                  aria-valuemin={0}
                  aria-valuemax={plan.total_chapters}
                  aria-label="Reading plan progress"
                  style={{
                    width: `${(plan.assigned_chapters / plan.total_chapters) * 100}%`,
                  }}
                />
              </div>
              {plan.total_chapters - plan.assigned_chapters > 0 && (
                <p className="rd-plan-progress__label">
                  ~{plan.total_chapters - plan.assigned_chapters} weeks
                  remaining
                </p>
              )}
            </div>
          )}

          {plan.current_assignment_chapters.length > 0 && (
            <div>
              <h3>Current Assignment</h3>
              <ul>
                {plan.current_assignment_chapters.map((ch) => (
                  <li key={ch.id}>
                    {ch.title} (pp. {ch.start_page}&ndash;{ch.end_page},{" "}
                    {ch.page_count} pages)
                  </li>
                ))}
              </ul>
              <p className="rd-meta">
                Total: {plan.current_assignment_total_pages} pages
              </p>
            </div>
          )}

          {plan.unassigned_chapters.length > 0 && (
            <div>
              <h3>Add Chapters</h3>
              <ul className="rd-chapter-picker">
                {plan.unassigned_chapters.map((ch) => (
                  <li key={ch.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedChapterIds.includes(ch.id)}
                        onChange={() => toggleSelectedChapter(ch.id)}
                      />
                      {ch.title} (pp. {ch.start_page}&ndash;{ch.end_page},{" "}
                      {ch.page_count} pages)
                    </label>
                  </li>
                ))}
              </ul>
              <div className="rd-button-row">
                <button
                  type="button"
                  onClick={handleAddSelectedChapters}
                  disabled={selectedChapterIds.length === 0 || addingChapters}
                >
                  {addingChapters
                    ? "Adding..."
                    : `Add Selected (${selectedChapterIds.length})`}
                </button>
                <button
                  type="button"
                  className="outline"
                  onClick={handleFinalize}
                  disabled={plan.current_assignment_chapters.length === 0}
                >
                  Finalize Assignment
                </button>
              </div>
            </div>
          )}

          {plan.unassigned_chapters.length === 0 && (
            <div className="rd-button-row">
              <button
                type="button"
                className="outline"
                onClick={handleFinalize}
                disabled={plan.current_assignment_chapters.length === 0}
              >
                Finalize Assignment
              </button>
            </div>
          )}

          {plan.completed_assignments.length > 0 && (
            <>
              <h3>Completed Assignments</h3>
              <ol>
                {plan.completed_assignments.map((a) => (
                  <li key={a.id}>
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
                      <div className="rd-assignment-item">
                        <span>
                          {a.chapters.map((c) => c.title).join(", ")} (
                          {a.total_pages} pages)
                          {a.meeting_date && (
                            <span className="rd-assignment-item__date">
                              {" "}
                              &mdash; {formatShortDate(a.meeting_date)}
                            </span>
                          )}
                        </span>
                        <span className="rd-assignment-item__actions">
                          <button
                            type="button"
                            className="rd-ghost"
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
                              className="rd-ghost"
                              onClick={() =>
                                setConfirmAction(`delete-assignment-${a.id}`)
                              }
                            >
                              Delete
                            </button>
                          )}
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

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
