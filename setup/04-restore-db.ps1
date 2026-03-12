# Восстановление БД Supabase из бэкапа (pg_restore).
# Запуск из корня проекта:
#   .\setup\04-restore-db.ps1                                    # последний .dump из backups/
#   .\setup\04-restore-db.ps1 -BackupFile "backups\my.dump"      # конкретный файл

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

Write-Host "`n=== HRMS Belarus: restore database ===`n" -ForegroundColor Cyan

# --- Read POSTGRES_PASSWORD from .env ---
$pgPassword = ""
if (Test-Path $EnvPath) {
    Get-Content $EnvPath -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^\s*POSTGRES_PASSWORD=(.+)$') {
            $pgPassword = $matches[1].Trim().Trim('"').Trim("'")
        }
    }
}
if (-not $pgPassword) {
    Write-Host "[!!] Cannot read POSTGRES_PASSWORD from $EnvPath" -ForegroundColor Red
    exit 1
}

# --- Find backup file ---
if ($BackupFile) {
    if (-not [System.IO.Path]::IsPathRooted($BackupFile)) {
        $BackupFile = Join-Path $root $BackupFile
    }
} else {
    $latest = Get-ChildItem -Path $BackupDir -Filter "*.dump" -File -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending |
              Select-Object -First 1
    if (-not $latest) {
        Write-Host "[!!] No .dump files found in $BackupDir" -ForegroundColor Red
        Write-Host "     Place a backup .dump file in backups/ or specify -BackupFile." -ForegroundColor Yellow
        exit 1
    }
    $BackupFile = $latest.FullName
}

if (-not (Test-Path $BackupFile)) {
    Write-Host "[!!] Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

$fileSize = [math]::Round((Get-Item $BackupFile).Length / 1MB, 2)
Write-Host "Backup file : $BackupFile ($fileSize MB)"
Write-Host "Container   : $ContainerName"
Write-Host "Database    : $DbName"

# --- Check container is running ---
$status = docker inspect --format "{{.State.Status}}" $ContainerName 2>&1
if ($status -ne "running") {
    Write-Host "[!!] Container $ContainerName is not running (status: $status)." -ForegroundColor Red
    Write-Host "     Run .\setup\03-start-stack.ps1 first." -ForegroundColor Yellow
    exit 1
}

# --- Copy dump into container ---
Write-Host "`nCopying backup into container ..." -ForegroundColor Yellow
$containerPath = "/tmp/restore.dump"
docker cp $BackupFile "${ContainerName}:${containerPath}"
if ($LASTEXITCODE -ne 0) { throw "docker cp failed" }

# --- pg_restore ---
Write-Host "Running pg_restore (--clean --if-exists) ..." -ForegroundColor Yellow
docker exec $ContainerName sh -lc "
export PGPASSWORD='$pgPassword'
pg_restore -U $DbUser -d $DbName --clean --if-exists --no-owner --no-privileges $containerPath 2>&1
"
$restoreCode = $LASTEXITCODE

# --- Cleanup ---
docker exec $ContainerName rm -f $containerPath 2>$null | Out-Null

if ($restoreCode -ne 0) {
    Write-Host "`n[!!] pg_restore finished with warnings/errors (exit code $restoreCode)." -ForegroundColor Yellow
    Write-Host "     This is often normal: pg_restore reports errors for objects that" -ForegroundColor Yellow
    Write-Host "     already exist or belong to system schemas (auth, storage, extensions)." -ForegroundColor Yellow
    Write-Host "     Verify manually: docker exec $ContainerName psql -U $DbUser -d $DbName -c '\dt'" -ForegroundColor Yellow
} else {
    Write-Host "`n[OK] Database restored successfully." -ForegroundColor Green
}

# --- Quick verification ---
Write-Host "`nVerification: listing public tables ..." -ForegroundColor Yellow
docker exec -e "PGPASSWORD=$pgPassword" $ContainerName `
    psql -U $DbUser -d $DbName -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

Write-Host "`nDone. Next:" -ForegroundColor Green
Write-Host "  .\setup\05-healthcheck.ps1   # verify all services"
