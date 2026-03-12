"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import type { ConsolidatedOrder, OrderItem } from "@/features/documents/types";
import { OrderItemCard } from "./OrderItemCard";
import { SelectEmployeesModal, type EmployeeOption } from "./SelectEmployeesModal";

/** Выбранные id пунктов приказа (для удаления и подсветки); можно выбрать несколько */
export type SelectedItemIds = string[];

type OrderDetailPanelProps = {
  order: ConsolidatedOrder | null;
  items: OrderItem[];
  selectedItemIds: SelectedItemIds;
  onToggleItemSelection: (id: string) => void;
  onAddItems: (employees: EmployeeOption[]) => void;
  onRequestDelete: () => void;
  onSaveItem: (id: string, data: Partial<OrderItem>) => void | Promise<void>;
  onPrintItem?: (id: string) => void;
  /** id пункта, по которому идёт сохранение (блокировать кнопку «Сохранить»). */
  savingItemId?: string | null;
  /** Список лиц из v_persons_list для модалки «Добавить» (уже отфильтрованы: только не active по филиалу приказа). */
  employeesForAddModal?: EmployeeOption[];
  /** id лиц с активной занятостью в филиале приказа — для них в карточке пункта скрывают тип «Приём». */
  personIdsWithActiveEmployment?: string[];
  /** Типы пунктов приказа из order_item_types (номера и наименования для селекта). */
  orderItemTypes?: { id: string; number: number; name: string }[];
  /** Подтипы для «Приказ об отпуске» (order_item_subtypes по type 3) для селекта в карточке. */
  orderItemSubtypesForLeave?: { id: string; name: string }[];
  /** Шаблоны пункта приказа (templates с template_type = 2) для селекта в карточке. */
  orderItemTemplates?: { id: string; name: string }[];
  /** Должности филиала приказа для селектов в карточке пункта (приём, перевод). */
  positionsForOrderItems?: { id: string; name: string }[];
  /** Подразделения филиала приказа для селектов в карточке пункта (приём, перевод). */
  departmentsForOrderItems?: { id: string; name: string }[];
  /** Шаблоны контракта/трудового договора (templates с template_type = 4) для селекта в приёме. */
  contractTemplatesForOrderItems?: { id: string; name: string }[];
  /** Идёт добавление пунктов (блокировать кнопку «Добавить»). */
  addItemsLoading?: boolean;
  /** Идёт загрузка списка пунктов. */
  itemsLoading?: boolean;
  className?: string;
};

export function OrderDetailPanel({
  order,
  items,
  selectedItemIds,
  onToggleItemSelection,
  onAddItems,
  onRequestDelete,
  onSaveItem,
  onPrintItem,
  savingItemId,
  employeesForAddModal,
  personIdsWithActiveEmployment = [],
  orderItemTypes,
  orderItemSubtypesForLeave,
  orderItemTemplates,
  positionsForOrderItems,
  departmentsForOrderItems,
  contractTemplatesForOrderItems,
  addItemsLoading,
  itemsLoading,
  className,
}: OrderDetailPanelProps) {
  const [selectModalOpen, setSelectModalOpen] = useState(false);

  if (!order) {
    return (
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-8",
          className
        )}
      >
        <p className="text-muted-foreground">Выберите приказ из списка</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-1 flex-col overflow-hidden", className)}>
      <SelectEmployeesModal
        open={selectModalOpen}
        onOpenChange={setSelectModalOpen}
        onConfirm={(employees) => {
          onAddItems(employees);
          setSelectModalOpen(false);
        }}
        branchId={order.branch_id ?? null}
        employees={employeesForAddModal}
      />
      {/* Закреплённая панель кнопок — всегда видна при прокрутке */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-3 sticky top-0 z-10">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => setSelectModalOpen(true)}
            disabled={addItemsLoading}
          >
            <Plus className="size-4 mr-1" />
            {addItemsLoading ? "Добавление…" : "Добавить"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedItemIds.length === 0}
            onClick={onRequestDelete}
          >
            <Trash2 className="size-4 mr-1" />
            Удалить{selectedItemIds.length > 0 ? ` (${selectedItemIds.length})` : ""}
          </Button>
        </div>
      </div>

      {/* Список пунктов приказа — прокручивается */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex flex-col gap-4">
          {itemsLoading ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
              <p className="text-sm text-muted-foreground">Загрузка пунктов…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Нет пунктов приказа. Нажмите «Добавить», чтобы создать первый пункт.
              </p>
            </div>
          ) : (
            items.map((item, index) => (
              <OrderItemCard
                key={item.id}
                item={item}
                seq={index + 1}
                isSelected={selectedItemIds.includes(item.id)}
                onSelect={() => onToggleItemSelection(item.id)}
                onSave={onSaveItem}
                onPrint={onPrintItem ?? (() => {})}
                savingItemId={savingItemId}
                personHasActiveEmployment={personIdsWithActiveEmployment.includes(item.employeeId)}
                orderItemTypes={orderItemTypes}
                orderItemSubtypesForLeave={orderItemSubtypesForLeave}
                orderItemTemplates={orderItemTemplates}
                positionsForOrderItems={positionsForOrderItems}
                departmentsForOrderItems={departmentsForOrderItems}
                contractTemplatesForOrderItems={contractTemplatesForOrderItems}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
