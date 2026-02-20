/** Settings page - group configuration. */

import { useCallback, useEffect, useState } from "react";
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
import type {
  BookChapter,
  GroupSettings,
  ReadingPlanStatus,
  Topic,
} from "../types/index";

export function Settings(): React.ReactElement {
  const [settings, setSettings] = useState<GroupSettings | null>(null);
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

  useEffect(() => {
    Promise.all([getSettings(), getTopics(), getReadingPlan(), getChapters()])
      .then(([s, t, p, c]) => {
        setSettings(s);
        setTopics(t);
        setPlan(p);
        setAllChapters(c);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, []);

  const handleSave = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await updateSettings({
        name: settings.name,
        format_rotation: settings.format_rotation,
      });
      setSettings(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [settings]);

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
    if (!window.confirm("Remove this topic from the deck?")) return;
    try {
      await deleteTopic(topicId);
      setTopics(await getTopics());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete topic");
    }
  }, []);

  const handleReshuffle = useCallback(async () => {
    if (!window.confirm("Reshuffle the deck? All drawn topics return.")) return;
    try {
      await reshuffleTopics();
      setTopics(await getTopics());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reshuffle");
    }
  }, []);

  const handleAddChapter = useCallback(async () => {
    try {
      setPlan(await addChapterToPlan());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add chapter");
    }
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
    if (!window.confirm("Delete this assignment?")) return;
    try {
      await deleteAssignment(assignmentId);
      setPlan(await getReadingPlan());
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

  if (loading) return <p aria-busy="true">Loading...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!settings) return <p>No settings found.</p>;

  const inDeck = topics.filter((t) => !t.is_drawn);
  const drawn = topics.filter((t) => t.is_drawn);

  return (
    <main className="rd-settings">
      <h1>Settings</h1>

      <section>
        <h2>Meeting Info</h2>
        <label>
          Group Name
          <input
            type="text"
            value={settings.name}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
          />
        </label>
        <p className="rd-meta">
          Meeting Day:{" "}
          {
            ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
              settings.meeting_day
            ]
          }
        </p>
        <p className="rd-meta">Start Date: {settings.start_date}</p>
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </section>

      <section>
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
      </section>

      <section>
        <h2>Topic Deck</h2>
        <div className="rd-deck-counter">
          {inDeck.length} of {topics.length} remaining
        </div>

        <h3>In Deck</h3>
        <ul className="rd-topic-list">
          {inDeck.map((t) => (
            <li key={t.id} className="rd-topic-item">
              <span>{t.name}</span>
              <button
                type="button"
                className="rd-ghost"
                onClick={() => handleDeleteTopic(t.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        {drawn.length > 0 && (
          <>
            <h3>Drawn This Cycle</h3>
            <ul className="rd-topic-list">
              {drawn.map((t) => (
                <li key={t.id} className="rd-topic-item">
                  <span>{t.name}</span>
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

        <button type="button" className="outline" onClick={handleReshuffle}>
          Reshuffle Deck
        </button>
      </section>

      {plan && (
        <section>
          <h2>Book Reading Plan</h2>

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

          {plan.next_chapter && (
            <p>
              Next: <strong>{plan.next_chapter.title}</strong> (pp.{" "}
              {plan.next_chapter.start_page}&ndash;{plan.next_chapter.end_page},{" "}
              {plan.next_chapter.page_count} pages)
            </p>
          )}

          <div className="rd-button-row">
            <button
              type="button"
              onClick={handleAddChapter}
              disabled={!plan.next_chapter}
            >
              + Add Next Chapter
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
                          <button
                            type="button"
                            className="rd-ghost"
                            onClick={() => handleDeleteAssignment(a.id)}
                          >
                            Delete
                          </button>
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
    </main>
  );
}
