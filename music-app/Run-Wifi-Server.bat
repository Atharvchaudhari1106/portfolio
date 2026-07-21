@echo off
title AesthetiCore Music Wi-Fi Server Launcher
echo =======================================================
echo   🚀 AesthetiCore Music - Same Wi-Fi Network Server 🚀
echo =======================================================
echo.

:: Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is NOT installed!
    echo Please download and install Node.js from: https://nodejs.org/
    echo Press any key to exit...
    pause >nul
    exit
)

echo 📦 Building frontend and launching Wi-Fi Server...
call npm run wifi

