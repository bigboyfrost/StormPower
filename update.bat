@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  StormPower updater
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

REM Finish any update that was staged while the app was open (file locks)
if exist "_update_ready.json" (
  echo  Finishing pending update...
  node companion\finish-update.js --no-relaunch
  echo.
)

echo  Opening changelog update screen...
call npx electron . --update-ui
if errorlevel 1 (
  echo.
  echo Update UI failed. Trying console updater...
  node companion\updater.js --apply
  if exist "_update_ready.json" node companion\finish-update.js --no-relaunch
  echo.
  echo Done. Run start.bat
  pause
)
