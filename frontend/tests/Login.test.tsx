/** Tests for Login page component. */

import { fireEvent, render, screen } from "@testing-library/react";
import { Login } from "../src/pages/Login";

const mockLogin = jest.fn();
const mockRegister = jest.fn();

function renderLogin(overrides = {}): void {
  render(
    <Login
      onLogin={mockLogin}
      onRegister={mockRegister}
      error={null}
      loading={false}
      {...overrides}
    />,
  );
}

describe("Login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders login form by default", () => {
    renderLogin();
    expect(screen.getByRole("heading", { name: "Log In" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("toggles to register mode", () => {
    renderLogin();
    fireEvent.click(screen.getByText("Need an account? Register"));
    expect(
      screen.getByRole("heading", { name: "Create Account" }),
    ).toBeInTheDocument();
  });

  it("shows error message when provided", () => {
    renderLogin({ error: "Invalid credentials" });
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");
  });

  it("disables submit button when loading", () => {
    renderLogin({ loading: true });
    expect(screen.getByText("Please wait...")).toBeDisabled();
  });

  it("calls onLogin when form is submitted in login mode", () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "testpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));
    expect(mockLogin).toHaveBeenCalledWith("testuser", "testpass");
  });
});
