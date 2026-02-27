/** Tests for ErrorWithRetry component. */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorWithRetry } from "../src/components/ErrorWithRetry";

describe("ErrorWithRetry", () => {
  it("renders the error message", () => {
    render(
      <ErrorWithRetry message="Something went wrong" onRetry={jest.fn()} />,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("has role=alert for accessibility", () => {
    render(<ErrorWithRetry message="Oops" onRetry={jest.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders a Retry button", () => {
    render(<ErrorWithRetry message="Oops" onRetry={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("calls onRetry when Retry button is clicked", async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    render(<ErrorWithRetry message="Oops" onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
