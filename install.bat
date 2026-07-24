@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  StormPower  ·  Aimless Developement
echo  ----------------------------------
echo  Installing addon into Stormworks...
echo.

set "DEST=%APPDATA%\Stormworks\data\missions\StormPower"
if not exist "%APPDATA%\Stormworks\data\missions" mkdir "%APPDATA%\Stormworks\data\missions"
if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"
copy /Y "%~dp0addon\playlist.xml" "%DEST%\playlist.xml" >nul
copy /Y "%~dp0addon\script.lua" "%DEST%\script.lua" >nul

echo  Addon installed:
echo    %DEST%
echo.
echo  Next: run start.bat
echo.
pause
