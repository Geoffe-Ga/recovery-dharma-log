/** Tests for useToast hook. */

import { renderHook, act } from "@testing-library/react";
import { useToast } from "../src/hooks/useToast";

describe("useToast", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts with empty toasts", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it("adds a toast when showToast is called", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("success", "Saved!");
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe("Saved!");
    expect(result.current.toasts[0].severity).toBe("success");
  });

  it("removes toast when dismissToast is called", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("info", "Hello");
    });
    const id = result.current.toasts[0].id;
    act(() => {
      result.current.dismissToast(id);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("auto-dismisses toast after default duration", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("info", "Temporary");
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("auto-dismisses with custom duration", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("info", "Quick", 1000);
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("limits to 3 toasts, removing oldest", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast("info", "First");
      result.current.showToast("info", "Second");
      result.current.showToast("info", "Third");
      result.current.showToast("info", "Fourth");
    });
    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts[0].message).toBe("Second");
    expect(result.current.toasts[2].message).toBe("Fourth");
  });
});
