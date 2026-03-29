/** Unit tests for rotation utility functions. */

import {
  DAYS_OF_WEEK,
  MAX_ROTATION_SLOTS,
  ordinalDayLabel,
} from "../src/utils/rotation";

describe("ordinalDayLabel", () => {
  it("returns '1st Sunday' for index=0, meetingDay=6", () => {
    expect(ordinalDayLabel(0, 6)).toBe("1st Sunday");
  });

  it("returns '3rd Wednesday' for index=2, meetingDay=2", () => {
    expect(ordinalDayLabel(2, 2)).toBe("3rd Wednesday");
  });

  it("returns '5th Monday' for index=4, meetingDay=0", () => {
    expect(ordinalDayLabel(4, 0)).toBe("5th Monday");
  });

  it("falls back to Nth ordinal for index >= 5", () => {
    expect(ordinalDayLabel(5, 0)).toBe("6th Monday");
    expect(ordinalDayLabel(9, 3)).toBe("10th Thursday");
  });

  it('falls back to "day" for meetingDay >= 7', () => {
    expect(ordinalDayLabel(0, 7)).toBe("1st day");
    expect(ordinalDayLabel(2, 99)).toBe("3rd day");
  });

  it("falls back on both when both are out of range", () => {
    expect(ordinalDayLabel(10, 10)).toBe("11th day");
  });
});

describe("DAYS_OF_WEEK", () => {
  it("has 7 entries starting with Monday", () => {
    expect(DAYS_OF_WEEK).toHaveLength(7);
    expect(DAYS_OF_WEEK[0]).toBe("Monday");
    expect(DAYS_OF_WEEK[6]).toBe("Sunday");
  });
});

describe("MAX_ROTATION_SLOTS", () => {
  it("is 5", () => {
    expect(MAX_ROTATION_SLOTS).toBe(5);
  });
});
