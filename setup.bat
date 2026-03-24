@echo off
cd /d "%~dp0"
echo ============================================================
echo   Estimia — Installation
echo ============================================================
echo.

echo Verification de Node.js...
node --version >nul 2>&1
if errorlevel 1 (
  echo ERREUR: Node.js n'est pas installe.
  echo Telecharge-le sur https://nodejs.org  puis relance ce script.
  pause
  exit /b 1
)

echo Installation des dependances backend...
npm --prefix backend install

echo Installation des dependances frontend...
npm --prefix frontend install

echo Construction du frontend...
npm --prefix frontend run build

echo.
echo ============================================================
echo   Installation terminee. Lance start.bat pour demarrer.
echo ============================================================
pause
