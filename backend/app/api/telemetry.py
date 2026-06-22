from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.api.auth_utils import get_current_user
from app.models import User
from app.telemetry import calculate_telemetry

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

@router.get("/metrics")
def get_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only central supervisors can access system telemetry logs."
        )
    return calculate_telemetry(db)
