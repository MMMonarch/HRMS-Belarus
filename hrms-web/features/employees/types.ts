export type EmployeeListItem = {
  id: string;
  shortName: string;
  branch_id?: string;
};

export type EmployeeDetail = EmployeeListItem & {
  fullName: string;
  /** Для формы редактирования ФИО и вебхука update */
  last_name?: string;
  first_name?: string;
  patronymic?: string;
  /** Контакты (вкладка Контакты, те же поля что при добавлении кандидата) */
  contact_phone?: string;
  contact_email?: string;
  /** Паспорт/персона: гражданство, пол, дата рождения, идентификационный номер */
  citizenship_id?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  id_number?: string | null;
  composition: string;
  position: string;
  /** Подразделение (из текущего назначения) */
  department?: string;
  rankCategory: string;
  status: string;
  /** Дата приёма (начало занятости, employment.start_date) */
  hiredDate: string;
  /** Дата вступления в текущую должность (assignment.start_date); для приёма совпадает с hiredDate */
  positionStartDate?: string;
  tenure: string;
  /** Путь к фото в storage (из БД persons.photo_path) */
  photo_path?: string | null;
  /** Готовый URL фото (может возвращать n8n из storage; иначе строится по photo_path + base URL) */
  photo_url?: string | null;
};
