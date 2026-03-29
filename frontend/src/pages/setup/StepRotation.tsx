/** Setup wizard Step 2: Format Rotation. */

import React from "react";
import { MAX_ROTATION_SLOTS, ordinalDayLabel } from "../../utils/rotation";

const FORMAT_OPTIONS = ["Speaker", "Topic", "Book Study"];

interface StepRotationProps {
  rotation: string[];
  meetingDay: number;
  onRotationChange: (index: number, value: string) => void;
  onAddSlot: () => void;
  onRemoveSlot: (index: number) => void;
}

export function StepRotation({
  rotation,
  meetingDay,
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
            {ordinalDayLabel(i, meetingDay)}
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
              aria-label={`Remove ${ordinalDayLabel(i, meetingDay)}`}
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {rotation.length < MAX_ROTATION_SLOTS && (
        <button type="button" className="outline" onClick={onAddSlot}>
          + Add {ordinalDayLabel(rotation.length, meetingDay)}
        </button>
      )}
    </section>
  );
}
