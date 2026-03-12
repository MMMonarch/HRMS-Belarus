-- Добавить в orders колонку для хранения созданного печатного варианта сводного приказа.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS print_output jsonb;

COMMENT ON COLUMN orders.print_output IS 'Созданный печатный вариант сводного приказа (структурированные данные или HTML-фрагменты).';
