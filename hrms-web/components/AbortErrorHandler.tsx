"use client";

import { useEffect } from "react";
import { isAbortError } from "@/lib/n8n/client";

/**
 * Подавляет показ AbortError в Next.js error overlay.
 * Ловит и unhandledrejection, и глобальный error (на случай синхронного выброса).
 */
export function AbortErrorHandler({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isAbortError(event.reason)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onError = (event: ErrorEvent) => {
      if (isAbortError(event.error) || isAbortError(event.message)) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      return false;
    };
    window.addEventListener("unhandledrejection", onRejection, true);
    window.addEventListener("error", onError, true);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection, true);
      window.removeEventListener("error", onError, true);
    };
  }, []);
  return <>{children}</>;
}
