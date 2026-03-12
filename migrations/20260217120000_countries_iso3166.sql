-- Справочник государств (гражданство в persons). ISO 3166-1.

-- 1. Привести структуру таблицы countries к схеме SCHEMA.md
-- (таблица уже существует с id, code, name; данных нет)

ALTER TABLE countries
  ADD COLUMN IF NOT EXISTS alpha2 text,
  ADD COLUMN IF NOT EXISTS alpha3 text,
  ADD COLUMN IF NOT EXISTS numeric3 smallint,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Перенести code → alpha2 (если есть данные), затем удалить code
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'countries' AND column_name = 'code'
  ) THEN
    UPDATE countries SET alpha2 = upper(trim(code)) WHERE code IS NOT NULL;
    ALTER TABLE countries DROP COLUMN code;
  END IF;
END $$;

-- Уникальные индексы (для ON CONFLICT при вставке)
CREATE UNIQUE INDEX IF NOT EXISTS countries_alpha2_key ON countries (alpha2);
CREATE UNIQUE INDEX IF NOT EXISTS countries_alpha3_key ON countries (alpha3) WHERE alpha3 IS NOT NULL;

-- 2. Начальный набор: Беларусь и соседи + часто используемые (ISO 3166-1)
INSERT INTO countries (alpha2, name, alpha3, numeric3, sort_order) VALUES
  ('BY', 'Беларусь', 'BLR', 112, 1),
  ('RU', 'Россия', 'RUS', 643, 2),
  ('UA', 'Украина', 'UKR', 804, 3),
  ('PL', 'Польша', 'POL', 616, 4),
  ('LT', 'Литва', 'LTU', 440, 5),
  ('LV', 'Латвия', 'LVA', 428, 6),
  ('EE', 'Эстония', 'EST', 233, 7),
  ('KZ', 'Казахстан', 'KAZ', 398, 8),
  ('MD', 'Молдова', 'MDA', 498, 9),
  ('GE', 'Грузия', 'GEO', 268, 10),
  ('AM', 'Армения', 'ARM', 51, 11),
  ('AZ', 'Азербайджан', 'AZE', 31, 12),
  ('UZ', 'Узбекистан', 'UZB', 860, 13),
  ('KG', 'Киргизия', 'KGZ', 417, 14),
  ('TJ', 'Таджикистан', 'TJK', 762, 15),
  ('TM', 'Туркменистан', 'TKM', 795, 16),
  ('DE', 'Германия', 'DEU', 276, 20),
  ('US', 'США', 'USA', 840, 21),
  ('GB', 'Великобритания', 'GBR', 826, 22),
  ('FR', 'Франция', 'FRA', 250, 23),
  ('CN', 'Китай', 'CHN', 156, 24),
  ('TR', 'Турция', 'TUR', 792, 25),
  ('IN', 'Индия', 'IND', 356, 26)
ON CONFLICT (alpha2) DO NOTHING;

-- Обязательность alpha2 после вставки (на случай пустой таблицы)
UPDATE countries SET alpha2 = upper(trim(alpha2)) WHERE alpha2 IS NOT NULL;
ALTER TABLE countries ALTER COLUMN alpha2 SET NOT NULL;

COMMENT ON TABLE countries IS 'Государства (гражданство в persons). ISO 3166-1.';
COMMENT ON COLUMN countries.alpha2 IS 'Двухбуквенный код ISO 3166-1 alpha-2 (BY, RU, US).';
COMMENT ON COLUMN countries.name IS 'Краткое наименование страны для UI.';
COMMENT ON COLUMN countries.alpha3 IS 'Трёхбуквенный код ISO 3166-1 alpha-3 (BLR, RUS, USA).';
COMMENT ON COLUMN countries.numeric3 IS 'Трёхзначный числовой код ISO 3166-1 numeric (112, 643, 840).';
COMMENT ON COLUMN countries.sort_order IS 'Порядок вывода в селектах.';

-- 3. RLS: чтение — всем аутентифицированным
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "countries_select_authenticated" ON countries;
CREATE POLICY "countries_select_authenticated"
  ON countries FOR SELECT TO authenticated USING (true);

-- 4. Редактирование справочника (для UI через n8n)
DROP POLICY IF EXISTS "countries_insert_authenticated" ON countries;
CREATE POLICY "countries_insert_authenticated"
  ON countries FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "countries_update_authenticated" ON countries;
CREATE POLICY "countries_update_authenticated"
  ON countries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "countries_delete_authenticated" ON countries;
CREATE POLICY "countries_delete_authenticated"
  ON countries FOR DELETE TO authenticated USING (true);
