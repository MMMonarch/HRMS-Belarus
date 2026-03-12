-- View: текущее назначение (должность, подразделение, даты) по человеку с активной занятостью.
-- employment_start_date = дата приёма (начало занятости); assignment_start_date = дата вступления в текущую должность.
-- Использование: JOIN с v_persons_list по (person_id, branch_id) для отображения в карточке сотрудника.

CREATE OR REPLACE VIEW v_person_current_assignment AS
SELECT
  e.person_id,
  e.branch_id,
  pos.name AS position_name,
  d.name AS department_name,
  e.start_date AS employment_start_date,
  a.start_date AS assignment_start_date
FROM employments e
JOIN assignments a
  ON a.employment_id = e.id
  AND a.branch_id = e.branch_id
  AND a.end_date IS NULL
JOIN positions pos
  ON pos.id = a.position_id
  AND pos.branch_id = a.branch_id
JOIN departments d
  ON d.id = a.department_id
  AND d.branch_id = a.branch_id
WHERE e.status = 'active';

COMMENT ON VIEW v_person_current_assignment IS 'Текущая должность и подразделение по лицу с активной занятостью; employment_start_date = дата приёма, assignment_start_date = дата вступления в должность.';