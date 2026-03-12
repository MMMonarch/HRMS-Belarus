/**
 * Сессия авторизации: cookie на сервере, контракт с n8n (token + user с role).
 * В продакшене cookie желательно подписывать (HMAC) — см. SESSION_SECRET.
 */

import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "hrms_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 дней

export type SessionUser = {
  id?: string;
  email?: string;
  name?: string;
  role: string;
};

export type SessionPayload = {
  token?: string;
  user: SessionUser;
};

function encode(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

function decode(value: string): SessionPayload | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf-8");
    const data = JSON.parse(json) as SessionPayload;
    if (!data?.user?.role) return null;
    return data;
  } catch {
    return null;
  }
}

/** Читает сессию из cookie (сервер: layout, API, middleware). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  if (!value) return null;
  return decode(value);
}

/** Устанавливает cookie сессии (только в API route). */
export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, encode(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/** Удаляет cookie сессии. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export { SESSION_COOKIE_NAME };
