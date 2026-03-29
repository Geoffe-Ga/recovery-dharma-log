/** Tests for Settings page section navigation and sticky save bar. */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../src/contexts/ToastContext";
import { Settings } from "../src/pages/Settings";
import type {
  BookChapter,
  BookPosition,
  GroupSettings,
  ReadingPlanStatus,
  Topic,
} from "../src/types/index";

jest.mock("../src/api/index", () => ({
  getSettings: jest.fn(),
  getTopics: jest.fn(),
  getReadingPlan: jest.fn(),
  getChapters: jest.fn(),
  getBookPosition: jest.fn(),
  updateSettings: jest.fn(),
  createTopic: jest.fn(),
  deleteTopic: jest.fn(),
  reshuffleTopics: jest.fn(),
  addChaptersToPlan: jest.fn(),
  advanceBook: jest.fn(),
  finalizePlan: jest.fn(),
  updateAssignment: jest.fn(),
  deleteAssignment: jest.fn(),
  setBookPosition: jest.fn(),
  restartBook: jest.fn(),
  generateInviteCode: jest.fn(),
  revokeInviteCode: jest.fn(),
}));

import * as api from "../src/api/index";

const mockSettings: GroupSettings = {
  name: "Test Meeting",
  meeting_day: 6,
  start_date: "2025-01-05",
  meeting_time: "18:00:00",
  format_rotation: ["Speaker", "Topic", "Book Study"],
  setup_completed: true,
  invite_code: null,
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

const mockPosition: BookPosition = {
  current_assignment_index: 0,
  book_cycle: 1,
  total_assignments: 0,
  current_assignment: null,
  chapter_marker: null,
};

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
    (api.getBookPosition as jest.Mock).mockResolvedValue(mockPosition);
  });

  it("renders section nav with correct links", async () => {
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Settings" }),
      ).toBeInTheDocument();
    });

    const nav = screen.getByRole("navigation", { name: "Section navigation" });
    expect(nav).toBeInTheDocument();

    const links = nav.querySelectorAll("a");
    expect(links).toHaveLength(5);

    expect(links[0]).toHaveTextContent("Meeting");
    expect(links[0]).toHaveAttribute("href", "#meeting");

    expect(links[1]).toHaveTextContent("Rotation");
    expect(links[1]).toHaveAttribute("href", "#rotation");

    expect(links[2]).toHaveTextContent("Topics");
    expect(links[2]).toHaveAttribute("href", "#topics");

    expect(links[3]).toHaveTextContent("Reading Plan");
    expect(links[3]).toHaveAttribute("href", "#reading-plan");

    expect(links[4]).toHaveTextContent("Danger Zone");
    expect(links[4]).toHaveAttribute("href", "#danger-zone");
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
    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Meeting")).toBeInTheDocument();
    });

    await user.clear(screen.getByDisplayValue("Test Meeting"));
    await user.type(screen.getByLabelText("Group Name"), "New Name");

    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
  });

  it("hides sticky bar after save", async () => {
    const user = userEvent.setup();
    (api.updateSettings as jest.Mock).mockResolvedValue({
      ...mockSettings,
      name: "New Name",
    });
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Meeting")).toBeInTheDocument();
    });

    await user.clear(screen.getByDisplayValue("Test Meeting"));
    await user.type(screen.getByLabelText("Group Name"), "New Name");

    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(
        screen.queryByText("You have unsaved changes"),
      ).not.toBeInTheDocument();
    });
  });

  it("reverts changes on discard", async () => {
    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Meeting")).toBeInTheDocument();
    });

    await user.clear(screen.getByDisplayValue("Test Meeting"));
    await user.type(screen.getByLabelText("Group Name"), "Changed Name");

    expect(screen.getByDisplayValue("Changed Name")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Discard" }));

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
    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Sunday")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue("Sunday"), "0");

    expect(screen.getByDisplayValue("Monday")).toBeInTheDocument();
    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
  });

  it("includes meeting_day in updateSettings call when saving", async () => {
    const user = userEvent.setup();
    (api.updateSettings as jest.Mock).mockResolvedValue({
      ...mockSettings,
      meeting_day: 1,
    });
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Sunday")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue("Sunday"), "1");

    await user.click(screen.getByText("Save Changes"));

    await waitFor(() =>
      expect(api.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ meeting_day: 1 }),
      ),
    );
  });

  it("renders progress bar with page count and weeks remaining", async () => {
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
      expect(screen.getByText(/245 of 400 pages/)).toBeInTheDocument();
    });

    expect(screen.getByText(/~27 weeks left/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "245",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuemax",
      "400",
    );
  });

  it("shows toast on save error", async () => {
    const user = userEvent.setup();
    (api.updateSettings as jest.Mock).mockRejectedValue(
      new Error("Save failed"),
    );
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Meeting")).toBeInTheDocument();
    });

    await user.clear(screen.getByDisplayValue("Test Meeting"));
    await user.type(screen.getByLabelText("Group Name"), "New Name");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

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

  it("shows 'Start Reading' when no assignments exist and chapters available", async () => {
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
        screen.getByRole("heading", { name: "Start Reading" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Queue First Reading" }),
    ).toBeInTheDocument();
  });

  it("shows This Week's Reading card with current assignment", async () => {
    const planWithAssignment: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 3,
      assigned_chapters: 1,
      total_pages: 6,
      assigned_pages: 3,
      completed_assignments: [
        {
          id: 1,
          assignment_order: 1,
          chapters: [
            {
              id: 1,
              order: 1,
              start_page: "1",
              end_page: "3",
              title: "Preface",
              page_count: 3,
            },
          ],
          total_pages: 3,
          meeting_date: null,
        },
      ],
    };
    const positionWithAssignment: BookPosition = {
      ...mockPosition,
      total_assignments: 1,
      current_assignment_index: 0,
      current_assignment: planWithAssignment.completed_assignments[0],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithAssignment);
    (api.getBookPosition as jest.Mock).mockResolvedValue(
      positionWithAssignment,
    );
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /This Week/ }),
      ).toBeInTheDocument();
    });

    // The card shows the formatted chapter range
    expect(screen.getByText(/Preface \u2014 pp/)).toBeInTheDocument();
    expect(screen.getByText("3 pages")).toBeInTheDocument();
  });

  it("enters queue mode and auto-suggests chapters", async () => {
    const user = userEvent.setup();
    const planWithData: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 5,
      assigned_chapters: 1,
      total_pages: 20,
      assigned_pages: 3,
      unassigned_chapters: [
        {
          id: 2,
          order: 2,
          start_page: "4",
          end_page: "6",
          title: "Introduction",
          page_count: 3,
        },
        {
          id: 3,
          order: 3,
          start_page: "7",
          end_page: "10",
          title: "Chapter 1",
          page_count: 4,
        },
      ],
      completed_assignments: [
        {
          id: 1,
          assignment_order: 1,
          chapters: [
            {
              id: 1,
              order: 1,
              start_page: "1",
              end_page: "3",
              title: "Preface",
              page_count: 3,
            },
          ],
          total_pages: 3,
          meeting_date: null,
        },
      ],
    };
    const positionData: BookPosition = {
      ...mockPosition,
      total_assignments: 1,
      current_assignment_index: 0,
      current_assignment: planWithData.completed_assignments[0],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithData);
    (api.getBookPosition as jest.Mock).mockResolvedValue(positionData);
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Mark Done & Queue Next" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Mark Done & Queue Next" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Next Up" }),
      ).toBeInTheDocument();
    });

    // Auto-suggest should pick chapters totaling >= 5 pages
    expect(screen.getByText(/Introduction/)).toBeInTheDocument();
    expect(screen.getByText(/Chapter 1/)).toBeInTheDocument();
    expect(screen.getByText(/7 pages/)).toBeInTheDocument();
    expect(screen.getByText(/2 chapters/)).toBeInTheDocument();
  });

  it("adjusts suggestion with +/- stepper", async () => {
    const user = userEvent.setup();
    const planWithData: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 5,
      assigned_chapters: 1,
      total_pages: 20,
      assigned_pages: 3,
      unassigned_chapters: [
        {
          id: 2,
          order: 2,
          start_page: "4",
          end_page: "6",
          title: "Introduction",
          page_count: 3,
        },
        {
          id: 3,
          order: 3,
          start_page: "7",
          end_page: "10",
          title: "Chapter 1",
          page_count: 4,
        },
      ],
      completed_assignments: [
        {
          id: 1,
          assignment_order: 1,
          chapters: [
            {
              id: 1,
              order: 1,
              start_page: "1",
              end_page: "3",
              title: "Preface",
              page_count: 3,
            },
          ],
          total_pages: 3,
          meeting_date: null,
        },
      ],
    };
    const positionData: BookPosition = {
      ...mockPosition,
      total_assignments: 1,
      current_assignment_index: 0,
      current_assignment: planWithData.completed_assignments[0],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithData);
    (api.getBookPosition as jest.Mock).mockResolvedValue(positionData);
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Mark Done & Queue Next" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Mark Done & Queue Next" }),
    );

    await waitFor(() => {
      expect(screen.getByText(/2 chapters/)).toBeInTheDocument();
    });

    // Remove one chapter
    await user.click(screen.getByRole("button", { name: "Remove chapter" }));
    expect(screen.getByText(/1 chapter$/)).toBeInTheDocument();
    expect(screen.getByText(/3 pages/)).toBeInTheDocument();
  });

  it("confirms queue and calls addChaptersToPlan + finalizePlan", async () => {
    const user = userEvent.setup();
    const planWithData: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 3,
      assigned_chapters: 0,
      total_pages: 10,
      assigned_pages: 0,
      unassigned_chapters: [
        {
          id: 1,
          order: 1,
          start_page: "1",
          end_page: "5",
          title: "Preface",
          page_count: 5,
        },
      ],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithData);
    (api.addChaptersToPlan as jest.Mock).mockResolvedValue(planWithData);
    (api.finalizePlan as jest.Mock).mockResolvedValue({});
    (api.getBookPosition as jest.Mock).mockResolvedValue(mockPosition);
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Queue First Reading" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Queue First Reading" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Confirm" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(api.addChaptersToPlan).toHaveBeenCalledWith([1]);
      expect(api.finalizePlan).toHaveBeenCalled();
    });
  });

  it("cancels queue mode", async () => {
    const user = userEvent.setup();
    const planWithData: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 3,
      unassigned_chapters: [
        {
          id: 1,
          order: 1,
          start_page: "1",
          end_page: "5",
          title: "Preface",
          page_count: 5,
        },
      ],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithData);
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Queue First Reading" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Queue First Reading" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Next Up" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Queue First Reading" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("heading", { name: "Next Up" }),
    ).not.toBeInTheDocument();
  });

  it("shows Mark Done (not Queue Next) when more assignments exist ahead", async () => {
    const planWithAssignments: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 3,
      assigned_chapters: 2,
      total_pages: 20,
      assigned_pages: 18,
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
              title: "Chapter 1",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: null,
        },
        {
          id: 2,
          assignment_order: 2,
          chapters: [
            {
              id: 2,
              order: 2,
              start_page: "11",
              end_page: "20",
              title: "Chapter 2",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: null,
        },
      ],
    };
    const positionWithAssignments: BookPosition = {
      ...mockPosition,
      total_assignments: 2,
      current_assignment_index: 0,
      current_assignment: planWithAssignments.completed_assignments[0],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithAssignments);
    (api.getBookPosition as jest.Mock).mockResolvedValue(
      positionWithAssignments,
    );
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Mark Done" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: "Mark Done & Queue Next" }),
    ).not.toBeInTheDocument();
  });

  it("calls advanceBook when Mark Done is clicked with assignments ahead", async () => {
    const user = userEvent.setup();
    const planWithAssignments: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 3,
      assigned_chapters: 2,
      total_pages: 20,
      assigned_pages: 18,
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
              title: "Chapter 1",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: null,
        },
        {
          id: 2,
          assignment_order: 2,
          chapters: [
            {
              id: 2,
              order: 2,
              start_page: "11",
              end_page: "20",
              title: "Chapter 2",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: null,
        },
      ],
    };
    const positionAtFirst: BookPosition = {
      ...mockPosition,
      total_assignments: 2,
      current_assignment_index: 0,
      current_assignment: planWithAssignments.completed_assignments[0],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithAssignments);
    (api.getBookPosition as jest.Mock).mockResolvedValue(positionAtFirst);
    (api.advanceBook as jest.Mock).mockResolvedValue({
      ...positionAtFirst,
      current_assignment_index: 1,
      current_assignment: planWithAssignments.completed_assignments[1],
    });
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Mark Done" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Mark Done" }));

    await waitFor(() => {
      expect(api.advanceBook).toHaveBeenCalled();
    });
  });

  it("displays meeting date in reading history", async () => {
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

    // History is collapsed — open it
    await waitFor(() => {
      expect(screen.getByText(/^Reading History/)).toBeInTheDocument();
    });

    await userEvent.setup().click(screen.getByText(/^Reading History/));

    expect(screen.getByText(/Mar 15/)).toBeInTheDocument();
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

  it("shows 5th-week note when rotation length is less than 5", async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Meeting")).toBeInTheDocument();
    });

    // Default mock has 3-item rotation: ["Speaker", "Topic", "Book Study"]
    // 4 % 3 = 1, so 2nd Sunday, format = "Topic"
    expect(
      screen.getByText(
        /Months with a 5th Sunday will use the Topic format \(2nd Sunday\)/,
      ),
    ).toBeInTheDocument();
  });

  it("does not show 5th-week note when rotation length is 5 or more", async () => {
    const fiveItemSettings: GroupSettings = {
      ...mockSettings,
      format_rotation: ["Speaker", "Topic", "Book Study", "Speaker", "Topic"],
    };
    (api.getSettings as jest.Mock).mockResolvedValue(fiveItemSettings);
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Meeting")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Months with a 5th/)).not.toBeInTheDocument();
  });

  it("renders Danger Zone section with reshuffle button", async () => {
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Danger Zone" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Reshuffle Deck" }),
    ).toBeInTheDocument();
  });

  it("shows inline confirmation for reshuffle", async () => {
    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Reshuffle Deck" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Reshuffle Deck" }));

    expect(
      screen.getByText("Reshuffle the deck? All drawn topics will return."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm Reshuffle" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("cancels reshuffle on cancel click", async () => {
    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Reshuffle Deck" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Reshuffle Deck" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("button", { name: "Reshuffle Deck" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Reshuffle the deck? All drawn topics will return."),
    ).not.toBeInTheDocument();
  });

  it("executes reshuffle on confirm", async () => {
    const user = userEvent.setup();
    (api.reshuffleTopics as jest.Mock).mockResolvedValue(undefined);
    (api.getTopics as jest.Mock).mockResolvedValue(mockTopics);
    renderSettings();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Reshuffle Deck" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Reshuffle Deck" }));
    await user.click(screen.getByRole("button", { name: "Confirm Reshuffle" }));

    await waitFor(() => {
      expect(api.reshuffleTopics).toHaveBeenCalledTimes(1);
    });
  });

  it("shows inline confirmation when deleting a topic", async () => {
    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("Topic 1")).toBeInTheDocument();
    });

    const topicItem = screen.getByText("Topic 1").closest("li")!;
    const removeBtn = topicItem.querySelector("button")!;
    await user.click(removeBtn);

    expect(
      screen.getByRole("button", { name: "Confirm Remove" }),
    ).toBeInTheDocument();
  });

  it("cancels topic deletion on cancel click", async () => {
    const user = userEvent.setup();
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("Topic 1")).toBeInTheDocument();
    });

    const topicItem = screen.getByText("Topic 1").closest("li")!;
    const removeBtn = topicItem.querySelector("button")!;
    await user.click(removeBtn);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("button", { name: "Confirm Remove" }),
    ).not.toBeInTheDocument();
  });

  it("executes topic deletion on confirm", async () => {
    const user = userEvent.setup();
    (api.deleteTopic as jest.Mock).mockResolvedValue(undefined);
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("Topic 1")).toBeInTheDocument();
    });

    // Mock getTopics to return empty after deletion
    (api.getTopics as jest.Mock).mockResolvedValue([]);

    const topicItem = screen.getByText("Topic 1").closest("li")!;
    const removeBtn = topicItem.querySelector("button")!;
    await user.click(removeBtn);

    await user.click(screen.getByRole("button", { name: "Confirm Remove" }));

    await waitFor(() => {
      expect(api.deleteTopic).toHaveBeenCalledWith(1);
    });
  });

  it("shows delete confirmation in expanded history item", async () => {
    const user = userEvent.setup();
    const planWithAssignment: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 3,
      assigned_chapters: 1,
      total_pages: 6,
      assigned_pages: 1,
      completed_assignments: [
        {
          id: 10,
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
    (api.getBookPosition as jest.Mock).mockResolvedValue({
      ...mockPosition,
      total_assignments: 1,
      current_assignment_index: 0,
      current_assignment: planWithAssignment.completed_assignments[0],
    });
    renderSettings();

    // Open history
    await waitFor(() => {
      expect(screen.getByText(/^Reading History/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/^Reading History/));

    // Expand item to show actions — click the history row (not the card)
    const historyRow = document.querySelector(
      ".rd-reading-history__row",
    ) as HTMLElement;
    await user.click(historyRow);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Delete" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      screen.getByRole("button", { name: "Confirm Delete" }),
    ).toBeInTheDocument();
  });

  it("executes assignment deletion on confirm in history", async () => {
    const user = userEvent.setup();
    const planWithAssignment: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 3,
      assigned_chapters: 1,
      total_pages: 6,
      assigned_pages: 1,
      completed_assignments: [
        {
          id: 10,
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
    (api.getReadingPlan as jest.Mock)
      .mockResolvedValueOnce(planWithAssignment)
      .mockResolvedValue({ ...mockPlan, completed_assignments: [] });
    (api.deleteAssignment as jest.Mock).mockResolvedValue(undefined);
    (api.getBookPosition as jest.Mock).mockResolvedValue({
      ...mockPosition,
      total_assignments: 1,
      current_assignment_index: 0,
      current_assignment: planWithAssignment.completed_assignments[0],
    });
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/^Reading History/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/^Reading History/));

    const historyRow = document.querySelector(
      ".rd-reading-history__row",
    ) as HTMLElement;
    await user.click(historyRow);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Delete" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(api.deleteAssignment).toHaveBeenCalledWith(10);
    });
  });

  it("shows current marker in reading history", async () => {
    const planWithAssignments: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 3,
      assigned_chapters: 2,
      total_pages: 20,
      assigned_pages: 18,
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
              title: "Chapter 1",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: null,
        },
        {
          id: 2,
          assignment_order: 2,
          chapters: [
            {
              id: 2,
              order: 2,
              start_page: "11",
              end_page: "20",
              title: "Chapter 2",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: null,
        },
      ],
    };
    const positionWithAssignments: BookPosition = {
      ...mockPosition,
      total_assignments: 2,
      current_assignment_index: 0,
      current_assignment: planWithAssignments.completed_assignments[0],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithAssignments);
    (api.getBookPosition as jest.Mock).mockResolvedValue(
      positionWithAssignments,
    );
    renderSettings();

    // Open history
    await waitFor(() => {
      expect(screen.getByText(/^Reading History/)).toBeInTheDocument();
    });
    await userEvent.setup().click(screen.getByText(/^Reading History/));

    expect(screen.getByText(/Current:/)).toBeInTheDocument();
  });

  it("shows Set as Current in expanded non-current history item", async () => {
    const user = userEvent.setup();
    const planWithAssignments: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 3,
      assigned_chapters: 2,
      total_pages: 20,
      assigned_pages: 18,
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
              title: "Chapter 1",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: null,
        },
        {
          id: 2,
          assignment_order: 2,
          chapters: [
            {
              id: 2,
              order: 2,
              start_page: "11",
              end_page: "20",
              title: "Chapter 2",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: null,
        },
      ],
    };
    const positionWithAssignments: BookPosition = {
      ...mockPosition,
      total_assignments: 2,
      current_assignment_index: 0,
      current_assignment: planWithAssignments.completed_assignments[0],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithAssignments);
    (api.getBookPosition as jest.Mock).mockResolvedValue(
      positionWithAssignments,
    );
    (api.setBookPosition as jest.Mock).mockResolvedValue({
      ...positionWithAssignments,
      current_assignment_index: 1,
    });
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/^Reading History/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/^Reading History/));

    // Expand the second (non-current) item
    await user.click(screen.getByText(/Chapter 2/));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Set as Current" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Set as Current" }));

    await waitFor(() => {
      expect(api.setBookPosition).toHaveBeenCalledWith(1);
    });
  });

  it("shows cycle number in reading history summary", async () => {
    const planWithAssignments: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 1,
      assigned_chapters: 1,
      total_pages: 10,
      assigned_pages: 9,
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
              title: "Ch 1",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: null,
        },
      ],
    };
    const positionWithCycle: BookPosition = {
      ...mockPosition,
      total_assignments: 1,
      book_cycle: 3,
      current_assignment_index: 0,
      current_assignment: planWithAssignments.completed_assignments[0],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planWithAssignments);
    (api.getBookPosition as jest.Mock).mockResolvedValue(positionWithCycle);
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/Cycle 3/)).toBeInTheDocument();
    });
  });

  it("shows Restart Book when all chapters assigned", async () => {
    const planAllAssigned: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 1,
      assigned_chapters: 1,
      total_pages: 10,
      assigned_pages: 9,
      unassigned_chapters: [],
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
              title: "Ch 1",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: null,
        },
      ],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planAllAssigned);
    (api.getBookPosition as jest.Mock).mockResolvedValue({
      ...mockPosition,
      total_assignments: 1,
      current_assignment_index: 0,
      current_assignment: planAllAssigned.completed_assignments[0],
    });
    renderSettings();

    // History is visible because there are completed assignments
    await waitFor(() => {
      expect(screen.getByText(/^Reading History/)).toBeInTheDocument();
    });
    await userEvent.setup().click(screen.getByText(/^Reading History/));

    expect(
      screen.getByRole("button", { name: "Restart Book" }),
    ).toBeInTheDocument();
  });

  it("calls restartBook on Restart Book confirm", async () => {
    const user = userEvent.setup();
    const planAllAssigned: ReadingPlanStatus = {
      ...mockPlan,
      total_chapters: 1,
      assigned_chapters: 1,
      total_pages: 10,
      assigned_pages: 9,
      unassigned_chapters: [],
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
              title: "Ch 1",
              page_count: 9,
            },
          ],
          total_pages: 9,
          meeting_date: null,
        },
      ],
    };
    (api.getReadingPlan as jest.Mock).mockResolvedValue(planAllAssigned);
    (api.getBookPosition as jest.Mock).mockResolvedValue({
      ...mockPosition,
      total_assignments: 1,
      current_assignment_index: 0,
      current_assignment: planAllAssigned.completed_assignments[0],
    });
    (api.restartBook as jest.Mock).mockResolvedValue({
      ...mockPosition,
      book_cycle: 2,
    });
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/^Reading History/)).toBeInTheDocument();
    });
    await user.click(screen.getByText(/^Reading History/));

    await user.click(screen.getByRole("button", { name: "Restart Book" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Confirm Restart" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Confirm Restart" }));

    await waitFor(() => {
      expect(api.restartBook).toHaveBeenCalledTimes(1);
    });
  });

  describe("invite members section", () => {
    it("shows Generate Invite Code button when no code exists", async () => {
      renderSettings();
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Generate Invite Code" }),
        ).toBeInTheDocument();
      });
    });

    it("shows invite code with Copy and Revoke when code exists", async () => {
      (api.getSettings as jest.Mock).mockResolvedValue({
        ...mockSettings,
        invite_code: "ABC12345",
      });
      renderSettings();
      await waitFor(() => {
        expect(screen.getByText("ABC12345")).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Revoke" }),
      ).toBeInTheDocument();
    });

    it("generates invite code on button click", async () => {
      const user = userEvent.setup();
      (api.generateInviteCode as jest.Mock).mockResolvedValue({
        invite_code: "XYZ98765",
      });
      renderSettings();
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Generate Invite Code" }),
        ).toBeInTheDocument();
      });
      await user.click(
        screen.getByRole("button", { name: "Generate Invite Code" }),
      );
      await waitFor(() => {
        expect(api.generateInviteCode).toHaveBeenCalledTimes(1);
      });
    });

    it("revokes invite code on Revoke click", async () => {
      const user = userEvent.setup();
      (api.getSettings as jest.Mock).mockResolvedValue({
        ...mockSettings,
        invite_code: "ABC12345",
      });
      (api.revokeInviteCode as jest.Mock).mockResolvedValue(undefined);
      renderSettings();
      await waitFor(() => {
        expect(screen.getByText("ABC12345")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: "Revoke" }));
      await waitFor(() => {
        expect(api.revokeInviteCode).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("rotation cap and labels (#81, #82)", () => {
    it("hides Add button when rotation has 5 positions", async () => {
      (api.getSettings as jest.Mock).mockResolvedValue({
        ...mockSettings,
        format_rotation: ["Speaker", "Topic", "Book Study", "Topic", "Speaker"],
      });
      renderSettings();
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Format Rotation" }),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByRole("button", { name: /^\+ Add/ }),
      ).not.toBeInTheDocument();
    });

    it("shows Add button when rotation has fewer than 5 positions", async () => {
      renderSettings();
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Format Rotation" }),
        ).toBeInTheDocument();
      });
      // mockSettings has 3 positions
      expect(
        screen.getByRole("button", { name: /^\+ Add/ }),
      ).toBeInTheDocument();
    });

    it("labels rotation slots with ordinal day names", async () => {
      // meeting_day=6 is Sunday
      renderSettings();
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Format Rotation" }),
        ).toBeInTheDocument();
      });
      expect(screen.getByText("1st Sunday")).toBeInTheDocument();
      expect(screen.getByText("2nd Sunday")).toBeInTheDocument();
      expect(screen.getByText("3rd Sunday")).toBeInTheDocument();
    });

    it("uses correct day name for different meeting days", async () => {
      (api.getSettings as jest.Mock).mockResolvedValue({
        ...mockSettings,
        meeting_day: 2, // Wednesday
        format_rotation: ["Speaker", "Topic"],
      });
      renderSettings();
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Format Rotation" }),
        ).toBeInTheDocument();
      });
      expect(screen.getByText("1st Wednesday")).toBeInTheDocument();
      expect(screen.getByText("2nd Wednesday")).toBeInTheDocument();
    });

    it("shows next ordinal in Add button text", async () => {
      renderSettings();
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Format Rotation" }),
        ).toBeInTheDocument();
      });
      // 3 positions, meeting_day=6 (Sunday), next would be 4th
      expect(
        screen.getByRole("button", { name: "+ Add 4th Sunday" }),
      ).toBeInTheDocument();
    });

    it("updates 5th-week note with ordinal day language", async () => {
      renderSettings();
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Format Rotation" }),
        ).toBeInTheDocument();
      });
      expect(screen.getByText(/5th Sunday/)).toBeInTheDocument();
    });
  });
});
