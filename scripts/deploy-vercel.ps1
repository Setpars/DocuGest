# Déploiement DocuGest sur Vercel
# 1) Une fois : pnpm exec vercel login
# 2) Puis : pnpm run deploy:vercel
# Option CI : $env:VERCEL_TOKEN = "votre_token"

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$envFile = Join-Path $Root "apps\example\.env.local"
if (-not (Test-Path $envFile)) {
  Write-Error "Créez apps/example/.env.local avec vos clés Firebase (voir .env.example)."
}

# Variables Vite pour le build local (Firebase injecté dans le bundle)
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -match '^\s*#' -or $line -eq '') { return }
  if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
  }
}

Write-Host ">> Build production (apps/example/dist)…" -ForegroundColor Cyan
pnpm run build:example
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$dist = Join-Path $Root "apps\example\dist"
if (-not (Test-Path (Join-Path $dist "index.html"))) {
  Write-Error "Build incomplet : index.html introuvable dans apps/example/dist"
}

Write-Host ">> Envoi sur Vercel (déploiement pré-construit)…" -ForegroundColor Cyan
$args = @("deploy", $dist, "--prod", "--yes", "--archive=tgz")
if ($env:VERCEL_TOKEN) {
  $args += @("--token", $env:VERCEL_TOKEN)
}

pnpm exec vercel @args
