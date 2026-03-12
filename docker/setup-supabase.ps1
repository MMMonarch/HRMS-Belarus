# Clone Supabase Docker and create .env. Run from project root: .\docker\setup-supabase.ps1
$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $root "docker-compose.yml"))) {
    $root = (Get-Location).Path
}

$supabaseDir = Join-Path (Join-Path $root "docker") "supabase-repo"
$dockerDir = Join-Path $supabaseDir "docker"

if (Test-Path $supabaseDir) {
    Write-Host "Folder docker/supabase-repo already exists."
    exit 0
}

Write-Host "Cloning Supabase..."
git clone --depth 1 https://github.com/supabase/supabase.git $supabaseDir

$envExample = Join-Path $dockerDir ".env.example"
$envFile = Join-Path $dockerDir ".env"
if (Test-Path $envExample) {
    Copy-Item $envExample $envFile
    Write-Host "Created docker/supabase-repo/docker/.env"
}
else {
    Write-Host ".env.example not found. Create .env manually."
}

Write-Host "Done. Next:"
Write-Host "  1) docker compose up -d"
Write-Host "  2) docker compose -f docker/supabase-repo/docker/docker-compose.yml -f docker/docker-compose.supabase-network.yml --env-file docker/supabase-repo/docker/.env up -d"
