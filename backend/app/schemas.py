from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

# Common configurations
class BaseConfigModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Department Schemas ---
class DepartmentBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase, BaseConfigModel):
    id: int


# --- User Schemas ---
class UserBase(BaseModel):
    name: str = Field(..., max_length=100)
    email: EmailStr
    role: str = Field(..., pattern="^(citizen|dept_admin|super_admin)$")

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    department_id: Optional[int] = None
    employee_id_or_passport: Optional[str] = None
    status: Optional[str] = "active"
    dept_role: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase, BaseConfigModel):
    id: int
    department_id: Optional[int] = None
    employee_id_or_passport: Optional[str] = None
    status: str
    dept_role: Optional[str] = None

class TransferEmployeeRequest(BaseModel):
    department_id: int

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None


# --- Ticket Schemas ---
class TicketBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: str
    priority: str = Field("medium", pattern="^(low|medium|high)$")
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class TicketCreate(TicketBase):
    pass

class TicketUpdate(BaseModel):
    assigned_department_id: Optional[int] = None
    ai_confidence: Optional[float] = None
    priority: Optional[str] = Field(None, pattern="^(low|medium|high)$")
    status: Optional[str] = Field(None, pattern="^(processing|pending|in_progress|resolved|sla_violated|Under Re-evaluation)$")
    remarks: Optional[str] = None

class TicketStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(processing|pending|in_progress|resolved|sla_violated|Under Re-evaluation)$")
    remarks: Optional[str] = None

# --- TicketAttachment Schemas ---
class TicketAttachmentResponse(BaseModel):
    id: int
    ticket_id: int
    file_path: str
    file_type: str
    is_proof: bool

    model_config = ConfigDict(from_attributes=True)


class TicketClarificationResponse(BaseConfigModel):
    id: int
    ticket_id: int
    sender_id: int
    message: str
    created_at: datetime
    attachments: List[TicketAttachmentResponse] = []
    sender: Optional[UserResponse] = None

class TicketResponse(TicketBase, BaseConfigModel):
    id: int
    citizen_id: int
    assigned_department_id: Optional[int] = None
    assigned_employee_id: Optional[int] = None
    reassignment_requested: bool = False
    ai_confidence: Optional[float] = None
    status: str
    remarks: Optional[str] = None
    report: Optional[str] = None
    needs_verification: bool
    created_at: datetime
    updated_at: datetime
    reasoning_keywords: Optional[List[str]] = None
    classification_latency: Optional[float] = None
    attachments: List[TicketAttachmentResponse] = []
    clarifications: List[TicketClarificationResponse] = []
    proof_requested_at: Optional[datetime] = None
    sla_violated: bool = False
    citizen_satisfied: Optional[bool] = None
    reopened: bool = False

    
    # Extra relationship information if needed
    citizen: Optional[UserResponse] = None
    assigned_department: Optional[DepartmentResponse] = None
    assigned_employee: Optional[UserResponse] = None


class UserRoleUpdate(BaseModel):
    dept_role: str = Field(..., pattern="^(Department Head|Field Operator|Support Rep)$")


class TicketAssignRequest(BaseModel):
    assigned_employee_id: Optional[int] = None


class PendingRoleChangeResponse(BaseConfigModel):
    id: int
    user_id: int
    requested_role: str
    status: str
    created_at: datetime
    user: Optional[UserResponse] = None

