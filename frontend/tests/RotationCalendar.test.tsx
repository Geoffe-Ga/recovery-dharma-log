/** Tests for RotationCalendar component. */

import { render, screen } from "@testing-library/react";
import { RotationCalendar } from "../src/components/RotationCalendar";

describe("RotationCalendar", () => {
  it("renders 10 meetings by default", () => {
    const { container } = render(
      <RotationCalendar
        meetingDay={6}
        startDate="2025-01-05"
        formatRotation={["Speaker", "Topic", "Book Study"]}
      />,
    );
    const rows = container.querySelectorAll(".rd-rotation-calendar__row");
    expect(rows.length).toBe(10);
  });

  it("renders custom count of meetings", () => {
    const { container } = render(
      <RotationCalendar
        meetingDay={6}
        startDate="2025-01-05"
        formatRotation={["Speaker", "Topic"]}
        count={4}
      />,
    );
    const rows = container.querySelectorAll(".rd-rotation-calendar__row");
    expect(rows.length).toBe(4);
  });

  it("displays format badges", () => {
    render(
      <RotationCalendar
        meetingDay={6}
        startDate="2025-01-05"
        formatRotation={["Speaker", "Topic", "Book Study"]}
        count={3}
      />,
    );
    const badges = screen.getAllByText(/Speaker|Topic|Book Study/);
    expect(badges.length).toBe(3);
  });

  it("shows message when no rotation configured", () => {
    render(
      <RotationCalendar
        meetingDay={6}
        startDate="2025-01-05"
        formatRotation={[]}
      />,
    );
    expect(screen.getByText("No rotation configured.")).toBeInTheDocument();
  });

  it("displays formatted dates", () => {
    render(
      <RotationCalendar
        meetingDay={6}
        startDate="2025-01-05"
        formatRotation={["Speaker"]}
        count={1}
      />,
    );
    // Should display a date string like "Sunday, February 23"
    const dateSpan = document.querySelector(".rd-rotation-calendar__date");
    expect(dateSpan).toBeInTheDocument();
    expect(dateSpan?.textContent).toMatch(/\w+, \w+ \d+/);
  });
});
