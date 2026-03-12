-- RLS: разрешить global_admin добавлять, изменять и удалять типы шаблонов (template_types).
-- Ранее была только политика SELECT; INSERT/UPDATE/DELETE блокировались.

CREATE POLICY "template_types_insert_global_admin"
  ON public.template_types FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_global_admin());

CREATE POLICY "template_types_update_global_admin"
  ON public.template_types FOR UPDATE TO authenticated
  USING (public.current_user_is_global_admin())
  WITH CHECK (public.current_user_is_global_admin());

CREATE POLICY "template_types_delete_global_admin"
  ON public.template_types FOR DELETE TO authenticated
  USING (public.current_user_is_global_admin());
