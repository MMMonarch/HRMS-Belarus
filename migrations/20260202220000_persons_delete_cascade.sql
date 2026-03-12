-- ON DELETE CASCADE только для candidates: при удалении персоны (кандидата) удалять запись в candidates.
-- Устраняет ошибку: update or delete on table "persons" violates foreign key constraint "candidates_branch_id_person_id_fkey" on table "candidates".
-- Пока что удаляем только кандидатов; person_documents, order_items, employments, contracts не трогаем.

ALTER TABLE candidates
  DROP CONSTRAINT IF EXISTS candidates_branch_id_person_id_fkey,
  ADD CONSTRAINT candidates_branch_id_person_id_fkey
    FOREIGN KEY (branch_id, person_id) REFERENCES persons (branch_id, id) ON DELETE CASCADE;
