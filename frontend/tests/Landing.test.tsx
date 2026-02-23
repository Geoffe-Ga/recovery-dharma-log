/** Tests for Landing page component with cancel/restore functionality. */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as api from "../src/api/index";
import { Landing } from "../src/pages/Landing";
import type { UpcomingMeeting } from "../src/types/index";

jest.mock("../src/api/index", () => ({
  getUpcomingMeeting: jest.fn(),
  drawTopic: jest.fn(),
  scheduleSpeaker: jest.fn(),
  cancelMeeting: jest.fn(),
}));

const getUpcomingMeeting = api.getUpcomingMeeting as jest.Mock;
const cancelMeeting = api.cancelMeeting as jest.Mock;

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
};

const cancelledMeeting: UpcomingMeeting = {
  ...baseMeeting,
  is_cancelled: true,
};

describe("Landing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders formatted meeting date", async () => {
    getUpcomingMeeting.mockResolvedValue(baseMeeting);
    render(<Landing />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        "Sunday, February 22",
      );
    });
  });

  it("renders meeting time when present", async () => {
    getUpcomingMeeting.mockResolvedValue(baseMeeting);
    render(<Landing />);

    await waitFor(() => {
      expect(screen.getByText(/at 6:00 PM/)).toBeInTheDocument();
    });
  });

  it("omits meeting time when null", async () => {
    getUpcomingMeeting.mockResolvedValue({
      ...baseMeeting,
      meeting_time: null,
    });
    render(<Landing />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    });
    expect(screen.queryByText(/at \d/)).not.toBeInTheDocument();
  });

  it("renders topic name when format is Topic", async () => {
    getUpcomingMeeting.mockResolvedValue(baseMeeting);
    render(<Landing />);

    await waitFor(() => {
      expect(screen.getByText("Meditation Practices")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    getUpcomingMeeting.mockReturnValue(new Promise(() => {}));
    render(<Landing />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error message on API failure", async () => {
    getUpcomingMeeting.mockRejectedValue(new Error("Network error"));
    render(<Landing />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });

  it("shows no meeting message when null", async () => {
    getUpcomingMeeting.mockResolvedValue(null);
    render(<Landing />);

    await waitFor(() => {
      expect(
        screen.getByText("No upcoming meeting found."),
      ).toBeInTheDocument();
    });
  });

  it("renders format badge", async () => {
    getUpcomingMeeting.mockResolvedValue(baseMeeting);
    render(<Landing />);

    await waitFor(() => {
      expect(screen.getByText("Topic")).toBeInTheDocument();
    });
  });

  it("renders deck status for topic format", async () => {
    getUpcomingMeeting.mockResolvedValue(baseMeeting);
    render(<Landing />);

    await waitFor(() => {
      expect(
        screen.getByText("5 of 10 topics remain in deck"),
      ).toBeInTheDocument();
    });
  });

  it("renders banners when present", async () => {
    getUpcomingMeeting.mockResolvedValue({
      ...baseMeeting,
      banners: ["Deck reshuffled!"],
    });
    render(<Landing />);

    await waitFor(() => {
      expect(screen.getByText("Deck reshuffled!")).toBeInTheDocument();
    });
  });

  describe("active meeting", () => {
    it("renders format badge and topic content", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      render(<Landing />);

      await waitFor(() => {
        expect(screen.getByText("Topic")).toBeInTheDocument();
        expect(screen.getByText("Meditation Practices")).toBeInTheDocument();
      });
    });

    it("renders Cancel Meeting button", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      render(<Landing />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Cancel Meeting" }),
        ).toBeInTheDocument();
      });
    });

    it("does not show Restore Meeting button", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      render(<Landing />);

      await waitFor(() => {
        expect(screen.getByText("Topic")).toBeInTheDocument();
      });
      expect(
        screen.queryByRole("button", { name: "Restore Meeting" }),
      ).not.toBeInTheDocument();
    });

    it("calls cancelMeeting with is_cancelled=true when Cancel clicked", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      cancelMeeting.mockResolvedValue({});
      render(<Landing />);

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
  });

  describe("cancelled meeting", () => {
    it("shows Cancelled badge instead of format type", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      render(<Landing />);

      await waitFor(() => {
        expect(screen.getByText("Cancelled")).toBeInTheDocument();
      });
      expect(screen.queryByText("Topic")).not.toBeInTheDocument();
    });

    it("shows cancellation message", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      render(<Landing />);

      await waitFor(() => {
        expect(
          screen.getByText("This meeting has been cancelled."),
        ).toBeInTheDocument();
      });
    });

    it("shows Restore Meeting button", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      render(<Landing />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Restore Meeting" }),
        ).toBeInTheDocument();
      });
    });

    it("hides format-specific content when cancelled", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      render(<Landing />);

      await waitFor(() => {
        expect(screen.getByText("Cancelled")).toBeInTheDocument();
      });
      expect(
        screen.queryByText("Meditation Practices"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/topics remain in deck/),
      ).not.toBeInTheDocument();
    });

    it("applies rd-cancelled class to article", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      render(<Landing />);

      await waitFor(() => {
        const article = screen.getByRole("article");
        expect(article).toHaveClass("rd-cancelled");
      });
    });

    it("calls cancelMeeting with is_cancelled=false when Restore clicked", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      cancelMeeting.mockResolvedValue({});
      render(<Landing />);

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
  });

  describe("error handling", () => {
    it("shows error when cancel fails", async () => {
      getUpcomingMeeting.mockResolvedValue(baseMeeting);
      cancelMeeting.mockRejectedValue(new Error("Cancel failed"));
      render(<Landing />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Cancel Meeting" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Cancel Meeting" }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Cancel failed");
      });
    });

    it("shows error when restore fails", async () => {
      getUpcomingMeeting.mockResolvedValue(cancelledMeeting);
      cancelMeeting.mockRejectedValue(new Error("Restore failed"));
      render(<Landing />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Restore Meeting" }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Restore Meeting" }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Restore failed");
      });
    });
  });
});
