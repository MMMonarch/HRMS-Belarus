# Запуск всего стека HRMS Belarus в правильном порядке.
# Запускать из корня проекта: .\docker\up-all.ps1
# Требуется: Docker, папка docker/supabase-repo и docker/supabase-repo/docker/.env

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $ProjectRoot "docker-compose.yml"))) {
    $ProjectRoot = (Get-Location).Path
}
Set-Location $ProjectRoot

$NetworkName = "hrms-belarus-network"
$SupabaseEnv = "docker/supabase-repo/docker/.env"
$SupabaseCompose = "docker/supabase-repo/docker/docker-compose.yml"
$OverrideCompose = "docker/docker-compose.supabase-network.yml"

Write-Host "`n=== HRMS Belarus: запуск стека ===`n" -ForegroundColor Cyan

# 1. Создать общую сеть (если нет)
$net = docker network inspect $NetworkName 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[1/3] Создаю сеть $NetworkName ..." -ForegroundColor Yellow
    docker network create $NetworkName
    if ($LASTEXITCODE -ne 0) { throw "Не удалось создать сеть" }
} else {
    Write-Host "[1/3] Сеть $NetworkName уже есть." -ForegroundColor Green
}

# 2. Запустить основной compose (hrms-web, n8n, n8n-db)
Write-Host "`n[2/3] Запуск hrms-web, n8n, n8n-db ..." -ForegroundColor Yellow
docker compose up -d -build
if ($LASTEXITCODE -ne 0) { throw "Ошибка docker compose up -d" }
Write-Host "OK." -ForegroundColor Green

# 3. Запустить Supabase в той же сети (если есть репозиторий и .env)
if (-not (Test-Path $SupabaseCompose)) {
    Write-Host "`n[3/3] Supabase не найден (нет $SupabaseCompose). Пропуск." -ForegroundColor Yellow
    Write-Host "      Клонируйте: git clone --depth 1 https://github.com/supabase/supabase.git docker/supabase-repo" -ForegroundColor Gray
    Write-Host "      Затем создайте .env и снова запустите этот скрипт.`n" -ForegroundColor Gray
    exit 0
}
if (-not (Test-Path $SupabaseEnv)) {
    Write-Host "`n[3/3] Файл $SupabaseEnv не найден. Копирую из .env.example ..." -ForegroundColor Yellow
    Copy-Item "docker/supabase-repo/docker/.env.example" $SupabaseEnv
    Write-Host "      Отредактируйте $SupabaseEnv (пароли, ключи) и при необходимости перезапустите скрипт.`n" -ForegroundColor Gray
}
Write-Host "`n[3/3] Запуск Supabase в сети $NetworkName ..." -ForegroundColor Yellow
docker compose -f $SupabaseCompose -f $OverrideCompose --env-file $SupabaseEnv up -d
if ($LASTEXITCODE -ne 0) { throw "Ошибка запуска Supabase" }
Write-Host "OK." -ForegroundColor Green

Write-Host "`n=== Готово ===`n" -ForegroundColor Cyan
Write-Host "  Фронт:     http://localhost:3000" -ForegroundColor White
Write-Host "  n8n:       http://localhost:5678" -ForegroundColor White
Write-Host "  Supabase:  http://localhost:8000" -ForegroundColor White
Write-Host "`nВ n8n в учётной записи Supabase укажите Host: http://kong:8000 (см. docker/QUICKSTART.md).`n" -ForegroundColor Gray
