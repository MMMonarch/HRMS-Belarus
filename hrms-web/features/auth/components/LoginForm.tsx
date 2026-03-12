"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Введите email");
      return;
    }
    if (!password) {
      setError("Введите пароль");
      return;
    }

    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        setError(
          "Supabase не настроен. Добавьте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local и перезапустите dev-сервер."
        );
        return;
      }
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setError(signInError.message ?? "Ошибка входа");
        return;
      }

      const session = data.session;
      const user = data.user;
      if (!session?.access_token || !user) {
        setError("Нет сессии после входа");
        return;
      }

      const role = (user.user_metadata?.role as string) ?? "user";
      const sessionRes = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: session.access_token,
          user: {
            id: user.id,
            email: user.email ?? undefined,
            name: (user.user_metadata?.full_name as string) ?? user.email ?? undefined,
            role,
          },
        }),
      });
      if (!sessionRes.ok) {
        setError("Ошибка создания сессии");
        return;
      }
      router.push("/select-workspace");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : String(err);
      if (message === "Failed to fetch" || message.includes("fetch")) {
        setError(
          "Не удалось подключиться к Supabase. Проверьте NEXT_PUBLIC_SUPABASE_URL в .env.local и перезапустите dev-сервер."
        );
      } else {
        setError(message || "Ошибка входа");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="login-email"
          className="text-muted-foreground text-sm font-medium"
        >
          Email
        </label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="user@company.by"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="w-full"
          aria-invalid={!!error}
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="login-password"
          className="text-muted-foreground text-sm font-medium"
        >
          Пароль
        </label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          className="w-full"
          aria-invalid={!!error}
        />
      </div>
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Вход…" : "Войти"}
      </Button>
    </form>
  );
}
