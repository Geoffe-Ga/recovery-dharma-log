/** Tests for Landing page component. */

import { render, screen, waitFor } from "@testing-library/react";
import { Landing } from "../src/pages/Landing";
import type { UpcomingMeeting } from "../src/types/index";

const mockMeeting: UpcomingMeeting = {
  meeting_date: "2026-02-22",
  format_type: "Topic",
  topic_name: "Meditation Practices",
  speaker_name: null,
  book_chapter: null,
  topics_remaining: 5,
  topics_total: 10,
  banners: [],
};

import * as api from "../src/api/index";

jest.mock("../src/api/index", () => ({
  getUpcomingMeeting: jest.fn(),
  drawTopic: jest.fn(),
  scheduleSpeaker: jest.fn(),
}));

const getUpcomingMeeting = api.getUpcomingMeeting as jest.Mock;

describe("Landing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders formatted meeting date", async () => {
    getUpcomingMeeting.mockResolvedValue(mockMeeting);
    render(<Landing />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        "Sunday, February 22",
      );
    });
  });

  it("renders topic name when format is Topic", async () => {
    getUpcomingMeeting.mockResolvedValue(mockMeeting);
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
    getUpcomingMeeting.mockResolvedValue(mockMeeting);
    render(<Landing />);

    await waitFor(() => {
      expect(screen.getByText("Topic")).toBeInTheDocument();
    });
  });

  it("renders deck status for topic format", async () => {
    getUpcomingMeeting.mockResolvedValue(mockMeeting);
    render(<Landing />);

    await waitFor(() => {
      expect(
        screen.getByText("5 of 10 topics remain in deck"),
      ).toBeInTheDocument();
    });
  });

  it("renders banners when present", async () => {
    getUpcomingMeeting.mockResolvedValue({
      ...mockMeeting,
      banners: ["Deck reshuffled!"],
    });
    render(<Landing />);

    await waitFor(() => {
      expect(screen.getByText("Deck reshuffled!")).toBeInTheDocument();
    });
  });
});
