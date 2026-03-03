/** Tests for Setup wizard component. */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Setup } from "../src/pages/Setup";
import type { BookChapter } from "../src/types/index";

jest.mock("../src/api/index", () => ({
  getChapters: jest.fn(),
  setupBasics: jest.fn(),
  setupRotation: jest.fn(),
  setupTopics: jest.fn(),
  setupBookPosition: jest.fn(),
  setupComplete: jest.fn(),
}));

import * as api from "../src/api/index";

const mockChapters: BookChapter[] = [
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
  {
    id: 3,
    order: 3,
    start_page: "XIII",
    end_page: "XV",
    title: "Where to Begin",
    page_count: 2,
  },
];

function renderSetup(
  onComplete = jest.fn(),
): ReturnType<typeof userEvent.setup> {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <Setup onComplete={onComplete} />
    </MemoryRouter>,
  );
  return user;
}

describe("Setup wizard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.getChapters as jest.Mock).mockResolvedValue(mockChapters);
    (api.setupBasics as jest.Mock).mockResolvedValue(undefined);
    (api.setupRotation as jest.Mock).mockResolvedValue(undefined);
    (api.setupTopics as jest.Mock).mockResolvedValue(undefined);
    (api.setupBookPosition as jest.Mock).mockResolvedValue(undefined);
    (api.setupComplete as jest.Mock).mockResolvedValue(undefined);
  });

  it("renders step 1 with group basics form", () => {
    renderSetup();
    expect(
      screen.getByRole("heading", { name: "Group Basics" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Meeting Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Meeting Day")).toBeInTheDocument();
    expect(screen.getByLabelText("Meeting Time")).toBeInTheDocument();
    expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
  });

  it("shows step indicator text", () => {
    renderSetup();
    expect(screen.getByText(/Step 1 of 4/)).toBeInTheDocument();
  });

  it("navigates to step 2 on Next", async () => {
    const user = renderSetup();
    const nameInput = screen.getByLabelText("Meeting Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Test Group");
    const dateInput = screen.getByLabelText("Start Date");
    await user.type(dateInput, "2026-03-01");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Format Rotation" }),
      ).toBeInTheDocument();
    });
    expect(api.setupBasics).toHaveBeenCalledTimes(1);
  });

  it("shows Previous button on step 2", async () => {
    const user = renderSetup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Previous" }),
      ).toBeInTheDocument();
    });
  });

  it("navigates back to step 1 from step 2", async () => {
    const user = renderSetup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Format Rotation" }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(
      screen.getByRole("heading", { name: "Group Basics" }),
    ).toBeInTheDocument();
  });

  it("renders step 2 with rotation dropdowns", async () => {
    const user = renderSetup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Format Rotation" }),
      ).toBeInTheDocument();
    });
    // Should have 5 default rotation slots
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBe(5);
  });

  it("can add and remove rotation slots", async () => {
    const user = renderSetup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Format Rotation" }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Add Week" }));
    expect(screen.getAllByRole("combobox").length).toBe(6);
    await user.click(screen.getByRole("button", { name: "Remove week 6" }));
    expect(screen.getAllByRole("combobox").length).toBe(5);
  });

  it("renders step 3 with topic checkboxes", async () => {
    const user = renderSetup();
    // Navigate to step 3
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(api.setupBasics).toHaveBeenCalled();
    });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Discussion Topics" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Karma")).toBeInTheDocument();
    expect(screen.getByLabelText("Mindfulness")).toBeInTheDocument();
  });

  it("can add a new topic on step 3", async () => {
    const user = renderSetup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(api.setupBasics).toHaveBeenCalled();
    });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Discussion Topics" }),
      ).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Add a new topic"), "Joy");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByLabelText("Joy")).toBeInTheDocument();
  });

  it("renders step 4 with chapter selection", async () => {
    const user = renderSetup();
    // Navigate through all steps
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(api.setupBasics).toHaveBeenCalled();
    });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(api.setupRotation).toHaveBeenCalled();
    });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Book Position" }),
      ).toBeInTheDocument();
    });
    const select = screen.getByLabelText("Current Chapter");
    expect(select).toBeInTheDocument();
    // Check chapter options loaded
    const options = within(select).getAllByRole("option");
    expect(options.length).toBe(3);
  });

  it("calls onComplete when finishing", async () => {
    const onComplete = jest.fn();
    const user = renderSetup(onComplete);
    // Step 1 -> 2
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(api.setupBasics).toHaveBeenCalled();
    });
    // Step 2 -> 3
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(api.setupRotation).toHaveBeenCalled();
    });
    // Step 3 -> 4
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(api.setupTopics).toHaveBeenCalled();
    });
    // Finish
    await user.click(screen.getByRole("button", { name: "Finish Setup" }));
    await waitFor(() => {
      expect(api.setupBookPosition).toHaveBeenCalled();
      expect(api.setupComplete).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("shows error when API call fails", async () => {
    (api.setupBasics as jest.Mock).mockRejectedValue(
      new Error("Network error"),
    );
    const user = renderSetup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });
});
