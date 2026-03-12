/**
 * Создание админа через Supabase Auth API (пароль задаёт Supabase — вход гарантированно работает).
 * Запуск из корня hrms-web:
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role> node scripts/seed-admin.mjs
 * Или задайте в .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *   node --env-file=.env.local scripts/seed-admin.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY. Пример:\n" +
      "  SUPABASE_SERVICE_ROLE_KEY=eyJ... NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000 node scripts/seed-admin.mjs"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = "admin@hrms.by";
const ADMIN_PASSWORD = "1234";

async function main() {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const userExists = existing?.users?.find((u) => u.email === ADMIN_EMAIL);

  let userId;
  if (userExists) {
    userId = userExists.id;
    console.log("Пользователь admin@hrms.by уже есть, сбрасываем пароль и обновляем metadata...");
    const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      user_metadata: { role: "admin", full_name: "Администратор" },
    });
    if (updateErr) console.warn("Обновление пароля:", updateErr.message);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { role: "admin", full_name: "Администратор" },
    });
    if (error) {
      console.error("Ошибка создания пользователя:", error.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log("Создан пользователь admin@hrms.by (пароль: 1234)");
  }

  await supabase.from("profiles").upsert(
    { id: userId, full_name: "Администратор", email: ADMIN_EMAIL, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );

  const { data: existingRole } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "global_admin")
    .is("branch_id", null)
    .maybeSingle();

  if (!existingRole) {
    await supabase.from("user_roles").insert({
      user_id: userId,
      role: "global_admin",
      branch_id: null,
    });
    console.log("Добавлена роль global_admin");
  }

  console.log("Готово. Вход: admin@hrms.by / 1234");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
