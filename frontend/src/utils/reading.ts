/** Shared utilities for the book reading plan UI. */

import type { BookChapter } from "../types/index";

export const DEFAULT_TARGET_PAGES = 5;

/**
 * Return how many sequential chapters (from the start of `unassigned`)
 * are needed to reach approximately `targetPages`.  Always returns at
 * least 1 when chapters are available.
 */
export function suggestChapterCount(
  unassigned: BookChapter[],
  targetPages: number = DEFAULT_TARGET_PAGES,
): number {
  if (unassigned.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < unassigned.length; i++) {
    total += unassigned[i].page_count;
    if (total >= targetPages) return i + 1;
  }
  return unassigned.length;
}

/**
 * Format a list of chapters as a compact range string.
 * Single: "Wise Intention \u2014 pp.\u00A017\u201324"
 * Multi:  "Wise Intention + The First Noble Truth \u2014 pp.\u00A017\u201330"
 */
export function formatChapterRange(chapters: BookChapter[]): string {
  if (chapters.length === 0) return "";
  const titles = chapters.map((ch) => ch.title).join(" + ");
  const startPage = chapters[0].start_page;
  const endPage = chapters[chapters.length - 1].end_page;
  return `${titles} \u2014 pp.\u00A0${startPage}\u2013${endPage}`;
}
