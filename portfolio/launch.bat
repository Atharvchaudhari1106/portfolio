@echo off
echo "Starting AesthetiCore Music Backend..."
start cmd /k "cd ..\music-app\server && node index.js"

if exist ".venv\Scripts\python.exe" (
    echo "Using virtual environment..."
    ".venv\Scripts\python.exe" main.py
) else (
    echo "Using system python..."
    python main.py
)
pause
