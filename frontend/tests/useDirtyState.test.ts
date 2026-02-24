/** Tests for useDirtyState hook. */

import { renderHook, act } from "@testing-library/react";
import { useDirtyState } from "../src/hooks/useDirtyState";

describe("useDirtyState", () => {
  it("starts clean", () => {
    const { result } = renderHook(() =>
      useDirtyState({ name: "Test", count: 1 }),
    );
    expect(result.current.isDirty).toBe(false);
    expect(result.current.currentValues).toEqual({ name: "Test", count: 1 });
  });

  it("becomes dirty when field changes", () => {
    const { result } = renderHook(() =>
      useDirtyState({ name: "Test", count: 1 }),
    );
    act(() => {
      result.current.setField("name", "Changed");
    });
    expect(result.current.isDirty).toBe(true);
    expect(result.current.currentValues.name).toBe("Changed");
  });

  it("becomes clean when reset to snapshot", () => {
    const { result } = renderHook(() =>
      useDirtyState({ name: "Test", count: 1 }),
    );
    act(() => {
      result.current.setField("name", "Changed");
    });
    expect(result.current.isDirty).toBe(true);
    act(() => {
      result.current.reset();
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.currentValues.name).toBe("Test");
  });

  it("resets to new snapshot when provided", () => {
    const { result } = renderHook(() =>
      useDirtyState({ name: "Test", count: 1 }),
    );
    act(() => {
      result.current.reset({ name: "New", count: 2 });
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.currentValues).toEqual({ name: "New", count: 2 });
  });

  it("is not dirty when changed back to snapshot value", () => {
    const { result } = renderHook(() =>
      useDirtyState({ name: "Test", count: 1 }),
    );
    act(() => {
      result.current.setField("name", "Changed");
    });
    expect(result.current.isDirty).toBe(true);
    act(() => {
      result.current.setField("name", "Test");
    });
    expect(result.current.isDirty).toBe(false);
  });
});
