"use client";

import { useEffect } from "react";
import { isAbortError } from "@/lib/n8n/client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isAbort = isAbortError(error);

  useEffect(() => {
    if (isAbort) reset();
  }, [isAbort, reset]);

  if (isAbort) return null;

  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold">Что-то пошло не так</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
      >
        Попробовать снова
      </button>
    </div>
  );
}
