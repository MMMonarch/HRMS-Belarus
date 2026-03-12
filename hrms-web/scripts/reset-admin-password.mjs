/**
 * Сброс пароля админа через Auth Admin API (для пользователя, созданного через SQL).
 * Запуск: SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000 node scripts/reset-admin-password.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = list?.users?.find((u) => u.email === "admin@hrms.by");
  if (!user) {
    console.error("Пользователь admin@hrms.by не найден. Сначала выполните seed_admin_user_standalone.sql");
    process.exit(1);
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: "1234",
    user_metadata: { role: "admin", full_name: "Администратор" },
  });
  if (error) {
    console.error("Ошибка обновления пароля:", error.message);
    process.exit(1);
  }
  console.log("Пароль сброшен. Вход: admin@hrms.by / 1234");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
