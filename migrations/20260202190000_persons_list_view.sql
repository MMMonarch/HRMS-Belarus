-- View: все люди филиала с признаками «сотрудник» и «кандидат» для фильтрации списка
-- Использование: SELECT * FROM v_persons_list WHERE branch_id = :branch_id [AND employment_status = :filter]
-- Фильтр: employment_status = 'active' (неуволенные), 'terminated' (уволенные), или без условия (абсолютно все)

CREATE OR REPLACE VIEW v_persons_list AS
SELECT
  p.id,
  p.branch_id,
  p.person_no,
  p.last_name,
  p.first_name,
  p.patronymic,
  p.birth_date,
  p.contact_phone,
  p.contact_email,
  p.created_at,
  p.updated_at,
  -- employment_status: 'active' (работает), 'terminated' (уволен), NULL (никогда не был сотрудником, напр. кандидат)
  CASE
    WHEN EXISTS (
      SELECT 1 FROM employments e
      WHERE e.branch_id = p.branch_id AND e.person_id = p.id AND e.status = 'active'
    ) THEN 'active'::text
    WHEN EXISTS (
      SELECT 1 FROM employments e
      WHERE e.branch_id = p.branch_id AND e.person_id = p.id
    ) THEN 'terminated'::text
    ELSE NULL
  END AS employment_status,
  -- is_candidate: есть запись в candidates со статусом не closed
  EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.branch_id = p.branch_id AND c.person_id = p.id AND c.status != 'closed'
  ) AS is_candidate
FROM persons p;

COMMENT ON VIEW v_persons_list IS 'Список всех лиц филиала с employment_status (active/terminated/null) и is_candidate для фильтра: неуволенные / уволенные / абсолютно все';
