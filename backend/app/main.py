from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import auth, departments, tickets

app = FastAPI(
    title="Intelligent E-Governance Ticket Routing System",
    description="Full-stack portal for automated government helpdesk ticket routing.",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, configure to the specific frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")

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
