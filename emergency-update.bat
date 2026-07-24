@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  StormPower emergency updater
echo  Downloads the latest release zip from GitHub (bypasses broken updater).
echo.

where powershell >nul 2>nul || (
  echo PowerShell required.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0emergency-update.ps1"
if errorlevel 1 (
  echo.
  echo Emergency update failed. Download manually:
  echo   https://github.com/bigboyfrost/StormPower/releases/latest
  pause
  exit /b 1
)

echo.
echo Done. Run start.bat
pause
