/** Smoke tests for App component rendering. */

import { render, screen } from "@testing-library/react";
import { App } from "../src/App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders login page when not authenticated", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Log In" })).toBeInTheDocument();
  });

  it("shows username input field", () => {
    render(<App />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("shows password input field", () => {
    render(<App />);
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows register toggle button", () => {
    render(<App />);
    expect(screen.getByText("Need an account? Register")).toBeInTheDocument();
  });
});
