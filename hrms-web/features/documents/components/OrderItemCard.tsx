"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { isoToDisplay as isoToDDMMYYYY, isoToDateTimeDisplay as isoToDDMMYYYYHHmm, parseDateDDMMYYYY } from "@/lib/date-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Save, Plus, Trash2 } from "lucide-react";
import type { OrderItem, OrderItemTypeCode } from "@/features/documents/types";
import type { LeavePeriodRow } from "@/features/documents/types";
import type { ContractTermKind, ContractType } from "@/features/documents/types";
import {
  ORDER_ITEM_TYPES,
  ORDER_ITEM_TEMPLATES,
  MOCK_POSITIONS,
  MOCK_DEPARTMENTS,
  MOCK_CONTRACT_TEMPLATES,
  CONTRACT_TYPES,
  CONTRACT_TERM_KINDS,
} from "@/features/documents/types";

/** Тип из справочника order_item_types (для селекта в карточке) */
export type OrderItemTypeOption = { id: string; number: number; name: string };

type OrderItemCardProps = {
  item: OrderItem;
  seq: number;
  isSelected: boolean;
  onSelect: () => void;
  onSave: (id: string, data: Partial<OrderItem>) => void | Promise<void>;
  onPrint: (id: string) => void;
  /** id пункта, по которому идёт сохранение (показать «Сохранение…» и отключить кнопку). */
  savingItemId?: string | null;
  /** Типы пунктов приказа из API (order_item_types). Если не переданы — используются константы ORDER_ITEM_TYPES. */
  orderItemTypes?: OrderItemTypeOption[];
  /** Шаблоны пункта приказа (templates с template_type = 2). Если переданы — в селекте выводятся они. */
  orderItemTemplates?: { id: string; name: string }[];
  /** Должности филиала приказа (справочник positions) для селектов «Должность» / «Должность (на какую переводится)». */
  positionsForOrderItems?: { id: string; name: string }[];
  /** Подразделения филиала приказа (справочник departments) для селектов «Подразделение». */
  departmentsForOrderItems?: { id: string; name: string }[];
  /** Шаблоны контракта/трудового договора (templates с template_type = 4) для селекта в приёме. Могут содержать contractType для фильтра по типу документа. */
  contractTemplatesForOrderItems?: { id: string; name: string; contractType?: ContractType }[];
  /** Подтипы для «Приказ об отпуске» (order_item_subtypes по type 3) — селект подтипа отпуска. */
  orderItemSubtypesForLeave?: { id: string; name: string }[];
  /** У лица уже есть активная занятость (не уволен) — скрыть тип «Приём», повторный приём запрещён. */
  personHasActiveEmployment?: boolean;
};

function parseLeavePeriods(data: Record<string, unknown> | undefined): LeavePeriodRow[] {
  const periods = data?.periods as LeavePeriodRow[] | undefined;
  if (Array.isArray(periods) && periods.length > 0) return periods;
  return [{ id: "1", dateFrom: "", dateTo: "", mainDays: 0, contractDays: 0 }];
}

/** templateId из payload (API может вернуть templateId или template_id) */
function getTemplateIdFromData(data: Record<string, unknown> | undefined): string {
  if (!data) return "";
  return (data.templateId as string) ?? (data.template_id as string) ?? "";
}

/** Дата из payload для отображения в форме: если пришла ISO (YYYY-MM-DD) — в DD.MM.YYYY, иначе как есть. */
function getContractDateDisplay(
  data: Record<string, unknown> | undefined,
  field: "validFrom" | "validTo"
): string {
  const camel = field === "validFrom" ? "validFrom" : "validTo";
  const snake = field === "validFrom" ? "valid_from" : "valid_to";
  const raw = (data?.[camel] ?? data?.[snake]) as string | undefined;
  if (!raw || typeof raw !== "string" || !raw.trim()) return "";
  return raw.includes("-") ? isoToDDMMYYYY(raw) : raw;
}

export function OrderItemCard({
  item,
  seq,
  isSelected,
  onSelect,
  onSave,
  onPrint,
  savingItemId,
  orderItemTypes,
  orderItemTemplates,
  positionsForOrderItems,
  departmentsForOrderItems,
  contractTemplatesForOrderItems,
  orderItemSubtypesForLeave,
  personHasActiveEmployment = false,
}: OrderItemCardProps) {
  const [employeeName, setEmployeeName] = useState(item.employeeName);
  /** Номер типа из order_item_types (1–5) — то, что хранится в БД */
  const [itemTypeNumber, setItemTypeNumber] = useState<number>(item.itemTypeNumber ?? 1);
  /** Подтип пункта (order_item_subtypes.id), для «Приказ об отпуске». */
  const [itemSubtypeId, setItemSubtypeId] = useState<string>(item.itemSubtypeId ?? "");
  /** UUID шаблона пункта приказа (templates, template_type=2), хранится в item.data.templateId / payload */
  const [templateId, setTemplateId] = useState(() => getTemplateIdFromData(item.data));
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => (item.effectiveFrom ? isoToDDMMYYYY(item.effectiveFrom) : "") || ""
  );
  const [effectiveTo, setEffectiveTo] = useState(
    () => (item.effectiveTo ? isoToDDMMYYYY(item.effectiveTo) : "") || ""
  );

  // Данные по типу приказа (хранятся в item.data)
  const [leavePeriods, setLeavePeriods] = useState<LeavePeriodRow[]>(() =>
    parseLeavePeriods(item.data)
  );
  const [transferPositionId, setTransferPositionId] = useState(
    (item.data?.newPositionId as string) ?? ""
  );
  const [transferDepartmentId, setTransferDepartmentId] = useState(
    (item.data?.newDepartmentId as string) ?? ""
  );
  const [hirePositionId, setHirePositionId] = useState((item.data?.positionId as string) ?? "");
  const [hireDepartmentId, setHireDepartmentId] = useState((item.data?.departmentId as string) ?? "");
  const [hireContractTemplateId, setHireContractTemplateId] = useState(
    (item.data?.contractTemplateId as string) ?? ""
  );
  const [hireLeaveDays, setHireLeaveDays] = useState<number>(
    typeof item.data?.leaveDays === "number" ? item.data.leaveDays : 0
  );
  /** Тип трудового документа при приёме */
  const [hireContractType, setHireContractType] = useState<ContractType>(() => {
    const v = (item.data?.contractType ?? item.data?.contract_type) as string | undefined;
    return v === "contract" ? "contract" : "employment_contract";
  });
  /** Вид срока (contract_term_kind) */
  const [hireContractTermKind, setHireContractTermKind] = useState<ContractTermKind>(() => {
    const v = (item.data?.contractTermKind ?? item.data?.contract_term_kind) as string | undefined;
    const valid: ContractTermKind[] = ["indefinite", "fixed_term", "fixed_term_work", "fixed_term_replacement", "seasonal", "contract"];
    return v && valid.includes(v as ContractTermKind) ? (v as ContractTermKind) : "indefinite";
  });
  /** Начало действия договора/контракта (DD.MM.YYYY в форме) */
  const [hireValidFrom, setHireValidFrom] = useState(() => {
    const fromData = getContractDateDisplay(item.data, "validFrom");
    if (fromData) return fromData;
    return item.effectiveFrom ? isoToDDMMYYYY(item.effectiveFrom) : "";
  });
  /** Окончание действия (DD.MM.YYYY); для бессрочного пусто */
  const [hireValidTo, setHireValidTo] = useState(() => getContractDateDisplay(item.data, "validTo"));

  /** Снимок данных, отправленных при последнем сохранении. Снимает подсветку сразу после Save. Сбрасываем только при переходе на другой пункт (другой item.id), чтобы после refetch не сравнивать с item (payload может прийти в другом формате). */
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<{
    employeeName: string;
    itemTypeNumber: number;
    itemSubtypeId: string;
    templateId: string;
    effectiveFrom: string;
    effectiveTo: string;
    data: Record<string, unknown>;
  } | null>(null);
  const prevItemIdRef = useRef(item.id);
  /** Ref, выставляемый синхронно в handleSave, чтобы useEffect не перезаписывал форму из item после refetch (state lastSavedSnapshot может обновиться позже или инстанс другой). */
  const hasSnapshotForItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    const isSameItem = prevItemIdRef.current === item.id;
    if (hasSnapshotForItemIdRef.current === item.id && isSameItem) {
      return;
    }
    const itemDataTemplateId = getTemplateIdFromData(item.data);
    setEmployeeName(item.employeeName);
    setItemTypeNumber(item.itemTypeNumber ?? 1);
    setItemSubtypeId(item.itemSubtypeId ?? "");
    setTemplateId(itemDataTemplateId);
    setEffectiveFrom(item.effectiveFrom ? isoToDDMMYYYY(item.effectiveFrom) : "");
    setEffectiveTo(item.effectiveTo ? isoToDDMMYYYY(item.effectiveTo) : "");
    setLeavePeriods(parseLeavePeriods(item.data));
    setTransferPositionId((item.data?.newPositionId as string) ?? "");
    setTransferDepartmentId((item.data?.newDepartmentId as string) ?? "");
    setHirePositionId((item.data?.positionId as string) ?? "");
    setHireDepartmentId((item.data?.departmentId as string) ?? "");
    setHireContractTemplateId((item.data?.contractTemplateId as string) ?? "");
    setHireLeaveDays(typeof item.data?.leaveDays === "number" ? item.data.leaveDays : 0);
    const ct = (item.data?.contractType ?? item.data?.contract_type) as string | undefined;
    setHireContractType(ct === "contract" ? "contract" : "employment_contract");
    const ctk = (item.data?.contractTermKind ?? item.data?.contract_term_kind) as string | undefined;
    const validKinds: ContractTermKind[] = ["indefinite", "fixed_term", "fixed_term_work", "fixed_term_replacement", "seasonal", "contract"];
    setHireContractTermKind(ctk && validKinds.includes(ctk as ContractTermKind) ? (ctk as ContractTermKind) : "indefinite");
    const vf = getContractDateDisplay(item.data, "validFrom");
    setHireValidFrom(vf || (item.effectiveFrom ? isoToDDMMYYYY(item.effectiveFrom) : ""));
    setHireValidTo(getContractDateDisplay(item.data, "validTo"));
    if (!isSameItem) {
      prevItemIdRef.current = item.id;
      hasSnapshotForItemIdRef.current = null;
      setLastSavedSnapshot(null);
    }
  }, [item.id, item.employeeName, item.itemTypeNumber, item.effectiveFrom, item.effectiveTo, item.data]);

  /** Список типов для селекта: из API (order_item_types) или fallback на константу */
  const typesForSelectRaw: OrderItemTypeOption[] =
    orderItemTypes?.length
      ? orderItemTypes
      : ORDER_ITEM_TYPES.map((t) => ({ id: t.id, number: t.number, name: t.name }));
  /** Скрываем «Приём» (number 1), если у лица уже есть активная занятость — второй приказ о приёме запрещён. Для применённого пункта приёма оставляем Приём в списке (селект и так отключён). */
  const isAppliedHire = item.status === "applied" && (item.itemTypeNumber ?? 1) === 1;
  /** Применённый пункт увольнения нельзя редактировать и менять тип — только удаление. */
  const isAppliedDismissal = item.status === "applied" && (item.itemTypeNumber ?? 1) === 5;
  /** Список типов с учётом ограничений: без Приёма для работающих, без Увольнения для уволенных/кандидатов. */
  const typesForSelect: OrderItemTypeOption[] = (() => {
    let list = typesForSelectRaw;
    if (personHasActiveEmployment && !isAppliedHire) {
      list = list.filter((t) => t.number !== 1);
    }
    if (!personHasActiveEmployment && !isAppliedDismissal) {
      list = list.filter((t) => t.number !== 5);
    }
    return list;
  })();

  /** Если выбранный тип отсутствует в списке (например Приём у работающего или Увольнение у уволенного) — переключаем на первый доступный */
  useEffect(() => {
    const hasCurrentInList = typesForSelect.some((t) => t.number === itemTypeNumber);
    if (!hasCurrentInList && typesForSelect.length > 0) {
      setItemTypeNumber(typesForSelect[0]!.number);
    }
  }, [itemTypeNumber, typesForSelect]);

  /** Код типа по номеру (для логики: leave, hire, transfer и т.д.) — по константе */
  const itemTypeCode =
    ORDER_ITEM_TYPES.find((t) => t.number === itemTypeNumber)?.code ?? "hire";
  /** Дата окончания нужна только для отпуска и прочих с периодом (не для приёма/перевода/увольнения) */
  const showEffectiveTo = itemTypeCode === "leave" || itemTypeCode === "other";
  /** Ошибка: дата окончания договора/контракта меньше даты начала (только для приёма, когда обе даты заполнены) */
  const hireValidToBeforeFrom =
    itemTypeCode === "hire" &&
    hireValidFrom.trim() !== "" &&
    hireValidTo.trim() !== "" &&
    parseDateDDMMYYYY(hireValidFrom) !== "" &&
    parseDateDDMMYYYY(hireValidTo) !== "" &&
    parseDateDDMMYYYY(hireValidTo) < parseDateDDMMYYYY(hireValidFrom);
  /** Ошибка: дата окончания указана и меньше даты начала (проверяем только при заполненной дате окончания) */
  const effectiveToBeforeFrom =
    showEffectiveTo &&
    effectiveTo.trim() !== "" &&
    effectiveFrom.trim() !== "" &&
    parseDateDDMMYYYY(effectiveFrom) !== "" &&
    parseDateDDMMYYYY(effectiveTo) !== "" &&
    parseDateDDMMYYYY(effectiveTo) < parseDateDDMMYYYY(effectiveFrom);
  /** Шаблоны для селекта: из API (все с template_type = 2) или fallback по типу пункта */
  const templatesForSelect =
    orderItemTemplates?.length
      ? orderItemTemplates
      : ORDER_ITEM_TEMPLATES.filter((t) => t.typeCode === itemTypeCode);
  /** Наименование типа: из справочника API */
  const typeName =
    typesForSelect.find((t) => t.number === itemTypeNumber)?.name ?? "";
  /** Должности для селектов: из API (филиал приказа) или fallback на константу */
  const positionsForSelect =
    positionsForOrderItems?.length ? positionsForOrderItems : MOCK_POSITIONS;
  /** Подразделения для селектов: из API (филиал приказа) или fallback на константу */
  const departmentsForSelect =
    departmentsForOrderItems?.length ? departmentsForOrderItems : MOCK_DEPARTMENTS;
  /** Виды срока только для выбранного типа документа: трудовой договор — все кроме «Контракт»; контракт — только «Контракт». */
  const termKindsForSelect = useMemo(
    () => CONTRACT_TERM_KINDS.filter((k) => k.documentType === hireContractType),
    [hireContractType]
  );
  /** Если текущий вид срока не входит в список для выбранного типа (например, загрузили контракт, потом переключили на трудовой договор) — подставляем первый вариант. */
  const effectiveTermKind =
    termKindsForSelect.some((k) => k.value === hireContractTermKind)
      ? hireContractTermKind
      : (termKindsForSelect[0]?.value ?? "indefinite");

  useEffect(() => {
    if (itemTypeCode !== "hire") return;
    if (!termKindsForSelect.some((k) => k.value === hireContractTermKind)) {
      setHireContractTermKind(termKindsForSelect[0]?.value ?? "indefinite");
    }
  }, [itemTypeCode, termKindsForSelect, hireContractTermKind]);
  /** Шаблоны контракта/трудового договора: из API (template_type = 4) или fallback; отфильтрованы по типу документа. */
  const contractTemplatesForSelect = useMemo(() => {
    const base =
      contractTemplatesForOrderItems?.length
        ? contractTemplatesForOrderItems
        : MOCK_CONTRACT_TEMPLATES;
    return base.filter((t) => !t.contractType || t.contractType === hireContractType);
  }, [contractTemplatesForOrderItems, hireContractType]);

  /** При смене типа с «отпуск» на другой — сбросить подтип (в БД триггер тоже сбросит). */
  useEffect(() => {
    if (itemTypeCode !== "leave") setItemSubtypeId("");
  }, [itemTypeCode]);

  /** При смене типа трудового документа: подставить подходящий вид срока и сбросить шаблон, если он не подходит. */
  const prevHireContractTypeRef = useRef(hireContractType);
  useEffect(() => {
    if (itemTypeCode !== "hire") return;
    if (prevHireContractTypeRef.current === hireContractType) return;
    prevHireContractTypeRef.current = hireContractType;
    if (hireContractType === "contract") {
      setHireContractTermKind("contract");
    } else {
      setHireContractTermKind("indefinite");
    }
    const base =
      contractTemplatesForOrderItems?.length
        ? contractTemplatesForOrderItems
        : MOCK_CONTRACT_TEMPLATES;
    const allowed = base.filter((t) => !t.contractType || t.contractType === hireContractType);
    const currentInAllowed = allowed.some((t) => t.id === hireContractTemplateId);
    if (hireContractTemplateId && !currentInAllowed) setHireContractTemplateId("");
  }, [hireContractType, itemTypeCode, hireContractTemplateId, contractTemplatesForOrderItems]);

  const buildDataByType = useCallback((): Record<string, unknown> => {
    switch (itemTypeCode) {
      case "leave":
        return { periods: leavePeriods };
      case "transfer":
        return { newPositionId: transferPositionId || undefined, newDepartmentId: transferDepartmentId || undefined };
      case "hire":
        return {
          positionId: hirePositionId || undefined,
          departmentId: hireDepartmentId || undefined,
          contractTemplateId: hireContractTemplateId || undefined,
          leaveDays: (hireLeaveDays !== undefined && hireLeaveDays !== null) ? hireLeaveDays : undefined,
          contractType: hireContractType,
          contractTermKind: hireContractTermKind,
          validFrom: hireValidFrom ? (parseDateDDMMYYYY(hireValidFrom) || undefined) : undefined,
          validTo: hireValidTo?.trim() ? (parseDateDDMMYYYY(hireValidTo) || undefined) ?? null : undefined,
        };
      default:
        return {};
    }
  }, [
    itemTypeCode,
    leavePeriods,
    transferPositionId,
    transferDepartmentId,
    hirePositionId,
    hireDepartmentId,
    hireContractTemplateId,
    hireLeaveDays,
    hireContractType,
    hireContractTermKind,
    hireValidFrom,
    hireValidTo,
  ]);

  /** Есть несохранённые изменения. Если есть снимок последнего сохранения — сравниваем с ним (подсветка снимается сразу после Save); иначе — с item. */
  const isDirty = useMemo(() => {
    const currentData = { ...buildDataByType(), templateId: templateId || undefined };
    const snapshot = lastSavedSnapshot;
    if (snapshot) {
      const fieldDirty =
        employeeName !== snapshot.employeeName ||
        itemTypeNumber !== snapshot.itemTypeNumber ||
        itemSubtypeId !== snapshot.itemSubtypeId ||
        templateId !== snapshot.templateId ||
        effectiveFrom !== snapshot.effectiveFrom ||
        effectiveTo !== snapshot.effectiveTo;
      const dataStr = JSON.stringify(currentData);
      const snapshotStr = JSON.stringify(snapshot.data);
      const dataDirty = dataStr !== snapshotStr;
      if (fieldDirty) return true;
      return dataDirty;
    }
    const itemFrom = item.effectiveFrom ? isoToDDMMYYYY(item.effectiveFrom) : "";
    const itemTo = item.effectiveTo ? isoToDDMMYYYY(item.effectiveTo) : "";
    const itemTemplateId = getTemplateIdFromData(item.data);
    if (
      employeeName !== item.employeeName ||
      itemTypeNumber !== (item.itemTypeNumber ?? 1) ||
      itemSubtypeId !== (item.itemSubtypeId ?? "") ||
      templateId !== itemTemplateId ||
      effectiveFrom !== itemFrom ||
      effectiveTo !== itemTo
    ) return true;
    const d = item.data ?? {};
    let savedData: Record<string, unknown>;
    if (itemTypeCode === "hire") {
      savedData = {
        positionId: (d.positionId as string) || undefined,
        departmentId: (d.departmentId as string) || undefined,
        contractTemplateId: (d.contractTemplateId as string) || undefined,
        leaveDays: typeof d.leaveDays === "number" ? d.leaveDays : undefined,
        contractType: (d.contractType ?? d.contract_type) as string | undefined,
        contractTermKind: (d.contractTermKind ?? d.contract_term_kind) as string | undefined,
        validFrom: (d.validFrom ?? d.valid_from) as string | undefined,
        validTo: (d.validTo ?? d.valid_to) as string | undefined,
        templateId: itemTemplateId || undefined,
      };
    } else if (itemTypeCode === "transfer") {
      savedData = {
        newPositionId: (d.newPositionId as string) || undefined,
        newDepartmentId: (d.newDepartmentId as string) || undefined,
        templateId: itemTemplateId || undefined,
      };
    } else if (itemTypeCode === "leave") {
      const itemPeriods = (d.periods as LeavePeriodRow[] | undefined) ?? [];
      if (leavePeriods.length !== itemPeriods.length) return true;
      const norm = (p: LeavePeriodRow) => `${p.dateFrom}|${p.dateTo}|${p.mainDays ?? 0}|${p.contractDays ?? 0}`;
      if (leavePeriods.some((p, i) => norm(p) !== norm(itemPeriods[i] ?? {}))) return true;
      savedData = { periods: itemPeriods, templateId: itemTemplateId || undefined };
    } else {
      savedData = { templateId: itemTemplateId || undefined };
    }
    if (itemTypeCode === "leave") {
      const rest = { ...currentData }; delete (rest as Record<string, unknown>).periods;
      const restSaved = { ...savedData }; delete (restSaved as Record<string, unknown>).periods;
      return JSON.stringify(rest) !== JSON.stringify(restSaved);
    }
    return JSON.stringify(currentData) !== JSON.stringify(savedData);
  }, [
    item,
    lastSavedSnapshot,
    employeeName,
    itemTypeNumber,
    templateId,
    effectiveFrom,
    effectiveTo,
    itemTypeCode,
    leavePeriods,
    buildDataByType,
  ]);

  const handleSave = () => {
    if (effectiveToBeforeFrom || hireValidToBeforeFrom) return;
    hasSnapshotForItemIdRef.current = item.id;
    const snapshotData = { ...buildDataByType(), templateId: templateId || undefined };
    setLastSavedSnapshot({
      employeeName,
      itemTypeNumber,
      itemSubtypeId,
      templateId,
      effectiveFrom,
      effectiveTo,
      data: snapshotData,
    });
    const typeNameRes =
      typesForSelect.find((t) => t.number === itemTypeNumber)?.name ?? item.itemTypeName;
    const typeInfo = ORDER_ITEM_TYPES.find((t) => t.number === itemTypeNumber);
    onSave(item.id, {
      employeeName,
      itemTypeNumber: typeInfo?.number ?? 1,
      itemTypeId: typeInfo?.id ?? "1",
      itemTypeCode: typeInfo?.code ?? "hire",
      itemTypeName: typeNameRes,
      itemSubtypeId: itemTypeCode === "leave" ? (itemSubtypeId || undefined) : null,
      effectiveFrom: effectiveFrom || undefined,
      effectiveTo: effectiveTo || undefined,
      body: item.body,
      data: { ...buildDataByType(), templateId: templateId || undefined },
    });
  };

  const addLeavePeriod = () => {
    setLeavePeriods((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        dateFrom: "",
        dateTo: "",
        mainDays: 0,
        contractDays: 0,
      },
    ]);
  };

  const removeLeavePeriod = (id: string) => {
    setLeavePeriods((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  };

  const updateLeavePeriod = (id: string, field: keyof LeavePeriodRow, value: string | number) => {
    setLeavePeriods((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "flex flex-col rounded-lg border bg-card text-left transition-colors cursor-pointer",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/30",
        isDirty && "border-emerald-500/60 ring-1 ring-emerald-500/30"
      )}
    >
      {/* Полоса для выбора пункта: клик выделяет или снимает выделение */}
      <div
        className="py-2 px-4 -mx-px rounded-t-lg border-b border-border/50 hover:bg-muted/40 flex items-center justify-between text-sm text-muted-foreground select-none"
        aria-hidden
      >
        <span>Пункт приказа № {seq}</span>
        <span className="text-xs">{isSelected ? "Клик — снять выделение" : "Клик — выбрать для удаления"}</span>
      </div>
      <div className="flex flex-col gap-4 p-4" onClick={(e) => e.stopPropagation()}>
        {/* Строка: ФИО, тип приказа, выбор шаблона, справа кнопки */}
        <div
          className={
            itemTypeCode === "leave" && orderItemSubtypesForLeave?.length
              ? "grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              : "grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          }
        >
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">ФИО сотрудника</label>
            <Input
              placeholder="Фамилия Имя Отчество"
              value={employeeName}
              readOnly
              className="h-9 cursor-default bg-muted/50"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Тип приказа</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
              value={itemTypeNumber}
              onChange={(e) => setItemTypeNumber(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              disabled={isAppliedHire || isAppliedDismissal}
              title={
                isAppliedHire
                  ? "Тип применённого пункта приёма нельзя менять: занятость и назначение уже созданы. Чтобы отменить приём, удалите пункт приказа."
                  : isAppliedDismissal
                    ? "Применённый пункт увольнения нельзя редактировать. Удалите пункт для отмены увольнения."
                    : undefined
              }
            >
              {typesForSelect.map((t) => (
                <option key={t.id} value={t.number}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {/* Подтип приказа об отпуске (трудовой/соц/прерывание) — не путать с «дни отпуска по контракту» в приёме */}
          {itemTypeCode === "leave" && orderItemSubtypesForLeave && orderItemSubtypesForLeave.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Подтип приказа об отпуске</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                value={itemSubtypeId}
                onChange={(e) => setItemSubtypeId(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                disabled={isAppliedDismissal}
              >
                <option value="">— Не выбран —</option>
                {orderItemSubtypesForLeave.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Шаблон</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              disabled={isAppliedDismissal}
            >
              <option value="">— Выберите шаблон —</option>
              {templatesForSelect.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              {templatesForSelect.length === 0 && (
                <option value="" disabled>
                  Нет шаблонов пункта приказа (template_type = 2)
                </option>
              )}
            </select>
          </div>
          <div className="flex items-end gap-1 sm:justify-end">
            {isAppliedDismissal ? (
              <span className="text-xs text-muted-foreground py-1.5">
                Применённый пункт увольнения нельзя редактировать. Удалите пункт для отмены.
              </span>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={(e) => { e.stopPropagation(); handleSave(); }}
                disabled={savingItemId === item.id || effectiveToBeforeFrom || hireValidToBeforeFrom}
                className={cn(
                  "whitespace-nowrap",
                  isDirty && "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/50"
                )}
              >
                <Save className="size-4 mr-1" />
                {savingItemId === item.id ? "Сохранение…" : "Сохранить"}
              </Button>
            )}
          </div>
        </div>

        {/* Дата начала, дата окончания (только для отпуска/прочих с периодом); единый формат DD.MM.YYYY */}
        <div className={`grid gap-3 sm:grid-cols-4 ${showEffectiveTo ? "grid-cols-2" : "grid-cols-1"}`}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Дата начала</label>
            <DatePicker
              value={effectiveFrom}
              onChange={setEffectiveFrom}
              placeholder="01.01.2025"
              aria-label="Дата начала"
              disabled={isAppliedDismissal}
            />
          </div>
          {showEffectiveTo && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Дата окончания</label>
              <DatePicker
                value={effectiveTo}
                onChange={setEffectiveTo}
                placeholder="01.01.2025"
                aria-label="Дата окончания"
                disabled={isAppliedDismissal}
                className={cn(effectiveToBeforeFrom && "ring-2 ring-destructive")}
              />
              {effectiveToBeforeFrom && (
                <p className="text-xs text-destructive" role="alert">
                  Дата окончания не может быть раньше даты начала.
                </p>
              )}
            </div>
          )}
          <div className={`${showEffectiveTo ? "col-span-2" : "col-span-3"} flex flex-wrap items-end gap-x-4 gap-y-1 text-xs text-muted-foreground`}>
            <span>
              Создал:{" "}
              {item.createdBy
                ? item.createdAt
                  ? `${item.createdBy} (${isoToDDMMYYYYHHmm(item.createdAt)})`
                  : item.createdBy
                : "—"}
            </span>
            <span>
              Редактировал:{" "}
              {item.updatedBy
                ? item.updatedAt
                  ? `${item.updatedBy} (${isoToDDMMYYYYHHmm(item.updatedAt)})`
                  : item.updatedBy
                : "—"}
            </span>
          </div>
        </div>

        {/* Поля в зависимости от типа пункта приказа */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Поля в зависимости от типа пункта приказа
          </label>
          <div className="min-h-[120px] rounded-md border border-dashed border-border bg-muted/20 p-3">
            {itemTypeCode === "leave" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Рабочие периоды и дни отпуска</p>
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Период с</TableHead>
                        <TableHead className="w-24">по</TableHead>
                        <TableHead className="w-28">Основные дни</TableHead>
                        <TableHead className="w-28">Дни по контракту</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leavePeriods.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="p-1">
                            <Input
                              type="date"
                              value={row.dateFrom}
                              onChange={(e) => updateLeavePeriod(row.id, "dateFrom", e.target.value)}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              type="date"
                              value={row.dateTo}
                              onChange={(e) => updateLeavePeriod(row.id, "dateTo", e.target.value)}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              type="number"
                              min={0}
                              value={row.mainDays ?? ""}
                              onChange={(e) => updateLeavePeriod(row.id, "mainDays", Number(e.target.value) || 0)}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              type="number"
                              min={0}
                              value={row.contractDays ?? ""}
                              onChange={(e) => updateLeavePeriod(row.id, "contractDays", Number(e.target.value) || 0)}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => removeLeavePeriod(row.id)}
                              disabled={leavePeriods.length <= 1}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addLeavePeriod}>
                  <Plus className="size-4 mr-1" />
                  Добавить период
                </Button>
              </div>
            )}

            {itemTypeCode === "transfer" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Должность (на какую переводится)</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={transferPositionId}
                    onChange={(e) => setTransferPositionId(e.target.value)}
                  >
                    <option value="">— Выберите должность —</option>
                    {positionsForSelect.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Подразделение</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={transferDepartmentId}
                    onChange={(e) => setTransferDepartmentId(e.target.value)}
                  >
                    <option value="">— Выберите подразделение —</option>
                    {departmentsForSelect.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {itemTypeCode === "hire" && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Тип трудового документа</label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={hireContractType}
                      onChange={(e) => setHireContractType(e.target.value as ContractType)}
                    >
                      {CONTRACT_TYPES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Вид срока</label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={effectiveTermKind}
                      onChange={(e) => setHireContractTermKind(e.target.value as ContractTermKind)}
                    >
                      {termKindsForSelect.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Начало действия договора/контракта</label>
                    <DatePicker
                      value={hireValidFrom}
                      onChange={setHireValidFrom}
                      placeholder="01.01.2025"
                      aria-label="Начало действия"
                      disabled={isAppliedDismissal}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Окончание действия (для срочного/контракта)</label>
                    <DatePicker
                      value={hireValidTo}
                      onChange={setHireValidTo}
                      placeholder="Пусто — бессрочный"
                      aria-label="Окончание действия"
                      disabled={isAppliedDismissal}
                      className={cn(hireValidToBeforeFrom && "ring-2 ring-destructive")}
                    />
                    {hireValidToBeforeFrom && (
                      <p className="text-xs text-destructive" role="alert">
                        Дата окончания не может быть раньше даты начала.
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Должность</label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={hirePositionId}
                      onChange={(e) => setHirePositionId(e.target.value)}
                    >
                      <option value="">— Выберите должность —</option>
                      {positionsForSelect.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Подразделение</label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={hireDepartmentId}
                      onChange={(e) => setHireDepartmentId(e.target.value)}
                    >
                      <option value="">— Выберите подразделение —</option>
                      {departmentsForSelect.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Шаблон контракта / трудового договора (для печати)</label>
                  <select
                    className="h-9 min-w-[220px] max-w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={hireContractTemplateId}
                    onChange={(e) => setHireContractTemplateId(e.target.value)}
                  >
                    <option value="">— Выберите шаблон —</option>
                    {contractTemplatesForSelect.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {itemTypeCode && !["leave", "transfer", "hire"].includes(itemTypeCode) && (
              <p className="text-xs text-muted-foreground">
                Поля для типа «{typeName}» (увольнение, командировка, прочий и т.д.) — настраиваются отдельно.
              </p>
            )}

            {!itemTypeCode && (
              <p className="text-xs text-muted-foreground">Выберите тип приказа выше.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
