# Запуск Docker-стека HRMS Belarus (n8n + Supabase + фронт).
# Запуск из корня проекта: .\setup\03-start-stack.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
    $root = (Get-Location).Path
}

$supabaseCompose  = Join-Path $root "docker\supabase-repo\docker\docker-compose.yml"
$networkOverride  = Join-Path $root "docker\docker-compose.supabase-network.yml"
$supabaseEnv      = Join-Path $root "docker\supabase-repo\docker\.env"

Write-Host "`n=== HRMS Belarus: start stack ===`n" -ForegroundColor Cyan

# --- Validate files ---
foreach ($f in @($supabaseCompose, $networkOverride, $supabaseEnv)) {
    if (-not (Test-Path $f)) {
        Write-Host "[!!] File not found: $f" -ForegroundColor Red
        Write-Host "     Run .\setup\02-setup-supabase.ps1 first." -ForegroundColor Yellow
        exit 1
    }
}

# --- Step 1: n8n + hrms-web (creates the shared network) ---
Write-Host "[1/3] Starting n8n + hrms-web ..." -ForegroundColor Yellow
Push-Location $root
try {
    docker compose up -d
    if ($LASTEXITCODE -ne 0) { throw "docker compose up failed for n8n stack" }
    Write-Host "[OK] n8n + hrms-web started." -ForegroundColor Green
} finally {
    Pop-Location
}

# --- Step 2: Supabase (same network via override) ---
Write-Host "[2/3] Starting Supabase ..." -ForegroundColor Yellow
docker compose `
    -f $supabaseCompose `
    -f $networkOverride `
    --env-file $supabaseEnv `
    up -d
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed for Supabase stack" }
Write-Host "[OK] Supabase containers started." -ForegroundColor Green

# --- Step 3: Wait for supabase-db to become healthy ---
Write-Host "[3/3] Waiting for supabase-db to become healthy ..." -ForegroundColor Yellow
$maxWait = 120
$elapsed = 0
while ($elapsed -lt $maxWait) {
    $health = docker inspect --format "{{.State.Health.Status}}" supabase-db 2>&1
    if ($health -eq "healthy") {
        Write-Host "[OK] supabase-db is healthy." -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 3
    $elapsed += 3
    Write-Host "     ... waiting ($elapsed s, status: $health)"
}
if ($elapsed -ge $maxWait) {
    Write-Host "[!!] supabase-db did not become healthy within $maxWait s." -ForegroundColor Red
    Write-Host "     Check: docker logs supabase-db" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nStack is running:" -ForegroundColor Green
Write-Host "  hrms-web : http://localhost:3000"
Write-Host "  n8n      : http://localhost:5678"
Write-Host "  Supabase : http://localhost:8000"
Write-Host "`nNext:" -ForegroundColor Green
Write-Host "  .\setup\04-restore-db.ps1   # restore database from backup"
