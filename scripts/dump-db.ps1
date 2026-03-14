# Dump Supabase database in custom format (.dump) for restore via setup/04-restore-db.ps1
# Run from project root:
#   .\scripts\dump-db.ps1
#   .\scripts\dump-db.ps1 -OutDir "backups"   # optional: default is backups/
#
# Restore: .\setup\04-restore-db.ps1   # uses latest .dump from backups/
#          .\setup\04-restore-db.ps1 -BackupFile "backups\hrms-supabase-20250101-120000.dump"

param(
    [string]$OutDir = "backups"
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
$BackupDir     = if ([System.IO.Path]::IsPathRooted($OutDir)) { $OutDir } else { Join-Path $root $OutDir }

Write-Host "`n=== HRMS Belarus: database dump (for pg_restore) ===`n" -ForegroundColor Cyan

# --- Read POSTGRES_PASSWORD from .env ---
$pgPassword = ""
if (Test-Path $EnvPath) {
    Get-Content $EnvPath -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^\s*POSTGRES_PASSWORD=(.+)$') {
            $pgPassword = $matches[1].Trim().Trim('"').Trim("'")
        }
        if ($_ -match '^\s*POSTGRES_DB=(.+)$') {
            $DbName = $matches[1].Trim().Trim('"').Trim("'")
        }
    }
}
if ($env:POSTGRES_PASSWORD) { $pgPassword = $env:POSTGRES_PASSWORD }
if (-not $pgPassword) {
    Write-Host "[!!] POSTGRES_PASSWORD not found. Set it in $EnvPath or `$env:POSTGRES_PASSWORD" -ForegroundColor Red
    exit 1
}

# --- Check container ---
$status = docker inspect --format "{{.State.Status}}" $ContainerName 2>&1
if ($status -ne "running") {
    Write-Host "[!!] Container $ContainerName is not running (status: $status). Start Supabase first." -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpFile  = Join-Path $BackupDir "hrms-supabase-$timestamp.dump"

Write-Host "Container   : $ContainerName"
Write-Host "Database    : $DbName"
Write-Host "Output file : $dumpFile"
Write-Host ""

# pg_dump custom format (-Fc) so that pg_restore can use --clean --if-exists
Write-Host "Running pg_dump (custom format) ..." -ForegroundColor Yellow
docker exec -e "PGPASSWORD=$pgPassword" $ContainerName pg_dump -U $DbUser -d $DbName `
    -F c `
    --no-owner `
    --no-privileges `
    -f "/tmp/dump.dump"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[!!] pg_dump failed." -ForegroundColor Red
    exit 1
}

# Copy from container to host
docker cp "${ContainerName}:/tmp/dump.dump" $dumpFile
docker exec $ContainerName rm -f /tmp/dump.dump 2>$null | Out-Null

if (-not (Test-Path $dumpFile)) {
    Write-Host "[!!] Failed to copy dump from container." -ForegroundColor Red
    exit 1
}

$sizeMb = [math]::Round((Get-Item $dumpFile).Length / 1MB, 2)
Write-Host "`n[OK] Dump saved: $dumpFile ($sizeMb MB)" -ForegroundColor Green
Write-Host "Restore: .\setup\04-restore-db.ps1"
Write-Host "        .\setup\04-restore-db.ps1 -BackupFile `"$OutDir\hrms-supabase-$timestamp.dump`""
Write-Host ""
