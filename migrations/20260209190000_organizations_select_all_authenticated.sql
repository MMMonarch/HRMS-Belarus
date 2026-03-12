-- Разрешить всем аутентифицированным пользователям читать список организаций
-- (для экрана выбора workspace). Список филиалов по-прежнему ограничен RLS по branches.

DROP POLICY IF EXISTS "organizations_select_authenticated" ON public.organizations;

CREATE POLICY "organizations_select_authenticated"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (true);
