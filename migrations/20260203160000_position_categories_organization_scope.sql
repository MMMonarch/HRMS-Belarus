-- Категории и подкатегории должностей — на уровне организации (organization_id), не глобальные.
-- Целостность: должность филиала не может ссылаться на подкатегорию чужой организации.

-- 1. Добавить organization_id в position_categories
ALTER TABLE position_categories
  ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill: привязать существующие категории к первой организации (если есть строки без организации)
UPDATE position_categories
SET organization_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

ALTER TABLE position_categories
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX position_categories_organization_id_idx ON position_categories (organization_id);
COMMENT ON COLUMN position_categories.organization_id IS 'Справочник категорий изолирован по организации для RLS и локальных настроек.';

-- 2. Добавить organization_id в position_subcategories (должен совпадать с категорией)
ALTER TABLE position_subcategories
  ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE position_subcategories
SET organization_id = (SELECT organization_id FROM position_categories WHERE id = position_subcategories.category_id)
WHERE organization_id IS NULL;

ALTER TABLE position_subcategories
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX position_subcategories_organization_id_idx ON position_subcategories (organization_id);
COMMENT ON COLUMN position_subcategories.organization_id IS 'Справочник подкатегорий изолирован по организации; должен совпадать с category.organization_id.';

-- Ограничение: подкатегория принадлежит той же организации, что и категория (CHECK не может ссылаться на др. таблицу — триггер)
CREATE OR REPLACE FUNCTION check_subcategory_organization_matches_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cat_org_id uuid;
BEGIN
  SELECT organization_id INTO cat_org_id
  FROM position_categories WHERE id = NEW.category_id;

  IF cat_org_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'position_subcategories.organization_id must match position_categories.organization_id (category_id=%)',
      NEW.category_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER position_subcategories_check_organization_matches_category
  BEFORE INSERT OR UPDATE OF category_id, organization_id ON position_subcategories
  FOR EACH ROW EXECUTE PROCEDURE check_subcategory_organization_matches_category();

-- 3. Целостность: должность (positions) не может ссылаться на подкатегорию чужой организации
-- CHECK не может ссылаться на другие таблицы, поэтому используем триггер.
CREATE OR REPLACE FUNCTION check_position_subcategory_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  branch_org_id uuid;
  subcat_org_id uuid;
BEGIN
  IF NEW.position_subcategory_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id INTO branch_org_id
  FROM branches WHERE id = NEW.branch_id;

  SELECT organization_id INTO subcat_org_id
  FROM position_subcategories WHERE id = NEW.position_subcategory_id;

  IF branch_org_id IS DISTINCT FROM subcat_org_id THEN
    RAISE EXCEPTION 'position_subcategory must belong to the same organization as the position branch (branch_id=%, position_subcategory_id=%)',
      NEW.branch_id, NEW.position_subcategory_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER positions_check_subcategory_organization
  BEFORE INSERT OR UPDATE OF branch_id, position_subcategory_id ON positions
  FOR EACH ROW EXECUTE PROCEDURE check_position_subcategory_organization();

COMMENT ON FUNCTION check_position_subcategory_organization() IS 'Enforces: positions.position_subcategory_id may only reference a subcategory whose organization_id equals the position branch organization_id.';
