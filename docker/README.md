# Docker — HRMS Belarus

Одна сеть `hrms-belarus_hrms-network`: n8n, hrms-web, Supabase (все в контейнерах).

---

## 1. Запуск n8n и фронта

Из корня проекта:

```bash
docker compose up -d
```

- **Фронт:** http://localhost:3000  
- **n8n:** http://localhost:5678  

Сеть создаётся автоматически: `hrms-belarus_hrms-network`.

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

Так создаётся сеть `hrms-belarus_hrms-network`.

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

Контейнеры Supabase (db, kong, auth, rest, studio и др.) поднимутся и будут в сети `hrms-belarus_hrms-network`. n8n и hrms-web обращаются к ним по имени сервиса:

- Postgres: `db:5432` (внутри Supabase compose сервис называется `db`)
- API (Kong): `http://kong:8000`

### Шаг 5. Порты Supabase (на хост)

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

В Docker для hrms-web в `docker-compose.yml` можно добавить (если фронт ходит в Supabase):

```yaml
environment:
  NEXT_PUBLIC_N8N_WEBHOOK_URL: http://localhost:5678
  NEXT_PUBLIC_SUPABASE_URL: http://localhost:8000
  NEXT_PUBLIC_SUPABASE_ANON_KEY: <anon key из .env Supabase>
```

`ANON_KEY` из `docker/supabase-repo/docker/.env` (переменная `ANON_KEY`).

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
