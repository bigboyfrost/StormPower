@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  StormPower updater
echo  Opening changelog update screen...
echo.

where node >nul 2>nul || (
  echo ERROR: Node.js not found. Install LTS from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo First run: installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

call npx electron . --update-ui
if errorlevel 1 (
  echo.
  echo Update UI failed. Falling back to console updater...
  node companion\updater.js --apply
  echo.
  echo Re-run start.bat after a successful update.
  pause
)
