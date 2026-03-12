-- Добавить в template_types технические поля created_by, updated_by (триггер set_audit уже проставляет их).

ALTER TABLE template_types
  ADD COLUMN created_by uuid REFERENCES auth.users(id),
  ADD COLUMN updated_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN template_types.created_by IS 'Автор создания.';
COMMENT ON COLUMN template_types.updated_by IS 'Автор последнего изменения.';
