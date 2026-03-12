# Авторизация: Supabase Auth + JWT в n8n

Пользователи логинятся в **Supabase Auth**. Фронт получает JWT (access_token) и при каждом запросе в n8n передаёт его в заголовке **Authorization: Bearer &lt;token&gt;**. n8n принимает запросы только с валидным JWT и при необходимости проверяет его через Supabase Auth API.

## 1) Фронт получает JWT

Пользователь входит через Supabase Auth (email/пароль на странице `/login`). Фронт вызывает `supabase.auth.signInWithPassword({ email, password })` и получает **session.access_token** (JWT). Сессия хранится в Supabase-клиенте (localStorage) и дублируется в cookie для middleware (редирект неавторизованных на `/login`).

## 2) Клиент зовёт n8n Webhook с токеном

Все запросы к n8n (CRUD и др.) идут с заголовком:

```
Authorization: Bearer <access_token>
```

На фронте это делает клиент в `lib/n8n/client.ts`: опции **accessToken** или **getAccessToken**; хук **useCrud()** подставляет текущий JWT из Supabase-сессии.

## 3) n8n проверяет токен (рекомендовано)

**Способ B1 (проще):** проверить токен через Supabase Auth API.

После узла Webhook в n8n добавьте HTTP Request:

- **GET** `https://<project-ref>.supabase.co/auth/v1/user`
- **Headers:**
  - `apikey`: `<anon key или service_role>`
  - `Authorization`: `Bearer <access_token>` (токен из заголовка входящего запроса)

Если Supabase вернул пользователя — токен валиден; в ответе будут **id**, **email**, **user_metadata** (в т.ч. **role**). Дальше можно подставлять `user.id` в запросы к БД и т.д.

## Роль в user_metadata

Роль для отображения на фронте берётся из **user_metadata.role** (Supabase Auth). Для админа в БД в `auth.users` задано **raw_user_meta_data.role = "admin"**; для остальных можно задать `"user"` или не задавать (фронт подставляет `"user"` по умолчанию).

## Учётная запись администратора

### Вариант A: через Auth API (рекомендуется — пароль точно примет Supabase)

Из корня **hrms-web** (подставьте свой `SUPABASE_SERVICE_ROLE_KEY` из Supabase → Settings → API):

```bash
SUPABASE_SERVICE_ROLE_KEY=ваш_service_role_key NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000 node scripts/seed-admin.mjs
```

Или добавьте в `.env.local` строку `SUPABASE_SERVICE_ROLE_KEY=...` и запустите:

```bash
node --env-file=.env.local scripts/seed-admin.mjs
```

Скрипт создаёт пользователя через Supabase Auth, поэтому логин **admin@hrms.by** / **1234** гарантированно работает в том же проекте, на который смотрит приложение (`NEXT_PUBLIC_SUPABASE_URL`).

### Вариант B: через SQL

1. Откройте **Supabase Studio** того же проекта, что и в `NEXT_PUBLIC_SUPABASE_URL` (для локального — часто http://localhost:3000 или порт из вашего docker-compose).
2. **SQL Editor** → выполните **`migrations/seed_admin_user_standalone.sql`**.
3. Если пользователь уже есть, скрипт обновит только metadata и роль.

### Если не можете войти (Invalid login credentials)

- Приложение ходит в тот Supabase, который задан в **.env.local** (`NEXT_PUBLIC_SUPABASE_URL`). Пользователь должен быть создан **в этом же проекте**.
- Если используете **localhost:8000** — создайте админа там (Вариант A или B в Studio для этого инстанса).
- Лучше всего использовать **Вариант A** (скрипт `scripts/seed-admin.mjs`): он создаёт пользователя через Auth API в том же URL, что и приложение.

Данные для входа:

- **Email:** `admin@hrms.by`
- **Пароль:** `1234`
- **Роль:** в `user_roles` — `global_admin`, в **user_metadata** — **`admin`** (для фронта и n8n).

## Переменные окружения (фронт)

- **NEXT_PUBLIC_SUPABASE_URL** — URL проекта Supabase (`https://<project-ref>.supabase.co`).
- **NEXT_PUBLIC_SUPABASE_ANON_KEY** — публичный anon key (для входа и проверки сессии).
- **NEXT_PUBLIC_N8N_WEBHOOK_URL** — базовый URL вебхуков n8n (к нему добавляется путь, например `/crud`).
