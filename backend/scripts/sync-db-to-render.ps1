# Sync Postgres data: source (e.g. local) -> target (e.g. Render External DATABASE_URL).
# Run on your PC only. Do not commit secrets.
#
#   $env:SYNC_SOURCE_DATABASE_URL = "postgresql://..."   # local backend/.env DATABASE_URL
#   $env:SYNC_TARGET_DATABASE_URL = "postgresql://..."   # Render PostgreSQL -> External URL
#   cd backend\scripts
#   .\sync-db-to-render.ps1 -Truncate   # optional: wipe target data first
#
# Requires pg_dump and psql in PATH (PostgreSQL installer -> Command Line Tools).

param(
  [switch]$Truncate
)

$ErrorActionPreference = "Stop"

function Get-DatabaseUrlFromEnvFile([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  foreach ($line in Get-Content $path) {
    if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)\s*$') {
      $v = $Matches[1].Trim().Trim('"').Trim("'")
      if ($v) { return $v }
    }
  }
  return $null
}

$backendRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $backendRoot ".env"

$source = $env:SYNC_SOURCE_DATABASE_URL
if (-not $source) { $source = Get-DatabaseUrlFromEnvFile $envFile }

$target = $env:SYNC_TARGET_DATABASE_URL

if (-not $source) {
  Write-Error "Set SYNC_SOURCE_DATABASE_URL or DATABASE_URL in backend/.env"
}
if (-not $target) {
  Write-Error "Set SYNC_TARGET_DATABASE_URL (Render PostgreSQL external connection string)."
}

foreach ($cmd in @("pg_dump", "psql")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Error "Missing '$cmd' in PATH. Install PostgreSQL client tools."
  }
}

if ($Truncate) {
  Write-Host "Truncating target tables..."
  $truncateSql = @"
TRUNCATE TABLE exhibitions RESTART IDENTITY CASCADE;
TRUNCATE TABLE feedback_messages RESTART IDENTITY CASCADE;
"@
  $truncateSql | psql $target -v ON_ERROR_STOP=1
}

$dumpFile = Join-Path ([System.IO.Path]::GetTempPath()) ("museum-audioguide-data-" + [Guid]::NewGuid().ToString("n") + ".sql")
Write-Host "pg_dump (data-only) -> $dumpFile"
try {
  & pg_dump --no-owner --data-only $source -f $dumpFile
  if ($LASTEXITCODE -ne 0) { throw "pg_dump exit $LASTEXITCODE" }

  Write-Host "psql restore to target..."
  & psql $target -v ON_ERROR_STOP=1 -f $dumpFile
  if ($LASTEXITCODE -ne 0) { throw "psql exit $LASTEXITCODE" }

  Write-Host "Done."
}
finally {
  if (Test-Path $dumpFile) { Remove-Item $dumpFile -Force }
}
