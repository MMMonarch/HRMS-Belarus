"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { ScrollableSelect } from "@/components/ui/scrollable-select";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useCrudRef } from "@/lib/n8n/use-crud";
import { parseListResponse, parseSingleRecord } from "@/lib/n8n/client";
import { isoToDisplay, displayToIso, formatDateForDisplay } from "@/lib/date-utils";
import type { EmployeeDetail } from "@/features/employees/types";
import { CONTRACT_TERM_KINDS, CONTRACT_TYPES, ORDER_ITEM_TYPES } from "@/features/documents/types";
import { PersonPhotoBlock } from "./PersonPhotoBlock";

const GENDER_OPTIONS = [
  { value: "", label: "—" },
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
] as const;

const TABS = [
  { id: "about", label: "О сотруднике" },
  { id: "orders", label: "Приказы" },
  { id: "labor-documents", label: "Трудовые документы" },
  { id: "contacts", label: "Контакты" },
  { id: "passport", label: "Паспорт" },
  { id: "delete", label: "Удалить" },
];

type EmployeeDetailCardProps = {
  employee: EmployeeDetail | null;
  onDelete?: (employeeId: string) => void | Promise<void>;
  onUpdatePerson?: (
    id: string,
    payload: {
      last_name?: string;
      first_name?: string;
      patronymic?: string;
      contact_phone?: string;
      contact_email?: string;
      birth_date?: string | null;
      gender?: string | null;
      citizenship_id?: string | null;
      id_number?: string | null;
    }
  ) => void | Promise<void>;
  /** Сохранение документа, удостоверяющего личность (паспорт). create при docId == null; для create нужен branchId. */
  onSavePassportDocument?: (
    personId: string,
    payload: {
      document_type_id: string;
      series?: string | null;
      number?: string | null;
      issued_at?: string | null;
      expires_at?: string | null;
    },
    docId?: string | null,
    branchId?: string | null
  ) => void | Promise<void>;
  /** Загрузка фото сотрудника (через CRUD). Вызывается с (personId, file, branchId из карточки). */
  onUploadPhoto?: (personId: string, file: File, branchId: string) => void | Promise<void>;
  /** Включён тестовый режим — запросы на /api/webhook-test/crud */
  testMode?: boolean;
  className?: string;
};

function getInitialFio(employee: EmployeeDetail) {
  if (
    employee.last_name !== undefined ||
    employee.first_name !== undefined ||
    employee.patronymic !== undefined
  ) {
    return {
      last_name: employee.last_name ?? "",
      first_name: employee.first_name ?? "",
      patronymic: employee.patronymic ?? "",
    };
  }
  const parts = employee.fullName.trim().split(/\s+/);
  return {
    last_name: parts[0] ?? "",
    first_name: parts[1] ?? "",
    patronymic: parts[2] ?? "",
  };
}

type DocumentTypeOption = { id: string; name: string };
type CountryOption = { id: string; name: string; alpha2: string };
type PersonDocRow = {
  id: string;
  person_id?: string;
  document_type_id: string;
  series?: string | null;
  number?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
};

export function EmployeeDetailCard({
  employee,
  onDelete,
  onUpdatePerson,
  onSavePassportDocument,
  onUploadPhoto,
  testMode,
  className,
}: EmployeeDetailCardProps) {
  const crudRef = useCrudRef();
  const [activeTab, setActiveTab] = useState("about");
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editFioOpen, setEditFioOpen] = useState(false);
  const [editLast, setEditLast] = useState("");
  const [editFirst, setEditFirst] = useState("");
  const [editPatronymic, setEditPatronymic] = useState("");
  const [savingFio, setSavingFio] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [savingContacts, setSavingContacts] = useState(false);

  // Паспорт: справочники и данные персоны/документа
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [passportPerson, setPassportPerson] = useState<{
    birth_date?: string | null;
    gender?: string | null;
    citizenship_id?: string | null;
    id_number?: string | null;
  } | null>(null);
  const [passportDocument, setPassportDocument] = useState<PersonDocRow | null>(null);
  const [passportLoading, setPassportLoading] = useState(false);
  const [savingPassport, setSavingPassport] = useState(false);

  const [ordersLoading, setOrdersLoading] = useState(false);
  const [employeeOrderRows, setEmployeeOrderRows] = useState<
    { id: string; orderDate: string; regNumber: string; itemTypeName: string; effectiveFrom: string; effectiveTo: string | null }[]
  >([]);

  const [laborDocsLoading, setLaborDocsLoading] = useState(false);
  const [laborDocRows, setLaborDocRows] = useState<
    { id: string; contractTypeLabel: string; termKindLabel: string; validFrom: string; validTo: string | null }[]
  >([]);
  const passportFetchedFor = useRef<string | null>(null);
  /** Справочники паспорта: загружаем один раз, при смене сотрудника запрашиваем только persons + person_documents */
  const passportRefsCache = useRef<{
    documentTypes: DocumentTypeOption[];
    countries: CountryOption[];
  }>({ documentTypes: [], countries: [] });

  // Локальные поля формы паспорта (для контролируемых инпутов)
  const [docTypeId, setDocTypeId] = useState("");
  const [citizenshipId, setCitizenshipId] = useState("");
  const [series, setSeries] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [gender, setGender] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");

  useEffect(() => {
    if (employee) {
      setContactPhone(employee.contact_phone ?? "");
      setContactEmail(employee.contact_email ?? "");
    }
  }, [employee?.id, employee?.contact_phone, employee?.contact_email]);

  useEffect(() => {
    if (editFioOpen && employee) {
      const { last_name, first_name, patronymic } = getInitialFio(employee);
      setEditLast(last_name);
      setEditFirst(first_name);
      setEditPatronymic(patronymic);
    }
  }, [editFioOpen, employee]);

  const fetchPassportData = useCallback(async (personId: string) => {
    setPassportLoading(true);
    const cache = passportRefsCache.current;
    const needRefs = cache.documentTypes.length === 0 || cache.countries.length === 0;
    try {
      const personPromise = crudRef.current("persons", "get", undefined, personId);
      const docsPromise = crudRef.current("person_documents", "get", { person_id: personId });
      const typesPromise = needRefs ? crudRef.current("document_types", "get") : Promise.resolve(null);
      const countriesPromise = needRefs ? crudRef.current("countries", "get") : Promise.resolve(null);

      const [personData, docsData, typesData, countriesData] = await Promise.all([
        personPromise,
        docsPromise,
        typesPromise,
        countriesPromise,
      ]);

      let person: Record<string, unknown> | undefined;
      if (Array.isArray(personData)) {
        const row = (personData as Record<string, unknown>[]).find((r) => r && String(r.id) === String(personId));
        person = row ?? (personData[0] as Record<string, unknown>);
      } else {
        person = parseSingleRecord(personData) as Record<string, unknown> | undefined;
      }
      const docsArr = parseListResponse(docsData) as PersonDocRow[];
      const doc = docsArr.find((d) => d && typeof d === "object" && (d as PersonDocRow).person_id === personId) ?? (docsArr.length > 0 ? docsArr[0] : null);

      let typesArr: DocumentTypeOption[] = cache.documentTypes;
      let countriesArr: CountryOption[] = cache.countries;
      if (needRefs && typesData != null) {
        typesArr = parseListResponse(typesData) as DocumentTypeOption[];
        cache.documentTypes = typesArr?.map((t) => ({ id: (t as { id: string }).id, name: (t as { name: string }).name ?? "" })) ?? [];
      }
      if (needRefs && countriesData != null) {
        countriesArr = parseListResponse(countriesData) as CountryOption[];
        cache.countries = (countriesArr ?? []).map((c) => ({
          id: (c as { id: string }).id,
          name: (c as { name: string }).name ?? "",
          alpha2: (c as { alpha2?: string }).alpha2 ?? "",
        }));
      }

      setPassportPerson(person ? {
        birth_date: person.birth_date as string | null | undefined,
        gender: person.gender as string | null | undefined,
        citizenship_id: person.citizenship_id as string | null | undefined,
        id_number: person.id_number as string | null | undefined,
      } : null);
      setPassportDocument(doc && typeof doc === "object" ? (doc as PersonDocRow) : null);

      setDocumentTypes(cache.documentTypes);
      setCountries(cache.countries);

      if (person) {
        const birth = (person.birth_date ?? (person as Record<string, unknown>).birthDate) as string | undefined;
        const g = (person.gender ?? (person as Record<string, unknown>).gender) as string | undefined;
        const pid = person.citizenship_id ?? (person as Record<string, unknown>).citizenshipId;
        const idNum = (person.id_number ?? (person as Record<string, unknown>).idNumber) as string | undefined;
        setBirthDate(isoToDisplay(birth));
        setGender(String(g ?? "").trim());
        setCitizenshipId(pid != null ? String(pid) : "");
        setIdNumber(String(idNum ?? "").trim());
      }
      if (doc && typeof doc === "object") {
        const d = doc as PersonDocRow;
        const dtypeId = d.document_type_id;
        setDocTypeId(dtypeId != null ? String(dtypeId) : "");
        setSeries(String(d.series ?? "").trim());
        setDocNumber(String(d.number ?? "").trim());
        setIssuedAt(isoToDisplay(d.issued_at));
        setExpiresAt(isoToDisplay(d.expires_at));
      } else {
        setDocTypeId("");
        setSeries("");
        setDocNumber("");
        setIssuedAt("");
        setExpiresAt("");
      }
    } catch {
      setPassportPerson(null);
      setPassportDocument(null);
      setDocumentTypes([]);
      setCountries([]);
    } finally {
      setPassportLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "passport" && employee?.id && passportFetchedFor.current !== employee.id) {
      passportFetchedFor.current = employee.id;
      void fetchPassportData(employee.id);
    }
    if (activeTab !== "passport") {
      passportFetchedFor.current = null;
    }
  }, [activeTab, employee?.id, fetchPassportData]);

  useEffect(() => {
    if (activeTab !== "orders" || !employee?.id || !crudRef.current) {
      if (activeTab !== "orders") setEmployeeOrderRows([]);
      return;
    }
    let cancelled = false;
    setOrdersLoading(true);
    (async () => {
      try {
        const itemsData = await crudRef.current!("order_items", "get", { person_id: employee.id });
        if (cancelled) return;
        const items = parseListResponse(itemsData) as Array<{
          id: string;
          person_id?: string;
          order_id?: string;
          item_type_number?: number;
          effective_from?: string | null;
          effective_to?: string | null;
        }>;
        const orderIds = [...new Set(items.map((i) => i.order_id).filter(Boolean))] as string[];
        let orders: Array<{ id: string; order_date?: string; reg_number?: string | null }> = [];
        if (orderIds.length > 0) {
          const ordersData = await crudRef.current!("orders", "get", { id: orderIds });
          if (cancelled) return;
          orders = parseListResponse(ordersData) as Array<{
            id: string;
            order_date?: string;
            reg_number?: string | null;
          }>;
        }
        const orderMap = new Map(orders.map((o) => [o.id, o]));
        const byPerson = items;
        const rows = byPerson.map((i) => {
          const order = i.order_id ? orderMap.get(i.order_id) : undefined;
          const orderDate = formatDateForDisplay(order?.order_date ?? "");
          const num = typeof i.item_type_number === "number" ? i.item_type_number : 1;
          const typeInfo = ORDER_ITEM_TYPES.find((t) => t.number === num) ?? ORDER_ITEM_TYPES[0];
          const effectiveFrom = formatDateForDisplay(i.effective_from ?? "");
          const effectiveTo = isoToDisplay(i.effective_to) || null;
          return {
            id: i.id,
            orderDate: orderDate as string,
            regNumber: order?.reg_number ?? "—",
            itemTypeName: typeInfo.name,
            effectiveFrom,
            effectiveTo,
          };
        });
        rows.sort((a, b) => {
          const dA = a.orderDate;
          const dB = b.orderDate;
          if (dA !== dB) return dA.localeCompare(dB);
          return (a.effectiveFrom || "").localeCompare(b.effectiveFrom || "");
        });
        setEmployeeOrderRows(rows);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, employee?.id]);

  useEffect(() => {
    if (activeTab !== "labor-documents" || !employee?.id || !crudRef.current) {
      if (activeTab !== "labor-documents") setLaborDocRows([]);
      return;
    }
    let cancelled = false;
    setLaborDocsLoading(true);
    (async () => {
      try {
        const data = await crudRef.current!("contracts", "get", { person_id: employee.id });
        if (cancelled) return;
        const list = parseListResponse(data) as Array<{
          id: string;
          person_id?: string;
          contract_type?: string;
          contract_term_kind?: string;
          valid_from?: string | null;
          valid_to?: string | null;
        }>;
        const byPerson = list;
        const typeLabel = (v: string) => CONTRACT_TYPES.find((t) => t.value === v)?.label ?? v;
        const termLabel = (v: string) => CONTRACT_TERM_KINDS.find((t) => t.value === v)?.label ?? v;
        const rows = byPerson.map((c) => ({
          id: c.id,
          contractTypeLabel: typeLabel(c.contract_type ?? ""),
          termKindLabel: termLabel(c.contract_term_kind ?? ""),
          validFrom: formatDateForDisplay(c.valid_from ?? ""),
          validTo: c.valid_to != null && c.valid_to !== "" ? formatDateForDisplay(c.valid_to) : null,
        }));
        rows.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
        setLaborDocRows(rows);
      } finally {
        if (!cancelled) setLaborDocsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, employee?.id]);

  useEffect(() => {
    if (employee && (employee.birth_date !== undefined || employee.gender !== undefined || employee.citizenship_id !== undefined || employee.id_number !== undefined)) {
      setBirthDate(isoToDisplay(employee.birth_date));
      setGender(employee.gender ?? "");
      setCitizenshipId(employee.citizenship_id ?? "");
      setIdNumber(employee.id_number ?? "");
    }
  }, [employee?.id, employee?.birth_date, employee?.gender, employee?.citizenship_id, employee?.id_number]);

  const handleSavePassport = async () => {
    if (!employee) return;
    setSavingPassport(true);
    try {
      if (onUpdatePerson) {
        await onUpdatePerson(employee.id, {
          birth_date: displayToIso(birthDate) ?? null,
          gender: gender ? gender : null,
          citizenship_id: citizenshipId ? citizenshipId : null,
          id_number: idNumber.trim() ? idNumber.trim() : null,
        });
      }
      if (onSavePassportDocument && docTypeId) {
        await onSavePassportDocument(
          employee.id,
          {
            document_type_id: docTypeId,
            series: series.trim() || null,
            number: docNumber.trim() || null,
            issued_at: displayToIso(issuedAt),
            expires_at: displayToIso(expiresAt),
          },
          passportDocument?.id,
          employee.branch_id
        );
      }
      toast.success("Данные сохранены");
      passportFetchedFor.current = null;
      void fetchPassportData(employee.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSavingPassport(false);
    }
  };

  const handleSaveFio = async () => {
    if (!employee || !onUpdatePerson) return;
    setSavingFio(true);
    try {
      await onUpdatePerson(employee.id, {
        last_name: editLast || undefined,
        first_name: editFirst || undefined,
        patronymic: editPatronymic || undefined,
      });
      setEditFioOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка при сохранении ФИО");
    } finally {
      setSavingFio(false);
    }
  };

  const handleSaveContacts = async () => {
    if (!employee || !onUpdatePerson) return;
    setSavingContacts(true);
    try {
      await onUpdatePerson(employee.id, {
        contact_phone: contactPhone.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Ошибка при сохранении контактных данных"
      );
    } finally {
      setSavingContacts(false);
    }
  };

  const currentIndex = TABS.findIndex((t) => t.id === activeTab);
  const goPrev = () => {
    const prevIndex = currentIndex <= 0 ? TABS.length - 1 : currentIndex - 1;
    setActiveTab(TABS[prevIndex].id);
  };
  const goNext = () => {
    const nextIndex = currentIndex >= TABS.length - 1 ? 0 : currentIndex + 1;
    setActiveTab(TABS[nextIndex].id);
  };

  if (!employee) {
    return (
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-8",
          className
        )}
      >
        <p className="text-muted-foreground">Выберите сотрудника из списка</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-1 flex-col overflow-hidden", className)}>
      {/* Шапка: имя, фото, поля */}
      <div className="border-b border-border p-4">
        <div className="grid grid-cols-[1fr_auto] items-start gap-4">
          <div className="min-w-0 max-w-xl space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{employee.fullName}</h2>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setEditFioOpen(true)}
                title="Изменить ФИО"
              >
                <Pencil className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">Состав:</span>
              <span>{employee.composition}</span>
              <span className="text-muted-foreground">Должность:</span>
              <span>{employee.position}</span>
              <span className="text-muted-foreground">Подразделение:</span>
              <span>{employee.department ?? "—"}</span>
              <span className="text-muted-foreground">Статус:</span>
              <span>{employee.status}</span>
              <span className="text-muted-foreground">Принят:</span>
              <span>{employee.hiredDate}</span>
              <span className="text-muted-foreground">Числится:</span>
              <span>{employee.tenure}</span>
            </div>
          </div>
          <div className="flex size-full min-h-0 items-center justify-center">
            <PersonPhotoBlock
              employee={employee}
              onUploadPhoto={onUploadPhoto}
              testMode={testMode}
            />
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex items-center gap-1 border-b border-border px-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={goPrev}
          title="Предыдущая вкладка"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex gap-0.5 overflow-x-auto py-2">
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "secondary" : "ghost"}
              size="sm"
              className="shrink-0"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={goNext}
          title="Следующая вкладка"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Контент вкладки */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "delete" ? (
          <>
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-muted/30 p-6">
              <p className="text-sm text-muted-foreground">
                Удаление сотрудника из системы. Действие необратимо.
              </p>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Удалить полностью
              </Button>
            </div>
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <DialogContent className="sm:max-w-md" showCloseButton aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle>Удалить сотрудника?</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground py-2">
                  Вы уверены, что хотите удалить <strong>{employee.fullName}</strong> из системы? Действие необратимо.
                </p>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirmOpen(false)}
                  >
                    Отмена
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleting}
                    onClick={async () => {
                      if (!onDelete) return;
                      setDeleting(true);
                      try {
                        await onDelete(employee.id);
                        setDeleteConfirmOpen(false);
                      } finally {
                        setDeleting(false);
                      }
                    }}
                  >
                    {deleting ? "Удаление…" : "ОК"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : activeTab === "contacts" ? (
          <div className="flex min-h-[max(200px,100%)] flex-col gap-4 rounded-lg border border-dashed border-border bg-muted/30 p-6">
            <p className="text-sm text-muted-foreground">
              Контактные данные (те же поля, что при добавлении кандидата).
            </p>
            <div className="grid max-w-md gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Номер телефона
                </label>
                <Input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+375 29 123 45 67"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Электронная почта
                </label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <Button
                size="sm"
                disabled={savingContacts}
                onClick={handleSaveContacts}
              >
                {savingContacts ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          </div>
        ) : activeTab === "passport" ? (
          <div className="flex min-h-[max(200px,100%)] flex-col gap-4 rounded-lg border border-dashed border-border bg-muted/30 p-6">
            <p className="text-sm text-muted-foreground">
              Документы, удостоверяющие личность (паспорт, вид на жительство и т.д.).
            </p>
            {passportLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка…</p>
            ) : (
              <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Вид удостоверения личности</label>
                  <ScrollableSelect
                    value={docTypeId}
                    onChange={setDocTypeId}
                    options={documentTypes.map((t) => ({ value: t.id, label: t.name }))}
                    placeholder="—"
                    aria-label="Вид удостоверения личности"
                    listMaxHeight="max-h-[280px]"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Гражданство</label>
                  <ScrollableSelect
                    value={citizenshipId}
                    onChange={setCitizenshipId}
                    options={countries.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="—"
                    aria-label="Гражданство"
                    listMaxHeight="max-h-[280px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Серия</label>
                  <Input
                    value={series}
                    onChange={(e) => setSeries(e.target.value)}
                    placeholder="AB"
                    aria-label="Серия"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Номер документа</label>
                  <Input
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="1234567"
                    aria-label="Номер документа"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Дата выдачи</label>
                  <DatePicker
                    value={issuedAt}
                    onChange={setIssuedAt}
                    placeholder="ДД.ММ.ГГГГ"
                    aria-label="Дата выдачи"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Срок действия</label>
                  <DatePicker
                    value={expiresAt}
                    onChange={setExpiresAt}
                    placeholder="ДД.ММ.ГГГГ"
                    aria-label="Срок действия"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Пол</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Пол"
                  >
                    {GENDER_OPTIONS.map((o) => (
                      <option key={o.value || "_"} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Идентификационный номер</label>
                  <Input
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="1234567A001PB1"
                    aria-label="Идентификационный номер"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Дата рождения</label>
                  <DatePicker
                    value={birthDate}
                    onChange={setBirthDate}
                    placeholder="ДД.ММ.ГГГГ"
                    aria-label="Дата рождения"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    size="sm"
                    disabled={savingPassport}
                    onClick={handleSavePassport}
                  >
                    {savingPassport ? "Сохранение…" : "Сохранить"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "about" ? (
          <div className="flex min-h-[max(200px,100%)] flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">О сотруднике</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Состав</dt>
                <dd className="mt-0.5 text-sm">{employee.composition}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Должность</dt>
                <dd className="mt-0.5 text-sm">{employee.position}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Подразделение</dt>
                <dd className="mt-0.5 text-sm">{employee.department ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Статус</dt>
                <dd className="mt-0.5 text-sm">{employee.status}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Вступил в должность</dt>
                <dd className="mt-0.5 text-sm">{employee.positionStartDate ?? employee.hiredDate ?? "—"}</dd>
              </div>
            </dl>
          </div>
        ) : activeTab === "orders" ? (
          <div className="flex min-h-[max(200px,100%)] flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Приказы</h3>
            {ordersLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка…</p>
            ) : employeeOrderRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет приказов по этому сотруднику.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Дата приказа</TableHead>
                      <TableHead className="w-24">Номер приказа</TableHead>
                      <TableHead className="min-w-[140px]">Тип приказа</TableHead>
                      <TableHead className="w-28">Дата начала</TableHead>
                      <TableHead className="w-28">Дата окончания</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeOrderRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{row.orderDate}</TableCell>
                        <TableCell className="text-sm">{row.regNumber}</TableCell>
                        <TableCell className="text-sm">{row.itemTypeName}</TableCell>
                        <TableCell className="text-sm">{row.effectiveFrom}</TableCell>
                        <TableCell className="text-sm">{row.effectiveTo ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : activeTab === "labor-documents" ? (
          <div className="flex min-h-[max(200px,100%)] flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Трудовые документы</h3>
            {laborDocsLoading ? (
              <p className="text-sm text-muted-foreground">Загрузка…</p>
            ) : laborDocRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет трудовых документов по этому сотруднику.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Тип трудового документа</TableHead>
                      <TableHead className="min-w-[200px]">Вид срока</TableHead>
                      <TableHead className="w-32">Дата начала действия</TableHead>
                      <TableHead className="w-32">Дата окончания</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {laborDocRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{row.contractTypeLabel}</TableCell>
                        <TableCell className="text-sm">{row.termKindLabel}</TableCell>
                        <TableCell className="text-sm">{row.validFrom}</TableCell>
                        <TableCell className="text-sm">{row.validTo ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-[max(200px,100%)] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Блок с карточкой сотрудника ({TABS.find((t) => t.id === activeTab)?.label})
            </p>
          </div>
        )}
      </div>

      {/* Модальное окно редактирования ФИО (доступно с любой вкладки) */}
      <Dialog open={editFioOpen} onOpenChange={setEditFioOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Редактировать ФИО</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Фамилия</label>
              <Input
                value={editLast}
                onChange={(e) => setEditLast(e.target.value)}
                placeholder="Фамилия"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Имя</label>
              <Input
                value={editFirst}
                onChange={(e) => setEditFirst(e.target.value)}
                placeholder="Имя"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Отчество</label>
              <Input
                value={editPatronymic}
                onChange={(e) => setEditPatronymic(e.target.value)}
                placeholder="Отчество"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setEditFioOpen(false)}>
              Отмена
            </Button>
            <Button size="sm" disabled={savingFio} onClick={handleSaveFio}>
              {savingFio ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
