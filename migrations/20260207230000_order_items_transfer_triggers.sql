-- Триггеры для пункта приказа о переводе (item_type_number = 2):
-- 1) При изменении даты (effective_from) применённого перевода — синхронизировать start_date/end_date в assignments.
-- 2) При удалении применённого перевода — удалить назначение, созданное этим пунктом, и «раскрыть» предыдущее (end_date = NULL).

-- 1. Синхронизация даты перевода в назначениях
CREATE OR REPLACE FUNCTION order_items_transfer_sync_effective_from()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.item_type_number != 2 OR NEW.state != 'applied' THEN
    RETURN NEW;
  END IF;
  IF NEW.effective_from IS NULL OR NEW.employment_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.effective_from IS NOT DISTINCT FROM NEW.effective_from THEN
    RETURN NEW;
  END IF;

  -- Назначение, созданное этим пунктом перевода: обновить start_date
  UPDATE assignments
  SET start_date = NEW.effective_from,
      updated_at = now()
  WHERE basis_order_item_id = NEW.id;

  -- Предыдущее назначение (которое закрыли при применении перевода): сдвинуть end_date
  UPDATE assignments
  SET end_date = NEW.effective_from,
      updated_at = now()
  WHERE employment_id = NEW.employment_id
    AND end_date IS NOT NULL
    AND end_date = OLD.effective_from
    AND (basis_order_item_id IS NULL OR basis_order_item_id != NEW.id);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION order_items_transfer_sync_effective_from() IS
  'AFTER UPDATE: при изменении effective_from у применённого пункта перевода обновляет start_date назначения, созданного этим пунктом, и end_date предыдущего назначения.';

DROP TRIGGER IF EXISTS order_items_after_update_transfer_sync_effective_from ON order_items;
CREATE TRIGGER order_items_after_update_transfer_sync_effective_from
  AFTER UPDATE OF effective_from
  ON order_items
  FOR EACH ROW
  EXECUTE PROCEDURE order_items_transfer_sync_effective_from();

-- 2. Удаление применённого перевода: откат назначения (удалить новое, «сшить» цепочку)
-- Если есть следующий перевод (приём → перевод 3-го → перевод 5-го): предыдущее end_date = дата следующего.
-- Если следующего нет — раскрыть предыдущее (end_date = NULL).
CREATE OR REPLACE FUNCTION order_items_transfer_before_delete_revert_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _assignment_id uuid;
  _employment_id uuid;
  _start_date date;
  _end_date date;
  _new_end_date date;
BEGIN
  IF OLD.item_type_number != 2 OR OLD.state != 'applied' OR OLD.employment_id IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT id, employment_id, start_date, end_date
  INTO _assignment_id, _employment_id, _start_date, _end_date
  FROM assignments
  WHERE basis_order_item_id = OLD.id
  LIMIT 1;

  IF _assignment_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Есть ли следующее назначение (то, что начинается с даты окончания этого)?
  SELECT start_date INTO _new_end_date
  FROM assignments
  WHERE employment_id = _employment_id
    AND start_date = _end_date
    AND id != _assignment_id
  LIMIT 1;

  -- Сначала удалить назначение перевода, затем обновить предыдущее (иначе при end_date = NULL
  -- два активных назначения → assignments_one_active_per_employment).
  DELETE FROM assignments WHERE id = _assignment_id;

  UPDATE assignments
  SET end_date = _new_end_date,
      updated_at = now()
  WHERE employment_id = _employment_id
    AND end_date = _start_date;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION order_items_transfer_before_delete_revert_assignment() IS
  'BEFORE DELETE: при удалении применённого пункта перевода удаляет назначение и сшивает цепочку (предыдущее end_date = дата следующего или NULL).';

DROP TRIGGER IF EXISTS order_items_before_delete_transfer_revert_assignment ON order_items;
CREATE TRIGGER order_items_before_delete_transfer_revert_assignment
  BEFORE DELETE ON order_items
  FOR EACH ROW
  EXECUTE PROCEDURE order_items_transfer_before_delete_revert_assignment();
