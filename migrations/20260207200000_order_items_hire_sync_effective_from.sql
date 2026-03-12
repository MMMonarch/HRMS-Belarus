-- При изменении даты начала (effective_from) применённого пункта приказа о приёме
-- обновлять дату приёма в занятости и дату вступления в должность в назначении,
-- чтобы «Принят» и «Вступил в должность» в карточке сотрудника совпадали с приказом.

CREATE OR REPLACE FUNCTION order_items_hire_sync_effective_from_to_employment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.item_type_number != 1 OR NEW.state != 'applied' THEN
    RETURN NEW;
  END IF;
  IF NEW.effective_from IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.effective_from IS NOT DISTINCT FROM NEW.effective_from THEN
    RETURN NEW;
  END IF;

  UPDATE employments
  SET start_date = NEW.effective_from,
      updated_at = now()
  WHERE hire_order_item_id = NEW.id;

  UPDATE assignments
  SET start_date = NEW.effective_from,
      updated_at = now()
  WHERE basis_order_item_id = NEW.id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION order_items_hire_sync_effective_from_to_employment() IS
  'AFTER UPDATE: при изменении effective_from у применённого пункта приёма (item_type_number=1, state=applied) обновляет employments.start_date и assignments.start_date по ссылкам hire_order_item_id / basis_order_item_id.';

DROP TRIGGER IF EXISTS order_items_after_update_hire_sync_effective_from ON order_items;
CREATE TRIGGER order_items_after_update_hire_sync_effective_from
  AFTER UPDATE OF effective_from
  ON order_items
  FOR EACH ROW
  EXECUTE PROCEDURE order_items_hire_sync_effective_from_to_employment();
