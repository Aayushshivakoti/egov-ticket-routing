import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, CheckConstraint, Boolean
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

    # Constraints
    __table_args__ = (
        CheckConstraint(role.in_(['citizen', 'dept_admin', 'super_admin']), name='check_user_role'),
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
    ai_confidence = Column(Float, nullable=True)
    priority = Column(String(20), nullable=False, default="medium")
    status = Column(String(20), nullable=False, default="pending")
    remarks = Column(Text, nullable=True)
    needs_verification = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    # Constraints
    __table_args__ = (
        CheckConstraint(priority.in_(['low', 'medium', 'high']), name='check_ticket_priority'),
        CheckConstraint(status.in_(['pending', 'in_progress', 'resolved']), name='check_ticket_status'),
    )

    # Relationships
    citizen = relationship("User", back_populates="tickets", foreign_keys=[citizen_id])
    assigned_department = relationship("Department", back_populates="tickets", foreign_keys=[assigned_department_id])

    def __repr__(self):
        return f"<Ticket(id={self.id}, title='{self.title[:20]}...', status='{self.status}')>"
