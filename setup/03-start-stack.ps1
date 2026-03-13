# Запуск Docker-стека HRMS Belarus (n8n + Supabase + фронтенд)
# Запуск из корня проекта: .\setup\03-start-stack.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
    $root = (Get-Location).Path
}

$supabaseCompose  = Join-Path $root "docker\supabase-repo\docker\docker-compose.yml"
$networkOverride  = Join-Path $root "docker\docker-compose.supabase-network.yml"
$supabaseEnv      = Join-Path $root "docker\supabase-repo\docker\.env"

Write-Host "`n=== HRMS Belarus: запуск стека ===`n" -ForegroundColor Cyan

# --- Проверка файлов ---
foreach ($f in @($supabaseCompose, $networkOverride, $supabaseEnv)) {
    if (-not (Test-Path $f)) {
        Write-Host "[!!] Файл не найден: $f" -ForegroundColor Red
        Write-Host "     Сначала запустите .\setup\02-setup-supabase.ps1" -ForegroundColor Yellow
        Read-Host "Нажмите Enter, чтобы закрыть окно"
        exit 1
    }
}

# --- Шаг 1: n8n + hrms-web (создаёт общую сеть) ---
Write-Host "[1/3] Запуск n8n + hrms-web ..." -ForegroundColor Yellow
Push-Location $root
try {
    docker compose up -d
    if ($LASTEXITCODE -ne 0) { throw "Не удалось выполнить docker compose up для стека n8n" }
    Write-Host "[OK] n8n и hrms-web успешно запущены." -ForegroundColor Green
} finally {
    Pop-Location
}

# --- Шаг 2: Supabase (в той же сети через override) ---
Write-Host "[2/3] Запуск Supabase ..." -ForegroundColor Yellow
docker compose `
    -f $supabaseCompose `
    -f $networkOverride `
    --env-file $supabaseEnv `
    up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!!] Не удалось выполнить docker compose up для стека Supabase." -ForegroundColor Red
    Read-Host "Нажмите Enter, чтобы закрыть окно"
    exit 1
}
Write-Host "[OK] Контейнеры Supabase успешно запущены." -ForegroundColor Green

# --- Шаг 3: Ожидание готовности supabase-db ---
Write-Host "[3/3] Ожидание, пока supabase-db перейдёт в состояние healthy ..." -ForegroundColor Yellow
$maxWait = 120
$elapsed = 0
while ($elapsed -lt $maxWait) {
    $health = docker inspect --format "{{.State.Health.Status}}" supabase-db 2>&1
    if ($health -eq "healthy") {
        Write-Host "[OK] Контейнер supabase-db готов к работе." -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 3
    $elapsed += 3
    Write-Host "     ... ожидание ($elapsed сек., статус: $health)"
}
if ($elapsed -ge $maxWait) {
    Write-Host "[!!] Контейнер supabase-db не перешёл в состояние healthy за $maxWait сек." -ForegroundColor Red
    Write-Host "     Проверьте логи командой: docker logs supabase-db" -ForegroundColor Yellow
    Read-Host "Нажмите Enter, чтобы закрыть окно"
    exit 1
}

Write-Host "`nСтек запущен:" -ForegroundColor Green
Write-Host "  hrms-web : http://localhost:3000"
Write-Host "  n8n      : http://localhost:5678"
Write-Host "  Supabase : http://localhost:8000"

Write-Host "`nСледующий шаг:" -ForegroundColor Green
Write-Host "  .\setup\04-restore-db.ps1   # восстановление базы данных из резервной копии"

Read-Host "Нажмите Enter, чтобы закрыть окно"