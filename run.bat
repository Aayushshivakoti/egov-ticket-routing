@echo off
title E-Governance Helpdesk Portal - Development Environment
cls
echo =======================================================================
echo          E-Governance Helpdesk Portal - Launching Ecosystem
echo =======================================================================
echo.
echo Launching development ecosystem locally...
echo.

:: 1. Launch Redis
echo Starting local Redis Server...
start /b redis-server >nul 2>&1

:: 2. Launch Backend API (Uvicorn)
echo Starting Backend API ^(FastAPI / Uvicorn^)...
start /b cmd /c "cd backend && venv\Scripts\python -m alembic upgrade head && venv\Scripts\python app/seed.py && venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

:: 3. Launch Celery Worker
echo Starting Celery Solo Worker...
start /b cmd /c "cd backend && venv\Scripts\celery -A app.celery_app.celery_app worker --loglevel=info -P solo"

:: 4. Launch Frontend (Vite)
echo Starting Frontend Developer Server ^(Vite^)...
start /b cmd /c "cd frontend && npm run dev"

echo.
echo =======================================================================
echo All services are booting in the background of this terminal!
echo Note: Logs will interleave on this screen. To stop the services, you may 
echo need to manually close this terminal window.
echo.
echo Backend API Docs:  http://localhost:8000/docs
echo Frontend Server:   http://localhost:5173
echo =======================================================================
echo.
pause
exit /b
