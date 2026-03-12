-- Запрет двух применённых переводов по одной занятости с одной датой начала.
-- Иначе при изменении effective_from у одного пункта триггер синхронизации портит
-- цепочку назначений (неоднозначность «предыдущего» назначения с end_date = D).

CREATE UNIQUE INDEX order_items_transfer_one_per_employment_date
  ON order_items (employment_id, effective_from)
  WHERE item_type_number = 2 AND state = 'applied';

COMMENT ON INDEX order_items_transfer_one_per_employment_date IS
  'Один применённый перевод на (employment_id, effective_from); запрещает второй перевод в ту же дату по той же занятости.';
