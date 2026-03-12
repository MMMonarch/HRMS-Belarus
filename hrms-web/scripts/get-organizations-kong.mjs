#!/usr/bin/env node
/**
 * GET organizations через Kong (Supabase REST API).
 * Запуск:
 *   Из хоста (если Kong на localhost:8000):
 *     node scripts/get-organizations-kong.mjs
 *   Или задать URL и JWT:
 *     KONG_URL=http://kong:8000 TOKEN=eyJ... node scripts/get-organizations-kong.mjs
 *
 * Без TOKEN используется anon key — RLS вернёт [] для organizations (доступ только authenticated).
 * С TOKEN (JWT пользователя после входа) — вернутся строки по RLS.
 */

const KONG_URL = process.env.KONG_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:8000";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const TOKEN = process.env.TOKEN; // JWT пользователя (опционально); без него запрос идёт как anon → RLS даст []

const base = KONG_URL.replace(/\/$/, "");
const url = `${base}/rest/v1/organizations`;
const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  apikey: ANON_KEY || "",
  ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
  Range: "0-99",
};

async function main() {
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
  if (!res.ok) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
