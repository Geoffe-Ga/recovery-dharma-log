/** Date and time formatting utilities for human-readable display. */

/**
 * Format an ISO date string as "Sunday, February 22".
 * Used on the Landing page for the prominent meeting date.
 */
export function formatMeetingDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format an ISO date string as "Feb 22, 2025".
 * Used in the Meeting Log table for compact display.
 */
export function formatLogDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format an ISO date string as "Mar 15".
 * Used for compact date display such as reading assignment dates.
 */
export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Derive meeting status from the date and cancellation flag.
 * Future meetings are "Scheduled", past meetings are "Held", cancelled is "Cancelled".
 */
export function meetingStatus(isoDate: string, isCancelled: boolean): string {
  if (isCancelled) return "Cancelled";
  const [year, month, day] = isoDate.split("-").map(Number);
  const meetingDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return meetingDate >= today ? "Scheduled" : "Held";
}

/**
 * Format a time string (HH:MM or HH:MM:SS) as "6:00 PM".
 * Returns null if the input is null or empty.
 */
export function formatMeetingTime(timeStr: string | null): string | null {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;
  const date = new Date(2000, 0, 1, hours, minutes);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
