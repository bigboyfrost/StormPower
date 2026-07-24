@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  StormPower  ·  Aimless Developement
echo  ----------------------------------
echo  F4 toggles menu without tabbing out of Stormworks.
echo  Arrow keys work while the game keeps focus.
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

REM Apply staged update before launching (Electron locks files while running)
if exist "_update_ready.json" (
  echo  Finishing pending update...
  node companion\finish-update.js --no-relaunch
  echo.
)

REM Keep Stormworks addon in sync
set "DEST=%APPDATA%\Stormworks\data\missions\StormPower"
if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%~dp0addon\playlist.xml" "%DEST%\playlist.xml" >nul
copy /Y "%~dp0addon\script.lua" "%DEST%\script.lua" >nul

call npm start
pause
