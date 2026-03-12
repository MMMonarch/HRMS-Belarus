-- templates: привязка к филиалу (branch_id). Шаблоны становятся общими на филиал, не на всю систему.

-- 1. Колонка branch_id
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

-- 2. Заполнить существующие строки: привязать к первому филиалу (по id)
UPDATE public.templates
SET branch_id = (SELECT id FROM public.branches ORDER BY id LIMIT 1)
WHERE branch_id IS NULL;

-- 3. NOT NULL и уникальность по (branch_id, id)
ALTER TABLE public.templates
  ALTER COLUMN branch_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS templates_branch_id_id_key
  ON public.templates (branch_id, id);

COMMENT ON COLUMN public.templates.branch_id IS 'Филиал: шаблоны общие на филиал.';

-- 4. RLS: убрать глобальные политики, включить доступ по филиалу
DROP POLICY IF EXISTS "templates_select_authenticated" ON public.templates;
DROP POLICY IF EXISTS "templates_insert_global_admin" ON public.templates;
DROP POLICY IF EXISTS "templates_update_global_admin" ON public.templates;
DROP POLICY IF EXISTS "templates_delete_global_admin" ON public.templates;

CREATE POLICY "templates_select"
  ON public.templates FOR SELECT TO authenticated
  USING (public.rls_branch_select(templates.branch_id));

CREATE POLICY "templates_modify"
  ON public.templates FOR ALL TO authenticated
  USING (public.rls_branch_modify(templates.branch_id))
  WITH CHECK (public.rls_branch_modify(templates.branch_id));

-- 5. Приказ может ссылаться только на шаблон своего филиала
CREATE OR REPLACE FUNCTION public.templates_check_order_branch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  t_branch_id uuid;
BEGIN
  SELECT branch_id INTO t_branch_id FROM public.templates WHERE id = NEW.template_id;
  IF t_branch_id IS DISTINCT FROM NEW.branch_id THEN
    RAISE EXCEPTION 'template_id must belong to the same branch as the order (branch_id %)', NEW.branch_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_templates_branch_check ON public.orders;
CREATE TRIGGER orders_templates_branch_check
  BEFORE INSERT OR UPDATE OF template_id, branch_id ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.templates_check_order_branch();
