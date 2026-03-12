import { isoToDisplay } from "@/lib/date-utils";

/** Тип пункта приказа (order_item_types) — код для логики в UI */
export type OrderItemTypeCode =
  | "hire"
  | "dismissal"
  | "transfer"
  | "leave"
  | "other";

export interface OrderItemType {
  /** Номер типа в БД (order_item_types.number), строка для value в select */
  id: string;
  /** Номер типа (1–5) — в БД хранится это значение */
  number: number;
  code: OrderItemTypeCode;
  name: string;
}

/** Сводный приказ (orders) — формат для UI */
export interface ConsolidatedOrder {
  id: string;
  branch_id?: string;
  orderDate: string;
  regNumber: string;
  title: string;
  status: "draft" | "registered" | "signed" | "cancelled";
  templateId?: string;
  /** Шаблон виз сводного приказа (templates.id) */
  visaTemplateId?: string | null;
  print_output?: Record<string, unknown> | null;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

/** Строка таблицы orders из API (snake_case) */
export interface OrderRow {
  id: string;
  branch_id: string;
  template_id: string;
  visa_template_id?: string | null;
  order_register_id?: string | null;
  order_date: string;
  effective_date?: string | null;
  reg_seq?: number | null;
  reg_number?: string | null;
  status: string;
  title?: string | null;
  note?: string | null;
  print_output?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

/** Преобразование строки API в ConsolidatedOrder */
export function mapOrderRowToConsolidated(row: OrderRow): ConsolidatedOrder {
  const orderDate =
    typeof row.order_date === "string" && row.order_date.includes("-")
      ? isoToDisplay(row.order_date)
      : row.order_date;
  return {
    id: row.id,
    branch_id: row.branch_id,
    orderDate,
    regNumber: row.reg_number ?? "",
    title: row.title ?? "",
    status:
      row.status === "canceled"
        ? "cancelled"
        : (row.status as ConsolidatedOrder["status"]),
    templateId: row.template_id,
    visaTemplateId: row.visa_template_id ?? undefined,
    print_output: row.print_output ?? undefined,
  };
}

/** Шаблон сводного приказа (templates, template_type=order_header) — из API или fallback */
export interface ConsolidatedOrderTemplate {
  id: string;
  name: string;
  default_title?: string;
  defaultTitle?: string;
}

/** Fallback-шаблоны, если API templates ещё не отдаёт данные */
export const CONSOLIDATED_ORDER_TEMPLATES_FALLBACK: ConsolidatedOrderTemplate[] = [
  { id: "hire", name: "Приказ о приёме на работу", defaultTitle: "Приказ о приёме на работу" },
  { id: "termination", name: "Приказ об увольнении", defaultTitle: "Приказ об увольнении" },
  { id: "transfer", name: "Приказ о переводе/перемещении", defaultTitle: "О переводе на другую работу" },
  { id: "leave", name: "Приказ об отпуске", defaultTitle: "О предоставлении отпуска" },
  { id: "travel", name: "Приказ о командировке", defaultTitle: "О служебной командировке" },
  { id: "misc", name: "Прочий приказ", defaultTitle: "Прочий приказ" },
];

export function getOrderTemplateDefaultTitle(t: ConsolidatedOrderTemplate): string {
  return t.default_title ?? t.defaultTitle ?? t.name;
}

/** Строка order_items из API (snake_case). Тип пункта — число (order_item_types.number). */
export interface OrderItemRow {
  id: string;
  order_id: string;
  line_no: number;
  person_id: string;
  employment_id?: string | null;
  /** Номер типа пункта приказа (1–5), справочник order_item_types */
  item_type_number?: number;
  /** Подтип пункта (order_item_subtypes.id), опционально */
  item_subtype_id?: string | null;
  /** Устаревшее: если API ещё отдаёт старый enum, маппим в number */
  item_type?: string | null;
  state: string;
  effective_from?: string | null;
  effective_to?: string | null;
  payload?: Record<string, unknown> | null;
  /** Для пункта приёма: привязка к записи в contracts. */
  contract_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  /** Может приходить из join с persons */
  last_name?: string | null;
  first_name?: string | null;
  patronymic?: string | null;
}

/** Номер типа (1–5) → код для UI */
const ITEM_TYPE_NUMBER_TO_CODE: Record<number, OrderItemTypeCode> = {
  1: "hire",
  2: "transfer",
  3: "leave",
  4: "other",
  5: "dismissal",
};
/** Устаревший enum item_type → код (если API ещё отдаёт старый формат) */
const ITEM_TYPE_LEGACY_TO_CODE: Record<string, OrderItemTypeCode> = {
  hire: "hire",
  termination: "dismissal",
  transfer: "transfer",
  leave: "leave",
  travel: "other",
  misc: "other",
  cancel: "other",
};

/** Пункт приказа (order_items) */
export interface OrderItem {
  id: string;
  orderId: string;
  seq: number;
  employeeId: string;
  employeeName: string;
  /** Занятость (для перевода/отпуска/увольнения). При приёме заполняется после применения. */
  employmentId?: string | null;
  /** Для пункта приёма: привязка к договору/контракту (contracts.id). */
  contractId?: string | null;
  /** Номер типа (1–5) для API */
  itemTypeNumber: number;
  /** Подтип пункта (order_item_subtypes.id), для отпуска и др. */
  itemSubtypeId?: string | null;
  itemTypeId: string;
  itemTypeCode: OrderItemTypeCode;
  itemTypeName: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  body: string;
  data?: Record<string, unknown>;
  status: "draft" | "applied" | "cancelled";
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

/** Справочник типов пунктов приказа (1–5), соответствует order_item_types в БД */
export const ORDER_ITEM_TYPES: OrderItemType[] = [
  { id: "1", number: 1, code: "hire", name: "Приём" },
  { id: "2", number: 2, code: "transfer", name: "Перевод/перемещение" },
  { id: "3", number: 3, code: "leave", name: "Приказ об отпуске" },
  { id: "4", number: 4, code: "other", name: "Прочий приказ" },
  { id: "5", number: 5, code: "dismissal", name: "Увольнение" },
];

/** Преобразование строки API в OrderItem. profilesMap: id пользователя → full_name для подписи «Создал»/«Редактировал». */
export function mapOrderItemRowToOrderItem(
  row: OrderItemRow,
  employeeName?: string,
  profilesMap?: Map<string, string>
): OrderItem {
  const num =
    typeof row.item_type_number === "number"
      ? row.item_type_number
      : row.item_type
        ? undefined
        : 1;
  const code =
    num !== undefined && ITEM_TYPE_NUMBER_TO_CODE[num]
      ? ITEM_TYPE_NUMBER_TO_CODE[num]
      : (row.item_type && ITEM_TYPE_LEGACY_TO_CODE[row.item_type]) ?? "hire";
  const typeInfo =
    ORDER_ITEM_TYPES.find((t) => t.code === code) ??
    ORDER_ITEM_TYPES.find((t) => t.number === num) ??
    ORDER_ITEM_TYPES[0];
  const name =
    employeeName ??
    ([row.last_name, row.first_name, row.patronymic].filter(Boolean).join(" ") ||
      row.person_id);
  // YYYY-MM-DD для input type="date" (браузер покажет в локали, например 01.01.2012)
  const effectiveFrom =
    row.effective_from && row.effective_from.includes("-")
      ? row.effective_from.split("T")[0]
      : row.effective_from || undefined;
  const effectiveTo =
    row.effective_to && row.effective_to.includes("-")
      ? row.effective_to.split("T")[0]
      : row.effective_to || undefined;
  return {
    id: row.id,
    orderId: row.order_id,
    seq: row.line_no,
    employeeId: row.person_id,
    employeeName: name,
    employmentId: row.employment_id ?? undefined,
    contractId: row.contract_id ?? undefined,
    itemTypeNumber: typeInfo.number,
    itemSubtypeId: row.item_subtype_id ?? undefined,
    itemTypeId: typeInfo.id,
    itemTypeCode: typeInfo.code,
    itemTypeName: typeInfo.name,
    effectiveFrom,
    effectiveTo,
    body: (row.payload && typeof row.payload.body === "string" ? row.payload.body : "") ?? "",
    data: row.payload ?? undefined,
    status:
      row.state === "voided" ? "cancelled" : (row.state as OrderItem["status"]),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    createdBy: row.created_by
      ? (profilesMap?.get(row.created_by) ?? row.created_by)
      : undefined,
    updatedBy: row.updated_by
      ? (profilesMap?.get(row.updated_by) ?? row.updated_by)
      : undefined,
  };
}

/** Шаблоны пункта приказа в зависимости от типа (для выбора) */
export interface OrderItemTemplate {
  id: string;
  typeCode: OrderItemTypeCode;
  name: string;
}

/** Один период по приказу об отпуске (тип пункта «Приказ об отпуске»): период и основные дни / дни по контракту. harmDays не используется в UI. */
export interface LeavePeriodRow {
  id: string;
  dateFrom: string;
  dateTo: string;
  mainDays?: number;
  contractDays?: number;
  harmDays?: number;
}

/**
 * Данные пункта приказа типа «Приказ об отпуске» (order_items, item_type_number = 3).
 * Не путать с отпуском в контракте (leaveDays в приёме): здесь — сам приказ о предоставлении
 * отпуска (периоды, подтип: трудовой/соц и т.д.).
 */
export interface LeaveData {
  periods?: LeavePeriodRow[];
}

/** Данные пункта «Перевод» */
export interface TransferData {
  newPositionId?: string;
  newDepartmentId?: string;
}

/** Тип трудового документа при приёме (contracts.contract_type) */
export type ContractType = "employment_contract" | "contract";

/** Вид договора по сроку/основанию (contracts.contract_term_kind), ТК РБ */
export type ContractTermKind =
  | "indefinite"
  | "fixed_term"
  | "fixed_term_work"
  | "fixed_term_replacement"
  | "seasonal"
  | "contract";

/** Варианты для селекта «Тип трудового документа» */
export const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: "employment_contract", label: "Трудовой договор" },
  { value: "contract", label: "Контракт" },
];

/** Варианты для селекта «Вид срока» (contract_term_kind). documentType — к какому типу трудового документа относится вариант. */
export const CONTRACT_TERM_KINDS: {
  value: ContractTermKind;
  label: string;
  /** Трудовой договор — все виды кроме контракта; контракт — только вид «Контракт». */
  documentType: ContractType;
}[] = [
  { value: "indefinite", label: "На неопределённый срок (бессрочный)", documentType: "employment_contract" },
  { value: "fixed_term", label: "Срочный на определённый срок (до 5 лет)", documentType: "employment_contract" },
  { value: "fixed_term_work", label: "На время выполнения определённой работы", documentType: "employment_contract" },
  { value: "fixed_term_replacement", label: "На время исполнения обязанностей временно отсутствующего", documentType: "employment_contract" },
  { value: "seasonal", label: "На время сезонных работ", documentType: "employment_contract" },
  { value: "contract", label: "Контракт (1–5 лет)", documentType: "contract" },
];

/**
 * Данные пункта «Приём на работу».
 * leaveDays — отпуск в контракте (количество дней отпуска по договору), не путать с типом
 * пункта приказа «Приказ об отпуске» (item_type_number = 3).
 */
export interface HireData {
  positionId?: string;
  departmentId?: string;
  contractTemplateId?: string;
  /** Количество дней отпуска в контракте (по договору при приёме). */
  leaveDays?: number;
  /** Тип трудового документа: трудовой договор или контракт. */
  contractType?: ContractType;
  /** Вид по сроку/основанию (ТК РБ). */
  contractTermKind?: ContractTermKind;
  /** Начало действия договора/контракта (ISO date или DD.MM.YYYY в payload). */
  validFrom?: string;
  /** Окончание действия (для контракта/срочного); для бессрочного — пусто. */
  validTo?: string | null;
}

/** Мок: должности и подразделения для выбора */
export const MOCK_POSITIONS = [
  { id: "pos-1", name: "Слесарь" },
  { id: "pos-2", name: "Инженер" },
  { id: "pos-3", name: "Электрик" },
  { id: "pos-4", name: "Техник" },
  { id: "pos-5", name: "Бухгалтер" },
];

export const MOCK_DEPARTMENTS = [
  { id: "dep-1", name: "Цех 1" },
  { id: "dep-2", name: "Цех 2" },
  { id: "dep-3", name: "Офис" },
];

/** Элемент списка шаблонов контракта/трудового договора для селекта в приёме. contractType задаёт привязку к типу документа. */
export type ContractTemplateOption = { id: string; name: string; contractType?: ContractType };

export const MOCK_CONTRACT_TEMPLATES: ContractTemplateOption[] = [
  { id: "t-cont-1", name: "Трудовой договор (бессрочный)", contractType: "employment_contract" },
  { id: "t-cont-2", name: "Контракт (срочный)", contractType: "contract" },
];

export const ORDER_ITEM_TEMPLATES: OrderItemTemplate[] = [
  { id: "t-hire-1", typeCode: "hire", name: "Приём (основное место)" },
  { id: "t-hire-2", typeCode: "hire", name: "Приём (совместительство)" },
  { id: "t-dismissal-1", typeCode: "dismissal", name: "Увольнение по соглашению" },
  { id: "t-dismissal-2", typeCode: "dismissal", name: "Увольнение по собственному желанию" },
  { id: "t-transfer-1", typeCode: "transfer", name: "Перевод в другое подразделение" },
  { id: "t-transfer-2", typeCode: "transfer", name: "Перевод на другую должность" },
  { id: "t-leave-1", typeCode: "leave", name: "Ежегодный отпуск" },
  { id: "t-leave-2", typeCode: "leave", name: "Без сохранения зарплаты" },
  { id: "t-trip-1", typeCode: "other", name: "Служебная командировка" },
  { id: "t-other-1", typeCode: "other", name: "Прочее" },
];
