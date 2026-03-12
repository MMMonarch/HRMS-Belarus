-- Ошибка "tuple to be deleted was already modified": нельзя в триггере UPDATE ту же строку, которую удаляем.
-- Решение: сделать FK order_items → contracts/contract_amendments отложенными (DEFERRABLE INITIALLY DEFERRED).
-- Тогда в триггере сначала удаляем contracts; проверка FK произойдёт при COMMIT, когда строка order_items уже удалена.

-- 1. Пересоздать FK с DEFERRABLE INITIALLY DEFERRED (ALTER CONSTRAINT для deferrable в PG не поддерживается)
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_contract_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_contract_id_fkey
  FOREIGN KEY (branch_id, contract_id) REFERENCES contracts (branch_id, id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_contract_amendment_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_contract_amendment_id_fkey
  FOREIGN KEY (branch_id, contract_amendment_id) REFERENCES contract_amendments (branch_id, id) DEFERRABLE INITIALLY DEFERRED;

-- 2. Убрать из триггера UPDATE удаляемой строки
CREATE OR REPLACE FUNCTION order_items_hire_before_delete_revert_employment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employment_id uuid;
BEGIN
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
    -- Удалить договоры по этому пункту приёма. FK order_items.contract_id проверяется при COMMIT (DEFERRED).
    DELETE FROM contract_amendments
    WHERE contract_id IN (SELECT id FROM contracts WHERE hire_order_item_id = OLD.id);
    DELETE FROM contracts WHERE hire_order_item_id = OLD.id;

    DELETE FROM assignments WHERE basis_order_item_id = OLD.id;
    DELETE FROM absence_periods WHERE employment_id = _employment_id;
    INSERT INTO _order_item_pending_employment_deletes (order_item_id, employment_id)
    VALUES (OLD.id, _employment_id)
    ON CONFLICT (order_item_id) DO UPDATE SET employment_id = EXCLUDED.employment_id;

    UPDATE candidates
    SET status = 'offer',
        updated_at = now()
    WHERE person_id = OLD.person_id
      AND branch_id = OLD.branch_id;
  ELSIF OLD.item_type_number = 1 THEN
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
  'BEFORE DELETE: при удалении пункта приёма удаляет contracts/contract_amendments по hire_order_item_id (FK отложены), откатывает занятость/назначение и кандидата; занятость удаляется в AFTER DELETE.';
