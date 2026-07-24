@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  ============================================
echo   StormPower  ·  Aimless Developement
echo   Friend install / first-time setup
echo  ============================================
echo.

where node >nul 2>nul || (
  echo  ERROR: Node.js is required.
  echo  Download LTS from https://nodejs.org/  then run this again.
  echo.
  start https://nodejs.org/
  pause
  exit /b 1
)

echo  [1/3] Installing companion dependencies...
call npm install
if errorlevel 1 (
  echo  npm install failed. Check your internet connection.
  pause
  exit /b 1
)

echo.
echo  [2/3] Installing Stormworks addon...
set "DEST=%APPDATA%\Stormworks\data\missions\StormPower"
if not exist "%APPDATA%\Stormworks\data\missions" mkdir "%APPDATA%\Stormworks\data\missions"
if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%~dp0addon\playlist.xml" "%DEST%\playlist.xml" >nul
copy /Y "%~dp0addon\script.lua" "%DEST%\script.lua" >nul
echo       %DEST%

echo.
echo  [3/3] Ready.
echo.
echo  NEXT STEPS:
echo    1. Run start.bat
echo    2. In Stormworks: enable addon "StormPower" on your save
echo    3. Reload the save / ?reload_scripts
echo    4. Click the floating SP button
echo.
echo  Later updates: run update.bat  (repo is preconfigured)
echo.
pause
