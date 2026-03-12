-- RLS: глобальный администратор (global_admin) видит и может редактировать все филиалы;
-- остальные роли (branch_admin, hr, viewer) — только данные своего филиала по user_roles.

-- 1. Вспомогательные функции (SECURITY DEFINER, search_path = public)

CREATE OR REPLACE FUNCTION public.current_user_is_global_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'global_admin'
      AND branch_id IS NULL
  );
$$;

COMMENT ON FUNCTION public.current_user_is_global_admin() IS
  'True если текущий пользователь имеет роль global_admin (branch_id IS NULL).';

CREATE OR REPLACE FUNCTION public.current_user_has_branch_access(_branch_id uuid, _allow_roles text[] DEFAULT ARRAY['branch_admin', 'hr', 'viewer'])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_global_admin()
     OR EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid()
         AND branch_id = _branch_id
         AND role = ANY (_allow_roles)
     );
$$;

COMMENT ON FUNCTION public.current_user_has_branch_access(uuid, text[]) IS
  'True если пользователь global_admin или имеет в филиале _branch_id одну из ролей _allow_roles.';

-- 2. Политики для user_roles (нужны первыми, т.к. используются в других политиках через функции)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_select_own"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_roles_all_for_global_admin"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.current_user_is_global_admin())
  WITH CHECK (public.current_user_is_global_admin());

-- 3. profiles: чтение своего или всех для global_admin; изменение своего или всех для global_admin
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own_or_global"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.current_user_is_global_admin());

CREATE POLICY "profiles_update_own_or_global"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.current_user_is_global_admin())
  WITH CHECK (id = auth.uid() OR public.current_user_is_global_admin());

-- 4. Таблицы без branch_id: organizations, branches — чтение для всех с ролью, запись только global_admin
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select_authenticated"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_global_admin()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "organizations_insert_global_admin"
  ON public.organizations FOR INSERT TO authenticated WITH CHECK (public.current_user_is_global_admin());
CREATE POLICY "organizations_update_global_admin"
  ON public.organizations FOR UPDATE TO authenticated USING (public.current_user_is_global_admin()) WITH CHECK (public.current_user_is_global_admin());
CREATE POLICY "organizations_delete_global_admin"
  ON public.organizations FOR DELETE TO authenticated USING (public.current_user_is_global_admin());

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_select_authenticated"
  ON public.branches FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_global_admin()
    OR public.current_user_has_branch_access(id, ARRAY['branch_admin', 'hr', 'viewer'])
  );

CREATE POLICY "branches_insert_global_admin"
  ON public.branches FOR INSERT TO authenticated WITH CHECK (public.current_user_is_global_admin());
CREATE POLICY "branches_update_global_admin"
  ON public.branches FOR UPDATE TO authenticated USING (public.current_user_is_global_admin()) WITH CHECK (public.current_user_is_global_admin());
CREATE POLICY "branches_delete_global_admin"
  ON public.branches FOR DELETE TO authenticated USING (public.current_user_is_global_admin());

-- 5. Справочники без изоляции по филиалу: чтение для всех аутентифицированных
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "countries_select_authenticated"
  ON public.countries FOR SELECT TO authenticated USING (true);

ALTER TABLE public.termination_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "termination_reasons_select_authenticated"
  ON public.termination_reasons FOR SELECT TO authenticated USING (true);

ALTER TABLE public.order_item_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_item_types_select_authenticated"
  ON public.order_item_types FOR SELECT TO authenticated USING (true);

ALTER TABLE public.template_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "template_types_select_authenticated"
  ON public.template_types FOR SELECT TO authenticated USING (true);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_select_authenticated"
  ON public.templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates_insert_global_admin"
  ON public.templates FOR INSERT TO authenticated WITH CHECK (public.current_user_is_global_admin());
CREATE POLICY "templates_update_global_admin"
  ON public.templates FOR UPDATE TO authenticated USING (public.current_user_is_global_admin()) WITH CHECK (public.current_user_is_global_admin());
CREATE POLICY "templates_delete_global_admin"
  ON public.templates FOR DELETE TO authenticated USING (public.current_user_is_global_admin());

-- 6. Таблицы с branch_id: доступ по филиалу; global_admin — ко всем строкам
-- В функциях rls_branch_* параметр задаётся как имя таблицы.параметр при вызове (например departments.branch_id).

CREATE OR REPLACE FUNCTION public.rls_branch_select(branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_has_branch_access(rls_branch_select.branch_id, ARRAY['branch_admin', 'hr', 'viewer']);
$$;

CREATE OR REPLACE FUNCTION public.rls_branch_modify(branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_has_branch_access(rls_branch_modify.branch_id, ARRAY['branch_admin', 'hr']);
$$;

-- departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments_select" ON public.departments FOR SELECT TO authenticated USING (public.rls_branch_select(departments.branch_id));
CREATE POLICY "departments_modify" ON public.departments FOR ALL TO authenticated USING (public.rls_branch_modify(departments.branch_id)) WITH CHECK (public.rls_branch_modify(departments.branch_id));

-- positions
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_select" ON public.positions FOR SELECT TO authenticated USING (public.rls_branch_select(positions.branch_id));
CREATE POLICY "positions_modify" ON public.positions FOR ALL TO authenticated USING (public.rls_branch_modify(positions.branch_id)) WITH CHECK (public.rls_branch_modify(positions.branch_id));

-- order_registers
ALTER TABLE public.order_registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_registers_select" ON public.order_registers FOR SELECT TO authenticated USING (public.rls_branch_select(order_registers.branch_id));
CREATE POLICY "order_registers_modify" ON public.order_registers FOR ALL TO authenticated USING (public.rls_branch_modify(order_registers.branch_id)) WITH CHECK (public.rls_branch_modify(order_registers.branch_id));

-- persons
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "persons_select" ON public.persons FOR SELECT TO authenticated USING (public.rls_branch_select(persons.branch_id));
CREATE POLICY "persons_modify" ON public.persons FOR ALL TO authenticated USING (public.rls_branch_modify(persons.branch_id)) WITH CHECK (public.rls_branch_modify(persons.branch_id));

-- person_documents
ALTER TABLE public.person_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "person_documents_select" ON public.person_documents FOR SELECT TO authenticated USING (public.rls_branch_select(person_documents.branch_id));
CREATE POLICY "person_documents_modify" ON public.person_documents FOR ALL TO authenticated USING (public.rls_branch_modify(person_documents.branch_id)) WITH CHECK (public.rls_branch_modify(person_documents.branch_id));

-- candidates
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_select" ON public.candidates FOR SELECT TO authenticated USING (public.rls_branch_select(candidates.branch_id));
CREATE POLICY "candidates_modify" ON public.candidates FOR ALL TO authenticated USING (public.rls_branch_modify(candidates.branch_id)) WITH CHECK (public.rls_branch_modify(candidates.branch_id));

-- orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated USING (public.rls_branch_select(orders.branch_id));
CREATE POLICY "orders_modify" ON public.orders FOR ALL TO authenticated USING (public.rls_branch_modify(orders.branch_id)) WITH CHECK (public.rls_branch_modify(orders.branch_id));

-- order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated USING (public.rls_branch_select(order_items.branch_id));
CREATE POLICY "order_items_modify" ON public.order_items FOR ALL TO authenticated USING (public.rls_branch_modify(order_items.branch_id)) WITH CHECK (public.rls_branch_modify(order_items.branch_id));

-- employments
ALTER TABLE public.employments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employments_select" ON public.employments FOR SELECT TO authenticated USING (public.rls_branch_select(employments.branch_id));
CREATE POLICY "employments_modify" ON public.employments FOR ALL TO authenticated USING (public.rls_branch_modify(employments.branch_id)) WITH CHECK (public.rls_branch_modify(employments.branch_id));

-- assignments
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments_select" ON public.assignments FOR SELECT TO authenticated USING (public.rls_branch_select(assignments.branch_id));
CREATE POLICY "assignments_modify" ON public.assignments FOR ALL TO authenticated USING (public.rls_branch_modify(assignments.branch_id)) WITH CHECK (public.rls_branch_modify(assignments.branch_id));

-- absence_periods
ALTER TABLE public.absence_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "absence_periods_select" ON public.absence_periods FOR SELECT TO authenticated USING (public.rls_branch_select(absence_periods.branch_id));
CREATE POLICY "absence_periods_modify" ON public.absence_periods FOR ALL TO authenticated USING (public.rls_branch_modify(absence_periods.branch_id)) WITH CHECK (public.rls_branch_modify(absence_periods.branch_id));

-- contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts_select" ON public.contracts FOR SELECT TO authenticated USING (public.rls_branch_select(contracts.branch_id));
CREATE POLICY "contracts_modify" ON public.contracts FOR ALL TO authenticated USING (public.rls_branch_modify(contracts.branch_id)) WITH CHECK (public.rls_branch_modify(contracts.branch_id));

-- contract_amendments
ALTER TABLE public.contract_amendments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contract_amendments_select" ON public.contract_amendments FOR SELECT TO authenticated USING (public.rls_branch_select(contract_amendments.branch_id));
CREATE POLICY "contract_amendments_modify" ON public.contract_amendments FOR ALL TO authenticated USING (public.rls_branch_modify(contract_amendments.branch_id)) WITH CHECK (public.rls_branch_modify(contract_amendments.branch_id));

-- 7. position_categories / position_subcategories — по organization_id (доступ через филиалы организации)
ALTER TABLE public.position_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "position_categories_select"
  ON public.position_categories FOR SELECT TO authenticated
  USING (
    public.current_user_is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.organization_id = position_categories.organization_id
        AND public.current_user_has_branch_access(b.id, ARRAY['branch_admin', 'hr', 'viewer'])
    )
  );
CREATE POLICY "position_categories_modify"
  ON public.position_categories FOR ALL TO authenticated
  USING (
    public.current_user_is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.organization_id = position_categories.organization_id
        AND public.current_user_has_branch_access(b.id, ARRAY['branch_admin', 'hr'])
    )
  )
  WITH CHECK (
    public.current_user_is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.organization_id = position_categories.organization_id
        AND public.current_user_has_branch_access(b.id, ARRAY['branch_admin', 'hr'])
    )
  );

ALTER TABLE public.position_subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "position_subcategories_select"
  ON public.position_subcategories FOR SELECT TO authenticated
  USING (
    public.current_user_is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.organization_id = position_subcategories.organization_id
        AND public.current_user_has_branch_access(b.id, ARRAY['branch_admin', 'hr', 'viewer'])
    )
  );
CREATE POLICY "position_subcategories_modify"
  ON public.position_subcategories FOR ALL TO authenticated
  USING (
    public.current_user_is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.organization_id = position_subcategories.organization_id
        AND public.current_user_has_branch_access(b.id, ARRAY['branch_admin', 'hr'])
    )
  )
  WITH CHECK (
    public.current_user_is_global_admin()
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.organization_id = position_subcategories.organization_id
        AND public.current_user_has_branch_access(b.id, ARRAY['branch_admin', 'hr'])
    )
  );
