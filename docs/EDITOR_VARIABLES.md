# Переменные шаблона — формат данных от n8n

Редактор шаблонов использует **переменные** — плейсхолдеры `{{path}}`, которые при генерации документа заменяются на реальные значения. Данные для подстановки приходят от n8n в виде плоского JSON-объекта с вложенными группами.

## Общий формат

n8n отправляет объект `variableData` — плоскую структуру с группами верхнего уровня. Внутри каждой группы — конкретные поля. Путь переменной в шаблоне соответствует ключам объекта через точку: `группа.поле`.

```jsonc
{
  "employee": { ... },
  "order":    { ... },
  "assignment": { ... },
  "organization": { ... },
  "branch":   { ... }
}
```

## Полная схема переменных

### Группа `employee` — данные сотрудника

Источник: таблица `persons`.

| Путь | Тип | Описание | Пример |
|------|-----|----------|--------|
| `employee.lastName` | string | Фамилия | `"Иванов"` |
| `employee.firstName` | string | Имя | `"Пётр"` |
| `employee.patronymic` | string | Отчество | `"Сергеевич"` |
| `employee.birthDate` | date | Дата рождения (ISO 8601) | `"1990-05-15"` |
| `employee.idNumber` | string | Идентификационный номер | `"3150590A001PB5"` |

### Группа `order` — данные приказа

Источник: таблица `orders`.

| Путь | Тип | Описание | Пример |
|------|-----|----------|--------|
| `order.regNumber` | string | Регистрационный номер приказа | `"К-42/2026"` |
| `order.orderDate` | date | Дата приказа (ISO 8601) | `"2026-02-20"` |
| `order.effectiveDate` | date | Дата вступления в силу (ISO 8601) | `"2026-03-01"` |
| `order.title` | string | Заголовок приказа | `"О приёме на работу"` |

### Группа `assignment` — назначение (должность/подразделение)

Источник: таблица `assignments` + JOIN `departments`, `positions`.

| Путь | Тип | Описание | Пример |
|------|-----|----------|--------|
| `assignment.department` | string | Название подразделения | `"Отдел кадров"` |
| `assignment.position` | string | Название должности | `"Ведущий специалист"` |
| `assignment.rate` | number | Ставка (доля) | `1.0` |

### Группа `organization` — организация

Источник: таблица `organizations`.

| Путь | Тип | Описание | Пример |
|------|-----|----------|--------|
| `organization.name` | string | Полное название организации | `"ООО «Альфа Групп»"` |

### Группа `branch` — филиал

Источник: таблица `branches`.

| Путь | Тип | Описание | Пример |
|------|-----|----------|--------|
| `branch.name` | string | Название филиала | `"Минский филиал"` |

## Полный пример JSON от n8n

```json
{
  "employee": {
    "lastName": "Иванов",
    "firstName": "Пётр",
    "patronymic": "Сергеевич",
    "birthDate": "1990-05-15",
    "idNumber": "3150590A001PB5"
  },
  "order": {
    "regNumber": "К-42/2026",
    "orderDate": "2026-02-20",
    "effectiveDate": "2026-03-01",
    "title": "О приёме на работу"
  },
  "assignment": {
    "department": "Отдел кадров",
    "position": "Ведущий специалист",
    "rate": 1.0
  },
  "organization": {
    "name": "ООО «Альфа Групп»"
  },
  "branch": {
    "name": "Минский филиал"
  }
}
```

## Типы данных и форматирование

| Тип | Формат в JSON | Форматирование на фронте |
|-----|---------------|--------------------------|
| `string` | Строка как есть | Без изменений |
| `number` | Число (целое или дробное) | `String(value)` |
| `date` | ISO 8601: `"YYYY-MM-DD"` или `"YYYY-MM-DDTHH:mm:ss"` | По формату из схемы, по умолчанию `dd.MM.yyyy` |
| `boolean` | `true` / `false` | `String(value)` |

Даты **обязательно** передавать в формате ISO 8601. Фронтенд парсит их через `new Date(value)` и форматирует по шаблону, заданному в `variableSchema` (обычно `dd.MM.yyyy` для белорусских документов).

## Как фронтенд резолвит переменные

1. Получает `variableData` — JSON-объект описанной выше структуры.
2. Для каждого плейсхолдера `{{path}}` в шаблоне вызывает `getNestedValue(variableData, path)`.
3. Функция разбивает `path` по точкам и «проваливается» в объект: `"employee.lastName"` → `variableData["employee"]["lastName"]`.
4. Если значение найдено — форматирует по типу (даты по формату, остальное в строку).
5. Если значение `null`/`undefined` — подставляет `fallback` из схемы переменной или показывает `[Имя переменной]`.

```
path: "employee.lastName"
variableData: { employee: { lastName: "Иванов" } }
→ результат: "Иванов"

path: "employee.middleName"
variableData: { employee: {} }
→ результат: fallback или "[Второе имя]"
```

Если по пути встречается **массив** (например `branches` или `orders` приходят как массивы объектов), фронт использует **первый элемент** массива для следующих ключей: `branches.created_at` → `variableData.branches[0].created_at`. Так подстановка работает и когда группа задана одним объектом, и когда массивом.

## Схема переменных (variableSchema)

Каждый шаблон хранит массив `variableSchema` — описание доступных переменных. Это метаданные для UI (боковая панель «Переменные» в редакторе) и для валидации.

```jsonc
[
  {
    "path": "employee.lastName",   // Путь в variableData
    "label": "Фамилия",           // Отображение в UI
    "type": "string",             // string | date | number | boolean
    "group": "Сотрудник",         // Группировка в боковой панели
    "format": null,               // Формат отображения (для date: "dd.MM.yyyy")
    "fallback": ""                // Значение по умолчанию, если данных нет
  }
]
```

Схема сохраняется в `templates.template_html.variableSchema` (jsonb) вместе с содержимым шаблона. При необходимости n8n может расширять схему — добавлять новые переменные для конкретных типов шаблонов.

## Два режима работы с переменными

Редактор работает в двух режимах, и переменные в них отличаются по источнику и назначению.

### Режим 1: Создание/редактирование шаблона

Пользователь конструирует шаблон документа. В боковой панели он видит **стандартный каталог переменных** и перетаскивает их в текст. Переменные абстрактные — без привязки к конкретному сотруднику, без префиксов `p{i}`.

Источник каталога: n8n отдаёт список переменных при открытии редактора шаблонов. Список зависит от **типа шаблона** (приём, увольнение, контракт и т.д.) — разные типы предлагают разные наборы переменных.

### Режим 2: Генерация документа

n8n берёт шаблон, подставляет реальные данные, для сводных приказов добавляет префиксы `p{i}`. Переменные конкретные — с реальными значениями, динамической схемой и т.д.

### Связь режимов

```
Режим 1 (шаблон):          {{employee.fullNameA}}
                                    ↓
n8n при сборке сводного:    {{p1.employee.fullNameA}}, {{p2.employee.fullNameA}}, ...
                                    ↓
Режим 2 (документ):         "Иванова Петра Сергеевича", "Петрову Анну Игоревну", ...
```

Шаблон пункта **всегда** пишется в абстрактных переменных. Префиксация и подстановка — задача n8n при генерации.

---

## Стандартный каталог переменных для шаблонов

Каталог — это **мастер-список** всех переменных, доступных при создании шаблонов. n8n отдаёт его при открытии редактора шаблонов. Каталог организован по группам и зависит от типа шаблона.

### Общие переменные (доступны во всех типах шаблонов)

#### Группа «Приказ»

| Путь | Label в UI | Тип |
|------|-----------|-----|
| `order.regNumber` | Номер приказа | string |
| `order.orderDate` | Дата приказа | date |
| `order.effectiveDate` | Дата вступления в силу | date |
| `order.title` | Заголовок приказа | string |

#### Группа «Организация»

| Путь | Label в UI | Тип |
|------|-----------|-----|
| `organization.name` | Название организации | string |
| `organization.nameG` | Название организации (род.) | string |

#### Группа «Филиал»

| Путь | Label в UI | Тип |
|------|-----------|-----|
| `branch.name` | Название филиала | string |
| `branch.nameG` | Название филиала (род.) | string |

### Переменные сотрудника (группа «Сотрудник — ФИО»)

Доступны в шаблонах, связанных с конкретным сотрудником (приём, перевод, увольнение, контракт и т.д.).

| Путь | Label в UI | Тип |
|------|-----------|-----|
| `employee.lastName` | Фамилия | string |
| `employee.firstName` | Имя | string |
| `employee.patronymic` | Отчество | string |
| `employee.fullName` | ФИО (именительный) | string |
| `employee.fullNameG` | ФИО (родительный) | string |
| `employee.fullNameD` | ФИО (дательный) | string |
| `employee.fullNameA` | ФИО (винительный) | string |
| `employee.fullNameI` | ФИО (творительный) | string |
| `employee.birthDate` | Дата рождения | date |
| `employee.idNumber` | Идентификационный номер | string |

### Переменные назначения (группа «Назначение»)

Доступны в шаблонах приёма, перевода.

| Путь | Label в UI | Тип |
|------|-----------|-----|
| `assignment.position` | Должность (именительный) | string |
| `assignment.positionG` | Должность (родительный) | string |
| `assignment.positionD` | Должность (дательный) | string |
| `assignment.positionA` | Должность (винительный) | string |
| `assignment.positionI` | Должность (творительный) | string |
| `assignment.department` | Подразделение (именительный) | string |
| `assignment.departmentG` | Подразделение (родительный) | string |
| `assignment.departmentA` | Подразделение (винительный) | string |
| `assignment.rate` | Ставка | number |

### Переменные контракта (группа «Контракт»)

Доступны в шаблонах приёма и контрактов.

| Путь | Label в UI | Тип |
|------|-----------|-----|
| `contract.number` | Номер контракта/договора | string |
| `contract.type` | Тип документа (контракт/трудовой договор) | string |
| `contract.startDate` | Дата начала действия | date |
| `contract.endDate` | Дата окончания действия | date |

### Переменные увольнения (группа «Увольнение»)

Доступны только в шаблонах увольнения.

| Путь | Label в UI | Тип |
|------|-----------|-----|
| `dismissal.reason` | Основание увольнения | string |
| `dismissal.article` | Статья ТК | string |
| `dismissal.lastDay` | Последний рабочий день | date |

### Хранение и управление каталогом — в n8n

Каталог переменных хранится и управляется **целиком в n8n**. Фронт не хранит никаких списков переменных — он запрашивает каталог у n8n и отображает то, что получил.

**Почему так:**
- Единый источник истины — добавление/изменение переменных не требует деплоя фронта.
- n8n знает, какие данные он может предоставить при генерации — каталог всегда синхронизирован с возможностями бэкенда.
- Разные типы шаблонов получают разные наборы переменных — фильтрация на стороне n8n.

### Привязка каталога к типу шаблона

Каждый тип шаблона (`template_type`) определяет, какие группы переменных доступны:

| Тип шаблона | Доступные группы |
|-------------|-----------------|
| `hire` (приём) | Приказ, Организация, Филиал, Сотрудник, Назначение, Контракт |
| `transfer` (перевод) | Приказ, Организация, Филиал, Сотрудник, Назначение |
| `dismiss` (увольнение) | Приказ, Организация, Филиал, Сотрудник, Увольнение |
| `contract` (контракт/ТД) | Организация, Филиал, Сотрудник, Назначение, Контракт |

### Поток данных

```
1. Пользователь открывает шаблон в редакторе
2. Фронт → n8n (CRUD webhook):
   POST /crud
   { "table": "EDITOR", "action": "get", "payload": { "type": "templates", "scope": "template_variables", "template_type": 1 } }
3. n8n возвращает массив переменных для данного типа шаблона
4. Фронт отображает переменные в боковой панели «Переменные»
5. Пользователь кликает переменную — она вставляется в текст шаблона
```

Фронт **не знает**, какие переменные существуют — он полностью полагается на ответ n8n. Если завтра в n8n добавить новую переменную `employee.snils`, фронт автоматически покажет её в панели без каких-либо изменений в коде.

Если n8n вернул пустой массив или ошибку — в панели отображается «Нет переменных».

### Где отображаются переменные на фронте

Каталог переменных показывается **в сайдбаре редактора** (компонент `EditorSidebar`): блок с заголовком «Переменные», под ним группы (`VariableGroup`) по полю `group` из схемы. В каждой группе — кнопки с `label` и `path`; клик вставляет в документ плейсхолдер `{{path}}`. Данные для этого списка — только ответ n8n на запрос каталога (`scope: "template_variables"`); фронт не подмешивает свои переменные.

### Запрос каталога — полный пример

**Запрос** (через общий CRUD webhook, тот же `/crud` что используется для всех таблиц):

```json
{
  "table": "EDITOR",
  "action": "get",
  "payload": {
    "type": "templates",
    "scope": "template_variables",
    "template_type": 1
  },
  "access_token": "eyJhbGciOi..."
}
```

| Поле | Описание |
|------|----------|
| `table` | `"EDITOR"` — виртуальная таблица, сигнал для n8n что это запрос к редактору |
| `action` | `"get"` — стандартное действие чтения |
| `payload.type` | `"templates"` — контекст запроса (работа с шаблонами) |
| `payload.scope` | `"template_variables"` — какой каталог запрашивается |
| `payload.template_type` | ID типа шаблона (FK → `template_types.id`), по нему n8n фильтрует группы |

### Ответ n8n — формат

n8n может вернуть каталог в одном из двух видов.

**Вариант 1 — только схема (массив):** корень ответа — массив объектов `VariableSchema`. Фронт отображает в сайдбаре «Переменные» только label и path.

**Вариант 2 — схема и данные (объект):** корень ответа — объект с полями для схемы и опционально данными:

- **Схема переменных:** массив задаётся полем `variables` **или** `variableSchema` (оба — массив объектов `VariableSchema`). Фронт принимает любое из двух имён.
- **Данные для подстановки:** опциональное поле `variableData` — плоский объект по путям, как при генерации документа.

```json
{
  "variables": [ /* массив VariableSchema */ ],
  "variableData": { /* объект по путям */ }
}
```

или

```json
{
  "variableSchema": [ /* массив VariableSchema */ ],
  "variableData": { /* объект по путям */ }
}
```

Если передан `variableData`, фронт в сайдбаре под каждой переменной показывает текущее значение (по `path` через `getNestedValue`, с учётом `format` для дат). Это удобно для превью или когда каталог запрашивается в контексте конкретного приказа/документа.

Поддерживаются: массив «сверху»; объект с `variables` или `variableSchema` (и опционально `variableData`). Сайдбар «Переменные» использует схему для списка и группировки и при наличии `variableData` — для отображения значений.

### Ответ n8n — полный пример (массив)

**Пример для `template_type = 1` (приём на работу):**

```json
[
  { "path": "order.regNumber",          "label": "Номер приказа",            "type": "string", "group": "Приказ" },
  { "path": "order.orderDate",          "label": "Дата приказа",             "type": "date",   "group": "Приказ",               "format": "dd.MM.yyyy" },
  { "path": "order.effectiveDate",      "label": "Дата вступления в силу",   "type": "date",   "group": "Приказ",               "format": "dd.MM.yyyy" },
  { "path": "order.title",              "label": "Заголовок приказа",        "type": "string", "group": "Приказ" },

  { "path": "organization.name",        "label": "Организация",              "type": "string", "group": "Организация" },
  { "path": "organization.nameG",       "label": "Организация (род.)",       "type": "string", "group": "Организация" },
  { "path": "branch.name",              "label": "Филиал",                   "type": "string", "group": "Организация" },
  { "path": "branch.nameG",             "label": "Филиал (род.)",            "type": "string", "group": "Организация" },

  { "path": "employee.lastName",        "label": "Фамилия",                  "type": "string", "group": "Сотрудник" },
  { "path": "employee.firstName",       "label": "Имя",                      "type": "string", "group": "Сотрудник" },
  { "path": "employee.patronymic",      "label": "Отчество",                 "type": "string", "group": "Сотрудник" },
  { "path": "employee.fullName",        "label": "ФИО (именительный)",       "type": "string", "group": "Сотрудник — ФИО" },
  { "path": "employee.fullNameG",       "label": "ФИО (родительный)",        "type": "string", "group": "Сотрудник — ФИО" },
  { "path": "employee.fullNameD",       "label": "ФИО (дательный)",          "type": "string", "group": "Сотрудник — ФИО" },
  { "path": "employee.fullNameA",       "label": "ФИО (винительный)",        "type": "string", "group": "Сотрудник — ФИО" },
  { "path": "employee.fullNameI",       "label": "ФИО (творительный)",       "type": "string", "group": "Сотрудник — ФИО" },
  { "path": "employee.birthDate",       "label": "Дата рождения",            "type": "date",   "group": "Сотрудник",            "format": "dd.MM.yyyy" },
  { "path": "employee.idNumber",        "label": "Идент. номер",             "type": "string", "group": "Сотрудник" },

  { "path": "assignment.position",      "label": "Должность (именительный)", "type": "string", "group": "Назначение" },
  { "path": "assignment.positionG",     "label": "Должность (родительный)",  "type": "string", "group": "Назначение" },
  { "path": "assignment.positionD",     "label": "Должность (дательный)",    "type": "string", "group": "Назначение" },
  { "path": "assignment.positionA",     "label": "Должность (винительный)",  "type": "string", "group": "Назначение" },
  { "path": "assignment.positionI",     "label": "Должность (творительный)", "type": "string", "group": "Назначение" },
  { "path": "assignment.department",    "label": "Подразделение",            "type": "string", "group": "Назначение" },
  { "path": "assignment.departmentG",   "label": "Подразделение (род.)",     "type": "string", "group": "Назначение" },
  { "path": "assignment.departmentA",   "label": "Подразделение (вин.)",     "type": "string", "group": "Назначение" },
  { "path": "assignment.rate",          "label": "Ставка",                   "type": "number", "group": "Назначение" },

  { "path": "contract.number",          "label": "Номер контракта",          "type": "string", "group": "Контракт" },
  { "path": "contract.type",            "label": "Тип документа",            "type": "string", "group": "Контракт" },
  { "path": "contract.startDate",       "label": "Дата начала",              "type": "date",   "group": "Контракт",             "format": "dd.MM.yyyy" },
  { "path": "contract.endDate",         "label": "Дата окончания",           "type": "date",   "group": "Контракт",             "format": "dd.MM.yyyy" }
]
```

### Ответ с variableData (объект)

Пример ответа, при котором в сайдбаре отображаются и переменные, и их значения:

```json
{
  "variables": [
    { "path": "p1.applied_at", "label": "Дата применения", "type": "date", "group": "p1", "format": "dd.MM.yyyy" },
    { "path": "p1.contract_id", "label": "ID контракта", "type": "string", "group": "p1" }
  ],
  "variableData": {
    "p1": {
      "applied_at": "2026-03-01",
      "contract_id": "abc-123"
    }
  }
}
```

Фронт резолвит `p1.applied_at` в `variableData.p1.applied_at`, форматирует дату по `format` и показывает под полем «Дата применения» в группе «p1».

### Структура каждого элемента VariableSchema

| Поле | Тип | Обязательное | Описание |
|------|-----|:---:|----------|
| `path` | string | да | Путь переменной в `variableData` (через точку). Используется в шаблоне: `{{path}}` |
| `label` | string | да | Отображаемое имя в боковой панели |
| `type` | `"string"` \| `"date"` \| `"number"` \| `"boolean"` | да | Тип значения (влияет на форматирование при подстановке) |
| `group` | string | да | Группировка в боковой панели. Переменные с одинаковым `group` показываются под одним заголовком |
| `format` | string | нет | Формат отображения (для `date`: `"dd.MM.yyyy"`, для `number`: формат числа и т.д.) |
| `fallback` | string | нет | Значение по умолчанию, если данных нет при генерации документа |

### Расширение каталога

Добавление новой переменной — только на стороне n8n:

1. Добавить переменную в каталог n8n для нужного `template_type`.
2. Обеспечить заполнение этого поля в `variableData` при генерации документа.
3. Фронт не трогать — он подхватит новую переменную автоматически.

## Падежи (склонение ФИО, должностей, подразделений)

### Проблема

В кадровых документах одно и то же значение используется в разных грамматических падежах:

- «Принять **Иванова Петра Сергеевича**» (винительный)
- «**Иванову Петру Сергеевичу** установить оклад...» (дательный)
- «на должность **инженера**» (родительный)
- «назначить **инженером**» (творительный)

Склонение на фронте — плохая идея: русское склонение зависит от пола, окончания фамилии, национальности, наличия составных фамилий. Эту задачу берёт на себя n8n.

### Решение: суффикс падежа в имени переменной

n8n склоняет значения и присылает каждый падеж как **отдельную переменную** с суффиксом. Базовое имя (без суффикса) — именительный падеж для обратной совместимости.

#### Суффиксы падежей

| Суффикс | Падеж | Вопрос | Пример (фамилия) |
|---------|-------|--------|-------------------|
| _(нет)_ | Именительный | кто? что? | `Иванов` |
| `G` | Родительный | кого? чего? | `Иванова` |
| `D` | Дательный | кому? чему? | `Иванову` |
| `A` | Винительный | кого? что? | `Иванова` |
| `I` | Творительный | кем? чем? | `Ивановым` |
| `P` | Предложный | о ком? о чём? | `Иванове` |

#### Переменные сотрудника с падежами

```json
{
  "employee": {
    "lastName":  "Иванов",
    "lastNameG": "Иванова",
    "lastNameD": "Иванову",
    "lastNameA": "Иванова",
    "lastNameI": "Ивановым",

    "firstName":  "Пётр",
    "firstNameG": "Петра",
    "firstNameD": "Петру",
    "firstNameA": "Петра",
    "firstNameI": "Петром",

    "patronymic":  "Сергеевич",
    "patronymicG": "Сергеевича",
    "patronymicD": "Сергеевичу",
    "patronymicA": "Сергеевича",
    "patronymicI": "Сергеевичем",

    "fullName":  "Иванов Пётр Сергеевич",
    "fullNameG": "Иванова Петра Сергеевича",
    "fullNameD": "Иванову Петру Сергеевичу",
    "fullNameA": "Иванова Петра Сергеевича",
    "fullNameI": "Ивановым Петром Сергеевичем"
  }
}
```

`fullName` / `fullNameG` / ... — удобные составные переменные, чтобы не вставлять три отдельных плейсхолдера подряд.

#### Переменные должности и подразделения с падежами

```json
{
  "assignment": {
    "position":  "ведущий инженер",
    "positionG": "ведущего инженера",
    "positionD": "ведущему инженеру",
    "positionA": "ведущего инженера",
    "positionI": "ведущим инженером",

    "department":  "отдел разработки",
    "departmentG": "отдела разработки",
    "departmentD": "отделу разработки",
    "departmentA": "отдел разработки",
    "departmentI": "отделом разработки"
  }
}
```

#### Пример использования в шаблоне

```
Принять {{employee.fullNameA}} на должность {{assignment.positionG}}
в {{assignment.departmentA}} с {{order.effectiveDate}}.

{{employee.fullNameD}} установить оклад в размере ...
```

#### variableSchema для падежей

В `variableSchema` каждый падеж — отдельная запись. Для удобства пользователя падежные формы группируются вместе:

```json
[
  { "path": "employee.fullName",  "label": "ФИО (именительный)", "type": "string", "group": "Сотрудник — ФИО" },
  { "path": "employee.fullNameG", "label": "ФИО (родительный)",  "type": "string", "group": "Сотрудник — ФИО" },
  { "path": "employee.fullNameD", "label": "ФИО (дательный)",    "type": "string", "group": "Сотрудник — ФИО" },
  { "path": "employee.fullNameA", "label": "ФИО (винительный)",  "type": "string", "group": "Сотрудник — ФИО" },
  { "path": "employee.fullNameI", "label": "ФИО (творительный)", "type": "string", "group": "Сотрудник — ФИО" },

  { "path": "assignment.positionG", "label": "Должность (родительный)", "type": "string", "group": "Назначение" },
  { "path": "assignment.positionI", "label": "Должность (творительный)", "type": "string", "group": "Назначение" }
]
```

#### Склонение в n8n

n8n выполняет склонение при сборке `variableData`. Рекомендуемые подходы:

- **ФИО:** библиотека [`petrovich`](https://github.com/petrovich/petrovich-js) (Node.js) — склоняет русские фамилии, имена, отчества с учётом пола.
- **Должности и подразделения:** справочник склонённых форм в БД (поля `name_g`, `name_d`, `name_a`, `name_i` в таблицах `positions`, `departments`) или внешний сервис морфологии.

#### Совместимость со сводными приказами

В сводных приказах падежи работают через те же префиксы `p{i}`:

```
Принять {{p1.employee.fullNameA}} на должность {{p1.assignment.positionG}} ...
Принять {{p2.employee.fullNameA}} на должность {{p2.assignment.positionG}} ...
```

`variableData` для сводного приказа:
```json
{
  "p1": {
    "employee": { "fullNameA": "Иванова Петра Сергеевича", ... },
    "assignment": { "positionG": "инженера", ... }
  },
  "p2": {
    "employee": { "fullNameA": "Петрову Анну Игоревну", ... },
    "assignment": { "positionG": "бухгалтера", ... }
  }
}
```

---

## Сводные приказы — переменные с префиксом пункта

### Проблема

Индивидуальный приказ содержит один пункт → один сотрудник → одна группа `employee`, `assignment` и т.д.

Сводный приказ содержит **N пунктов** (например, приём 10 человек). Нужно сгенерировать единый документ, где для каждого пункта подставлены свои данные сотрудника, должности и т.д.

### Решение: префиксные группы `p{i}`

n8n собирает и HTML-шаблон, и `variableData` для сводного приказа. Каждый пункт получает свой префикс `p1`, `p2`, ... `pN`. Общие данные (приказ, организация, филиал) остаются без префикса.

Существующий резолвер `getNestedValue(variableData, path)` обрабатывает это **без изменений** — он просто идёт по ключам через точку: `p1.employee.lastName` → `variableData["p1"]["employee"]["lastName"]`.

### Структура `variableData` для сводного приказа

```json
{
  "order": {
    "regNumber": "К-42/2026",
    "orderDate": "2026-02-20",
    "effectiveDate": "2026-03-01",
    "title": "О приёме на работу"
  },
  "organization": {
    "name": "ООО «Альфа Групп»"
  },
  "branch": {
    "name": "Минский филиал"
  },
  "p1": {
    "employee": {
      "lastName": "Иванов",
      "firstName": "Пётр",
      "patronymic": "Сергеевич"
    },
    "assignment": {
      "position": "Инженер",
      "department": "Отдел разработки",
      "rate": 1.0
    }
  },
  "p2": {
    "employee": {
      "lastName": "Петрова",
      "firstName": "Анна",
      "patronymic": "Игоревна"
    },
    "assignment": {
      "position": "Бухгалтер",
      "department": "Бухгалтерия",
      "rate": 1.0
    }
  },
  "p3": {
    "employee": {
      "lastName": "Сидоров",
      "firstName": "Иван",
      "patronymic": "Петрович"
    },
    "assignment": {
      "position": "Юрист",
      "department": "Юридический отдел",
      "rate": 0.5
    }
  }
}
```

### Пример собранного HTML

n8n генерирует HTML с плейсхолдерами, используя префиксы `p{i}`:

```html
<p>ПРИКАЗ № {{order.regNumber}} от {{order.orderDate}}</p>
<p>{{organization.name}}</p>
<p>ПРИКАЗЫВАЮ:</p>
<p>1. Принять {{p1.employee.lastName}} {{p1.employee.firstName}} {{p1.employee.patronymic}}
   на должность {{p1.assignment.position}} в {{p1.assignment.department}}
   с {{order.effectiveDate}}.</p>
<p>2. Принять {{p2.employee.lastName}} {{p2.employee.firstName}} {{p2.employee.patronymic}}
   на должность {{p2.assignment.position}} в {{p2.assignment.department}}
   с {{order.effectiveDate}}.</p>
<p>3. Принять {{p3.employee.lastName}} {{p3.employee.firstName}} {{p3.employee.patronymic}}
   на должность {{p3.assignment.position}} в {{p3.assignment.department}}
   с {{order.effectiveDate}}.</p>
```

Редактор резолвит каждый плейсхолдер через `getNestedValue` и показывает готовый документ.

### Алгоритм сборки в n8n

```
1. Получить order + все order_items сводного приказа.
2. Для каждого order_item[i] (i = 1..N):
   a. Получить person → данные employee.
   b. Получить assignment (JOIN departments, positions) → данные assignment.
   c. Получить шаблон пункта по item_type (например, шаблон пункта «hire»):
      "Принять {{employee.lastName}} {{employee.firstName}} ... на должность {{assignment.position}} ..."
   d. Заменить все {{employee.*}} → {{p{i}.employee.*}},
              все {{assignment.*}} → {{p{i}.assignment.*}} и т.д.
   e. Добавить нумерацию: "{i}. ..."
   f. Записать variableData["p{i}"] = { employee: {...}, assignment: {...} }
3. Собрать шапку приказа (общий шаблон с {{order.*}}, {{organization.*}}, {{branch.*}}).
4. Склеить: шапка + все пункты → итоговый HTML.
5. Собрать итоговый variableData: { order, organization, branch, p1, p2, ..., pN }.
6. Сгенерировать variableSchema для этого документа (см. ниже).
7. Отправить { html, variableData, variableSchema } на фронт.
```

### Динамическая `variableSchema`

Для сводного приказа `variableSchema` генерируется n8n динамически. Общие переменные фиксированы, а для каждого пункта `p{i}` клонируется набор переменных с нужным префиксом и меткой:

```json
[
  { "path": "order.regNumber", "label": "Номер приказа", "type": "string", "group": "Приказ" },
  { "path": "order.orderDate", "label": "Дата приказа", "type": "date", "group": "Приказ", "format": "dd.MM.yyyy" },
  { "path": "organization.name", "label": "Организация", "type": "string", "group": "Организация" },

  { "path": "p1.employee.lastName", "label": "Фамилия (п.1)", "type": "string", "group": "Пункт 1 — Сотрудник" },
  { "path": "p1.employee.firstName", "label": "Имя (п.1)", "type": "string", "group": "Пункт 1 — Сотрудник" },
  { "path": "p1.assignment.position", "label": "Должность (п.1)", "type": "string", "group": "Пункт 1 — Назначение" },
  { "path": "p1.assignment.department", "label": "Подразделение (п.1)", "type": "string", "group": "Пункт 1 — Назначение" },

  { "path": "p2.employee.lastName", "label": "Фамилия (п.2)", "type": "string", "group": "Пункт 2 — Сотрудник" },
  { "path": "p2.employee.firstName", "label": "Имя (п.2)", "type": "string", "group": "Пункт 2 — Сотрудник" },
  { "path": "p2.assignment.position", "label": "Должность (п.2)", "type": "string", "group": "Пункт 2 — Назначение" },
  { "path": "p2.assignment.department", "label": "Подразделение (п.2)", "type": "string", "group": "Пункт 2 — Назначение" }
]
```

`group` содержит номер пункта, что позволяет боковой панели редактора группировать переменные по пунктам приказа.

### Смешанные сводные приказы

Сводный приказ может содержать пункты **разных типов** (приём, перевод, увольнение). В этом случае n8n:

1. Группирует `order_items` по `item_type`.
2. Для каждого пункта берёт шаблон соответствующего типа (hire, transfer, dismiss).
3. Применяет тот же алгоритм с префиксами `p{i}`.
4. Набор переменных в `p{i}` зависит от типа: для приёма — `employee` + `assignment`, для увольнения — `employee` + `dismissal` и т.д.

Пример смешанного `variableData`:

```json
{
  "order": { "regNumber": "К-50/2026", "title": "По личному составу" },
  "p1": {
    "employee": { "lastName": "Иванов", "firstName": "Пётр", "patronymic": "Сергеевич" },
    "assignment": { "position": "Инженер", "department": "Отдел разработки" }
  },
  "p2": {
    "employee": { "lastName": "Козлов", "firstName": "Дмитрий", "patronymic": "Алексеевич" },
    "dismissal": { "reason": "по соглашению сторон", "lastDay": "2026-03-15" }
  }
}
```

### Ключевые свойства подхода

| Аспект | Описание |
|--------|----------|
| **Изменения на фронте** | Не требуются — резолвер `getNestedValue` работает с произвольной вложенностью |
| **Шаблон пункта** | Хранится отдельно для каждого `item_type`, использует стандартные переменные (`{{employee.lastName}}` и т.д.) |
| **Сборка** | n8n берёт шаблон пункта, добавляет префикс `p{i}.` ко всем переменным, нумерует, склеивает с шапкой |
| **variableSchema** | Генерируется n8n динамически, с номером пункта в `group` |
| **variableData** | Общие группы (`order`, `organization`, `branch`) + по группе `p{i}` на каждый пункт |
| **Смешанные типы** | Поддерживаются — разные шаблоны пунктов, разный набор переменных в `p{i}` |

### Полный пример ответа вебхука — сводный приказ (3 сотрудника, приём)

Ниже — **готовый JSON**, который n8n должен вернуть фронту при формировании сводного приказа о приёме на работу. Содержит все 4 части: `content` (TipTap-документ), `pageSettings`, `variableSchema` и `variableData`.

Фронт получает этот JSON, загружает `content` в TipTap-редактор, `variableSchema` — в боковую панель, `variableData` — в `EditorModeContext`. В режиме «Документ» переменные автоматически заменяются на реальные значения.

```json
{
  "content": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "attrs": { "textAlign": "center" },
        "content": [
          {
            "type": "templateVariable",
            "attrs": { "path": "organization.name", "label": "Организация", "format": null, "fallback": "" }
          }
        ]
      },
      {
        "type": "paragraph",
        "attrs": { "textAlign": "center" },
        "content": [
          { "type": "text", "text": "ПРИКАЗ № " },
          {
            "type": "templateVariable",
            "attrs": { "path": "order.regNumber", "label": "Номер приказа", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " от " },
          {
            "type": "templateVariable",
            "attrs": { "path": "order.orderDate", "label": "Дата приказа", "format": "dd.MM.yyyy", "fallback": "" }
          }
        ]
      },
      {
        "type": "paragraph",
        "attrs": { "textAlign": "center" },
        "content": [
          {
            "type": "templateVariable",
            "attrs": { "path": "order.title", "label": "Заголовок приказа", "format": null, "fallback": "" }
          }
        ]
      },
      {
        "type": "paragraph",
        "attrs": { "textAlign": null },
        "content": [
          { "type": "text", "text": "ПРИКАЗЫВАЮ:" }
        ]
      },
      {
        "type": "paragraph",
        "attrs": { "textAlign": null },
        "content": [
          { "type": "text", "text": "1. Принять " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p1.employee.fullNameA", "label": "ФИО вин. (п.1)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " на должность " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p1.assignment.positionG", "label": "Должность род. (п.1)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " в " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p1.assignment.departmentA", "label": "Подразделение вин. (п.1)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " на " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p1.assignment.rate", "label": "Ставка (п.1)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " ставку с " },
          {
            "type": "templateVariable",
            "attrs": { "path": "order.effectiveDate", "label": "Дата вступления в силу", "format": "dd.MM.yyyy", "fallback": "" }
          },
          { "type": "text", "text": " по контракту № " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p1.contract.number", "label": "№ контракта (п.1)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " от " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p1.contract.startDate", "label": "Дата контракта (п.1)", "format": "dd.MM.yyyy", "fallback": "" }
          },
          { "type": "text", "text": "." }
        ]
      },
      {
        "type": "paragraph",
        "attrs": { "textAlign": null },
        "content": [
          { "type": "text", "text": "2. Принять " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p2.employee.fullNameA", "label": "ФИО вин. (п.2)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " на должность " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p2.assignment.positionG", "label": "Должность род. (п.2)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " в " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p2.assignment.departmentA", "label": "Подразделение вин. (п.2)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " на " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p2.assignment.rate", "label": "Ставка (п.2)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " ставку с " },
          {
            "type": "templateVariable",
            "attrs": { "path": "order.effectiveDate", "label": "Дата вступления в силу", "format": "dd.MM.yyyy", "fallback": "" }
          },
          { "type": "text", "text": " по контракту № " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p2.contract.number", "label": "№ контракта (п.2)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " от " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p2.contract.startDate", "label": "Дата контракта (п.2)", "format": "dd.MM.yyyy", "fallback": "" }
          },
          { "type": "text", "text": "." }
        ]
      },
      {
        "type": "paragraph",
        "attrs": { "textAlign": null },
        "content": [
          { "type": "text", "text": "3. Принять " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p3.employee.fullNameA", "label": "ФИО вин. (п.3)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " на должность " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p3.assignment.positionG", "label": "Должность род. (п.3)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " в " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p3.assignment.departmentA", "label": "Подразделение вин. (п.3)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " на " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p3.assignment.rate", "label": "Ставка (п.3)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " ставку с " },
          {
            "type": "templateVariable",
            "attrs": { "path": "order.effectiveDate", "label": "Дата вступления в силу", "format": "dd.MM.yyyy", "fallback": "" }
          },
          { "type": "text", "text": " по контракту № " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p3.contract.number", "label": "№ контракта (п.3)", "format": null, "fallback": "" }
          },
          { "type": "text", "text": " от " },
          {
            "type": "templateVariable",
            "attrs": { "path": "p3.contract.startDate", "label": "Дата контракта (п.3)", "format": "dd.MM.yyyy", "fallback": "" }
          },
          { "type": "text", "text": "." }
        ]
      }
    ]
  },

  "pageSettings": {
    "unit": "mm",
    "format": "A4",
    "margins": { "top": 20, "left": 30, "right": 15, "bottom": 20 },
    "orientation": "portrait"
  },

  "variableSchema": [
    { "path": "order.regNumber",          "label": "Номер приказа",              "type": "string", "group": "Приказ" },
    { "path": "order.orderDate",          "label": "Дата приказа",               "type": "date",   "group": "Приказ",                  "format": "dd.MM.yyyy" },
    { "path": "order.effectiveDate",      "label": "Дата вступления в силу",     "type": "date",   "group": "Приказ",                  "format": "dd.MM.yyyy" },
    { "path": "order.title",              "label": "Заголовок приказа",          "type": "string", "group": "Приказ" },
    { "path": "organization.name",        "label": "Организация",                "type": "string", "group": "Организация" },
    { "path": "branch.name",              "label": "Филиал",                     "type": "string", "group": "Организация" },

    { "path": "p1.employee.fullNameA",       "label": "ФИО вин. (п.1)",            "type": "string", "group": "Пункт 1 — Сотрудник" },
    { "path": "p1.assignment.positionG",     "label": "Должность род. (п.1)",      "type": "string", "group": "Пункт 1 — Назначение" },
    { "path": "p1.assignment.departmentA",   "label": "Подразделение вин. (п.1)",  "type": "string", "group": "Пункт 1 — Назначение" },
    { "path": "p1.assignment.rate",          "label": "Ставка (п.1)",              "type": "number", "group": "Пункт 1 — Назначение" },
    { "path": "p1.contract.number",          "label": "№ контракта (п.1)",         "type": "string", "group": "Пункт 1 — Контракт" },
    { "path": "p1.contract.startDate",       "label": "Дата контракта (п.1)",      "type": "date",   "group": "Пункт 1 — Контракт",     "format": "dd.MM.yyyy" },

    { "path": "p2.employee.fullNameA",       "label": "ФИО вин. (п.2)",            "type": "string", "group": "Пункт 2 — Сотрудник" },
    { "path": "p2.assignment.positionG",     "label": "Должность род. (п.2)",      "type": "string", "group": "Пункт 2 — Назначение" },
    { "path": "p2.assignment.departmentA",   "label": "Подразделение вин. (п.2)",  "type": "string", "group": "Пункт 2 — Назначение" },
    { "path": "p2.assignment.rate",          "label": "Ставка (п.2)",              "type": "number", "group": "Пункт 2 — Назначение" },
    { "path": "p2.contract.number",          "label": "№ контракта (п.2)",         "type": "string", "group": "Пункт 2 — Контракт" },
    { "path": "p2.contract.startDate",       "label": "Дата контракта (п.2)",      "type": "date",   "group": "Пункт 2 — Контракт",     "format": "dd.MM.yyyy" },

    { "path": "p3.employee.fullNameA",       "label": "ФИО вин. (п.3)",            "type": "string", "group": "Пункт 3 — Сотрудник" },
    { "path": "p3.assignment.positionG",     "label": "Должность род. (п.3)",      "type": "string", "group": "Пункт 3 — Назначение" },
    { "path": "p3.assignment.departmentA",   "label": "Подразделение вин. (п.3)",  "type": "string", "group": "Пункт 3 — Назначение" },
    { "path": "p3.assignment.rate",          "label": "Ставка (п.3)",              "type": "number", "group": "Пункт 3 — Назначение" },
    { "path": "p3.contract.number",          "label": "№ контракта (п.3)",         "type": "string", "group": "Пункт 3 — Контракт" },
    { "path": "p3.contract.startDate",       "label": "Дата контракта (п.3)",      "type": "date",   "group": "Пункт 3 — Контракт",     "format": "dd.MM.yyyy" }
  ],

  "variableData": {
    "order": {
      "regNumber": "К-42/2026",
      "orderDate": "2026-02-28",
      "effectiveDate": "2026-03-01",
      "title": "О приёме на работу"
    },
    "organization": {
      "name": "ООО «Альфа Групп»",
      "nameG": "ООО «Альфа Групп»"
    },
    "branch": {
      "name": "Минский филиал",
      "nameG": "Минского филиала"
    },
    "p1": {
      "employee": {
        "lastName": "Иванов",
        "firstName": "Пётр",
        "patronymic": "Сергеевич",
        "fullName": "Иванов Пётр Сергеевич",
        "fullNameG": "Иванова Петра Сергеевича",
        "fullNameD": "Иванову Петру Сергеевичу",
        "fullNameA": "Иванова Петра Сергеевича",
        "fullNameI": "Ивановым Петром Сергеевичем",
        "birthDate": "1990-05-15",
        "idNumber": "3150590A001PB5"
      },
      "assignment": {
        "position": "инженер-программист",
        "positionG": "инженера-программиста",
        "positionD": "инженеру-программисту",
        "positionA": "инженера-программиста",
        "positionI": "инженером-программистом",
        "department": "Отдел разработки",
        "departmentG": "Отдела разработки",
        "departmentA": "Отдел разработки",
        "rate": 1.0
      },
      "contract": {
        "number": "15/2026",
        "type": "Контракт",
        "startDate": "2026-03-01",
        "endDate": "2027-03-01"
      }
    },
    "p2": {
      "employee": {
        "lastName": "Петрова",
        "firstName": "Анна",
        "patronymic": "Игоревна",
        "fullName": "Петрова Анна Игоревна",
        "fullNameG": "Петровой Анны Игоревны",
        "fullNameD": "Петровой Анне Игоревне",
        "fullNameA": "Петрову Анну Игоревну",
        "fullNameI": "Петровой Анной Игоревной",
        "birthDate": "1995-08-22",
        "idNumber": "4220895A002PB7"
      },
      "assignment": {
        "position": "бухгалтер",
        "positionG": "бухгалтера",
        "positionD": "бухгалтеру",
        "positionA": "бухгалтера",
        "positionI": "бухгалтером",
        "department": "Бухгалтерия",
        "departmentG": "Бухгалтерии",
        "departmentA": "Бухгалтерию",
        "rate": 1.0
      },
      "contract": {
        "number": "16/2026",
        "type": "Контракт",
        "startDate": "2026-03-01",
        "endDate": "2027-03-01"
      }
    },
    "p3": {
      "employee": {
        "lastName": "Сидоров",
        "firstName": "Дмитрий",
        "patronymic": "Алексеевич",
        "fullName": "Сидоров Дмитрий Алексеевич",
        "fullNameG": "Сидорова Дмитрия Алексеевича",
        "fullNameD": "Сидорову Дмитрию Алексеевичу",
        "fullNameA": "Сидорова Дмитрия Алексеевича",
        "fullNameI": "Сидоровым Дмитрием Алексеевичем",
        "birthDate": "1988-11-03",
        "idNumber": "5031188A003PB2"
      },
      "assignment": {
        "position": "юрисконсульт",
        "positionG": "юрисконсульта",
        "positionD": "юрисконсульту",
        "positionA": "юрисконсульта",
        "positionI": "юрисконсультом",
        "department": "Юридический отдел",
        "departmentG": "Юридического отдела",
        "departmentA": "Юридический отдел",
        "rate": 0.5
      },
      "contract": {
        "number": "17/2026",
        "type": "Контракт",
        "startDate": "2026-03-01",
        "endDate": "2028-03-01"
      }
    }
  }
}
```

#### Результат в режиме «Шаблон»

Переменные отображаются как бейджики:

```
                       {{organization.name}}
            ПРИКАЗ № {{order.regNumber}} от {{order.orderDate}}
                       {{order.title}}
ПРИКАЗЫВАЮ:
1. Принять {{p1.employee.fullNameA}} на должность {{p1.assignment.positionG}}
   в {{p1.assignment.departmentA}} на {{p1.assignment.rate}} ставку
   с {{order.effectiveDate}} по контракту № {{p1.contract.number}}
   от {{p1.contract.startDate}}.
2. Принять {{p2.employee.fullNameA}} на должность {{p2.assignment.positionG}}
   в {{p2.assignment.departmentA}} на {{p2.assignment.rate}} ставку
   с {{order.effectiveDate}} по контракту № {{p2.contract.number}}
   от {{p2.contract.startDate}}.
3. Принять {{p3.employee.fullNameA}} на должность {{p3.assignment.positionG}}
   в {{p3.assignment.departmentA}} на {{p3.assignment.rate}} ставку
   с {{order.effectiveDate}} по контракту № {{p3.contract.number}}
   от {{p3.contract.startDate}}.
```

#### Результат в режиме «Документ»

Переменные заменены на реальные данные:

```
                       ООО «Альфа Групп»
            ПРИКАЗ № К-42/2026 от 28.02.2026
                       О приёме на работу
ПРИКАЗЫВАЮ:
1. Принять Иванова Петра Сергеевича на должность инженера-программиста
   в Отдел разработки на 1 ставку с 01.03.2026 по контракту № 15/2026
   от 01.03.2026.
2. Принять Петрову Анну Игоревну на должность бухгалтера в Бухгалтерию
   на 1 ставку с 01.03.2026 по контракту № 16/2026 от 01.03.2026.
3. Принять Сидорова Дмитрия Алексеевича на должность юрисконсульта
   в Юридический отдел на 0.5 ставку с 01.03.2026 по контракту № 17/2026
   от 01.03.2026.
```

#### Структура ответа — 4 части

| Часть | Что это | Кто формирует |
|-------|---------|---------------|
| `content` | TipTap JSON-документ — шапка + пункты с `p{i}` переменными | n8n клонирует шаблон пункта N раз, добавляет `p{i}.` к путям |
| `pageSettings` | Настройки страницы (A4, отступы) | Копируется из шаблона |
| `variableSchema` | Метаданные переменных для сайдбара | n8n генерирует динамически: общие + набор на каждый `p{i}` |
| `variableData` | Реальные значения из БД для подстановки | n8n собирает из `orders`, `persons`, `assignments`, `contracts` |

---

## Таблицы для данных печати сводного приказа

При генерации печатной формы сводного приказа n8n собирает данные из БД. Ниже — полный список таблиц, которые могут понадобиться для подстановки в шаблон (variableData) и формирования контента. Схема БД — в `migrations/SCHEMA.md`.

### Обязательные (шапка и пункты)

| Таблица | Назначение в печати |
|---------|---------------------|
| **orders** | Шапка приказа: дата, номер (reg_number), дата вступления в силу, заголовок, примечание. Результат печати сохраняется в `print_output`. |
| **order_items** | Пункты приказа: порядок (line_no), человек, тип пункта, даты действия (effective_from, effective_to), payload (должность/отдел/отпуск и т.д.), привязка к договору/доп. соглашению. |
| **persons** | Данные сотрудника по каждому пункту: ФИО, дата рождения, идентификационный номер (переменные группы `employee.*`). |
| **order_item_types** | Наименование типа пункта (Приём, Перевод, Отпуск, Прочий, Увольнение) для подписи пункта в печати. |
| **templates** | Шаблон шапки (orders.template_id); при необходимости — шаблоны пунктов по типу (template_type = 2). |
| **branches** | Название филиала (branch.name, падежи) — в шапке и в переменных. |
| **organizations** | Название организации (organization.name, падежи) — через филиал. |

### Назначение (должность, подразделение) — приём и перевод

| Таблица | Назначение в печати |
|---------|---------------------|
| **assignments** | Текущее или целевое назначение по занятости/пункту: должность, подразделение, ставка (группа `assignment.*`). Для приёма — назначение по basis_order_item_id; для перевода — из payload или по занятости. |
| **departments** | Название подразделения (именительный/родительный/винительный и т.д.). |
| **positions** | Название должности (все падежи). |

### Контракт/договор — приём

| Таблица | Назначение в печати |
|---------|---------------------|
| **contracts** | По order_items.contract_id: номер, тип (контракт/трудовой договор), даты действия (группа `contract.*`). |

### Увольнение

| Таблица | Назначение в печати |
|---------|---------------------|
| **employments** | Занятость по пункту увольнения (даты, привязка к пункту). |
| **termination_reasons** | Основание и статья ТК (dismissal.reason, dismissal.article); последний рабочий день — из order_items.payload или занятости. |

### Отпуск / командировка

| Таблица | Назначение в печати |
|---------|---------------------|
| **order_item_subtypes** | Подтип пункта (вид отпуска и т.д.) — наименование для печати. |
| **absence_periods** | Опционально: период отсутствия по basis_order_item_id; часто достаточно order_items.effective_from, effective_to и подтипа. |

### Регистрация приказа

| Таблица | Назначение в печати |
|---------|---------------------|
| **order_registers** | Журнал регистрации (код, суффикс, год). Номер для печати обычно уже в orders.reg_number. |

### Перевод с доп. соглашением

| Таблица | Назначение в печати |
|---------|---------------------|
| **contract_amendments** | По order_items.contract_amendment_id: данные доп. соглашения/продления, если нужны в тексте пункта. |

### Сводный список (без дублирования)

Минимальный набор таблиц для типовой печати сводного приказа:

1. **orders**
2. **order_items**
3. **persons**
4. **order_item_types**
5. **order_item_subtypes**
6. **templates**
7. **branches**
8. **organizations**
9. **assignments**
10. **departments**
11. **positions**
12. **contracts**
13. **contract_amendments**
14. **employments**
15. **termination_reasons**
16. **order_registers**
17. **absence_periods** (опционально)

Итого: **16–17 таблиц** в зависимости от того, выводятся ли отпуска/командировки через absence_periods или только через order_items. Генерация печатной формы выполняется в n8n: по order_id читаются приказ и пункты, джойнятся перечисленные таблицы, собирается variableData (в т.ч. с префиксами p1, p2, … по пунктам) и передаётся фронту для подстановки в шаблон.

---

## Маппинг БД → variableData (для n8n-ворклоу)

| Группа | Таблица БД | Поле variableData | Поле БД |
|--------|-----------|-------------------|---------|
| employee | `persons` | `lastName` | `last_name` |
| employee | `persons` | `firstName` | `first_name` |
| employee | `persons` | `patronymic` | `patronymic` |
| employee | `persons` | `birthDate` | `birth_date` |
| employee | `persons` | `idNumber` | `id_number` |
| order | `orders` | `regNumber` | `reg_number` |
| order | `orders` | `orderDate` | `order_date` |
| order | `orders` | `effecti veDate` | `effective_date` |
| order | `orders` | `title` | `title` |
| assignment | `assignments` → `departments` | `department` | `departments.name` |
| assignment | `assignments` → `positions` | `position` | `positions.name` |
| assignment | `assignments` | `rate` | `rate` |
| organization | `organizations` | `name` | `name` |
| branch | `branches` | `name` | `name` |

В n8n-ворклоу при генерации документа нужно:
1. Получить `order` + `order_items` по ID приказа.
2. Для каждого пункта получить `person` → группа `employee`.
3. Получить текущее `assignment` (JOIN departments, positions) → группа `assignment`.
4. Получить `organization` и `branch` из контекста → группы `organization`, `branch`.
5. Собрать всё в единый JSON-объект описанной структуры и передать фронту.
