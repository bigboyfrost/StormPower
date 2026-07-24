@echo off
cd /d "%~dp0"
echo.
echo  StormPower mega-wave ENGINE MOD
echo  Patches Stormworks ocean shaders + whirlpool forces.
echo  Close Stormworks first.
echo.
pause
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-engine-mod.ps1"
pause
