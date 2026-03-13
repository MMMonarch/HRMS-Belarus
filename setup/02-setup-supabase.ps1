# Клонирование Supabase Docker и создание .env
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

Write-Host "`n=== HRMS Belarus: настройка Supabase ===`n" -ForegroundColor Cyan

# --- Клонирование репозитория ---
if (Test-Path $supabaseDir) {
    Write-Host "[OK] Папка docker/supabase-repo уже существует, клонирование пропущено." -ForegroundColor Green
} else {
    Write-Host "Клонирование репозитория supabase/supabase в docker/supabase-repo ..." -ForegroundColor Yellow
    git clone --depth 1 https://github.com/supabase/supabase.git $supabaseDir
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!!] Не удалось выполнить git clone." -ForegroundColor Red
        Read-Host "Нажмите Enter, чтобы закрыть окно"
        exit 1
    }
    Write-Host "[OK] Репозиторий успешно клонирован." -ForegroundColor Green
}

# --- Создание .env для Supabase ---
if (Test-Path $envFile) {
    Write-Host "[OK] Файл docker/supabase-repo/docker/.env уже существует." -ForegroundColor Green
} elseif (Test-Path $envExample) {
    Copy-Item $envExample $envFile
    Write-Host "[OK] Файл .env создан из .env.example." -ForegroundColor Green
    Write-Host "     Проверьте и при необходимости измените пароли и ключи в файле:" -ForegroundColor Yellow
    Write-Host "     $envFile"
} else {
    Write-Host "[!!] Файл .env.example не найден. Создайте .env вручную в папке:" -ForegroundColor Red
    Write-Host "     $dockerDir"
    Read-Host "Нажмите Enter, чтобы закрыть окно"
    exit 1
}

# --- Создание корневого .env для docker-compose (необязательно) ---
$rootEnv = Join-Path $root ".env"
$rootEnvExample = Join-Path $root "docker\.env.example"

if (-not (Test-Path $rootEnv) -and (Test-Path $rootEnvExample)) {
    Copy-Item $rootEnvExample $rootEnv
    Write-Host "[OK] Корневой файл .env создан из docker/.env.example." -ForegroundColor Green
}

Write-Host "`nГотово. Следующий шаг:" -ForegroundColor Green
Write-Host "  .\setup\03-start-stack.ps1"

Read-Host "Нажмите Enter, чтобы закрыть окно"