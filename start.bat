@echo off
chcp 65001 >nul
title Shopify Order Sync Tool
echo ========================================================
echo        Shopify Order Sync Tool - Starting...
echo ========================================================
echo.

REM Set current directory
cd /d "%~dp0"

REM Check for portable Node.js
if exist "bin\node.exe" (
    echo [INFO] Detected portable Node.js in bin folder.
    set "NODE_EXEC=bin\node.exe"
) else (
    echo [WARN] 'bin\node.exe' not found. Checking system Node.js...
    where node >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Node.js environment not found!
        echo --------------------------------------------------------
        echo To run this in portable mode:
        echo 1. Create a 'bin' folder in this directory.
        echo 2. Place 'node.exe' into the 'bin' folder.
        echo --------------------------------------------------------
        pause
        exit /b
    )
    set "NODE_EXEC=node"
)

echo Starting Web Interface...
echo.

REM Start the server
"%NODE_EXEC%" server.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application exited with error code %errorlevel%.
    pause
)