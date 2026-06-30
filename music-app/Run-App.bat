@echo off
title AesthetiCore Music Launcher
echo ==============================================
echo   🚀 Welcome to AesthetiCore Music Launcher 🚀
echo ==============================================
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

echo 📦 Checking & Installing Frontend dependencies...
if not exist "node_modules\" (
    echo Installing node_modules...
    call npm install
) else (
    echo node_modules already exists.
)

echo.
echo 📦 Checking & Installing Backend dependencies...
cd server
if not exist "node_modules\" (
    echo Installing backend node_modules...
    call npm install
) else (
    echo backend node_modules already exists.
)
cd ..

echo.
echo 🎵 Launching AesthetiCore Music Player...
echo (This will automatically launch the backend server and open the browser)
echo.
call npm run dev
