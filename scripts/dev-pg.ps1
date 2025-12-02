<#
.SYNOPSIS
  Windows PowerShell helper to start local Postgres (Docker), apply migrations, and run dev server.
.DESCRIPTION
  Mirrors `npm run dev:pg` / `make pg-dev` for Windows environments.
.PARAMETER NoMigrate
  Skip migrations (useful if already applied).
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/dev-pg.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/dev-pg.ps1 -NoMigrate
#>
param(
  [switch]$NoMigrate
)

Write-Host "[dev-pg] Copying .env.local.postgres to .env" -ForegroundColor Cyan
Copy-Item -Path ".env.local.postgres" -Destination ".env" -Force

Write-Host "[dev-pg] Checking for Docker..." -ForegroundColor Cyan
if (Get-Command docker -ErrorAction SilentlyContinue) {
  Write-Host "[dev-pg] Docker found. Starting containerized Postgres on 5433." -ForegroundColor Green
  docker compose up -d db
  if ($LASTEXITCODE -ne 0) { Write-Error "Failed to start db service"; exit 1 }
  Start-Sleep -Seconds 5
} else {
  Write-Warning "Docker not found. Fallback to native Postgres instructions below." 
  Write-Host "Install Postgres 16 (Chocolatey):" -ForegroundColor Yellow
  Write-Host "  choco install postgresql16" -ForegroundColor DarkYellow
  Write-Host "Or Winget:" -ForegroundColor Yellow
  Write-Host "  winget install PostgreSQL.PostgreSQL" -ForegroundColor DarkYellow
  Write-Host "After install, ensure service running and create DB/user:" -ForegroundColor Yellow
  Write-Host "  createdb sentinelscope" -ForegroundColor DarkYellow
  Write-Host "  psql -d sentinelscope -c 'CREATE USER sentinel WITH PASSWORD \"sentinel\";'" -ForegroundColor DarkYellow
  Write-Host "  psql -d sentinelscope -c 'GRANT ALL PRIVILEGES ON DATABASE sentinelscope TO sentinel;'" -ForegroundColor DarkYellow
  if (-not (Test-Path .env)) { Copy-Item -Path ".env.local.postgres" -Destination ".env" -Force }
  (Get-Content .env) -replace '5433','5432' | Set-Content .env
}

if (-not $NoMigrate) {
  Write-Host "[dev-pg] Running migrations" -ForegroundColor Cyan
  npm run db:migrate
  if ($LASTEXITCODE -ne 0) { Write-Error "Migrations failed"; exit 1 }
} else {
  Write-Host "[dev-pg] Skipping migrations (NoMigrate flag)." -ForegroundColor Yellow
}

Write-Host "[dev-pg] Starting dev server" -ForegroundColor Cyan
npm run dev
