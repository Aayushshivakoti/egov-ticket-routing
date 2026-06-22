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

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    # Setup tables
    Base.metadata.create_all(bind=engine)
    
    # Seed initial test departments
    db = TestingSessionLocal()
    water_dept = Department(id=1, name="Water Supply", description="Water distribution systems")
    roads_dept = Department(id=2, name="Roads & Infrastructure", description="Municipal road systems")
    general_dept = Department(id=5, name="General Administration", description="General administrative inquiries")
    db.add_all([water_dept, roads_dept, general_dept])
    db.commit()
    db.close()
    
    yield
    
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

def test_register_dept_admin():
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Water Supervisor",
            "email": "water_admin_test@egov.gov.np",
            "password": "password123",
            "role": "dept_admin",
            "department_id": 1
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "water_admin_test@egov.gov.np"
    assert data["role"] == "dept_admin"
    assert data["department_id"] == 1

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
        json={
            "title": "Water Pipe Burst",
            "description": "The main water pipe near block A has burst. Water is everywhere.",
            "priority": "high"
        },
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Water Pipe Burst"
    assert data["assigned_department_id"] == 1
    assert data["status"] == "pending"
    assert data["remarks"] is None
    assert data["needs_verification"] is False
    ticket_id_val = data["id"]

def test_create_ticket_unauthenticated():
    response = client.post(
        "/api/tickets/create",
        json={
            "title": "Anonymous report",
            "description": "Should fail validation"
        }
    )
    assert response.status_code == 401

def test_create_ticket_low_confidence_flag():
    # Submit a vague description that won't exceed the 65% confidence routing threshold
    response = client.post(
        "/api/tickets/create",
        json={
            "title": "Vague complaint",
            "description": "Just an obscure minor thing at some random location.",
            "priority": "low"
        },
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response.status_code == 201
    data = response.json()
    # Must route to General Administration (ID=5) and needs_verification is True
    assert data["assigned_department_id"] == 5
    assert data["needs_verification"] is True

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
        json={
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
        json={
            "status": "resolved",
            "remarks": "Citizen trying to resolve it."
        },
        headers={"Authorization": f"Bearer {citizen_token}"}
    )
    assert response.status_code == 403
