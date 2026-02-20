/** Tests for Log page component. */

import { render, screen, waitFor } from "@testing-library/react";
import { Log } from "../src/pages/Log";
import type { MeetingLogEntry } from "../src/types/index";

const mockEntries: MeetingLogEntry[] = [
  {
    id: 1,
    meeting_date: "2026-02-08",
    format_type: "Topic",
    content_summary: null,
    speaker_name: null,
    topic_name: "Mindfulness",
    reading_assignment_summary: null,
    is_cancelled: false,
  },
  {
    id: 2,
    meeting_date: "2026-02-15",
    format_type: "Speaker",
    content_summary: null,
    speaker_name: "Jane Doe",
    topic_name: null,
    reading_assignment_summary: null,
    is_cancelled: false,
  },
];

import * as api from "../src/api/index";

jest.mock("../src/api/index", () => ({
  getMeetingLog: jest.fn(),
  getCsvExportUrl: () => "/api/export/csv",
  getPrintableExportUrl: () => "/api/export/printable",
}));

const getMeetingLog = api.getMeetingLog as jest.Mock;

describe("Log", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders formatted dates in the table", async () => {
    getMeetingLog.mockResolvedValue(mockEntries);
    render(<Log />);

    await waitFor(() => {
      expect(screen.getByText("Feb 8, 2026")).toBeInTheDocument();
      expect(screen.getByText("Feb 15, 2026")).toBeInTheDocument();
    });
  });

  it("renders meeting content in the table", async () => {
    getMeetingLog.mockResolvedValue(mockEntries);
    render(<Log />);

    await waitFor(() => {
      expect(screen.getByText("Mindfulness")).toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    getMeetingLog.mockReturnValue(new Promise(() => {}));
    render(<Log />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error message on API failure", async () => {
    getMeetingLog.mockRejectedValue(new Error("Server error"));
    render(<Log />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });

  it("shows empty state when no entries", async () => {
    getMeetingLog.mockResolvedValue([]);
    render(<Log />);

    await waitFor(() => {
      expect(screen.getByText("No meetings recorded yet.")).toBeInTheDocument();
    });
  });

  it("renders export links", async () => {
    getMeetingLog.mockResolvedValue(mockEntries);
    render(<Log />);

    await waitFor(() => {
      expect(screen.getByText("Export CSV")).toBeInTheDocument();
      expect(screen.getByText("Printable View")).toBeInTheDocument();
    });
  });

  it("shows cancelled status for cancelled meetings", async () => {
    getMeetingLog.mockResolvedValue([
      { ...mockEntries[0], is_cancelled: true },
    ]);
    render(<Log />);

    await waitFor(() => {
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });
  });
});
