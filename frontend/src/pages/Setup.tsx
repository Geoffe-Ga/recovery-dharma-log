/** Setup wizard - 4-step onboarding for new groups. */

import React, { useCallback, useEffect, useState } from "react";
import {
  getChapters,
  getTopics,
  setupBasics,
  setupBookPosition,
  setupComplete,
  setupRotation,
  setupTopics,
} from "../api/index";
import type { BookChapter } from "../types/index";
import { StepBasics } from "./setup/StepBasics";
import { StepBookPosition } from "./setup/StepBookPosition";
import { StepRotation } from "./setup/StepRotation";
import { StepTopics } from "./setup/StepTopics";

const DEFAULT_ROTATION = [
  "Speaker",
  "Topic",
  "Book Study",
  "Topic",
  "Book Study",
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

  // Step 3: Topics (fetched from backend seed data)
  const [seedTopics, setSeedTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [newTopicInput, setNewTopicInput] = useState("");
  const [addedTopics, setAddedTopics] = useState<string[]>([]);

  // Step 4: Book Position
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState(1);

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .catch(() => {});
    getTopics()
      .then((topics) => {
        const names = topics.map((t) => t.name);
        setSeedTopics(names);
        setSelectedTopics(new Set(names));
      })
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
        if (chapters.length > 0) {
          await setupBookPosition(selectedChapter);
        }
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
    chapters,
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
        <StepBasics
          name={name}
          onNameChange={setName}
          meetingDay={meetingDay}
          onMeetingDayChange={setMeetingDay}
          meetingTime={meetingTime}
          onMeetingTimeChange={setMeetingTime}
          startDate={startDate}
          onStartDateChange={setStartDate}
        />
      )}

      {step === 2 && (
        <StepRotation
          rotation={rotation}
          onRotationChange={handleRotationChange}
          onAddSlot={handleAddSlot}
          onRemoveSlot={handleRemoveSlot}
        />
      )}

      {step === 3 && (
        <StepTopics
          seedTopics={seedTopics}
          selectedTopics={selectedTopics}
          onToggleTopic={handleToggleTopic}
          addedTopics={addedTopics}
          newTopicInput={newTopicInput}
          onNewTopicInputChange={setNewTopicInput}
          onAddTopic={handleAddTopic}
        />
      )}

      {step === 4 && (
        <StepBookPosition
          chapters={chapters}
          selectedChapter={selectedChapter}
          onSelectedChapterChange={setSelectedChapter}
        />
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
        <button
          type="button"
          onClick={handleNext}
          disabled={saving || (step === 1 && !startDate)}
        >
          {saving ? "Saving..." : step === 4 ? "Finish Setup" : "Next"}
        </button>
      </div>
    </main>
  );
}
