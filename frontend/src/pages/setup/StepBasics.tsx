/** Setup wizard Step 1: Group Basics. */

import React from "react";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface StepBasicsProps {
  name: string;
  onNameChange: (value: string) => void;
  meetingDay: number;
  onMeetingDayChange: (value: number) => void;
  meetingTime: string;
  onMeetingTimeChange: (value: string) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
}

export function StepBasics({
  name,
  onNameChange,
  meetingDay,
  onMeetingDayChange,
  meetingTime,
  onMeetingTimeChange,
  startDate,
  onStartDateChange,
}: StepBasicsProps): React.ReactElement {
  return (
    <section aria-label="Group Basics">
      <h2>Group Basics</h2>
      <label>
        Meeting Name
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          required
        />
      </label>
      <label>
        Meeting Day
        <select
          value={meetingDay}
          onChange={(e) => onMeetingDayChange(Number(e.target.value))}
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
          onChange={(e) => onMeetingTimeChange(e.target.value)}
        />
      </label>
      <label>
        Start Date
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          required
        />
      </label>
    </section>
  );
}
