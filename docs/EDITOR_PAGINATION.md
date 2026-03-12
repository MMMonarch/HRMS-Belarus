# Пагинация и разделение страниц в редакторе приказов

Редактор приказов (`hrms-web/features/editor/`) отображает документ как набор белых «листов» формата A4, разделённых визуальными разрывами. Пагинация реализована целиком на клиенте — ProseMirror-декорациями поверх TipTap-редактора, без реального разбиения контента на отдельные узлы.

---

## 1. Иерархия DOM-элементов

```
.editor-desk              ← скроллируемая рабочая область (серый фон)
  └ .editor-page-wrapper  ← обёртка с CSS-зумом (transform: scale)
      └ .editor-page      ← «лист бумаги» (белый фон, размер A4)
          └ .editor-content / .tiptap  ← контент TipTap
              ├ <p>, <h1>, <table> …  ← обычные блоки
              └ .page-break-spacer     ← виджет-декорация (разрыв)
```

| Класс | Файл | Роль |
|-------|------|------|
| `.editor-desk` | `EditorContent.tsx` | Flex-элемент с `overflow-auto`; единственная область, которая скроллится |
| `.editor-page-wrapper` | `EditorContent.tsx` | Применяет `transform: scale(zoom)` и задаёт `width: pageWidthPx × zoom` |
| `.editor-page` | `EditorContent.tsx` | Белый прямоугольник A4 с padding по полям (margins) |
| `.page-break-spacer` | `pagination.ts` (DOM) | Визуальный разрыв между страницами, внедряется ProseMirror как `Decoration.widget` |

---

## 2. Размеры и единицы

Все размеры страницы хранятся в миллиметрах (`PageSettings.unit = "mm"`) и конвертируются в пиксели коэффициентом **1 mm = 3.7795275591 px** (CSS-определение).

| Параметр | Portrait | Landscape |
|----------|----------|-----------|
| Ширина A4 | 210 mm → 793.7 px | 297 mm → 1122.5 px |
| Высота A4 | 297 mm → 1122.5 px | 210 mm → 793.7 px |

Поля по умолчанию (`DEFAULT_PAGE_SETTINGS`):

| Поле | Значение (mm) |
|------|---------------|
| top | 20 |
| right | 15 |
| bottom | 20 |
| left | 30 |

Пользователь изменяет поля через `PageSettingsDialog` (кнопка «Поля» в тулбаре).

---

## 3. Как работает пагинация (Pagination extension)

**Файл:** `features/editor/extensions/pagination.ts`

### 3.1. Конфигурация

```typescript
interface PaginationConfig {
  pageHeightPx: number;    // полная высота страницы
  marginTopPx: number;     // верхнее поле
  marginBottomPx: number;  // нижнее поле
  gapPx: number;           // зазор между «листами» (32 px)
}
```

Значения обновляются командой `editor.commands.updatePagination(...)` из `EditorPage.tsx` при изменении `pageSettings`.

### 3.2. Алгоритм измерения (функция `measure`)

Плагин запускает `requestAnimationFrame` после каждого обновления документа:

1. **Вычисляет высоту контентной области:**
   ```
   contentAreaH = pageHeightPx − marginTopPx − marginBottomPx
   ```

2. **Вычисляет высоту визуального разрыва:**
   ```
   breakVisualH = marginBottomPx + gapPx + marginTopPx
   ```

3. **Проходит по DOM-потомкам** `.tiptap` (блок-элементы: `<p>`, `<h1>`, `<table>` …), пропуская существующие spacer-ы (`data-page-break-spacer`).

4. **Для каждого блока** вычисляет `contentY` — вертикальную позицию без учёта ранее вставленных spacer-ов:
   ```
   contentY = child.offsetTop − tiptapTop − cumulativeSpacerH
   ```

5. **Определяет, нужен ли разрыв перед блоком:**

   | Условие | Описание |
   |---------|----------|
   | `contentY ≥ currentPageBottom` | Блок начинается ниже границы страницы — вставить spacer **перед** ним |
   | `contentY < currentPageBottom` **и** `contentY + blockH > currentPageBottom` | Блок **пересекает** границу — вставить spacer **перед** ним (блок целиком переносится на следующую страницу) |

6. **Вычисляет высоту spacer-а:**
   ```
   remaining = currentPageBottom − contentY    (или − prevBlockEnd)
   spacerH   = remaining + breakVisualH
   ```
   `remaining` — незанятое пространство внизу текущей страницы, которое spacer «заполняет».

7. **Получает ProseMirror-позицию** блока через `view.posAtDOM(child, 0) - 1` и создаёт запись `{ pos, height, remaining, pageNum }`.

8. **Сравнивает ключ** (строка из `pos:height`) с предыдущим вычислением. Если ничего не изменилось — выходит без dispatch. Это предотвращает бесконечные циклы пересчёта.

9. **Создаёт `DecorationSet`** из `Decoration.widget` для каждого spacer-а и отправляет через `tr.setMeta(paginationKey, { deco })`.

### 3.3. Структура DOM spacer-а (`buildSpacerDOM`)

Каждый spacer — `<div class="page-break-spacer">` с тремя дочерними:

```
┌────────────────────────────────────────────┐
│  .page-edge-bottom   (h = marginBottomPx)  │  ← «нижнее поле» предыдущей страницы
│  белый фон, скруглённые углы снизу,        │    box-shadow вниз
├────────────────────────────────────────────┤
│  .page-gap           (h = gapPx = 32px)    │  ← зазор между листами
│  полупрозрачный muted-фон                  │    метка «стр. N» по центру
├────────────────────────────────────────────┤
│  .page-edge-top      (h = marginTopPx)     │  ← «верхнее поле» следующей страницы
│  белый фон, скруглённые углы сверху,       │    box-shadow вверх
└────────────────────────────────────────────┘
```

Spacer растянут на полную ширину листа: `width: calc(100% + var(--page-pl) + var(--page-pr))` с отрицательным `margin-left`, чтобы перекрыть padding `.editor-page`.

Атрибуты spacer-а:
- `data-page-break-spacer` — маркер для пропуска при пересчёте
- `contentEditable="false"` — нередактируемый
- `user-select: none` — нельзя выделить

---

## 4. Zoom (масштабирование)

**Файл:** `ZoomControl.tsx`, `EditorContent.tsx`

| Параметр | Значение |
|----------|----------|
| Диапазон | 50 % — 200 % |
| Шаг | 10 % |
| По умолчанию | 80 % |

Zoom реализован через CSS `transform: scale(zoom)` на `.editor-page-wrapper`. Ширина wrapper-а корректируется:

```
wrapper.width = pageWidthPx × zoom
```

Это нужно потому, что `transform` не влияет на layout — без корректировки ширины скролл-область не совпадала бы с визуальным размером. `transformOrigin: "top center"` обеспечивает масштабирование от верхнего центра.

> **Нюанс:** высота wrapper-а в layout остаётся «натуральной» (не масштабированной), поэтому область скролла в `.editor-desk` больше, чем визуальный размер контента. Это ожидаемое поведение: scroll range = layout height, а визуально контент уменьшен.

---

## 5. Печать

**Файл:** `editor-print.css`

При печати (`window.print()`) стили полностью перестраивают layout:

### 5.1. Сброс контейнеров

Все `<div>` и `<main>` от `body` до TipTap-контента переключаются на:
```css
display: block; overflow: visible; height: auto;
min-height: 0; max-height: none; padding: 0; margin: 0;
```

Это снимает flex-ограничения, которые мешают браузеру вставлять `break-before: page`.

### 5.2. Скрытие UI

`<header>`, `<nav>`, `<aside>`, `<footer>`, тулбар, сайдбар, табы и zoom — `display: none`.

### 5.3. Spacer → разрыв страницы

```css
.page-break-spacer {
  height: 0; overflow: hidden;
  break-before: page;
}
```

Spacer схлопывается до нулевой высоты, но `break-before: page` указывает браузеру начать новую печатную страницу именно в этом месте.

### 5.4. `@page` и поля

`@page` size и margins внедряются динамически через `<style id="editor-page-style">` в `EditorPage.tsx`:

```css
@page { size: A4 portrait; margin: 20mm 15mm 20mm 30mm; }
```

Значения синхронизированы с `pageSettings` пользователя.

---

## 6. Связь компонентов

```
EditorPage.tsx
 ├── useEditor()           → инициализация TipTap с extension Pagination
 ├── updatePagination()    → передаёт pageSettings → PaginationConfig
 ├── <style @page>         → динамические CSS @page-правила для печати
 │
 ├── EditorToolbar         → форматирование + режим (template/document)
 ├── EditorTabs            → вкладки открытых шаблонов
 ├── EditorSidebar         → палитра переменных (drag & drop)
 │
 ├── EditorContent.tsx
 │    ├── .editor-desk     → скролл-контейнер
 │    ├── .editor-page-wrapper → zoom (transform)
 │    └── .editor-page     → A4-лист (белый, padding = margins)
 │         └── TipTapEditorContent
 │              └── Pagination plugin → .page-break-spacer (декорации)
 │
 ├── ZoomControl           → ±10%, диапазон 50–200%
 └── PageSettingsDialog    → ориентация + поля (mm)
```

---

## 7. Ключевые файлы

| Файл | Назначение |
|------|------------|
| `features/editor/extensions/pagination.ts` | ProseMirror-плагин: алгоритм измерения, создание spacer-декораций |
| `features/editor/components/EditorContent.tsx` | UI-обёртка: desk, page-wrapper с zoom, paper (A4) |
| `features/editor/components/EditorPage.tsx` | Оркестрация: инициализация editor, tabs, save, print, page settings |
| `features/editor/components/ZoomControl.tsx` | Контрол масштаба (50–200%) |
| `features/editor/components/PageSettingsDialog.tsx` | Диалог: ориентация и поля |
| `features/editor/styles/editor.css` | Стили контента, таблиц, spacer-ов |
| `features/editor/styles/editor-print.css` | Print-стили: сброс layout, скрытие UI, break-before |
| `features/editor/types.ts` | Типы: PageSettings, PageMargins, PaginationConfig-совместимые |
