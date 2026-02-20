/** Date formatting utilities for human-readable display. */

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
