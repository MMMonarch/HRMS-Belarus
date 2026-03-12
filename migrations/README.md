# Миграции базы данных

В этой папке хранятся SQL-миграции для базы данных проекта HRMS.

## Формат имён файлов

Рекомендуется использовать версионированные имена, например:

- `YYYYMMDDHHMMSS_описание_миграции.sql`
- или `001_initial_schema.sql`, `002_add_employees.sql` и т.д.

## Использование

Миграции можно применять вручную или через инструменты (Supabase CLI, pg-migrate и др.) в зависимости от вашей конфигурации.

## Supabase MCP (Cursor) — только локальный Supabase в Docker

В проекте MCP настроен **только на локальный Supabase**, развёрнутый в Docker (см. `docker/README.md`).

- **URL:** `http://localhost:8000/mcp` (Kong на порту 8000, маршрут `/mcp`).
- Перед использованием MCP запустите Supabase: из корня проекта выполните команды из раздела «2. Supabase в контейнерах» в `docker/README.md`.
- Доступ к `/mcp` разрешён с localhost и из Docker-сети (см. `docker/supabase-repo/docker/volumes/api/kong.yml`). Cursor на той же машине подключается по `http://localhost:8000/mcp`.

Если MCP настроен глобально в Cursor, в **Settings → Tools & MCP** укажите для Supabase URL: `http://localhost:8000/mcp`. После изменения перезапустите Cursor.
