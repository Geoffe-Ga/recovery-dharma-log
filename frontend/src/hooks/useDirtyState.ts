/** Hook for tracking unsaved changes against a saved snapshot. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseDirtyStateReturn<T> {
  isDirty: boolean;
  currentValues: T;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  reset: (newSnapshot?: T) => void;
}

export function useDirtyState<T extends Record<string, unknown>>(
  savedValues: T,
): UseDirtyStateReturn<T> {
  const [snapshot, setSnapshot] = useState<T>(savedValues);
  const [currentValues, setCurrentValues] = useState<T>(savedValues);
  const initializedRef = useRef(false);

  // Update snapshot when savedValues change from parent (e.g. after API load)
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      setSnapshot(savedValues);
      setCurrentValues(savedValues);
    }
  }, [savedValues]);

  const isDirty = useMemo(
    () => JSON.stringify(currentValues) !== JSON.stringify(snapshot),
    [currentValues, snapshot],
  );

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setCurrentValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(
    (newSnapshot?: T) => {
      const target = newSnapshot ?? snapshot;
      setSnapshot(target);
      setCurrentValues(target);
    },
    [snapshot],
  );

  return { isDirty, currentValues, setField, reset };
}
