/** Tests for Landing page component with cancel/restore functionality. */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import * as api from "../src/api/index";
import { ToastProvider } from "../src/contexts/ToastContext";
import { Landing } from "../src/pages/Landing";
import type { UpcomingMeeting } from "../src/types/index";

jest.mock("../src/api/index", () => ({
  getUpcomingMeeting: jest.fn(),
  getUpcomingMeetings: jest.fn(),
  getSpeakerNames: jest.fn(),
  getUpcomingSpeakerDates: jest.fn(),
  getFormatOverrides: jest.fn(),
  setFormatOverride: jest.fn(),
  deleteFormatOverride: jest.fn(),
  drawTopic: jest.fn(),
  undoTopicDraw: jest.fn(),
  scheduleSpeaker: jest.fn(),
  unscheduleSpeaker: jest.fn(),
  cancelMeeting: jest.fn(),
  updateDana: jest.fn(),
  getBookPosition: jest.fn(),
  advanceBook: jest.fn(),
}));

function renderLanding(): void {
  render(
    <MemoryRouter>
      <ToastProvider>
        <Landing />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const getUpcomingMeeting = api.getUpcomingMeeting as jest.Mock;
const getUpcomingMeetings = api.getUpcomingMeetings as jest.Mock;
const getSpeakerNames = api.getSpeakerNames as jest.Mock;
const getUpcomingSpeakerDates = api.getUpcomingSpeakerDates as jest.Mock;
const getFormatOverrides = api.getFormatOverrides as jest.Mock;
const setFormatOverride = api.setFormatOverride as jest.Mock;
const deleteFormatOverride = api.deleteFormatOverride as jest.Mock;
const drawTopic = api.drawTopic as jest.Mock;
const undoTopicDraw = api.undoTopicDraw as jest.Mock;
const cancelMeeting = api.cancelMeeting as jest.Mock;
const scheduleSpeaker = api.scheduleSpeaker as jest.Mock;
const unscheduleSpeaker = api.unscheduleSpeaker as jest.Mock;
const updateDana = api.updateDana as jest.Mock;
const getBookPosition = api.getBookPosition as jest.Mock;
const advanceBook = api.advanceBook as jest.Mock;

const lookaheadMeetings = [
  {
    meeting_date: "2026-02-22",
    meeting_time: "18:00:00",
    format_type: "Topic",
    is_cancelled: false,
  },
  {
    meeting_date: "2026-03-01",
    meeting_time: "18:00:00",
    format_type: "Speaker",
    is_cancelled: false,
  },
  {
    meeting_date: "2026-03-08",
    meeting_time: "18:00:00",
    format_type: "Book Study",
    is_cancelled: false,
  },
  {
    meeting_date: "2026-03-15",
    meeting_time: "18:00:00",
    format_type: "Topic",
    is_cancelled: false,
  },
];

const baseMeeting: UpcomingMeeting = {
  meeting_date: "2026-02-22",
  format_type: "Topic",
  topic_name: "Meditation Practices",
  speaker_name: null,
  book_chapter: null,
  topics_remaining: 5,
  topics_total: 10,
  banners: [],
  meeting_time: "18:00:00",
  is_cancelled: false,
  dana_amount: null,
};

const cancelledMeeting: UpcomingMeeting = {
  ...baseMeeting,
  is_cancelled: true,
};

const speakerMeeting: UpcomingMeeting = {
  ...baseMeeting,
  format_type: "Speaker",
  topic_name: null,
  speaker_name: "Jane Doe",
  topics_remaining: 0,
  topics_total: 0,
};

const speakerMeetingNoSpeaker: UpcomingMeeting = {
  ...speakerMeeting,
  speaker_name: null,
};

const bookPositionData = {
  current_assignment_index: 2,
  book_cycle: 1,
  total_assignments: 5,
  current_assignment: {
    id: 3,
    assignment_order: 3,
    chapters: [
      {
        id: 5,
        order: 5,
        start_page: "41",
        end_page: "50",
        title: "Chapter 5",
        page_count: 9,
      },
    ],
    total_pages: 9,
    meeting_date: "2026-03-01",
  },
  chapter_marker: null,
};

const speakerScheduleData = [
  { meeting_date: "2026-03-01", speaker_name: "Alice" },
  { meeting_date: "2026-03-29", speaker_name: null },
];

describe("Landing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUpcomingMeetings.mockResolvedValue(lookaheadMeetings);
    getSpeakerNames.mockResolvedValue([]);
    getUpcomingSpeakerDates.mockResolvedValue(speakerScheduleData);
    getFormatOverrides.mockResolvedValue([]);
    getBookPosition.mockResolvedValue(bookPositionData);
  });

  it("renders formatted meeting date", async () => {
    getUpcomingMeeting.mockResolvedValue(baseMeeting);
    renderLanding();

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        "Sunday, February 22",
      );
    });
  });

  it("renders meeting time when present", async () => {
    getUpcomingMeeting.mockResolvedValue(baseMeeting);
    renderLanding();

    await waitFor(() => {
      expect(screen.getByText(/at 6:00 PM/)).toBeInTheDocument();
    });
  });

  it("omits meeting time when null", async () => {
    getUpcomingMeeting.mockResolvedValue({
      ...baseMeeting,
      meeting_time: null,
    });
    renderLanding();

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    });
    expect(screen.queryByText(/at \d/)).not.toBeInTheDocument();
  });

  it("renders topic name when format is Topic", async () => {
    getUpcomingMeeting.mockResolvedValue(baseMeeting);
    renderLanding();

    await waitFor(() => {
      expect(screen.getByText("Meditation Practices")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    getUpcomingMeeting.mockReturnValue(new Promise(() => {}));
    renderLanding();
    expect(screen.getByLabelText("Loading content")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading content")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("shows error message on API failure", async () => {
    getUpcomingMeeting.mockRejectedValue(new Error("Network error"));
    renderLanding();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });

  it("shows no meeting message when null", async () => {
    getUpcomingMeeting.mockResolvedValue(null);
    renderLanding();

    await waitFor(() => {
      expect(
        screen.getByText("No upcoming meeting found."),
      ).toBeInTheDocument();
    });
  });

  it("renders format badge", async () => {
    getUpcomingMeeting.mockResolvedValue(baseMeeting);
    renderLanding();

    await waitFor(() => {
      const badge = screen.getByText("Topic", {
        selector: ".rd-format-badge",
      });
      expect(badge).toBeInTheDocument();
    });
  });

  it("renders deck meter for topic format", async () => {
    getUpcomingMeeting.mockResolvedValue(baseMeeting);
    renderLanding();

    await waitFor(() => {
      expect(screen.getByText("5 of 10 topics remain")).toBeInTheDocument();
    });
    const progressbar = screen.getByRole("progressbar", {
      name: "Topics remaining in deck",
    });
    expect(progressbar).toBeInTheDocument();
    expect(progressbar.style.width).toBe("50%");
  });

  it("renders 0% width when topics_total is zero", async () => {
    getUpcomingMeeting.mockResolvedValue({
      ...baseMeeting,
      topic_name: null,
      topics_remaining: 0,
      topics_total: 0,
    });
    renderLanding();

    await waitFor(() => {
      expect(screen.getByText("0 of 0 topics remain")).toBeInTheDocument();
    });
    const progressbar = screen.getByRole("progressbar", {
      name: "Topics remaining in deck",
    });
    expect(progressbar.style.width).toBe("0%");
  });

  it("renders banners when present", async () => {
    getUpcomingMeeting.mockResolvedValue({
      ...baseMeeting,
      banners: ["Deck reshuffled!"],
    });
    renderLanding();

    await waitFor(() => {
      expect(screen.getByText("Deck reshuffled!")).toBeInTheDocument();
    });
  });

  describe("active meeting", () => {
    it("renders format badge and topic content", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        const badge = screen.getByText("Topic", {
          selector: ".rd-format-badge",
        });
        expect(badge).toBeInTheDocument();
        expect(screen.getByText("Meditation Practices")).toBeInTheDocument();
      });
    });

    it("renders Cancel Meeting button", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Cancel Meeting" }),
        ).toBeInTheDocument();
      });
    });

    it("does not show Restore Meeting button", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByText("Topic", { selector: ".rd-format-badge" }),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByRole("button", { name: "Restore Meeting" }),
      ).not.toBeInTheDocument();
    });

    it("calls cancelMeeting with is_cancelled=true when Cancel clicked", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      cancelMeeting.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Cancel Meeting" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Cancel Meeting" }));

      await waitFor(() => {
        expect(cancelMeeting).toHaveBeenCalledWith("2026-02-22", true);
      });

      // Verify refresh() was called after cancel (initial load + post-cancel)
      await waitFor(() => {
        expect(getUpcomingMeeting).toHaveBeenCalledTimes(2);
      });
    });

    it("disables Cancel Meeting button during API call", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      let resolveCancel!: (value: unknown) => void;
      cancelMeeting.mockReturnValue(
        new Promise((r) => {
          resolveCancel = r;
        }),
      );
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Cancel Meeting" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Cancel Meeting" }));

      expect(
        screen.getByRole("button", { name: "Cancel Meeting" }),
      ).toBeDisabled();

      resolveCancel({});

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Cancel Meeting" }),
        ).not.toBeDisabled();
      });

      await waitFor(() => {
        expect(getUpcomingMeeting).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("cancelled meeting", () => {
    it("shows Cancelled badge instead of format type", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Cancelled")).toBeInTheDocument();
      });
      expect(
        screen.queryByText("Topic", { selector: ".rd-format-badge" }),
      ).not.toBeInTheDocument();
    });

    it("shows cancellation message", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByText("This meeting has been cancelled."),
        ).toBeInTheDocument();
      });
    });

    it("shows Restore Meeting button", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Restore Meeting" }),
        ).toBeInTheDocument();
      });
    });

    it("hides format-specific content when cancelled", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Cancelled")).toBeInTheDocument();
      });
      expect(
        screen.queryByText("Meditation Practices"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("progressbar", {
          name: "Topics remaining in deck",
        }),
      ).not.toBeInTheDocument();
    });

    it("applies rd-cancelled class to article", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      renderLanding();

      await waitFor(() => {
        const article = screen.getByRole("article");
        expect(article).toHaveClass("rd-cancelled");
      });
    });

    it("calls cancelMeeting with is_cancelled=false when Restore clicked", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      cancelMeeting.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Restore Meeting" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Restore Meeting" }));

      await waitFor(() => {
        expect(cancelMeeting).toHaveBeenCalledWith("2026-02-22", false);
      });

      // Verify refresh() was called after restore (initial load + post-restore)
      await waitFor(() => {
        expect(getUpcomingMeeting).toHaveBeenCalledTimes(2);
      });
    });

    it("disables Restore Meeting button during API call", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      let resolveRestore!: (value: unknown) => void;
      cancelMeeting.mockReturnValue(
        new Promise((r) => {
          resolveRestore = r;
        }),
      );
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Restore Meeting" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Restore Meeting" }));

      expect(
        screen.getByRole("button", { name: "Restore Meeting" }),
      ).toBeDisabled();

      resolveRestore({});

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Restore Meeting" }),
        ).not.toBeDisabled();
      });

      await waitFor(() => {
        expect(getUpcomingMeeting).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("lookahead", () => {
    it("shows upcoming meetings section", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Upcoming Meetings")).toBeInTheDocument();
      });
    });

    it("displays next 3 meetings (excludes primary)", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        const lookaheadSection = screen
          .getByText("Upcoming Meetings")
          .closest("section")!;
        expect(lookaheadSection).toHaveTextContent("Sunday, March 1");
        expect(lookaheadSection).toHaveTextContent("Sunday, March 8");
        expect(lookaheadSection).toHaveTextContent("Sunday, March 15");
      });
    });

    it("shows format badges for lookahead meetings", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Speaker")).toBeInTheDocument();
        expect(screen.getByText("Book Study")).toBeInTheDocument();
      });
    });
  });

  describe("topic undo/re-draw", () => {
    it("shows Undo and Re-draw buttons when topic is drawn", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Meditation Practices")).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Re-draw" }),
      ).toBeInTheDocument();
    });

    it("does not show Undo/Re-draw when no topic drawn", async () => {
      getUpcomingMeeting.mockResolvedValue({
        ...baseMeeting,
        topic_name: null,
      });
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Draw Topic" }),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByRole("button", { name: "Undo" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Re-draw" }),
      ).not.toBeInTheDocument();
    });

    it("calls undoTopicDraw when Undo is clicked", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      undoTopicDraw.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Undo" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(undoTopicDraw).toHaveBeenCalled();
      });
    });

    it("calls undoTopicDraw then drawTopic when Re-draw is clicked", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      undoTopicDraw.mockResolvedValue({});
      drawTopic.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Re-draw" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Re-draw" }));

      await waitFor(() => {
        expect(undoTopicDraw).toHaveBeenCalled();
        expect(drawTopic).toHaveBeenCalled();
      });
    });

    it("shows toast when undo fails", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      undoTopicDraw.mockRejectedValue(new Error("Undo failed"));
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Undo" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(screen.getByText("Undo failed")).toBeInTheDocument();
      });
    });
  });

  describe("speaker management", () => {
    it("shows Edit and Remove buttons when speaker is scheduled", async () => {
      getUpcomingMeeting.mockResolvedValue(speakerMeeting);
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      });
      expect(
        screen.getByRole("button", { name: "Edit speaker" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Remove speaker" }),
      ).toBeInTheDocument();
    });

    it("shows Schedule Speaker button when no speaker scheduled", async () => {
      getUpcomingMeeting.mockResolvedValue(speakerMeetingNoSpeaker);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Schedule Speaker" }),
        ).toBeInTheDocument();
      });
    });

    it("opens edit form pre-filled with current speaker name", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(speakerMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Edit speaker" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Edit speaker" }));

      const input = screen.getByPlaceholderText("Speaker name");
      expect(input).toHaveValue("Jane Doe");
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });

    it("calls scheduleSpeaker with new name on edit submit", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(speakerMeeting);
      scheduleSpeaker.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Edit speaker" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Edit speaker" }));
      await user.clear(screen.getByPlaceholderText("Speaker name"));
      await user.type(
        screen.getByPlaceholderText("Speaker name"),
        "John Smith",
      );
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(scheduleSpeaker).toHaveBeenCalledWith(
          "2026-02-22",
          "John Smith",
        );
      });
    });

    it("calls unscheduleSpeaker when Remove is clicked", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(speakerMeeting);
      unscheduleSpeaker.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Remove speaker" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Remove speaker" }));

      await waitFor(() => {
        expect(unscheduleSpeaker).toHaveBeenCalledWith("2026-02-22");
      });
    });

    it("renders datalist with speaker name options when form is shown", async () => {
      const user = userEvent.setup();
      getSpeakerNames.mockResolvedValue(["Alice", "Bob", "Zara"]);
      getUpcomingMeeting.mockResolvedValue(speakerMeetingNoSpeaker);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Schedule Speaker" }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: "Schedule Speaker" }),
      );

      await waitFor(() => {
        expect(getSpeakerNames).toHaveBeenCalled();
      });

      await waitFor(() => {
        const datalist = document.getElementById("speaker-names");
        expect(datalist).toBeInTheDocument();
        const options = datalist!.querySelectorAll("option");
        expect(options).toHaveLength(3);
        expect(options[0]).toHaveAttribute("value", "Alice");
        expect(options[1]).toHaveAttribute("value", "Bob");
        expect(options[2]).toHaveAttribute("value", "Zara");
      });
    });

    it("shows toast on remove failure", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(speakerMeeting);
      unscheduleSpeaker.mockRejectedValue(new Error("Remove failed"));
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Remove speaker" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Remove speaker" }));

      await waitFor(() => {
        expect(screen.getByText("Remove failed")).toBeInTheDocument();
      });
    });
  });

  describe("dana tracking", () => {
    it("renders Record Dana button when no dana recorded", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Record Dana" }),
        ).toBeInTheDocument();
      });
    });

    it("shows dana amount when already recorded", async () => {
      getUpcomingMeeting.mockResolvedValue({
        ...baseMeeting,
        dana_amount: 15.5,
      });
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Dana: $15.50")).toBeInTheDocument();
      });
      expect(
        screen.getByRole("button", { name: "Edit dana" }),
      ).toBeInTheDocument();
    });

    it("calls updateDana when saving dana", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      updateDana.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Record Dana" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Record Dana" }));
      await user.type(screen.getByPlaceholderText("0.00"), "20.00");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(updateDana).toHaveBeenCalledWith("2026-02-22", 20);
      });
    });

    it("shows error toast for invalid dana input", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Record Dana" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Record Dana" }));
      await user.type(screen.getByPlaceholderText("0.00"), "-5");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(updateDana).not.toHaveBeenCalled();
    });

    it("clears dana by saving empty input", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue({
        ...baseMeeting,
        dana_amount: 15.5,
      });
      updateDana.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Dana: $15.50")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Edit dana" }));
      await user.clear(screen.getByPlaceholderText("0.00"));
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(updateDana).toHaveBeenCalledWith("2026-02-22", null);
      });
    });
  });

  describe("speaker schedule", () => {
    it("shows Speaker Schedule section with upcoming speaker dates", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Speaker Schedule")).toBeInTheDocument();
      });
    });

    it("displays assigned speaker names", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });
    });

    it("shows Assign Speaker button for open dates", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Assign Speaker" }),
        ).toBeInTheDocument();
      });
    });

    it("opens inline form when Assign Speaker is clicked", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Assign Speaker" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Assign Speaker" }));

      expect(screen.getByPlaceholderText("Speaker name")).toBeInTheDocument();
    });

    it("calls scheduleSpeaker on form submit", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      scheduleSpeaker.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Assign Speaker" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Assign Speaker" }));
      await user.type(screen.getByPlaceholderText("Speaker name"), "Bob");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(scheduleSpeaker).toHaveBeenCalledWith("2026-03-29", "Bob");
      });
    });

    it("hides section when no speaker dates returned", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      getUpcomingSpeakerDates.mockResolvedValue([]);
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Upcoming Meetings")).toBeInTheDocument();
      });
      expect(screen.queryByText("Speaker Schedule")).not.toBeInTheDocument();
    });

    it("renders assignment form with mobile-friendly flex class", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Assign Speaker" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Assign Speaker" }));

      const input = screen.getByPlaceholderText("Speaker name");
      const form = input.closest("form");
      expect(form).toHaveClass("rd-speaker-schedule__form");
    });
  });

  describe("format overrides", () => {
    it("shows format badges as clickable buttons in lookahead", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        const speakerBtn = screen.getByRole("button", {
          name: "Change format for Sunday, March 1",
        });
        expect(speakerBtn).toBeInTheDocument();
      });
    });

    it("opens override dropdown when format badge is clicked", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: "Change format for Sunday, March 1",
          }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", {
          name: "Change format for Sunday, March 1",
        }),
      );

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });
    });

    it("shows alternative format options (excludes current)", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: "Change format for Sunday, March 1",
          }),
        ).toBeInTheDocument();
      });

      // March 1 is Speaker format, so dropdown should show Topic and Book Study
      await user.click(
        screen.getByRole("button", {
          name: "Change format for Sunday, March 1",
        }),
      );

      await waitFor(() => {
        const menuItems = screen.getAllByRole("menuitem");
        const labels = menuItems.map((item) => item.textContent);
        expect(labels).toContain("Topic");
        expect(labels).toContain("Book Study");
        expect(labels).not.toContain("Speaker");
      });
    });

    it("calls setFormatOverride when option is selected", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      setFormatOverride.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: "Change format for Sunday, March 1",
          }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", {
          name: "Change format for Sunday, March 1",
        }),
      );

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("menuitem", { name: "Topic" }));

      await waitFor(() => {
        expect(setFormatOverride).toHaveBeenCalledWith("2026-03-01", "Topic");
      });
    });

    it("shows Reset to rotation option when override exists", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      getFormatOverrides.mockResolvedValue([
        { id: 1, meeting_date: "2026-03-01", format_type: "Topic" },
      ]);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: "Change format for Sunday, March 1",
          }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", {
          name: "Change format for Sunday, March 1",
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("menuitem", { name: "Reset to rotation" }),
        ).toBeInTheDocument();
      });
    });

    it("calls deleteFormatOverride when Reset to rotation is clicked", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      getFormatOverrides.mockResolvedValue([
        { id: 1, meeting_date: "2026-03-01", format_type: "Topic" },
      ]);
      deleteFormatOverride.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: "Change format for Sunday, March 1",
          }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", {
          name: "Change format for Sunday, March 1",
        }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("menuitem", { name: "Reset to rotation" }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("menuitem", { name: "Reset to rotation" }),
      );

      await waitFor(() => {
        expect(deleteFormatOverride).toHaveBeenCalledWith("2026-03-01");
      });
    });

    it("closes dropdown when badge is clicked again", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: "Change format for Sunday, March 1",
          }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", {
          name: "Change format for Sunday, March 1",
        }),
      );

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", {
          name: "Change format for Sunday, March 1",
        }),
      );

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("disables format badge button when meeting is cancelled", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      getUpcomingMeetings.mockResolvedValue([
        lookaheadMeetings[0],
        { ...lookaheadMeetings[1], is_cancelled: true },
        lookaheadMeetings[2],
        lookaheadMeetings[3],
      ]);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {
            name: "Change format for Sunday, March 1",
          }),
        ).toBeDisabled();
      });
    });
  });

  describe("book study section", () => {
    const bookStudyMeeting: UpcomingMeeting = {
      ...baseMeeting,
      format_type: "Book Study",
      topic_name: null,
      topics_remaining: 0,
      topics_total: 0,
      book_chapter: "Chapter 5 (pp. 41\u201350, 9 pages)",
    };

    it("shows book chapter and position info", async () => {
      getUpcomingMeeting.mockResolvedValue(bookStudyMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByText("Chapter 5 (pp. 41\u201350, 9 pages)"),
        ).toBeInTheDocument();
      });
      expect(screen.getByText(/Cycle 1 — Reading 3 of 5/)).toBeInTheDocument();
    });

    it("shows Next Reading button", async () => {
      getUpcomingMeeting.mockResolvedValue(bookStudyMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Next Reading" }),
        ).toBeInTheDocument();
      });
    });

    it("calls advanceBook when Next Reading is clicked", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(bookStudyMeeting);
      advanceBook.mockResolvedValue({
        ...bookPositionData,
        current_assignment_index: 3,
      });
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Next Reading" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Next Reading" }));

      await waitFor(() => {
        expect(advanceBook).toHaveBeenCalled();
      });
    });

    it("shows toast on advance failure", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(bookStudyMeeting);
      advanceBook.mockRejectedValue(new Error("Advance failed"));
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Next Reading" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Next Reading" }));

      await waitFor(() => {
        expect(screen.getByText("Advance failed")).toBeInTheDocument();
      });
    });

    it("shows nudge when no reading is queued", async () => {
      const noBookMeeting: UpcomingMeeting = {
        ...bookStudyMeeting,
        book_chapter: null,
      };
      getUpcomingMeeting.mockResolvedValue(noBookMeeting);
      getBookPosition.mockResolvedValue({
        ...bookPositionData,
        total_assignments: 0,
        current_assignment: null,
      });
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByText(/No reading queued for next time/),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByRole("link", { name: /set one up in Settings/ }),
      ).toHaveAttribute("href", "/settings#reading-plan");
    });

    it("hides position info when no assignments", async () => {
      getUpcomingMeeting.mockResolvedValue(bookStudyMeeting);
      getBookPosition.mockResolvedValue({
        ...bookPositionData,
        total_assignments: 0,
        current_assignment: null,
      });
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByText("Chapter 5 (pp. 41\u201350, 9 pages)"),
        ).toBeInTheDocument();
      });
      expect(screen.queryByText(/Cycle/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Next Reading" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("shows toast when cancel fails", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      cancelMeeting.mockRejectedValue(new Error("Cancel failed"));
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Cancel Meeting" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Cancel Meeting" }));

      await waitFor(() => {
        expect(screen.getByText("Cancel failed")).toBeInTheDocument();
      });
    });

    it("shows toast when restore fails", async () => {
      const user = userEvent.setup();
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      cancelMeeting.mockRejectedValue(new Error("Restore failed"));
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Restore Meeting" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Restore Meeting" }));

      await waitFor(() => {
        expect(screen.getByText("Restore failed")).toBeInTheDocument();
      });
    });
  });
});
