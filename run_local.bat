@echo off
title Cocoon Local Environment
echo =========================================================
echo   Cocoon - Isolated Local Node.js Development Sandbox
echo =========================================================
echo.

:: Add the local bin folder containing node.exe and npm to the session PATH
set "PATH=%~dp0bin;%PATH%"

:: Verify local Node.js is detected
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Could not execute local Node.js.
    echo Please make sure you have extracted the Node.js binaries
    echo ^(node.exe, npm, npx, etc.^) directly inside:
    echo   D:\Development\Cocoon\bin\
    echo.
    echo Current PATH configuration did not resolve 'node' in that directory.
    echo.
    pause
    exit /b
)

echo [SUCCESS] Isolated Node.js environment active:
echo - Node version: 
node -v
echo - npm version:  
call npm -v
echo.
echo No global variables or system registries were altered.
echo All installed dependencies will be stored locally in:
echo   D:\Development\Cocoon\node_modules\
echo.
echo =========================================================
echo SELECT AN ACTION:
echo 1. Install Dependencies (Run this on first-time setup)
echo 2. Start Local Development Server (Host on port 3000)
echo 3. Build Production Bundle (Generates optimized static dist/)
echo 4. Capacitor & Android APK Toolkit (Sync, Config, Open)
echo 5. Open Interactive Command Prompt (To run custom node/npm commands)
echo 6. Exit
echo =========================================================
echo.

set /p choice="Enter choice (1-5, or 6 to exit): "

if "%choice%"=="1" (
    echo.
    echo [INFO] Running local dependency installation...
    call npm install
    echo.
    echo [SUCCESS] Dependencies installed! You can now run the development server.
    echo.
    pause
    cls
    goto :eof
)

if "%choice%"=="2" (
    echo.
    echo [INFO] Starting Vite local dev server...
    call npm run dev
    pause
    goto :eof
)

if "%choice%"=="3" (
    echo.
    echo [INFO] Building production bundle...
    call npm run build
    echo.
    pause
    goto :eof
)

if "%choice%"=="4" (
    cls
    echo =========================================================
    echo   Capacitor & Android APK Setup Companion
    echo =========================================================
    echo [1] Initialize Capacitor Config (Run once if capacitor.config.ts is missing)
    echo [2] Add Android Platform Folder (Run once to create 'android' folder)
    echo [3] Sync Web Build to Android (Run every time you change React code)
    echo [4] Fix 'local.properties' SDK configuration (Bypass system env variables)
    echo [5] Open Android Studio
    echo [6] Back to Main Menu
    echo =========================================================
    echo.
    set /p capchoice="Select an action: "
    
    if "%capchoice%"=="1" (
        echo.
        echo [INFO] Initializing Capacitor Configuration...
        call npx cap init Cocoon com.mahaboob.cocoon --web-dir=dist
        pause
    )
    if "%capchoice%"=="2" (
        echo.
        echo [INFO] Generating Android Studio project directory...
        call npx cap add android
        pause
    )
    if "%capchoice%"=="3" (
        echo.
        echo [INFO] Syncing React static dist/ files to Android Studio build...
        call npx cap sync
        pause
    )
    if "%capchoice%"=="4" (
        echo.
        echo This utility points your local Android Studio project directly
        echo to your Windows Sdk directory without modifying global environment variables.
        echo.
        set "DEFAULT_SDK_PATH=%LOCALAPPDATA%\Android\Sdk"
        echo Your default Sdk path appears to be: 
        echo   %LOCALAPPDATA%\Android\Sdk
        echo.
        set /p custom_sdk="Press [ENTER] to use default, or paste custom SDK path: "
        if "%custom_sdk%"=="" (
            set "FINAL_SDK=%DEFAULT_SDK_PATH%"
        ) else (
            set "FINAL_SDK=%custom_sdk%"
        )
        
        :: Format backslashes for properties file
        set "ESCAPED_SDK=%FINAL_SDK:\=\\%"
        
        if not exist "android" (
            echo.
            echo [WARNING] No 'android' folder found yet. Run [Option 2] first to generate it!
        ) else (
            echo sdk.dir=%ESCAPED_SDK% > android\local.properties
            echo.
            echo [SUCCESS] File 'android\local.properties' created/updated!
            echo Android Studio will now recognize your Sdk correctly at:
            echo   %FINAL_SDK%
        )
        pause
    )
    if "%capchoice%"=="5" (
        echo.
        echo [INFO] Launching Android Studio...
        call npx cap open android
        pause
    )
    goto :eof
)

if "%choice%"=="5" (
    echo.
    echo =========================================================
    echo   Interactive Shell Enabled
    echo   Type 'exit' to return to normal prompt
    echo =========================================================
    cmd /k "echo Isolated PATH includes D:\Development\Cocoon\bin"
    goto :eof
)

if "%choice%"=="6" (
    exit /b
)

echo Invalid choice.
pause
