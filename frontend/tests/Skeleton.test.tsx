/** Tests for Skeleton loading placeholder component. */

import { render, screen } from "@testing-library/react";
import { Skeleton } from "../src/components/Skeleton";

describe("Skeleton", () => {
  it("renders with aria-busy attribute", () => {
    render(<Skeleton />);
    const skeleton = screen.getByLabelText("Loading content");
    expect(skeleton).toHaveAttribute("aria-busy", "true");
  });

  it("renders default 3 lines", () => {
    const { container } = render(<Skeleton />);
    const lines = container.querySelectorAll(".rd-skeleton__line");
    expect(lines).toHaveLength(3);
  });

  it("renders custom number of lines", () => {
    const { container } = render(<Skeleton lines={5} />);
    const lines = container.querySelectorAll(".rd-skeleton__line");
    expect(lines).toHaveLength(5);
  });

  it("renders header by default", () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector(".rd-skeleton__header")).toBeInTheDocument();
  });

  it("hides header when showHeader is false", () => {
    const { container } = render(<Skeleton showHeader={false} />);
    expect(
      container.querySelector(".rd-skeleton__header"),
    ).not.toBeInTheDocument();
  });

  it("applies decreasing widths to lines", () => {
    const { container } = render(<Skeleton lines={3} />);
    const lines = container.querySelectorAll(".rd-skeleton__line");
    expect(lines[0]).toHaveStyle({ width: "85%" });
    expect(lines[1]).toHaveStyle({ width: "75%" });
    expect(lines[2]).toHaveStyle({ width: "65%" });
  });

  it("has rd-skeleton class on root element", () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector(".rd-skeleton")).toBeInTheDocument();
  });
});
