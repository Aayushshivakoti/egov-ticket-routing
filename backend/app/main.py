import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import auth, departments, tickets, telemetry, audit
from app.websocket_manager import manager, redis_listener

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start the background Redis subscription listener task
    listener_task = asyncio.create_task(redis_listener())
    yield
    # Shutdown: Cancel the background task
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="Intelligent E-Governance Ticket Routing System",
    description="Full-stack portal for automated government helpdesk ticket routing.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, configure to the specific frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Uploads Folder
import os
from fastapi.staticfiles import StaticFiles
script_dir = os.path.dirname(os.path.abspath(__file__))
uploads_dir = os.path.join(script_dir, "..", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Mount API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(telemetry.router, prefix="/api")
app.include_router(audit.router, prefix="/api")

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep client connection open
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket disconnection error: {e}")
        manager.disconnect(websocket)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "E-Governance Ticket Routing API",
        "version": "1.0.0"
    }

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
