from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
import shutil
import datetime
import io
import csv
from app.db import get_db
from app.models import Ticket, Department, User, TicketAttachment, Notification, ProofRequest
from app.schemas import TicketResponse, TicketUpdate, TicketStatusUpdate, TicketAssignRequest
from app.api.auth_utils import get_current_user
from app.classifier import get_reasoning_keywords
from app.email_utils import send_mock_email
from app.utils.audit import log_audit_event

router = APIRouter(prefix="/tickets", tags=["Tickets"])

ALLOWED_PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_VIDEO_EXTS = {".mp4", ".mov"}
ALLOWED_AUDIO_EXTS = {".mp3", ".wav", ".m4a"}
ALLOWED_DOC_EXTS = {".txt", ".pdf", ".doc", ".docx"}

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
        elif ext in ALLOWED_DOC_EXTS:
            file_type = "document"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {file.filename}. Only images, videos, audios, and documents (txt/pdf/doc) are allowed."
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
        elif ext in ALLOWED_DOC_EXTS:
            file_type = "document"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {file.filename}. Only images, videos, audios, and documents (txt/pdf/doc) are allowed."
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
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
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
        needs_verification=False,
        latitude=latitude,
        longitude=longitude
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
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
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
        needs_verification=False,
        latitude=latitude,
        longitude=longitude
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

@router.get("/proof-requests")
def get_proof_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models import ProofRequest
    
    query = db.query(ProofRequest)
    if current_user.role == "citizen":
        query = query.filter(ProofRequest.citizen_id == current_user.id)
    elif current_user.role == "dept_admin":
        if not current_user.department_id:
            return []
        query = query.join(Ticket, ProofRequest.ticket_id == Ticket.id).filter(Ticket.assigned_department_id == current_user.department_id)
        
    requests = query.all()
    result = []
    for r in requests:
        result.append({
            "id": r.id,
            "ticket_id": r.ticket_id,
            "status": r.status,
            "created_at": r.created_at,
            "citizen_name": r.citizen.name if r.citizen else "Unknown",
            "citizen_email": r.citizen.email if r.citizen else "Unknown",
            "ticket_title": r.ticket.title if r.ticket else "Unknown"
        })
    return result

@router.post("/proof-requests/{req_id}/fulfill")
def fulfill_proof_request(
    req_id: int,
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models import ProofRequest
    proof_req = db.query(ProofRequest).filter(ProofRequest.id == req_id).first()
    if not proof_req:
        raise HTTPException(status_code=404, detail="Proof request not found")
    
    if current_user.role not in ["super_admin", "dept_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to upload proof")
        
    proof_req.status = "fulfilled"
    
    if files:
        save_proof_files(proof_req.ticket_id, files, db)
        
    db.commit()
    return {"status": "success", "message": "Proof uploaded successfully"}

@router.get("/", response_model=List[TicketResponse])
def get_tickets(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Ticket)
    
    if current_user.role == "super_admin":
        pass # Can see all
    elif current_user.role == "dept_admin":
        if not current_user.department_id:
            return []
        query = query.filter(Ticket.assigned_department_id == current_user.department_id)
    else:
        query = query.filter(Ticket.citizen_id == current_user.id)
        
    if status:
        query = query.filter(Ticket.status == status)
        
    res = query.all()
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

    # Audit Logging
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="TICKET_UPDATE",
        payload_dict={
            "ticket_id": ticket.id,
            "new_status": ticket.status,
            "new_priority": ticket.priority,
            "new_department_id": ticket.assigned_department_id
        }
    )

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
    report: Optional[str] = Form(None),
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
        
    if status not in ["processing", "pending", "in_progress", "resolved", "sla_violated", "Under Re-evaluation"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Must be one of processing, pending, in_progress, resolved, sla_violated, Under Re-evaluation."
        )
        
    # Enforce media proof and text report validation for resolved status
    if status == "resolved":
        if not report or report.strip() == "":
            raise HTTPException(
                status_code=400,
                detail="A text resolution report is mandatory when status is set to Resolved."
            )
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
    if status == "resolved":
        ticket.report = report
    
    db.commit()
    db.refresh(ticket)
    
    # Audit Logging
    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="TICKET_STATUS_EXPLICIT",
        payload_dict={
            "ticket_id": ticket.id,
            "old_status": old_status,
            "new_status": ticket.status,
            "remarks": ticket.remarks,
            "report": ticket.report
        }
    )
    
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

@router.post("/{ticket_id}/feedback", response_model=TicketResponse)
def submit_ticket_feedback(
    ticket_id: int,
    satisfied: bool = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if current_user.role != "citizen" or ticket.citizen_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the reporting citizen can submit feedback for this ticket.")
        
    if ticket.status != "resolved":
        raise HTTPException(status_code=400, detail="Feedback can only be submitted for resolved tickets.")
        
    ticket.citizen_satisfied = satisfied
    
    super_admins = db.query(User).filter(User.role == "super_admin", User.status == "active").all()
    dept_admins = db.query(User).filter(User.role == "dept_admin", User.department_id == ticket.assigned_department_id, User.status == "active").all() if ticket.assigned_department_id else []
    notify_users = super_admins + dept_admins

    if satisfied:
        # Notify admins that user is satisfied
        for u in notify_users:
            notification = Notification(
                user_id=u.id,
                ticket_id=ticket.id,
                category="system",
                message=f"Citizen confirmed resolution for Ticket #{ticket.id}."
            )
            db.add(notification)
    else:
        ticket.status = "Under Re-evaluation"
        ticket.reopened = True
        
        # Notify admins that user reopened
        for u in notify_users:
            notification = Notification(
                user_id=u.id,
                ticket_id=ticket.id,
                category="sla_alert",
                message=f"Action Required: Citizen was NOT satisfied and reopened Ticket #{ticket.id}. Status changed to Under Re-evaluation."
            )
            db.add(notification)
            if background_tasks:
                background_tasks.add_task(
                    send_mock_email,
                    u.email,
                    f"Ticket #{ticket.id} Reopened by Citizen",
                    f"Hello {u.name},\n\nTicket #{ticket.id} ('{ticket.title}') was reopened because the citizen was not satisfied with the resolution.\n\nPlease review and request clarification if needed."
                )

        # Audit Logging
        log_audit_event(
            db=db,
            user_id=current_user.id,
            action="TICKET_REOPENED_CITIZEN",
            payload_dict={
                "ticket_id": ticket.id,
                "reason": "Citizen not satisfied with resolution",
                "new_status": ticket.status
            }
        )
        
    db.commit()
    db.refresh(ticket)
    return attach_telemetry_fields(ticket, db)

def save_clarification_files(clarification_id: int, ticket_id: int, files: Optional[List[UploadFile]], db: Session):
    if not files:
        return
    script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    uploads_dir = os.path.join(script_dir, "..", "uploads", "clarifications")
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
        elif ext in ALLOWED_DOC_EXTS:
            file_type = "document"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {file.filename}."
            )
        filename = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(uploads_dir, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        relative_path = f"/uploads/clarifications/{filename}"
        attachment = TicketAttachment(
            ticket_id=ticket_id,
            clarification_id=clarification_id,
            file_path=relative_path,
            file_type=file_type,
            is_proof=False
        )
        db.add(attachment)
    db.commit()

from app.models import TicketClarification

@router.get("/{ticket_id}/clarifications")
def get_ticket_clarifications(ticket_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    clarifications = db.query(TicketClarification).filter(TicketClarification.ticket_id == ticket_id).order_by(TicketClarification.created_at.asc()).all()
    
    result = []
    for c in clarifications:
        attachments = db.query(TicketAttachment).filter(TicketAttachment.clarification_id == c.id).all()
        result.append({
            "id": c.id,
            "ticket_id": c.ticket_id,
            "sender_id": c.sender_id,
            "message": c.message,
            "created_at": c.created_at,
            "sender": {"id": c.sender.id, "name": c.sender.name, "role": c.sender.role} if c.sender else None,
            "attachments": [{"id": a.id, "file_path": a.file_path, "file_type": a.file_type} for a in attachments]
        })
    return result

@router.post("/{ticket_id}/clarifications")
def post_ticket_clarification(
    ticket_id: int,
    message: str = Form(...),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    clarification = TicketClarification(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        message=message
    )
    db.add(clarification)
    db.commit()
    db.refresh(clarification)
    
    if files:
        save_clarification_files(clarification.id, ticket.id, files, db)
        
    # Notifications
    if current_user.role == "citizen":
        # Notify admins
        admins = db.query(User).filter(
            User.role.in_(["super_admin", "dept_admin"]),
            User.status == "active"
        ).all()
        for u in admins:
            if u.role == "dept_admin" and u.department_id != ticket.assigned_department_id:
                continue
            notif = Notification(user_id=u.id, ticket_id=ticket.id, category="system", message=f"Citizen replied to clarification on Ticket #{ticket.id}")
            db.add(notif)
    else:
        # Notify citizen
        notif = Notification(user_id=ticket.citizen_id, ticket_id=ticket.id, category="system", message=f"Admin requested clarification on Ticket #{ticket.id}")
        db.add(notif)
        if background_tasks:
            citizen = db.query(User).filter(User.id == ticket.citizen_id).first()
            if citizen:
                background_tasks.add_task(
                    send_mock_email,
                    citizen.email,
                    f"Clarification Requested - Ticket #{ticket.id}",
                    f"Hello {citizen.name},\n\nAn administrator has requested clarification on your reopened ticket #{ticket.id}.\n\nMessage: {message}\n\nPlease log in to respond."
                )
    
    db.commit()
    return {"status": "success", "clarification_id": clarification.id}


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

@router.get("/export")
def export_tickets_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only Super Admins can export data.")
        
    tickets = db.query(Ticket).all()
    
    # Generate CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Title', 'Status', 'Priority', 'Department ID', 'Created At'])
    
    for t in tickets:
        writer.writerow([
            t.id,
            t.title,
            t.status,
            t.priority,
            t.assigned_department_id,
            t.created_at.isoformat()
        ])
        
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=grievances_export.csv"}
    )

@router.get("/public/feed")
def get_public_feed(limit: Optional[int] = 8, db: Session = Depends(get_db)):
    query = db.query(Ticket).order_by(Ticket.created_at.desc())
    if limit and limit > 0:
        query = query.limit(limit)
    tickets = query.all()
    feed = []
    for t in tickets:
        proof_count = db.query(TicketAttachment).filter(
            TicketAttachment.ticket_id == t.id,
            TicketAttachment.is_proof == True
        ).count()
        feed.append({
            "id": t.id,
            "title": t.title,
            "assigned_department_id": t.assigned_department_id,
            "status": t.status,
            "created_at": t.created_at,
            "sla_violated": t.sla_violated,
            "proof_requested_at": t.proof_requested_at,
            "has_proof": proof_count > 0 or bool(t.report),
            "report": t.report,
            "latitude": t.latitude,
            "longitude": t.longitude
        })
    return feed

@router.get("/public/all")
def get_public_all_grievances(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    query = db.query(Ticket)
    
    # Keyword / Ticket ID search
    if search:
        search_term = search.strip()
        # Check if searching by ticket ID (e.g. "T-5" or just "5")
        ticket_id_search = search_term.replace("T-", "").replace("#", "").strip()
        if ticket_id_search.isdigit():
            query = query.filter(Ticket.id == int(ticket_id_search))
        else:
            query = query.filter(Ticket.title.ilike(f"%{search_term}%"))
    
    # Status checkboxes filter (comma-separated: "pending,in_progress,resolved")
    if status_filter:
        statuses = [s.strip() for s in status_filter.split(",") if s.strip()]
        if statuses:
            query = query.filter(Ticket.status.in_(statuses))
    
    total = query.count()
    offset = (page - 1) * page_size
    tickets = query.order_by(Ticket.created_at.desc()).offset(offset).limit(page_size).all()
    
    feed = []
    for t in tickets:
        proof_count = db.query(TicketAttachment).filter(
            TicketAttachment.ticket_id == t.id,
            TicketAttachment.is_proof == True
        ).count()
        feed.append({
            "id": t.id,
            "title": t.title,
            "assigned_department_id": t.assigned_department_id,
            "status": t.status,
            "created_at": t.created_at,
            "sla_violated": t.sla_violated,
            "proof_requested_at": t.proof_requested_at,
            "has_proof": proof_count > 0 or bool(t.report),
            "report": t.report,
            "latitude": t.latitude,
            "longitude": t.longitude
        })
    return {
        "tickets": feed,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }

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
        "report": ticket.report,
        "attachments": attachments_data
    }

@router.post("/{ticket_id}/request-proof")
def request_proof(
    ticket_id: int,
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status != "resolved":
        raise HTTPException(status_code=400, detail="Proof can only be requested for resolved tickets")
    
    # Check if proof already exists
    existing_proof = db.query(TicketAttachment).filter(
        TicketAttachment.ticket_id == ticket_id,
        TicketAttachment.is_proof == True
    ).first()
    if existing_proof:
        raise HTTPException(status_code=400, detail="Resolution proof already exists for this ticket")
    
    # 1. Update proof_requested_at timestamp
    ticket.proof_requested_at = datetime.datetime.utcnow()
    
    # 1b. Create ProofRequest record
    existing_pr = db.query(ProofRequest).filter(ProofRequest.ticket_id == ticket_id).first()
    if not existing_pr:
        new_pr = ProofRequest(
            ticket_id=ticket.id,
            citizen_id=ticket.citizen_id,
            status="pending"
        )
        db.add(new_pr)

    db.commit()
    db.refresh(ticket)
    
    # 2. Inject Department Head notification
    if ticket.assigned_department_id:
        dept_head = db.query(User).filter(
            User.department_id == ticket.assigned_department_id,
            User.dept_role == "Department Head",
            User.status == "active"
        ).first()
        if dept_head:
            head_notification = Notification(
                user_id=dept_head.id,
                ticket_id=ticket.id,
                category="proof_request",
                message=f"Action Required: Public has requested proof for Ticket #{ticket.id} — '{ticket.title}'. Upload resolution evidence within 24 hours."
            )
            db.add(head_notification)
            send_mock_email(
                dept_head.email,
                f"Proof of Resolution Requested - Ticket #{ticket.id}",
                f"Hello {dept_head.name},\n\nA proof of resolution has been requested for ticket #{ticket.id} titled '{ticket.title}'.\n\nPlease upload the resolution proof within 24 hours to avoid SLA violation.\n\nThank you,\nE-Governance Helpdesk Team"
            )
        
        # Also notify all other dept admins via email
        other_admins = db.query(User).filter(
            User.department_id == ticket.assigned_department_id,
            User.role == "dept_admin",
            User.status == "active",
            User.dept_role != "Department Head"
        ).all()
        for admin in other_admins:
            send_mock_email(
                admin.email,
                f"Proof of Resolution Requested - Ticket #{ticket.id}",
                f"Hello {admin.name},\n\nA proof of resolution has been requested for ticket #{ticket.id} titled '{ticket.title}'.\n\nPlease coordinate with your Department Head.\n\nThank you,\nE-Governance Helpdesk Team"
            )
    
    # 3. Inject Super Admin Compliance Audit Log entry
    super_admins = db.query(User).filter(
        User.role == "super_admin",
        User.status == "active"
    ).all()
    dept_name = ticket.assigned_department.name if ticket.assigned_department else "Unknown"
    for sa_user in super_admins:
        audit_notification = Notification(
            user_id=sa_user.id,
            ticket_id=ticket.id,
            category="compliance_audit",
            message=f"SLA Compliance Watch: Proof requested for Ticket #{ticket.id} ('{ticket.title}') assigned to {dept_name}. 24-hour window initiated at {ticket.proof_requested_at.strftime('%Y-%m-%d %H:%M UTC')}."
        )
        db.add(audit_notification)
    
    db.commit()
    
    return {"detail": "Proof request sent successfully. Department Head and Super Admin have been notified.", "proof_requested_at": ticket.proof_requested_at}


@router.get("/proof-requests")
def get_proof_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["super_admin", "dept_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to view proof requests")
    
    query = db.query(ProofRequest).join(Ticket).order_by(ProofRequest.created_at.desc())
    
    if current_user.role == "dept_admin":
        query = query.filter(Ticket.assigned_department_id == current_user.department_id)
        
    prs = query.all()
    
    result = []
    for pr in prs:
        result.append({
            "id": pr.id,
            "ticket_id": pr.ticket_id,
            "citizen_id": pr.citizen_id,
            "ticket_title": pr.ticket.title,
            "citizen_name": pr.citizen.name,
            "status": pr.status,
            "created_at": pr.created_at
        })
    return result

@router.get("/sla-violations")
def get_sla_violations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can view SLA violations")
    
    violated_tickets = db.query(Ticket).filter(
        Ticket.proof_requested_at.isnot(None),
        Ticket.sla_violated == True
    ).order_by(Ticket.proof_requested_at.desc()).all()
    
    result = []
    for t in violated_tickets:
        dept_name = None
        if t.assigned_department:
            dept_name = t.assigned_department.name
        result.append({
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "assigned_department_id": t.assigned_department_id,
            "department_name": dept_name,
            "proof_requested_at": t.proof_requested_at,
            "sla_violated": t.sla_violated
        })
    return result

@router.post("/{ticket_id}/send-explanation-notice")
def send_explanation_notice(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admins can send explanation notices")
    
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if not ticket.sla_violated:
        raise HTTPException(status_code=400, detail="Ticket is not in SLA violation state")
    
    # Send notice to all admins of the assigned department
    if ticket.assigned_department_id:
        dept_admins = db.query(User).filter(
            User.department_id == ticket.assigned_department_id,
            User.role == "dept_admin"
        ).all()
        dept = ticket.assigned_department
        for admin in dept_admins:
            send_mock_email(
                admin.email,
                f"URGENT: Explanation Notice for SLA Violation - Ticket #{ticket.id}",
                f"Hello {admin.name},\n\nThis is an official explanation notice regarding SLA violation for ticket #{ticket.id} titled '{ticket.title}'.\n\nYour department ({dept.name if dept else 'Unknown'}) has failed to provide resolution proof within the mandated 24-hour window.\n\nPlease provide an explanation and upload the required proof immediately.\n\nThis notice has been logged by Super Admin ({current_user.name}).\n\nE-Governance Helpdesk Administration"
            )
    
    return {"detail": f"Explanation notice sent to department admins for ticket #{ticket_id}"}


@router.post("/{ticket_id}/assign", response_model=TicketResponse)
def assign_ticket(
    ticket_id: int,
    req: TicketAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if current_user.role == "super_admin":
        pass
    elif current_user.role == "dept_admin" and current_user.dept_role == "Department Head":
        if ticket.assigned_department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="You can only assign tickets within your department.")
    else:
        raise HTTPException(status_code=403, detail="Only Department Heads or Super Admins can assign staff.")
        
    if req.assigned_employee_id:
        employee = db.query(User).filter(User.id == req.assigned_employee_id).first()
        if not employee or employee.role != "dept_admin":
            raise HTTPException(status_code=400, detail="Invalid employee ID.")
        if ticket.assigned_department_id and employee.department_id != ticket.assigned_department_id:
            raise HTTPException(status_code=400, detail="Employee must belong to the ticket's assigned department.")
        ticket.assigned_employee_id = req.assigned_employee_id
    else:
        ticket.assigned_employee_id = None
        
    db.commit()
    db.refresh(ticket)
    return attach_telemetry_fields(ticket, db)


@router.post("/{ticket_id}/request-reassignment", response_model=TicketResponse)
def request_reassignment(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.citizen_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the filing citizen can request officer changes.")
        
    ticket.reassignment_requested = True
    db.commit()
    db.refresh(ticket)
    return attach_telemetry_fields(ticket, db)


@router.post("/{ticket_id}/re-evaluate", response_model=TicketResponse)
def re_evaluate_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.citizen_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the filing citizen can request re-evaluation.")
    if ticket.status != "resolved":
        raise HTTPException(status_code=400, detail="Only resolved tickets can be re-evaluated.")
        
    ticket.status = "Under Re-evaluation"
    ticket.reassignment_requested = False
    db.commit()
    db.refresh(ticket)
    
    dept_head = db.query(User).filter(
        User.department_id == ticket.assigned_department_id,
        User.dept_role == "Department Head"
    ).first()
    if dept_head and background_tasks:
        background_tasks.add_task(
            send_mock_email,
            dept_head.email,
            f"Re-evaluation Requested - Ticket #{ticket.id}",
            f"Hello {dept_head.name},\n\nThe citizen has requested a re-evaluation for Ticket #{ticket.id} ('{ticket.title}').\n\nPlease review the case.\n\nThank you,\nE-Governance Helpdesk Team"
        )
        
    return attach_telemetry_fields(ticket, db)


@router.get("/notifications")
def get_my_notifications(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch notifications for the current user, optionally filtered by category."""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if category:
        query = query.filter(Notification.category == category)
    notifications = query.order_by(Notification.created_at.desc()).limit(50).all()
    return [
        {
            "id": n.id,
            "ticket_id": n.ticket_id,
            "category": n.category,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at
        }
        for n in notifications
    ]


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read."""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"detail": "Notification marked as read"}

 
 @ r o u t e r . d e l e t e ( " / { t i c k e t _ i d } " ) 
 d e f   d e l e t e _ t i c k e t ( 
         t i c k e t _ i d :   i n t , 
         d b :   S e s s i o n   =   D e p e n d s ( g e t _ d b ) , 
         c u r r e n t _ u s e r :   U s e r   =   D e p e n d s ( g e t _ c u r r e n t _ u s e r ) 
 ) : 
         " " " D e l e t e   a   t i c k e t   ( S u p e r   A d m i n   a n d   D e p t   A d m i n   o n l y ) . " " " 
         i f   c u r r e n t _ u s e r . r o l e   n o t   i n   [ " s u p e r _ a d m i n " ,   " d e p t _ a d m i n " ] : 
                 r a i s e   H T T P E x c e p t i o n ( s t a t u s _ c o d e = 4 0 3 ,   d e t a i l = " N o t   a u t h o r i z e d   t o   d e l e t e   t i c k e t s " ) 
                 
         t i c k e t   =   d b . q u e r y ( T i c k e t ) . f i l t e r ( T i c k e t . i d   = =   t i c k e t _ i d ) . f i r s t ( ) 
         i f   n o t   t i c k e t : 
                 r a i s e   H T T P E x c e p t i o n ( s t a t u s _ c o d e = 4 0 4 ,   d e t a i l = " T i c k e t   n o t   f o u n d " ) 
                 
         i f   c u r r e n t _ u s e r . r o l e   = =   " d e p t _ a d m i n "   a n d   t i c k e t . a s s i g n e d _ d e p a r t m e n t _ i d   ! =   c u r r e n t _ u s e r . d e p a r t m e n t _ i d : 
                 r a i s e   H T T P E x c e p t i o n ( s t a t u s _ c o d e = 4 0 3 ,   d e t a i l = " N o t   a u t h o r i z e d   t o   d e l e t e   t i c k e t s   f o r   o t h e r   d e p a r t m e n t s " ) 
                 
         #   A u d i t   L o g g i n g 
         l o g _ a u d i t _ e v e n t ( 
                 d b = d b , 
                 u s e r _ i d = c u r r e n t _ u s e r . i d , 
                 a c t i o n = " T I C K E T _ D E L E T E D " , 
                 p a y l o a d _ d i c t = { 
                         " t i c k e t _ i d " :   t i c k e t . i d , 
                         " t i t l e " :   t i c k e t . t i t l e 
                 } 
         ) 
         
         d b . d e l e t e ( t i c k e t ) 
         d b . c o m m i t ( ) 
         r e t u r n   { " d e t a i l " :   " T i c k e t   d e l e t e d   s u c c e s s f u l l y " } 
  
 