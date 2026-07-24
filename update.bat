@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo  StormPower auto-updater
echo.
where node >nul 2>nul || (echo Node.js required. & pause & exit /b 1)
node companion\updater.js --apply
echo.
echo Re-run start.bat after a successful update.
pause
