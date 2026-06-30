#!/bin/bash
echo "=============================================="
echo "  🚀 Welcome to AesthetiCore Music Launcher 🚀"
echo "=============================================="
echo ""

# Check Node.js
if ! [ -x "$(command -v node)" ]; then
  echo '❌ Node.js is NOT installed!' >&2
  echo 'Please install Node.js from https://nodejs.org/ before running.' >&2
  exit 1
fi

echo "📦 Checking & Installing Frontend dependencies..."
if [ ! -d "node_modules" ]; then
  npm install
else
  echo "node_modules already exists."
fi

echo ""
echo "📦 Checking & Installing Backend dependencies..."
cd server
if [ ! -d "node_modules" ]; then
  npm install
else
  echo "backend node_modules already exists."
fi
cd ..

echo ""
echo "🎵 Launching AesthetiCore Music Player..."
echo "(This will automatically launch the backend server and open the browser)"
echo ""
npm run dev
