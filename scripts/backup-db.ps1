# Резервная копия БД Supabase (Postgres).
# Запуск из корня проекта:
#   .\scripts\backup-db.ps1
# Пароль берётся из docker/supabase-repo/docker/.env (POSTGRES_PASSWORD) или из переменной $env:POSTGRES_PASSWORD.
# Восстановление: см. backups/README.md

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path $ProjectRoot)) { $ProjectRoot = (Get-Location).Path }

$EnvPath = Join-Path $ProjectRoot "docker\supabase-repo\docker\.env"
$BackupDir = Join-Path $ProjectRoot "backups"
$ContainerName = "supabase-db"
$DbUser = "postgres"
$DbName = "postgres"

# Читаем пароль из .env при необходимости
if (-not $env:PGPASSWORD -and (Test-Path $EnvPath)) {
    Get-Content $EnvPath -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^\s*POSTGRES_PASSWORD=(.+)$') {
            $env:PGPASSWORD = $matches[1].Trim().Trim('"').Trim("'")
        }
        if ($_ -match '^\s*POSTGRES_DB=(.+)$') {
            $DbName = $matches[1].Trim().Trim('"').Trim("'")
        }
    }
}
if ($env:POSTGRES_PASSWORD) { $env:PGPASSWORD = $env:POSTGRES_PASSWORD }
if (-not $env:PGPASSWORD) { $env:PGPASSWORD = "your-super-secret-and-long-postgres-password" }

if (-not $env:PGPASSWORD) {
    Write-Host "Zadajte parol BD: env POSTGRES_PASSWORD ili dobavte POSTGRES_PASSWORD v docker/supabase-repo/docker/.env" -ForegroundColor Yellow
    exit 1
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupFile = Join-Path $BackupDir "hrms-supabase-$Timestamp.sql"

Write-Host "Container: $ContainerName, DB: $DbName"
Write-Host "Backup file: $BackupFile"

$DumpArgs = @(
    "exec", "-e", "PGPASSWORD=$env:PGPASSWORD",
    $ContainerName,
    "pg_dump", "-U", $DbUser, "-d", $DbName,
    "--no-owner", "--no-acl", "-F", "p"
)
& docker $DumpArgs *> $BackupFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "pg_dump failed. Check container supabase-db: docker ps" -ForegroundColor Red
    exit 1
}

$Size = (Get-Item $BackupFile).Length / 1MB
Write-Host "Done. Size: $([math]::Round($Size, 2)) MB" -ForegroundColor Green
Write-Host "Restore: see backups/README.md"
