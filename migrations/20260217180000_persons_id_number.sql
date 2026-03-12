-- Идентификационный номер (персона). Один на человека — в persons.

ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS id_number text;

COMMENT ON COLUMN persons.id_number IS 'Идентификационный номер (напр. в паспорте РБ). Один на человека.';
