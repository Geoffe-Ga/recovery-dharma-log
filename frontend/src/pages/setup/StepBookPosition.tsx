/** Setup wizard Step 4: Book Position. */

import React from "react";
import type { BookChapter } from "../../types/index";

interface StepBookPositionProps {
  chapters: BookChapter[];
  selectedChapter: number;
  onSelectedChapterChange: (value: number) => void;
}

export function StepBookPosition({
  chapters,
  selectedChapter,
  onSelectedChapterChange,
}: StepBookPositionProps): React.ReactElement {
  return (
    <section aria-label="Book Position">
      <h2>Book Position</h2>
      {chapters.length > 0 ? (
        <>
          <p>What chapter is your group currently on?</p>
          <label>
            Current Chapter
            <select
              value={selectedChapter}
              onChange={(e) => onSelectedChapterChange(Number(e.target.value))}
            >
              {chapters.map((ch) => (
                <option key={ch.order} value={ch.order}>
                  {ch.order}. {ch.title}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <p>No book chapters available. You can configure this later.</p>
      )}
    </section>
  );
}
