# Развёртывание HRMS Belarus на новой машине

Пошаговая инструкция. Всё делается из **корня проекта** (`HRMS Belarus/`) в **PowerShell**.

---

## Требования

| Компонент | Минимальная версия |
|-----------|--------------------|
| **Windows** | 10 / 11 (x64) |
| **Docker Desktop** | 4.x (с Docker Compose v2) |
| **Git** | 2.x |
| **Node.js** (опционально, для локальной разработки без Docker) | 20 LTS |

Docker Desktop должен быть запущен и переключён на **Linux containers**.

---

## Быстрый старт (одной строкой)

```powershell
.\setup\01-install-prerequisites.ps1   # проверка Git, Docker
.\setup\02-setup-supabase.ps1          # клонирование Supabase, создание .env
.\setup\03-start-stack.ps1             # docker compose up (n8n + Supabase + фронт)
.\setup\04-restore-db.ps1              # восстановление БД из бэкапа
.\setup\05-healthcheck.ps1             # проверка, что всё работает
```

Каждый скрипт можно запускать отдельно; они идемпотентны (повторный запуск не ломает систему).

---

## Настройка .env файлов

В проекте **три** файла `.env`. Все три нужны для работы системы.

### 1. Supabase — `docker/supabase-repo/docker/.env`

Создаётся автоматически скриптом `02-setup-supabase.ps1` из `.env.example`.  
**Для локальной разработки** значения по умолчанию работают без изменений.  
**Для продакшена** обязательно сменить секреты.

| Переменная | Что это | Значение по умолчанию (dev) |
|------------|---------|-----------------------------|
| `POSTGRES_PASSWORD` | Пароль Postgres (используется всеми сервисами Supabase и скриптами бэкапа) | `your-super-secret-and-long-postgres-password` |
| `JWT_SECRET` | Секрет для подписи JWT-токенов (Auth, PostgREST, Kong) | `your-super-secret-jwt-token-with-at-least-32-characters-long` |
| `ANON_KEY` | JWT анонимного пользователя (используется фронтом через `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | предгенерированный demo-токен |
| `SERVICE_ROLE_KEY` | JWT сервисной роли (полный доступ, используется в скриптах seed/reset) | предгенерированный demo-токен |
| `DASHBOARD_USERNAME` | Логин для Supabase Studio | `supabase` |
| `DASHBOARD_PASSWORD` | Пароль для Supabase Studio | `this_password_is_insecure_and_should_be_updated` |
| `POSTGRES_HOST` | Хост БД (имя Docker-сервиса) | `db` (не менять) |
| `POSTGRES_DB` | Имя базы данных | `postgres` (не менять) |
| `POSTGRES_PORT` | Порт Postgres внутри Docker-сети | `5432` |
| `KONG_HTTP_PORT` | Порт API-шлюза на хосте | `8000` |
| `SITE_URL` | URL фронта (для Auth-редиректов) | `http://localhost:3000` |
| `API_EXTERNAL_URL` | Внешний URL Supabase API | `http://localhost:8000` |
| `ENABLE_EMAIL_AUTOCONFIRM` | Автоподтверждение email при регистрации | `false` |

Остальные переменные (pooler, SMTP, analytics, imgproxy) для локальной разработки менять не нужно.

### 2. Фронт (hrms-web) — `hrms-web/.env.local`

Создайте вручную или скопируйте шаблон:

```powershell
copy hrms-web\.env.example hrms-web\.env.local
```

| Переменная | Что это | Значение (dev) |
|------------|---------|----------------|
| `NEXT_PUBLIC_N8N_WEBHOOK_URL` | URL вебхука n8n (для браузера, через прокси) | `http://localhost:5678` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase API (Kong) для Auth | `http://localhost:8000` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon-ключ Supabase (из `docker/supabase-repo/docker/.env`, переменная `ANON_KEY`) | скопировать из Supabase `.env` |
| `N8N_WEBHOOK_URL` | URL вебхука n8n для серверного прокси (server-side) | `http://localhost:5678/webhook` |
| `N8N_WEBHOOK_TEST_URL` | URL тестового вебхука n8n (server-side) | `http://localhost:5678/webhook-test` |
| `NEXT_PUBLIC_STORAGE_PHOTOS_BASE_URL` | Базовый URL для фото сотрудников (Supabase Storage через Kong) | `http://localhost:8000/storage/v1/object/public` |

**Для скриптов** (`seed-admin.mjs`, `reset-admin-password.mjs`) дополнительно:

| Переменная | Что это | Значение (dev) |
|------------|---------|----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key из Supabase `.env` | скопировать из Supabase `.env` (переменная `SERVICE_ROLE_KEY`) |

### 3. Корень проекта (Docker Compose) — `.env` (опционально)

Переменные для `docker-compose.yml` (n8n, hrms-web). Шаблон: `docker/.env.example`.

```powershell
copy docker\.env.example .env
```

| Переменная | Что это | Значение (dev) |
|------------|---------|----------------|
| `NEXT_PUBLIC_N8N_WEBHOOK_URL` | URL n8n для контейнера hrms-web | `http://localhost:5678` |
| `N8N_DB_USER` | Пользователь БД n8n | `n8n` |
| `N8N_DB_PASSWORD` | Пароль БД n8n | `n8n` |
| `N8N_DB_NAME` | Имя БД n8n | `n8n` |

Для локальной разработки корневой `.env` не обязателен — все значения имеют дефолты в `docker-compose.yml`.

### Откуда брать ключи

| Что нужно | Где взять |
|-----------|-----------|
| `ANON_KEY` | `docker/supabase-repo/docker/.env` → переменная `ANON_KEY` |
| `SERVICE_ROLE_KEY` | `docker/supabase-repo/docker/.env` → переменная `SERVICE_ROLE_KEY` |
| `POSTGRES_PASSWORD` | `docker/supabase-repo/docker/.env` → переменная `POSTGRES_PASSWORD` |

Все три файла `.env` **не коммитятся в Git** (проверьте `.gitignore`).

---

## Подробно по шагам

### Шаг 1. Проверка зависимостей

```powershell
.\setup\01-install-prerequisites.ps1
```

Проверяет наличие `git`, `docker`, `docker compose`. Если чего-то нет — покажет, что установить.

### Шаг 2. Подготовка Supabase

```powershell
.\setup\02-setup-supabase.ps1
```

- Клонирует `supabase/supabase` в `docker/supabase-repo/` (если ещё нет).
- Создаёт `docker/supabase-repo/docker/.env` из `.env.example`.

### Шаг 3. Запуск всего стека

```powershell
.\setup\03-start-stack.ps1
```

Поднимает в правильном порядке:

1. **n8n + n8n-db + hrms-web** (`docker-compose.yml`) — создаёт сеть `hrms-belarus_hrms-network`.
2. **Supabase** (db, kong, auth, rest, studio и др.) — подключается к той же сети через override.

Ждёт, пока `supabase-db` станет `healthy`.

### Шаг 4. Восстановление БД из бэкапа

```powershell
.\setup\04-restore-db.ps1
```

- Находит последний `.dump` файл в `backups/`.
- Копирует его в контейнер `supabase-db`.
- Выполняет `pg_restore --clean --if-exists`.
- Проверяет успешность.

Можно указать конкретный файл:

```powershell
.\setup\04-restore-db.ps1 -BackupFile "backups\supabase-postgres-20260312-205829.dump"
```

После этого **миграции запускать не нужно** — дамп уже содержит полную схему, данные, функции, триггеры и индексы.

### Шаг 5. Проверка здоровья сервисов

```powershell
.\setup\05-healthcheck.ps1
```

Проверяет доступность:

| Сервис | URL / проверка |
|--------|----------------|
| Supabase DB | `pg_isready` в контейнере |
| Supabase API (Kong) | http://localhost:8000 |
| n8n | http://localhost:5678 |
| hrms-web | http://localhost:3000 |

---

## Порты (сводка)

| Сервис | Порт |
|--------|------|
| hrms-web (фронт) | 3000 |
| n8n | 5678 |
| Supabase API (Kong) | 8000 |
| Supabase Studio | 8000 (через Kong) |
| Postgres (через Supavisor) | 5432 |

---

## Структура папки setup/

```
setup/
├── README.md                      # эта инструкция
├── 01-install-prerequisites.ps1   # проверка зависимостей
├── 02-setup-supabase.ps1          # клонирование Supabase
├── 03-start-stack.ps1             # запуск Docker-стека
├── 04-restore-db.ps1              # восстановление БД из бэкапа
└── 05-healthcheck.ps1             # проверка здоровья сервисов
```

## Файлы .env в проекте

```
HRMS Belarus/
├── .env                                    # (опц.) переменные для docker-compose.yml
├── docker/.env.example                     # шаблон для корневого .env
├── docker/supabase-repo/docker/.env        # конфигурация Supabase (создаётся скриптом 02)
├── docker/supabase-repo/docker/.env.example# шаблон Supabase (из официального репо)
├── hrms-web/.env.example                   # шаблон переменных фронта
└── hrms-web/.env.local                     # рабочие переменные фронта (создать вручную)
```

---

## Создание нового бэкапа

```powershell
.\scripts\backup-db.ps1
```

Файл сохранится в `backups/`. Подробнее — `backups/README.md`.

---

## Полный сброс

Если нужно начать с нуля (удалит все данные):

```powershell
# Остановить и удалить volumes Supabase
docker compose -f docker/supabase-repo/docker/docker-compose.yml `
  -f docker/docker-compose.supabase-network.yml `
  --env-file docker/supabase-repo/docker/.env down -v

# Остановить и удалить volumes n8n
docker compose down -v
```

Затем повторить шаги 3–4.
