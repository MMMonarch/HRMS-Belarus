-- Справочник типов документов, удостоверяющих личность (person_documents).
-- Для паспорта и иных документов по законодательству РБ.

-- 1. Таблица document_types (глобальный справочник)
CREATE TABLE document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX document_types_code_key ON document_types (code);

COMMENT ON TABLE document_types IS 'Типы документов, удостоверяющих личность и право на работу. Используется в person_documents.';
COMMENT ON COLUMN document_types.code IS 'Код для логики/API (латиница).';
COMMENT ON COLUMN document_types.name IS 'Наименование для UI.';
COMMENT ON COLUMN document_types.sort_order IS 'Порядок вывода в селектах.';

-- 2. Начальный набор для Беларуси
INSERT INTO document_types (code, name, sort_order) VALUES
  ('passport_by', 'Паспорт гражданина Республики Беларусь', 1),
  ('residence_permit', 'Вид на жительство в Республике Беларусь', 2),
  ('refugee_id', 'Удостоверение беженца', 3),
  ('birth_certificate', 'Свидетельство о рождении', 4),
  ('foreign_passport', 'Документ иностранного гражданина', 5),
  ('other', 'Иной документ', 6);

-- 3. В person_documents добавить FK на справочник
ALTER TABLE person_documents ADD COLUMN document_type_id uuid REFERENCES document_types(id);

-- 4. Перенос данных из doc_type (текст) в document_type_id
UPDATE person_documents pd
SET document_type_id = (
  SELECT dt.id FROM document_types dt
  WHERE dt.code = CASE
    WHEN lower(trim(pd.doc_type)) IN ('паспорт', 'паспорт рб', 'паспорт гражданина рб', 'паспорт гражданина республики беларусь') THEN 'passport_by'
    WHEN lower(trim(pd.doc_type)) IN ('вид на жительство', 'внж', 'вид на жительство в рб') THEN 'residence_permit'
    WHEN lower(trim(pd.doc_type)) IN ('удостоверение беженца', 'беженец') THEN 'refugee_id'
    WHEN lower(trim(pd.doc_type)) IN ('свидетельство о рождении', 'свидетельство') THEN 'birth_certificate'
    WHEN lower(trim(pd.doc_type)) IN ('документ иностранного гражданина', 'загранпаспорт', 'иностранный паспорт', 'паспорт иностранного гражданина') THEN 'foreign_passport'
    ELSE 'other'
  END
  LIMIT 1
)
WHERE pd.doc_type IS NOT NULL;

-- Не попавшие под маппинг (пустая строка и т.п.) — «Иной документ»
UPDATE person_documents
SET document_type_id = (SELECT id FROM document_types WHERE code = 'other')
WHERE document_type_id IS NULL;

-- 5. Обязательность и удаление старой колонки
ALTER TABLE person_documents ALTER COLUMN document_type_id SET NOT NULL;
ALTER TABLE person_documents DROP COLUMN doc_type;

-- 6. RLS: глобальный справочник — чтение всем аутентифицированным
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_types_select_authenticated"
  ON document_types FOR SELECT TO authenticated USING (true);
