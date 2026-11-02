@echo off
setlocal
title Pickolo - Expo Go Preview
set "PICKOLO_CUSTOMER_DIR=%~dp0mobile\customer"
if not exist "%PICKOLO_CUSTOMER_DIR%\package.json" set "PICKOLO_CUSTOMER_DIR=E:\PHUSE\Pickolo_Android_Test\source\mobile\customer"
if not exist "%PICKOLO_CUSTOMER_DIR%\package.json" goto missing
cd /d "%PICKOLO_CUSTOMER_DIR%"
if errorlevel 1 goto failed
set "EXPO_NO_TELEMETRY=1"
set "EXPO_OFFLINE=1"
echo Keep this window open while testing Pickolo in Expo Go.
echo Connect the phone and PC to the same router, then scan the NEW QR below.
"C:\Program Files\nodejs\node.exe" "..\node_modules\expo\bin\cli" start --offline --go --port 8082 --max-workers 2
if errorlevel 1 goto failed
exit /b 0
:missing
echo Pickolo source folder was not found at %PICKOLO_CUSTOMER_DIR%
:failed
echo Pickolo could not start. Keep this error visible for troubleshooting.
pause
exit /b 1
