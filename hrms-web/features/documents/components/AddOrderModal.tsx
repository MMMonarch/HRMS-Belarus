"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  CONSOLIDATED_ORDER_TEMPLATES_FALLBACK,
  getOrderTemplateDefaultTitle,
  type ConsolidatedOrderTemplate,
} from "@/features/documents/types";

export type AddOrderFormData = {
  /** Дата для отображения (DD.MM.YYYY) */
  orderDate: string;
  /** Дата для API (YYYY-MM-DD) */
  orderDateISO: string;
  regNumber: string;
  title: string;
  /** UUID шаблона (templates.id) */
  templateId: string;
  /** UUID шаблона виз сводного приказа (templates.id) или пусто */
  visaTemplateId?: string;
};

/** Элемент списка шаблонов виз для селекта */
export type OrderVisaTemplateOption = { id: string; name: string };

type AddOrderModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: AddOrderFormData) => void;
  /** Шаблоны из API (templates, type=order_header). Если не переданы — fallback. */
  templates?: ConsolidatedOrderTemplate[];
  /** Шаблоны виз сводного приказа (templates, template_type=визы). Опционально. */
  visaTemplates?: OrderVisaTemplateOption[];
};

import {
  parseDateDDMMYYYY,
  formatTodayDDMMYYYY,
} from "@/lib/date-utils";

const templatesDefault = CONSOLIDATED_ORDER_TEMPLATES_FALLBACK;

export function AddOrderModal({
  open,
  onOpenChange,
  onConfirm,
  templates = templatesDefault,
  visaTemplates = [],
}: AddOrderModalProps) {
  const firstTemplate = templates[0];
  const [orderDate, setOrderDate] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState(firstTemplate?.id ?? "");
  const [visaTemplateId, setVisaTemplateId] = useState("");

  const selectedTemplate: ConsolidatedOrderTemplate | undefined =
    templates.find((t) => t.id === templateId) ?? firstTemplate;

  useEffect(() => {
    if (open) {
      setOrderDate(formatTodayDDMMYYYY());
      setRegNumber("");
      setTemplateId(firstTemplate?.id ?? "");
      setVisaTemplateId("");
      setTitle(firstTemplate ? getOrderTemplateDefaultTitle(firstTemplate) : "");
    }
  }, [open, firstTemplate?.id]);

  useEffect(() => {
    if (open && selectedTemplate && templateId) {
      setTitle(getOrderTemplateDefaultTitle(selectedTemplate));
    }
  }, [templateId, open]);

  const handleSubmit = () => {
    const dateDisplay = orderDate.trim();
    const iso = parseDateDDMMYYYY(orderDate);
    if (!iso) return;
    onConfirm({
      orderDate: dateDisplay,
      orderDateISO: iso,
      regNumber: regNumber.trim(),
      title: title.trim(),
      templateId: templateId || (firstTemplate?.id ?? ""),
      visaTemplateId: visaTemplateId || undefined,
    });
    onOpenChange(false);
  };

  const orderDateISO = parseDateDDMMYYYY(orderDate);
  const canSubmit =
    !!orderDateISO && regNumber.trim() !== "" && title.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Добавить сводный приказ</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Дата приказа
            </label>
            <DatePicker
              value={orderDate}
              onChange={setOrderDate}
              placeholder="01.01.2025"
              aria-label="Дата приказа"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Номер приказа
            </label>
            <Input
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              placeholder="Напр. 12-К, 5-л"
              className="h-9"
              aria-label="Номер приказа"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Шаблон сводного приказа
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Шаблон сводного приказа"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {visaTemplates.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Тип визы сводного приказа
              </label>
              <select
                value={visaTemplateId}
                onChange={(e) => setVisaTemplateId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Тип визы сводного приказа"
              >
                <option value="">— Не выбрано —</option>
                {visaTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Наименование приказа
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Напр. Приказ о приёме на работу"
              className="h-9"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              aria-label="Наименование приказа"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button size="sm" disabled={!canSubmit} onClick={handleSubmit}>
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
