# Проверка зависимостей для развёртывания HRMS Belarus.
# Запуск: .\setup\01-install-prerequisites.ps1

$ErrorActionPreference = "Stop"
$allOk = $true

function Test-Command($cmd, $name, $installHint) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $ver = & $cmd --version 2>&1 | Select-Object -First 1
        Write-Host "[OK] $name : $ver" -ForegroundColor Green
    } else {
        Write-Host "[!!] $name не найден. Установите: $installHint" -ForegroundColor Red
        $script:allOk = $false
    }
}

Write-Host "`n=== HRMS Belarus: проверка зависимостей ===`n" -ForegroundColor Cyan

Test-Command "git" "Git" "https://git-scm.com/download/win"
Test-Command "docker" "Docker" "https://docs.docker.com/desktop/install/windows-install/"

# Docker Compose v2 (плагин)
if (Get-Command "docker" -ErrorAction SilentlyContinue) {
    $composeVer = docker compose version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Docker Compose : $composeVer" -ForegroundColor Green
    } else {
        Write-Host "[!!] Docker Compose v2 не найден. Обновите Docker Desktop." -ForegroundColor Red
        $allOk = $false
    }

    # Запущен ли Docker daemon?
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!!] Служба Docker не запущена. Запустите Docker Desktop." -ForegroundColor Red
        $allOk = $false
    } else {
        Write-Host "[OK] Служба Docker запущена." -ForegroundColor Green
    }
}

# Необязательно: Node.js (для локальной разработки без Docker)
if (Get-Command "node" -ErrorAction SilentlyContinue) {
    $nodeVer = node --version
    Write-Host "[OK] Node.js : $nodeVer (необязательно, для локальной разработки)" -ForegroundColor Green
} else {
    Write-Host "[--] Node.js не найден (необязательно, нужен только для локальной разработки без Docker)." -ForegroundColor Yellow
}

Write-Host ""
if ($allOk) {
    Write-Host "Все зависимости установлены. Можно продолжать:" -ForegroundColor Green
    Write-Host "  .\setup\02-setup-supabase.ps1"
} else {
    Write-Host "Некоторые зависимости отсутствуют. Установите их и запустите скрипт снова." -ForegroundColor Red
    Read-Host "Нажмите Enter, чтобы закрыть окно"
    exit 1
}

Read-Host "Нажмите Enter, чтобы закрыть окно"