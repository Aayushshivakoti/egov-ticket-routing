from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db import get_db
from app.models import Ticket, Department, User
from app.schemas import TicketCreate, TicketResponse, TicketUpdate, TicketStatusUpdate
from app.api.auth_utils import get_current_user, require_role
import os
import joblib
from ml.train import preprocess_text

# Load machine learning model and vectorizer once at startup
script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model_path = os.path.join(script_dir, 'ml', 'model.joblib')
vectorizer_path = os.path.join(script_dir, 'ml', 'vectorizer.joblib')

ml_model = None
ml_vectorizer = None

try:
    if os.path.exists(model_path) and os.path.exists(vectorizer_path):
        ml_model = joblib.load(model_path)
        ml_vectorizer = joblib.load(vectorizer_path)
except Exception as e:
    print(f"Error loading ML model in router: {e}")

router = APIRouter(prefix="/tickets", tags=["Tickets"])

def classify_ticket(title: str, description: str, db: Session) -> tuple[Optional[int], float, bool]:
    """
    ML-based classifier to route tickets automatically to departments.
    Returns: (assigned_department_id, confidence, needs_verification)
    """
    content = title + " " + description
    
    # Check if ML model is loaded and vectorizer is ready
    if ml_model is not None and ml_vectorizer is not None:
        try:
            cleaned = preprocess_text(content)
            tfidf_feat = ml_vectorizer.transform([cleaned])
            pred_dept = int(ml_model.predict(tfidf_feat)[0])
            
            # Get confidence score
            probs = ml_model.predict_proba(tfidf_feat)[0]
            class_index = list(ml_model.classes_).index(pred_dept)
            confidence = float(probs[class_index])
            
            if confidence >= 0.65:
                return pred_dept, confidence, False
            else:
                # Route to General Administration (seeded as ID=5 or search by name) and flag for human review
                gen_dept = db.query(Department).filter(Department.name == "General Administration").first()
                gen_id = gen_dept.id if gen_dept else 5
                return gen_id, confidence, True
        except Exception as e:
            print(f"ML classification failed: {e}. Falling back to keywords...")
            
    # Fallback keyword classifier if ML model is not available
    content_lower = content.lower()
    keywords = {
        "Water Supply": ["water", "leak", "pipe", "burst", "flood", "sewage", "drain", "purification", "tap"],
        "Roads & Infrastructure": ["road", "pothole", "street", "pavement", "bridge", "light", "sidewalk", "traffic"],
        "Electricity Authority": ["electricity", "power", "grid", "outage", "blackout", "voltage", "meter", "generator", "shortage"],
        "Waste Management": ["garbage", "trash", "waste", "dumpster", "litter", "rubbish", "cleaning", "dump", "bin"],
        "General Administration": ["license", "permit", "document", "fee", "grievance", "register", "appointment", "inquiry"]
    }
    
    best_dept = None
    max_matches = 0
    
    for dept_name, keys in keywords.items():
        matches = sum(content_lower.count(k) for k in keys)
        if matches > max_matches:
            max_matches = matches
            best_dept = dept_name
            
    if best_dept:
        dept = db.query(Department).filter(Department.name == best_dept).first()
        if dept:
            confidence = min(0.70 + (max_matches * 0.05), 0.98)
            return dept.id, confidence, False
            
    gen_dept = db.query(Department).filter(Department.name == "General Administration").first()
    gen_id = gen_dept.id if gen_dept else 5
    return gen_id, 0.60, True

@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    ticket_in: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "citizen":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only citizens can submit tickets."
        )
        
    # Auto route the ticket using the classifier
    dept_id, confidence, needs_verification = classify_ticket(ticket_in.title, ticket_in.description, db)
    
    new_ticket = Ticket(
        citizen_id=current_user.id,
        title=ticket_in.title,
        description=ticket_in.description,
        assigned_department_id=dept_id,
        ai_confidence=confidence,
        priority=ticket_in.priority,
        status="pending",
        needs_verification=needs_verification
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    return new_ticket

@router.get("/", response_model=List[TicketResponse])
def get_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "super_admin":
        # Super admins can see all tickets
        return db.query(Ticket).all()
        
    elif current_user.role == "dept_admin":
        # Department admins see tickets assigned to their department
        if not current_user.department_id:
            return []
        return db.query(Ticket).filter(Ticket.assigned_department_id == current_user.department_id).all()
        
    else:
        # Citizens see only their own tickets
        return db.query(Ticket).filter(Ticket.citizen_id == current_user.id).all()

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
        
    # Check permissions
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
        
    return ticket

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
        
    # Check permissions and handle modifications
    if current_user.role == "citizen":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizens cannot modify ticket routing or status."
        )
        
    elif current_user.role == "dept_admin":
        # Dept admins can only update tickets assigned to their department
        if ticket.assigned_department_id != current_user.department_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only manage tickets assigned to your department."
            )
        # Dept admins can ONLY update priority and status
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
        # Super admins have full power
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
    return ticket

@router.post("/create", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket_explicit(
    ticket_in: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "citizen":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only citizens can submit tickets."
        )
        
    dept_id, confidence, needs_verification = classify_ticket(ticket_in.title, ticket_in.description, db)
    
    new_ticket = Ticket(
        citizen_id=current_user.id,
        title=ticket_in.title,
        description=ticket_in.description,
        assigned_department_id=dept_id,
        ai_confidence=confidence,
        priority=ticket_in.priority,
        status="pending",
        needs_verification=needs_verification
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    return new_ticket

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
        
    return db.query(Ticket).filter(Ticket.assigned_department_id == dept_id).all()

@router.put("/{ticket_id}/status", response_model=TicketResponse)
def update_ticket_status_explicit(
    ticket_id: int,
    status_update: TicketStatusUpdate,
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
            detail="Citizens cannot modify ticket status or remarks."
        )
        
    if current_user.role == "dept_admin" and ticket.assigned_department_id != current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage tickets assigned to your department."
        )
        
    ticket.status = status_update.status
    ticket.remarks = status_update.remarks
    db.commit()
    db.refresh(ticket)
    return ticket

