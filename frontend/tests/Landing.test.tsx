/** Tests for Landing page component with cancel/restore functionality. */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as api from "../src/api/index";
import { ToastProvider } from "../src/contexts/ToastContext";
import { Landing } from "../src/pages/Landing";
import type { UpcomingMeeting } from "../src/types/index";

jest.mock("../src/api/index", () => ({
  getUpcomingMeeting: jest.fn(),
  getUpcomingMeetings: jest.fn(),
  getSpeakerNames: jest.fn(),
  getUpcomingSpeakerDates: jest.fn(),
  drawTopic: jest.fn(),
  undoTopicDraw: jest.fn(),
  scheduleSpeaker: jest.fn(),
  unscheduleSpeaker: jest.fn(),
  cancelMeeting: jest.fn(),
  updateAttendance: jest.fn(),
}));

function renderLanding(): void {
  render(
    <ToastProvider>
      <Landing />
    </ToastProvider>,
  );
}

const getUpcomingMeeting = api.getUpcomingMeeting as jest.Mock;
const getUpcomingMeetings = api.getUpcomingMeetings as jest.Mock;
const getSpeakerNames = api.getSpeakerNames as jest.Mock;
const getUpcomingSpeakerDates = api.getUpcomingSpeakerDates as jest.Mock;
const drawTopic = api.drawTopic as jest.Mock;
const undoTopicDraw = api.undoTopicDraw as jest.Mock;
const cancelMeeting = api.cancelMeeting as jest.Mock;
const scheduleSpeaker = api.scheduleSpeaker as jest.Mock;
const unscheduleSpeaker = api.unscheduleSpeaker as jest.Mock;
const updateAttendance = api.updateAttendance as jest.Mock;

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
  attendance_count: null,
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
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      cancelMeeting.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Cancel Meeting" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Cancel Meeting" }));

      await waitFor(() => {
        expect(cancelMeeting).toHaveBeenCalledWith("2026-02-22", true);
      });

      // Verify refresh() was called after cancel (initial load + post-cancel)
      await waitFor(() => {
        expect(getUpcomingMeeting).toHaveBeenCalledTimes(2);
      });
    });

    it("disables Cancel Meeting button during API call", async () => {
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

      fireEvent.click(screen.getByRole("button", { name: "Cancel Meeting" }));

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
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      cancelMeeting.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Restore Meeting" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Restore Meeting" }));

      await waitFor(() => {
        expect(cancelMeeting).toHaveBeenCalledWith("2026-02-22", false);
      });

      // Verify refresh() was called after restore (initial load + post-restore)
      await waitFor(() => {
        expect(getUpcomingMeeting).toHaveBeenCalledTimes(2);
      });
    });

    it("disables Restore Meeting button during API call", async () => {
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

      fireEvent.click(screen.getByRole("button", { name: "Restore Meeting" }));

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
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      undoTopicDraw.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Undo" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(undoTopicDraw).toHaveBeenCalled();
      });
    });

    it("calls undoTopicDraw then drawTopic when Re-draw is clicked", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      undoTopicDraw.mockResolvedValue({});
      drawTopic.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Re-draw" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Re-draw" }));

      await waitFor(() => {
        expect(undoTopicDraw).toHaveBeenCalled();
        expect(drawTopic).toHaveBeenCalled();
      });
    });

    it("shows toast when undo fails", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      undoTopicDraw.mockRejectedValue(new Error("Undo failed"));
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Undo" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));

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
      getUpcomingMeeting.mockResolvedValue(speakerMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Edit speaker" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Edit speaker" }));

      const input = screen.getByPlaceholderText("Speaker name");
      expect(input).toHaveValue("Jane Doe");
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });

    it("calls scheduleSpeaker with new name on edit submit", async () => {
      getUpcomingMeeting.mockResolvedValue(speakerMeeting);
      scheduleSpeaker.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Edit speaker" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Edit speaker" }));
      fireEvent.change(screen.getByPlaceholderText("Speaker name"), {
        target: { value: "John Smith" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(scheduleSpeaker).toHaveBeenCalledWith(
          "2026-02-22",
          "John Smith",
        );
      });
    });

    it("calls unscheduleSpeaker when Remove is clicked", async () => {
      getUpcomingMeeting.mockResolvedValue(speakerMeeting);
      unscheduleSpeaker.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Remove speaker" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Remove speaker" }));

      await waitFor(() => {
        expect(unscheduleSpeaker).toHaveBeenCalledWith("2026-02-22");
      });
    });

    it("renders datalist with speaker name options when form is shown", async () => {
      getSpeakerNames.mockResolvedValue(["Alice", "Bob", "Zara"]);
      getUpcomingMeeting.mockResolvedValue(speakerMeetingNoSpeaker);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Schedule Speaker" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Schedule Speaker" }));

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
      getUpcomingMeeting.mockResolvedValue(speakerMeeting);
      unscheduleSpeaker.mockRejectedValue(new Error("Remove failed"));
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Remove speaker" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Remove speaker" }));

      await waitFor(() => {
        expect(screen.getByText("Remove failed")).toBeInTheDocument();
      });
    });
  });

  describe("attendance tracking", () => {
    it("renders Record Attendance button when no attendance recorded", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Record Attendance" }),
        ).toBeInTheDocument();
      });
    });

    it("shows attendance count when already recorded", async () => {
      getUpcomingMeeting.mockResolvedValue({
        ...baseMeeting,
        attendance_count: 15,
      });
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Attendance: 15")).toBeInTheDocument();
      });
      expect(
        screen.getByRole("button", { name: "Edit attendance" }),
      ).toBeInTheDocument();
    });

    it("calls updateAttendance when saving attendance", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      updateAttendance.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Record Attendance" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Record Attendance" }),
      );
      fireEvent.change(screen.getByPlaceholderText("Attendance"), {
        target: { value: "20" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(updateAttendance).toHaveBeenCalledWith("2026-02-22", 20);
      });
    });

    it("shows error toast for invalid attendance input", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Record Attendance" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Record Attendance" }),
      );
      fireEvent.change(screen.getByPlaceholderText("Attendance"), {
        target: { value: "-5" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(updateAttendance).not.toHaveBeenCalled();
    });

    it("clears attendance by saving empty input", async () => {
      getUpcomingMeeting.mockResolvedValue({
        ...baseMeeting,
        attendance_count: 15,
      });
      updateAttendance.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Attendance: 15")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Edit attendance" }));
      fireEvent.change(screen.getByPlaceholderText("Attendance"), {
        target: { value: "" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(updateAttendance).toHaveBeenCalledWith("2026-02-22", null);
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
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Assign Speaker" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Assign Speaker" }));

      expect(screen.getByPlaceholderText("Speaker name")).toBeInTheDocument();
    });

    it("calls scheduleSpeaker on form submit", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      scheduleSpeaker.mockResolvedValue({});
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Assign Speaker" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Assign Speaker" }));
      fireEvent.change(screen.getByPlaceholderText("Speaker name"), {
        target: { value: "Bob" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

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
  });

  describe("error handling", () => {
    it("shows toast when cancel fails", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      cancelMeeting.mockRejectedValue(new Error("Cancel failed"));
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Cancel Meeting" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Cancel Meeting" }));

      await waitFor(() => {
        expect(screen.getByText("Cancel failed")).toBeInTheDocument();
      });
    });

    it("shows toast when restore fails", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      cancelMeeting.mockRejectedValue(new Error("Restore failed"));
      renderLanding();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Restore Meeting" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Restore Meeting" }));

      await waitFor(() => {
        expect(screen.getByText("Restore failed")).toBeInTheDocument();
      });
    });
  });
});
