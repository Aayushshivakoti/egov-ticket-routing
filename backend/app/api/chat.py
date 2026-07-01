import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict

from app.db import get_db
from app.models import ChatSession, ChatMessage, Ticket, Department, User
from app.schemas import (
    ChatSessionResponse, ChatSessionCreate, 
    ChatMessageResponse, ChatMessageCreate,
    TicketResponse
)
from app.api.auth_utils import get_current_user
from app.utils.audit import log_audit_event

router = APIRouter(prefix="/chat", tags=["Chat System"])

# --- CITIZEN PUBLIC ENDPOINTS ---

@router.post("/start", response_model=ChatSessionResponse)
def start_chat_session(payload: ChatSessionCreate, db: Session = Depends(get_db)):
    """
    Public citizen starts a new chat session.
    """
    token = str(uuid.uuid4())
    session = ChatSession(
        session_token=token,
        citizen_name=payload.citizen_name,
        status="active"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # Auto-welcome message
    welcome_msg = ChatMessage(
        chat_session_id=session.id,
        sender_role="admin",
        sender_name="System Dispatch",
        message=f"Hello {payload.citizen_name}, welcome to the E-Gov Helpdesk. Please describe your request or ticket number so our operators can assist you.",
        timestamp=datetime.datetime.utcnow()
    )
    db.add(welcome_msg)
    db.commit()
    db.refresh(session)
    
    return session

@router.post("/{session_token}/message", response_model=ChatMessageResponse)
def send_citizen_message(
    session_token: str, 
    payload: ChatMessageCreate, 
    db: Session = Depends(get_db)
):
    """
    Public citizen sends a message within their chat session.
    """
    session = db.query(ChatSession).filter(ChatSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    msg = ChatMessage(
        chat_session_id=session.id,
        sender_role="citizen",
        sender_name=session.citizen_name,
        message=payload.message,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(msg)
    
    # If the session was closed, reopen it to active
    if session.status == "closed":
        session.status = "active"
        
    db.commit()
    db.refresh(msg)
    return msg

@router.get("/{session_token}/messages", response_model=List[ChatMessageResponse])
def get_citizen_messages(session_token: str, db: Session = Depends(get_db)):
    """
    Citizen fetches their chat transcript history.
    """
    session = db.query(ChatSession).filter(ChatSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session.messages


# --- ADMIN CONTROLS ENDPOINTS ---

@router.get("/admin/sessions", response_model=List[ChatSessionResponse])
def get_admin_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin fetches all chat logs. Requires super_admin.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorized. Admin privileges required.")
        
    return db.query(ChatSession).order_by(ChatSession.created_at.desc()).all()

@router.post("/admin/sessions/{session_id}/message", response_model=ChatMessageResponse)
def send_admin_message(
    session_id: int,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin sends a message directly to the citizen.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorized.")
        
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    msg = ChatMessage(
        chat_session_id=session.id,
        sender_role="admin",
        sender_name=current_user.name,
        message=payload.message,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

@router.post("/admin/sessions/{session_id}/assign", response_model=ChatSessionResponse)
def assign_chat_to_department(
    session_id: int,
    payload: dict, # {"department_id": int}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin assigns the chat session to a department.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorized.")
        
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    dept_id = payload.get("department_id")
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    session.assigned_department_id = dept_id
    session.status = "assigned"
    
    # Audit log
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="CHAT_ASSIGNED_TO_DEPT",
        payload_dict={"chat_session_id": session_id, "department_id": dept_id}
    )
    
    db.commit()
    db.refresh(session)
    return session

@router.post("/admin/sessions/{session_id}/escalate", response_model=TicketResponse)
def escalate_chat_to_ticket_admin(
    session_id: int,
    payload: dict, # {"department_id": int, "title": str}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin escalates the chat directly into a formal ticket.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorized.")
        
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    dept_id = payload.get("department_id")
    title = payload.get("title", f"Escalated Case: {session.citizen_name}")
    
    # Consolidate transcript as description
    transcript_lines = []
    for msg in session.messages:
        transcript_lines.append(f"[{msg.timestamp.strftime('%H:%M')}] {msg.sender_name} ({msg.sender_role}): {msg.message}")
    description = "\n".join(transcript_lines)
    
    # Resolve or create a fallback citizen user
    citizen = db.query(User).filter(User.role == "citizen").first()
    if not citizen:
        citizen = User(
            name="Guest Citizen",
            email="guest_chat@egov.gov.np",
            password_hash="system_guest_no_login",
            role="citizen"
        )
        db.add(citizen)
        db.commit()
        db.refresh(citizen)
        
    new_ticket = Ticket(
        title=title,
        description=description,
        status="pending",
        priority="high",
        assigned_department_id=dept_id,
        citizen_id=citizen.id,
        ai_confidence=1.0
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    
    session.associated_ticket_id = new_ticket.id
    session.status = "escalated"
    db.commit()
    
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="CHAT_ESCALATED_TICKET",
        payload_dict={"chat_session_id": session_id, "ticket_id": new_ticket.id}
    )
    
    # Attach telemetry fields
    from app.api.tickets import attach_telemetry_fields
    return attach_telemetry_fields(new_ticket, db)


# --- DEPARTMENT HEAD ENDPOINTS ---

@router.get("/dept/sessions", response_model=List[ChatSessionResponse])
def get_dept_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Department Head fetches chats routed to them.
    """
    if current_user.role != "dept_admin":
        raise HTTPException(status_code=403, detail="Not authorized. Department access required.")
        
    return db.query(ChatSession).filter(
        ChatSession.assigned_department_id == current_user.department_id
    ).all()

@router.post("/dept/sessions/{session_id}/message", response_model=ChatMessageResponse)
def send_dept_message(
    session_id: int,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Department head chats back with the citizen.
    """
    if current_user.role != "dept_admin":
        raise HTTPException(status_code=403, detail="Not authorized.")
        
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.assigned_department_id == current_user.department_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Assigned chat session not found")
        
    msg = ChatMessage(
        chat_session_id=session.id,
        sender_role="department",
        sender_name=f"{current_user.name} ({get_dept_name_helper(current_user.department_id, db)})",
        message=payload.message,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

@router.post("/dept/sessions/{session_id}/escalate", response_model=TicketResponse)
def escalate_chat_to_ticket_dept(
    session_id: int,
    payload: dict, # {"title": str}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Department head creates a ticket directly in their department based on the chat transcript.
    """
    if current_user.role != "dept_admin":
        raise HTTPException(status_code=403, detail="Not authorized.")
        
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.assigned_department_id == current_user.department_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Assigned chat session not found")
        
    title = payload.get("title", f"Dept Case: {session.citizen_name}")
    
    # Consolidate transcript
    transcript_lines = []
    for msg in session.messages:
        transcript_lines.append(f"[{msg.timestamp.strftime('%H:%M')}] {msg.sender_name}: {msg.message}")
    description = "\n".join(transcript_lines)
    
    citizen = db.query(User).filter(User.role == "citizen").first()
    if not citizen:
        citizen = User(
            name="Guest Citizen",
            email="guest_chat@egov.gov.np",
            password_hash="system_guest_no_login",
            role="citizen"
        )
        db.add(citizen)
        db.commit()
        db.refresh(citizen)
        
    new_ticket = Ticket(
        title=title,
        description=description,
        status="pending",
        priority="medium",
        assigned_department_id=current_user.department_id,
        citizen_id=citizen.id,
        ai_confidence=1.0
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    
    session.associated_ticket_id = new_ticket.id
    session.status = "escalated"
    db.commit()
    
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="CHAT_ESCALATED_BY_DEPT",
        payload_dict={"chat_session_id": session_id, "ticket_id": new_ticket.id}
    )
    
    from app.api.tickets import attach_telemetry_fields
    return attach_telemetry_fields(new_ticket, db)


# --- HELPER FUNCTIONS ---

def get_dept_name_helper(dept_id: int, db: Session) -> str:
    dept = db.query(Department).filter(Department.id == dept_id).first()
    return dept.name if dept else "Water/Roads/Waste"
