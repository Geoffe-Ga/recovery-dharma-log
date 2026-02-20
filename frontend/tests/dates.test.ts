import { formatMeetingDate, formatLogDate } from "../src/utils/dates";

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
