# Клонирование Supabase Docker и создание .env.
# Запуск из корня проекта: .\setup\02-setup-supabase.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
    $root = (Get-Location).Path
}

$supabaseDir = Join-Path $root "docker\supabase-repo"
$dockerDir   = Join-Path $supabaseDir "docker"
$envExample  = Join-Path $dockerDir ".env.example"
$envFile     = Join-Path $dockerDir ".env"

Write-Host "`n=== HRMS Belarus: setup Supabase ===`n" -ForegroundColor Cyan

# --- Clone ---
if (Test-Path $supabaseDir) {
    Write-Host "[OK] docker/supabase-repo already exists, skipping clone." -ForegroundColor Green
} else {
    Write-Host "Cloning supabase/supabase into docker/supabase-repo ..." -ForegroundColor Yellow
    git clone --depth 1 https://github.com/supabase/supabase.git $supabaseDir
    if ($LASTEXITCODE -ne 0) {
        Write-Host "git clone failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Cloned." -ForegroundColor Green
}

# --- .env ---
if (Test-Path $envFile) {
    Write-Host "[OK] docker/supabase-repo/docker/.env already exists." -ForegroundColor Green
} elseif (Test-Path $envExample) {
    Copy-Item $envExample $envFile
    Write-Host "[OK] Created .env from .env.example." -ForegroundColor Green
    Write-Host "     Review and edit passwords/keys in:" -ForegroundColor Yellow
    Write-Host "     $envFile"
} else {
    Write-Host "[!!] .env.example not found. Create .env manually in:" -ForegroundColor Red
    Write-Host "     $dockerDir"
    exit 1
}

# --- .env for root docker-compose (optional) ---
$rootEnv = Join-Path $root ".env"
$rootEnvExample = Join-Path $root "docker\.env.example"
if (-not (Test-Path $rootEnv) -and (Test-Path $rootEnvExample)) {
    Copy-Item $rootEnvExample $rootEnv
    Write-Host "[OK] Created root .env from docker/.env.example" -ForegroundColor Green
}

Write-Host "`nDone. Next:" -ForegroundColor Green
Write-Host "  .\setup\03-start-stack.ps1"
