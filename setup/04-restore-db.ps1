# Restore Supabase database from a backup file (pg_restore)
# Run from the project root:
#   .\setup\04-restore-db.ps1                               # use the latest .dump from backups/
#   .\setup\04-restore-db.ps1 -BackupFile "backups\my.dump" # use a specific backup file

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

Write-Host "`n=== HRMS Belarus: database restore ===`n" -ForegroundColor Cyan

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
    Write-Host "[!!] Failed to read POSTGRES_PASSWORD from file: $EnvPath" -ForegroundColor Red
    Read-Host "Press Enter to close"
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
        Write-Host "[!!] No .dump files were found in $BackupDir" -ForegroundColor Red
        Write-Host "     Put a .dump backup file into the backups/ folder or specify -BackupFile." -ForegroundColor Yellow
        Read-Host "Press Enter to close"
        exit 1
    }

    $BackupFile = $latest.FullName
}

if (-not (Test-Path $BackupFile)) {
    Write-Host "[!!] Backup file not found: $BackupFile" -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

$fileSize = [math]::Round((Get-Item $BackupFile).Length / 1MB, 2)
Write-Host "Backup file   : $BackupFile ($fileSize MB)"
Write-Host "Container     : $ContainerName"
Write-Host "Database      : $DbName"

# --- Check that container is running ---
$status = docker inspect --format "{{.State.Status}}" $ContainerName 2>&1
if ($status -ne "running") {
    Write-Host "[!!] Container $ContainerName is not running (status: $status)." -ForegroundColor Red
    Write-Host "     Start it first with .\setup\03-start-stack.ps1" -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
}

# --- Copy backup into container ---
Write-Host "`nCopying backup into container ..." -ForegroundColor Yellow
$containerPath = "/tmp/restore.dump"
docker cp $BackupFile "${ContainerName}:${containerPath}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!!] Failed to copy the backup file into the container." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

# --- Restore with pg_restore ---
Write-Host "Running pg_restore (--clean --if-exists) ..." -ForegroundColor Yellow
docker exec $ContainerName sh -lc "
export PGPASSWORD='$pgPassword'
pg_restore -U $DbUser -d $DbName --clean --if-exists --no-owner --no-privileges $containerPath 2>&1
"
$restoreCode = $LASTEXITCODE

# --- Cleanup temporary file ---
docker exec $ContainerName rm -f $containerPath 2>$null | Out-Null

if ($restoreCode -ne 0) {
    Write-Host "`n[!!] pg_restore finished with warnings or errors (exit code $restoreCode)." -ForegroundColor Yellow
    Write-Host "     This can be normal: pg_restore may report errors for objects" -ForegroundColor Yellow
    Write-Host "     that already exist or belong to system schemas (auth, storage, extensions)." -ForegroundColor Yellow
    Write-Host "     You can verify manually with: docker exec $ContainerName psql -U $DbUser -d $DbName -c '\dt'" -ForegroundColor Yellow
} else {
    Write-Host "`n[OK] Database was restored successfully." -ForegroundColor Green
}

# --- Quick verification ---
Write-Host "`nVerification: listing tables in the public schema ..." -ForegroundColor Yellow
docker exec -e "PGPASSWORD=$pgPassword" $ContainerName `
    psql -U $DbUser -d $DbName -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

Write-Host "`nDone. Next step:" -ForegroundColor Green
Write-Host "  .\setup\05-healthcheck.ps1   # check all services"

Read-Host "Press Enter to close"