# Резервные копии БД HRMS

Дамп создаётся через `pg_dump` по всей БД (все схемы). В файл попадают:

- **Данные** — все таблицы всех схем (`public`, `auth`, `storage` и др.), включая `auth.users`.
- **RLS** — политики безопасности (CREATE POLICY) восстанавливаются вместе с таблицами.
- **Структура** — таблицы, представления, функции, триггеры, индексы.

Роли БД (postgres, anon, service_role и т.д.) в дамп не входят; при восстановлении в тот же контейнер Supabase они уже есть. Владельцы объектов и табличные ACL не сохраняются (`--no-owner`, `--no-acl`); доступ обычно задаётся через RLS.

---

## Создание бэкапа

### Вариант 1: дамп для восстановления через 04-restore-db.ps1 (рекомендуется)

Формат **.dump** (custom format): подходит для `pg_restore` и скрипта восстановления.

Из **корня проекта** (PowerShell):

```powershell
.\scripts\dump-db.ps1
```

Файл: `backups/hrms-supabase-YYYYMMDD-HHmmss.dump`.  
Восстановление: `.\setup\04-restore-db.ps1` (подхватит последний .dump) или `.\setup\04-restore-db.ps1 -BackupFile "backups\имя.dump"`.

### Вариант 2: дамп в виде SQL (.sql)

Из **корня проекта**:

```powershell
.\scripts\backup-db.ps1
```

Файл: `backups/hrms-supabase-YYYYMMDD-HHmmss.sql`. Восстанавливается вручную через `psql -f` (см. раздел ниже).

---

## Восстановление из дампа

### Из файла .dump (скрипт 04-restore-db.ps1)

Убедитесь, что контейнер `supabase-db` запущен. Из корня проекта:

```powershell
.\setup\04-restore-db.ps1
```

Будет использован последний файл `backups/*.dump`. Либо укажите файл явно:

```powershell
.\setup\04-restore-db.ps1 -BackupFile "backups\hrms-supabase-20250101-120000.dump"
```

Скрипт копирует .dump в контейнер и выполняет `pg_restore --clean --if-exists`.

### Из файла .sql (ручное восстановление)

1. Контейнер `supabase-db` должен быть запущен.
2. Восстановление:
   ```powershell
   $env:PGPASSWORD = "ваш_пароль"
   Get-Content backups\hrms-supabase-YYYYMMDD-HHmmss.sql | docker exec -i supabase-db psql -U postgres -d postgres
   ```
   Либо скопировать в контейнер и выполнить:
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
