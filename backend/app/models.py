import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, CheckConstraint, Boolean, Index
from sqlalchemy.orm import relationship
from app.db import Base

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Relationships
    users = relationship("User", back_populates="department")
    tickets = relationship("Ticket", back_populates="assigned_department")

    def __repr__(self):
        return f"<Department(id={self.id}, name='{self.name}')>"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    employee_id_or_passport = Column(String(100), nullable=True)
    status = Column(String(20), default="active", nullable=False, server_default="active")
    dept_role = Column(String(30), nullable=True)  # Department Head, Field Operator, Support Rep

    # Constraints
    __table_args__ = (
        CheckConstraint(role.in_(['citizen', 'dept_admin', 'super_admin']), name='check_user_role'),
        CheckConstraint(status.in_(['active', 'suspended']), name='check_user_status'),
        CheckConstraint(dept_role.in_(['Department Head', 'Field Operator', 'Support Rep']), name='check_dept_role'),
        Index(
            "idx_unique_department_head",
            "department_id",
            unique=True,
            sqlite_where=(dept_role == "Department Head"),
            postgresql_where=(dept_role == "Department Head")
        )
    )

    # Relationships
    department = relationship("Department", back_populates="users")
    tickets = relationship("Ticket", back_populates="citizen", foreign_keys="[Ticket.citizen_id]")

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    citizen_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    assigned_department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    assigned_employee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reassignment_requested = Column(Boolean, default=False, nullable=False, server_default="0")
    ai_confidence = Column(Float, nullable=True)
    priority = Column(String(20), nullable=False, default="medium")
    status = Column(String(30), nullable=False, default="pending")
    remarks = Column(Text, nullable=True)
    report = Column(Text, nullable=True)
    needs_verification = Column(Boolean, default=False, nullable=False)
    proof_requested_at = Column(DateTime(timezone=True), nullable=True)
    sla_violated = Column(Boolean, default=False, nullable=False, server_default='0')
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    # Constraints
    __table_args__ = (
        CheckConstraint(priority.in_(['low', 'medium', 'high']), name='check_ticket_priority'),
        CheckConstraint(status.in_(['processing', 'pending', 'in_progress', 'resolved', 'sla_violated', 'Under Re-evaluation']), name='check_ticket_status'),
    )

    # Relationships
    citizen = relationship("User", back_populates="tickets", foreign_keys=[citizen_id])
    assigned_employee = relationship("User", foreign_keys=[assigned_employee_id])
    assigned_department = relationship("Department", back_populates="tickets", foreign_keys=[assigned_department_id])
    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Ticket(id={self.id}, title='{self.title[:20]}...', status='{self.status}')>"


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # photo, video, audio
    is_proof = Column(Boolean, default=False, nullable=False, server_default='0')

    # Relationships
    ticket = relationship("Ticket", back_populates="attachments")

    def __repr__(self):
        return f"<TicketAttachment(id={self.id}, ticket_id={self.ticket_id}, file_type='{self.file_type}', is_proof={self.is_proof})>"


class PendingRoleChange(Base):
    __tablename__ = "pending_role_changes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    requested_role = Column(String(30), nullable=False)
    status = Column(String(30), default="Pending_Approval", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=True)
    category = Column(String(50), nullable=False)  # proof_request, sla_alert, role_change, system
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False, server_default='0')
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    ticket = relationship("Ticket", foreign_keys=[ticket_id])

