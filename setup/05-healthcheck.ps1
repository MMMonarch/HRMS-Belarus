# Check the status of all HRMS Belarus services
# Run from the project root: .\setup\05-healthcheck.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
    $root = (Get-Location).Path
}

$EnvPath = Join-Path $root "docker\supabase-repo\docker\.env"

Write-Host "`n=== HRMS Belarus: service health check ===`n" -ForegroundColor Cyan

$allOk = $true

# --- Helper function: check Docker container status ---
function Test-Container($name) {
    $status = docker inspect --format "{{.State.Status}}" $name 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!!] $name : container not found" -ForegroundColor Red
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

# --- Helper function: check HTTP endpoint ---
function Test-Http($name, $url) {
    try {
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Host "[OK] $name : $url (HTTP $($resp.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "[!!] $name : $url - unavailable" -ForegroundColor Red
        $script:allOk = $false
    }
}

# --- Main containers ---
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

# hrms-web may not be built as a container
$webStatus = docker inspect --format "{{.State.Status}}" "hrms-web" 2>&1
if ($LASTEXITCODE -eq 0) {
    Test-Container "hrms-web"
} else {
    Write-Host "[--] hrms-web : container not found (the app may be running locally via npm run dev)" -ForegroundColor Yellow
}

# --- Check Postgres with pg_isready ---
Write-Host "`nChecking Postgres connectivity:" -ForegroundColor Yellow
$pgReady = docker exec supabase-db pg_isready -U postgres -h localhost 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] supabase-db : pg_isready completed successfully" -ForegroundColor Green
} else {
    Write-Host "[!!] supabase-db : pg_isready failed" -ForegroundColor Red
    $allOk = $false
}

# --- Count tables in public schema ---
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
        Write-Host "[OK] Number of tables in public schema: $($tableCount.Trim())" -ForegroundColor Green
    }
}

# --- Check HTTP endpoints ---
Write-Host "`nChecking HTTP endpoints:" -ForegroundColor Yellow
Test-Http "Supabase API (Kong)" "http://localhost:8000"
Test-Http "n8n"                 "http://localhost:5678"
Test-Http "hrms-web"            "http://localhost:3000"

# --- Summary ---
Write-Host ""
if ($allOk) {
    Write-Host "All checks passed. The system is ready to use." -ForegroundColor Green
} else {
    Write-Host "Some checks failed. Review the messages above." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Read-Host "Press Enter to close"