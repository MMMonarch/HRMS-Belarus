-- Вид трудового договора по сроку/основанию (ТК РБ).
-- contract_type остаётся: employment_contract (трудовой договор) / contract (контракт).
-- contract_term_kind уточняет основание срочности для отчётов и комплаенса.

CREATE TYPE contract_term_kind AS ENUM (
  'indefinite',           -- на неопределённый срок (бессрочный)
  'fixed_term',           -- срочный на определённый срок (до 5 лет)
  'fixed_term_work',      -- на время выполнения определённой работы
  'fixed_term_replacement', -- на время исполнения обязанностей временно отсутствующего
  'seasonal',             -- на время сезонных работ
  'contract'              -- контракт (срочный 1–5 лет, письменная форма, Декрет № 29 и др.)
);

ALTER TABLE contracts
  ADD COLUMN contract_term_kind contract_term_kind NOT NULL DEFAULT 'indefinite';

COMMENT ON COLUMN contracts.contract_term_kind IS 'Вид по сроку/основанию: indefinite, fixed_term, fixed_term_work, fixed_term_replacement, seasonal, contract (ТК РБ)';
