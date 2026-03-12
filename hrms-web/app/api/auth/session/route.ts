import { NextRequest } from "next/server";
import { setSessionCookie, getSession, clearSessionCookie } from "@/lib/auth/session";

/** Установить сессию после входа (вызывает клиент с token + user от n8n). */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { token, user } = body as { token?: string; user?: { id?: string; email?: string; name?: string; role?: string } };
  if (!user?.role) {
    return new Response(JSON.stringify({ error: "user.role required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await setSessionCookie({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Текущая сессия (для Header, проверки прав). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ session: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(
    JSON.stringify({
      session: {
        user: session.user,
        token: session.token ? "[REDACTED]" : undefined,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/** Выход: сброс сессии. */
export async function DELETE() {
  await clearSessionCookie();
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
