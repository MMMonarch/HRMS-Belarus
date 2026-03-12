-- Триггер: при INSERT в persons автоматически создать запись в candidates (status = 'applied').
-- Логика «Добавить кандидата»: приложение делает только INSERT в persons из формы;
-- триггер создаёт запись кандидата. branch_id в candidates подставится существующим триггером из persons.
--
-- ВАЖНО: при таком триггере каждый новый человек в persons автоматически получает запись в candidates.
-- Если позже появятся сценарии, где персону создают без кандидатуры (например, массовый импорт уже
-- работающих сотрудников), для них либо не делать INSERT в persons, либо доработать триггер
-- (например, флаг или отдельная таблица «это кандидат»). Пока логика «добавили персону → всегда кандидат».

CREATE OR REPLACE FUNCTION on_person_insert_create_candidate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO candidates (person_id, status)
  VALUES (NEW.id, 'applied'::candidate_status);
  RETURN NEW;
END;
$$;

CREATE TRIGGER persons_create_candidate_after_insert
  AFTER INSERT ON persons
  FOR EACH ROW
  EXECUTE PROCEDURE on_person_insert_create_candidate();

COMMENT ON FUNCTION on_person_insert_create_candidate() IS
  'После INSERT в persons создаёт запись в candidates (person_id, status=applied). branch_id в candidates подставляется триггером из persons.';
