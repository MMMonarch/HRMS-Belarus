-- Справочник типов шаблонов (template_types). В templates поле template_type — int (number из template_types).

-- 1. Таблица template_types
CREATE TABLE template_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number int NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX template_types_number_key ON template_types (number);

COMMENT ON TABLE template_types IS 'Справочник типов шаблонов (шапка приказа, пункт приказа, документ для печати). number выбирается в templates.template_type.';
COMMENT ON COLUMN template_types.number IS 'Номер типа; можно менять вручную. Значение подставляется в templates.template_type.';
COMMENT ON COLUMN template_types.name IS 'Имя типа шаблона для UI.';

-- 2. Начальные типы (соответствие старому enum: order_header=1, order_item=2, document=3)
INSERT INTO template_types (number, name) VALUES
  (1, 'Шапка сводного приказа'),
  (2, 'Пункт приказа'),
  (3, 'Документ для печати');

-- 3. В templates заменить enum template_type на int
ALTER TABLE templates ADD COLUMN template_type_int int;

UPDATE templates SET template_type_int = 1 WHERE template_type = 'order_header';
UPDATE templates SET template_type_int = 2 WHERE template_type = 'order_item';
UPDATE templates SET template_type_int = 3 WHERE template_type = 'document';

ALTER TABLE templates DROP COLUMN template_type;
ALTER TABLE templates RENAME COLUMN template_type_int TO template_type;
ALTER TABLE templates ALTER COLUMN template_type SET NOT NULL;

COMMENT ON COLUMN templates.template_type IS 'Номер типа шаблона (значение template_types.number).';

-- 4. Удалить старый enum
DROP TYPE template_type;

-- 5. Аудит для template_types
CREATE TRIGGER template_types_set_audit
  BEFORE INSERT OR UPDATE ON template_types
  FOR EACH ROW EXECUTE PROCEDURE set_audit_columns();
