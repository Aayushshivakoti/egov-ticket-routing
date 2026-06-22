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

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase, BaseConfigModel):
    id: int
    department_id: Optional[int] = None

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

class TicketCreate(TicketBase):
    pass

class TicketUpdate(BaseModel):
    assigned_department_id: Optional[int] = None
    ai_confidence: Optional[float] = None
    priority: Optional[str] = Field(None, pattern="^(low|medium|high)$")
    status: Optional[str] = Field(None, pattern="^(pending|in_progress|resolved)$")
    remarks: Optional[str] = None

class TicketStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|in_progress|resolved)$")
    remarks: Optional[str] = None

class TicketResponse(TicketBase, BaseConfigModel):
    id: int
    citizen_id: int
    assigned_department_id: Optional[int] = None
    ai_confidence: Optional[float] = None
    status: str
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # Extra relationship information if needed
    citizen: Optional[UserResponse] = None
    assigned_department: Optional[DepartmentResponse] = None
