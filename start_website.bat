@echo off
setlocal

cd /d "%~dp0"

echo Starting Ascend MVP...
echo The site will open at http://localhost:3000 when the server is ready.
echo Press Ctrl+C in this window to stop it.
echo.

npm start

echo.
echo Server stopped.
pause
