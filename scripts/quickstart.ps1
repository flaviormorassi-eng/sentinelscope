#!/usr/bin/env pwsh
# Quickstart script for SentinelScope on Windows (PowerShell)
# Requirements: Docker Desktop (includes docker compose v2)

$ErrorActionPreference = 'Stop'

function Test-Command {
  param([string]$Name)
  $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command docker)) {
  Write-Error "Docker is required. Please install Docker Desktop: https://docs.docker.com/get-docker/"
}

# Prefer `docker compose` (v2). Fallback to `docker-compose` if needed.
$composeCmd = @('docker','compose')
try {
  $null = & $composeCmd version 2>$null
} catch {
  if (Test-Command docker-compose) {
    $composeCmd = @('docker-compose')
  } else {
    Write-Error "docker compose (v2) or docker-compose is required."
  }
}

# Start stack
& $composeCmd up -d --build

# Wait for app health
$baseUrl = if ($env:PUBLIC_BASE_URL) { $env:PUBLIC_BASE_URL } else { 'http://localhost:3001' }
$healthUrl = "$baseUrl/healthz"

Write-Host "Waiting for app to become healthy at $healthUrl ..."
$healthy = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
    if ($resp.StatusCode -eq 200) { $healthy = $true; break }
  } catch {
    Start-Sleep -Seconds 2
  }
}

if ($healthy) {
  Write-Host "App is healthy."
} else {
  Write-Warning "App did not report healthy in time. You can check logs with: docker compose logs -f app"
}

Write-Host "\nOpen in your browser:"
Write-Host "  App:            $baseUrl/"
Write-Host "  Dev quick-login: $baseUrl/dev/login/demo\n"

# Auto-open quick login in default browser
try { Start-Process "$baseUrl/dev/login/demo" } catch { }

Write-Host "Manage:"
Write-Host "  View logs:   docker compose logs -f app"
Write-Host "  Stop stack:  docker compose down"
