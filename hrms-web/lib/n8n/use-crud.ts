"use client";

import { useCallback, useRef } from "react";
import { useWebhookTestMode } from "@/lib/context/webhook-test-mode";
import { useSupabaseAuthOptional } from "@/lib/context/supabase-auth";
import { useWorkspaceOptional } from "@/lib/context/workspace";
import { crud, type CrudAction } from "./client";

/**
 * Хук для вызова CRUD с текущим вебхуком (тестовый/продакшн по галочке в шапке),
 * JWT в заголовке Authorization и текущим филиалом (branchId) для фильтрации get-запросов.
 * n8n принимает только запросы с валидным Supabase JWT.
 */
export function useCrud() {
  const { webhookBaseUrl } = useWebhookTestMode();
  const auth = useSupabaseAuthOptional();
  const workspace = useWorkspaceOptional();
  const crudWithBase = useCallback(
    <T = Record<string, unknown>, TResponse = unknown>(
      table: string,
      action: CrudAction,
      payload?: T,
      id?: string
    ): Promise<TResponse> =>
      crud<T, TResponse>(table, action, payload, id, {
        baseUrl: webhookBaseUrl,
        getAccessToken: auth?.getAccessToken ?? undefined,
        branchId: workspace?.branchId ?? undefined,
      }),
    [webhookBaseUrl, auth?.getAccessToken, workspace?.branchId]
  );
  return crudWithBase;
}

/**
 * Ref на актуальный crud: колбэки с crudRef.current и [] deps не меняют ссылку
 * при обновлении контекста — нет повторных запросов вебхука (дудос).
 * Единая точка для всех страниц/справочников, которые дергают n8n.
 */
export function useCrudRef() {
  const crudWithBase = useCrud();
  const ref = useRef(crudWithBase);
  ref.current = crudWithBase;
  return ref;
}
