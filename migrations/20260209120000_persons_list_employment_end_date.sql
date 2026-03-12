-- Добавить в v_persons_list колонку employment_end_date (дата увольнения для terminated).
-- Для отображения в карточке сотрудника: «Уволен 09.02.2025».
-- DROP + CREATE: в PostgreSQL CREATE OR REPLACE VIEW не позволяет добавить колонку в середину (меняет порядок/имена).

DROP VIEW IF EXISTS v_persons_list;

CREATE VIEW v_persons_list AS
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
  -- employment_end_date: дата окончания последней по дате занятости со статусом terminated (для отображения «Уволен DD.MM.YYYY»)
  (
    SELECT e.end_date
    FROM employments e
    WHERE e.branch_id = p.branch_id
      AND e.person_id = p.id
      AND e.status = 'terminated'
    ORDER BY e.end_date DESC NULLS LAST
    LIMIT 1
  ) AS employment_end_date,
  -- is_candidate: есть запись в candidates со статусом не closed
  EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.branch_id = p.branch_id AND c.person_id = p.id AND c.status != 'closed'
  ) AS is_candidate
FROM persons p;

COMMENT ON VIEW v_persons_list IS 'Список всех лиц филиала с employment_status (active/terminated/null), employment_end_date (дата увольнения) и is_candidate для фильтра: неуволенные / уволенные / абсолютно все';
