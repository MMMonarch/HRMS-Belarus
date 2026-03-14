$ErrorActionPreference = "Stop"

try {
    Clear-Host
    Write-Host ""
    Write-Host "=== HRMS Belarus: Supabase setup ===" -ForegroundColor Cyan
    Write-Host ""

    if (-not $PSScriptRoot) {
        throw "Could not determine script directory."
    }

    $root = Split-Path -Path $PSScriptRoot -Parent

    if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
        $root = (Get-Location).Path
    }

    $dockerRoot     = Join-Path $root "docker"
    $supabaseDir    = Join-Path $root "docker\supabase-repo"
    $dockerDir      = Join-Path $supabaseDir "docker"
    $envExample     = Join-Path $dockerDir ".env.example"
    $envFile        = Join-Path $dockerDir ".env"
    $rootEnv        = Join-Path $root ".env"
    $rootEnvExample = Join-Path $root "docker\.env.example"

    Write-Host "Project root: $root" -ForegroundColor DarkGray

    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if (-not $gitCmd) {
        throw "Git was not found in PATH. Please install Git and run the script again."
    }

    if (-not (Test-Path $dockerRoot)) {
        New-Item -ItemType Directory -Path $dockerRoot -Force | Out-Null
        Write-Host "[OK] Created folder: $dockerRoot" -ForegroundColor Green
    }

    if (Test-Path $supabaseDir) {
        Write-Host "[OK] Folder docker/supabase-repo already exists. Clone skipped." -ForegroundColor Green
    }
    else {
        Write-Host "Cloning supabase/supabase into docker/supabase-repo ..." -ForegroundColor Yellow

        & git clone --depth 1 https://github.com/supabase/supabase.git $supabaseDir

        if ($LASTEXITCODE -ne 0) {
            throw "git clone failed."
        }

        Write-Host "[OK] Repository cloned successfully." -ForegroundColor Green
    }

    if (-not (Test-Path $dockerDir)) {
        throw "Docker folder was not found inside Supabase repo: $dockerDir"
    }

    if (Test-Path $envFile) {
        Write-Host "[OK] File docker/supabase-repo/docker/.env already exists." -ForegroundColor Green
    }
    elseif (Test-Path $envExample) {
        Copy-Item -Path $envExample -Destination $envFile -Force
        Write-Host "[OK] File .env created from .env.example." -ForegroundColor Green
        Write-Host "Check and update passwords/keys if needed:" -ForegroundColor Yellow
        Write-Host $envFile -ForegroundColor Yellow
    }
    else {
        throw ".env.example was not found. Create .env manually in: $dockerDir"
    }

    if ((-not (Test-Path $rootEnv)) -and (Test-Path $rootEnvExample)) {
        Copy-Item -Path $rootEnvExample -Destination $rootEnv -Force
        Write-Host "[OK] Root .env created from docker/.env.example." -ForegroundColor Green
    }
    elseif (Test-Path $rootEnv) {
        Write-Host "[OK] Root .env already exists." -ForegroundColor Green
    }
    else {
        Write-Host "[INFO] docker/.env.example was not found. Root .env was not created." -ForegroundColor DarkYellow
    }

    Write-Host ""
    Write-Host "Done. Next step:" -ForegroundColor Green
    Write-Host ".\setup\03-start-stack.ps1" -ForegroundColor White
}
catch {
    Write-Host ""
    Write-Host "[ERROR] Script failed." -ForegroundColor Red
    Write-Host ("Message: " + $_.Exception.Message) -ForegroundColor Red

    if ($_.InvocationInfo) {
        if ($_.InvocationInfo.ScriptName) {
            Write-Host ("File: " + $_.InvocationInfo.ScriptName) -ForegroundColor Red
        }

        if ($_.InvocationInfo.ScriptLineNumber) {
            Write-Host ("Line: " + $_.InvocationInfo.ScriptLineNumber) -ForegroundColor Red
        }

        if ($_.InvocationInfo.Line) {
            Write-Host ("Command: " + $_.InvocationInfo.Line.Trim()) -ForegroundColor Red
        }
    }
}
finally {
    Write-Host ""
    Read-Host "Press Enter to close"
}