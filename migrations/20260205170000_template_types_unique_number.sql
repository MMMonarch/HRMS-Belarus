-- Вернуть уникальность номера в template_types: один номер — одна запись.

-- Удалить дубликаты (оставить одну запись с минимальным id на каждый number)
DELETE FROM template_types a
USING template_types b
WHERE a.number = b.number AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS template_types_number_key ON template_types (number);

COMMENT ON COLUMN template_types.number IS 'Номер типа (уникальный); можно менять вручную. Значение подставляется в templates.template_type.';
