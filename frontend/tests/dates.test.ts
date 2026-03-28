import {
  formatMeetingDate,
  formatLogDate,
  formatMeetingTime,
  meetingStatus,
} from "../src/utils/dates";

describe("formatMeetingDate", () => {
  it("formats a Sunday date with weekday and full month", () => {
    expect(formatMeetingDate("2026-02-22")).toBe("Sunday, February 22");
  });

  it("formats a Wednesday date", () => {
    expect(formatMeetingDate("2025-01-01")).toBe("Wednesday, January 1");
  });

  it("handles single-digit days", () => {
    expect(formatMeetingDate("2025-01-05")).toBe("Sunday, January 5");
  });
});

describe("formatLogDate", () => {
  it("formats with short month and year", () => {
    expect(formatLogDate("2025-01-05")).toBe("Jan 5, 2025");
  });

  it("formats a February date", () => {
    expect(formatLogDate("2026-02-22")).toBe("Feb 22, 2026");
  });

  it("formats a December date", () => {
    expect(formatLogDate("2025-12-31")).toBe("Dec 31, 2025");
  });
});

describe("formatMeetingTime", () => {
  it("formats 18:00 as 6:00 PM", () => {
    expect(formatMeetingTime("18:00:00")).toBe("6:00 PM");
  });

  it("formats 9:30 as 9:30 AM", () => {
    expect(formatMeetingTime("09:30")).toBe("9:30 AM");
  });

  it("formats noon as 12:00 PM", () => {
    expect(formatMeetingTime("12:00:00")).toBe("12:00 PM");
  });

  it("returns null for null input", () => {
    expect(formatMeetingTime(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(formatMeetingTime("")).toBeNull();
  });

  it("returns null for fully malformed input", () => {
    expect(formatMeetingTime("abc:zz")).toBeNull();
  });

  it("returns null when minutes are malformed", () => {
    expect(formatMeetingTime("12:abc")).toBeNull();
  });

  it("returns null for non-time string", () => {
    expect(formatMeetingTime("not-a-time")).toBeNull();
  });
});

describe("meetingStatus", () => {
  it("returns Cancelled when is_cancelled is true", () => {
    expect(meetingStatus("2020-01-01", true)).toBe("Cancelled");
  });

  it("returns Cancelled for future cancelled meetings", () => {
    expect(meetingStatus("2099-12-31", true)).toBe("Cancelled");
  });

  it("returns Held for past non-cancelled meetings", () => {
    expect(meetingStatus("2020-01-01", false)).toBe("Held");
  });

  it("returns Scheduled for future non-cancelled meetings", () => {
    expect(meetingStatus("2099-12-31", false)).toBe("Scheduled");
  });
});
