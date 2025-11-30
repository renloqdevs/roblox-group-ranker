@echo off
title RankBot Console
mode con: cols=90 lines=35
color 0F

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ERROR: Node.js is not installed or not in PATH
    echo.
    echo  Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Change to script directory
cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules" (
    echo.
    echo  Installing dependencies...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo  ERROR: Failed to install dependencies
        echo.
        pause
        exit /b 1
    )
    echo.
)

:: Run the console application
node console/app.js

:: If the app exits with an error, pause to show the message
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  Application exited with error code %ERRORLEVEL%
    echo.
    pause
)
