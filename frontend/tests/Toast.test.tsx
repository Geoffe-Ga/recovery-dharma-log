/** Tests for Toast component and ToastContainer. */

import { render, screen, fireEvent } from "@testing-library/react";
import { Toast, ToastContainer } from "../src/components/Toast";
import type { ToastData } from "../src/components/Toast";

const mockDismiss = jest.fn();

const infoToast: ToastData = {
  id: "t1",
  message: "Hello world",
  severity: "info",
};

const errorToast: ToastData = {
  id: "t2",
  message: "Something broke",
  severity: "error",
};

const successToast: ToastData = {
  id: "t3",
  message: "Saved!",
  severity: "success",
};

describe("Toast", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders message text", () => {
    render(<Toast toast={infoToast} onDismiss={mockDismiss} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders with correct severity class", () => {
    const { container } = render(
      <Toast toast={errorToast} onDismiss={mockDismiss} />,
    );
    expect(container.querySelector(".rd-toast--error")).toBeInTheDocument();
  });

  it("has accessible role and aria-live", () => {
    render(<Toast toast={infoToast} onDismiss={mockDismiss} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("calls onDismiss when close button is clicked", () => {
    render(<Toast toast={infoToast} onDismiss={mockDismiss} />);
    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    expect(mockDismiss).toHaveBeenCalledWith("t1");
  });
});

describe("ToastContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when toasts list is empty", () => {
    const { container } = render(
      <ToastContainer toasts={[]} onDismiss={mockDismiss} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders multiple toasts", () => {
    render(
      <ToastContainer
        toasts={[infoToast, errorToast, successToast]}
        onDismiss={mockDismiss}
      />,
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("has notifications aria label", () => {
    render(<ToastContainer toasts={[infoToast]} onDismiss={mockDismiss} />);
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });
});
