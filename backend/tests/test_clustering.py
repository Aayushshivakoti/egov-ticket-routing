import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.db import Base, get_db
from app.models import Department, User, Ticket, TicketAttachment
from app.celery_app import celery_app
from app.utils.clustering import run_spatial_clustering
from app.api.auth_utils import get_password_hash

# Eager execution of Celery tasks
celery_app.conf.update(task_always_eager=True)

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_clustering_db.db"
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
    citizen = User(
        id=1,
        name="Test Citizen",
        email="citizen_test@example.com",
        password_hash=hashed_pwd,
        role="citizen"
    )
    db.add(citizen)
    
    dept_admin = User(
        id=2,
        name="Water Supervisor",
        email="water_admin_test@egov.gov.np",
        password_hash=hashed_pwd,
        role="dept_admin",
        department_id=1
    )
    db.add(dept_admin)
    
    db.commit()
    db.close()
    
    yield
    
    # Restore SessionLocal in tasks
    import app.tasks as tasks_module
    tasks_module.SessionLocal = original_session_local
    
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_clustering_db.db"):
        try:
            os.remove("./test_clustering_db.db")
        except:
            pass

client = TestClient(app)

def test_spatial_clustering_and_cascade():
    # Login to get citizen token and admin token
    res_cit = client.post("/api/auth/login", data={"username": "citizen_test@example.com", "password": "password123"})
    assert res_cit.status_code == 200, f"Citizen login failed: {res_cit.text}"
    cit_token = res_cit.json()["access_token"]
    cit_headers = {"Authorization": f"Bearer {cit_token}"}
    
    res_adm = client.post("/api/auth/login", data={"username": "water_admin_test@egov.gov.np", "password": "password123"})
    assert res_adm.status_code == 200, f"Admin login failed: {res_adm.text}"
    adm_token = res_adm.json()["access_token"]
    adm_headers = {"Authorization": f"Bearer {adm_token}"}
    
    db = TestingSessionLocal()
    
    # Create 3 tickets close to each other
    t1 = Ticket(
        title="Water leak on main street 1",
        description="A major water leak has been observed on the main street.",
        priority="high",
        status="pending",
        citizen_id=1,
        assigned_department_id=1,
        latitude=27.7172,
        longitude=85.3240
    )
    t2 = Ticket(
        title="Water leak on main street 2",
        description="Water has been pooling on the street near the main junction.",
        priority="medium",
        status="pending",
        citizen_id=1,
        assigned_department_id=1,
        latitude=27.7173,
        longitude=85.3241
    )
    t3 = Ticket(
        title="Water leak on main street 3",
        description="Water pipe burst near street light 15.",
        priority="high",
        status="pending",
        citizen_id=1,
        assigned_department_id=1,
        latitude=27.7171,
        longitude=85.3239
    )
    
    # Create 1 ticket far away (approx 5.5km away)
    t4 = Ticket(
        title="Water shortage in north town",
        description="We have had no running water for two days now.",
        priority="medium",
        status="pending",
        citizen_id=1,
        assigned_department_id=1,
        latitude=27.7672,
        longitude=85.3240
    )
    
    db.add_all([t1, t2, t3, t4])
    db.commit()
    
    # Run spatial clustering
    run_spatial_clustering(db, 1)
    
    db.refresh(t1)
    db.refresh(t2)
    db.refresh(t3)
    db.refresh(t4)
    
    # t1 should be the oldest (lowest ID) and become the Master Ticket
    # t2 and t3 should be linked to t1
    # t4 should remain unlinked (parent_ticket_id is None)
    assert t1.parent_ticket_id is None
    assert t2.parent_ticket_id == t1.id
    assert t3.parent_ticket_id == t1.id
    assert t4.parent_ticket_id is None
    
    # Verify child_ticket_ids is returned in GET response
    get_res = client.get(f"/api/tickets/{t1.id}", headers=cit_headers)
    assert get_res.status_code == 200
    res_data = get_res.json()
    assert res_data["parent_ticket_id"] is None
    assert t2.id in res_data["child_ticket_ids"]
    assert t3.id in res_data["child_ticket_ids"]
    
    # Cascade check: Resolve Master Ticket
    import io
    file_data = {"files": ("test.png", io.BytesIO(b"dummy image content"), "image/png")}
    form_data = {
        "status": "resolved",
        "remarks": "Leak repaired successfully.",
        "report": "Excavated road and repaired the joint on the main supply pipe."
    }
    
    res_status = client.put(f"/api/tickets/{t1.id}/status", headers=adm_headers, data=form_data, files=file_data)
    assert res_status.status_code == 200
    
    db.refresh(t1)
    db.refresh(t2)
    db.refresh(t3)
    
    assert t1.status == "resolved"
    assert t2.status == "resolved"
    assert t3.status == "resolved"
    assert t2.remarks == "Leak repaired successfully."
    assert t2.report == "Excavated road and repaired the joint on the main supply pipe."
    
    # Check that proofs were cloned to children
    p2 = db.query(TicketAttachment).filter(TicketAttachment.ticket_id == t2.id, TicketAttachment.is_proof == True).first()
    p3 = db.query(TicketAttachment).filter(TicketAttachment.ticket_id == t3.id, TicketAttachment.is_proof == True).first()
    assert p2 is not None
    assert p3 is not None
    assert p2.file_path == p3.file_path
    
    # Unlinking check: Citizen rejects resolution of t2 (reopens)
    feedback_form = {"satisfied": "false"}
    res_fb = client.post(f"/api/tickets/{t2.id}/feedback", headers=cit_headers, data=feedback_form)
    assert res_fb.status_code == 200
    
    db.refresh(t2)
    assert t2.status == "Under Re-evaluation"
    assert t2.parent_ticket_id is None
    assert t2.reopened is True
    
    db.close()
