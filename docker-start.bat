@echo off
REM BC.Game Auto-Stake Docker Startup Script for Windows Command Prompt

setlocal enabledelayedexpansion

set "APP_TIMEZONE=America/New_York"

if exist ".env" (
    for /f "tokens=2 delims==" %%i in ('findstr "^APP_TIMEZONE=" ".env"') do (
        set "APP_TIMEZONE=%%i"
    )
)

echo.
echo 🕐 Using timezone: !APP_TIMEZONE!
echo.

docker compose --env-file NUL up --build
