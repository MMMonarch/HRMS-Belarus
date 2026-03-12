-- RPC: возврат «голой» схемы переменных для редактора — плоский массив { path, label, type, group [, format] }.
-- Совместимо с docs/EDITOR_VARIABLES.md. Вызов: POST http://kong:8000/rest/v1/rpc/get_schema_tables
-- Тело: {} или {"schema_names": ["public", "auth"]} для фильтра по схемам.

CREATE OR REPLACE FUNCTION public.get_schema_tables(schema_names text[] DEFAULT ARRAY['public'])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, information_schema
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'path', c.table_name || '.' || c.column_name,
          'label', c.column_name,
          'type', CASE c.data_type
            WHEN 'integer' THEN 'number'
            WHEN 'bigint' THEN 'number'
            WHEN 'smallint' THEN 'number'
            WHEN 'numeric' THEN 'number'
            WHEN 'real' THEN 'number'
            WHEN 'double precision' THEN 'number'
            WHEN 'date' THEN 'date'
            WHEN 'timestamp with time zone' THEN 'date'
            WHEN 'timestamp without time zone' THEN 'date'
            WHEN 'boolean' THEN 'boolean'
            ELSE 'string'
          END,
          'group', c.table_name
        ) || CASE
          WHEN c.data_type IN ('date', 'timestamp with time zone', 'timestamp without time zone')
          THEN jsonb_build_object('format', 'dd.MM.yyyy')
          ELSE '{}'::jsonb
        END
        ORDER BY c.table_schema, c.table_name, c.ordinal_position
      )
      FROM information_schema.columns c
      WHERE c.table_schema = ANY (schema_names)
        AND EXISTS (
          SELECT 1 FROM information_schema.tables t
          WHERE t.table_schema = c.table_schema
            AND t.table_name = c.table_name
            AND t.table_type = 'BASE TABLE'
        )
    ),
    '[]'::jsonb
  );
$$;

COMMENT ON FUNCTION public.get_schema_tables(text[]) IS
  'Возвращает плоский массив переменных (path, label, type, group[, format]) для редактора. Вызов: POST /rest/v1/rpc/get_schema_tables.';

-- Доступ для вызова через PostgREST (anon/authenticated)
GRANT EXECUTE ON FUNCTION public.get_schema_tables(text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_schema_tables(text[]) TO authenticated;
