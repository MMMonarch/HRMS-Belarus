-- Справочник типов пунктов приказа (order_item_types). В order_items хранится номер типа (1–5).
-- Нумерация по предложению: 1 Приём, 2 Перевод, 3 Отпуск, 4 Прочий, 5 Увольнение.

-- 1. Таблица order_item_types
CREATE TABLE order_item_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number int NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX order_item_types_number_key ON order_item_types (number);

COMMENT ON TABLE order_item_types IS 'Справочник типов пунктов приказа. В order_items хранится order_item_types.number (1–5).';
COMMENT ON COLUMN order_item_types.number IS 'Номер типа (уникальный); в order_items хранится это значение.';
COMMENT ON COLUMN order_item_types.name IS 'Наименование типа для UI.';

-- 2. Начальные типы (1–5)
INSERT INTO order_item_types (number, name) VALUES
  (1, 'Приём'),
  (2, 'Перевод/перемещение'),
  (3, 'Приказ об отпуске'),
  (4, 'Прочий приказ'),
  (5, 'Увольнение');

-- 3. В order_items добавить колонку с номером типа
ALTER TABLE order_items ADD COLUMN item_type_number int;

-- 4. Заполнить из старого enum (travel, misc, cancel → 4 «Прочий»)
UPDATE order_items SET item_type_number = 1 WHERE item_type = 'hire';
UPDATE order_items SET item_type_number = 2 WHERE item_type = 'transfer';
UPDATE order_items SET item_type_number = 3 WHERE item_type = 'leave';
UPDATE order_items SET item_type_number = 4 WHERE item_type IN ('travel', 'misc', 'cancel');
UPDATE order_items SET item_type_number = 5 WHERE item_type = 'termination';

ALTER TABLE order_items ALTER COLUMN item_type_number SET NOT NULL;

-- 5. Удалить старые CHECK по item_type
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_hire_check;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_transfer_check;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_termination_check;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_leave_travel_check;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_cancel_check;

-- 6. Уникальный индекс для cancel: по reverses_item_id (отмена идентифицируется по ссылке)
DROP INDEX IF EXISTS order_items_reverses_item_key;
CREATE UNIQUE INDEX order_items_reverses_item_key ON order_items (reverses_item_id)
  WHERE reverses_item_id IS NOT NULL;

-- 7. Новые CHECK по номеру типа
ALTER TABLE order_items ADD CONSTRAINT order_items_type1_check CHECK (
  item_type_number != 1 OR (effective_from IS NOT NULL)
);
ALTER TABLE order_items ADD CONSTRAINT order_items_type2_check CHECK (
  item_type_number != 2 OR (employment_id IS NOT NULL AND effective_from IS NOT NULL)
);
ALTER TABLE order_items ADD CONSTRAINT order_items_type3_check CHECK (
  item_type_number != 3 OR (
    employment_id IS NOT NULL AND effective_from IS NOT NULL
    AND effective_to IS NOT NULL AND effective_to >= effective_from
  )
);
ALTER TABLE order_items ADD CONSTRAINT order_items_type5_check CHECK (
  item_type_number != 5 OR (employment_id IS NOT NULL AND effective_from IS NOT NULL)
);

-- 8. Внешний ключ на справочник (по number)
ALTER TABLE order_items ADD CONSTRAINT order_items_item_type_number_fkey
  FOREIGN KEY (item_type_number) REFERENCES order_item_types (number);

-- 9. Удалить колонку и enum
ALTER TABLE order_items DROP COLUMN item_type;
DROP TYPE item_type;
