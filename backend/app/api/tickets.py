from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
import shutil
from app.db import get_db
from app.models import Ticket, Department, User, TicketAttachment
from app.schemas import TicketResponse, TicketUpdate, TicketStatusUpdate
from app.api.auth_utils import get_current_user
from app.classifier import get_reasoning_keywords
from app.email_utils import send_mock_email

router = APIRouter(prefix="/tickets", tags=["Tickets"])

ALLOWED_PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_VIDEO_EXTS = {".mp4", ".mov"}
ALLOWED_AUDIO_EXTS = {".mp3", ".wav", ".m4a"}

def save_uploaded_files(ticket_id: int, files: Optional[List[UploadFile]], db: Session):
    if not files:
        return
    script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    uploads_dir = os.path.join(script_dir, "..", "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    
    for file in files:
        if not file.filename:
            continue
        ext = os.path.splitext(file.filename)[1].lower()
        if ext in ALLOWED_PHOTO_EXTS:
            file_type = "photo"
        elif ext in ALLOWED_VIDEO_EXTS:
            file_type = "video"
        elif ext in ALLOWED_AUDIO_EXTS:
            file_type = "audio"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {file.filename}. Only images, videos (mp4/mov), and audios (mp3/wav/m4a) are allowed."
            )
        filename = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(uploads_dir, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        relative_path = f"/uploads/{filename}"
        attachment = TicketAttachment(
            ticket_id=ticket_id,
            file_path=relative_path,
            file_type=file_type
        )
        db.add(attachment)
    db.commit()

def save_proof_files(ticket_id: int, files: Optional[List[UploadFile]], db: Session):
    if not files:
        return
    script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    proof_dir = os.path.join(script_dir, "..", "uploads", "proof")
    os.makedirs(proof_dir, exist_ok=True)
    
    for file in files:
        if not file.filename:
            continue
        ext = os.path.splitext(file.filename)[1].lower()
        if ext in ALLOWED_PHOTO_EXTS:
            file_type = "photo"
        elif ext in ALLOWED_VIDEO_EXTS:
            file_type = "video"
        elif ext in ALLOWED_AUDIO_EXTS:
            file_type = "audio"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {file.filename}. Only images, videos (mp4/mov), and audios (mp3/wav/m4a) are allowed."
            )
        filename = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(proof_dir, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        relative_path = f"/uploads/proof/{filename}"
        attachment = TicketAttachment(
            ticket_id=ticket_id,
            file_path=relative_path,
            file_type=file_type,
            is_proof=True
        )
        db.add(attachment)
    db.commit()

def attach_telemetry_fields(ticket: Ticket, db: Session):
    if ticket:
        ticket.reasoning_keywords = get_reasoning_keywords(ticket.title, ticket.description, ticket.assigned_department_id, db)
    return ticket

def attach_telemetry_fields_list(tickets: List[Ticket], db: Session):
    for t in tickets:
        attach_telemetry_fields(t, db)
    return tickets

@router.post("/", response_model=TicketResponse, status_code=status.HTTP_202_ACCEPTED)
def create_ticket(
    title: str = Form(...),
    description: str = Form(...),
    priority: str = Form("medium"),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    if current_user.role != "citizen":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only citizens can submit tickets."
        )
        
    new_ticket = Ticket(
        citizen_id=current_user.id,
        title=title,
        description=description,
        assigned_department_id=None,
        ai_confidence=0.0,
        priority=priority,
        status="processing",
        needs_verification=False
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    
    if files:
        save_uploaded_files(new_ticket.id, files, db)
        db.refresh(new_ticket)
    
    # Dispatch Celery background task
    from app.tasks import classify_ticket_task
    classify_ticket_task.delay(new_ticket.id)
    
    if background_tasks:
        background_tasks.add_task(
            send_mock_email,
            current_user.email,
            f"Ticket Filed Successfully - #{new_ticket.id}",
            f"Hello {current_user.name},\n\nYour grievance titled '{new_ticket.title}' has been successfully filed in the E-Governance portal.\n\nTicket ID: #{new_ticket.id}\nStatus: Processing\n\nThank you,\nE-Governance Helpdesk Team"
        )
    
    return attach_telemetry_fields(new_ticket, db)

@router.post("/create", response_model=TicketResponse, status_code=status.HTTP_202_ACCEPTED)
def create_ticket_explicit(
    title: str = Form(...),
    description: str = Form(...),
    priority: str = Form("medium"),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    if current_user.role != "citizen":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only citizens can submit tickets."
        )
        
    new_ticket = Ticket(
        citizen_id=current_user.id,
        title=title,
        description=description,
        assigned_department_id=None,
        ai_confidence=0.0,
        priority=priority,
        status="processing",
        needs_verification=False
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    
    if files:
        save_uploaded_files(new_ticket.id, files, db)
        db.refresh(new_ticket)
    
    # Dispatch Celery background task
    from app.tasks import classify_ticket_task
    classify_ticket_task.delay(new_ticket.id)
    
    if background_tasks:
        background_tasks.add_task(
            send_mock_email,
            current_user.email,
            f"Ticket Filed Successfully - #{new_ticket.id}",
            f"Hello {current_user.name},\n\nYour grievance titled '{new_ticket.title}' has been successfully filed in the E-Governance portal.\n\nTicket ID: #{new_ticket.id}\nStatus: Processing\n\nThank you,\nE-Governance Helpdesk Team"
        )
    
    return attach_telemetry_fields(new_ticket, db)

@router.get("/", response_model=List[TicketResponse])
def get_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "super_admin":
        res = db.query(Ticket).all()
    elif current_user.role == "dept_admin":
        if not current_user.department_id:
            return []
        res = db.query(Ticket).filter(Ticket.assigned_department_id == current_user.department_id).all()
    else:
        res = db.query(Ticket).filter(Ticket.citizen_id == current_user.id).all()
    return attach_telemetry_fields_list(res, db)

@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    if current_user.role == "citizen" and ticket.citizen_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this ticket"
        )
    elif current_user.role == "dept_admin" and ticket.assigned_department_id != current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this ticket"
        )
    return attach_telemetry_fields(ticket, db)

@router.get("/{ticket_id}/explain")
def explain_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    keywords = get_reasoning_keywords(ticket.title, ticket.description, ticket.assigned_department_id, db)
    weights = [0.55, 0.30, 0.15]
    reasoning_details = []
    for idx, kw in enumerate(keywords):
        wt = weights[idx] if idx < len(weights) else 0.10
        reasoning_details.append({"keyword": kw, "weight": wt})
        
    return {
        "ticket_id": ticket_id,
        "reasoning_keywords": reasoning_details,
        "assigned_department_id": ticket.assigned_department_id,
        "ai_confidence": ticket.ai_confidence
    }

@router.patch("/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id: int,
    ticket_update: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
        
    if current_user.role == "citizen":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens cannot modify ticket routing or status."
        )
    elif current_user.role == "dept_admin":
        if ticket.assigned_department_id != current_user.department_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only manage tickets assigned to your department."
            )
        if ticket_update.assigned_department_id is not None or ticket_update.ai_confidence is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Department admins cannot re-assign departments or modify AI confidence scores."
            )
        if ticket_update.status is not None:
            ticket.status = ticket_update.status
        if ticket_update.priority is not None:
            ticket.priority = ticket_update.priority
    elif current_user.role == "super_admin":
        if ticket_update.status is not None:
            ticket.status = ticket_update.status
        if ticket_update.priority is not None:
            ticket.priority = ticket_update.priority
        if ticket_update.assigned_department_id is not None:
            ticket.assigned_department_id = ticket_update.assigned_department_id
        if ticket_update.ai_confidence is not None:
            ticket.ai_confidence = ticket_update.ai_confidence
            
    db.commit()
    db.refresh(ticket)
    return attach_telemetry_fields(ticket, db)

@router.get("/department/{dept_id}", response_model=List[TicketResponse])
def get_department_tickets(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["dept_admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Insufficient permissions."
        )
    if current_user.role == "dept_admin" and current_user.department_id != dept_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You can only view tickets for your assigned department."
        )
    res = db.query(Ticket).filter(Ticket.assigned_department_id == dept_id).all()
    return attach_telemetry_fields_list(res, db)

@router.put("/{ticket_id}/status", response_model=TicketResponse)
def update_ticket_status_explicit(
    ticket_id: int,
    status: str = Form(...),
    remarks: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found"
        )
    if current_user.role == "citizen":
        raise HTTPException(
            status_code=403,
            detail="Citizens cannot modify ticket status or remarks."
        )
    if current_user.role == "dept_admin" and ticket.assigned_department_id != current_user.department_id:
        raise HTTPException(
            status_code=403,
            detail="You can only manage tickets assigned to your department."
        )
        
    if status not in ["processing", "pending", "in_progress", "resolved"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Must be one of processing, pending, in_progress, resolved."
        )
        
    # Enforce media proof validation for resolved status
    if status == "resolved":
        if not files or all(f.filename == "" for f in files):
            raise HTTPException(
                status_code=400,
                detail="Resolution proof is mandatory when status is set to Resolved."
            )
            
    # Save proof files if status is resolved
    if status == "resolved" and files:
        save_proof_files(ticket.id, files, db)
        
    old_status = ticket.status
    ticket.status = status
    ticket.remarks = remarks
    
    db.commit()
    db.refresh(ticket)
    
    # Send email notifications based on status transition
    citizen = db.query(User).filter(User.id == ticket.citizen_id).first()
    if citizen and background_tasks:
        if status == "in_progress" and old_status != "in_progress":
            background_tasks.add_task(
                send_mock_email,
                citizen.email,
                f"Your Grievance is Under Active Review - #{ticket.id}",
                f"Hello {citizen.name},\n\nYour grievance titled '{ticket.title}' (ID: #{ticket.id}) status has been updated to In Progress.\n\nRemarks: {remarks or 'No remarks provided.'}\n\nThank you,\nE-Governance Helpdesk Team"
            )
        elif status == "resolved" and old_status != "resolved":
            # Fetch resolution proofs
            proof_attachments = db.query(TicketAttachment).filter(
                TicketAttachment.ticket_id == ticket.id,
                TicketAttachment.is_proof == True
            ).all()
            proof_links = "\n".join([f"- http://localhost:8000{att.file_path}" for att in proof_attachments])
            
            background_tasks.add_task(
                send_mock_email,
                citizen.email,
                f"Grievance Resolved - #{ticket.id}",
                f"Hello {citizen.name},\n\nYour grievance titled '{ticket.title}' (ID: #{ticket.id}) has been successfully resolved.\n\nResolution Remarks:\n{remarks or 'No remarks provided.'}\n\nResolution Proof Links:\n{proof_links or 'No links available.'}\n\nThank you,\nE-Governance Helpdesk Team"
            )
            
    return attach_telemetry_fields(ticket, db)

@router.get("/public/stats")
def get_public_stats(db: Session = Depends(get_db)):
    total = db.query(Ticket).count()
    pending = db.query(Ticket).filter(Ticket.status == "pending").count()
    in_progress = db.query(Ticket).filter(Ticket.status == "in_progress").count()
    resolved = db.query(Ticket).filter(Ticket.status == "resolved").count()
    return {
        "total": total,
        "pending": pending,
        "in_progress": in_progress,
        "resolved": resolved
    }

@router.get("/public/feed")
def get_public_feed(db: Session = Depends(get_db)):
    tickets = db.query(Ticket).order_by(Ticket.created_at.desc()).all()
    feed = []
    for t in tickets:
        feed.append({
            "id": t.id,
            "title": t.title,
            "assigned_department_id": t.assigned_department_id,
            "status": t.status,
            "created_at": t.created_at
        })
    return feed

@router.get("/public/{ticket_id}/proof")
def get_public_ticket_proof(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status != "resolved":
        raise HTTPException(status_code=400, detail="Ticket is not resolved")
    
    proofs = db.query(TicketAttachment).filter(
        TicketAttachment.ticket_id == ticket_id,
        TicketAttachment.is_proof == True
    ).all()
    
    attachments_data = []
    for p in proofs:
        attachments_data.append({
            "id": p.id,
            "ticket_id": p.ticket_id,
            "file_path": p.file_path,
            "file_type": p.file_type,
            "is_proof": p.is_proof
        })
        
    return {
        "ticket_id": ticket_id,
        "title": ticket.title,
        "remarks": ticket.remarks,
        "attachments": attachments_data
    }
