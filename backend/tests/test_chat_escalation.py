import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.db import Base, get_db
from app.models import Department, User, ChatSession, ChatMessage, Ticket
from app.api.auth_utils import get_password_hash

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_chat_escalation_db.db"
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
    
    # Seed departments
    water_dept = Department(id=1, name="Water Supply", description="Water distribution systems")
    roads_dept = Department(id=2, name="Roads & Infrastructure", description="Road network")
    db.add_all([water_dept, roads_dept])
    
    hashed_pwd = get_password_hash("password123")
    
    # Super Admin
    super_admin = User(
        id=20,
        name="Super Admin",
        email="super_admin@egov.gov.np",
        password_hash=hashed_pwd,
        role="super_admin"
    )
    # Water Department Head
    water_head = User(
        id=21,
        name="Water Chief",
        email="water_head@egov.gov.np",
        password_hash=hashed_pwd,
        role="dept_admin",
        department_id=1,
        dept_role="Department Head"
    )
    # Seed standard citizen (for escalation linking)
    citizen = User(
        id=22,
        name="Shyam Kumar",
        email="citizen_seed@example.com",
        password_hash=hashed_pwd,
        role="citizen"
    )
    db.add_all([super_admin, water_head, citizen])
    db.commit()
    db.close()
    
    yield
    
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_chat_escalation_db.db"):
        try:
            os.remove("./test_chat_escalation_db.db")
        except:
            pass

client = TestClient(app)

def test_chat_escalation_workflow():
    # 1. Citizen starts chat
    res_start = client.post("/api/chat/start", json={"citizen_name": "Hari Bahadur"})
    assert res_start.status_code == 200
    session_data = res_start.json()
    token = session_data["session_token"]
    session_id = session_data["id"]
    
    assert session_data["citizen_name"] == "Hari Bahadur"
    assert session_data["status"] == "active"
    
    # 2. Citizen posts details about leak
    res_msg = client.post(f"/api/chat/{token}/message", json={"message": "Big pipe leak in Koteshwor."})
    assert res_msg.status_code == 200
    
    # Verify messages list has greeting + citizen message
    res_history = client.get(f"/api/chat/{token}/messages")
    assert res_history.status_code == 200
    messages = res_history.json()
    assert len(messages) == 2
    assert messages[1]["message"] == "Big pipe leak in Koteshwor."
    
    # 3. Non-admin cannot view chat logs
    res_cit_login = client.post("/api/auth/login", data={"username": "citizen_seed@example.com", "password": "password123"})
    cit_token = res_cit_login.json()["access_token"]
    res_unauth = client.get("/api/chat/admin/sessions", headers={"Authorization": f"Bearer {cit_token}"})
    assert res_unauth.status_code == 403

    # 4. Admin logs in and inspects the chat
    res_admin_login = client.post("/api/auth/login", data={"username": "super_admin@egov.gov.np", "password": "password123"})
    admin_token = res_admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    res_admin_sessions = client.get("/api/chat/admin/sessions", headers=admin_headers)
    assert res_admin_sessions.status_code == 200
    sessions = res_admin_sessions.json()
    assert any(s["id"] == session_id for s in sessions)
    
    # Admin replies to citizen
    res_reply = client.post(f"/api/chat/admin/sessions/{session_id}/message", json={"message": "Understood, checking department loads."}, headers=admin_headers)
    assert res_reply.status_code == 200
    
    # Admin assigns chat to Water Supply (ID: 1)
    res_assign = client.post(f"/api/chat/admin/sessions/{session_id}/assign", json={"department_id": 1}, headers=admin_headers)
    assert res_assign.status_code == 200
    assert res_assign.json()["assigned_department_id"] == 1
    assert res_assign.json()["status"] == "assigned"
    
    # 5. Department Admin logs in
    res_dept_login = client.post("/api/auth/login", data={"username": "water_head@egov.gov.np", "password": "password123"})
    dept_token = res_dept_login.json()["access_token"]
    dept_headers = {"Authorization": f"Bearer {dept_token}"}
    
    # Department Head fetches their assigned chats and sees the session
    res_dept_sessions = client.get("/api/chat/dept/sessions", headers=dept_headers)
    assert res_dept_sessions.status_code == 200
    dept_sessions = res_dept_sessions.json()
    assert len(dept_sessions) == 1
    assert dept_sessions[0]["id"] == session_id
    
    # Department Head replies to citizen
    res_dept_reply = client.post(f"/api/chat/dept/sessions/{session_id}/message", json={"message": "We are creating a ticket for Koteshwor."}, headers=dept_headers)
    assert res_dept_reply.status_code == 200
    
    # Department Head escalates chat into a ticket
    res_escalate = client.post(f"/api/chat/dept/sessions/{session_id}/escalate", json={"title": "Escalated Water Main Leak"}, headers=dept_headers)
    assert res_escalate.status_code == 200
    ticket_data = res_escalate.json()
    assert ticket_data["title"] == "Escalated Water Main Leak"
    assert ticket_data["assigned_department_id"] == 1
    
    # Check that chat session status updated to escalated and ticket ID is linked
    res_history_final = client.get(f"/api/chat/{token}/messages")
    assert len(res_history_final.json()) == 4  # system + citizen + admin + dept
    
    db = TestingSessionLocal()
    session_db = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    assert session_db.status == "escalated"
    assert session_db.associated_ticket_id == ticket_data["id"]
    
    # Verify both Admin and Dept Admin can see the created ticket
    res_ticket_admin = client.get(f"/api/tickets/{ticket_data['id']}", headers=admin_headers)
    assert res_ticket_admin.status_code == 200
    
    res_ticket_dept = client.get(f"/api/tickets/{ticket_data['id']}", headers=dept_headers)
    assert res_ticket_dept.status_code == 200
    
    db.close()
