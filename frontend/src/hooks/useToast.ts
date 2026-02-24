/** Toast notification hook with queue management. */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ToastData } from "../components/Toast";

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 5000;

let nextId = 1;

function generateId(): string {
  return `toast-${nextId++}`;
}

export interface UseToastReturn {
  toasts: ToastData[];
  showToast: (
    severity: ToastData["severity"],
    message: string,
    duration?: number,
  ) => void;
  dismissToast: (id: string) => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (severity: ToastData["severity"], message: string, duration?: number) => {
      const id = generateId();
      const toast: ToastData = { id, message, severity, duration };

      setToasts((prev) => {
        const next = [...prev, toast];
        // Dismiss oldest if over max
        if (next.length > MAX_TOASTS) {
          const removed = next.shift();
          if (removed) {
            const timer = timersRef.current.get(removed.id);
            if (timer) {
              clearTimeout(timer);
              timersRef.current.delete(removed.id);
            }
          }
        }
        return next;
      });

      const timeout = duration ?? DEFAULT_DURATION;
      const timer = setTimeout(() => {
        dismissToast(id);
      }, timeout);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return { toasts, showToast, dismissToast };
}
