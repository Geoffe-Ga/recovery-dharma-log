/** Compact calendar showing next N meetings with format badges. */

import React from "react";
import { formatMeetingDate } from "../utils/dates";

interface RotationCalendarProps {
  meetingDay: number;
  startDate?: string;
  formatRotation: string[];
  count?: number;
}

function getNextMeetingDate(meetingDay: number, after: Date): Date {
  const result = new Date(after);
  const daysAhead = meetingDay - result.getDay();
  if (daysAhead < 0) {
    result.setDate(result.getDate() + daysAhead + 7);
  } else if (daysAhead > 0) {
    result.setDate(result.getDate() + daysAhead);
  }
  return result;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function RotationCalendar({
  meetingDay,
  formatRotation,
  count = 10,
}: RotationCalendarProps): React.ReactElement {
  // Convert meetingDay (0=Mon, 6=Sun) to JS day (0=Sun, 6=Sat)
  const jsMeetingDay = meetingDay === 6 ? 0 : meetingDay + 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const meetings: { date: string; format: string }[] = [];
  let current = getNextMeetingDate(jsMeetingDay, today);

  for (let i = 0; i < count; i++) {
    const weekOfMonth = Math.floor((current.getDate() - 1) / 7);
    const format =
      formatRotation.length > 0
        ? formatRotation[weekOfMonth % formatRotation.length]
        : "Topic";
    meetings.push({ date: toIsoDate(current), format });
    current = new Date(current);
    current.setDate(current.getDate() + 7);
  }

  if (formatRotation.length === 0)
    return <p className="rd-meta">No rotation configured.</p>;

  return (
    <div className="rd-rotation-calendar">
      {meetings.map((m) => (
        <div key={m.date} className="rd-rotation-calendar__row">
          <span className="rd-rotation-calendar__date">
            {formatMeetingDate(m.date)}
          </span>
          <span className="rd-rotation-calendar__badge">{m.format}</span>
        </div>
      ))}
    </div>
  );
}
