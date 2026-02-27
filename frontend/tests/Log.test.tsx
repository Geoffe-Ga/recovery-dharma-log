/** Tests for Log page component with filtering and editing. */

import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Log } from "../src/pages/Log";
import { ToastProvider } from "../src/contexts/ToastContext";
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
    attendance_count: 12,
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
    attendance_count: null,
  },
  {
    id: 3,
    meeting_date: "2026-02-22",
    format_type: "Book Study",
    content_summary: "Ch 1-2",
    speaker_name: null,
    topic_name: null,
    reading_assignment_summary: null,
    is_cancelled: false,
    attendance_count: 8,
  },
];

import * as api from "../src/api/index";

jest.mock("../src/api/index", () => {
  const actual = jest.requireActual("../src/api/index");
  return {
    getMeetingLog: jest.fn(),
    updateMeetingLogEntry: jest.fn(),
    getCsvExportUrl: actual.getCsvExportUrl,
    getPrintableExportUrl: actual.getPrintableExportUrl,
  };
});

const getMeetingLog = api.getMeetingLog as jest.Mock;
const updateMeetingLogEntry = api.updateMeetingLogEntry as jest.Mock;

function renderLog(): ReturnType<typeof render> {
  return render(
    <ToastProvider>
      <Log />
    </ToastProvider>,
  );
}

describe("Log", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders formatted dates in the table", async () => {
    getMeetingLog.mockResolvedValue(mockEntries);
    renderLog();

    await waitFor(() => {
      expect(screen.getByText("Feb 8, 2026")).toBeInTheDocument();
      expect(screen.getByText("Feb 15, 2026")).toBeInTheDocument();
    });
  });

  it("renders meeting content in the table", async () => {
    getMeetingLog.mockResolvedValue(mockEntries);
    renderLog();

    await waitFor(() => {
      expect(screen.getByText("Mindfulness")).toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    getMeetingLog.mockReturnValue(new Promise(() => {}));
    renderLog();
    expect(screen.getByLabelText("Loading content")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading content")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("shows error message on API failure", async () => {
    getMeetingLog.mockRejectedValue(new Error("Server error"));
    renderLog();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });

  it("shows empty state when no entries", async () => {
    getMeetingLog.mockResolvedValue([]);
    renderLog();

    await waitFor(() => {
      expect(screen.getByText("No meetings recorded yet.")).toBeInTheDocument();
    });
  });

  it("renders export links", async () => {
    getMeetingLog.mockResolvedValue(mockEntries);
    renderLog();

    await waitFor(() => {
      expect(screen.getByText("Export CSV")).toBeInTheDocument();
      expect(screen.getByText("Printable View")).toBeInTheDocument();
    });
  });

  it("renders attendance column with count value", async () => {
    getMeetingLog.mockResolvedValue(mockEntries);
    renderLog();

    await waitFor(() => {
      expect(screen.getByText("Attendance")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
    });
  });

  it("shows cancelled status for cancelled meetings", async () => {
    getMeetingLog.mockResolvedValue([
      { ...mockEntries[0], is_cancelled: true },
    ]);
    renderLog();

    await waitFor(() => {
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });
  });

  describe("filtering", () => {
    it("filters by format type", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      getMeetingLog.mockResolvedValue(mockEntries);
      renderLog();

      await waitFor(() => {
        expect(screen.getByText("Mindfulness")).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText("Format"), "Speaker");

      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      expect(screen.queryByText("Mindfulness")).not.toBeInTheDocument();
    });

    it("filters by date range", async () => {
      getMeetingLog.mockResolvedValue(mockEntries);
      renderLog();

      await waitFor(() => {
        expect(screen.getByText("Mindfulness")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText("From"), {
        target: { value: "2026-02-14" },
      });

      expect(screen.queryByText("Mindfulness")).not.toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    it("filters by search text with debounce", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      getMeetingLog.mockResolvedValue(mockEntries);
      renderLog();

      await waitFor(() => {
        expect(screen.getByText("Mindfulness")).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText("Search..."), "Jane");

      // Before debounce, all entries still visible
      expect(screen.getByText("Mindfulness")).toBeInTheDocument();

      // After debounce
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(screen.queryByText("Mindfulness")).not.toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    it("shows no matching meetings message", async () => {
      getMeetingLog.mockResolvedValue(mockEntries);
      renderLog();

      await waitFor(() => {
        expect(screen.getByText("Mindfulness")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText("From"), {
        target: { value: "2027-01-01" },
      });

      expect(screen.getByText("No matching meetings.")).toBeInTheDocument();
    });

    it("shows clear filters button when filters active", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      getMeetingLog.mockResolvedValue(mockEntries);
      renderLog();

      await waitFor(() => {
        expect(screen.getByText("Mindfulness")).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText("Format"), "Speaker");

      expect(screen.getByText("Clear Filters")).toBeInTheDocument();
    });

    it("export links include date params when date filters are set", async () => {
      getMeetingLog.mockResolvedValue(mockEntries);
      renderLog();

      await waitFor(() => {
        expect(screen.getByText("Mindfulness")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText("From"), {
        target: { value: "2026-02-10" },
      });
      fireEvent.change(screen.getByLabelText("To"), {
        target: { value: "2026-02-20" },
      });

      const csvLink = screen.getByText("Export CSV").closest("a");
      const printLink = screen.getByText("Printable View").closest("a");

      expect(csvLink).toHaveAttribute(
        "href",
        "/api/export/csv?start_date=2026-02-10&end_date=2026-02-20",
      );
      expect(printLink).toHaveAttribute(
        "href",
        "/api/export/printable?start_date=2026-02-10&end_date=2026-02-20",
      );
    });

    it("export links have no date params when filters are empty", async () => {
      getMeetingLog.mockResolvedValue(mockEntries);
      renderLog();

      await waitFor(() => {
        expect(screen.getByText("Mindfulness")).toBeInTheDocument();
      });

      const csvLink = screen.getByText("Export CSV").closest("a");
      const printLink = screen.getByText("Printable View").closest("a");

      expect(csvLink).toHaveAttribute("href", "/api/export/csv");
      expect(printLink).toHaveAttribute("href", "/api/export/printable");
    });

    it("clears all filters on clear button click", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      getMeetingLog.mockResolvedValue(mockEntries);
      renderLog();

      await waitFor(() => {
        expect(screen.getByText("Mindfulness")).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText("Format"), "Speaker");

      expect(screen.queryByText("Mindfulness")).not.toBeInTheDocument();

      await user.click(screen.getByText("Clear Filters"));

      expect(screen.getByText("Mindfulness")).toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });
  });

  describe("editing", () => {
    it("renders Edit button on each row", async () => {
      getMeetingLog.mockResolvedValue(mockEntries);
      renderLog();

      await waitFor(() => {
        expect(screen.getByText("Mindfulness")).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText("Edit");
      expect(editButtons).toHaveLength(mockEntries.length);
    });

    it("clicking Edit shows inline form with current values", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      getMeetingLog.mockResolvedValue(mockEntries);
      renderLog();

      await waitFor(() => {
        expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText("Edit");
      await user.click(editButtons[1]); // Speaker entry

      expect(screen.getByLabelText("Speaker Name")).toHaveValue("Jane Doe");
      expect(screen.getByLabelText("Notes")).toHaveValue("");
      expect(screen.getByLabelText("Cancelled")).not.toBeChecked();
    });

    it("saving calls updateMeetingLogEntry and updates the row", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      getMeetingLog.mockResolvedValue(mockEntries);
      const updatedEntry = {
        ...mockEntries[1],
        speaker_name: "John Smith",
      };
      updateMeetingLogEntry.mockResolvedValue(updatedEntry);
      renderLog();

      await waitFor(() => {
        expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText("Edit");
      await user.click(editButtons[1]);

      await user.clear(screen.getByLabelText("Speaker Name"));
      await user.type(screen.getByLabelText("Speaker Name"), "John Smith");

      await user.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(updateMeetingLogEntry).toHaveBeenCalledWith(2, {
          speaker_name: "John Smith",
          content_summary: "",
          is_cancelled: false,
        });
      });

      await waitFor(() => {
        expect(screen.getByText("John Smith")).toBeInTheDocument();
      });
    });

    it("clicking Cancel closes the form without saving", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      getMeetingLog.mockResolvedValue(mockEntries);
      renderLog();

      await waitFor(() => {
        expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText("Edit");
      await user.click(editButtons[1]);

      expect(screen.getByLabelText("Speaker Name")).toBeInTheDocument();

      await user.click(screen.getByText("Cancel"));

      expect(screen.queryByLabelText("Speaker Name")).not.toBeInTheDocument();
      expect(updateMeetingLogEntry).not.toHaveBeenCalled();
    });
  });
});
