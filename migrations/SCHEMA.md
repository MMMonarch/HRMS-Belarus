# Схема БД HRMS Belarus

Схема построена **от жизненного цикла человека** с упором на сводные приказы и пункты приказов. Приказы меняют состояние занятости (приём / перевод / отпуск / командировка / прочее / увольнение); один и тот же человек может возвращаться в организацию (повторный приём).

---

## 1. Базовые принципы

### 1.1. Изоляция по филиалам (вариант A — жёстко по филиалу)

- **person** и все кадровые сущности привязаны к `branch_id`.
- Один физический человек в двух филиалах — две записи `persons` (или копия персональных данных). Максимальная простота и независимость филиалов.
- **Branch-целостность на уровне БД:** в родительских таблицах `UNIQUE(branch_id, id)`; в дочерних — композитный FK `(branch_id, parent_id) → parent(branch_id, id)`. Так ссылка на person/department/order из другого филиала невозможна даже при ошибке в коде.

### 1.2. Разделение сущностей

| Сущность | Назначение |
|----------|------------|
| **persons** | Человек: ФИО, документы, контакты. Один в рамках филиала. PII можно заполнять до приёма (цель рекрутинга). |
| **candidates** | Рекрутинг: заявка/кандидат по филиалу (status: applied → interview → offer → prehire/closed). Отдельно от занятости. |
| **employments** | Период трудовых отношений в филиале. Создаётся **только** при юридическом факте приёма (приказ). Status только **active** / **terminated** (опционально **draft** на время подготовки приказа, не «кандидат»). |
| **assignments** | Конкретная должность/отдел/ставка на период; история переводов внутри одной занятости. |

**Кандидат** = `persons` + запись в `candidates` (status до prehire/closed).  
**Приём** = приказ создаёт `employment` (active) и начальное `assignment`; кандидат при необходимости переводится в closed или удаляется из pipeline.  
**Перевод / увольнение / отпуск / командировка** допустимы только при **active** employment — валидации без ветвления по prehire.  
**Повторный приём** = новый `employment` для того же `person_id` (старый остаётся `terminated`).  

Практиканты/стажёры по ТК — `employment_type = intern`; ГПХ/подряд — отдельная ветка (engagements / civil_contracts), не в employments.

### 1.3. Приказы как источник истины (event log)

- **orders** — шапка сводного приказа.
- **order_items** — пункты приказа; при применении обновляют состояние в `employments`, `assignments`, `absence_periods`.
- Состояние в `employments` / `assignments` / `absence_periods` — **проекция**; в каждой строке хранится `basis_order_item_id` для трассировки и отмены.

---

## 2. Таблицы ядра

**Branch_id в дочерних таблицах обязателен:** композитный FK в Postgres возможен только если `branch_id` реально есть в строке дочерней таблицы. «FK через join на родителя» не делается. Поэтому **branch_id хранится во всех «дочках»** (см. список ниже), и все ссылки на сущности филиала — композитные: `(branch_id, parent_id) → parent (branch_id, id)`.

Таблицы, где явно есть **branch_id** (родители уже имеют; дочерние — обязательно добавлять):
**person_documents**, **candidates**, **employments**, **assignments**, **orders**, **order_items**, **absence_periods**, **contracts**, **contract_amendments**, **templates**.

Примеры композитных FK:  
`order_items (branch_id, order_id) → orders (branch_id, id)`;  
`order_items (branch_id, person_id) → persons (branch_id, id)`;  
`assignments (branch_id, employment_id) → employments (branch_id, id)`;  
и т.д. по всем парам дочерняя→родитель в рамках филиала.

**Автоматическое заполнение branch_id в дочках (триггеры):**  
`branch_id` в дочерних таблицах **не должен вводиться вручную** — иначе появятся «битые» строки (филиал приказа ≠ филиал человека и т.д.). Триггер BEFORE INSERT (или правило) должен **всегда** подставлять `branch_id` из родителя:

| Таблица | Источник branch_id |
|---------|--------------------|
| **order_items** | из **orders** по `order_id` |
| **assignments**, **absence_periods** | из **employments** по `employment_id` |
| **contracts** | из **persons** по `person_id` или из **order_items** (пункт приёма hire) по `hire_order_item_id` |
| **contract_amendments** | из **contracts** по `contract_id` (или из order_items по order_item_id) |
| **person_documents**, **candidates** | из **persons** по `person_id` |

Во всех таблицах, привязанных к филиалу: **UNIQUE (branch_id, id)** в родителях.

**Аудит-колонки (стандарт для бизнес-таблиц):** во всех таблицах ядра рекомендуется единый набор технических полей: `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`, `created_by uuid REFERENCES auth.users(id)`, `updated_by uuid REFERENCES auth.users(id)`. ФИО автора/редактора **не хранить** в каждой строке — брать join'ом из `profiles.full_name` (имя пользователя может измениться, дублирование даёт риски несогласованности). Исключение: если нужен юридический снимок «кто подписал/внёс» в неизменяемом виде — опционально добавить `created_by_name`, `updated_by_name` (или только на приказах/пунктах: `applied_by_name`, `signed_by_name`) и заполнять в триггере из `profiles.full_name` на момент операции. Детали — раздел 7.

### 2.1. Организационная структура (по филиалу)

| Таблица | Описание |
|---------|----------|
| **organizations** | Организация (юрлицо). |
| **branches** | Филиал; `organization_id`. Все ниже — по `branch_id`. |
| **departments** | Подразделение; `branch_id`. |
| **positions** | Должность; `branch_id`. Опционально: `position_subcategory_id` (FK → position_subcategories), grade, тариф. |

Должности и подразделения **не пересекаются** между филиалами. Категории и подкатегории должностей (**position_categories**, **position_subcategories**) привязаны к **organization_id** (не к branch_id и не глобальные): один справочник на организацию, единый для всех филиалов; RLS и редактирование по организации. Должность (positions) ссылается на подкатегорию; БД гарантирует, что подкатегория принадлежит той же организации, что и филиал должности (триггер `positions_check_subcategory_organization`).

---

### 2.2. Люди

**persons**

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| branch_id | uuid FK NOT NULL | Изоляция филиала. |
| person_no | text | Внутренний номер в филиале (опционально). |
| last_name, first_name, patronymic | text | ФИО. |
| birth_date | date | |
| gender | text/enum | По желанию. |
| citizenship_id | uuid FK | Опционально → countries. |
| id_number | text | Идентификационный номер (напр. в паспорте РБ), один на человека. |
| contact_phone, contact_email | text | |
| photo_path | text | Путь к фото в storage (Supabase Storage и т.п.). Загрузка и выдача URL — в n8n. |
| created_at, updated_at | timestamptz | |

**person_documents** (опционально, отдельная таблица)

Документы, **удостоверяющие личность и право на работу** человека: паспорт гражданина РБ, вид на жительство, удостоверение беженца, документ иностранного гражданина и т.д. Не путать с кадровыми документами (приказы) и трудовыми документами (договоры, контракты) — те см. ниже. Тип документа задаётся справочником **document_types** (см. раздел 2.8).

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| branch_id | uuid FK NOT NULL | Для композитного FK (branch_id, person_id) → persons. |
| person_id | uuid FK | |
| document_type_id | uuid FK NOT NULL | Тип документа → **document_types**. |
| series, number | text | Серия и номер (для паспорта РБ — два поля; для иных документов по необходимости). |
| issued_by, issued_at, expires_at | | Кем выдан, дата выдачи, срок действия (для ВНЖ и др.). |

---

**candidates** (рекрутинг, отдельно от занятости)

Кандидаты и этапы подбора по филиалу. Занятость (`employments`) создаётся только при приказе о приёме — так валидации «один active employment» и «перевод только при active employment» не требуют ветвления по prehire.

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| branch_id | uuid FK NOT NULL | |
| person_id | uuid FK persons NOT NULL | |
| status | enum | **applied**, **interview**, **offer**, **prehire**, **closed** |
| vacancy_id | uuid FK | Опционально → vacancies (если есть вакансии). |
| created_at, updated_at | timestamptz | |

**Ограничение:** один активный кандидат на человека в филиале — частичный UNIQUE, чтобы не создавать параллельные пайплайны на одного человека:

```sql
UNIQUE (branch_id, person_id) WHERE status != 'closed'
```

**Представление v_persons_list** — список всех лиц филиала для фильтрации в UI (неуволенные / уволенные / абсолютно все). Колонки: `persons.*`, `employment_status` ('active' | 'terminated' | NULL), `is_candidate` (boolean). Фильтр по статусу: `WHERE employment_status = 'active'` (неуволенные), `= 'terminated'` (уволенные), без условия — все.

**Триггер на persons (AFTER INSERT):** при любом INSERT в **persons** автоматически создаётся запись в **candidates** (person_id = id новой персоны, status = 'applied'). `branch_id` в candidates подставляется существующим триггером из persons. Логика «Добавить кандидата»: приложение (или n8n) делает только **INSERT в persons** из формы (фамилия, имя, отчество, филиал, контакты); триггер создаёт запись кандидата.  
**Важно:** при таком триггере каждый новый человек в persons получает запись в candidates. Если позже появятся сценарии создания персоны без кандидатуры (массовый импорт сотрудников и т.п.), потребуется либо не использовать INSERT в persons для таких случаев, либо доработать триггер (флаг или отдельная таблица «это кандидат»).

---

### 2.3. Занятость (повторные приёмы)

**employments** — период трудовых отношений в филиале (несколько периодов на одного person). Запись создаётся **только** при применении пункта приказа о приёме (юридический факт), не на этапе кандидата.

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| branch_id | uuid FK NOT NULL | |
| person_id | uuid FK persons NOT NULL | |
| employment_type | enum | main, part_time, intern (практикант/стажёр по ТК). ГПХ/подряд — отдельно (engagements/civil_contracts). |
| status | enum | **active**, **terminated** (опционально **draft** на время подготовки приказа, не «кандидат»). |
| start_date | date | |
| end_date | date | NULL пока активен. |
| termination_reason_id | uuid FK | nullable → termination_reasons. |
| hire_order_item_id | uuid FK order_items | Пункт приказа приёма (трассировка). |
| termination_order_item_id | uuid FK order_items | Пункт приказа увольнения. |
| created_at, updated_at | timestamptz | |

**Ограничение:** один активный период занятости на человека в филиале:

```sql
UNIQUE (person_id) WHERE status = 'active'
```

При повторном приёме создаётся **новая** строка `employments` со статусом `active`; старая остаётся `terminated`.

---

### 2.4. Назначения (история переводов/перемещений)

**assignments** — должность/отдел/ставка на период внутри одной занятости.

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| branch_id | uuid FK NOT NULL | |
| employment_id | uuid FK employments NOT NULL | |
| department_id | uuid FK departments | |
| position_id | uuid FK positions | |
| rate / fte | numeric | По необходимости. |
| start_date | date | |
| end_date | date | NULL пока активно. |
| basis_order_item_id | uuid FK order_items | Приём или перевод. Один пункт → одно назначение. |
| created_at, updated_at | timestamptz | |

**Ограничения:**
- Одно активное назначение на занятость: `UNIQUE (employment_id) WHERE end_date IS NULL`.
- Один пункт приказа — одно назначение (идемпотентность): `UNIQUE (basis_order_item_id)` где basis_order_item_id NOT NULL.

**Перевод (MVP):** не разрешать «вставку в середину» истории. Перевод — следующее по времени событие: `effective_from` не раньше `start_date` текущего активного назначения; при применении закрывается текущее assignment (end_date), создаётся новое.

---

### 2.5. Приказы: сводный приказ + пункты

**template_types** — справочник типов шаблонов. Номер типа **уникален** (один number — одна запись). Номер 1 = шаблоны для сводного приказа (шапка); в **templates** поле **template_type** хранит этот number.

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| number | int UNIQUE | Номер типа; можно менять вручную. В таблице **templates** в поле **template_type** выбирается это значение. Уникален в рамках таблицы. |
| name | text NOT NULL | Имя типа шаблона (напр. «Шапка сводного приказа», «Пункт приказа»). |
| created_at | timestamptz NOT NULL DEFAULT now() | Момент создания. |
| updated_at | timestamptz NOT NULL DEFAULT now() | Момент последнего изменения. |
| created_by | uuid FK auth.users | Автор создания. |
| updated_by | uuid FK auth.users | Автор последнего изменения. |

**templates** — шаблоны по филиалу (branch_id). Тип задаётся полем **template_type** (number из template_types). Один набор шаблонов на филиал.

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| branch_id | uuid FK branches NOT NULL | Филиал: шаблоны общие на филиал. |
| name | text NOT NULL | Название шаблона для выбора в UI. |
| template_html | jsonb | Содержимое/разметка шаблона (структурированные данные: блоки, плейсхолдеры, HTML-фрагменты и т.д.). |
| template_type | int NOT NULL | Номер типа шаблона (значение **template_types.number**). |
| created_at, updated_at | timestamptz | Аудит. |
| created_by, updated_by | uuid FK auth.users | |

UNIQUE(branch_id, id). В **orders** поле **template_id** ссылается на запись в **templates**; триггер проверяет, что шаблон принадлежит тому же филиалу, что и приказ.

**orders** — шапка сводного приказа.

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| branch_id | uuid FK NOT NULL | Приказы по филиалу. |
| template_id | uuid FK templates NOT NULL | Шаблон сводного приказа (ссылка на templates). |
| visa_template_id | uuid FK templates | Шаблон виз сводного приказа (templates с template_type = тип «Визы сводного приказа»). NULL — не выбран. |
| order_register_id | uuid FK order_registers | Журнал, в котором регистрируется приказ (литера «к»/«л», срок хранения). NULL до регистрации. |
| order_date | date | Дата приказа. |
| effective_date | date | Опционально «вступает в силу». |
| reg_seq | int | Порядковый номер в журнале за год. **NULL, пока status = draft;** при регистрации заполняется из order_registers.last_seq. |
| reg_number | text | Материализованный регистрационный индекс, напр. «28-к», «15-л». **NULL, пока status = draft.** |
| status | enum | draft, registered, signed, canceled |
| title, note | text | |
| print_output | jsonb | Созданный печатный вариант сводного приказа (структурированные данные или HTML-фрагменты). NULL до генерации. |
| created_by | uuid FK auth.users | |
| created_at, updated_at | timestamptz | |

**Инварианты регистрации (CHECK / триггеры):**

1. **Год журнала:** дата приказа должна попадать в год журнала. Правило: `EXTRACT(YEAR FROM order_date) = (SELECT year FROM order_registers WHERE id = order_register_id)`. Иначе возможны «номера 2026» у приказа датой 2025. Проверка триггером или при регистрации.
2. **Уникальность номера:** `UNIQUE (order_register_id, reg_seq)` (при reg_seq NOT NULL); при необходимости дополнительно `UNIQUE (branch_id, reg_number)` в рамках журнала/года в зависимости от формата.
3. **Статусы и регистрация:** `reg_seq` и `reg_number` должны быть NULL, пока `status` не в (registered, signed); после перехода в registered/signed — NOT NULL.  
   CHECK: `(status IN ('registered', 'signed')) = (reg_seq IS NOT NULL AND reg_number IS NOT NULL)` (или эквивалент: draft ⇒ reg_seq IS NULL AND reg_number IS NULL).

**order_registers** — журнал/серия регистрации (отдельно от вида приказа: один шаблон может регистрироваться в разных журналах; в Беларуси разные литеры «к»/«л» и сроки хранения).

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| branch_id | uuid FK NOT NULL | |
| register_code | text | Код журнала, напр. K, L, K-1, L-OTPUSK. |
| suffix | text | Суффикс к регистрационному индексу, напр. «-к», «-л». |
| retention_group | text/enum | Долгое/краткосрочное хранение или срок (для делопроизводства). |
| year | int | |
| last_seq | int | Последний выданный номер в этом журнале за год. |
| prefix | text | Опционально (префикс к номеру). |
| number_format | text | Опционально: правило формирования reg_number (например «{seq}{suffix}»). |
| UNIQUE (branch_id, register_code, year) | | |

**Регистрация приказа — одна функция, одна транзакция.**  
Иначе при конкуренции возможны одинаковые номера. Регистрация должна быть атомарной:

1. `UPDATE order_registers SET last_seq = last_seq + 1 WHERE id = :register_id RETURNING last_seq` (блокировка строки журнала).
2. В той же транзакции: запись в `orders` полей `order_register_id`, `reg_seq`, `reg_number` (по формату журнала), `status = 'registered'` (или `signed`).

Реализовать одной функцией/процедурой; вызывать её при переходе приказа из draft в registered. Не разносить шаги по разным транзакциям.

---

**order_item_types** — справочник типов пунктов приказа. В **order_items** хранится номер типа (1–5).

| number | name |
|--------|------|
| 1 | Приём |
| 2 | Перевод/перемещение |
| 3 | Приказ об отпуске |
| 4 | Прочий приказ |
| 5 | Увольнение |

Пункт-отмена (реверс) — тот же номер 4 (прочий) с заполненным **reverses_item_id** (см. раздел 4).

**order_item_subtypes** — справочник подтипов пунктов приказа, привязанных к типу (order_item_types). Для типа «Приказ об отпуске» (3): трудовой отпуск, соц без сохранения, соц оплачиваемый, прерывание отпуска. Для «Прочий приказ» (4) и других типов подтипы при необходимости добавляются так же.

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| order_item_type_id | uuid FK order_item_types NOT NULL | Тип пункта приказа, к которому относится подтип. |
| code | text NOT NULL | Код для логики/API (латиница). UNIQUE в паре с order_item_type_id. |
| name | text NOT NULL | Наименование для UI. |
| sort_order | int | Порядок вывода в селектах. |

В **order_items** подтип хранится в **item_subtype_id** (FK → order_item_subtypes). Триггер проверяет, что подтип принадлежит выбранному типу пункта; при смене типа пункта подтип от другого типа сбрасывается.

**order_items** — пункты приказа (по человеку).

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| branch_id | uuid FK NOT NULL | Обязателен для композитных FK (order_id, person_id, employment_id, …). |
| order_id | uuid FK orders NOT NULL | Композитный FK: (branch_id, order_id) → orders (branch_id, id). |
| line_no | int | Порядок в приказе. |
| person_id | uuid FK persons NOT NULL | Композитный FK: (branch_id, person_id) → persons (branch_id, id). |
| employment_id | uuid FK | Заполняется в зависимости от типа. Композитный FK при наличии. |
| item_type_number | int FK order_item_types(number) | Номер типа пункта (1–5), см. **order_item_types**. |
| item_subtype_id | uuid FK order_item_subtypes | Подтип пункта (опционально); должен соответствовать item_type_number (триггер). |
| reverses_item_id | uuid FK order_items | Для пункта-отмены: ссылка на отменяемый пункт. |
| reversed_by_item_id | uuid FK order_items | Заполняется при apply пункта cancel в отменённом пункте — обратная ссылка. |
| effective_from | date | Начало действия пункта. |
| effective_to | date | NULL для приёма/перевода/увольнения; для отпуска/командировки — конец периода. |
| payload | jsonb | Параметры пункта. После applied не менять (триггер или политика приложения). |
| contract_id | uuid FK contracts | Для пункта **приёма**: привязка к договору/контракту. |
| contract_amendment_id | uuid FK contract_amendments | Для пункта **перевода** или приказа о доп. соглашении/продлении. |
| state | enum | **draft**, **applied**, **voided** |
| applied_at, applied_by | timestamptz, uuid | |
| voided_at, voided_by, void_reason | | При отмене пункта. |

**CHECK по item_type_number (минимальный набор):**

| number | Условия |
|--------|---------|
| 1 (Приём) | `effective_from IS NOT NULL`. employment_id до применения NULL. |
| 2 (Перевод) | `employment_id IS NOT NULL`, `effective_from IS NOT NULL`. |
| 3 (Отпуск) | `employment_id IS NOT NULL`, `effective_from IS NOT NULL`, `effective_to IS NOT NULL`, `effective_to >= effective_from`. |
| 5 (Увольнение) | `employment_id IS NOT NULL`, `effective_from IS NOT NULL`. |

**Триггер «один приём на активную занятость»:** BEFORE INSERT OR UPDATE на **order_items** (`order_items_hire_check_no_active_employment`): запрещает создать или перевести пункт в тип «Приём» (item_type_number = 1), если у этого лица (person_id, branch_id) уже есть активная занятость в employments, кроме занятости, созданной этим же пунктом (hire_order_item_id = id пункта). Повторный приём возможен только после увольнения.

**Триггер «дата начала приёма → занятость и назначение»:** AFTER UPDATE OF effective_from на **order_items** (`order_items_hire_sync_effective_from_to_employment`): при изменении даты начала у применённого пункта приёма (item_type_number = 1, state = applied) обновляет `employments.start_date` и `assignments.start_date`, чтобы «Принят» и «Вступил в должность» в карточке сотрудника совпадали с приказом.

**Триггеры перевода (item_type_number = 2):** (1) AFTER UPDATE OF effective_from (`order_items_transfer_sync_effective_from`): при изменении даты применённого перевода обновляет `start_date` назначения, созданного этим пунктом, и `end_date` предыдущего назначения. (2) BEFORE DELETE (`order_items_transfer_before_delete_revert_assignment`): при удалении применённого пункта перевода удаляет назначение и «сшивает» цепочку: если есть следующий перевод (приём → перевод 3-го → перевод 5-го), предыдущее назначение получает end_date = дата следующего; если следующего нет — раскрывает предыдущее (end_date = NULL).

**Один перевод на дату по занятости:** частичный UNIQUE-индекс `order_items_transfer_one_per_employment_date` по (employment_id, effective_from) WHERE item_type_number = 2 AND state = 'applied' — запрещает два применённых пункта перевода по одной занятости с одной датой начала (иначе при изменении даты одного из них триггер синхронизации дат даёт неоднозначность «предыдущего» назначения).

| Пункт-отмена | `reverses_item_id IS NOT NULL` (тип 4 «Прочий» с заполненным reverses_item_id). |

**CHECK state / applied_at / voided_at (связность):**

- `state = 'draft'` ⇒ `applied_at IS NULL` AND `voided_at IS NULL`.
- `state = 'applied'` ⇒ `applied_at IS NOT NULL` AND `voided_at IS NULL`.
- `state = 'voided'` ⇒ `voided_at IS NOT NULL` (и обычно `applied_at IS NOT NULL`, если voided = «применили и отменили»).

**Правила применения:** переход `draft → applied` атомарно в одной транзакции с обновлением проекций; один пункт → одна проекция (UNIQUE(basis_order_item_id)); в employments опционально UNIQUE(hire_order_item_id), UNIQUE(termination_order_item_id).

---

### 2.6. Отсутствия (отпуска, командировки)

**absence_periods** — периоды отсутствия по занятости.

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| branch_id | uuid FK NOT NULL | |
| employment_id | uuid FK employments NOT NULL | |
| absence_type | enum | **leave**, **travel** |
| subtype | text | annual_leave, sick_leave, business_trip и т.д. |
| start_date, end_date | date | |
| period | daterange | Вычисляемое или хранимое: `daterange(start_date, end_date, '[]')` — для exclusion constraint. |
| basis_order_item_id | uuid FK order_items | Один пункт → один период; UNIQUE(basis_order_item_id). |
| status | enum | active, canceled |
| created_at, updated_at | timestamptz | |

**Ограничение на непересечение:** для одного `employment_id` и одного типа (leave/travel) периоды не должны пересекаться. В Postgres — exclusion constraint (GiST) по `period` (daterange), с учётом status = active.

**Включительность daterange:** использовать `daterange(start_date, end_date, '[]')` — обе границы включаются. Отпуск «с 1 по 14» тогда включает и 1-е, и 14-е число; это обычно ожидаемо в HR. Важно один раз выбрать стандарт и придерживаться его во всех вычислениях дней (пересечения, количество дней и т.д.); при полуинтервалах `[)` логика пересечений иная.

**Частичная отмена:** при отмене пункта отпуска/командировки — `status = canceled` или корректировка диапазона; единообразно с остальными проекциями.

---

### 2.7. Трудовые документы (договоры, контракты, доп. соглашения)

**Трудовые документы** — трудовой договор, контракт, доп. соглашение к контракту, продление контракта. Привязываются к пунктам приказов: приём (договор/контракт) и перевод или отдельный приказ (доп. соглашение, продление).

**contracts** — трудовой договор или контракт (основной документ при приёме).

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| branch_id | uuid FK NOT NULL | |
| person_id | uuid FK persons NOT NULL | |
| employment_id | uuid FK employments | Заполняется после применения приказа о приёме. |
| contract_type | enum | **employment_contract** (трудовой договор), **contract** (контракт по ТК РБ). |
| contract_term_kind | enum | **Вид по сроку/основанию (ТК РБ):** **indefinite** — на неопределённый срок (бессрочный); **fixed_term** — срочный на определённый срок (до 5 лет); **fixed_term_work** — на время выполнения определённой работы; **fixed_term_replacement** — на время исполнения обязанностей временно отсутствующего; **seasonal** — на время сезонных работ; **contract** — контракт (срочный 1–5 лет, письменная форма, Декрет № 29 и др.). NOT NULL, default 'indefinite'. |
| doc_number | text | Номер договора/контракта. |
| signed_at | date | Дата заключения. |
| valid_from | date | Начало действия. |
| valid_to | date | **Актуальный** срок окончания: для контракта обновляется при применении продления (contract_amendments extension); для трудового договора — NULL. Не смешивать с «исходным» сроком: история продлений — в contract_amendments. |
| hire_order_item_id | uuid FK order_items | Пункт приказа о приёме, к которому привязан этот договор. |
| storage_path | text | Опционально: путь к файлу в storage. |
| created_at, updated_at | timestamptz | |

Один пункт приёма — не более одного привязанного договора/контракта (связь 1:1 через `hire_order_item_id` или `order_items.contract_id`). Поле **contract_term_kind** задаёт вид договора по сроку/основанию для отчётов и комплаенса; **contract_type** по-прежнему различает «трудовой договор» и «контракт».

**contract_amendments** — доп. соглашение или продление контракта (журнал изменений).

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| branch_id | uuid FK NOT NULL | |
| contract_id | uuid FK contracts NOT NULL | К какому контракту/договору. |
| amendment_type | enum | **amendment** (доп. соглашение — перевод, изменение условий), **extension** (продление контракта) |
| order_item_id | uuid FK order_items | Пункт приказа (перевод или приказ о продлении/доп. соглашении). |
| doc_number | text | Номер доп. соглашения. |
| signed_at | date | |
| valid_from, valid_to | date | Для продления — новый срок; при применении extension обновлять `contracts.valid_to`. |
| payload | jsonb | Опционально: что изменилось (должность, отдел, оклад и т.д.). |
| storage_path | text | Опционально: путь к файлу. |
| created_at, updated_at | timestamptz | |

**Альтернатива (если нужна неизменяемая история):** хранить в `contracts.valid_to` только исходный срок; актуальный срок вычислять по последнему extension (view/materialized view). В данной схеме принято: `contracts.valid_to` = актуальный срок, обновляется при apply extension.

**ГПХ/подряд:** не моделировать как `employment_type = contractor`. Отдельная ветка: например **engagements** или **civil_contracts** с привязкой к persons и своими приказами/основаниями (если фиксируются).

Связь с пунктами приказов: в **order_items** — **contract_id** (приём), **contract_amendment_id** (перевод/доп. соглашение/продление).

Сценарии:
- **Приказ о приёме**: создаётся запись в `contracts`, в пункте — `contract_id`.
- **Приказ о переводе по контракту**: запись в `contract_amendments` (amendment), в пункте перевода — `contract_amendment_id`.
- **Продление контракта**: запись в `contract_amendments` (extension), в пункте — `contract_amendment_id`; при применении обновить `contracts.valid_to`.

---

### 2.8. Справочники

| Таблица | Назначение |
|---------|------------|
| **document_types** | Типы документов, удостоверяющих личность (для person_documents): паспорт РБ, ВНЖ, удостоверение беженца и т.д. Глобальный справочник (без branch_id). |
| **termination_reasons** | Причины увольнения (для employments.termination_reason_id). |
| **order_item_subtypes** | Подтипы пунктов приказа по типам (отпуск: трудовой/соц без сохр./соц оплач./прерывание; прочий — при необходимости). См. **order_item_types**. |
| **countries** | Государства (гражданство в **persons**). Глобальный справочник по стандарту **ISO 3166-1** (коды стран). |
| **position_categories** | Категории должностей (Руководители, Специалисты, Служащие, Рабочие и т.д.). **По организации** (`organization_id`), не по филиалу и не глобальные. Редактируются в UI; RLS по organization_id. |
| **position_subcategories** | Подкатегории должностей (напр. «Главные специалисты» → категория «Специалисты»). **По организации** (`organization_id`); `organization_id` должен совпадать с категорией (триггер). |
| **templates** | Шаблоны по филиалу (branch_id): шапка сводного приказа (order_header), пункт приказа (order_item), документ для печати (document). Поля: branch_id, name, template_html (jsonb), template_type. |

**document_types** — типы документов, удостоверяющих личность и право на работу (персона). Глобальный справочник: один набор для всех филиалов. Поля: id, **code** (text UNIQUE — для логики/API: passport_by, residence_permit, refugee_id, foreign_passport, birth_certificate, other), **name** (text NOT NULL — наименование для UI), sort_order (int — порядок в селектах). Рекомендуемый начальный набор для Беларуси: «Паспорт гражданина Республики Беларусь» (passport_by), «Вид на жительство в Республике Беларусь» (residence_permit), «Удостоверение беженца» (refugee_id), «Свидетельство о рождении» (birth_certificate), «Документ иностранного гражданина» (foreign_passport), «Иной документ» (other). В **person_documents** хранится **document_type_id** (FK → document_types).

**countries** — справочник государств (гражданство в **persons**). Глобальный справочник, один набор для всех филиалов. Стандарт **ISO 3166-1** (Country codes): официальные коды стран, поддерживаются ООН и используются в паспортах, доменах, банковских реквизитах. Рекомендуемая структура таблицы: id (uuid PK), **alpha2** (text UNIQUE NOT NULL — двухбуквенный код ISO 3166-1 alpha-2, основной формат: BY, RU, US, PL и т.д.), **name** (text NOT NULL — краткое наименование страны для UI, желательно на русском или из официального списка ООН), **alpha3** (text UNIQUE — трёхбуквенный код ISO 3166-1 alpha-3, опционально: BLR, RUS, USA), **numeric3** (smallint — трёхзначный числовой код ISO 3166-1 numeric, опционально: 112, 643, 840), sort_order (int — порядок вывода в селектах, опционально). В **persons** хранится **citizenship_id** (FK → countries, nullable). Начальное заполнение — из официального списка ISO/ООН (249 территорий) или подмножество (например, страны СНГ + основные партнёры). Обновления кодов — по релизам ISO 3166 (ISO Online Browsing Platform, ежегодные обновления).

**position_categories** — id, **organization_id** (FK organizations NOT NULL), name, created_at, updated_at, created_by, updated_by.

**position_subcategories** — id, category_id (FK position_categories NOT NULL), **organization_id** (FK organizations NOT NULL), name, аудит. Ограничение: `organization_id` = organization_id категории (триггер `position_subcategories_check_organization_matches_category`). Должность (positions) ссылается на подкатегорию: `positions.position_subcategory_id` → position_subcategories(id), nullable, ON DELETE SET NULL. **Целостность:** должность филиала не может ссылаться на подкатегорию чужой организации — триггер `positions_check_subcategory_organization` (branch.organization_id = position_subcategories.organization_id).

---

## 3. Структура payload (order_items.payload) по типам пунктов

| item_type | Пример полей в payload |
|-----------|-------------------------|
| **hire** | employment_type, department_id, position_id, rate/fte, probation_end_date; привязка к договору — **contract_id** или создание договора (данные для contracts). |
| **transfer** | from_assignment_id (опц.), to_department_id, to_position_id, rate/fte; при переводе по контракту — **contract_amendment_id** (доп. соглашение). |
| **leave** | Подтип — **item_subtype_id** (FK order_item_subtypes). В payload: start_date, end_date, days_count, periods (и др.). |
| **travel** | destination, start_date, end_date, purpose |
| **misc** | произвольная структура + текст |
| **termination** | termination_reason_id, last_working_day, compensation_days |
| **cancel** | reverses_item_id (обязательно); домен отмены определяется типом отменяемого пункта (см. раздел 4). |

Критичные для индексов/валидации поля при необходимости дублировать отдельными колонками (например `target_department_id`, `target_position_id`).

---

## 4. Отмена приказа / отмена пункта (реверс)

Отменяется **юридический эффект конкретных пунктов**, а не «приказ целиком». Реверс формализован как отдельный тип пункта с жёсткими правилами применимости.

### 4.1. Тип пункта cancel

- **item_type = cancel** (реверс).
- **reverses_item_id** — ссылка на отменяемый пункт (обязательно для cancel).
- **reversed_by_item_id** — заполняется при apply пункта cancel в отменённом пункте (обратная ссылка для навигации).

**Ограничения на отмену:**
- Один пункт может быть отменён только один раз: `UNIQUE (reverses_item_id)` среди пунктов с `item_type = 'cancel'` (один cancel — один отменяемый пункт).
- Запрет циклов: `reverses_item_id` не может ссылаться на пункт с `item_type = cancel`, и не может ссылаться на пункт, уже находящийся «в цепочке отмен». Для MVP достаточно запрета cancel→cancel (CHECK или триггер).

Новый приказ (например по шаблону «прочее» или отдельный отмена) содержит пункты с `item_type = cancel` и `reverses_item_id = <id отменяемого пункта>`.

### 4.2. Совместимость доменов при отмене

При применении cancel проверять **совместимость доменов**: отмена действует только на «свой» тип эффекта.

| Отменяемый пункт (item_type) | Действие при применении cancel |
|------------------------------|---------------------------------|
| **hire** | Закрыть employment (end_date = дата признания недействительным). |
| **transfer** | Закрыть назначение, созданное этим пунктом; восстановить предыдущее (или новое назначение «обратно»). |
| **leave / travel** | `absence_periods.status = canceled` (или скорректировать диапазон). |
| **termination** | «Восстановление» = новый employment + ссылка на отменённый пункт. |

**cancel transfer** отменяет только пункт типа transfer; **cancel leave** — только leave; и т.д. Нельзя отменить пункт приёма пунктом cancel leave.

### 4.3. Режим применения реверса (MVP — режим A)

**Режим A (рекомендуется для MVP):** отменить можно только **последнее** применённое событие в домене.

- Для employment: отменяемый пункт — последний применённый, изменивший это employment (hire или termination).
- Для assignments: отменяемый пункт — тот, который создал текущее активное назначение (последний transfer или hire).
- Для absence_periods: отменяемый пункт — тот, который создал данный период.

**Плюсы:** однозначность, простое восстановление предыдущего состояния. **Минусы:** меньше гибкости (нельзя «вырезать» произвольное событие из середины).

**Режим B (сложный):** компенсирующие события — отмена не откатывает, а создаёт новое событие, переписывающее проекцию (например, «назначение обратно» как новый transfer). Требует темпоральной модели и аккуратной обработки конфликтов; не для MVP.

В проекциях везде хранить `basis_order_item_id`; при отмене — единообразно `status = canceled` или закрытие интервалов.

### 4.4. Детерминированное «что откатывать» в apply(cancel)

При применении cancel однозначно находить объект для отката по отменяемому пункту:

| Отменяемый item_type | Что искать при откате |
|----------------------|------------------------|
| **hire** | employment по `hire_order_item_id = reverses_item_id`. |
| **termination** | employment по `termination_order_item_id = reverses_item_id`. |
| **transfer** | assignment с `basis_order_item_id = reverses_item_id` (закрыть его, восстановить предыдущее или создать «назначение обратно»). |
| **leave**, **travel** | запись в absence_periods с `basis_order_item_id = reverses_item_id` (status = canceled). |

Так отмена остаётся безопасной и трассируемой.

---

## 5. Валидации и branch-целостность на уровне БД

### 5.1. Композитные FK (branch-изоляция)

Чтобы ссылка на person/department/order из другого филиала была невозможна даже при ошибке в коде:

- **Родительские таблицы** (branches, persons, departments, positions, orders, employments, …):  
  `UNIQUE (branch_id, id)`.
- **Дочерние таблицы:** композитный FK  
  `(branch_id, parent_id) REFERENCES parent (branch_id, id)`.

Примеры: `order_items (branch_id, person_id) → persons (branch_id, id)`; `assignments (branch_id, employment_id) → employments (branch_id, id)`. Во всех таблицах, где есть ссылка на сущность «своего» филиала, хранить `branch_id` и использовать композитный FK.

### 5.2. Циклические ссылки (order_items ↔ проекции): DEFERRABLE FK

Есть циклы: пункт приказа ссылается на person/employment; проекции (employments, assignments, absence_periods, contracts) ссылаются обратно на пункт через `hire_order_item_id`, `basis_order_item_id`, `termination_order_item_id` и т.д. Это нормально для event-log, но в одной транзакции apply() порядок операций жёсткий: вставка пункта → создание проекции → обновление обратных ссылок. Чтобы не зависеть от порядка и упростить атомарный apply(), **все FK вида «проекция → пункт» и self-FK в order_items** (reverses_item_id, reversed_by_item_id) объявить **DEFERRABLE INITIALLY DEFERRED**. Тогда проверка FK выполняется в конце транзакции (COMMIT), а не после каждой строки.

Конкретно:  
- employments: `hire_order_item_id`, `termination_order_item_id` → order_items — DEFERRABLE INITIALLY DEFERRED.  
- assignments: `basis_order_item_id` → order_items — DEFERRABLE INITIALLY DEFERRED.  
- absence_periods: `basis_order_item_id` → order_items — DEFERRABLE INITIALLY DEFERRED.  
- contracts: `hire_order_item_id` → order_items — DEFERRABLE INITIALLY DEFERRED.  
- contract_amendments: `order_item_id` → order_items — DEFERRABLE INITIALLY DEFERRED.  
- order_items: `reverses_item_id`, `reversed_by_item_id` → order_items — DEFERRABLE INITIALLY DEFERRED.

В начале транзакции apply при необходимости выполнить `SET CONSTRAINTS ... DEFERRED` для этих ограничений (если не INITIALLY DEFERRED везде).

### 5.3. Остальные ограничения

1. **Один активный employment на person (в филиале):** `UNIQUE (person_id) WHERE status = 'active'` (в employments).
2. **Одно активное назначение на employment:** `UNIQUE (employment_id) WHERE end_date IS NULL` (в assignments).
3. **Один пункт → одна проекция:** `UNIQUE (basis_order_item_id)` в assignments и в absence_periods (где basis_order_item_id NOT NULL).
4. **Пункт не применяется дважды:** переход `state: draft → applied` атомарно в одной транзакции с обновлением проекций; при необходимости триггер/ограничение.
5. **Перевод/увольнение только при active employment:** проверка при apply (и при необходимости триггер).
6. **Отсутствия:** exclusion constraint (GiST) по `period` (daterange) для одного employment_id и типа — запрет пересечений активных периодов.

**Альтернатива отложенным FK:** придерживаться строгого порядка в apply(): сначала вставка/обновление пункта, затем создание проекции, затем проставление обратных ссылок в проекциях. Тогда цикл не ломается пошагово, но логика приложения жёстко привязана к порядку; DEFERRABLE снимает это ограничение.

---

## 6. Итоговый список таблиц (скелет)

| Группа | Таблицы |
|--------|---------|
| Организация | organizations, branches, departments, positions |
| Люди | persons, person_documents, **candidates** |
| Занятость | employments, assignments |
| Приказы | templates, orders, order_items, order_registers |
| Трудовые документы | contracts, contract_amendments |
| Отсутствия | absence_periods |
| Справочники | **document_types**, termination_reasons, leave_types (опц.), countries (опц.), vacancies (опц.), **position_categories**, **position_subcategories** (по organization_id) |
| Пользователи и доступ | **profiles**, **user_roles** (см. раздел 7) |

Дополнительно: ГПХ/подряд — **engagements** / **civil_contracts** (отдельно от employments).

---

## 7. Пользователи, аудит, роли и RLS

### 7.1. Аудит-колонки (технические поля)

**Минимальный стандарт для всех бизнес-таблиц:**

| Колонка | Тип | Описание |
|---------|-----|----------|
| created_at | timestamptz NOT NULL DEFAULT now() | |
| updated_at | timestamptz NOT NULL DEFAULT now() | |
| created_by | uuid NULL REFERENCES auth.users(id) | Автор создания. |
| updated_by | uuid NULL REFERENCES auth.users(id) | Автор последнего изменения. |

**Почему не хранить ФИО автора/редактора прямо в строке:** имя пользователя может измениться → исторические строки «поедут»; дублирование даёт лишние обновления и несогласованность. Для UI достаточно join'ом брать `profiles.full_name`.

**Когда хранить снимок ФИО (опционально):** если важен юридический снимок «кто подписал/внёс» в неизменяемом виде, а не «текущий профиль», добавить `created_by_name text NULL`, `updated_by_name text NULL` и заполнять в триггере на INSERT/UPDATE из `profiles.full_name` (снимок на момент операции). На практике для приказов/пунктов часто делают снимок имени только у **applied_by** / **signed_by**, а не на каждой таблице.

### 7.2. Где хранить пользователей и ФИО (Supabase)

- **auth.users** — идентичность (логин, пароль, провайдеры).
- **profiles** — человекочитаемые поля пользователя системы.

Пример: `profiles (id uuid PK REFERENCES auth.users(id), full_name text, email text, …)`.

**Не путать:** ФИО сотрудника HRMS (**persons**) и ФИО пользователя системы (**profiles**) — разные домены.

### 7.3. Роли: одна таблица user_roles

Роли: **global_admin**, **branch_admin**, **hr**, **viewer**. Роль всегда в контексте филиала, кроме global_admin.

**user_roles**

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | uuid PK | |
| user_id | uuid NOT NULL REFERENCES auth.users(id) | |
| role | text NOT NULL | **global_admin**, **branch_admin**, **hr**, **viewer** (или enum). |
| branch_id | uuid NULL REFERENCES branches(id) | NULL разрешён **только** для global_admin. |
| created_at | timestamptz | |

**Ограничения:**

- `UNIQUE (user_id, role, branch_id)`.
- `CHECK ( (role = 'global_admin') = (branch_id IS NULL) )` — global_admin без филиала; остальные роли строго с филиалом.

Плюсы: просто, прозрачно, легко расширять. На MVP достаточно ролей; при необходимости позже добавить таблицу permissions («может применять приказы», «может видеть PII» и т.д.).

**Не делать:** не хранить роль как enum-колонку прямо в profiles — сломается, когда пользователь в двух филиалах с разными ролями.

### 7.4. Автоматическое проставление created_by / updated_by (триггер)

Один общий триггер на INSERT: `created_at = now()`, `updated_at = now()`, `created_by = auth.uid()`, `updated_by = auth.uid()`.  
На UPDATE: `updated_at = now()`, `updated_by = auth.uid()`.

В Supabase `auth.uid()` доступен в SQL-функциях в контексте запроса (при корректной настройке). Это снимает необходимость доверять фронту/беку в передаче «кто изменил».

### 7.5. RLS (Row Level Security): привязка к роли и branch_id

База строго по `branch_id`, поэтому большинство политик строятся одинаково.

**SELECT** разрешить, если:

- пользователь имеет роль **global_admin**, или  
- есть запись в **user_roles** с `branch_id = row.branch_id` и ролью в (branch_admin, hr, viewer).

**INSERT / UPDATE / DELETE** — по ролям:

- **branch_admin:** почти всё в своём филиале (при необходимости исключить «суперопасные» операции).
- **hr:** CRUD кадровых сущностей в своём филиале; при необходимости ограничить (например, не менять справочники/журналы регистрации).
- **viewer:** только SELECT.

**Критично:** политика должна проверять **branch_id строки** (row.branch_id), а не переданный параметр запроса.

**PII (персональные данные):** так как в Supabase нет column-level security, чувствительные данные (person_documents, адреса, паспорт и т.п.) лучше держать в отдельных таблицах и для них задать более жёсткие RLS: только **hr** и **branch_admin**; для **viewer** — запрет SELECT по этим таблицам (или отдельная политика «маскирование» через view, если нужно).

### 7.6. Рекомендованный набор таблиц для пользователей

| Таблица | Назначение |
|---------|------------|
| **profiles** | ФИО и контакты пользователя системы (id → auth.users). |
| **user_roles** | Роли: глобальная (global_admin) или по филиалу (branch_id + role). |

Опционально **branch_memberships** — если позже понадобится отдельно «членство в филиале» и отдельно «роль»; на MVP можно не вводить.

### 7.7. Чего не делать

- Не писать «ФИО создателя/редактора» в каждой строке как обязательные поля — только user_id; имя показывать через join или вьюху.
- Не делать роли enum-колонкой в profiles (один пользователь — несколько филиалов с разными ролями).
