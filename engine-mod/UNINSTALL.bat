@echo off
cd /d "%~dp0"
echo Restoring stock Stormworks ocean files...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-engine-mod.ps1"
pause
