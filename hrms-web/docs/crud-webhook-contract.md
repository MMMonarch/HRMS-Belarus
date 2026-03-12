# Контракт CRUD-вебхука n8n

Один и тот же вебхук обрабатывает **получение, добавление, редактирование и удаление** записей. Отдельного вебхука на редактирование нет — используется тот же endpoint с `action: "update"`.

---

## Endpoint

- **Продакшн (через прокси):** `POST /api/webhook/crud`
- **Напрямую в n8n:** `POST <N8N_WEBHOOK_URL>/crud`

Во всех случаях один URL, один метод POST.

---

## Тело запроса (единое для всех действий)

```json
{
  "table": "имя_таблицы",
  "action": "get" | "create" | "update" | "delete",
  "id": "uuid — для get/update/delete",
  "payload": { ... } | null,
  "access_token": "JWT от Supabase Auth"
}
```

- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <access_token>` (прокси требует Authorization).

---

## Правила по действиям

| action   | id       | payload                    | Описание |
|----------|----------|----------------------------|----------|
| **get**  | опционально | опционально (фильтры)   | Если передан **id** — вернуть одну запись по `id` (иначе список). В **payload** можно передать фильтры, в т.ч. **branch_id** — тогда вернуть только строки филиала (для таблиц с колонкой branch_id). |
| **create** | не нужен | объект полей для вставки | Новая запись. |
| **update** | **обязателен** | объект полей для обновления | Редактирование существующей записи по `id`. |
| **delete** | **обязателен** | не нужен / игнорируется   | Удаление записи по `id`. |

Редактирование (**update**) идёт в тот же вебхук, что и **create** и **delete**: различие только в `action` и в наличии `id` и `payload`.

### get: оптимизация по id и филиалу

- **get по id:** при передаче `id` в теле запроса n8n должен вернуть **одну запись** (например, через `eq('id', id)` в PostgREST), а не весь список. Так снижается объём данных и нагрузка.
- **get по списку id (payload.id — массив):** если в `payload` передан **id** как массив UUID, в URL добавлять параметр **id=in.(uuid1,uuid2,...)**. Одна запись по id передаётся в теле как **id** (верхний уровень), не в payload.
- **get по branch_id:** если в `payload` передан `branch_id`, для таблиц с колонкой `branch_id` (persons, orders, order_items, departments, positions, **templates** и т.д.) применять фильтр `.eq('branch_id', payload.branch_id)`. Для таблиц без branch_id (organizations, branches, countries, document_types, template_types и т.п.) поле `branch_id` в payload игнорировать.
- **get по person_id:** если в `payload` передан `person_id`, для таблиц с колонкой `person_id` (order_items, contracts, person_documents, candidates, employments и т.д.) применять фильтр `.eq('person_id', payload.person_id)`. Так в карточке сотрудника запрашиваются только приказы и трудовые документы этого сотрудника, а не все записи филиала.
- Фронт через `useCrud()` подставляет текущий филиал из workspace в payload при каждом **get**; при необходимости вызывающий код добавляет в payload `person_id` (например, в карточке сотрудника).

---

## Примеры (фронт → n8n)

**Получение одной записи по id (get one):**
```json
{ "table": "persons", "action": "get", "id": "a0bdb16d-b6ea-419d-a828-c02cea416566", "payload": null, "access_token": "..." }
```

**Получение списка с фильтром по филиалу (get list by branch):**
```json
{ "table": "orders", "action": "get", "payload": { "branch_id": "uuid-филиала" }, "access_token": "..." }
```

**Получение данных по сотруднику (филиал + person_id):**
```json
{ "table": "order_items", "action": "get", "payload": { "branch_id": "uuid-филиала", "person_id": "uuid-сотрудника" }, "access_token": "..." }
```

**Добавление (create):**
```json
{ "table": "persons", "action": "create", "payload": { "last_name": "Иванов", "first_name": "Иван", "branch_id": "..." }, "access_token": "..." }
```

**Редактирование (update):**
```json
{ "table": "persons", "action": "update", "id": "a0bdb16d-b6ea-419d-a828-c02cea416566", "payload": { "last_name": "Петров", "contact_phone": "+375..." }, "access_token": "..." }
```

**Загрузка фото сотрудника (тот же CRUD, update persons с photo_base64):**  
Если в payload приходят поля **photo_base64**, **content_type** и **branch_id**, n8n обрабатывает это как загрузку фото: декодирует base64 → загружает в Supabase Storage → делает PATCH persons **только с полем photo_path** (тело PATCH: `{ "photo_path": "..." }`). В PATCH **не** передавать photo_base64, content_type, branch_id — этих колонок в таблице persons нет, PostgREST вернёт ошибку. Подробнее — **docs/person-photo-upload.md**.

```json
{ "table": "persons", "action": "update", "id": "uuid-сотрудника", "payload": { "photo_base64": "<base64-строка>", "content_type": "image/jpeg", "branch_id": "uuid-филиала" }, "access_token": "..." }
```

**Удаление (delete):**
```json
{ "table": "persons", "action": "delete", "id": "a0bdb16d-b6ea-419d-a828-c02cea416566", "access_token": "..." }
```

---

## Запрос из n8n в Supabase (Kong / PostgREST)

При **включённом RLS** PostgREST определяет пользователя **только по заголовку** `Authorization: Bearer <JWT>`. Без этого заголовка запрос выполняется как **anon** — RLS отфильтрует все строки и ответ будет пустой `[]`.

Для проставления **created_by** / **updated_by** в таблицах (order_items, orders и др.) триггер в БД использует `auth.uid()`. Поэтому при **create** и **update** запрос к Supabase должен идти с заголовком `Authorization: Bearer <JWT пользователя>` — иначе поля аудита останутся NULL.

В ноде **HTTP Request** к `http://kong:8000/rest/v1/...` обязательно передавать:

| Header        | Значение |
|---------------|----------|
| `apikey`      | Anon-ключ проекта (из настроек Supabase) |
| `Authorization` | `Bearer {{ $json.access_token }}` или `{{ $json.authorization }}` (если в теле вебхука уже приходит строка с префиксом "Bearer ") |

Если передаёте только `apikey` и не передаёте `Authorization` с JWT пользователя — при включённом RLS таблицы будут возвращать пустой результат.

### URL и метод для action get

Базовый URL: **`http://kong:8000/rest/v1/{{ $json.table }}`** (например, для `table: "organizations"` → `http://kong:8000/rest/v1/organizations`).

- **Метод:** GET.
- **Query-параметры (только для get):**
  - Если передан **id** — добавить фильтр по первичному ключу: **`?id=eq.{{ $json.id }}`** (PostgREST вернёт одну строку или пустой массив).
  - Если передан **payload.branch_id** и таблица поддерживает филиал (persons, orders, departments, positions и т.д.) — добавить **`&branch_id=eq.{{ $json.payload.branch_id }}`** (или только этот параметр, если id нет). Для таблиц **без** колонки branch_id (organizations, branches, countries, document_types и т.п.) параметр **branch_id не добавлять** — иначе PostgREST вернёт ошибку.

**Примеры итогового URL для get:**

| table           | id   | payload.branch_id | URL |
|----------------|------|-------------------|-----|
| organizations  | —    | (игнор)           | `http://kong:8000/rest/v1/organizations` |
| branches       | —    | (игнор)           | `http://kong:8000/rest/v1/branches` |
| persons        | есть | есть              | `http://kong:8000/rest/v1/persons?id=eq.<uuid>` |
| persons        | —    | есть              | `http://kong:8000/rest/v1/persons?branch_id=eq.<uuid>` |
| orders         | —    | есть              | `http://kong:8000/rest/v1/orders?branch_id=eq.<uuid>` |
| orders         | —    | payload.id=[…]    | `http://kong:8000/rest/v1/orders?id=in.(uuid1,uuid2)` |

В n8n можно собрать query string в Code-ноде или в выражении: если `body.id` есть — добавить `id=eq.{{ body.id }}`; если у таблицы есть branch_id и передан `body.payload.branch_id` — добавить `branch_id=eq.{{ body.payload.branch_id }}`. Список таблиц без branch_id задать константой (organizations, branches, countries, document_types, template_types, position_categories, order_item_types, order_item_subtypes и т.п.).

#### Пример ноды HTTP Request (Supabase: GET)

Заголовки (у вас уже так): `apikey` = `{{ $json.API }}`, `Authorization` = `Bearer {{ $json.token }}`. Перед этой нодой вебхук должен положить в item поля `table`, `token` (JWT), `API` (anon key), а также `id` и `payload` при get.

**URL с опциональными id и branch_id** — в поле URL ноды указать выражение (в n8n Expression можно многострочное). Для таблиц без колонки branch_id (organizations, branches, countries и т.д.) параметр branch_id не добавляется:

```javascript
{{ 
  const base = 'http://kong:8000/rest/v1/' + $json.table;
  const noBranch = ['organizations','branches','countries','document_types','template_types','position_categories','order_item_types','order_item_subtypes'];
  const parts = [];
  if ($json.id) parts.push('id=eq.' + $json.id);
  if ($json.payload?.branch_id && !noBranch.includes($json.table)) parts.push('branch_id=eq.' + $json.payload.branch_id);
  return parts.length ? base + '?' + parts.join('&') : base;
}}
```

Итог: для `organizations` получится `http://kong:8000/rest/v1/organizations`; для `persons` с филиалом — `http://kong:8000/rest/v1/persons?branch_id=eq.<uuid>`.

**Альтернатива — Code-нода перед HTTP Request:** собрать полный URL и заголовки, затем в HTTP Request: URL = `{{ $json.url }}`, метод GET, заголовки из `$json.headers` (или вручную `apikey` = `{{ $json.headers.apikey }}`, `Authorization` = `{{ $json.headers.Authorization }}`):

```javascript
return $input.all().map((item) => {
  const j = item.json || {};
  const table = (j.table ?? "").toString().trim();
  if (!table) throw new Error("Missing table (json.table)");

  const base = `http://kong:8000/rest/v1/${encodeURIComponent(table)}`;
  const payloadRaw = j.payload ?? {};
  const payload =
    payloadRaw && typeof payloadRaw === "object" && !Array.isArray(payloadRaw)
      ? payloadRaw
      : {};

  const noBranch = [
    "organizations", "branches", "countries", "document_types",
    "template_types", "position_categories", "position_subcategories",
    "order_item_types", "order_item_subtypes", "profiles",
  ];

  const parts = [];
  const idList = payload.id;
  if (Array.isArray(idList) && idList.length > 0) {
    const valid = idList.filter((x) => x != null && String(x).trim() !== "");
    if (valid.length > 0) {
      parts.push(`id=in.(${valid.map((x) => encodeURIComponent(String(x).trim())).join(",")})`);
    }
  } else if (j.id !== null && j.id !== undefined && String(j.id).trim() !== "") {
    parts.push(`id=eq.${encodeURIComponent(String(j.id).trim())}`);
  }
  const branchId = payload.branch_id;
  if (!noBranch.includes(table) && branchId != null && String(branchId).trim() !== "") {
    parts.push(`branch_id=eq.${encodeURIComponent(String(branchId).trim())}`);
  }
  const tablesWithPersonId = ["order_items", "contracts", "person_documents", "candidates", "employments"];
  const personId = payload.person_id;
  if (tablesWithPersonId.includes(table) && personId != null && String(personId).trim() !== "") {
    parts.push(`person_id=eq.${encodeURIComponent(String(personId).trim())}`);
  }

  const url = parts.length ? `${base}?${parts.join("&")}` : base;
  const apiKey = j.API ?? j.apikey ?? null;
  const token = j.token ?? null;
  if (!apiKey) throw new Error("Missing API key (json.API)");
  if (!token) throw new Error("Missing user token (json.token)");

  return {
    json: {
      ...j,
      url,
      headers: { apikey: apiKey, Authorization: `Bearer ${token}` },
    },
  };
});
```

---

## В n8n

Workflow должен по полю `body.action` выбирать ветку: get / create / **update** / delete. Для **update** использовать `body.id` как идентификатор записи и `body.payload` как поля для обновления (PATCH-логика: обновить только переданные поля). Логика авторизации и подстановки `branch_id` — единая для create и update (например, из JWT или из родительской записи).

---

## Пример: кнопка «Сохранить» в карточке пункта приказа

При нажатии «Сохранить» в карточке пункта приказа (OrderItemCard) в вебхук уходит **один** запрос `order_items` + `update` с таким телом (без `access_token` в примере):

```json
{
  "table": "order_items",
  "action": "update",
  "id": "uuid-пункта-приказа",
  "payload": {
    "item_type_number": 1,
    "effective_from": "2025-02-01",
    "effective_to": null,
    "payload": {
      "body": "",
      "positionId": "uuid-должности",
      "departmentId": "uuid-подразделения",
      "templateId": "uuid-шаблона",
      "contractTemplateId": "...",
      "contractType": "employment_contract",
      "contractTermKind": "indefinite",
      "validFrom": "2025-02-01T00:00:00.000Z",
      "validTo": null,
      "leaveDays": 0
    }
  }
}
```

- При **первом применении** пункта приёма (должность и подразделение указаны) фронт после обновления пункта создаёт запись в **contracts** (contract_type, contract_term_kind, valid_from, valid_to из payload) и проставляет в пункте `contract_id`. Подробнее см. `flow-hire-order-save.md`.
- Для **уже применённого** пункта приёма при изменении полей договора (contractType, contractTermKind, validFrom, validTo) фронт дополнительно выполняет **update** записи в **contracts** по `contract_id` пункта.

- Для **перевода** (`item_type_number: 2`) в `payload` дополнительно передаётся `employment_id` и в `payload.payload` — `newPositionId`, `newDepartmentId`.
- Для **отпуска** в `payload.payload` могут быть массивы периодов и дни (см. `flow-hire-order-save.md` и типы в коде).

В режиме разработки в консоли браузера при каждом вызове crud выводится лог `[n8n crud]` с телом запроса (токен подставлен как `(Bearer …)`), чтобы видеть точные данные, уходящие в вебхук.

---

## RPC: список таблиц и колонок (через Kong)

В БД есть функция **`get_schema_tables`**, которую можно вызвать через Kong и получить JSON со всеми таблицами и их колонками (удобно для n8n, скриптов, документации).

**URL:** `POST http://kong:8000/rest/v1/rpc/get_schema_tables`

**Headers:** как для обычных запросов к PostgREST: `apikey`, при необходимости `Authorization: Bearer <JWT>`.

**Тело запроса (опционально):**

- `{}` — по умолчанию возвращаются таблицы схемы `public`.
- `{ "schema_names": ["public", "auth"] }` — список схем для фильтра.

**Пример ответа (плоский массив переменных: path, label, type, group, format для дат):**

```json
[
  { "path": "persons.id", "label": "id", "type": "string", "group": "persons" },
  { "path": "persons.last_name", "label": "last_name", "type": "string", "group": "persons" },
  { "path": "persons.birth_date", "label": "birth_date", "type": "date", "group": "persons", "format": "dd.MM.yyyy" },
  { "path": "orders.reg_number", "label": "reg_number", "type": "string", "group": "orders" },
  ...
]
```

В n8n: нода **HTTP Request** — Method POST, URL `http://kong:8000/rest/v1/rpc/get_schema_tables`, Body Content Type JSON, тело `{}` или с `schema_names`. Миграция: `migrations/20260227120000_rpc_get_schema_tables.sql`.
