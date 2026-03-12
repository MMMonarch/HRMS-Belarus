/**
 * Константы приложения: роли, статусы заявок, коды и т.д.
 * Группировать по доменам по мере роста.
 */

export const APP_NAME = "HRMS Belarus";

/** Роли пользователей (совпадают с бэкендом / user_roles). */
export const ROLE_ADMIN = "admin";
export const ROLE_USER = "user";

export const ROLES = {
  ADMIN: ROLE_ADMIN,
  USER: ROLE_USER,
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

/** All values that indicate admin role (legacy API may return 0, "0", or "global_admin") */
export const ADMIN_ROLE_VARIANTS: ReadonlySet<unknown> = new Set([
  ROLE_ADMIN,
  "global_admin",
  0,
  "0",
]);

/** Полный доступ ко всем разделам и действиям. */
export function isAdmin(role: unknown): boolean {
  return ADMIN_ROLE_VARIANTS.has(role);
}

/** Базовые URL вебхуков (без /crud). Оба через API-прокси (обход CORS). */
export const WEBHOOK_PROD_BASE = "/api/webhook";
export const WEBHOOK_TEST_BASE = "/api/webhook-test";
export const WEBHOOK_TEST_MODE_STORAGE_KEY = "hrms-webhook-test-mode";
