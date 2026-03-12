-- При удалении человека (persons) каскадно удалять его документы (person_documents).
-- Иначе удаление блокируется при наличии хотя бы одной записи в person_documents.

ALTER TABLE person_documents
  DROP CONSTRAINT IF EXISTS person_documents_branch_id_person_id_fkey,
  ADD CONSTRAINT person_documents_branch_id_person_id_fkey
    FOREIGN KEY (branch_id, person_id) REFERENCES persons (branch_id, id) ON DELETE CASCADE;
