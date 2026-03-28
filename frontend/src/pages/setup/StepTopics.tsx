/** Setup wizard Step 3: Discussion Topics. */

import React from "react";

interface StepTopicsProps {
  seedTopics: string[];
  selectedTopics: Set<string>;
  onToggleTopic: (topic: string) => void;
  addedTopics: string[];
  newTopicInput: string;
  onNewTopicInputChange: (value: string) => void;
  onAddTopic: () => void;
}

export function StepTopics({
  seedTopics,
  selectedTopics,
  onToggleTopic,
  addedTopics,
  newTopicInput,
  onNewTopicInputChange,
  onAddTopic,
}: StepTopicsProps): React.ReactElement {
  return (
    <section aria-label="Discussion Topics">
      <h2>Discussion Topics</h2>
      <p>Select which default topics to keep and add any new ones.</p>
      <fieldset>
        <legend>Default Topics</legend>
        {seedTopics.map((topic) => (
          <label key={topic}>
            <input
              type="checkbox"
              checked={selectedTopics.has(topic)}
              onChange={() => onToggleTopic(topic)}
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
                onChange={() => onToggleTopic(topic)}
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
          onChange={(e) => onNewTopicInputChange(e.target.value)}
          placeholder="Add a new topic"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddTopic();
            }
          }}
        />
        <button type="button" className="outline" onClick={onAddTopic}>
          Add
        </button>
      </div>
    </section>
  );
}
