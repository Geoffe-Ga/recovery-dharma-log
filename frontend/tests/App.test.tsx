/** Smoke tests for App component rendering. */

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App";
import type { GroupSettings } from "../src/types/index";

// Mock useAuth to return authenticated state for navbar tests
const mockUseAuth = jest.fn();
jest.mock("../src/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock page components to avoid API calls from child pages
jest.mock("../src/pages/Landing", () => ({
  Landing: () => <div data-testid="landing-page">Landing</div>,
}));

jest.mock("../src/pages/Log", () => ({
  Log: () => <div data-testid="log-page">Log</div>,
}));

jest.mock("../src/pages/Settings", () => ({
  Settings: () => <div data-testid="settings-page">Settings</div>,
}));

// Override BrowserRouter with MemoryRouter for test control
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

jest.mock("../src/api/index", () => ({
  getSettings: jest.fn(),
  isLoggedIn: jest.fn(() => false),
  login: jest.fn(),
  logout: jest.fn(),
  register: jest.fn(),
}));

import * as api from "../src/api/index";

const mockSettings: GroupSettings = {
  name: "Test Group Name",
  meeting_day: 6,
  start_date: "2025-01-05",
  meeting_time: "18:00:00",
  format_rotation: ["Speaker", "Topic", "Book Study"],
};

const unauthState = {
  user: null,
  isAuthenticated: false,
  error: null,
  loading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
};

const authState = {
  user: { id: 1, username: "test", group_id: 1 },
  isAuthenticated: true,
  error: null,
  loading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
};

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockUseAuth.mockReturnValue(unauthState);
  });

  it("renders login page when not authenticated", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Log In" })).toBeInTheDocument();
  });

  it("shows username input field", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("shows password input field", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows register toggle button", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("Need an account? Register")).toBeInTheDocument();
  });

  describe("group name in navbar", () => {
    it("displays group name from settings when authenticated", async () => {
      mockUseAuth.mockReturnValue(authState);
      (api.getSettings as jest.Mock).mockResolvedValue(mockSettings);

      render(
        <MemoryRouter>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("Test Group Name")).toBeInTheDocument();
      });
    });

    it("shows fallback RD Log while settings are loading", () => {
      mockUseAuth.mockReturnValue(authState);
      (api.getSettings as jest.Mock).mockReturnValue(new Promise(() => {}));

      render(
        <MemoryRouter>
          <App />
        </MemoryRouter>,
      );

      expect(screen.getByText("RD Log")).toBeInTheDocument();
    });

    it("keeps fallback RD Log when settings fetch fails", async () => {
      mockUseAuth.mockReturnValue(authState);
      (api.getSettings as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      );

      render(
        <MemoryRouter>
          <App />
        </MemoryRouter>,
      );

      // Wait for the rejection to be handled
      await waitFor(() => {
        expect(api.getSettings).toHaveBeenCalled();
      });

      expect(screen.getByText("RD Log")).toBeInTheDocument();
    });
  });

  describe("hamburger navigation", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(authState);
      (api.getSettings as jest.Mock).mockReturnValue(new Promise(() => {}));
    });

    it("renders hamburger toggle on mobile", () => {
      render(
        <MemoryRouter>
          <App />
        </MemoryRouter>,
      );

      const toggle = screen.getByLabelText("Toggle navigation");
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute("type", "checkbox");

      const hamburger = toggle.nextElementSibling;
      expect(hamburger).toBeInTheDocument();
      expect(hamburger?.tagName).toBe("LABEL");
    });

    it("nav links are still present", () => {
      render(
        <MemoryRouter>
          <App />
        </MemoryRouter>,
      );

      expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Log" })).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Settings" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Log Out" }),
      ).toBeInTheDocument();
    });
  });
});
