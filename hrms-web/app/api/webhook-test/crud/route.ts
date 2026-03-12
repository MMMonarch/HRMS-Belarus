import { NextRequest, NextResponse } from "next/server";

const N8N_TEST_BASE =
  process.env.N8N_WEBHOOK_TEST_URL ?? "http://localhost:5678/webhook-test";
const CRUD_URL = `${N8N_TEST_BASE.replace(/\/$/, "")}/crud`;

/**
 * Прокси POST /api/webhook-test/crud → тестовый вебхук n8n.
 * Используется при включённой галочке «Тест» (тестовый вебхук).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("Authorization");
    if (!auth?.trim()) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: auth,
    };
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    body.access_token = token;

    const res = await fetch(CRUD_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Proxy error" },
      { status: 500 }
    );
  }
}
