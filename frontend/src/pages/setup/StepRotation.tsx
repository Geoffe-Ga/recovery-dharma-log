/** Setup wizard Step 2: Format Rotation. */

import React from "react";

const FORMAT_OPTIONS = ["Speaker", "Topic", "Book Study"];

interface StepRotationProps {
  rotation: string[];
  onRotationChange: (index: number, value: string) => void;
  onAddSlot: () => void;
  onRemoveSlot: (index: number) => void;
}

export function StepRotation({
  rotation,
  onRotationChange,
  onAddSlot,
  onRemoveSlot,
}: StepRotationProps): React.ReactElement {
  return (
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
              onChange={(e) => onRotationChange(i, e.target.value)}
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
              onClick={() => onRemoveSlot(i)}
              aria-label={`Remove week ${i + 1}`}
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <button type="button" className="outline" onClick={onAddSlot}>
        Add Week
      </button>
    </section>
  );
}
