-- Исправление: при любом обновлении применённого пункта приёма держать кандидата в status=closed.
-- Раньше закрывали только при переходе state → applied; при последующем сохранении (дата, должность)
-- статус кандидата мог где-то сбрасываться — после правки при каждом касании пункта приёма в applied
-- заново выставляем closed.

CREATE OR REPLACE FUNCTION order_items_hire_applied_sync_candidate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Пункт приёма в статусе applied: кандидат должен быть closed (и при переходе в applied, и при любом последующем update)
  IF NEW.item_type_number = 1 AND NEW.state = 'applied' THEN
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
  'При применённом пункте приказа о приёме (item_type_number=1, state=applied) держит кандидата в status=closed при любом UPDATE пункта.';
