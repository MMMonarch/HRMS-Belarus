# Проверка зависимостей для развёртывания HRMS Belarus.
# Запуск: .\setup\01-install-prerequisites.ps1

$ErrorActionPreference = "Stop"
$allOk = $true

function Test-Command($cmd, $name, $installHint) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $ver = & $cmd --version 2>&1 | Select-Object -First 1
        Write-Host "[OK] $name : $ver" -ForegroundColor Green
    } else {
        Write-Host "[!!] $name not found. $installHint" -ForegroundColor Red
        $script:allOk = $false
    }
}

Write-Host "`n=== HRMS Belarus: check prerequisites ===`n" -ForegroundColor Cyan

Test-Command "git" "Git" "https://git-scm.com/download/win"
Test-Command "docker" "Docker" "https://docs.docker.com/desktop/install/windows-install/"

# Docker Compose v2 (plugin)
$composeVer = docker compose version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Docker Compose : $composeVer" -ForegroundColor Green
} else {
    Write-Host "[!!] Docker Compose v2 not found. Update Docker Desktop." -ForegroundColor Red
    $allOk = $false
}

# Docker daemon running?
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!!] Docker daemon is not running. Start Docker Desktop." -ForegroundColor Red
    $allOk = $false
} else {
    Write-Host "[OK] Docker daemon is running." -ForegroundColor Green
}

# Optional: Node.js (for local dev without Docker)
if (Get-Command "node" -ErrorAction SilentlyContinue) {
    $nodeVer = node --version
    Write-Host "[OK] Node.js : $nodeVer (optional, for local dev)" -ForegroundColor Green
} else {
    Write-Host "[--] Node.js not found (optional, only needed for local dev without Docker)." -ForegroundColor Yellow
}

Write-Host ""
if ($allOk) {
    Write-Host "All prerequisites met. Proceed with:" -ForegroundColor Green
    Write-Host "  .\setup\02-setup-supabase.ps1"
} else {
    Write-Host "Some prerequisites are missing. Install them and re-run this script." -ForegroundColor Red
    exit 1
}
