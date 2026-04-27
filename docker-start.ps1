# BC.Game Auto-Stake Docker Startup Script for Windows PowerShell

# Read timezone from .env if it exists
$appTimezone = "America/New_York"

if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    $tzLine = $envContent | Select-String "^APP_TIMEZONE="
    if ($tzLine) {
        $appTimezone = $tzLine.ToString().Split("=")[1].Trim()
    }
}

Write-Host "🕐 Using timezone: $appTimezone" -ForegroundColor Cyan

# Start Docker
docker compose --env-file NUL up --build
