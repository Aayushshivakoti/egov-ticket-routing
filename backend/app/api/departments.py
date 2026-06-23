from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from app.models import Department, User, PendingRoleChange
from app.schemas import (
    DepartmentCreate, DepartmentResponse, UserResponse, TransferEmployeeRequest,
    UserRoleUpdate, PendingRoleChangeResponse
)
from app.api.auth_utils import require_role, get_current_user

router = APIRouter(prefix="/departments", tags=["Departments"])

@router.get("/", response_model=List[DepartmentResponse])
def get_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()

@router.post("/", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    dept_in: DepartmentCreate, 
    db: Session = Depends(get_db),
    admin_user = Depends(require_role(["super_admin"]))
):
    # Check if department with name exists
    existing = db.query(Department).filter(Department.name == dept_in.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department already exists"
        )
    new_dept = Department(
        name=dept_in.name,
        description=dept_in.description
    )
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)
    return new_dept

@router.get("/{dept_id}", response_model=DepartmentResponse)
def get_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    return dept

@router.get("/{dept_id}/employees", response_model=List[UserResponse])
def get_department_employees(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    if current_user.role == "super_admin":
        pass
    elif current_user.role == "dept_admin" and current_user.dept_role == "Department Head":
        if current_user.department_id != dept_id:
            raise HTTPException(status_code=403, detail="You can only view employees in your department.")
    else:
        raise HTTPException(status_code=403, detail="Access denied: Insufficient permissions.")

    return db.query(User).filter(User.department_id == dept_id).all()

@router.post("/employees/{employee_id}/suspend", response_model=UserResponse)
def suspend_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_role(["super_admin"]))
):
    employee = db.query(User).filter(User.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    if employee.role == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suspend super admin accounts"
        )
    employee.status = "suspended"
    db.commit()
    db.refresh(employee)
    return employee

@router.post("/employees/{employee_id}/activate", response_model=UserResponse)
def activate_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_role(["super_admin"]))
):
    employee = db.query(User).filter(User.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    employee.status = "active"
    db.commit()
    db.refresh(employee)
    return employee

@router.delete("/employees/{employee_id}", status_code=status.HTTP_200_OK)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_role(["super_admin"]))
):
    employee = db.query(User).filter(User.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    if employee.role == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete super admin accounts"
        )
    db.delete(employee)
    db.commit()
    return {"detail": "Employee deleted successfully"}

@router.post("/employees/{employee_id}/transfer", response_model=UserResponse)
def transfer_employee(
    employee_id: int,
    req: TransferEmployeeRequest,
    db: Session = Depends(get_db),
    admin_user = Depends(require_role(["super_admin"]))
):
    employee = db.query(User).filter(User.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    if employee.role == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer super admin accounts"
        )
    
    # Check if target department exists
    dept = db.query(Department).filter(Department.id == req.department_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target department not found"
        )
        
    employee.department_id = req.department_id
    db.commit()
    db.refresh(employee)
    return employee

@router.put("/employees/{employee_id}/role")
def update_employee_role(
    employee_id: int,
    req: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    employee = db.query(User).filter(User.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if req.dept_role == "Department Head":
        existing_head = db.query(User).filter(
            User.department_id == employee.department_id,
            User.dept_role == "Department Head",
            User.id != employee_id
        ).first()
        if existing_head:
            raise HTTPException(status_code=400, detail="A Department Head is already assigned to this department.")

    if current_user.role == "super_admin":
        employee.dept_role = req.dept_role
        db.commit()
        db.refresh(employee)
        return {"detail": "Role updated directly", "user": {"id": employee.id, "dept_role": employee.dept_role}}
        
    elif current_user.role == "dept_admin" and current_user.dept_role == "Department Head":
        if employee.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="You can only manage employees in your department.")
            
        pending = PendingRoleChange(
            user_id=employee_id,
            requested_role=req.dept_role,
            status="Pending_Approval"
        )
        db.add(pending)
        db.commit()
        db.refresh(pending)
        return {"detail": "Role update submitted for approval", "pending_id": pending.id}
    else:
        raise HTTPException(status_code=403, detail="Not authorized to edit employee roles")

@router.get("/role-changes/pending", response_model=List[PendingRoleChangeResponse])
def get_pending_role_changes(
    db: Session = Depends(get_db),
    admin_user = Depends(require_role(["super_admin"]))
):
    return db.query(PendingRoleChange).filter(PendingRoleChange.status == "Pending_Approval").all()

@router.post("/role-changes/{change_id}/approve")
def approve_role_change(
    change_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_role(["super_admin"]))
):
    change = db.query(PendingRoleChange).filter(PendingRoleChange.id == change_id).first()
    if not change:
        raise HTTPException(status_code=404, detail="Pending change not found")
        
    if change.requested_role == "Department Head":
        user = db.query(User).filter(User.id == change.user_id).first()
        if user:
            existing_head = db.query(User).filter(
                User.department_id == user.department_id,
                User.dept_role == "Department Head",
                User.id != user.id
            ).first()
            if existing_head:
                raise HTTPException(status_code=400, detail="A Department Head is already assigned to this department.")

    user = db.query(User).filter(User.id == change.user_id).first()
    if user:
        user.dept_role = change.requested_role
    change.status = "Approved"
    db.commit()
    return {"detail": "Role change approved and applied"}

@router.post("/role-changes/{change_id}/reject")
def reject_role_change(
    change_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_role(["super_admin"]))
):
    change = db.query(PendingRoleChange).filter(PendingRoleChange.id == change_id).first()
    if not change:
        raise HTTPException(status_code=404, detail="Pending change not found")
        
    change.status = "Rejected"
    db.commit()
    return {"detail": "Role change rejected"}

