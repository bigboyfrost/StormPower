@echo off
REM Auto-commit helper used after StormPower updates
setlocal
cd /d "%~dp0"
set MSG=%*
if "%MSG%"=="" set MSG=Update StormPower
git add -A
git diff --cached --quiet && echo No changes to commit && exit /b 0
git -c user.name="Aimless Developement" -c user.email="stormpower@users.noreply.github.com" commit -m "%MSG%"
git push origin HEAD
echo Pushed.
