/** Toast notification component for success/error/info feedback. */

import React from "react";

export interface ToastData {
  id: string;
  message: string;
  severity: "success" | "error" | "info";
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps): React.ReactElement {
  return (
    <div
      className={`rd-toast rd-toast--${toast.severity}`}
      role="status"
      aria-live="polite"
    >
      <span className="rd-toast__message">{toast.message}</span>
      <button
        type="button"
        className="rd-toast__close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        &times;
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({
  toasts,
  onDismiss,
}: ToastContainerProps): React.ReactElement | null {
  if (toasts.length === 0) return null;

  return (
    <div className="rd-toast-container" aria-label="Notifications">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
