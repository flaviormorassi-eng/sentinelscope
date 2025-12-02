<#
.SYNOPSIS
  Windows PowerShell helper to seed SentinelScope dev data after server is running.
.DESCRIPTION
  Performs user creation/sync, optional admin promotion, JWT mint, and seed endpoint invocation.
.PARAMETER UserId
  User ID to operate on (required).
.PARAMETER Email
  Email for user creation (default: demo@example.com).
.PARAMETER MakeAdmin
  Switch to promote user to admin via dev endpoint.
.PARAMETER MintJwt
  Switch to mint a JWT and display it.
.PARAMETER Seed
  Switch to call the /api/dev/seed endpoint.
.PARAMETER RawCount
  Raw threat events to generate (default: 8).
.PARAMETER BrowsingCount
  Browsing activity entries (default: 10).
.PARAMETER IncludeAlerts
  Include alerts for high/critical threat events.
.PARAMETER IncludeMediumAlerts
  Include medium severity alerts.
.PARAMETER ExcludeSeverities
  Array of severities to exclude from raw event generation (e.g. high,critical).
.PARAMETER SimulateAgingHours
  Backdate generated timestamps randomly within this many past hours.
.PARAMETER OnlyNew
  Skip browsing domains already present for the user.
#>
param(
  [Parameter(Mandatory=$true)][string]$UserId,
  [string]$Email = "demo@example.com",
  [switch]$MakeAdmin,
  [switch]$MintJwt,
  [switch]$Seed,
  [int]$RawCount = 8,
  [int]$BrowsingCount = 10,
  [switch]$IncludeAlerts,
  [switch]$IncludeMediumAlerts,
  [string[]]$ExcludeSeverities = @(),
  [int]$SimulateAgingHours = 0,
  [switch]$OnlyNew
)

function Invoke-JsonPost($Url, $Body, $Headers) {
  $json = ($Body | ConvertTo-Json -Depth 5)
  Invoke-RestMethod -Uri $Url -Method Post -Headers $Headers -ContentType 'application/json' -Body $json
}

Write-Host "[seed] Creating or syncing user $UserId" -ForegroundColor Cyan
Invoke-JsonPost "http://localhost:3001/api/auth/user" @{ id=$UserId; email=$Email } @{}

if ($MakeAdmin) {
  Write-Host "[seed] Promoting user to admin" -ForegroundColor Cyan
  Invoke-RestMethod -Uri "http://localhost:3001/api/dev/make-admin/$UserId" -Method Post -Headers @{ 'x-user-id' = $UserId } | Out-Host
}

$token = $null
if ($MintJwt) {
  Write-Host "[seed] Minting JWT" -ForegroundColor Cyan
  $jwtResp = Invoke-RestMethod -Uri "http://localhost:3001/api/dev/jwt/$UserId" -Method Get
  $token = $jwtResp.token
  Write-Host "[seed] JWT: $token" -ForegroundColor Yellow
}

if ($Seed) {
  Write-Host "[seed] Calling /api/dev/seed" -ForegroundColor Cyan
  $body = @{
    threatRawCount = $RawCount
    browsingCount = $BrowsingCount
    includeAlerts = [bool]$IncludeAlerts
    includeMediumAlerts = [bool]$IncludeMediumAlerts
    excludeSeverities = $ExcludeSeverities
    simulateAgingHours = $SimulateAgingHours
    onlyNew = [bool]$OnlyNew
  }
  $resp = Invoke-JsonPost "http://localhost:3001/api/dev/seed" $body @{ 'x-user-id' = $UserId }
  $resp | Out-Host
}

Write-Host "[seed] Done." -ForegroundColor Green
