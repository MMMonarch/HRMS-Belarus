-- Триггеры для согласованности: пункт приказа о приёме ↔ статус кандидата и занятость.
-- 1) При применении пункта приёма (state → applied) — закрываем кандидата (status = closed).
-- 2) При удалении применённого пункта приёма — удаляем занятость и назначение, возвращаем человека в кандидаты (status = offer).

-- Функция: при переводе пункта приёма в applied — закрыть кандидата по person_id/branch_id
CREATE OR REPLACE FUNCTION order_items_hire_applied_sync_candidate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.item_type_number = 1
     AND NEW.state = 'applied'
     AND (OLD.state IS NULL OR OLD.state != 'applied') THEN
    UPDATE candidates
    SET status = 'closed',
        updated_at = now()
    WHERE person_id = NEW.person_id
      AND branch_id = NEW.branch_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION order_items_hire_applied_sync_candidate() IS
  'При применении пункта приказа о приёме (state=applied) переводит кандидата в status=closed.';

DROP TRIGGER IF EXISTS order_items_after_update_hire_sync_candidate ON order_items;
CREATE TRIGGER order_items_after_update_hire_sync_candidate
  AFTER UPDATE ON order_items
  FOR EACH ROW
  EXECUTE PROCEDURE order_items_hire_applied_sync_candidate();


-- Функция BEFORE DELETE: очистить ссылки, откатить договоры/кандидата, отложить удаление занятости
CREATE OR REPLACE FUNCTION order_items_hire_before_delete_revert_employment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employment_id uuid;
BEGIN
  -- Временная таблица сессии (создаётся при первом удалении в сессии)
  EXECUTE 'CREATE TEMP TABLE IF NOT EXISTS _order_item_pending_employment_deletes (
    order_item_id uuid PRIMARY KEY,
    employment_id uuid NOT NULL
  )';

  -- 1. Очистить самоссылки в order_items
  UPDATE order_items SET reverses_item_id = NULL WHERE reverses_item_id = OLD.id;
  UPDATE order_items SET reversed_by_item_id = NULL WHERE reversed_by_item_id = OLD.id;

  -- 2. Отвязать доп. соглашения и периоды отсутствия от этого пункта
  UPDATE contract_amendments SET order_item_id = NULL, updated_at = now() WHERE order_item_id = OLD.id;
  UPDATE absence_periods SET basis_order_item_id = NULL, updated_at = now() WHERE basis_order_item_id = OLD.id;
  UPDATE employments SET termination_order_item_id = NULL WHERE termination_order_item_id = OLD.id;

  -- 3. Занятость по пункту приёма (hire_order_item_id)
  SELECT id INTO _employment_id
  FROM employments
  WHERE hire_order_item_id = OLD.id
  LIMIT 1;

  IF _employment_id IS NOT NULL THEN
    -- Удалить договоры по этому пункту приёма (не оставлять висячие contracts без order_item и employment)
    DELETE FROM contract_amendments
    WHERE contract_id IN (SELECT id FROM contracts WHERE hire_order_item_id = OLD.id);
    DELETE FROM contracts WHERE hire_order_item_id = OLD.id;

    DELETE FROM assignments WHERE basis_order_item_id = OLD.id;
    DELETE FROM absence_periods WHERE employment_id = _employment_id;
    -- Удаление employment — в AFTER DELETE (сейчас эта строка order_items ещё ссылается на неё)
    INSERT INTO _order_item_pending_employment_deletes (order_item_id, employment_id)
    VALUES (OLD.id, _employment_id)
    ON CONFLICT (order_item_id) DO UPDATE SET employment_id = EXCLUDED.employment_id;

    UPDATE candidates
    SET status = 'offer',
        updated_at = now()
    WHERE person_id = OLD.person_id
      AND branch_id = OLD.branch_id;
  ELSIF OLD.item_type_number = 1 THEN
    -- Пункт приёма в черновике: договоры по нему тоже удаляем (не оставлять висячие)
    DELETE FROM contract_amendments
    WHERE contract_id IN (SELECT id FROM contracts WHERE hire_order_item_id = OLD.id);
    DELETE FROM contracts WHERE hire_order_item_id = OLD.id;

    UPDATE candidates
    SET status = 'offer',
        updated_at = now()
    WHERE person_id = OLD.person_id
      AND branch_id = OLD.branch_id;
  END IF;

  RETURN OLD;
END;
$$;

-- Функция AFTER DELETE: удалить занятости, отложенные в BEFORE (строка order_items уже удалена, FK не блокирует)
CREATE OR REPLACE FUNCTION order_items_after_delete_drop_employments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employment_id uuid;
BEGIN
  SELECT employment_id INTO _employment_id
  FROM _order_item_pending_employment_deletes
  WHERE order_item_id = OLD.id;

  IF _employment_id IS NOT NULL THEN
    DELETE FROM employments WHERE id = _employment_id;
    DELETE FROM _order_item_pending_employment_deletes WHERE order_item_id = OLD.id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS order_items_before_delete_hire_revert_employment ON order_items;
CREATE TRIGGER order_items_before_delete_hire_revert_employment
  BEFORE DELETE ON order_items
  FOR EACH ROW
  EXECUTE PROCEDURE order_items_hire_before_delete_revert_employment();

DROP TRIGGER IF EXISTS order_items_after_delete_drop_employments ON order_items;
CREATE TRIGGER order_items_after_delete_drop_employments
  AFTER DELETE ON order_items
  FOR EACH ROW
  EXECUTE PROCEDURE order_items_after_delete_drop_employments();
