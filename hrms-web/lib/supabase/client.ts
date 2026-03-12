/**
 * Supabase клиент для браузера (Auth; JWT передаётся в n8n).
 * Задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.
 * Если переменных нет — приложение загрузится, но вход не будет работать до настройки.
 *
 * Auth-методы обёрнуты так, чтобы AbortError из @supabase/auth-js (locks.ts)
 * не всплывали в UI — отмена блокировки при таймауте/cleanup не считается ошибкой.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAbortError } from "@/lib/n8n/client";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-anon-key";

function wrapGetSession(client: SupabaseClient): void {
  const originalGetSession = client.auth.getSession.bind(client.auth);
  client.auth.getSession = async () => {
    try {
      return await originalGetSession();
    } catch (e) {
      if (isAbortError(e)) {
        return { data: { session: null }, error: null };
      }
      throw e;
    }
  };
}

/** Один экземпляр в браузере — сессия после входа не теряется между формами входа и провайдером. */
let browserClient: SupabaseClient | null = null;

/** true, если в .env заданы реальные Supabase URL и anon key (вход будет работать). */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && url !== PLACEHOLDER_URL && key !== PLACEHOLDER_KEY);
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;

  if (typeof window !== "undefined") {
    if (!browserClient) {
      browserClient = createSupabaseClient(url, anonKey);
      wrapGetSession(browserClient);
    }
    return browserClient;
  }

  const raw = createSupabaseClient(url, anonKey);
  wrapGetSession(raw);
  return raw;
}
