export const FONT_FAMILIES = [
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
  "Tahoma",
  "Calibri",
  "Cambria",
];

export const FONT_SIZES = [
  "8", "9", "10", "11", "12", "14", "16", "18",
  "20", "22", "24", "26", "28", "36", "48", "72",
];

export const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6",
  "#ec4899", "#14b8a6", "#0ea5e9", "#6366f1", "#a855f7", "#d946ef",
];

export const HIGHLIGHT_COLORS = [
  "#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8",
  "#fde68a", "#fed7aa", "#c4b5fd", "#a5f3fc",
  "#fecaca", "#e9d5ff", "#d1fae5", "#fee2e2",
];

export type RibbonTab = "file" | "home" | "layout" | "insert" | "table";

export const RIBBON_TABS: { id: RibbonTab; label: string }[] = [
  { id: "file", label: "Файл" },
  { id: "home", label: "Главная" },
  { id: "layout", label: "Макет" },
  { id: "insert", label: "Вставка" },
  { id: "table", label: "Таблица" },
];

export type BorderPreset = {
  label: string;
  attrs: { borderTop: boolean; borderRight: boolean; borderBottom: boolean; borderLeft: boolean };
};

export const BORDER_PRESETS: BorderPreset[] = [
  { label: "Все границы", attrs: { borderTop: true, borderRight: true, borderBottom: true, borderLeft: true } },
  { label: "Без границ", attrs: { borderTop: false, borderRight: false, borderBottom: false, borderLeft: false } },
  { label: "Только верх", attrs: { borderTop: true, borderRight: false, borderBottom: false, borderLeft: false } },
  { label: "Только низ", attrs: { borderTop: false, borderRight: false, borderBottom: true, borderLeft: false } },
  { label: "Только лево", attrs: { borderTop: false, borderRight: false, borderBottom: false, borderLeft: true } },
  { label: "Только право", attrs: { borderTop: false, borderRight: true, borderBottom: false, borderLeft: false } },
  { label: "Внешние", attrs: { borderTop: true, borderRight: true, borderBottom: true, borderLeft: true } },
];

export const BORDER_WIDTHS = [1, 2, 3, 4, 5];
