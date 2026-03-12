/**
 * Клиент к n8n: базовый URL, crud(table, action, payload), методы под процессы.
 * Контракт с n8n задать здесь или в types/.
 * baseUrlOverride: при вызове с клиента передавать из useCrud() (тестовый/продакшн вебхук).
 */

function getDefaultBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
  if (!url) throw new Error("NEXT_PUBLIC_N8N_WEBHOOK_URL is not set");
  return url.replace(/\/$/, "");
}

/** Таблица из ошибки FK → понятное название для пользователя */
const FK_TABLE_LABELS: Record<string, string> = {
  position_subcategories: "подкатегории должностей",
  position_categories: "категории должностей",
  positions: "должности",
  departments: "подразделения",
  branches: "филиалы",
  organizations: "организации",
  employments: "занятости",
  assignments: "назначения",
  order_items: "пунктах приказов",
};

/**
 * Превращает сырое сообщение об ошибке БД (FK constraint и т.д.) в понятный пользователю текст.
 */
export function formatCrudError(raw: string): string {
  if (raw.includes("violates foreign key constraint")) {
    const onTableMatch = raw.match(/on table "([^"]+)"/);
    const refTable = onTableMatch?.[1];
    const label = refTable
      ? FK_TABLE_LABELS[refTable] ?? refTable
      : "других записях";
    return `Невозможно удалить: запись используется в ${label}. Сначала удалите или измените связанные записи.`;
  }
  return raw;
}

/**
 * Извлекает текст ошибки БД из ответа n8n/Axios.
 * Форматы: [{ error: "string" }] | [{ error: { message: "409 - \"{...}\"" } }] | { error: "string" }.
 */
function extractRawErrorString(err: unknown): string | null {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return null;
}

/**
 * Парсит сообщение n8n/Axios вида "409 - \"{\\"message\\":\\"...postgres...\\"}\"" и возвращает postgres message.
 */
function parseN8nErrorMessage(outer: string): string {
  const trimmed = outer.trim();
  const afterDash = trimmed.replace(/^\d+\s*-\s*/, "").trim();
  if (!afterDash) return outer;
  let jsonStr = afterDash;
  if (afterDash.startsWith('"') && afterDash.endsWith('"')) {
    jsonStr = afterDash.slice(1, -1).replace(/\\"/g, '"');
  }
  try {
    const parsed = JSON.parse(jsonStr) as { message?: string };
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // не JSON или без .message — вернём как есть
  }
  return outer;
}

function getErrorMessageFromBody(body: unknown): string | null {
  let err: unknown = null;
  if (Array.isArray(body) && body.length > 0) {
    const first = body[0];
    if (first && typeof first === "object" && "error" in first) {
      err = (first as { error: unknown }).error;
    }
  } else if (body && typeof body === "object" && "error" in body) {
    err = (body as { error: unknown }).error;
  }
  const raw = extractRawErrorString(err);
  if (!raw) return null;
  const postgresMsg = parseN8nErrorMessage(raw);
  return formatCrudError(postgresMsg);
}

export type CrudAction = "get" | "create" | "update" | "delete";

export type CrudPayload<T = Record<string, unknown>> = {
  table: string;
  action: CrudAction;
  id?: string;
  payload?: T;
};

export type CrudOptions = {
  /** Базовый URL вебхука (без /crud). Если не передан — из env (для сервера). */
  baseUrl?: string;
  /** JWT (Supabase access_token) для заголовка Authorization: Bearer. n8n проверяет токен через Supabase Auth API. */
  accessToken?: string | null;
  /** Либо передать функцию, возвращающую текущий токен (для клиента). */
  getAccessToken?: () => Promise<string | null>;
  /** Для action "get": фильтр по филиалу. Подмешивается в payload как branch_id только для таблиц с колонкой branch_id (не для organizations, branches и др.). */
  branchId?: string | null;
};

/** Таблицы без колонки branch_id: для get не отправляем branch_id в payload. profiles — пользователи системы (id→auth.users); position_* — по организации. */
const GET_TABLES_WITHOUT_BRANCH = new Set([
  "organizations",
  "branches",
  "countries",
  "document_types",
  "template_types",
  "position_categories",
  "position_subcategories",
  "order_item_types",
  "order_item_subtypes",
  "profiles",
]);

async function resolveAccessToken(options?: CrudOptions): Promise<string | null> {
  if (options?.accessToken) return options.accessToken;
  if (options?.getAccessToken) return options.getAccessToken();
  return null;
}

/** Ошибка отмены запроса (навигация, размонтирование). Не показывать пользователю. */
export const CRUD_ABORTED = "CRUD_ABORTED";

export function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (e instanceof Error && (e.name === "AbortError" || (e as Error & { code?: string }).code === "ABORT_ERR")) return true;
  if (typeof e === "string" && e.toLowerCase().includes("aborted")) return true;
  const err = e as { code?: string; message?: string } | null;
  return err?.code === "ABORT_ERR" || (typeof err?.message === "string" && err.message.toLowerCase().includes("aborted"));
}

/** Извлечь массив из ответа n8n (массив как есть или обёртка data/items/body/json/result/rows) */
export function parseListResponse(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["data", "items", "body", "json", "result", "rows"]) {
      const v = o[key];
      if (Array.isArray(v)) return v;
    }
  }
  if (typeof data === "string") {
    try {
      return parseListResponse(JSON.parse(data) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

/** Извлечь одну запись из ответа get-by-id (обёртки: data, body, person, record, row, массив и т.д.) */
export function parseSingleRecord(data: unknown): Record<string, unknown> | undefined {
  if (data == null) return undefined;
  if (Array.isArray(data)) return (data[0] as Record<string, unknown>) ?? undefined;
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["data", "body", "json", "result", "record", "person", "row"]) {
      const v = o[key];
      if (v != null && typeof v === "object") {
        const row = Array.isArray(v) ? (v as unknown[])[0] : v;
        if (row && typeof row === "object") return row as Record<string, unknown>;
      }
    }
    if (o.id != null || o.birth_date !== undefined || o.citizenship_id !== undefined) return o;
  }
  return undefined;
}

export async function crud<T = Record<string, unknown>, TResponse = unknown>(
  table: string,
  action: CrudAction,
  payload?: T,
  id?: string,
  options?: CrudOptions
): Promise<TResponse> {
  const baseUrl = (options?.baseUrl ?? getDefaultBaseUrl()).replace(/\/$/, "");
  let token: string | null = null;
  try {
    token = await resolveAccessToken(options);
  } catch (e) {
    if (isAbortError(e)) throw new Error(CRUD_ABORTED);
    throw e;
  }

  // Все запросы к вебхуку n8n только с авторизацией (прокси возвращает 401 без токена).
  const expectsAuth = options?.getAccessToken != null || options?.accessToken != null;
  if (expectsAuth && !token) {
    throw new Error("Требуется авторизация");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Для get: branch_id в payload только у таблиц с колонкой branch_id (справочники organizations, branches и т.д. — без branch_id)
  let effectivePayload = payload;
  if (
    action === "get" &&
    options?.branchId != null &&
    options.branchId !== "" &&
    !GET_TABLES_WITHOUT_BRANCH.has(table)
  ) {
    effectivePayload = { ...(typeof payload === "object" && payload !== null ? payload : {}), branch_id: options.branchId } as T;
  }

  // Единое тело для get/create/update/delete — один вебхук /crud, см. docs/crud-webhook-contract.md
  const bodyPayload: Record<string, unknown> = { table, action, payload: effectivePayload, id };
  if (token) {
    bodyPayload.access_token = token;
  }

  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    const logPayload = { ...bodyPayload, access_token: token ? "(Bearer …)" : undefined };
    console.log("[n8n crud]", logPayload);
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/crud`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
    });
  } catch (e) {
    if (isAbortError(e)) throw new Error(CRUD_ABORTED);
    throw e;
  }

  const contentType = res.headers.get("Content-Type") ?? "";
  let body: unknown;
  try {
    body = contentType.includes("application/json")
      ? await res.json()
      : await res.text();
  } catch (e) {
    if (isAbortError(e)) throw new Error(CRUD_ABORTED);
    throw e;
  }

  const friendlyMessage = getErrorMessageFromBody(body);
  if (friendlyMessage) {
    throw new Error(friendlyMessage);
  }

  if (!res.ok) {
    const text = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(text || res.statusText);
  }

  return body as TResponse;
}
