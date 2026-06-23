import hashlib
import json
import datetime
from sqlalchemy.orm import Session
from app.models import SystemAuditLog

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

def get_last_audit_hash(db: Session) -> str:
    """Fetch the hash of the latest audit log, or return the GENESIS_HASH if none exists."""
    last_log = db.query(SystemAuditLog).order_by(SystemAuditLog.id.desc()).first()
    if last_log:
        return last_log.current_row_hash
    return GENESIS_HASH

def log_audit_event(db: Session, user_id: int, action: str, payload_dict: dict):
    """
    Log a critical event with a cryptographic hash linked to the previous log.
    The hash is calculated as SHA256(previous_hash + user_id + action + timestamp_iso + payload_json).
    """
    try:
        prev_hash = get_last_audit_hash(db)
        
        # Serialize payload deterministically
        payload_json = json.dumps(payload_dict, sort_keys=True, separators=(',', ':'))
        
        now = datetime.datetime.utcnow()
        timestamp_iso = now.isoformat()

        # Build the string to hash
        # Handle user_id being None for system actions
        uid_str = str(user_id) if user_id is not None else "SYSTEM"
        
        data_to_hash = f"{prev_hash}|{uid_str}|{action}|{timestamp_iso}|{payload_json}"
        
        # Calculate SHA-256 hash
        current_hash = hashlib.sha256(data_to_hash.encode('utf-8')).hexdigest()

        # Create new log entry
        new_log = SystemAuditLog(
            timestamp=now,
            user_id=user_id,
            action_performed=action,
            payload=payload_json,
            previous_row_hash=prev_hash,
            current_row_hash=current_hash
        )
        
        db.add(new_log)
        db.commit()
    except Exception as e:
        db.rollback()
        # In a real system, we might want to fail the entire transaction if audit logging fails
        # For this prototype, we'll log to console but allow it to continue
        print(f"CRITICAL AUDIT LOG FAILURE: {e}")
