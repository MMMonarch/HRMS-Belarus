"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspaceOptional } from "@/lib/context/workspace";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { parseListResponse } from "@/lib/n8n/client";
import type { OrderTemplate } from "../types";
import { useReferenceList } from "../hooks/useReferenceList";
import { InlineNameCell } from "./InlineNameCell";

/** Тип шаблона из справочника template_types */
export type TemplateTypeOption = {
  id: string;
  number: number;
  name: string;
};

type RawTemplateRow = {
  id: string;
  name: string;
  template_type?: number | string;
  template_html?: { default_title?: string } | null;
};

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  order_header: "Шапка сводного приказа",
  order_item: "Пункт приказа",
  document: "Документ для печати",
};

function mapTemplateRowToOrderTemplate(r: RawTemplateRow): OrderTemplate {
  const html = r.template_html;
  const default_title =
    (html && typeof html === "object" && "default_title" in html
      ? (html as { default_title?: string }).default_title
      : undefined) ?? r.name;
  return {
    id: r.id,
    name: r.name,
    default_title,
    template_type: r.template_type as OrderTemplate["template_type"],
    template_html: r.template_html ?? undefined,
  };
}

const DEFAULT_TEMPLATE_HTML_JSON = '{"default_title": ""}';

export function OrderTemplatesEditor() {
  const workspace = useWorkspaceOptional();
  const {
    list,
    sortedList,
    loading,
    error,
    selectedIds,
    sortDir,
    savingId,
    deleting,
    toggleSort,
    toggleSelect,
    toggleSelectAll,
    saveField,
    addItem,
    deleteSelected,
    crudRef,
  } = useReferenceList<OrderTemplate>({
    table: "templates",
    sortFn: (a, b) => (a.name ?? "").localeCompare(b.name ?? "", "ru"),
    normalize: (raw) => mapTemplateRowToOrderTemplate(raw as RawTemplateRow),
  });

  const [templateTypes, setTemplateTypes] = useState<TemplateTypeOption[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemplateTypeNumber, setNewTemplateTypeNumber] = useState<number | "">("");
  const [newTemplateHtmlJson, setNewTemplateHtmlJson] = useState(DEFAULT_TEMPLATE_HTML_JSON);
  const [adding, setAdding] = useState(false);

  const fetchTemplateTypes = useCallback(async () => {
    try {
      const data = await crudRef.current("template_types", "get");
      const arr = parseListResponse(data) as { id: string; number: number; name: string }[];
      const list = Array.isArray(arr)
        ? arr
            .filter((r) => r != null && typeof r.number === "number" && r.name != null)
            .map((r) => ({ id: r.id, number: r.number, name: String(r.name) }))
            .sort((a, b) => a.number - b.number)
        : [];
      setTemplateTypes(list);
    } catch {
      setTemplateTypes([
        { id: "", number: 1, name: "Шапка сводного приказа" },
        { id: "", number: 2, name: "Пункт приказа" },
        { id: "", number: 3, name: "Документ для печати" },
      ]);
    }
  }, [crudRef]);

  useEffect(() => {
    void fetchTemplateTypes();
  }, [fetchTemplateTypes]);

  const handleSaveName = (id: string, name: string) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.name === name.trim()) return;
    void saveField(id, "name", name.trim());
  };

  const handleSaveDefaultTitle = (id: string, default_title: string) => {
    const row = list.find((r) => r.id === id);
    if (!row || row.default_title === default_title.trim()) return;
    const template_html = {
      ...(row.template_html && typeof row.template_html === "object"
        ? row.template_html
        : {}),
      default_title: default_title.trim(),
    };
    void saveField(id, "template_html", template_html as Record<string, unknown>);
  };

  const handleAdd = async () => {
    const name = newName.trim();
    const template_type =
      newTemplateTypeNumber === "" ? undefined : Number(newTemplateTypeNumber);
    if (!name || template_type === undefined) {
      toast.error("Укажите наименование и тип шаблона");
      return;
    }
    let template_html: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(newTemplateHtmlJson);
      template_html =
        parsed != null && typeof parsed === "object" ? parsed : {};
    } catch {
      toast.error("Содержимое шаблона: неверный JSON");
      return;
    }
    setAdding(true);
    try {
      await addItem({
        name,
        template_type,
        template_html,
        branch_id: workspace?.branchId ?? undefined,
      });
      setNewName("");
      setNewTemplateTypeNumber(templateTypes[0]?.number ?? "");
      setNewTemplateHtmlJson(DEFAULT_TEMPLATE_HTML_JSON);
      setAddOpen(false);
      toast.success("Шаблон добавлен");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка добавления");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
        Загрузка…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-4 mr-2" />
          Добавить
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={selectedIds.size === 0 || deleting}
          onClick={deleteSelected}
        >
          <Trash2 className="size-4 mr-2" />
          Удалить
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={selectedIds.size !== 1}
          onClick={() => {
            const id = Array.from(selectedIds)[0];
            if (id) window.location.href = `/editor?templateId=${id}`;
          }}
          title={
            selectedIds.size !== 1
              ? "Выберите один шаблон"
              : "Открыть выбранный шаблон в редакторе"
          }
        >
          <Pencil className="size-4 mr-2" />
          Открыть в редакторе
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  sortedList.length > 0 && selectedIds.size === sortedList.length
                }
                onCheckedChange={toggleSelectAll}
                aria-label="Выбрать все"
              />
            </TableHead>
            <TableHead>
              <button
                type="button"
                onClick={toggleSort}
                className="hover:underline focus:outline-none focus:underline"
              >
                Название шаблона {sortDir === "asc" ? "↑" : "↓"}
              </button>
            </TableHead>
            <TableHead className="min-w-[160px]">
              Тип шаблона
            </TableHead>
            <TableHead className="min-w-[200px]">
              Содержание шаблона
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedList.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="w-10">
                <Checkbox
                  checked={selectedIds.has(row.id)}
                  onCheckedChange={() => toggleSelect(row.id)}
                  aria-label={`Выбрать ${row.name}`}
                />
              </TableCell>
              <TableCell className="p-0">
                <InlineNameCell
                  value={row.name}
                  saving={savingId === row.id}
                  onBlur={(value) => handleSaveName(row.id, value)}
                  ariaLabel="Название шаблона"
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {(() => {
                  const tt = row.template_type;
                  if (typeof tt === "number") {
                    return templateTypes.find((t) => t.number === tt)?.name ?? String(tt);
                  }
                  return TEMPLATE_TYPE_LABELS[String(tt ?? "")] ?? (tt != null ? String(tt) : "—");
                })()}
              </TableCell>
              <TableCell className="p-0">
                <InlineNameCell
                  value={row.default_title ?? ""}
                  saving={savingId === row.id}
                  onBlur={(value) => handleSaveDefaultTitle(row.id, value)}
                  ariaLabel="Содержание шаблона"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {sortedList.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Нет записей. Нажмите «Добавить», чтобы создать шаблон сводного приказа.
        </p>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (open && newTemplateTypeNumber === "" && templateTypes.length > 0) {
            setNewTemplateTypeNumber(templateTypes[0].number);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Добавить шаблон</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Наименование шаблона
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Напр. Приказ о приёме на работу"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Тип шаблона
              </label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={newTemplateTypeNumber === "" ? "" : String(newTemplateTypeNumber)}
                onChange={(e) => {
                  const v = e.target.value;
                  setNewTemplateTypeNumber(v === "" ? "" : Number(v));
                }}
                title="Тип шаблона"
              >
                <option value="">Выберите тип</option>
                {templateTypes.map((t) => (
                  <option key={t.id || t.number} value={t.number}>
                    {t.number}. {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Содержимое шаблона (template_html, jsonb)
              </label>
              <textarea
                className="min-h-[140px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={newTemplateHtmlJson}
                onChange={(e) => setNewTemplateHtmlJson(e.target.value)}
                placeholder='{"default_title": "Приказ о приёме на работу"}'
                spellCheck={false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              Отмена
            </Button>
            <Button
              size="sm"
              disabled={
                !newName.trim() ||
                newTemplateTypeNumber === "" ||
                adding
              }
              onClick={handleAdd}
            >
              {adding ? "Добавление…" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
