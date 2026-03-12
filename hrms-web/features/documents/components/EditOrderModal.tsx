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
  type ConsolidatedOrder,
  type ConsolidatedOrderTemplate,
} from "@/features/documents/types";
import { parseDateDDMMYYYY } from "@/lib/date-utils";
import { type AddOrderFormData, type OrderVisaTemplateOption } from "./AddOrderModal";

type EditOrderModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: AddOrderFormData) => void;
  order: ConsolidatedOrder | null;
  /** Шаблоны из API. Если не переданы — fallback. */
  templates?: ConsolidatedOrderTemplate[];
  /** Шаблоны виз сводного приказа для селекта. */
  visaTemplates?: OrderVisaTemplateOption[];
};

const templatesDefault = CONSOLIDATED_ORDER_TEMPLATES_FALLBACK;

export function EditOrderModal({
  open,
  onOpenChange,
  onConfirm,
  order,
  templates = templatesDefault,
  visaTemplates = [],
}: EditOrderModalProps) {
  const firstTemplate = templates[0];
  const [orderDate, setOrderDate] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState(firstTemplate?.id ?? "");
  const [visaTemplateId, setVisaTemplateId] = useState("");

  const selectedTemplate: ConsolidatedOrderTemplate | undefined =
    templates.find((t) => t.id === templateId) ?? firstTemplate;

  useEffect(() => {
    if (open && order) {
      setOrderDate(order.orderDate ?? "");
      setRegNumber(order.regNumber ?? "");
      setTitle(order.title ?? "");
      setTemplateId(order.templateId ?? firstTemplate?.id ?? "");
      setVisaTemplateId(order.visaTemplateId ?? "");
    }
  }, [open, order, firstTemplate?.id]);

  useEffect(() => {
    if (open && order && selectedTemplate && templateId && templateId !== order.templateId) {
      setTitle(getOrderTemplateDefaultTitle(selectedTemplate));
    }
  }, [templateId, open, order?.templateId]);

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

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Редактировать сводный приказ</DialogTitle>
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
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
