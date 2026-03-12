"use client";

import { useWebhookTestMode } from "@/lib/context/webhook-test-mode";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Галочка «Тест»: при включении запросы идут на тестовый вебхук (/api/webhook-test/crud).
 * Состояние хранится в localStorage и действует для всего приложения.
 */
export function WebhookTestCheckbox() {
  const { testMode, setTestMode } = useWebhookTestMode();
  return (
    <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox
        checked={testMode}
        onCheckedChange={(v) => setTestMode(v === true)}
        aria-label="Использовать тестовый вебхук"
      />
      <span>Тест</span>
    </label>
  );
}
