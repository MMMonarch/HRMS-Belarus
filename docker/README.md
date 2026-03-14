# Docker — HRMS Belarus

Одна сеть **`hrms-belarus-network`**: n8n, hrms-web, Supabase — все контейнеры видят друг друга по имени сервиса (kong, db, hrms-web, n8n и т.д.).

---

## Быстрый старт (всё поднять без проблем)

**Подробная инструкция:** [docker/QUICKSTART.md](QUICKSTART.md)

**Кратко:**

1. Один раз: клонировать Supabase, создать `.env`:
   ```powershell
   git clone --depth 1 https://github.com/supabase/supabase.git docker/supabase-repo
   copy docker\supabase-repo\docker\.env.example docker\supabase-repo\docker\.env
   ```
2. Запуск всего стека из корня проекта:
   ```powershell
   .\docker\up-all.ps1
   ```
   Скрипт создаёт сеть, поднимает hrms-web и n8n, затем Supabase в той же сети.
3. В n8n в учётной записи Supabase указать **Host:** `http://kong:8000` (не localhost).

Без скрипта порядок такой: сначала `docker network create hrms-belarus-network`, затем `docker compose up -d`, затем запуск Supabase с override (см. QUICKSTART.md).

---

## 1. Запуск вручную (n8n и фронт)

Сеть должна существовать (скрипт `up-all.ps1` создаёт её, иначе: `docker network create hrms-belarus-network`). Затем из корня проекта:

```bash
docker compose up -d
```

- **Фронт:** http://localhost:3000  
- **n8n:** http://localhost:5678  

---

## 2. Supabase в контейнерах (та же сеть)

Supabase поднимается из **официального Docker-репозитория** Supabase; контейнеры сразу попадают в нашу сеть через override.

### Шаг 1. Клонировать Supabase Docker (один раз)

Из корня проекта:

**PowerShell:**
```powershell
git clone --depth 1 https://github.com/supabase/supabase.git docker/supabase-repo
```

**Bash:**
```bash
git clone --depth 1 https://github.com/supabase/supabase.git docker/supabase-repo
```

Появится папка `docker/supabase-repo` (в ней есть `docker/` с `docker-compose.yml` и `volumes/`).  
**Важно:** Supabase нужно запускать с override `docker/docker-compose.supabase-network.yml`, иначе контейнеры Supabase окажутся в другой сети и не будут видны hrms-web и n8n.

### Шаг 2. Переменные окружения Supabase

Скопировать пример и при необходимости отредактировать:

```bash
copy docker\supabase-repo\docker\.env.example docker\supabase-repo\docker\.env
```

(В Linux/macOS: `cp docker/supabase-repo/docker/.env.example docker/supabase-repo/docker/.env`.)

В `.env` можно поменять пароли и ключи (обязательно для продакшена).

### Шаг 3. Запустить наш compose (если ещё не запущен)

```bash
docker compose up -d
```

Так создаётся сеть `hrms-belarus-network`.

### Шаг 4. Запустить Supabase в той же сети

Из корня проекта:

**PowerShell:**
```powershell
docker compose -f docker/supabase-repo/docker/docker-compose.yml -f docker/docker-compose.supabase-network.yml --env-file docker/supabase-repo/docker/.env up -d
```

**Bash:**
```bash
docker compose -f docker/supabase-repo/docker/docker-compose.yml -f docker/docker-compose.supabase-network.yml --env-file docker/supabase-repo/docker/.env up -d
```

Контейнеры Supabase (db, kong, auth, rest, studio и др.) поднимутся в той же сети `hrms-belarus-network`. Все контейнеры видят друг друга по имени сервиса:

- Postgres: `db:5432` (внутри Supabase compose сервис называется `db`)
- API (Kong): `http://kong:8000`

### Шаг 5. Узел Supabase в n8n (обязательно)

В n8n узел **Supabase** (в т.ч. «Supabase: GET») использует учётные данные (Credentials). Из контейнера n8n до Kong нужно обращаться **по имени сервиса**, а не по `localhost`.

В настройках учётной записи Supabase в n8n укажите:

| Поле | Значение |
|------|----------|
| **Host** | `http://kong:8000` |
| **Service Role Secret** | значение `SERVICE_ROLE_KEY` из `docker/supabase-repo/docker/.env` |

Не используйте `http://localhost:8000` — внутри контейнера это сам контейнер n8n, соединение не установится («incorrect host (domain) value»).

### Шаг 6. Порты Supabase (на хост)

В Supabase `.env` по умолчанию: Kong — 8000, Studio — 3000 (может конфликтовать с фронтом). При конфликте портов измените в `docker/supabase-repo/docker/.env` (например, `KONG_HTTP_PORT`, порт Studio).

---

## Порты (сводка)

| Сервис           | Порт  |
|------------------|-------|
| hrms-web         | 3000  |
| n8n              | 5678  |
| Supabase Kong/API| 8000  |
| Supabase Studio  | см. .env Supabase |
| Postgres (Supabase) | см. .env Supabase |

---

## Переменные для фронта (hrms-web)

В `docker-compose.yml` для hrms-web уже заданы Supabase-переменные (по умолчанию Kong `http://localhost:8000` и демо ANON_KEY из Supabase). Если ваш Supabase поднят с `docker/supabase-repo/docker/.env` без смены ANON_KEY — **вход в приложение должен работать без доп. настройки**.

Если вы меняли ключи в Supabase `.env`, задайте в **корне проекта** в `.env` (или в окружении):

- `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY из docker/supabase-repo/docker/.env>`

После смены переменных пересоберите образ: `docker compose build --no-cache hrms-web` и `docker compose up -d hrms-web` (NEXT_PUBLIC_* вшиваются в бандл при сборке).

---

## 3. MCP Supabase (self-hosted) для Cursor

Чтобы Cursor (и я) могли подключаться к вашему self-hosted Supabase через MCP:

1. **Kong уже настроен** в `docker/supabase-repo/docker/volumes/api/kong.yml`: эндпоинт `/mcp` разрешён с localhost и типичных IP шлюза Docker (127.0.0.1, ::1, 172.17–19.0.1). Если после перезапуска Kong всё ещё 403 — добавьте в `allow` IP шлюза: `docker inspect supabase-kong --format "{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}"`.

2. **Перезапустите Kong** после первого клона или после правок `kong.yml`:
   ```bash
   cd docker/supabase-repo/docker
   docker compose restart kong
   ```
   (Из корня проекта можно: `docker compose -f docker/supabase-repo/docker/docker-compose.yml -f docker/docker-compose.supabase-network.yml --env-file docker/supabase-repo/docker/.env restart kong`.)

3. **Cursor:** в настройках MCP укажите URL self-hosted MCP:
   - Файл: `%USERPROFILE%\.cursor\mcp.json` (или проект: `.cursor/mcp.json`).
   - Конфиг:
   ```json
   {
     "mcpServers": {
       "supabase": {
         "url": "http://localhost:8000/mcp"
       }
     }
   }
   ```

4. Supabase (Kong + Studio) должен быть запущен; тогда Cursor сможет обращаться к `http://localhost:8000/mcp`.

---

## 4. Контейнер supabase-pooler падает (инструкция для ИИ / отладки)

### Симптом
- Контейнер **supabase-pooler** (сервис Supavisor) в цикле перезапуска: `Restarting (1) ...`.
- В логах: `docker logs supabase-pooler` — ошибка **Elixir SyntaxError**:  
  `unexpected token: carriage return (column 4, code point U+000D)` на строке 30 в `nofile` (это подмонтированный `pooler.exs`).

### Причина
Файл **`docker/supabase-repo/docker/volumes/pooler/pooler.exs`** при редактировании или клонировании на Windows получает окончания строк **CRLF** (`\r\n`). Контейнер — Linux, Elixir парсит файл как код; символ **carriage return (U+000D, `\r`)** считается недопустимым токеном, из-за чего падает этап `eval` при старте Supavisor.

### Что сделать
1. **Перевести файл на LF.**  
   Содержимое то же, только переводы строк — Unix (LF, `\n`), без `\r`.  
   Пример (PowerShell):  
   `$p = "docker/supabase-repo/docker/volumes/pooler/pooler.exs"; (Get-Content $p -Raw) -replace "`r`n", "`n" | Set-Content $p -NoNewline; [IO.File]::WriteAllText((Resolve-Path $p), ([IO.File]::ReadAllText((Resolve-Path $p)) -replace "`r`n", "`n"), [Text.UTF8Encoding]::new($false))`  
   Или открыть файл в редакторе и сохранить с Line Ending: **LF**.
2. **Сохранить правило в репозитории**, чтобы при следующем клоне на Windows файл не переключился обратно на CRLF: в корне проекта в **`.gitattributes`** должна быть строка:  
   `docker/supabase-repo/docker/volumes/pooler/pooler.exs text eol=lf`
3. **Перезапустить контейнер:**  
   `docker restart supabase-pooler`  
   После этого контейнер должен перейти в статус **Up (healthy)**.

### Прочие возможные причины падения pooler (если CRLF уже исправлен)
- В `.env` остались плейсхолдеры для **SECRET_KEY_BASE** и **VAULT_ENC_KEY** — сгенерировать ключи: `sh docker/supabase-repo/docker/utils/generate-keys.sh` и подставить значения в `docker/supabase-repo/docker/.env`.
- Занят порт **5432** на хосте — освободить или в `.env` задать другой **POSTGRES_PORT**.
- Healthcheck срабатывает слишком рано — в `docker-compose.yml` у сервиса **supavisor** можно задать `healthcheck.start_period: 40s`.
