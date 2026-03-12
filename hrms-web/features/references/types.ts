/** Код таблицы справочника для API (crud table name) */
export type DirectoryId =
  | "organizations"
  | "branches"
  | "departments"
  | "positions"
  | "position_categories"
  | "position_subcategories"
  | "template_types"
  | "order_templates"
  | "order_item_types"
  | "order_item_subtypes"
  | "document_types"
  | "countries";

export type Organization = {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type Branch = {
  id: string;
  organization_id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type Department = {
  id: string;
  branch_id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type Position = {
  id: string;
  branch_id: string;
  name: string;
  position_subcategory_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PositionCategory = {
  id: string;
  organization_id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type PositionSubcategory = {
  id: string;
  category_id: string;
  organization_id?: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

/** Шаблон из таблицы templates (справочник «Шаблоны») */
export type OrderTemplate = {
  id: string;
  name: string;
  default_title: string;
  /** Номер типа (template_types.number) или legacy строка (order_header и т.д.) */
  template_type?: number | string;
  template_html?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

/** Подтип пункта приказа (order_item_subtypes), привязан к типу пункта */
export type OrderItemSubtype = {
  id: string;
  order_item_type_id: string;
  code: string;
  name: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

/** Элемент списка справочников в левой панели */
export type DirectoryItem = {
  id: DirectoryId;
  label: string;
};
