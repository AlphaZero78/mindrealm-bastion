@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 需要 Node.js 22.15 或更新版本。请先安装 Node.js 后再运行此文件。
  pause
  exit /b 1
)
node -e "fetch('http://127.0.0.1:4178/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
if not errorlevel 1 (
  start "" "http://127.0.0.1:4178/"
  exit /b 0
)
start "" "http://127.0.0.1:4178/"
node server.mjs
endlocal
