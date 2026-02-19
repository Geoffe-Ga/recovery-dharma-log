/** Settings page - group configuration. */

import { useCallback, useEffect, useState } from "react";
import {
  addChapterToPlan,
  createTopic,
  deleteTopic,
  finalizePlan,
  getReadingPlan,
  getSettings,
  getTopics,
  reshuffleTopics,
  updateSettings,
} from "../api/index";
import type { GroupSettings, ReadingPlanStatus, Topic } from "../types/index";

export function Settings(): React.ReactElement {
  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [plan, setPlan] = useState<ReadingPlanStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newTopic, setNewTopic] = useState("");

  useEffect(() => {
    Promise.all([getSettings(), getTopics(), getReadingPlan()])
      .then(([s, t, p]) => {
        setSettings(s);
        setTopics(t);
        setPlan(p);
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
      const updated = await updateSettings({ name: settings.name });
      setSettings(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [settings]);

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

  if (loading) return <p aria-busy="true">Loading...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!settings) return <p>No settings found.</p>;

  const inDeck = topics.filter((t) => !t.is_drawn);
  const drawn = topics.filter((t) => t.is_drawn);

  return (
    <main>
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
        <p>
          Meeting Day:{" "}
          {
            ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
              settings.meeting_day
            ]
          }
        </p>
        <p>Start Date: {settings.start_date}</p>
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </section>

      <section>
        <h2>Format Rotation</h2>
        <ol>
          {settings.format_rotation.map((format, i) => (
            <li key={i}>{format}</li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Topic Deck</h2>
        <p>
          {inDeck.length} of {topics.length} remaining
        </p>

        <h3>In Deck</h3>
        <ul>
          {inDeck.map((t) => (
            <li key={t.id}>
              {t.name}{" "}
              <button type="button" onClick={() => handleDeleteTopic(t.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>

        {drawn.length > 0 && (
          <>
            <h3>Drawn This Cycle</h3>
            <ul>
              {drawn.map((t) => (
                <li key={t.id}>{t.name}</li>
              ))}
            </ul>
          </>
        )}

        <form onSubmit={handleAddTopic}>
          <input
            type="text"
            placeholder="New topic name"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
          />
          <button type="submit">Add Topic</button>
        </form>

        <button type="button" onClick={handleReshuffle}>
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
              <p>Total: {plan.current_assignment_total_pages} pages</p>
            </div>
          )}

          {plan.next_chapter && (
            <p>
              Next: <strong>{plan.next_chapter.title}</strong> (pp.{" "}
              {plan.next_chapter.start_page}&ndash;{plan.next_chapter.end_page},{" "}
              {plan.next_chapter.page_count} pages)
            </p>
          )}

          <div>
            <button
              type="button"
              onClick={handleAddChapter}
              disabled={!plan.next_chapter}
            >
              + Add Next Chapter
            </button>
            <button
              type="button"
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
                    {a.chapters.map((c) => c.title).join(", ")} ({a.total_pages}{" "}
                    pages)
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
