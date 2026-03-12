/** Строка для блока «Ближайшие дни рождения» */
export type DashboardBirthdayRow = {
  personId: string;
  fullName: string;
  birthDate: string; // ISO
  /** Текст: «через N дней» / «сегодня» / «в этом месяце» */
  whenLabel: string;
  /** Для сортировки: дата следующего ДР в году (MM-DD), затем год если уже прошло */
  sortKey: string;
};

/** Строка для блока «Окончание трудовых документов» */
export type DashboardExpiringDocRow = {
  personId: string;
  fullName: string;
  /** contract_type или тип документа */
  docKind: string;
  validTo: string; // ISO
  /** Осталось дней (отрицательное = просрочено) */
  daysLeft: number;
};

/** Строка для таблицы «Кто когда перевёл/назначил» */
export type DashboardAssignmentRow = {
  id: string;
  effectiveFrom: string; // ISO
  personId: string;
  personName: string;
  /** 1 = приём, 2 = перевод */
  itemTypeNumber: number;
  typeLabel: string;
  orderRegNumber: string | null;
  orderDate: string | null; // ISO
  createdBy: string | null; // ФИО того, кто создал пункт (если есть)
  appliedBy: string | null; // ФИО того, кто применил (если есть)
};
