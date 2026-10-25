@echo off
title MoodTok Server
echo.
echo  ========================================
echo   MoodTok - He thong suc khoe tinh than
echo  ========================================
echo.
echo  Dang khoi dong server...
echo.

cd /d "%~dp0"

:: Kiem tra node
node --version >nul 2>&1
if errorlevel 1 (
    echo  [LOI] Chua cai dat Node.js!
    echo  Tai tai: https://nodejs.org
    pause
    exit
)

:: Kiem tra node_modules
if not exist node_modules (
    echo  Dang cai dat thu vien (lan dau)...
    npm install
)

:: Mo browser sau 2 giay
start "" timeout /t 2 >nul
start "" "http://localhost:3000"

:: Chay server
echo  Server dang chay tai: http://localhost:3000
echo  Nhan Ctrl+C de dung server
echo.
node server.js

pause
