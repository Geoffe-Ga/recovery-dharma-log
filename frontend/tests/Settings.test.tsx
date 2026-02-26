/** Tests for Settings page sticky save bar. */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../src/contexts/ToastContext";
import { Settings } from "../src/pages/Settings";
import type {
  BookChapter,
  GroupSettings,
  ReadingPlanStatus,
  Topic,
} from "../src/types/index";

jest.mock("../src/api/index", () => ({
  getSettings: jest.fn(),
  getTopics: jest.fn(),
  getReadingPlan: jest.fn(),
  getChapters: jest.fn(),
  updateSettings: jest.fn(),
  createTopic: jest.fn(),
  deleteTopic: jest.fn(),
  reshuffleTopics: jest.fn(),
  addChapterToPlan: jest.fn(),
  finalizePlan: jest.fn(),
  updateAssignment: jest.fn(),
  deleteAssignment: jest.fn(),
}));

import * as api from "../src/api/index";

const mockSettings: GroupSettings = {
  name: "Test Meeting",
  meeting_day: 6,
  start_date: "2025-01-05",
  meeting_time: "18:00:00",
  format_rotation: ["Speaker", "Topic", "Book Study"],
};

const mockTopics: Topic[] = [
  { id: 1, name: "Topic 1", is_active: true, is_drawn: false, last_used: null },
];

const mockPlan: ReadingPlanStatus = {
  current_assignment_chapters: [],
  current_assignment_total_pages: 0,
  next_chapter: null,
  completed_assignments: [],
  unassigned_chapters: [],
  total_chapters: 0,
  assigned_chapters: 0,
  total_pages: 0,
  assigned_pages: 0,
};

const mockChapters: BookChapter[] = [];

function renderSettings(): void {
  render(
    <ToastProvider>
      <Settings />
    </ToastProvider>,
  );
}

describe("Settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.getSettings as jest.Mock).mockResolvedValue(mockSettings);
    (api.getTopics as jest.Mock).mockResolvedValue(mockTopics);
    (api.getReadingPlan as jest.Mock).mockResolvedValue(mockPlan);
    (api.getChapters as jest.Mock).mockResolvedValue(mockChapters);
  });

  it("renders settings page", async () => {
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Settings" }),
      ).toBeInTheDocument();
    });
  });

  it("does not show sticky bar initially", async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Meeting")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("You have unsaved changes"),
    ).not.toBeInTheDocument();
  });

  it("shows sticky bar when name is changed", async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Meeting")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Test Meeting"), {
      target: { value: "New Name" },
    });

    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
  });

  it("hides sticky bar after save", async () => {
    (api.updateSettings as jest.Mock).mockResolvedValue({
      ...mockSettings,
      name: "New Name",
    });
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Meeting")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Test Meeting"), {
      target: { value: "New Name" },
    });

    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(
        screen.queryByText("You have unsaved changes"),
      ).not.toBeInTheDocument();
    });
  });

  it("reverts changes on discard", async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Meeting")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Test Meeting"), {
      target: { value: "Changed Name" },
    });

    expect(screen.getByDisplayValue("Changed Name")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.getByDisplayValue("Test Meeting")).toBeInTheDocument();
    expect(
      screen.queryByText("You have unsaved changes"),
    ).not.toBeInTheDocument();
  });

  it("renders meeting day dropdown with correct initial value", async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Sunday")).toBeInTheDocument();
    });
  });

  it("shows sticky bar when meeting day is changed", async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Sunday")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Sunday"), {
      target: { value: "0" },
    });

    expect(screen.getByDisplayValue("Monday")).toBeInTheDocument();
    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
  });

  it("includes meeting_day in updateSettings call when saving", async () => {
    (api.updateSettings as jest.Mock).mockResolvedValue({
      ...mockSettings,
      meeting_day: 1,
    });
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Sunday")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Sunday"), {
      target: { value: "1" },
    });

    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ meeting_day: 1 }),
      ),
    );
  });

  it("renders progress bar with correct chapter count text", async () => {
    const planWithProgress: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 39,
      assigned_chapters: 12,
      total_pages: 400,
      assigned_pages: 245,
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithProgress);
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByText(/12 of 39 chapters assigned/),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/245 of 400 pages assigned/)).toBeInTheDocument();
    expect(screen.getByText(/~27 weeks remaining/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "12",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuemax",
      "39",
    );
  });

  it("shows toast on save error", async () => {
    (api.updateSettings as jest.Mock).mockRejectedValue(
      new Error("Save failed"),
    );
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Meeting")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Test Meeting"), {
      target: { value: "New Name" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
    });
  });

  it("displays last-used date for topics that have one", async () => {
    const topicsWithDates: Topic[] = [
      {
        id: 1,
        name: "Mindfulness",
        is_active: true,
        is_drawn: false,
        last_used: "2025-02-08",
      },
    ];
    (api.getTopics as jest.Mock).mockResolvedValue(topicsWithDates);
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/last used/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Feb 8, 2025/)).toBeInTheDocument();
  });

  it("renders chapter picker with unassigned chapters", async () => {
    const planWithChapters: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 3,
      unassigned_chapters: [
        {
          id: 1,
          order: 1,
          start_page: "IX",
          end_page: "X",
          title: "Preface",
          page_count: 1,
        },
        {
          id: 2,
          order: 2,
          start_page: "X",
          end_page: "XIII",
          title: "What is Recovery Dharma?",
          page_count: 3,
        },
      ],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithChapters);
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Add Chapters" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Preface/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/What is Recovery Dharma\?/),
    ).toBeInTheDocument();
  });

  it("enables Add Selected button only when chapters are checked", async () => {
    const planWithChapters: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 2,
      unassigned_chapters: [
        {
          id: 1,
          order: 1,
          start_page: "IX",
          end_page: "X",
          title: "Preface",
          page_count: 1,
        },
      ],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithChapters);
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/Add Selected/)).toBeInTheDocument();
    });

    // Button should be disabled when no chapters selected
    expect(screen.getByText(/Add Selected/)).toBeDisabled();

    // Check a chapter
    fireEvent.click(screen.getByLabelText(/Preface/));

    // Button should now be enabled
    expect(screen.getByText(/Add Selected \(1\)/)).toBeEnabled();
  });

  it("calls addChapterToPlan for each selected chapter", async () => {
    const planWithChapters: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 2,
      unassigned_chapters: [
        {
          id: 1,
          order: 1,
          start_page: "IX",
          end_page: "X",
          title: "Preface",
          page_count: 1,
        },
        {
          id: 2,
          order: 2,
          start_page: "X",
          end_page: "XIII",
          title: "Introduction",
          page_count: 3,
        },
      ],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithChapters);
    (api.addChapterToPlan as jest.Mock).mockResolvedValue(planWithChapters);
    renderSettings();

    await waitFor(() => {
      expect(screen.getByLabelText(/Preface/)).toBeInTheDocument();
    });

    // Select both chapters
    fireEvent.click(screen.getByLabelText(/Preface/));
    fireEvent.click(screen.getByLabelText(/Introduction/));

    fireEvent.click(screen.getByText(/Add Selected \(2\)/));

    await waitFor(() => {
      expect(api.addChapterToPlan).toHaveBeenCalledTimes(2);
    });

    expect(api.getReadingPlan).toHaveBeenCalledTimes(2); // initial + after add
  });

  it("displays meeting date next to finalized assignment", async () => {
    const planWithAssignment: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 3,
      assigned_chapters: 1,
      total_pages: 6,
      assigned_pages: 1,
      completed_assignments: [
        {
          id: 1,
          assignment_order: 1,
          chapters: [
            {
              id: 1,
              order: 1,
              start_page: "1",
              end_page: "10",
              title: "Preface",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: "2025-03-15",
        },
      ],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithAssignment);
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/Mar 15/)).toBeInTheDocument();
    });
  });

  it("does not show date when assignment has no meeting_date", async () => {
    const planWithAssignment: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 3,
      assigned_chapters: 1,
      total_pages: 6,
      assigned_pages: 1,
      completed_assignments: [
        {
          id: 1,
          assignment_order: 1,
          chapters: [
            {
              id: 1,
              order: 1,
              start_page: "1",
              end_page: "10",
              title: "Preface",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: null,
        },
      ],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithAssignment);
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/Preface/)).toBeInTheDocument();
    });

    expect(screen.queryByText(/\u2014\s+\w{3}\s+\d/)).not.toBeInTheDocument();
  });

  it("does not display last-used text for topics without a date", async () => {
    const topicsWithoutDates: Topic[] = [
      {
        id: 2,
        name: "Karma",
        is_active: true,
        is_drawn: false,
        last_used: null,
      },
    ];
    (api.getTopics as jest.Mock).mockResolvedValue(topicsWithoutDates);
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("Karma")).toBeInTheDocument();
    });

    expect(screen.queryByText(/last used/)).not.toBeInTheDocument();
  });
});
