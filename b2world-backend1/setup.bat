@echo off
REM B2World ATS Backend - Windows Setup Script

echo ================================
echo   B2World ATS Backend Setup
echo ================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js detected: 
node -v
echo.

REM Check if .env exists
if exist .env (
    echo [OK] .env file exists
) else (
    echo [SETUP] Creating .env file...
    copy .env.example .env
    echo.
    echo IMPORTANT: Edit .env file and add your MongoDB URI!
    echo.
    echo For MongoDB Atlas:
    echo 1. Go to https://www.mongodb.com/cloud/atlas
    echo 2. Create free cluster
    echo 3. Get connection string
    echo 4. Replace MONGODB_URI in .env file
    echo.
    pause
)

REM Install dependencies
echo [INSTALL] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

REM Ask about seeding
set /p SEED="Do you want to seed the database? (y/n): "
if /i "%SEED%"=="y" (
    echo [SEED] Seeding database...
    call npm run seed
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: Database seeding failed. Check your MongoDB connection.
        echo You can try again later with: npm run seed
    ) else (
        echo [OK] Database seeded successfully
        echo.
        echo Default Admin Credentials:
        echo Email: admin@b2world.com
        echo Password: Admin@123
        echo.
    )
)

REM Start server
echo.
echo ================================
echo   Starting Server
echo ================================
echo.
echo Server will start at: http://localhost:5000
echo.
echo Press Ctrl+C to stop the server
echo.
pause

call npm run dev
