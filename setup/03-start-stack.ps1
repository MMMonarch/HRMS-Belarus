# Start the HRMS Belarus Docker stack (n8n + Supabase + frontend)
# Run from the project root: .\setup\03-start-stack.ps1

$ErrorActionPreference = "Stop"

if ($PSScriptRoot) {
    $root = Split-Path $PSScriptRoot -Parent
} else {
    $root = Split-Path (Get-Location).Path -Parent
}
if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
    $root = (Get-Location).Path
}

$supabaseCompose  = Join-Path $root "docker\supabase-repo\docker\docker-compose.yml"
$networkOverride  = Join-Path $root "docker\docker-compose.supabase-network.yml"
$supabaseEnv      = Join-Path $root "docker\supabase-repo\docker\.env"

Write-Host "`n=== HRMS Belarus: starting stack ===`n" -ForegroundColor Cyan

# --- Check required files ---
foreach ($f in @($supabaseCompose, $networkOverride, $supabaseEnv)) {
    if (-not (Test-Path $f)) {
        Write-Host "[!!] File not found: $f" -ForegroundColor Red
        Write-Host "     Run .\setup\02-setup-supabase.ps1 first" -ForegroundColor Yellow
        Read-Host "Press Enter to close"
        exit 1
    }
}

# --- Fix CRLF in pooler.exs (Elixir crashes on \r) ---
$poolerExs = Join-Path $root "docker\supabase-repo\docker\volumes\pooler\pooler.exs"
if (Test-Path $poolerExs) {
    $raw = [System.IO.File]::ReadAllText($poolerExs)
    if ($raw -match "`r") {
        $raw = $raw -replace "`r`n", "`n"
        [System.IO.File]::WriteAllText($poolerExs, $raw, (New-Object System.Text.UTF8Encoding $false))
        Write-Host "[OK] Fixed pooler.exs line endings (CRLF -> LF)." -ForegroundColor Green
    }
}

# --- Ensure the shared Docker network exists ---
$networkName = "hrms-belarus-network"
$existingNet = docker network ls --filter "name=^${networkName}$" --format "{{.Name}}" 2>&1
if ($existingNet -ne $networkName) {
    Write-Host "[*] Creating Docker network: $networkName ..." -ForegroundColor Yellow
    docker network create $networkName
    if ($LASTEXITCODE -ne 0) { throw "Failed to create Docker network $networkName" }
    Write-Host "[OK] Network created." -ForegroundColor Green
} else {
    Write-Host "[OK] Docker network $networkName already exists." -ForegroundColor Green
}

# --- Step 1: n8n + hrms-web (creates the shared network) ---
Write-Host "[1/3] Starting n8n + hrms-web ..." -ForegroundColor Yellow
Push-Location $root
try {
    docker compose up -d
    if ($LASTEXITCODE -ne 0) { throw "Failed to run docker compose up for the n8n stack" }
    Write-Host "[OK] n8n and hrms-web started successfully." -ForegroundColor Green
} finally {
    Pop-Location
}

# --- Step 2: Supabase (in the same network via override) ---
Write-Host "[2/3] Starting Supabase ..." -ForegroundColor Yellow
docker compose `
    -f $supabaseCompose `
    -f $networkOverride `
    --env-file $supabaseEnv `
    up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!!] Failed to run docker compose up for the Supabase stack." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}
Write-Host "[OK] Supabase containers started successfully." -ForegroundColor Green

# --- Step 3: Wait until supabase-db becomes healthy ---
Write-Host "[3/3] Waiting for supabase-db to become healthy ..." -ForegroundColor Yellow
$maxWait = 120
$elapsed = 0
while ($elapsed -lt $maxWait) {
    $health = docker inspect --format "{{.State.Health.Status}}" supabase-db 2>&1
    if ($health -eq "healthy") {
        Write-Host "[OK] Container supabase-db is ready." -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 3
    $elapsed += 3
    Write-Host "     ... waiting ($elapsed sec, status: $health)"
}
if ($elapsed -ge $maxWait) {
    Write-Host "[!!] Container supabase-db did not become healthy within $maxWait seconds." -ForegroundColor Red
    Write-Host "     Check logs with: docker logs supabase-db" -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "`nStack started:" -ForegroundColor Green
Write-Host "  hrms-web : http://localhost:3000"
Write-Host "  n8n      : http://localhost:5678"
Write-Host "  Supabase : http://localhost:8000"

Write-Host "`nNext step:" -ForegroundColor Green
Write-Host "  .\setup\04-restore-db.ps1   # restore the database from a backup"

Read-Host "Press Enter to close"