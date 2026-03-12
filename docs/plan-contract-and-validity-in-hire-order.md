# План реализации: трудовой документ и сроки действия в приказе о приёме

Цель: в пункте приказа о приёме указывать **тип трудового документа** (трудовой договор / контракт), **вид срока** и **сроки действия** (valid_from, valid_to), сохранять их в БД и при применении приёма создавать запись в `contracts` с привязкой к пункту (`order_items.contract_id`).

---

## 1. Текущее состояние

| Где | Что есть | Чего нет |
|-----|----------|----------|
| **БД** | `order_items.contract_id` (FK → contracts), таблица `contracts` с полями `contract_type`, `contract_term_kind`, `valid_from`, `valid_to`, `hire_order_item_id` | — |
| **Фронт (приём)** | Селект «Шаблон контракта/трудового договора» (`contractTemplateId` в payload) — только для печати | Выбор типа документа, вид срока, даты действия; привязка к записи contracts |
| **n8n / apply** | Создание employment + assignment при сохранении с должностью и подразделением; обновление order_items (payload, state, employment_id) | Создание записи в `contracts` и проставление `order_items.contract_id` |

Миграции и схема БД менять не требуется.

---

## 2. Этапы реализации

### Этап 1. Типы и константы (фронт)

**Файлы:** `hrms-web/features/documents/types.ts`

- Добавить тип для вида трудового документа:
  - `ContractType = 'employment_contract' | 'contract'`
  - `ContractTermKind` — значения enum из БД: `indefinite` | `fixed_term` | `fixed_term_work` | `fixed_term_replacement` | `seasonal` | `contract`
- Добавить константы для селектов:
  - `CONTRACT_TYPES`: `{ value: 'employment_contract', label: 'Трудовой договор' }`, `{ value: 'contract', label: 'Контракт' }`
  - `CONTRACT_TERM_KINDS`: массив с кодами и русскими наименованиями по ТК РБ (бессрочный, срочный на определённый срок, на время выполнения работы, на время замещения, сезонный, контракт)
- В тип данных пункта приёма (payload / data для hire) добавить поля:
  - `contractType?: ContractType`
  - `contractTermKind?: ContractTermKind`
  - `validFrom?: string` (ISO date или DD.MM.YYYY — единообразно с effective_from)
  - `validTo?: string | null` (для бессрочного — пусто)

Опционально: описать интерфейс `ContractRow` / ответ API по контракту, если позже понадобится показывать карточку договора.

---

### Этап 2. Расширение OrderItemRow и маппинга (фронт)

**Файлы:** `hrms-web/features/documents/types.ts`

- В `OrderItemRow` добавить поле `contract_id?: string | null` (если API его возвращает).
- В `mapOrderItemRowToOrderItem` при маппинге передавать `contract_id` в объект (например в `data` или отдельным полем `OrderItem.contractId`), чтобы в карточке можно было показывать «Привязан к договору № …».
- В payload при сохранении (как формирует OrderItemCard) включить для типа hire: `contractType`, `contractTermKind`, `validFrom`, `validTo` (в том формате, в котором ожидает n8n, например ISO даты в payload).

---

### Этап 3. UI в карточке пункта приказа (OrderItemCard)

**Файл:** `hrms-web/features/documents/components/OrderItemCard.tsx`

В блоке для `itemTypeCode === 'hire'` (секция «Поля в зависимости от типа пункта»):

1. **Тип трудового документа**  
   Селект: «Трудовой договор» / «Контракт» → значение в state и в `buildDataByType()` (например `contractType`).

2. **Вид срока (contract_term_kind)**  
   Селект со списком из констант (бессрочный, срочный, контракт и т.д.). Можно показывать всегда или упростить: для «Трудовой договор» — по умолчанию бессрочный и скрыть/упростить; для «Контракт» — обязательный выбор, по умолчанию `contract`.

3. **Срок действия**  
   - **Дата начала действия** (`validFrom`) — по умолчанию подставлять дату приёма (`effective_from`), разрешить править.  
   - **Дата окончания** (`validTo`) — необязательно для бессрочного; для контракта (и при выборе срочного) — показывать как обязательное или рекомендованное с проверкой `validTo >= validFrom`.

4. Сохранить существующий селект **«Шаблон контракта / трудового договора»** (`contractTemplateId`) для печати.

5. Инициализация state из `item.data`: `contractType`, `contractTermKind`, `validFrom`, `validTo`; при сохранении передавать их в `data` и в `buildDataByType()` для hire.

6. В `isDirty` и в снимке последнего сохранения учитывать новые поля.

7. Для **применённого** пункта приёма: либо разрешить редактирование только сроков/типа договора (с обновлением записи `contracts` в n8n), либо оставить только просмотр — решить по продукту. Рекомендация: разрешить редактирование типа и сроков и после применения (обновление `contracts` по `contract_id`).

---

### Этап 4. Сохранение пункта приказа (фронт → n8n)

**Файлы:** `hrms-web/features/documents/components/OrderItemCard.tsx`, страница/хук, вызывающий `onSave` и формирующий запрос к n8n.

- В payload для `order_items` update при типе «Приём» передавать в `payload.payload` (или в корне payload, в зависимости от текущего контракта с n8n):
  - `contractType`
  - `contractTermKind`
  - `validFrom` (рекомендуется ISO `YYYY-MM-DD` для единообразия с `effective_from`)
  - `validTo` (ISO или null)
- Не трогать существующие поля: `positionId`, `departmentId`, `templateId`, `contractTemplateId`, `leaveDays` и т.д.

Формат дат согласовать с n8n: если там ожидается только ISO, конвертировать из DD.MM.YYYY в ISO перед отправкой.

---

### Этап 5. n8n: создание контракта при применении приёма

**Описание потока (реализация в n8n):**

При обработке сохранения пункта приказа о приёме, когда выполняется **apply** (создаётся занятость и назначение):

1. После создания `employments` и `assignments` и перед финальным обновлением `order_items` (state = applied, employment_id):
   - Если в payload пункта есть данные для договора (`contractType` или `validFrom` и т.д.):
     - **INSERT** в `contracts`:  
       `branch_id` (из order или из пункта), `person_id`, `employment_id` (только что созданная), `contract_type`, `contract_term_kind`, `valid_from`, `valid_to` (NULL для бессрочного), `hire_order_item_id` = id пункта.  
       При необходимости: `doc_number`, `signed_at` — из payload или оставить пустыми.
     - Получить `id` созданной записи `contracts`.
   - В том же UPDATE `order_items` установить `contract_id` = этот id (и `state`, `employment_id`, `applied_at`, `applied_by` как сейчас).

2. Если apply не выполняется (только черновик): запись в `contracts` не создавать; `order_items.contract_id` остаётся NULL до момента apply.

3. **Редактирование применённого пункта приёма:** при update пункта с `state = applied` и переданными в payload `contractType` / `contractTermKind` / `validFrom` / `validTo` выполнять **UPDATE** записи `contracts` по `order_items.contract_id` (или по `hire_order_item_id`), обновляя только переданные поля. Так сроки и тип договора можно менять после применения.

Важно: при создании contract передавать в Supabase заголовок `Authorization: Bearer <JWT>` (из вебхука), чтобы триггеры аудита проставили `created_by`/`updated_by`.

---

### Этап 6. Ответ API и отображение привязки (опционально)

- Убедиться, что при GET пунктов приказа (или при ответе на update) в ответ входят поля `order_items.contract_id` и при необходимости данные контракта (номер, даты) для подписи в UI типа «Привязан к договору № … с … по …».
- В карточке пункта приёма при наличии `contract_id` показывать краткую подпись (например «Договор № X от DD.MM.YYYY») или оставить на следующий итерации.

---

### Этап 7. Документация и тесты

- **Обновить** `hrms-web/docs/flow-hire-order-save.md`: описать создание записи в `contracts` и проставление `order_items.contract_id` при apply; обновить раздел про изменение контракта после применения (обновление `contracts` по contract_id).
- **Обновить** `hrms-web/docs/crud-webhook-contract.md`: в примере payload для пункта приказа добавить поля `contractType`, `contractTermKind`, `validFrom`, `validTo`; описать, что при apply n8n создаёт запись в `contracts` и возвращает/устанавливает `contract_id` в пункте.
- **Обновить** `migrations/SCHEMA.md` при необходимости (раздел 3, структура payload для hire) — указать, что в payload могут передаваться данные для создания/обновления contracts.
- При наличии автотестов: добавить сценарий «сохранение пункта приёма с типом договора и сроками» и проверку, что в БД появляется запись в `contracts` и `order_items.contract_id` заполнен (если тесты дергают n8n или БД).

---

## 3. Порядок выполнения (кратко)

| № | Этап | Зависимости |
|---|------|-------------|
| 1 | Типы и константы (contractType, contractTermKind, validFrom/To) | — |
| 2 | OrderItemRow / OrderItem и маппинг (contract_id, данные в data) | 1 |
| 3 | UI в OrderItemCard (селекты и даты для приёма) | 1, 2 |
| 4 | Передача новых полей в payload при сохранении | 3 |
| 5 | n8n: создание contracts при apply, проставление contract_id; обновление contract при редактировании применённого пункта | 4 |
| 6 | API/ответ и отображение привязки к договору (опционально) | 5 |
| 7 | Документация и тесты | 5 |

---

## 4. Риски и ограничения

- **Цикл FK:** пункт приказа ссылается на contract, contract — на order_items через `hire_order_item_id`. В БД FK к order_items объявлены DEFERRABLE; в n8n порядок операций: создать contract с `hire_order_item_id` (без contract_id в order_items), затем обновить order_items, установив `contract_id`. Либо сначала обновить order_items (contract_id пока NULL), создать contract, затем снова обновить order_items (contract_id). Второй вариант проще, если contract создаётся только при apply — тогда после создания employment и contract обновляем order_items одним запросом: `contract_id`, `employment_id`, `state`, `applied_at`, `applied_by`.
- **Валидация сроков:** на фронте проверять `validTo >= validFrom`; для контракта по ТК РБ при необходимости проверять диапазон 1–5 лет (можно добавить в n8n или в отдельный этап комплаенса).
- **Шаблон печати:** `contractTemplateId` остаётся отдельно от типа документа: один шаблон может использоваться для «Контракт» или «Трудовой договор» в зависимости от настроек справочника шаблонов; при желании можно связать шаблон с contract_type в справочнике.

После выполнения плана в приказе о приёме можно будет указывать тип трудового документа и сроки действия, хранить их в БД в `contracts` и отображать привязку по `order_items.contract_id`.
