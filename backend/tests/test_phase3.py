import os
import sys
import pytest
import io
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.db import Base, get_db
from app.models import Department, User, Ticket, PendingRoleChange, TicketAttachment
from app.api.auth_utils import get_password_hash

# Setup isolated SQLite test database for Phase 3 testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_phase3_db.db"
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
    # Create departments
    water_dept = Department(id=1, name="Water Supply", description="Water distribution systems")
    roads_dept = Department(id=2, name="Roads & Infrastructure", description="Road network")
    db.add_all([water_dept, roads_dept])
    
    # Create users
    hashed_pwd = get_password_hash("password123")
    
    super_admin = User(
        id=1,
        name="Central Supervisor",
        email="admin_test@egov.gov.np",
        password_hash=hashed_pwd,
        role="super_admin"
    )
    
    citizen = User(
        id=2,
        name="John Citizen",
        email="john@citizen.com",
        password_hash=hashed_pwd,
        role="citizen"
    )
    
    dept_head_1 = User(
        id=3,
        name="Water Dept Head",
        email="waterhead@egov.gov.np",
        password_hash=hashed_pwd,
        role="dept_admin",
        department_id=1,
        dept_role="Department Head"
    )
    
    employee_1 = User(
        id=4,
        name="Water Staff",
        email="waterstaff@egov.gov.np",
        password_hash=hashed_pwd,
        role="dept_admin",
        department_id=1,
        dept_role="Field Operator"
    )
    
    db.add_all([super_admin, citizen, dept_head_1, employee_1])
    
    # Create a resolved ticket for re-evaluation testing
    resolved_ticket = Ticket(
        id=10,
        citizen_id=2,
        title="Resolved Pothole",
        description="Pothole needs fixing",
        assigned_department_id=1,
        status="resolved",
        remarks="Fixed now",
        report="This is a text resolution report explaining the repair."
    )
    db.add(resolved_ticket)
    
    # Create attachments
    proof = TicketAttachment(
        id=100,
        ticket_id=10,
        file_path="/uploads/proof/pothole.png",
        file_type="photo",
        is_proof=True
    )
    db.add(proof)
    
    db.commit()
    db.close()
    
    yield
    
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_phase3_db.db"):
        try:
            os.remove("./test_phase3_db.db")
        except Exception:
            pass

client = TestClient(app)

def get_auth_token(email, password):
    response = client.post(
        "/api/auth/login",
        data={"username": email, "password": password}
    )
    return response.json()["access_token"]

def test_singleton_department_head_provision():
    super_token = get_auth_token("admin_test@egov.gov.np", "password123")
    headers = {"Authorization": f"Bearer {super_token}"}
    
    # Try provisioning a second Department Head in Department 1 (should fail)
    response = client.post(
        "/api/auth/provision",
        json={
            "name": "Second Head",
            "email": "secondhead@egov.gov.np",
            "password": "password123",
            "role": "dept_admin",
            "department_id": 1,
            "dept_role": "Department Head"
        },
        headers=headers
    )
    assert response.status_code == 400
    assert "already assigned" in response.json()["detail"]

def test_role_update_pipeline():
    super_token = get_auth_token("admin_test@egov.gov.np", "password123")
    dept_head_token = get_auth_token("waterhead@egov.gov.np", "password123")
    
    # 1. Super Admin updates role directly (bypass approval)
    response = client.put(
        "/api/departments/employees/4/role",
        json={"dept_role": "Support Rep"},
        headers={"Authorization": f"Bearer {super_token}"}
    )
    assert response.status_code == 200
    assert response.json()["user"]["dept_role"] == "Support Rep"
    
    # Verify DB reflects change
    db = TestingSessionLocal()
    emp = db.query(User).filter(User.id == 4).first()
    assert emp.dept_role == "Support Rep"
    db.close()
    
    # 2. Department Head updates employee role (should write to PendingRoleChanges)
    response = client.put(
        "/api/departments/employees/4/role",
        json={"dept_role": "Field Operator"},
        headers={"Authorization": f"Bearer {dept_head_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "submitted for approval" in data["detail"]
    pending_id = data["pending_id"]
    
    # Verify employee's role in DB is still Support Rep (not changed yet)
    db = TestingSessionLocal()
    emp = db.query(User).filter(User.id == 4).first()
    assert emp.dept_role == "Support Rep"
    db.close()
    
    # 3. Super Admin views Approvals Queue
    response = client.get(
        "/api/departments/role-changes/pending",
        headers={"Authorization": f"Bearer {super_token}"}
    )
    assert response.status_code == 200
    pending_list = response.json()
    assert len(pending_list) > 0
    assert pending_list[0]["requested_role"] == "Field Operator"
    
    # 4. Super Admin rejects another role change (first let's submit another one)
    response = client.put(
        "/api/departments/employees/4/role",
        json={"dept_role": "Support Rep"},
        headers={"Authorization": f"Bearer {dept_head_token}"}
    )
    second_pending_id = response.json()["pending_id"]
    
    response = client.post(
        f"/api/departments/role-changes/{second_pending_id}/reject",
        headers={"Authorization": f"Bearer {super_token}"}
    )
    assert response.status_code == 200
    
    # 5. Super Admin approves first role change
    response = client.post(
        f"/api/departments/role-changes/{pending_id}/approve",
        headers={"Authorization": f"Bearer {super_token}"}
    )
    assert response.status_code == 200
    
    # Verify employee's role in DB is now updated to Field Operator
    db = TestingSessionLocal()
    emp = db.query(User).filter(User.id == 4).first()
    assert emp.dept_role == "Field Operator"
    db.close()

def test_case_assignment_and_reassignment():
    super_token = get_auth_token("admin_test@egov.gov.np", "password123")
    citizen_token = get_auth_token("john@citizen.com", "password123")
    
    # 1. Assign ticket 10 to employee 4 (Water Staff)
    response = client.post(
        "/api/tickets/10/assign",
        json={"assigned_employee_id": 4},
        headers={"Authorization": f"Bearer {super_token}"}
    )
    assert response.status_code == 200
    assert response.json()["assigned_employee_id"] == 4
    
    # 2. Citizen requests reassignment (Officer Change)
    response = client.post(
        "/api/tickets/10/request-reassignment",
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response.status_code == 200
    assert response.json()["reassignment_requested"] is True

def test_field_reports_and_re_evaluation():
    citizen_token = get_auth_token("john@citizen.com", "password123")
    
    # 1. Guest view proof/report (no login required)
    response = client.get("/api/tickets/public/10/proof")
    assert response.status_code == 200
    data = response.json()
    assert data["report"] == "This is a text resolution report explaining the repair."
    assert len(data["attachments"]) == 1
    
    # 2. Citizen requests re-evaluation on resolved ticket
    response = client.post(
        "/api/tickets/10/re-evaluate",
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Under Re-evaluation"

def test_multi_tier_sla_violations():
    from app.tasks import check_sla_violations
    from app.models import Notification
    import datetime
    
    db = TestingSessionLocal()
    
    # Patch SessionLocal in tasks module to use TestingSessionLocal
    import app.tasks
    original_session_local = app.tasks.SessionLocal
    app.tasks.SessionLocal = TestingSessionLocal
    
    try:
        now = datetime.datetime.utcnow()
        
        # Create test tickets
        # Ticket A: proof requested 25 hours ago (Tier 1)
        ticket_a = Ticket(
            id=101,
            citizen_id=3,
            title="Tier 1 SLA Breach",
            description="Tier 1",
            status="resolved",
            assigned_department_id=1,
            proof_requested_at=now - datetime.timedelta(hours=25),
            sla_violated=False
        )
        
        # Ticket B: proof requested 49 hours ago (Tier 2)
        ticket_b = Ticket(
            id=102,
            citizen_id=3,
            title="Tier 2 SLA Breach",
            description="Tier 2",
            status="resolved",
            assigned_department_id=1,
            proof_requested_at=now - datetime.timedelta(hours=49),
            sla_violated=True
        )
        
        # Ticket C: proof requested 73 hours ago (Tier 3)
        ticket_c = Ticket(
            id=103,
            citizen_id=3,
            title="Tier 3 SLA Breach",
            description="Tier 3",
            status="resolved",
            assigned_department_id=1,
            proof_requested_at=now - datetime.timedelta(hours=73),
            sla_violated=True
        )
        
        db.add_all([ticket_a, ticket_b, ticket_c])
        db.commit()
        
        # Clear existing notifications
        db.query(Notification).delete()
        db.commit()
        
        # Run periodic check task
        check_sla_violations()
        
        # Refresh and verify
        db.refresh(ticket_a)
        db.refresh(ticket_b)
        db.refresh(ticket_c)
        
        assert ticket_a.sla_violated is True
        
        # Verify Tier 1 notification for dept head (user_id 3)
        notif_t1 = db.query(Notification).filter(
            Notification.ticket_id == 101,
            Notification.category == "sla_alert",
            Notification.message.like("%Warning%")
        ).first()
        assert notif_t1 is not None
        assert notif_t1.user_id == 3
        
        # Verify Tier 2 notification for super admin (user_id 1)
        notif_t2 = db.query(Notification).filter(
            Notification.ticket_id == 102,
            Notification.category == "sla_alert",
            Notification.message.like("%Tier 2%")
        ).first()
        assert notif_t2 is not None
        assert notif_t2.user_id == 1
        
        # Verify Tier 3 compliance audit logs for both roles
        notifs_t3 = db.query(Notification).filter(
            Notification.ticket_id == 103,
            Notification.category == "compliance_audit"
        ).all()
        assert len(notifs_t3) >= 2
        
    finally:
        # Clean up database records
        db.query(Ticket).filter(Ticket.id.in_([101, 102, 103])).delete()
        db.query(Notification).delete()
        db.commit()
        db.close()
        app.tasks.SessionLocal = original_session_local
