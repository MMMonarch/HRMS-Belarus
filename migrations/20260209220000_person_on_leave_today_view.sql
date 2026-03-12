-- View: лица, у которых на текущую дату действует применённый приказ об отпуске (order_items).
-- Использование: отображение статуса «В отпуске» в карточке сотрудника.
-- Берём дату начала действия приказа об отпуске (effective_from) и дату окончания (effective_to)
-- из пункта приказа; текущая дата должна попадать в этот период: effective_from <= today <= effective_to.

CREATE OR REPLACE VIEW v_person_on_leave_today
WITH (security_invoker = on) AS
SELECT DISTINCT
  e.person_id,
  e.branch_id
FROM employments e
JOIN order_items oi
  ON oi.employment_id = e.id
  AND oi.branch_id = e.branch_id
WHERE e.status = 'active'
  AND oi.item_type_number = 3
  AND oi.state = 'applied'
  AND oi.effective_from IS NOT NULL
  AND oi.effective_to IS NOT NULL
  AND current_date >= oi.effective_from
  AND current_date <= oi.effective_to;

COMMENT ON VIEW v_person_on_leave_today IS 'Пары (person_id, branch_id), у которых на текущую дату действует применённый приказ об отпуске (effective_from <= today <= effective_to)';
