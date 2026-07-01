import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.db import Base, get_db
from app.models import User, SystemAuditLog
from app.utils.audit import log_audit_event, GENESIS_HASH
from app.api.auth_utils import get_password_hash

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_audit_db.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    hashed_pwd = get_password_hash("password123")
    
    # Super admin for audit ledger retrieval
    super_admin = User(
        id=10,
        name="Super Admin",
        email="super_admin@egov.gov.np",
        password_hash=hashed_pwd,
        role="super_admin"
    )
    # Citizen (non-admin) who shouldn't have access
    citizen = User(
        id=11,
        name="Citizen User",
        email="citizen_user@example.com",
        password_hash=hashed_pwd,
        role="citizen"
    )
    db.add_all([super_admin, citizen])
    db.commit()
    db.close()
    
    yield
    
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_audit_db.db"):
        try:
            os.remove("./test_audit_db.db")
        except:
            pass

client = TestClient(app)

def test_cryptographic_audit_trail_flow():
    # Login as citizen - access should be forbidden
    res_cit = client.post("/api/auth/login", data={"username": "citizen_user@example.com", "password": "password123"})
    assert res_cit.status_code == 200
    cit_token = res_cit.json()["access_token"]
    
    res_logs_fail = client.get("/api/audit", headers={"Authorization": f"Bearer {cit_token}"})
    assert res_logs_fail.status_code == 403
    
    res_verify_fail = client.get("/api/verify", headers={"Authorization": f"Bearer {cit_token}"})
    assert res_verify_fail.status_code == 403
    
    res_tamper_fail = client.post("/api/simulate-tamper", headers={"Authorization": f"Bearer {cit_token}"})
    assert res_tamper_fail.status_code == 403

    # Login as super admin
    res_admin = client.post("/api/auth/login", data={"username": "super_admin@egov.gov.np", "password": "password123"})
    assert res_admin.status_code == 200
    admin_token = res_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    db = TestingSessionLocal()
    
    # 1. Populate initial logs to start the hash chain
    log_audit_event(db, user_id=10, action="TICKET_CLASSIFIED", payload_dict={"ticket_id": 1, "department_id": 2})
    log_audit_event(db, user_id=10, action="TICKET_ASSIGNED", payload_dict={"ticket_id": 1, "employee_id": 3})
    log_audit_event(db, user_id=None, action="SYSTEM_CLEANUP", payload_dict={"deleted_records": 0})
    
    # Fetch logs and verify they were inserted
    res_logs = client.get("/api/audit", headers=admin_headers)
    assert res_logs.status_code == 200
    logs_data = res_logs.json()
    assert len(logs_data) == 3
    
    # Verify linking logic of hashes
    # (Newest log is first in /api/audit due to order_by desc)
    # logs_data[0] is dynamic system cleanup (last), logs_data[2] is ticket classification (first)
    assert logs_data[2]["previous_row_hash"] == GENESIS_HASH
    assert logs_data[1]["previous_row_hash"] == logs_data[2]["current_row_hash"]
    assert logs_data[0]["previous_row_hash"] == logs_data[1]["current_row_hash"]
    
    # 2. Run sequential hash verification scan on intact chain
    res_verify_clean = client.get("/api/verify", headers=admin_headers)
    assert res_verify_clean.status_code == 200
    assert res_verify_clean.json()["status"] == "OK"
    assert "No tampering detected" in res_verify_clean.json()["message"]
    
    # 3. Simulate database tampering (malicious modification of payload)
    res_tamper = client.post("/api/simulate-tamper", headers=admin_headers)
    assert res_tamper.status_code == 200
    assert "Successfully compromised" in res_tamper.json()["message"]
    
    # 4. Re-run verification scan to confirm system detects tampering and pinpoints compromised row
    res_verify_dirty = client.get("/api/verify", headers=admin_headers)
    assert res_verify_dirty.status_code == 200
    assert res_verify_dirty.json()["status"] == "TAMPERED"
    assert res_verify_dirty.json()["tampered_row_id"] is not None
    assert "tampering detected" in res_verify_dirty.json()["message"].lower() or "hash chain broken" in res_verify_dirty.json()["message"].lower()
    
    db.close()
