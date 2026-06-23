import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.db import Base, get_db
from app.models import Department, User, Ticket
from app.api.auth_utils import get_password_hash

# Setup isolated SQLite test database for staff management
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_staff_db.db"
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
    # Set override
    app.dependency_overrides[get_db] = override_get_db

    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    # Create departments
    water_dept = Department(id=1, name="Water Supply", description="Water distribution systems")
    roads_dept = Department(id=2, name="Roads & Infrastructure", description="Road network")
    db.add_all([water_dept, roads_dept])
    
    # Create super admin
    hashed_pwd = get_password_hash("password123")
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
    
    # Clean override
    app.dependency_overrides.pop(get_db, None)
    
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_staff_db.db"):
        try:
            os.remove("./test_staff_db.db")
        except Exception:
            pass

client = TestClient(app)

def get_auth_token(email, password):
    response = client.post(
        "/api/auth/login",
        data={"username": email, "password": password}
    )
    return response.json()["access_token"]

def test_staff_management_flow():
    # 1. Login as Super Admin
    super_token = get_auth_token("admin_test@egov.gov.np", "password123")
    headers = {"Authorization": f"Bearer {super_token}"}
    
    # 2. Provision a new departmental admin user (employee)
    response = client.post(
        "/api/auth/provision",
        json={
            "name": "Employee Alpha",
            "email": "alpha@egov.gov.np",
            "password": "password123",
            "role": "dept_admin",
            "department_id": 1,
            "employee_id_or_passport": "EMP-001",
            "status": "active"
        },
        headers=headers
    )
    assert response.status_code == 201
    employee = response.json()
    assert employee["employee_id_or_passport"] == "EMP-001"
    assert employee["status"] == "active"
    employee_id = employee["id"]
    
    # 3. Retrieve department employees and verify Employee Alpha is returned
    response = client.get("/api/departments/1/employees", headers=headers)
    assert response.status_code == 200
    employees_list = response.json()
    assert len(employees_list) == 1
    assert employees_list[0]["name"] == "Employee Alpha"
    
    # 4. Suspend employee
    response = client.post(f"/api/departments/employees/{employee_id}/suspend", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "suspended"
    
    # 5. Verify suspended employee cannot log in
    response = client.post(
        "/api/auth/login",
        data={"username": "alpha@egov.gov.np", "password": "password123"}
    )
    assert response.status_code == 403
    assert "suspended" in response.json()["detail"].lower()
    
    # 6. Reactivate employee
    response = client.post(f"/api/departments/employees/{employee_id}/activate", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "active"
    
    # 7. Verify login works again and fetch token
    emp_token = get_auth_token("alpha@egov.gov.np", "password123")
    assert emp_token is not None
    emp_headers = {"Authorization": f"Bearer {emp_token}"}
    
    # 8. Transfer employee to Roads & Infrastructure (dept ID 2)
    response = client.post(
        f"/api/departments/employees/{employee_id}/transfer",
        json={"department_id": 2},
        headers=headers
    )
    assert response.status_code == 200
    assert response.json()["department_id"] == 2
    
    # 9. Verify route isolation loop: employee's access to Department 1 (Water Supply) is cut off immediately
    # Using their current token, they try to fetch tickets under department 1
    response = client.get("/api/tickets/department/1", headers=emp_headers)
    # Access must be denied since they are now assigned to department 2
    assert response.status_code == 403
    
    # Verify they CAN access department 2
    response = client.get("/api/tickets/department/2", headers=emp_headers)
    assert response.status_code == 200
    
    # 10. Delete employee
    response = client.delete(f"/api/departments/employees/{employee_id}", headers=headers)
    assert response.status_code == 200
    
    # Verify employee is no longer in the database
    response = client.get("/api/departments/2/employees", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 0
