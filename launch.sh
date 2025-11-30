#!/bin/bash

# RankBot Console Launcher

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Change to script directory
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}"
    echo "  ERROR: Node.js is not installed"
    echo ""
    echo "  Please install Node.js from https://nodejs.org/"
    echo -e "${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo ""
    echo "  Installing dependencies..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}"
        echo "  ERROR: Failed to install dependencies"
        echo -e "${NC}"
        exit 1
    fi
    echo ""
fi

# Run the console application
node console/app.js

# Capture exit code
EXIT_CODE=$?

# If the app exits with an error, show message
if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo -e "${RED}  Application exited with error code $EXIT_CODE${NC}"
    echo ""
fi
