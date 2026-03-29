/** Shared constants and helpers for the format rotation UI. */

export const MAX_ROTATION_SLOTS = 5;

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"] as const;

/** Return e.g. "1st Sunday" for index=0 and meetingDay=6. */
export function ordinalDayLabel(index: number, meetingDay: number): string {
  const ordinal = ORDINALS[index] ?? `${index + 1}th`;
  const day = DAYS_OF_WEEK[meetingDay] ?? "day";
  return `${ordinal} ${day}`;
}
