# Builds and restarts the Connect 4 Docker stack with the latest changes.
# Usage:
#   .\build.ps1            # Rebuild all images and start (detached)
#   .\build.ps1 -Frontend  # Rebuild only the frontend image
#   .\build.ps1 -Backend   # Rebuild only the backend image

param(
    [switch]$Frontend,
    [switch]$Backend,
    [switch]$NoDetach
)

$compose = "docker-compose"
if ($null -eq (Get-Command $compose -ErrorAction SilentlyContinue)) {
    $compose = "docker compose"
}

if ($Frontend) {
    Write-Host "Rebuilding frontend image..." -ForegroundColor Cyan
    & $compose build frontend
} elseif ($Backend) {
    Write-Host "Rebuilding backend image..." -ForegroundColor Cyan
    & $compose build backend
} else {
    Write-Host "Rebuilding all images..." -ForegroundColor Cyan
    & $compose build
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed."
    exit $LASTEXITCODE
}

Write-Host "Recreating containers..." -ForegroundColor Cyan
if ($NoDetach) {
    & $compose up
} else {
    & $compose up -d
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "Done. Frontend is at http://localhost:3000" -ForegroundColor Green
}
