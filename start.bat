@echo off
cd /d "%~dp0"

if not exist "frontend\dist\index.html" (
  echo Frontend non construit. Lance setup.bat d'abord.
  pause
  exit /b 1
)

REM Stop any previous instance
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do taskkill /F /PID %%a 2>nul

set ELECTRON_STATIC=true
set PORT=5000

start "Estimia" /min node backend\main.js
timeout /t 2 /nobreak >nul
start http://localhost:5000
