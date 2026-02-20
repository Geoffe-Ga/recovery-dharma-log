/** Tests for active navigation link highlighting. */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../src/App";

// Mock useAuth to return authenticated state
jest.mock("../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, username: "test", group_id: 1 },
    isAuthenticated: true,
    error: null,
    loading: false,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
  }),
}));

// Mock page components to avoid API calls
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

function renderWithRoute(route: string): void {
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("NavLink active state", () => {
  it("marks Home link as active on root route", () => {
    renderWithRoute("/");
    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).toHaveClass("active");

    const logLink = screen.getByRole("link", { name: "Log" });
    expect(logLink).not.toHaveClass("active");

    const settingsLink = screen.getByRole("link", { name: "Settings" });
    expect(settingsLink).not.toHaveClass("active");
  });

  it("marks Log link as active on /log route", () => {
    renderWithRoute("/log");
    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).not.toHaveClass("active");

    const logLink = screen.getByRole("link", { name: "Log" });
    expect(logLink).toHaveClass("active");
  });

  it("marks Settings link as active on /settings route", () => {
    renderWithRoute("/settings");
    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).not.toHaveClass("active");

    const settingsLink = screen.getByRole("link", { name: "Settings" });
    expect(settingsLink).toHaveClass("active");
  });

  it("does not mark Home as active on nested routes", () => {
    renderWithRoute("/log");
    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).not.toHaveClass("active");
  });
});
