-- Replace order_kind with template_id (FK to templates).
-- Table "templates" is universal: order header, order item, print document templates.

CREATE TYPE template_type AS ENUM ('order_header', 'order_item', 'document');

CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_html jsonb,
  template_type template_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Seed default order_header templates; use code for migration mapping only
ALTER TABLE templates ADD COLUMN code text;
INSERT INTO templates (code, name, template_type, template_html) VALUES
  ('hire', 'Приказ о приёме на работу', 'order_header', '{"default_title": "Приказ о приёме на работу"}'::jsonb),
  ('termination', 'Приказ об увольнении', 'order_header', '{"default_title": "Приказ об увольнении"}'::jsonb),
  ('transfer', 'Приказ о переводе/перемещении', 'order_header', '{"default_title": "О переводе на другую работу"}'::jsonb),
  ('leave', 'Приказ об отпуске', 'order_header', '{"default_title": "О предоставлении отпуска"}'::jsonb),
  ('travel', 'Приказ о командировке', 'order_header', '{"default_title": "О служебной командировке"}'::jsonb),
  ('misc', 'Прочий приказ', 'order_header', '{"default_title": "Прочий приказ"}'::jsonb);

-- Add template_id to orders and backfill from order_kind
ALTER TABLE orders ADD COLUMN template_id uuid REFERENCES templates(id);
UPDATE orders SET template_id = (SELECT id FROM templates WHERE templates.code = orders.order_kind::text);
UPDATE orders SET template_id = (SELECT id FROM templates WHERE code = 'misc' LIMIT 1) WHERE template_id IS NULL;
ALTER TABLE orders ALTER COLUMN template_id SET NOT NULL;

-- Drop order_kind column and enum
ALTER TABLE orders DROP COLUMN order_kind;
DROP TYPE order_kind;

-- Remove temporary code column from templates
ALTER TABLE templates DROP COLUMN code;
