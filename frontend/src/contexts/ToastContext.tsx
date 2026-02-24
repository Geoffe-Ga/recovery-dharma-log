/** Toast context provider for app-wide toast notifications. */

import React, { createContext, useContext } from "react";
import { ToastContainer } from "../components/Toast";
import { useToast } from "../hooks/useToast";
import type { ToastData } from "../components/Toast";

type ShowToastFn = (
  severity: ToastData["severity"],
  message: string,
  duration?: number,
) => void;

const ToastContext = createContext<ShowToastFn | null>(null);

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const { toasts, showToast, dismissToast } = useToast();

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useShowToast(): ShowToastFn {
  const showToast = useContext(ToastContext);
  if (!showToast) {
    throw new Error("useShowToast must be used within a ToastProvider");
  }
  return showToast;
}
