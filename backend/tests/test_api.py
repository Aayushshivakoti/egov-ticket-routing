import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to path to ensure app imports work correctly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.db import Base, get_db
from app.models import Department, User, Ticket
from app.celery_app import celery_app

# Enable eager execution of Celery tasks for test isolation
celery_app.conf.update(task_always_eager=True)

# Setup isolated SQLite test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_db.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override standard DB dependency to run on SQLite
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    # Set override
    app.dependency_overrides[get_db] = override_get_db

    # Patch SessionLocal in tasks
    import app.tasks as tasks_module
    original_session_local = tasks_module.SessionLocal
    tasks_module.SessionLocal = TestingSessionLocal

    # Setup tables
    Base.metadata.create_all(bind=engine)
    
    # Seed initial test departments
    db = TestingSessionLocal()
    water_dept = Department(id=1, name="Water Supply", description="Water distribution systems")
    roads_dept = Department(id=2, name="Roads & Infrastructure", description="Municipal road systems")
    electricity_dept = Department(id=3, name="Electricity Authority", description="Power grid and transmission lines")
    general_dept = Department(id=5, name="General Administration", description="General administrative inquiries")
    db.add_all([water_dept, roads_dept, electricity_dept, general_dept])
    
    # Seed departmental admin directly for testing login
    from app.api.auth_utils import get_password_hash
    hashed_pwd = get_password_hash("password123")
    water_admin = User(
        name="Water Supervisor",
        email="water_admin_test@egov.gov.np",
        password_hash=hashed_pwd,
        role="dept_admin",
        department_id=1
    )
    db.add(water_admin)
    
    # Seed super admin for testing provisioning
    super_admin = User(
        name="Central Supervisor",
        email="admin_test@egov.gov.np",
        password_hash=hashed_pwd,
        role="super_admin"
    )
    db.add(super_admin)
    
    db.commit()
    db.close()
    
    yield
    
    # Restore SessionLocal in tasks
    import app.tasks as tasks_module
    tasks_module.SessionLocal = original_session_local
    
    # Clean override
    app.dependency_overrides.pop(get_db, None)
    
    # Tear down tables
    Base.metadata.drop_all(bind=engine)
    # Remove SQLite file safely
    if os.path.exists("./test_db.db"):
        try:
            os.remove("./test_db.db")
        except Exception as e:
            print(f"Error deleting SQLite test file: {e}")

client = TestClient(app)

# Session scopes to test flows in order
citizen_token = None
dept_admin_token = None
ticket_id_val = None

def test_register_citizen():
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Hari Bahadur",
            "email": "hari_test@gmail.com",
            "password": "password123",
            "role": "citizen"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "hari_test@gmail.com"
    assert data["role"] == "citizen"

def test_register_dept_admin_fails():
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Water Supervisor 2",
            "email": "water_admin_test2@egov.gov.np",
            "password": "password123",
            "role": "dept_admin",
            "department_id": 1
        }
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Public registration is only allowed for citizen accounts."

def test_login_citizen():
    global citizen_token
    response = client.post(
        "/api/auth/login",
        data={
            "username": "hari_test@gmail.com",
            "password": "password123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    citizen_token = data["access_token"]

def test_login_dept_admin():
    global dept_admin_token
    response = client.post(
        "/api/auth/login",
        data={
            "username": "water_admin_test@egov.gov.np",
            "password": "password123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    dept_admin_token = data["access_token"]

def test_create_ticket_authenticated_citizen():
    global ticket_id_val
    # Description contains "water leak" to check auto-routing to dept_id = 1
    response = client.post(
        "/api/tickets/create",
        data={
            "title": "Water Pipe Burst",
            "description": "The main water pipe near block A has burst. Water is everywhere.",
            "priority": "high"
        },
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response.status_code == 202
    data = response.json()
    assert data["title"] == "Water Pipe Burst"
    assert data["status"] == "processing"
    assert data["assigned_department_id"] is None
    ticket_id_val = data["id"]

    # Verify background Celery routing did its work
    response_get = client.get(
        f"/api/tickets/{ticket_id_val}",
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response_get.status_code == 200
    data_get = response_get.json()
    assert data_get["assigned_department_id"] == 1
    assert data_get["status"] == "pending"
    assert data_get["needs_verification"] is False

def test_create_ticket_unauthenticated():
    response = client.post(
        "/api/tickets/create",
        data={
            "title": "Anonymous report",
            "description": "Should fail validation"
        }
    )
    assert response.status_code == 401

def test_create_ticket_low_confidence_flag():
    # Submit a vague description that won't exceed the 65% confidence routing threshold
    response = client.post(
        "/api/tickets/create",
        data={
            "title": "Vague complaint",
            "description": "Just an obscure minor thing at some random location.",
            "priority": "low"
        },
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response.status_code == 202
    data = response.json()
    assert data["title"] == "Vague complaint"
    assert data["status"] == "processing"
    assert data["assigned_department_id"] is None
    
    # Verify General Admin routing in background
    response_get = client.get(
        f"/api/tickets/{data['id']}",
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response_get.status_code == 200
    data_get = response_get.json()
    assert data_get["assigned_department_id"] == 5
    assert data_get["needs_verification"] is True

def test_get_department_tickets_admin_success():
    response = client.get(
        "/api/tickets/department/1",
        headers={"Authorization": f"Bearer {dept_admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == ticket_id_val
    assert data[0]["title"] == "Water Pipe Burst"

def test_get_department_tickets_admin_wrong_dept():
    # Admin of dept 1 should not be allowed to see dept 2
    response = client.get(
        "/api/tickets/department/2",
        headers={"Authorization": f"Bearer {dept_admin_token}"}
    )
    assert response.status_code == 403

def test_update_ticket_status_and_remarks_admin():
    response = client.put(
        f"/api/tickets/{ticket_id_val}/status",
        data={
            "status": "in_progress",
            "remarks": "Sewerage maintenance team dispatched to New Road."
        },
        headers={"Authorization": f"Bearer {dept_admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "in_progress"
    assert data["remarks"] == "Sewerage maintenance team dispatched to New Road."

def test_update_ticket_status_citizen_unauthorized():
    # Citizens should not be able to modify status
    response = client.put(
        f"/api/tickets/{ticket_id_val}/status",
        data={
            "status": "resolved",
            "remarks": "Citizen trying to resolve it."
        },
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response.status_code == 403

def test_create_ticket_emergency_keyword_override():
    response = client.post(
        "/api/tickets/create",
        data={
            "title": "Danger: transformer sparks",
            "description": "Our power line is sparking, and we are worried about transformer fire.",
            "priority": "low"
        },
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "processing"

    # Verify background emergency classification
    response_get = client.get(
        f"/api/tickets/{data['id']}",
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response_get.status_code == 200
    data_get = response_get.json()
    assert data_get["assigned_department_id"] == 3
    assert data_get["priority"] == "high"
    assert data_get["ai_confidence"] == 1.0
    assert data_get["needs_verification"] is False

def test_create_ticket_nepali_routing():
    response = client.post(
        "/api/tickets/create",
        data={
            "title": "सडक नाली जाम भयो",
            "description": "नयाँ सडकमा पानीको पाइप फुटेर बाढी आएको छ, पानी जम्मा भयो।",
            "priority": "medium"
        },
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "processing"

    # Verify background Devanagari classification
    response_get = client.get(
        f"/api/tickets/{data['id']}",
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response_get.status_code == 200
    data_get = response_get.json()
    assert data_get["assigned_department_id"] == 1
    assert data_get["priority"] == "high"
    assert data_get["ai_confidence"] == 1.0
    assert data_get["needs_verification"] is False

def test_super_admin_provisioning():
    # First login as super_admin
    login_response = client.post(
        "/api/auth/login",
        data={
            "username": "admin_test@egov.gov.np",
            "password": "password123"
        }
    )
    assert login_response.status_code == 200
    super_admin_token = login_response.json()["access_token"]
    
    # Provision a new admin
    provision_response = client.post(
        "/api/auth/provision",
        json={
            "name": "Roads Supervisor",
            "email": "roads_admin_test@egov.gov.np",
            "password": "password123",
            "role": "dept_admin",
            "department_id": 2
        },
        headers={"Authorization": f"Bearer {super_admin_token}"}
    )
    assert provision_response.status_code == 201
    assert provision_response.json()["role"] == "dept_admin"
    assert provision_response.json()["department_id"] == 2

def test_resolve_ticket_without_proof_fails():
    # Attempting to resolve without files should fail with 400
    response = client.put(
        f"/api/tickets/{ticket_id_val}/status",
        data={
            "status": "resolved",
            "remarks": "Everything is fixed.",
            "report": "This is a detailed text report explaining the resolution."
        },
        headers={"Authorization": f"Bearer {dept_admin_token}"}
    )
    assert response.status_code == 400
    assert "Resolution proof is mandatory" in response.json()["detail"]

def test_resolve_ticket_with_proof_success():
    # Provide a mock proof file
    import io
    file_data = {"files": ("test_proof.png", io.BytesIO(b"dummy_content"), "image/png")}
    response = client.put(
        f"/api/tickets/{ticket_id_val}/status",
        data={
            "status": "resolved",
            "remarks": "Everything is fixed.",
            "report": "This is a detailed text report explaining the resolution."
        },
        files=file_data,
        headers={"Authorization": f"Bearer {dept_admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "resolved"
    assert len(data["attachments"]) == 1
    assert data["attachments"][0]["is_proof"] is True

def test_public_stats():
    response = client.get("/api/tickets/public/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "pending" in data
    assert "in_progress" in data
    assert "resolved" in data
    assert data["resolved"] == 1

def test_public_feed():
    response = client.get("/api/tickets/public/feed")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    first_row = data[0]
    assert "title" in first_row
    assert "status" in first_row
    assert "created_at" in first_row
    assert "citizen_id" not in first_row
    assert "citizen" not in first_row
    assert "description" not in first_row

def test_public_proof():
    response = client.get(f"/api/tickets/public/{ticket_id_val}/proof")
    assert response.status_code == 200
    data = response.json()
    assert data["ticket_id"] == ticket_id_val
    assert data["remarks"] == "Everything is fixed."
    assert len(data["attachments"]) == 1
    assert data["attachments"][0]["is_proof"] is True

def test_post_ticket_clarification_no_files():
    response = client.post(
        f"/api/tickets/{ticket_id_val}/clarifications",
        data={
            "message": "Clarification message text"
        },
        headers={"Authorization": f"Bearer {dept_admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "clarification_id" in data

def test_csat_and_pdf_export_endpoints():
    login_response = client.post(
        "/api/auth/login",
        data={
            "username": "admin_test@egov.gov.np",
            "password": "password123"
        }
    )
    assert login_response.status_code == 200
    super_admin_token = login_response.json()["access_token"]
    
    # 1. Test CSAT metrics endpoint
    csat_resp = client.get(
        "/api/telemetry/csat",
        headers={"Authorization": f"Bearer {super_admin_token}"}
    )
    assert csat_resp.status_code == 200
    csat_data = csat_resp.json()
    assert isinstance(csat_data, list)
    
    # 2. Test PDF export endpoint
    pdf_resp = client.get(
        "/api/telemetry/export-pdf",
        headers={"Authorization": f"Bearer {super_admin_token}"}
    )
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert len(pdf_resp.content) > 0

