/** Tests for ErrorWithRetry component. */

import { fireEvent, render, screen } from "@testing-library/react";
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

  it("calls onRetry when Retry button is clicked", () => {
    const onRetry = jest.fn();
    render(<ErrorWithRetry message="Oops" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
