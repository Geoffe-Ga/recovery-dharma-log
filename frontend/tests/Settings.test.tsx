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
  { id: 1, name: "Topic 1", is_active: true, is_drawn: false },
];

const mockPlan: ReadingPlanStatus = {
  current_assignment_chapters: [],
  current_assignment_total_pages: 0,
  next_chapter: null,
  completed_assignments: [],
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
});
