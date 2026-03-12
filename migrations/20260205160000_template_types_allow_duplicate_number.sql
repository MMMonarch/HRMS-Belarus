-- Разрешить в template_types несколько записей с одинаковым number (разные наименования типа для одного номера).
-- Например: number=1 — «Шапка сводного приказа», number=1 — «Шаблоны для сводного приказа».
-- В templates.template_type хранится число; при отображении имени типа берётся одна из записей template_types с этим number.

DROP INDEX IF EXISTS template_types_number_key;

-- ----- Откат (выполнять вручную при необходимости) -----
-- Вернуть уникальность по number. Выполнится только если в таблице нет дубликатов number (иначе — ошибка).
-- CREATE UNIQUE INDEX template_types_number_key ON template_types (number);
