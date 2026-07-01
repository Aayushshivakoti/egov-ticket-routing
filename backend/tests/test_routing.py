import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.db import Base, get_db
from app.models import Department, User, Ticket
from app.celery_app import celery_app
from app.utils.routing import haversine_distance, solve_tsp
from app.api.auth_utils import get_password_hash

# Eager execution of Celery tasks
celery_app.conf.update(task_always_eager=True)

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_routing_db.db"
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
    
    # Patch SessionLocal in tasks
    import app.tasks as tasks_module
    original_session_local = tasks_module.SessionLocal
    tasks_module.SessionLocal = TestingSessionLocal
    
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    water_dept = Department(id=1, name="Water Supply", description="Water distribution systems")
    db.add(water_dept)
    
    hashed_pwd = get_password_hash("password123")
    
    # Seed a field operator
    operator = User(
        id=3,
        name="Ram Bahadur",
        email="operator_test@egov.gov.np",
        password_hash=hashed_pwd,
        role="dept_admin",  # In this schema dept admins hold employees
        department_id=1,
        dept_role="Field Operator"
    )
    db.add(operator)
    
    # Seed a non-operator citizen
    citizen = User(
        id=4,
        name="Hari Lal",
        email="citizen_test@example.com",
        password_hash=hashed_pwd,
        role="citizen"
    )
    db.add(citizen)
    
    db.commit()
    db.close()
    
    yield
    
    # Restore SessionLocal in tasks
    tasks_module.SessionLocal = original_session_local
    
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_routing_db.db"):
        try:
            os.remove("./test_routing_db.db")
        except:
            pass

client = TestClient(app)

def test_haversine_distance():
    # Kathmandu center to a point approx 1.1km north
    # 27.7172, 85.3240  to  27.7272, 85.3240
    dist = haversine_distance(27.7172, 85.3240, 27.7272, 85.3240)
    assert 1.0 < dist < 1.25

def test_solve_tsp():
    # Start at 0, 0
    # Three tickets at:
    # t1: (1, 1) - farther
    # t2: (0.1, 0.1) - very close
    # t3: (0.2, 0.2) - medium close
    t1 = Ticket(id=1, latitude=1.0, longitude=1.0)
    t2 = Ticket(id=2, latitude=0.1, longitude=0.1)
    t3 = Ticket(id=3, latitude=0.2, longitude=0.2)
    
    tickets = [t1, t2, t3]
    
    # Nearest neighbor should visit t2 -> t3 -> t1
    ordered = solve_tsp(0.0, 0.0, tickets)
    assert len(ordered) == 3
    assert ordered[0].id == 2
    assert ordered[1].id == 3
    assert ordered[2].id == 1

def test_operator_route_endpoint():
    # Login as non-operator citizen should fail with 403
    res_cit = client.post("/api/auth/login", data={"username": "citizen_test@example.com", "password": "password123"})
    assert res_cit.status_code == 200
    cit_token = res_cit.json()["access_token"]
    
    res_route_fail = client.get("/api/tickets/operator/route?lat=27.7172&lng=85.3240", headers={"Authorization": f"Bearer {cit_token}"})
    assert res_route_fail.status_code == 403
    
    # Login as field operator
    res_op = client.post("/api/auth/login", data={"username": "operator_test@egov.gov.np", "password": "password123"})
    assert res_op.status_code == 200
    op_token = res_op.json()["access_token"]
    op_headers = {"Authorization": f"Bearer {op_token}"}
    
    # Check that route starts empty
    res_route_empty = client.get("/api/tickets/operator/route?lat=27.7172&lng=85.3240", headers=op_headers)
    assert res_route_empty.status_code == 200
    assert len(res_route_empty.json()) == 0
    
    # Assign some tickets to operator Ram Bahadur (ID: 3)
    db = TestingSessionLocal()
    
    t1 = Ticket(
        title="Pipe leak far",
        description="Far away",
        status="pending",
        citizen_id=4,
        assigned_department_id=1,
        assigned_employee_id=3,
        latitude=27.7572,
        longitude=85.3240
    )
    t2 = Ticket(
        title="Pipe leak close",
        description="Close to operator",
        status="pending",
        citizen_id=4,
        assigned_department_id=1,
        assigned_employee_id=3,
        latitude=27.7192,
        longitude=85.3250
    )
    t3 = Ticket(
        title="Pipe leak medium",
        description="Intermediate distance",
        status="pending",
        citizen_id=4,
        assigned_department_id=1,
        assigned_employee_id=3,
        latitude=27.7372,
        longitude=85.3245
    )
    db.add_all([t1, t2, t3])
    db.commit()
    
    # Call route optimization from Kathmandu center
    res_route = client.get("/api/tickets/operator/route?lat=27.7172&lng=85.3240", headers=op_headers)
    assert res_route.status_code == 200
    route_data = res_route.json()
    assert len(route_data) == 3
    
    # Assert nearest goes first: t2 (close) -> t3 (medium) -> t1 (far)
    assert route_data[0]["title"] == "Pipe leak close"
    assert route_data[1]["title"] == "Pipe leak medium"
    assert route_data[2]["title"] == "Pipe leak far"
    
    db.close()
