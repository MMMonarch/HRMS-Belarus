# Фото сотрудника: хранилище через CRUD-вебхук

Карточка сотрудника отображает фото из поля **persons.photo_path** (путь в storage). Загрузка идёт **через тот же CRUD-вебхук** (`POST …/crud`): фронт отправляет **update** для таблицы **persons** с полями **photo_base64**, **content_type**, **branch_id** в payload. n8n в ветке обработки определяет такой запрос, загружает файл в Storage и обновляет в БД только **photo_path**.

---

## БД

- **persons.photo_path** (text, nullable) — путь к файлу в bucket, например `{branch_id}/{person_id}/avatar.jpg`.
- Представление **v_persons_list** включает **photo_path** для списка и карточки.

Миграции: `20260225150000_persons_photo_path.sql`, `20260225160000_v_persons_list_photo_path.sql`.

---

## Загрузка через CRUD (n8n)

**Endpoint:** тот же, что и для остальных операций — `POST <N8N_WEBHOOK_URL>/crud`.

**Тело запроса (JSON):**

| Поле (верхний уровень) | Значение |
|------------------------|----------|
| table | `"persons"` |
| action | `"update"` |
| id | uuid сотрудника (persons.id) |
| payload | `{ "photo_base64": "<строка base64>", "content_type": "image/jpeg" \| "image/png" \| …, "branch_id": "uuid" }` |
| access_token | JWT (как у остальных вызовов CRUD) |

Фронт читает файл через FileReader в base64 (без префикса `data:image/...;base64,`) и передаёт в payload. **Headers:** `Content-Type: application/json`, `Authorization: Bearer <JWT>`.

**Логика в n8n (ветка в том же CRUD-workflow):**

1. Если **table === "persons"** и **action === "update"** и в **payload** есть **photo_base64**:
   - Декодировать base64 в буфер/файл.
   - Загрузить в **Supabase Storage** (bucket, например `person-photos`) по пути `{branch_id}/{person_id}/avatar.{ext}` (ext из content_type или filename).
   - **Важно:** в PostgREST отправить **PATCH** для `persons` по **id** с телом **только** `{ "photo_path": "<путь в bucket>" }`. Поля **photo_base64**, **content_type**, **branch_id** в таблице `persons` нет — их нельзя передавать в PATCH, иначе PostgREST вернёт ошибку вида `Could not find the 'content_type' column of 'persons' in the schema cache`.
2. Иначе — обычная обработка update (передать payload в PostgREST как есть).

После успешной загрузки вернуть ответ как при обычном update (например, обновлённая запись или 200).

**Если в логах ошибка:** `Could not find the 'content_type' column of 'persons'` — в PATCH в PostgREST уходит весь входящий payload. Нужно в ветке «загрузка фото» формировать для PATCH **новый** объект с одним полем: `{ "photo_path": "<значение>" }`, и не передавать туда `photo_base64`, `content_type`, `branch_id`.

---

## Supabase Storage

1. **Bucket:** например **person-photos** (приватный или публичный).
2. **Политика:** при приватном bucket — выдавать URL через signed URL (в n8n или в ответе get по persons поле **photo_url**). При публичном — на фронте задать **NEXT_PUBLIC_STORAGE_PHOTOS_BASE_URL**, тогда URL = base + photo_path.
3. В n8n для загрузки — Supabase Node (Upload File) с service role или JWT пользователя.

---

## Фронт

- Запрос на загрузку фото: **crud("persons", "update", { photo_base64, content_type, branch_id }, personId)** — тот же клиент и тот же вебхук, что и для остального CRUD.
- Карточка сотрудника показывает фото по **photo_url** или по **photo_path** + **NEXT_PUBLIC_STORAGE_PHOTOS_BASE_URL**; иначе плейсхолдер и кнопка «Загрузить фото».

---

## Кратко

| Что | Где |
|-----|-----|
| Путь к файлу в БД | **persons.photo_path** |
| Загрузка | Тот же CRUD: **table persons**, **action update**, **payload**: photo_base64, content_type, branch_id |
| Обработка в n8n | Ветка: если payload.photo_base64 → Storage + PATCH persons.photo_path |
| Отображение URL | **photo_url** из n8n или **NEXT_PUBLIC_STORAGE_PHOTOS_BASE_URL** + **photo_path** |

Всё через один вебхук **crud**; отдельный endpoint для фото не нужен.
