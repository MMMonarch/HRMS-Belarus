-- Создание пользователя-админа для входа в HRMS.
-- Выполните в Supabase Studio → SQL Editor (локальный или облачный проект).
-- Логин: admin@hrms.by, пароль: 1234.
-- Повторный запуск безопасен: если пользователь уже есть, вставка пропускается.

DO $$
DECLARE
  admin_id uuid;
  pwd_hash text;
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM auth.users WHERE email = 'admin@hrms.by' LIMIT 1;
  IF existing_id IS NOT NULL THEN
    RAISE NOTICE 'Пользователь admin@hrms.by уже существует (id: %). Обновляем user_metadata.', existing_id;
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"admin","full_name":"Администратор"}'::jsonb
    WHERE id = existing_id;
    INSERT INTO public.profiles (id, full_name, email, created_at, updated_at)
    VALUES (existing_id, 'Администратор', 'admin@hrms.by', now(), now())
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, updated_at = now();
    INSERT INTO public.user_roles (id, user_id, role, branch_id, created_at)
    SELECT gen_random_uuid(), existing_id, 'global_admin', NULL, now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = existing_id AND role = 'global_admin' AND branch_id IS NULL
    );
    RETURN;
  END IF;

  admin_id := gen_random_uuid();
  pwd_hash := extensions.crypt('1234', extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
  ) VALUES (
    admin_id, NULL, 'authenticated', 'authenticated', 'admin@hrms.by', pwd_hash,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"admin","full_name":"Администратор"}'::jsonb,
    false, false
  );

  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
  VALUES (
    gen_random_uuid(), admin_id::text, admin_id,
    jsonb_build_object('email', 'admin@hrms.by', 'sub', admin_id::text),
    'email', now(), now()
  );

  INSERT INTO public.profiles (id, full_name, email, created_at, updated_at)
  VALUES (admin_id, 'Администратор', 'admin@hrms.by', now(), now());

  INSERT INTO public.user_roles (id, user_id, role, branch_id, created_at)
  VALUES (gen_random_uuid(), admin_id, 'global_admin', NULL, now());

  RAISE NOTICE 'Создан пользователь admin@hrms.by (пароль: 1234).';
END $$;
