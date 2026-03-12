-- View: текущее назначение (должность, подразделение, даты) по человеку с активной занятостью.
-- Используем LEFT JOIN для assignments/positions/departments, чтобы при отсутствии назначения
-- (или при NULL position_id/department_id) всё равно возвращалась строка с person_id, branch_id,
-- employment_start_date и NULL для position_name, department_name, assignment_start_date.
-- Так в списке сотрудников отображаются дата приёма и «—» по должности/подразделению до создания назначения.

CREATE OR REPLACE VIEW v_person_current_assignment AS
SELECT
  e.person_id,
  e.branch_id,
  pos.name AS position_name,
  d.name AS department_name,
  e.start_date AS employment_start_date,
  a.start_date AS assignment_start_date
FROM employments e
LEFT JOIN assignments a
  ON a.employment_id = e.id
  AND a.branch_id = e.branch_id
  AND a.end_date IS NULL
LEFT JOIN positions pos
  ON pos.id = a.position_id
  AND pos.branch_id = a.branch_id
LEFT JOIN departments d
  ON d.id = a.department_id
  AND d.branch_id = a.branch_id
WHERE e.status = 'active';

COMMENT ON VIEW v_person_current_assignment IS 'Текущая должность и подразделение по лицу с активной занятостью (LEFT JOIN: при отсутствии назначения возвращается строка с NULL position_name/department_name).';
