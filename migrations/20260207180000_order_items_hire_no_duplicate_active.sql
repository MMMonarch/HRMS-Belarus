-- Запрет второго приказа о приёме для лица с активной занятостью.
-- Нельзя вставить или обновить пункт приказа в тип «Приём» (item_type_number = 1),
-- если у этого лица (person_id, branch_id) уже есть активная занятость (employments.status = 'active'),
-- кроме случая, когда эта занятость создана именно данным пунктом (hire_order_item_id = id пункта).

CREATE OR REPLACE FUNCTION order_items_hire_check_no_active_employment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _branch_id uuid;
BEGIN
  IF NEW.item_type_number != 1 THEN
    RETURN NEW;
  END IF;

  _branch_id := NEW.branch_id;
  IF _branch_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT o.branch_id INTO _branch_id FROM orders o WHERE o.id = NEW.order_id;
  END IF;
  IF _branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM employments e
    WHERE e.branch_id = _branch_id
      AND e.person_id = NEW.person_id
      AND e.status = 'active'
      AND (e.hire_order_item_id IS NULL OR e.hire_order_item_id != NEW.id)
  ) THEN
    RAISE EXCEPTION
      'Невозможно создать или изменить пункт приказа на тип «Приём»: у лица уже есть активная занятость в этом филиале. Повторный приём возможен только после увольнения.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION order_items_hire_check_no_active_employment() IS
  'BEFORE INSERT/UPDATE: запрещает пункт приказа типа «Приём», если у person_id уже есть активная занятость в branch_id (кроме занятости, созданной этим же пунктом).';

DROP TRIGGER IF EXISTS order_items_before_hire_no_duplicate_active ON order_items;
CREATE TRIGGER order_items_before_hire_no_duplicate_active
  BEFORE INSERT OR UPDATE OF person_id, branch_id, item_type_number
  ON order_items
  FOR EACH ROW
  EXECUTE PROCEDURE order_items_hire_check_no_active_employment();
