-- Расширяем представление: добавляем effective_to для отображения «В отпуске до DD.MM.YYYY».
-- Оставляем по одной строке на (person_id, branch_id), берём максимальную дату окончания отпуска.

CREATE OR REPLACE VIEW v_person_on_leave_today
WITH (security_invoker = on) AS
SELECT
  e.person_id,
  e.branch_id,
  MAX(oi.effective_to::date) AS effective_to
FROM employments e
JOIN order_items oi
  ON oi.employment_id = e.id
  AND oi.branch_id = e.branch_id
WHERE e.status = 'active'
  AND oi.item_type_number = 3
  AND oi.state = 'applied'
  AND oi.effective_from IS NOT NULL
  AND oi.effective_to IS NOT NULL
  AND current_date >= oi.effective_from::date
  AND current_date <= oi.effective_to::date
GROUP BY e.person_id, e.branch_id;

COMMENT ON VIEW v_person_on_leave_today IS 'Пары (person_id, branch_id) и дата окончания отпуска (effective_to), у которых на текущую дату действует применённый приказ об отпуске';
