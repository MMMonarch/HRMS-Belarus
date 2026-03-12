"use client";

import * as React from "react";
import {
  WEBHOOK_PROD_BASE,
  WEBHOOK_TEST_BASE,
  WEBHOOK_TEST_MODE_STORAGE_KEY,
} from "@/lib/constants";

type WebhookTestModeContextValue = {
  testMode: boolean;
  setTestMode: (value: boolean) => void;
  webhookBaseUrl: string;
};

const WebhookTestModeContext =
  React.createContext<WebhookTestModeContextValue | null>(null);

function getStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(WEBHOOK_TEST_MODE_STORAGE_KEY);
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

export function WebhookTestModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [testMode, setTestModeState] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setTestModeState(getStored());
    setMounted(true);
  }, []);

  const setTestMode = React.useCallback((value: boolean) => {
    setTestModeState(value);
    try {
      localStorage.setItem(WEBHOOK_TEST_MODE_STORAGE_KEY, value ? "1" : "0");
    } catch {}
  }, []);

  const webhookBaseUrl = testMode ? WEBHOOK_TEST_BASE : WEBHOOK_PROD_BASE;

  const value: WebhookTestModeContextValue = React.useMemo(
    () => ({ testMode: mounted ? testMode : false, setTestMode, webhookBaseUrl }),
    [testMode, setTestMode, webhookBaseUrl, mounted]
  );

  return (
    <WebhookTestModeContext.Provider value={value}>
      {children}
    </WebhookTestModeContext.Provider>
  );
}

export function useWebhookTestMode(): WebhookTestModeContextValue {
  const ctx = React.useContext(WebhookTestModeContext);
  if (!ctx) throw new Error("useWebhookTestMode must be used within WebhookTestModeProvider");
  return ctx;
}
