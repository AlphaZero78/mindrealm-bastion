@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0web_game.ps1" %*
set gameExitCode=%ERRORLEVEL%
if not "%gameExitCode%"=="0" pause
exit /b %gameExitCode%
