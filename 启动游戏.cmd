@echo off
setlocal
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\run_game.ps1" %*
set "gameExitCode=%ERRORLEVEL%"
if not "%gameExitCode%"=="0" (
    echo.
    echo The game could not start. See the error above.
    pause
)
exit /b %gameExitCode%
