# Резервные копии БД HRMS

Дамп создаётся через `pg_dump` по всей БД (все схемы). В файл попадают:

- **Данные** — все таблицы всех схем (`public`, `auth`, `storage` и др.), включая `auth.users`.
- **RLS** — политики безопасности (CREATE POLICY) восстанавливаются вместе с таблицами.
- **Структура** — таблицы, представления, функции, триггеры, индексы.

Роли БД (postgres, anon, service_role и т.д.) в дамп не входят; при восстановлении в тот же контейнер Supabase они уже есть. Владельцы объектов и табличные ACL не сохраняются (`--no-owner`, `--no-acl`); доступ обычно задаётся через RLS.

---

## Создание бэкапа

Из **корня проекта** (Windows PowerShell):

```powershell
.\scripts\backup-db.ps1
```

Пароль Postgres берётся из `docker/supabase-repo/docker/.env` (переменная `POSTGRES_PASSWORD`) или из переменной окружения `$env:POSTGRES_PASSWORD`.

Файл сохраняется в `backups/hrms-supabase-YYYYMMDD-HHmmss.sql`.

---

## Восстановление из дампа

1. Убедитесь, что контейнер Supabase БД запущен:
   ```powershell
   docker ps
   ```
   Должен быть контейнер `supabase-db`.

2. Восстановить в **существующую** БД (перезаписывает данные):
   ```powershell
   # Задайте пароль и путь к файлу
   $env:PGPASSWORD = "ваш_пароль"
   Get-Content backups\hrms-supabase-YYYYMMDD-HHmmss.sql | docker exec -i supabase-db psql -U postgres -d postgres
   ```

3. Либо скопировать файл в контейнер и выполнить там:
   ```powershell
   docker cp backups\hrms-supabase-YYYYMMDD-HHmmss.sql supabase-db:/tmp/restore.sql
   docker exec -e PGPASSWORD=ваш_пароль supabase-db psql -U postgres -d postgres -f /tmp/restore.sql
   ```

**Внимание:** при восстановлении в ту же БД объекты из дампа будут созданы/обновлены; при конфликтах имён возможны ошибки. Для «чистого» восстановления проще поднять новую БД (новый volume) и загрузить дамп в пустую базу.

---

## Полный сброс и подъём с нуля

1. Остановить Supabase и удалить данные БД (осторожно — данные удалятся):
   ```powershell
   cd docker\supabase-repo\docker
   docker compose down -v
   ```

2. Запустить снова (создаст пустую БД), применить миграции из `migrations/` (через Studio или Supabase CLI).

3. Либо после первого запуска восстановить дамп в пустую БД (см. выше).
