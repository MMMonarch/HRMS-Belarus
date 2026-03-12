-- Справочник подтипов пунктов приказа. Привязка к типу пункта (order_item_types).
-- Позволяет для «Приказ об отпуске», «Прочий приказ» и др. задавать подтип.

-- 1. Таблица order_item_subtypes
CREATE TABLE order_item_subtypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_type_id uuid NOT NULL REFERENCES order_item_types(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX order_item_subtypes_type_code_key
  ON order_item_subtypes (order_item_type_id, code);

COMMENT ON TABLE order_item_subtypes IS 'Подтипы пунктов приказа по типам (отпуск: трудовой/соц без сохр./соц оплач./прерывание; прочий — при необходимости).';
COMMENT ON COLUMN order_item_subtypes.order_item_type_id IS 'Тип пункта приказа (order_item_types), к которому относится подтип.';
COMMENT ON COLUMN order_item_subtypes.code IS 'Код для логики и API (латиница).';
COMMENT ON COLUMN order_item_subtypes.name IS 'Наименование для UI.';
COMMENT ON COLUMN order_item_subtypes.sort_order IS 'Порядок вывода в селектах.';

-- 2. Начальные подтипы для «Приказ об отпуске» (order_item_types.number = 3)
INSERT INTO order_item_subtypes (order_item_type_id, code, name, sort_order)
SELECT id, 'annual', 'Трудовой отпуск', 1 FROM order_item_types WHERE number = 3;
INSERT INTO order_item_subtypes (order_item_type_id, code, name, sort_order)
SELECT id, 'social_unpaid', 'Социальный отпуск без сохранения оплаты', 2 FROM order_item_types WHERE number = 3;
INSERT INTO order_item_subtypes (order_item_type_id, code, name, sort_order)
SELECT id, 'social_paid', 'Соц отпуск оплачиваемый', 3 FROM order_item_types WHERE number = 3;
INSERT INTO order_item_subtypes (order_item_type_id, code, name, sort_order)
SELECT id, 'interruption', 'Прерывание отпуска', 4 FROM order_item_types WHERE number = 3;

-- 3. Колонка в order_items
ALTER TABLE order_items ADD COLUMN item_subtype_id uuid REFERENCES order_item_subtypes(id) ON DELETE SET NULL;

COMMENT ON COLUMN order_items.item_subtype_id IS 'Подтип пункта (опционально). Должен соответствовать типу пункта (item_type_number).';

-- 4. Триггер: подтип разрешён только если он принадлежит типу пункта
CREATE OR REPLACE FUNCTION order_items_check_subtype_matches_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _type_id uuid;
  _subtype_type_id uuid;
BEGIN
  IF NEW.item_subtype_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT id INTO _type_id FROM order_item_types WHERE number = NEW.item_type_number;
  IF _type_id IS NULL THEN
    RAISE EXCEPTION 'order_items: unknown item_type_number %', NEW.item_type_number;
  END IF;
  SELECT order_item_type_id INTO _subtype_type_id FROM order_item_subtypes WHERE id = NEW.item_subtype_id;
  IF _subtype_type_id IS NULL THEN
    RAISE EXCEPTION 'order_items: item_subtype_id % not found', NEW.item_subtype_id;
  END IF;
  IF _subtype_type_id != _type_id THEN
    RAISE EXCEPTION 'order_items: item_subtype_id does not belong to item_type_number %', NEW.item_type_number;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_items_subtype_matches_type
  BEFORE INSERT OR UPDATE OF item_type_number, item_subtype_id ON order_items
  FOR EACH ROW EXECUTE PROCEDURE order_items_check_subtype_matches_type();

-- 5. При смене типа пункта — сбросить подтип, если он от другого типа (триггер выше уже проверит; при смене item_type_number на несовместимый будет ошибка, поэтому сбрасываем подтип при смене типа)
CREATE OR REPLACE FUNCTION order_items_clear_subtype_on_type_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.item_type_number IS DISTINCT FROM NEW.item_type_number AND NEW.item_subtype_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM order_item_subtypes s
      JOIN order_item_types t ON t.id = s.order_item_type_id
      WHERE s.id = NEW.item_subtype_id AND t.number = NEW.item_type_number
    ) THEN
      NEW.item_subtype_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_items_clear_subtype_on_type_change_trigger
  BEFORE UPDATE OF item_type_number ON order_items
  FOR EACH ROW
  WHEN (OLD.item_type_number IS DISTINCT FROM NEW.item_type_number)
  EXECUTE PROCEDURE order_items_clear_subtype_on_type_change();
