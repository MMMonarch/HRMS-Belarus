-- Запрет второго приказа об увольнении: нельзя создать или перевести пункт в тип «Увольнение» (item_type_number = 5),
-- если у лица нет активной занятости в филиале (уже уволен или никогда не был сотрудником).

CREATE OR REPLACE FUNCTION order_items_termination_check_active_employment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _branch_id uuid;
BEGIN
  IF NEW.item_type_number != 5 THEN
    RETURN NEW;
  END IF;

  _branch_id := NEW.branch_id;
  IF _branch_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT o.branch_id INTO _branch_id FROM orders o WHERE o.id = NEW.order_id;
  END IF;
  IF _branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM employments e
    WHERE e.branch_id = _branch_id
      AND e.person_id = NEW.person_id
      AND e.status = 'active'
  ) THEN
    RAISE EXCEPTION
      'Невозможно создать или изменить пункт приказа на тип «Увольнение»: у лица нет активной занятости в этом филиале (уже уволен или не является сотрудником).'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION order_items_termination_check_active_employment() IS
  'BEFORE INSERT/UPDATE: запрещает пункт приказа типа «Увольнение», если у person_id нет активной занятости в branch_id.';

DROP TRIGGER IF EXISTS order_items_before_termination_no_duplicate ON order_items;
CREATE TRIGGER order_items_before_termination_no_duplicate
  BEFORE INSERT OR UPDATE OF person_id, branch_id, item_type_number
  ON order_items
  FOR EACH ROW
  EXECUTE PROCEDURE order_items_termination_check_active_employment();
