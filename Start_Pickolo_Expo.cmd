@echo off
setlocal
title Pickolo - Expo Go Preview
cd /d "%~dp0mobile\customer"
if errorlevel 1 goto failed
set "EXPO_NO_TELEMETRY=1"
set "EXPO_OFFLINE=1"
echo Keep this window open while testing Pickolo in Expo Go.
echo Connect the phone and PC to the same Wi-Fi, then scan the QR shown below.
node "..\node_modules\expo\bin\cli" start --offline --go --port 8082 --max-workers 2
if errorlevel 1 goto failed
exit /b 0
:failed
echo Pickolo could not start. Keep this error visible for troubleshooting.
pause
exit /b 1

