@echo off
title E-Governance Helpdesk Portal - Unified Launcher
cls
echo =======================================================================
echo          E-Governance Helpdesk Portal - Unified Startup Utility
echo =======================================================================
echo.
echo Select the execution mode for the project:
echo.
echo [1] Docker Compose (Recommended)
echo     Spins up Postgres, Redis, FastAPI, Celery, and React inside 
echo     fully containerized local environments.
echo.
echo [2] Host Local Environment
echo     Launches local PostgreSQL, Redis, FastAPI (Uvicorn), Celery 
echo     Worker, and React (Vite) in individual terminal sessions.
echo.
echo [3] Exit
echo.
echo =======================================================================
set /p choice="Enter your choice (1, 2, or 3): "

if "%choice%"=="1" (
    echo.
    echo Starting Docker Compose build and execution...
    echo.
    docker compose up --build
    pause
    exit /b
)

if "%choice%"=="2" (
    echo.
    echo Launching development ecosystem locally...
    echo.
    
    :: 1. Launch Redis
    echo Starting local Redis Server...
    start "Redis Server" cmd /k "redis-server"
    
    :: 2. Launch Backend API (Uvicorn)
    echo Starting Backend API (FastAPI / Uvicorn)...
    start "Backend API" cmd /k "cd backend && venv\Scripts\python -m alembic upgrade head && venv\Scripts\python app/seed.py && venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
    
    :: 3. Launch Celery Worker
    echo Starting Celery Solo Worker...
    start "Celery Worker" cmd /k "cd backend && venv\Scripts\celery -A app.celery_app.celery_app worker --loglevel=info -P solo"
    
    :: 4. Launch Frontend (Vite)
    echo Starting Frontend Developer Server (Vite)...
    start "Frontend Developer Server" cmd /k "cd frontend && npm run dev"
    
    echo.
    echo =======================================================================
    echo Startup processes spawned! 
    echo Please check the newly opened console windows for logs and diagnostics.
    echo.
    echo Backend API Docs:  http://localhost:8000/docs
    echo Frontend Server:   http://localhost:5173  (Docker: http://localhost:5173)
    echo =======================================================================
    echo.
    pause
    exit /b
)

if "%choice%"=="3" (
    echo Exiting utility.
    exit /b
)

echo Invalid choice. Exiting.
pause
