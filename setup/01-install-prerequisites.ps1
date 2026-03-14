# Check prerequisites for HRMS Belarus deployment.
# Run: .\setup\01-install-prerequisites.ps1

$ErrorActionPreference = "Stop"
$allOk = $true

function Test-Command($cmd, $name, $installHint) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $ver = & $cmd --version 2>&1 | Select-Object -First 1
        Write-Host "[OK] $name : $ver" -ForegroundColor Green
    } else {
        Write-Host "[!!] $name not found. Install it from: $installHint" -ForegroundColor Red
        $script:allOk = $false
    }
}

Write-Host "`n=== HRMS Belarus: prerequisite check ===`n" -ForegroundColor Cyan

Test-Command "git" "Git" "https://git-scm.com/download/win"
Test-Command "docker" "Docker" "https://docs.docker.com/desktop/install/windows-install/"

# Docker Compose v2 (plugin)
if (Get-Command "docker" -ErrorAction SilentlyContinue) {
    $composeVer = docker compose version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Docker Compose : $composeVer" -ForegroundColor Green
    } else {
        Write-Host "[!!] Docker Compose v2 not found. Please update Docker Desktop." -ForegroundColor Red
        $allOk = $false
    }

    # Check whether Docker daemon is running
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!!] Docker service is not running. Please start Docker Desktop." -ForegroundColor Red
        $allOk = $false
    } else {
        Write-Host "[OK] Docker service is running." -ForegroundColor Green
    }
}

# Optional: Node.js (for local development without Docker)
if (Get-Command "node" -ErrorAction SilentlyContinue) {
    $nodeVer = node --version
    Write-Host "[OK] Node.js : $nodeVer (optional, for local development)" -ForegroundColor Green
} else {
    Write-Host "[--] Node.js not found (optional, only needed for local development without Docker)." -ForegroundColor Yellow
}

Write-Host ""
if ($allOk) {
    Write-Host "All prerequisites are installed. You can continue:" -ForegroundColor Green
    Write-Host "  .\setup\02-setup-supabase.ps1"
} else {
    Write-Host "Some prerequisites are missing. Install them and run the script again." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Read-Host "Press Enter to close"