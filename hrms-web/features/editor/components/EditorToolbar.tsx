"use client";

import { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Minus,
  Plus,
  TableIcon,
  RemoveFormatting,
  Save,
  Printer,
  Settings2,
  FilePlus,
  FolderOpen,
  Download,
  FileJson,
  Indent,
  Outdent,
  Type,
  Highlighter,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { EditorMode } from "../types";
import { DEFAULT_CONTENT } from "../types";
import { getCurrentLineIndent } from "../extensions/line-indent";

import {
  FONT_FAMILIES,
  FONT_SIZES,
  TEXT_COLORS,
  HIGHLIGHT_COLORS,
  RIBBON_TABS as TABS,
  BORDER_PRESETS,
  BORDER_WIDTHS,
  type RibbonTab,
  type BorderPreset,
} from "../constants";

/* ═══════════════════════════ Types ═══════════════════════════ */

export type EditorToolbarProps = {
  editor: Editor | null;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onSave: () => void;
  onPrint: () => void;
  onPageSettings: () => void;
  onShowTemplateList: () => void;
  onClearVariablesCache?: () => void;
  saving?: boolean;
  hasTemplate?: boolean;
};

/* ═══════════════════════════ Primitives ═══════════════════════════ */

function RibbonGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-stretch border-r border-border/40 px-2.5",
        className,
      )}
    >
      <div className="flex flex-1 items-center gap-0.5 py-1.5">
        {children}
      </div>
      <span className="select-none pb-1 text-center text-[9px] uppercase tracking-wider text-muted-foreground/60">
        {label}
      </span>
    </div>
  );
}

function TBtn({
  active,
  disabled,
  onClick,
  title,
  children,
  className,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-foreground/80 hover:bg-accent/60",
        disabled && "pointer-events-none opacity-30",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

function RibbonButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs transition-colors hover:bg-accent/50",
        disabled && "pointer-events-none opacity-30",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function SmallTextBtn({
  label,
  active,
  disabled,
  onClick,
  title,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "h-6 whitespace-nowrap rounded px-1.5 text-[11px] transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-foreground/80 hover:bg-accent/60",
        disabled && "pointer-events-none opacity-30",
      )}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {label}
    </button>
  );
}

/* ═══════════════════════════ Color Picker ═══════════════════════════ */

function ColorPicker({
  colors,
  value,
  onChange,
  title,
  icon,
}: {
  colors: string[];
  value: string | null;
  onChange: (color: string) => void;
  title: string;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-accent/60"
        onClick={() => setOpen(!open)}
        title={title}
      >
        {icon}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 grid grid-cols-6 gap-1 rounded-lg border border-border bg-popover p-2 shadow-lg">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(
                "h-5 w-5 rounded-sm border transition-transform hover:scale-125",
                value === c
                  ? "border-primary ring-1 ring-primary"
                  : "border-border/40",
              )}
              style={{ backgroundColor: c }}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
          <button
            type="button"
            className="col-span-6 mt-1 rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent/50"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Сбросить
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ File Tab ═══════════════════════════ */

function FileTabContent({
  editor,
  onSave,
  onPrint,
  onShowTemplateList,
  onClearVariablesCache,
  saving,
  hasTemplate,
}: {
  editor: Editor | null;
  onSave: () => void;
  onPrint: () => void;
  onShowTemplateList: () => void;
  onClearVariablesCache?: () => void;
  saving?: boolean;
  hasTemplate?: boolean;
}) {
  const handleExportJSON = () => {
    if (!editor) return;
    const json = JSON.stringify(editor.getJSON(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !editor) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        editor.commands.setContent(json);
        toast.success("JSON загружен");
      } catch {
        toast.error("Некорректный JSON файл");
      }
    };
    input.click();
  };

  return (
    <div className="flex items-stretch">
      <RibbonGroup label="файл">
        <div className="flex items-center gap-1.5">
          <RibbonButton
            icon={FilePlus}
            label="Новый"
            onClick={() => {
              if (editor) editor.commands.setContent(DEFAULT_CONTENT);
            }}
          />
          <RibbonButton
            icon={FolderOpen}
            label="Открыть JSON"
            onClick={handleImportJSON}
          />
          <RibbonButton
            icon={Save}
            label="Сохранить"
            onClick={onSave}
            disabled={saving || !hasTemplate}
          />
          <RibbonButton
            icon={Download}
            label="Загрузить"
            onClick={onShowTemplateList}
          />
          {onClearVariablesCache && (
            <RibbonButton
              icon={RefreshCw}
              label="Очистить кеш переменных"
              onClick={onClearVariablesCache}
              disabled={!hasTemplate}
              title="Загрузить переменные заново с сервера"
            />
          )}
        </div>
      </RibbonGroup>
      <RibbonGroup label="экспорт" className="border-r-0">
        <div className="flex items-center gap-1.5">
          <RibbonButton
            icon={FileJson}
            label="Экспорт JSON"
            onClick={handleExportJSON}
            disabled={!editor}
          />
          <RibbonButton icon={Printer} label="Печать" onClick={onPrint} />
        </div>
      </RibbonGroup>
    </div>
  );
}

/* ═══════════════════════════ Home Tab ═══════════════════════════ */

function HomeTabContent({ editor }: { editor: Editor }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", bump);
    editor.on("update", bump);
    return () => {
      editor.off("selectionUpdate", bump);
      editor.off("update", bump);
    };
  }, [editor]);

  const attrs = editor.getAttributes("textStyle");
  const currentFont = (attrs.fontFamily as string) || "Times New Roman";
  const rawSize = (attrs.fontSize as string) || "";
  const sizeNum = rawSize ? rawSize.replace(/pt$/i, "") : "14";
  const currentColor = (attrs.color as string) || "";
  const hlAttrs = editor.getAttributes("highlight");
  const currentHighlight = (hlAttrs.color as string) || "";
  const lineIndent = getCurrentLineIndent(editor.state);

  return (
    <div className="flex items-stretch">
      {/* ИСТОРИЯ */}
      <RibbonGroup label="история">
        <div className="flex items-center gap-0.5">
          <TBtn
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Отменить (Ctrl+Z)"
          >
            <Undo2 className="size-4" />
          </TBtn>
          <TBtn
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Повторить (Ctrl+Y)"
          >
            <Redo2 className="size-4" />
          </TBtn>
        </div>
      </RibbonGroup>

      {/* ШРИФТ */}
      <RibbonGroup label="шрифт">
        <div className="flex flex-col gap-1">
          {/* Row 1: font family + size */}
          <div className="flex items-center gap-1">
            <select
              className="h-6 w-[130px] rounded border border-input bg-background px-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
              value={currentFont}
              onChange={(e) =>
                editor.chain().focus().setFontFamily(e.target.value).run()
              }
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>
                  {f}
                </option>
              ))}
            </select>
            <select
              className="h-6 w-14 rounded border border-input bg-background px-1 text-xs outline-none focus:ring-1 focus:ring-ring"
              value={sizeNum}
              onChange={(e) =>
                editor
                  .chain()
                  .focus()
                  .setFontSize(`${e.target.value}pt`)
                  .run()
              }
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {/* Row 2: B I U S · colors · clear */}
          <div className="flex items-center gap-0.5">
            <TBtn
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Жирный (Ctrl+B)"
            >
              <Bold className="size-3.5" />
            </TBtn>
            <TBtn
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Курсив (Ctrl+I)"
            >
              <Italic className="size-3.5" />
            </TBtn>
            <TBtn
              active={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Подчёркнутый (Ctrl+U)"
            >
              <UnderlineIcon className="size-3.5" />
            </TBtn>
            <TBtn
              active={editor.isActive("strike")}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="Зачёркнутый"
            >
              <Strikethrough className="size-3.5" />
            </TBtn>
            <ColorPicker
              colors={TEXT_COLORS}
              value={currentColor}
              onChange={(c) => {
                if (c) editor.chain().focus().setColor(c).run();
                else editor.chain().focus().unsetColor().run();
              }}
              title="Цвет текста"
              icon={
                <div className="flex flex-col items-center gap-0.5">
                  <Type className="size-3" />
                  <div
                    className="h-0.5 w-3.5 rounded-full"
                    style={{ backgroundColor: currentColor || "#000" }}
                  />
                </div>
              }
            />
            <ColorPicker
              colors={HIGHLIGHT_COLORS}
              value={currentHighlight}
              onChange={(c) => {
                if (c)
                  editor.chain().focus().toggleHighlight({ color: c }).run();
                else editor.chain().focus().unsetHighlight().run();
              }}
              title="Выделение"
              icon={
                <div className="flex flex-col items-center gap-0.5">
                  <Highlighter className="size-3" />
                  <div
                    className="h-0.5 w-3.5 rounded-full"
                    style={{
                      backgroundColor: currentHighlight || "#fef08a",
                    }}
                  />
                </div>
              }
            />
            <TBtn
              onClick={() => editor.chain().focus().unsetAllMarks().run()}
              title="Очистить форматирование"
            >
              <RemoveFormatting className="size-3.5" />
            </TBtn>
          </div>
        </div>
      </RibbonGroup>

      {/* АБЗАЦ */}
      <RibbonGroup label="абзац">
        <div className="flex flex-col gap-1">
          {/* Row 1: heading style + alignment */}
          <div className="flex items-center gap-0.5">
            <select
              className="h-6 w-24 rounded border border-input bg-background px-1 text-[11px] outline-none focus:ring-1 focus:ring-ring"
              value={
                editor.isActive("heading", { level: 1 })
                  ? "1"
                  : editor.isActive("heading", { level: 2 })
                    ? "2"
                    : editor.isActive("heading", { level: 3 })
                      ? "3"
                      : "p"
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === "p") editor.chain().focus().setParagraph().run();
                else
                  editor
                    .chain()
                    .focus()
                    .toggleHeading({ level: Number(val) as 1 | 2 | 3 })
                    .run();
              }}
            >
              <option value="p">Текст</option>
              <option value="1">Заголовок 1</option>
              <option value="2">Заголовок 2</option>
              <option value="3">Заголовок 3</option>
            </select>
            <TBtn
              active={editor.isActive({ textAlign: "left" })}
              onClick={() =>
                editor.chain().focus().setTextAlign("left").run()
              }
              title="По левому краю"
            >
              <AlignLeft className="size-3.5" />
            </TBtn>
            <TBtn
              active={editor.isActive({ textAlign: "center" })}
              onClick={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              title="По центру"
            >
              <AlignCenter className="size-3.5" />
            </TBtn>
            <TBtn
              active={editor.isActive({ textAlign: "right" })}
              onClick={() =>
                editor.chain().focus().setTextAlign("right").run()
              }
              title="По правому краю"
            >
              <AlignRight className="size-3.5" />
            </TBtn>
            <TBtn
              active={editor.isActive({ textAlign: "justify" })}
              onClick={() =>
                editor.chain().focus().setTextAlign("justify").run()
              }
              title="По ширине"
            >
              <AlignJustify className="size-3.5" />
            </TBtn>
          </div>
          {/* Row 2: lists + indent */}
          <div className="flex items-center gap-0.5">
            <SmallTextBtn
              label="• Список"
              active={editor.isActive("bulletList")}
              onClick={() =>
                editor.chain().focus().toggleBulletList().run()
              }
              title="Маркированный список"
            />
            <SmallTextBtn
              label="1. Список"
              active={editor.isActive("orderedList")}
              onClick={() =>
                editor.chain().focus().toggleOrderedList().run()
              }
              title="Нумерованный список"
            />
            <TBtn
              onClick={() =>
                editor.chain().focus().liftListItem("listItem").run()
              }
              disabled={!editor.can().liftListItem("listItem")}
              title="Уменьшить отступ"
            >
              <Outdent className="size-3.5" />
            </TBtn>
            <TBtn
              onClick={() =>
                editor.chain().focus().sinkListItem("listItem").run()
              }
              disabled={!editor.can().sinkListItem("listItem")}
              title="Увеличить отступ"
            >
              <Indent className="size-3.5" />
            </TBtn>
          </div>
        </div>
      </RibbonGroup>

      {/* ОТСТУП СТРОКИ (после Shift+Enter) */}
      <RibbonGroup label="строка" className="border-r-0">
        <div className="flex items-center gap-0.5">
          <TBtn
            onClick={() => editor.chain().focus().decreaseLineIndent().run()}
            disabled={lineIndent === null}
            title="Уменьшить отступ строки (−10px)"
          >
            <Outdent className="size-3.5" />
          </TBtn>
          <input
            type="number"
            min={0}
            step={10}
            value={lineIndent ?? 0}
            disabled={lineIndent === null}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) editor.chain().focus().setLineIndent(v).run();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor.commands.focus();
              }
            }}
            className={cn(
              "h-5 w-10 rounded border border-input bg-background text-center text-[10px] tabular-nums outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              lineIndent === null && "opacity-30",
            )}
            title={lineIndent !== null ? "Отступ строки (px)" : "Поставьте курсор после Shift+Enter"}
          />
          <TBtn
            onClick={() => editor.chain().focus().increaseLineIndent().run()}
            disabled={lineIndent === null}
            title="Увеличить отступ строки (+10px)"
          >
            <Indent className="size-3.5" />
          </TBtn>
        </div>
      </RibbonGroup>
    </div>
  );
}

/* ═══════════════════════════ Layout Tab ═══════════════════════════ */

function LayoutTabContent({
  onPageSettings,
}: {
  onPageSettings: () => void;
}) {
  return (
    <div className="flex items-stretch">
      <RibbonGroup label="страница" className="border-r-0">
        <RibbonButton
          icon={Settings2}
          label="Параметры страницы"
          onClick={onPageSettings}
        />
      </RibbonGroup>
    </div>
  );
}

/* ═══════════════════════════ Insert Tab ═══════════════════════════ */

function InsertTabContent({
  editor,
}: {
  editor: Editor;
}) {
  return (
    <div className="flex items-stretch">
      <RibbonGroup label="элементы" className="border-r-0">
        <div className="flex items-center gap-1.5">
          <RibbonButton
            icon={Minus}
            label="Линия"
            onClick={() =>
              editor.chain().focus().setHorizontalRule().run()
            }
          />
          <RibbonButton
            icon={TableIcon}
            label="Таблица 3×3"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          />
        </div>
      </RibbonGroup>
    </div>
  );
}

/* ═══════════════════════════ Table Tab ═══════════════════════════ */

function applyBorderPreset(editor: Editor, preset: BorderPreset) {
  const chain = editor.chain().focus();
  chain
    .setCellAttribute("borderTop", preset.attrs.borderTop)
    .setCellAttribute("borderRight", preset.attrs.borderRight)
    .setCellAttribute("borderBottom", preset.attrs.borderBottom)
    .setCellAttribute("borderLeft", preset.attrs.borderLeft)
    .run();
}

function toggleSingleBorder(editor: Editor, side: "borderTop" | "borderRight" | "borderBottom" | "borderLeft") {
  const { state } = editor;
  const { selection } = state;
  let current = true;
  const cellType = state.schema.nodes.tableCell ?? state.schema.nodes.tableHeader;
  if (cellType) {
    state.doc.nodesBetween(selection.from, selection.to, (node) => {
      if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
        if (node.attrs[side] === false) current = false;
      }
    });
  }
  editor.chain().focus().setCellAttribute(side, !current).run();
}

function BorderDropdown({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const applyBorderWidth = (width: number) => {
    editor.chain().focus().setCellAttribute("borderWidth", width).run();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs transition-colors hover:bg-accent/50",
          disabled && "pointer-events-none opacity-30",
        )}
      >
        {/* Grid/border icon */}
        <svg className="size-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="1" y="1" width="14" height="14" rx="1" />
          <line x1="8" y1="1" x2="8" y2="15" />
          <line x1="1" y1="8" x2="15" y2="8" />
        </svg>
        <span className="whitespace-nowrap">Границы</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg">
          {BORDER_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="flex w-full items-center rounded px-2.5 py-1.5 text-xs transition-colors hover:bg-accent/60"
              onClick={() => {
                applyBorderPreset(editor, p);
                setOpen(false);
              }}
            >
              {p.label}
            </button>
          ))}
          <div className="my-1 border-t border-border/40" />
          <p className="px-2.5 pb-1 pt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/60">
            Толщина границ
          </p>
          <div className="flex items-center gap-1 px-2 py-1">
            {BORDER_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                title={`${w}px`}
                className="flex size-7 items-center justify-center rounded border border-border/50 text-xs transition-colors hover:bg-accent/60"
                onClick={() => {
                  applyBorderWidth(w);
                  setOpen(false);
                }}
              >
                <div
                  className="bg-current"
                  style={{ width: "14px", height: `${w}px` }}
                />
              </button>
            ))}
          </div>
          <div className="my-1 border-t border-border/40" />
          <p className="px-2.5 pb-1 pt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/60">
            Переключить сторону
          </p>
          {(["borderTop", "borderRight", "borderBottom", "borderLeft"] as const).map((side) => {
            const labels = { borderTop: "Верх", borderRight: "Право", borderBottom: "Низ", borderLeft: "Лево" };
            return (
              <button
                key={side}
                type="button"
                className="flex w-full items-center rounded px-2.5 py-1.5 text-xs transition-colors hover:bg-accent/60"
                onClick={() => {
                  toggleSingleBorder(editor, side);
                  setOpen(false);
                }}
              >
                ↔ {labels[side]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type AlignPos = { h: "left" | "center" | "right"; v: "top" | "middle" | "bottom" };

const ALIGN_GRID: AlignPos[][] = [
  [{ h: "left", v: "top" }, { h: "center", v: "top" }, { h: "right", v: "top" }],
  [{ h: "left", v: "middle" }, { h: "center", v: "middle" }, { h: "right", v: "middle" }],
  [{ h: "left", v: "bottom" }, { h: "center", v: "bottom" }, { h: "right", v: "bottom" }],
];

const ALIGN_H_ICONS: Record<string, string> = {
  left: "M2 4h12M2 8h8M2 12h10",
  center: "M2 4h12M4 8h8M3 12h10",
  right: "M2 4h12M6 8h8M4 12h10",
};

const ALIGN_V_OFFSETS: Record<string, number> = { top: 0, middle: 4, bottom: 8 };

function AlignmentGrid({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  return (
    <div className={cn("grid grid-cols-3 gap-0.5", disabled && "pointer-events-none opacity-30")}>
      {ALIGN_GRID.flat().map((pos) => {
        const key = `${pos.v}-${pos.h}`;
        const vOff = ALIGN_V_OFFSETS[pos.v];
        return (
          <button
            key={key}
            type="button"
            title={`${pos.v} ${pos.h}`}
            className="flex size-7 items-center justify-center rounded transition-colors hover:bg-accent/60"
            onClick={() => {
              editor
                .chain()
                .focus()
                .setCellAttribute("verticalAlign", pos.v)
                .setTextAlign(pos.h)
                .run();
            }}
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="0.5" y="0.5" width="15" height="15" rx="1.5" strokeOpacity="0.3" />
              {/* Horizontal align lines */}
              <g transform={`translate(0,${vOff})`}>
                <path d={ALIGN_H_ICONS[pos.h]} strokeWidth="1.5" strokeLinecap="round" />
              </g>
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function TableTabContent({ editor }: { editor: Editor }) {
  const inTable = editor.isActive("table");
  return (
    <div className="flex items-stretch">
      <RibbonGroup label="строки и столбцы">
        <div className="flex items-center gap-1.5">
          <RibbonButton
            icon={Plus}
            label="Строка ↓"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            disabled={!inTable}
          />
          <RibbonButton
            icon={Plus}
            label="Столбец →"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            disabled={!inTable}
          />
          <RibbonButton
            icon={Minus}
            label="Строку"
            onClick={() => editor.chain().focus().deleteRow().run()}
            disabled={!inTable}
          />
          <RibbonButton
            icon={Minus}
            label="Столбец"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            disabled={!inTable}
          />
        </div>
      </RibbonGroup>
      <RibbonGroup label="границы">
        <BorderDropdown editor={editor} disabled={!inTable} />
      </RibbonGroup>
      <RibbonGroup label="выравнивание">
        <AlignmentGrid editor={editor} disabled={!inTable} />
      </RibbonGroup>
      <RibbonGroup label="таблица" className="border-r-0">
        <RibbonButton
          icon={Trash2}
          label="Удалить"
          onClick={() => editor.chain().focus().deleteTable().run()}
          disabled={!inTable}
        />
      </RibbonGroup>
    </div>
  );
}

/* ═══════════════════════════ Main Component ═══════════════════════════ */

export function EditorToolbar({
  editor,
  mode,
  onModeChange,
  onSave,
  onPrint,
  onPageSettings,
  onShowTemplateList,
  onClearVariablesCache,
  saving,
  hasTemplate,
}: EditorToolbarProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>("home");

  if (!editor) return null;

  const isTemplate = mode === "template";

  return (
    <div className="editor-toolbar flex w-full shrink-0 flex-col border-b border-border bg-card">
      {/* ── Tab row ── */}
      <div className="flex items-center border-b border-border/40">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "relative px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="ml-auto mr-2 flex items-center rounded-md border border-border text-[11px]">
          <button
            type="button"
            className={cn(
              "rounded-l-md px-2.5 py-1 transition-colors",
              isTemplate
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent",
            )}
            onClick={() => onModeChange("template")}
          >
            Шаблон
          </button>
          <button
            type="button"
            className={cn(
              "rounded-r-md px-2.5 py-1 transition-colors",
              !isTemplate
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent",
            )}
            onClick={() => onModeChange("document")}
          >
            Документ
          </button>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="min-h-[68px]">
        {activeTab === "file" && (
          <FileTabContent
            editor={editor}
            onSave={onSave}
            onPrint={onPrint}
            onShowTemplateList={onShowTemplateList}
            onClearVariablesCache={onClearVariablesCache}
            saving={saving}
            hasTemplate={hasTemplate}
          />
        )}
        {activeTab === "home" && <HomeTabContent editor={editor} />}
        {activeTab === "layout" && (
          <LayoutTabContent onPageSettings={onPageSettings} />
        )}
        {activeTab === "insert" && <InsertTabContent editor={editor} />}
        {activeTab === "table" && <TableTabContent editor={editor} />}
      </div>
    </div>
  );
}
