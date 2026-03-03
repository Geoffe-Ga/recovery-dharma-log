/** Setup wizard - 4-step onboarding for new groups. */

import React, { useCallback, useEffect, useState } from "react";
import {
  getChapters,
  setupBasics,
  setupBookPosition,
  setupComplete,
  setupRotation,
  setupTopics,
} from "../api/index";
import type { BookChapter } from "../types/index";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const FORMAT_OPTIONS = ["Speaker", "Topic", "Book Study"];

const DEFAULT_ROTATION = [
  "Speaker",
  "Topic",
  "Book Study",
  "Topic",
  "Book Study",
];

const DEFAULT_TOPICS = [
  "Karma",
  "Lovingkindness",
  "Mindfulness of the Body Using Elements",
  "Mindfulness of Feeling Tones",
  "Mindfulness",
  "Spiritual Maturity",
  "What We Mean When We Say Suffering",
  "Mindfulness of the Body Using Breath",
  "Renunciation",
  "5 Precepts",
];

interface SetupProps {
  onComplete: () => void;
}

export function Setup({ onComplete }: SetupProps): React.ReactElement {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basics
  const [name, setName] = useState("My Meeting");
  const [meetingDay, setMeetingDay] = useState(6);
  const [meetingTime, setMeetingTime] = useState("18:00");
  const [startDate, setStartDate] = useState("");

  // Step 2: Rotation
  const [rotation, setRotation] = useState<string[]>([...DEFAULT_ROTATION]);

  // Step 3: Topics
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(
    new Set(DEFAULT_TOPICS),
  );
  const [newTopicInput, setNewTopicInput] = useState("");
  const [addedTopics, setAddedTopics] = useState<string[]>([]);

  // Step 4: Book Position
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState(1);

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .catch(() => {});
  }, []);

  const handleNext = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      if (step === 1) {
        await setupBasics({
          name,
          meeting_day: meetingDay,
          meeting_time: meetingTime,
          start_date: startDate,
        });
      } else if (step === 2) {
        await setupRotation(rotation);
      } else if (step === 3) {
        await setupTopics(
          Array.from(selectedTopics),
          addedTopics.filter((t) => t.trim()),
        );
      } else if (step === 4) {
        await setupBookPosition(selectedChapter);
        await setupComplete();
        onComplete();
        return;
      }
      setStep((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [
    step,
    name,
    meetingDay,
    meetingTime,
    startDate,
    rotation,
    selectedTopics,
    addedTopics,
    selectedChapter,
    onComplete,
  ]);

  const handlePrevious = (): void => {
    setStep((s) => Math.max(1, s - 1));
  };

  const handleToggleTopic = (topic: string): void => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) {
        next.delete(topic);
      } else {
        next.add(topic);
      }
      return next;
    });
  };

  const handleAddTopic = (): void => {
    const trimmed = newTopicInput.trim();
    if (trimmed && !addedTopics.includes(trimmed)) {
      setAddedTopics((prev) => [...prev, trimmed]);
      setSelectedTopics((prev) => new Set([...prev, trimmed]));
      setNewTopicInput("");
    }
  };

  const handleRotationChange = (index: number, value: string): void => {
    setRotation((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAddSlot = (): void => {
    setRotation((prev) => [...prev, "Topic"]);
  };

  const handleRemoveSlot = (index: number): void => {
    if (rotation.length > 1) {
      setRotation((prev) => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <main className="rd-setup">
      <h1>Welcome to RD Log</h1>
      <p>Let&apos;s set up your meeting. Step {step} of 4.</p>
      <progress value={step} max={4} />

      {error && <p role="alert">{error}</p>}

      {step === 1 && (
        <section aria-label="Group Basics">
          <h2>Group Basics</h2>
          <label>
            Meeting Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Meeting Day
            <select
              value={meetingDay}
              onChange={(e) => setMeetingDay(Number(e.target.value))}
            >
              {DAY_NAMES.map((day, i) => (
                <option key={day} value={i}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <label>
            Meeting Time
            <input
              type="time"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
            />
          </label>
          <label>
            Start Date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
        </section>
      )}

      {step === 2 && (
        <section aria-label="Format Rotation">
          <h2>Format Rotation</h2>
          <p>Set the weekly format rotation for your meeting.</p>
          {rotation.map((fmt, i) => (
            <div
              key={i}
              style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}
            >
              <label style={{ flex: 1 }}>
                Week {i + 1}
                <select
                  value={fmt}
                  onChange={(e) => handleRotationChange(i, e.target.value)}
                >
                  {FORMAT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              {rotation.length > 1 && (
                <button
                  type="button"
                  className="outline"
                  onClick={() => handleRemoveSlot(i)}
                  aria-label={`Remove week ${i + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" className="outline" onClick={handleAddSlot}>
            Add Week
          </button>
        </section>
      )}

      {step === 3 && (
        <section aria-label="Discussion Topics">
          <h2>Discussion Topics</h2>
          <p>Select which default topics to keep and add any new ones.</p>
          <fieldset>
            <legend>Default Topics</legend>
            {DEFAULT_TOPICS.map((topic) => (
              <label key={topic}>
                <input
                  type="checkbox"
                  checked={selectedTopics.has(topic)}
                  onChange={() => handleToggleTopic(topic)}
                />
                {topic}
              </label>
            ))}
          </fieldset>
          {addedTopics.length > 0 && (
            <fieldset>
              <legend>Added Topics</legend>
              {addedTopics.map((topic) => (
                <label key={topic}>
                  <input
                    type="checkbox"
                    checked={selectedTopics.has(topic)}
                    onChange={() => handleToggleTopic(topic)}
                  />
                  {topic}
                </label>
              ))}
            </fieldset>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={newTopicInput}
              onChange={(e) => setNewTopicInput(e.target.value)}
              placeholder="Add a new topic"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTopic();
                }
              }}
            />
            <button type="button" className="outline" onClick={handleAddTopic}>
              Add
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section aria-label="Book Position">
          <h2>Book Position</h2>
          <p>What chapter is your group currently on?</p>
          <label>
            Current Chapter
            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(Number(e.target.value))}
            >
              {chapters.map((ch) => (
                <option key={ch.order} value={ch.order}>
                  {ch.order}. {ch.title}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "1rem",
        }}
      >
        {step > 1 ? (
          <button type="button" className="outline" onClick={handlePrevious}>
            Previous
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={handleNext} disabled={saving}>
          {saving ? "Saving..." : step === 4 ? "Finish Setup" : "Next"}
        </button>
      </div>
    </main>
  );
}
