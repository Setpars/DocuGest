# Initialise Git dans CE dossier uniquement et prépare le premier commit.
# Usage : .\scripts\init-github-repo.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Dossier du dépôt : $Root" -ForegroundColor Cyan

$parentGit = git -C $Root rev-parse --show-toplevel 2>$null
if ($parentGit -and $parentGit -ne $Root) {
  Write-Warning "Attention : un dépôt Git parent existe ($parentGit). Ce script crée un dépôt isolé dans le projet."
}

if (Test-Path (Join-Path $Root ".git")) {
  Write-Host "Dépôt .git déjà présent dans le projet." -ForegroundColor Yellow
} else {
  git init -b main
  Write-Host "git init -b main OK" -ForegroundColor Green
}

git add .
$status = git status --short
if ($status -match '\.env\.local') {
  Write-Error "ERREUR : .env.local est sur le point d'être commité. Vérifiez .gitignore."
}

$count = (git status --short | Measure-Object -Line).Lines
if ($count -eq 0) {
  Write-Host "Rien à committer." -ForegroundColor Yellow
  exit 0
}

Write-Host "`nFichiers à committer ($count lignes) :" -ForegroundColor Cyan
git status --short | Select-Object -First 30
if ($count -gt 30) { Write-Host "…" }

git commit -m "Initial commit — DocuGest (Fantastic-admin example)"

Write-Host "`nProchaine étape — créer le dépôt sur GitHub puis :" -ForegroundColor Green
Write-Host '  git remote add origin https://github.com/VOTRE_COMPTE/docugest.git'
Write-Host '  git push -u origin main'
Write-Host "`nVoir GITHUB.md pour le détail." -ForegroundColor Gray
