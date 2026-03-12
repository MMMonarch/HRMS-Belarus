"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isAbortError } from "@/lib/n8n/client";

type SupabaseAuthContextValue = {
  session: Session | null;
  /** Текущий access_token (JWT) для заголовка Authorization в n8n. */
  getAccessToken: () => Promise<string | null>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => setSession(s))
      .catch((e) => {
        if (!isAbortError(e)) throw e;
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));

    return () => {
      try {
        subscription.unsubscribe();
      } catch (e) {
        if (!isAbortError(e)) throw e;
      }
    };
  }, [supabase.auth]);

  const getAccessToken = useCallback(async () => {
    if (session?.access_token) return session.access_token;
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      return s?.access_token ?? null;
    } catch (e) {
      if (isAbortError(e)) return null;
      throw e;
    }
  }, [supabase.auth, session?.access_token]);

  return (
    <SupabaseAuthContext.Provider value={{ session, getAccessToken }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) {
    throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  }
  return ctx;
}

/** Безопасный хук: возвращает null если провайдер не обёрнут. */
export function useSupabaseAuthOptional(): SupabaseAuthContextValue | null {
  return useContext(SupabaseAuthContext);
}
