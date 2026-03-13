# Восстановление базы данных Supabase из резервной копии (pg_restore)
# Запуск из корня проекта:
#   .\setup\04-restore-db.ps1                               # использовать последний .dump из backups/
#   .\setup\04-restore-db.ps1 -BackupFile "backups\my.dump" # использовать конкретный файл

param(
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
    $root = (Get-Location).Path
}

$ContainerName = "supabase-db"
$DbUser        = "postgres"
$DbName        = "postgres"
$EnvPath       = Join-Path $root "docker\supabase-repo\docker\.env"
$BackupDir     = Join-Path $root "backups"

Write-Host "`n=== HRMS Belarus: восстановление базы данных ===`n" -ForegroundColor Cyan

# --- Чтение POSTGRES_PASSWORD из .env ---
$pgPassword = ""
if (Test-Path $EnvPath) {
    Get-Content $EnvPath -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^\s*POSTGRES_PASSWORD=(.+)$') {
            $pgPassword = $matches[1].Trim().Trim('"').Trim("'")
        }
    }
}

if (-not $pgPassword) {
    Write-Host "[!!] Не удалось прочитать POSTGRES_PASSWORD из файла: $EnvPath" -ForegroundColor Red
    Read-Host "Нажмите Enter, чтобы закрыть окно"
    exit 1
}

# --- Поиск файла резервной копии ---
if ($BackupFile) {
    if (-not [System.IO.Path]::IsPathRooted($BackupFile)) {
        $BackupFile = Join-Path $root $BackupFile
    }
} else {
    $latest = Get-ChildItem -Path $BackupDir -Filter "*.dump" -File -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending |
              Select-Object -First 1

    if (-not $latest) {
        Write-Host "[!!] В папке $BackupDir не найдено ни одного файла .dump" -ForegroundColor Red
        Write-Host "     Поместите файл резервной копии .dump в папку backups/ или укажите параметр -BackupFile." -ForegroundColor Yellow
        Read-Host "Нажмите Enter, чтобы закрыть окно"
        exit 1
    }

    $BackupFile = $latest.FullName
}

if (-not (Test-Path $BackupFile)) {
    Write-Host "[!!] Файл резервной копии не найден: $BackupFile" -ForegroundColor Red
    Read-Host "Нажмите Enter, чтобы закрыть окно"
    exit 1
}

$fileSize = [math]::Round((Get-Item $BackupFile).Length / 1MB, 2)
Write-Host "Файл резервной копии : $BackupFile ($fileSize MB)"
Write-Host "Контейнер            : $ContainerName"
Write-Host "База данных          : $DbName"

# --- Проверка, что контейнер запущен ---
$status = docker inspect --format "{{.State.Status}}" $ContainerName 2>&1
if ($status -ne "running") {
    Write-Host "[!!] Контейнер $ContainerName не запущен (статус: $status)." -ForegroundColor Red
    Write-Host "     Сначала запустите .\setup\03-start-stack.ps1" -ForegroundColor Yellow
    Read-Host "Нажмите Enter, чтобы закрыть окно"
    exit 1
}

# --- Копирование дампа в контейнер ---
Write-Host "`nКопирование резервной копии в контейнер ..." -ForegroundColor Yellow
$containerPath = "/tmp/restore.dump"
docker cp $BackupFile "${ContainerName}:${containerPath}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!!] Не удалось скопировать файл в контейнер." -ForegroundColor Red
    Read-Host "Нажмите Enter, чтобы закрыть окно"
    exit 1
}

# --- Восстановление через pg_restore ---
Write-Host "Запуск pg_restore (--clean --if-exists) ..." -ForegroundColor Yellow
docker exec $ContainerName sh -lc "
export PGPASSWORD='$pgPassword'
pg_restore -U $DbUser -d $DbName --clean --if-exists --no-owner --no-privileges $containerPath 2>&1
"
$restoreCode = $LASTEXITCODE

# --- Очистка временного файла ---
docker exec $ContainerName rm -f $containerPath 2>$null | Out-Null

if ($restoreCode -ne 0) {
    Write-Host "`n[!!] pg_restore завершился с предупреждениями или ошибками (код выхода $restoreCode)." -ForegroundColor Yellow
    Write-Host "     Это часто бывает нормально: pg_restore может сообщать об ошибках для объектов," -ForegroundColor Yellow
    Write-Host "     которые уже существуют или относятся к системным схемам (auth, storage, extensions)." -ForegroundColor Yellow
    Write-Host "     Проверьте вручную командой: docker exec $ContainerName psql -U $DbUser -d $DbName -c '\dt'" -ForegroundColor Yellow
} else {
    Write-Host "`n[OK] База данных успешно восстановлена." -ForegroundColor Green
}

# --- Быстрая проверка ---
Write-Host "`nПроверка: вывод списка таблиц в схеме public ..." -ForegroundColor Yellow
docker exec -e "PGPASSWORD=$pgPassword" $ContainerName `
    psql -U $DbUser -d $DbName -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

Write-Host "`nГотово. Следующий шаг:" -ForegroundColor Green
Write-Host "  .\setup\05-healthcheck.ps1   # проверка всех сервисов"

Read-Host "Нажмите Enter, чтобы закрыть окно"