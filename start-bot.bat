@echo off
REM Double-click to run the bot on Windows (e.g. on your streaming PC).
cd /d "%~dp0"
if not exist node_modules call npm install --omit=dev
:loop
node src\index.js
echo Bot stopped. Restarting in 10 seconds... (close this window to quit)
timeout /t 10 >nul
goto loop
