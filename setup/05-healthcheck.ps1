# Проверка здоровья всех сервисов HRMS Belarus.
# Запуск из корня проекта: .\setup\05-healthcheck.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
    $root = (Get-Location).Path
}

$EnvPath = Join-Path $root "docker\supabase-repo\docker\.env"

Write-Host "`n=== HRMS Belarus: healthcheck ===`n" -ForegroundColor Cyan

$allOk = $true

# --- Helper: check Docker container health ---
function Test-Container($name) {
    $status = docker inspect --format "{{.State.Status}}" $name 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!!] $name : not found" -ForegroundColor Red
        $script:allOk = $false
        return
    }
    $health = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}" $name 2>&1
    if ($status -eq "running" -and ($health -eq "healthy" -or $health -eq "no-healthcheck")) {
        Write-Host "[OK] $name : running ($health)" -ForegroundColor Green
    } else {
        Write-Host "[!!] $name : $status ($health)" -ForegroundColor Red
        $script:allOk = $false
    }
}

# --- Helper: check HTTP endpoint ---
function Test-Http($name, $url) {
    try {
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Host "[OK] $name : $url (HTTP $($resp.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "[!!] $name : $url - not reachable" -ForegroundColor Red
        $script:allOk = $false
    }
}

# --- Core containers ---
Write-Host "Docker containers:" -ForegroundColor Yellow
$containers = @(
    "supabase-db",
    "supabase-kong",
    "supabase-auth",
    "supabase-rest",
    "supabase-storage",
    "supabase-studio",
    "supabase-pooler",
    "supabase-analytics",
    "supabase-vector",
    "hrms-n8n",
    "hrms-n8n-db"
)
foreach ($c in $containers) {
    Test-Container $c
}

# hrms-web may not always be built
$webStatus = docker inspect --format "{{.State.Status}}" "hrms-web" 2>&1
if ($LASTEXITCODE -eq 0) {
    Test-Container "hrms-web"
} else {
    Write-Host "[--] hrms-web : container not found (may run locally via npm run dev)" -ForegroundColor Yellow
}

# --- pg_isready ---
Write-Host "`nPostgres connectivity:" -ForegroundColor Yellow
$pgReady = docker exec supabase-db pg_isready -U postgres -h localhost 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] supabase-db : pg_isready OK" -ForegroundColor Green
} else {
    Write-Host "[!!] supabase-db : pg_isready FAILED" -ForegroundColor Red
    $allOk = $false
}

# --- Table count in public schema ---
$pgPassword = ""
if (Test-Path $EnvPath) {
    Get-Content $EnvPath -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^\s*POSTGRES_PASSWORD=(.+)$') {
            $pgPassword = $matches[1].Trim().Trim('"').Trim("'")
        }
    }
}
if ($pgPassword) {
    $tableCount = docker exec -e "PGPASSWORD=$pgPassword" supabase-db `
        psql -U postgres -d postgres -t -A -c `
        "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Public tables count: $($tableCount.Trim())" -ForegroundColor Green
    }
}

# --- HTTP endpoints ---
Write-Host "`nHTTP endpoints:" -ForegroundColor Yellow
Test-Http "Supabase API (Kong)" "http://localhost:8000"
Test-Http "n8n"                 "http://localhost:5678"
Test-Http "hrms-web"            "http://localhost:3000"

# --- Summary ---
Write-Host ""
if ($allOk) {
    Write-Host "All checks passed. System is ready." -ForegroundColor Green
} else {
    Write-Host "Some checks failed. Review the output above." -ForegroundColor Red
    exit 1
}
