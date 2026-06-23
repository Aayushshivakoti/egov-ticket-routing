from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import hashlib
import json
import random

from app.db import get_db
from app.models import SystemAuditLog
from app.api.auth import get_current_user
from app.schemas import UserResponse
from app.utils.audit import GENESIS_HASH

router = APIRouter()

@router.get("/verify")
def verify_hash_chain(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Sequentially recalculates the hash chain of the audit logs to detect any internal database tampering.
    Requires Super Admin privileges.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    logs = db.query(SystemAuditLog).order_by(SystemAuditLog.id.asc()).all()
    
    expected_prev_hash = GENESIS_HASH
    
    for log in logs:
        # 1. Check if the previous hash link is unbroken
        if log.previous_row_hash != expected_prev_hash:
            return {
                "status": "TAMPERED",
                "tampered_row_id": log.id,
                "message": f"Hash chain broken at row {log.id}. Expected prev hash {expected_prev_hash}, got {log.previous_row_hash}"
            }
            
        # 2. Recalculate current hash
        uid_str = str(log.user_id) if log.user_id is not None else "SYSTEM"
        timestamp_iso = log.timestamp.isoformat()
        
        data_to_hash = f"{log.previous_row_hash}|{uid_str}|{log.action_performed}|{timestamp_iso}|{log.payload}"
        recalculated_hash = hashlib.sha256(data_to_hash.encode('utf-8')).hexdigest()
        
        # 3. Compare the recalculated hash with what is stored in the database
        if recalculated_hash != log.current_row_hash:
            return {
                "status": "TAMPERED",
                "tampered_row_id": log.id,
                "message": f"Data tampering detected at row {log.id}. Payload or timestamp was maliciously altered."
            }
            
        # Update expected_prev_hash for the next iteration
        expected_prev_hash = log.current_row_hash
        
    return {
        "status": "OK",
        "message": "Chain 100% Valid. No tampering detected.",
        "total_logs_verified": len(logs)
    }

@router.post("/simulate-tamper")
def simulate_database_tampering(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Development endpoint to simulate a rogue DBA altering the database manually without updating hashes.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Get a random log entry that is not the very first one (to ensure chain exists)
    logs = db.query(SystemAuditLog).all()
    if not logs:
        raise HTTPException(status_code=400, detail="No audit logs available to tamper with")
        
    target_log = random.choice(logs)
    
    # Tamper with the payload
    try:
        payload_data = json.loads(target_log.payload)
        payload_data["TAMPERED"] = "MALICIOUS_DATA_INSERTION"
        target_log.payload = json.dumps(payload_data)
    except:
        target_log.payload = '{"TAMPERED": "CORRUPTED_JSON"}'
        
    # Commit WITHOUT updating the hash (simulating a direct DB update by a rogue admin)
    db.commit()
    
    return {"message": f"Successfully compromised row ID {target_log.id}"}
