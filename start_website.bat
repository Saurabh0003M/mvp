@echo off
setlocal

set "PROJECT_DIR=F:\HBTM\mvp"
set "PORT=3000"
set "URL=http://localhost:%PORT%"

cd /d "%PROJECT_DIR%" || (
  echo Could not open project folder: %PROJECT_DIR%
  pause
  exit /b 1
)

if not exist "package.json" (
  echo package.json was not found in %CD%
  echo Refusing to start, because this is not the Ascend MVP project folder.
  pause
  exit /b 1
)

echo Starting Ascend MVP...
echo Project: %CD%
echo The site will open at %URL% when the server is ready.
echo Press Ctrl+C in this window to stop it.
echo.

echo Clearing anything already using port %PORT%...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Get-NetTCPConnection -LocalPort %PORT% -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"

start "Ascend browser opener" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$u='%URL%'; for ($i = 0; $i -lt 90; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 2; if ($r.StatusCode -ge 200) { Start-Process $u; exit 0 } } catch {}; Start-Sleep -Seconds 1 }; Start-Process $u"

call npm.cmd run dev -- -p %PORT%

echo.
echo Server stopped.
pause
