-- Исправление удаления пункта приказа о приёме: циклический FK order_items.contract_id → contracts
-- блокировал DELETE contracts. Перед удалением контрактов обнуляем у удаляемой строки order_items
-- ссылки contract_id и contract_amendment_id, затем удаляем contract_amendments и contracts.

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

  -- 3. Обнулить ссылки удаляемой строки на contract/contract_amendment, чтобы FK не блокировал DELETE contracts
  UPDATE order_items SET contract_id = NULL, contract_amendment_id = NULL, updated_at = now() WHERE id = OLD.id;

  -- 4. Занятость по пункту приёма (hire_order_item_id)
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

COMMENT ON FUNCTION order_items_hire_before_delete_revert_employment() IS
  'BEFORE DELETE: при удалении пункта приёма обнуляет ссылки (contract_id и др.), удаляет contracts/contract_amendments по hire_order_item_id, откатывает занятость/назначение и кандидата; занятость удаляется в AFTER DELETE.';
