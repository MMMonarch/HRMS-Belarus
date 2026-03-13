# Проверка состояния всех сервисов HRMS Belarus
# Запуск из корня проекта: .\setup\05-healthcheck.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
    $root = (Get-Location).Path
}

$EnvPath = Join-Path $root "docker\supabase-repo\docker\.env"

Write-Host "`n=== HRMS Belarus: проверка состояния сервисов ===`n" -ForegroundColor Cyan

$allOk = $true

# --- Вспомогательная функция: проверка состояния контейнера Docker ---
function Test-Container($name) {
    $status = docker inspect --format "{{.State.Status}}" $name 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!!] $name : контейнер не найден" -ForegroundColor Red
        $script:allOk = $false
        return
    }

    $health = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}" $name 2>&1
    if ($status -eq "running" -and ($health -eq "healthy" -or $health -eq "no-healthcheck")) {
        Write-Host "[OK] $name : запущен ($health)" -ForegroundColor Green
    } else {
        Write-Host "[!!] $name : $status ($health)" -ForegroundColor Red
        $script:allOk = $false
    }
}

# --- Вспомогательная функция: проверка HTTP-адреса ---
function Test-Http($name, $url) {
    try {
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Host "[OK] $name : $url (HTTP $($resp.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "[!!] $name : $url - недоступен" -ForegroundColor Red
        $script:allOk = $false
    }
}

# --- Основные контейнеры ---
Write-Host "Контейнеры Docker:" -ForegroundColor Yellow
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

# hrms-web может быть не собран в контейнере
$webStatus = docker inspect --format "{{.State.Status}}" "hrms-web" 2>&1
if ($LASTEXITCODE -eq 0) {
    Test-Container "hrms-web"
} else {
    Write-Host "[--] hrms-web : контейнер не найден (возможно, приложение запущено локально через npm run dev)" -ForegroundColor Yellow
}

# --- Проверка Postgres через pg_isready ---
Write-Host "`nПроверка подключения к Postgres:" -ForegroundColor Yellow
$pgReady = docker exec supabase-db pg_isready -U postgres -h localhost 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] supabase-db : pg_isready выполнен успешно" -ForegroundColor Green
} else {
    Write-Host "[!!] supabase-db : pg_isready завершился с ошибкой" -ForegroundColor Red
    $allOk = $false
}

# --- Подсчёт таблиц в схеме public ---
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
        Write-Host "[OK] Количество таблиц в схеме public: $($tableCount.Trim())" -ForegroundColor Green
    }
}

# --- Проверка HTTP-адресов ---
Write-Host "`nПроверка HTTP-адресов:" -ForegroundColor Yellow
Test-Http "Supabase API (Kong)" "http://localhost:8000"
Test-Http "n8n"                 "http://localhost:5678"
Test-Http "hrms-web"            "http://localhost:3000"

# --- Итог ---
Write-Host ""
if ($allOk) {
    Write-Host "Все проверки пройдены. Система готова к работе." -ForegroundColor Green
} else {
    Write-Host "Некоторые проверки не пройдены. Просмотрите сообщения выше." -ForegroundColor Red
    Read-Host "Нажмите Enter, чтобы закрыть окно"
    exit 1
}

Read-Host "Нажмите Enter, чтобы закрыть окно"