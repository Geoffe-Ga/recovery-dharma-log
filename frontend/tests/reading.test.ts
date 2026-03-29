import type { BookChapter } from "../src/types/index";
import {
  suggestChapterCount,
  formatChapterRange,
  DEFAULT_TARGET_PAGES,
} from "../src/utils/reading";

function makeChapter(overrides: Partial<BookChapter> = {}): BookChapter {
  return {
    id: 1,
    order: 1,
    start_page: "1",
    end_page: "5",
    title: "Chapter 1",
    page_count: 5,
    ...overrides,
  };
}

describe("suggestChapterCount", () => {
  it("returns 0 for empty array", () => {
    expect(suggestChapterCount([])).toBe(0);
  });

  it("returns 1 when first chapter meets target pages", () => {
    const chapters = [makeChapter({ page_count: 10 })];
    expect(suggestChapterCount(chapters, 5)).toBe(1);
  });

  it("accumulates chapters until target is reached", () => {
    const chapters = [
      makeChapter({ id: 1, page_count: 2 }),
      makeChapter({ id: 2, page_count: 2 }),
      makeChapter({ id: 3, page_count: 2 }),
    ];
    expect(suggestChapterCount(chapters, 5)).toBe(3);
  });

  it("stops as soon as cumulative pages reach target", () => {
    const chapters = [
      makeChapter({ id: 1, page_count: 3 }),
      makeChapter({ id: 2, page_count: 3 }),
      makeChapter({ id: 3, page_count: 3 }),
    ];
    expect(suggestChapterCount(chapters, 5)).toBe(2);
  });

  it("returns all chapters when total pages never reach target", () => {
    const chapters = [
      makeChapter({ id: 1, page_count: 1 }),
      makeChapter({ id: 2, page_count: 1 }),
    ];
    expect(suggestChapterCount(chapters, 100)).toBe(2);
  });

  it("uses DEFAULT_TARGET_PAGES when no target provided", () => {
    const chapters = [makeChapter({ page_count: DEFAULT_TARGET_PAGES })];
    expect(suggestChapterCount(chapters)).toBe(1);
  });

  it("returns 1 for single chapter below target", () => {
    const chapters = [makeChapter({ page_count: 1 })];
    expect(suggestChapterCount(chapters, 10)).toBe(1);
  });
});

describe("formatChapterRange", () => {
  it("returns empty string for empty array", () => {
    expect(formatChapterRange([])).toBe("");
  });

  it("formats a single chapter", () => {
    const chapters = [
      makeChapter({
        title: "Wise Intention",
        start_page: "17",
        end_page: "24",
      }),
    ];
    expect(formatChapterRange(chapters)).toBe(
      "Wise Intention \u2014 pp.\u00A017\u201324",
    );
  });

  it("formats multiple chapters with joined titles", () => {
    const chapters = [
      makeChapter({
        id: 1,
        title: "Wise Intention",
        start_page: "17",
        end_page: "24",
      }),
      makeChapter({
        id: 2,
        title: "The First Noble Truth",
        start_page: "25",
        end_page: "30",
      }),
    ];
    expect(formatChapterRange(chapters)).toBe(
      "Wise Intention + The First Noble Truth \u2014 pp.\u00A017\u201330",
    );
  });

  it("uses start_page of first and end_page of last chapter", () => {
    const chapters = [
      makeChapter({ start_page: "100", end_page: "110" }),
      makeChapter({ start_page: "111", end_page: "120" }),
      makeChapter({ start_page: "121", end_page: "150" }),
    ];
    const result = formatChapterRange(chapters);
    expect(result).toContain("100");
    expect(result).toContain("150");
    expect(result).not.toContain("110");
  });
});
