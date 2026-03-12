-- Категории и подкатегории должностей (справочники для UI; категории при необходимости можно заменить на enum).
-- Подкатегория привязана к категории; должность (positions) — к подкатегории.

-- 1. Категории должностей (Руководители, Специалисты, Служащие, Рабочие и т.д.)
CREATE TABLE position_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- 2. Подкатегории должностей (привязаны к категории)
CREATE TABLE position_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES position_categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX position_subcategories_category_id_idx ON position_subcategories (category_id);

-- 3. Привязка должности к подкатегории (nullable: существующие должности без подкатегории)
ALTER TABLE positions
  ADD COLUMN position_subcategory_id uuid REFERENCES position_subcategories(id) ON DELETE SET NULL;

CREATE INDEX positions_position_subcategory_id_idx ON positions (position_subcategory_id);

COMMENT ON TABLE position_categories IS 'Категории должностей (Руководители, Специалисты, Служащие, Рабочие). Редактируются в UI; при необходимости можно заменить на enum.';
COMMENT ON TABLE position_subcategories IS 'Подкатегории должностей (напр. Главные специалисты → Специалисты). Редактируются в UI.';
COMMENT ON COLUMN positions.position_subcategory_id IS 'Подкатегория должности (опционально).';

-- Аудит (функция set_audit_columns уже есть в базовой миграции)
CREATE TRIGGER position_categories_set_audit
  BEFORE INSERT OR UPDATE ON position_categories
  FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
CREATE TRIGGER position_subcategories_set_audit
  BEFORE INSERT OR UPDATE ON position_subcategories
  FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
