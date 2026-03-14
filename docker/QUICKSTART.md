# Запуск HRMS Belarus в Docker — без проблем

Один порядок запуска, одна сеть, все контейнеры видят друг друга.

---

## Что нужно один раз

1. **Docker** (Docker Desktop на Windows или Docker Engine).
2. **Репозиторий Supabase** в проекте:
   ```powershell
   git clone --depth 1 https://github.com/supabase/supabase.git docker/supabase-repo
   ```
3. **Файл .env Supabase** (скопировать из примера):
   ```powershell
   copy docker\supabase-repo\docker\.env.example docker\supabase-repo\docker\.env
   ```
   Для продакшена отредактируйте пароли и ключи в `.env`. Для локальной разработки можно оставить как есть.

4. **Файл pooler.exs с переводами строк LF**  
   Если контейнер `supabase-pooler` падает с ошибкой про "carriage return", см. раздел [Pooler падает](#pooler-падает) внизу.

---

## Запуск всего стека (рекомендуется)

**Из корня проекта:**

- **Windows (PowerShell):** `.\docker\up-all.ps1`
- **Linux/macOS (Bash):** `bash docker/up-all.sh`

Скрипт по порядку:
1. Создаёт сеть `hrms-belarus-network` (если её ещё нет).
2. Запускает основной compose: hrms-web, n8n, n8n-db.
3. Запускает Supabase в той же сети (kong, db, auth, studio и др.).

После этого все контейнеры в одной сети и обращаются друг к другу по имени: `kong`, `n8n`, `hrms-web`, `db` и т.д.

---

## Запуск вручную (если не используете скрипт)

Порядок **обязателен**: сначала сеть и основной compose, потом Supabase.

**Шаг 1.** Создать сеть (один раз):
```powershell
docker network create hrms-belarus-network
```

**Шаг 2.** Запустить hrms-web и n8n:
```powershell
docker compose up -d
```

**Шаг 3.** Запустить Supabase в той же сети:
```powershell
docker compose -f docker/supabase-repo/docker/docker-compose.yml -f docker/docker-compose.supabase-network.yml --env-file docker/supabase-repo/docker/.env up -d
```

Если шаг 3 выполнить без шагов 1–2, будет ошибка «network hrms-belarus-network not found».

---

## После запуска

| Сервис    | URL                    |
|-----------|------------------------|
| Фронт     | http://localhost:3000  |
| n8n       | http://localhost:5678  |
| Supabase  | http://localhost:8000  |

### Учётная запись Supabase в n8n

В n8n в настройках учётной записи **Supabase** (для узлов «Supabase: GET» и т.п.) укажите:

| Поле                 | Значение |
|----------------------|----------|
| **Host**             | `http://kong:8000` |
| **Service Role Secret** | значение `SERVICE_ROLE_KEY` из `docker/supabase-repo/docker/.env` |

**Не используйте** `http://localhost:8000` — из контейнера n8n нужен хост по имени сервиса: `kong`.

---

## Остановка

- Только основной стек (hrms-web, n8n):  
  `docker compose down`

- Supabase:  
  `docker compose -f docker/supabase-repo/docker/docker-compose.yml -f docker/docker-compose.supabase-network.yml --env-file docker/supabase-repo/docker/.env down`

- Всё и сеть не трогать: просто остановить контейнеры через Docker Desktop или `docker stop ...`.

---

## Pooler падает

Если контейнер **supabase-pooler** постоянно перезапускается и в логах ошибка про **carriage return** или **U+000D**:

1. Откройте `docker/supabase-repo/docker/volumes/pooler/pooler.exs` и сохраните файл с окончаниями строк **LF** (в редакторе: Line Ending → LF).
2. В корне проекта в `.gitattributes` должна быть строка:  
   `docker/supabase-repo/docker/volumes/pooler/pooler.exs text eol=lf`
3. Выполните: `docker restart supabase-pooler`

Подробнее: `docker/README.md`, раздел 4, и `docker/POOLER-CRLF-FIX.md`.

---

## Переменные (по желанию)

- **Корень проекта, файл .env**  
  Для переопределения URL/ключей Supabase при сборке hrms-web:  
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.  
  После смены пересоберите:  
  `docker compose build --no-cache hrms-web` и `docker compose up -d hrms-web`.

- **Supabase**  
  Порты, пароли, ключи: `docker/supabase-repo/docker/.env`.

Подробнее: `docker/README.md`.
