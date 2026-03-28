/** Tests for Login page component. */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../src/contexts/ToastContext";
import { Login } from "../src/pages/Login";

const mockLogin = jest.fn();
const mockRegister = jest.fn();

function renderLogin(
  overrides: Record<string, unknown> = {},
  initialEntries: string[] = ["/"],
): void {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <ToastProvider>
        <Login
          onLogin={mockLogin}
          onRegister={mockRegister}
          error={null}
          loading={false}
          {...overrides}
        />
      </ToastProvider>
    </MemoryRouter>,
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

  it("toggles to register mode", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByText("Need an account? Register"));
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

  it("calls onLogin when form is submitted in login mode", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("Username"), "testuser");
    await user.type(screen.getByLabelText("Password"), "testpass");
    await user.click(screen.getByRole("button", { name: "Log In" }));
    expect(mockLogin).toHaveBeenCalledWith("testuser", "testpass");
  });

  it("shows session expired toast when expired=1 query param", async () => {
    renderLogin({}, ["/login?expired=1"]);
    await waitFor(() => {
      expect(
        screen.getByText("Your session has expired. Please log in again."),
      ).toBeInTheDocument();
    });
  });

  it("calls onRegister without invite code by default", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByText("Need an account? Register"));
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Password"), "newpass");
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(mockRegister).toHaveBeenCalledWith("newuser", "newpass", undefined);
  });

  it("shows invite code input when checkbox is checked", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByText("Need an account? Register"));
    expect(screen.queryByLabelText("Invite Code")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("I have an invite code"));
    expect(screen.getByLabelText("Invite Code")).toBeInTheDocument();
  });

  it("passes invite code to onRegister when provided", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByText("Need an account? Register"));
    await user.click(screen.getByLabelText("I have an invite code"));
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Password"), "newpass");
    await user.type(screen.getByLabelText("Invite Code"), "abcd1234");
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(mockRegister).toHaveBeenCalledWith("newuser", "newpass", "ABCD1234");
  });

  it("disables submit when invite code checkbox checked but code is short", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByText("Need an account? Register"));
    await user.click(screen.getByLabelText("I have an invite code"));
    // Code field is empty, submit should be disabled
    expect(
      screen.getByRole("button", { name: "Create Account" }),
    ).toBeDisabled();
    // Type partial code
    await user.type(screen.getByLabelText("Invite Code"), "ABC");
    expect(
      screen.getByRole("button", { name: "Create Account" }),
    ).toBeDisabled();
    // Full 8-char code enables it
    await user.type(screen.getByLabelText("Invite Code"), "D1234");
    expect(
      screen.getByRole("button", { name: "Create Account" }),
    ).toBeEnabled();
  });

  it("hides invite code input when unchecking checkbox", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByText("Need an account? Register"));
    await user.click(screen.getByLabelText("I have an invite code"));
    expect(screen.getByLabelText("Invite Code")).toBeInTheDocument();
    await user.click(screen.getByLabelText("I have an invite code"));
    expect(screen.queryByLabelText("Invite Code")).not.toBeInTheDocument();
  });
});
