-- Поле «Тип визы сводного приказа» в приказах: ссылка на шаблон из templates (template_type = визы, например 5).

-- 1. Колонка
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS visa_template_id uuid REFERENCES public.templates(id);

COMMENT ON COLUMN public.orders.visa_template_id IS 'Шаблон виз сводного приказа (templates с template_type = тип «Визы сводного приказа»). NULL — не выбран.';

-- 2. Проверка филиала: visa_template_id должен быть того же филиала, что и приказ
CREATE OR REPLACE FUNCTION public.templates_check_order_branch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  t_branch_id uuid;
BEGIN
  IF NEW.template_id IS NOT NULL THEN
    SELECT branch_id INTO t_branch_id FROM public.templates WHERE id = NEW.template_id;
    IF t_branch_id IS DISTINCT FROM NEW.branch_id THEN
      RAISE EXCEPTION 'template_id must belong to the same branch as the order (branch_id %)', NEW.branch_id;
    END IF;
  END IF;
  IF NEW.visa_template_id IS NOT NULL THEN
    SELECT branch_id INTO t_branch_id FROM public.templates WHERE id = NEW.visa_template_id;
    IF t_branch_id IS DISTINCT FROM NEW.branch_id THEN
      RAISE EXCEPTION 'visa_template_id must belong to the same branch as the order (branch_id %)', NEW.branch_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_templates_branch_check ON public.orders;
CREATE TRIGGER orders_templates_branch_check
  BEFORE INSERT OR UPDATE OF template_id, visa_template_id, branch_id ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.templates_check_order_branch();
