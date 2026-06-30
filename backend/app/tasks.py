import os
import json
import time
import redis
from app.celery_app import celery_app
from app.db import SessionLocal
from app.models import Ticket
from app.classifier import classify_ticket

@celery_app.task(name="app.tasks.classify_ticket_task")
def classify_ticket_task(ticket_id: int):
    print(f"Starting Celery classification task for ticket ID: {ticket_id}")
    db = SessionLocal()
    try:
        # Retrieve the ticket
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            print(f"Error: Ticket {ticket_id} not found in database.")
            return f"Ticket {ticket_id} not found."

        # Run the classification logic and measure latency
        start_time = time.time()
        
        try:
            dept_id, confidence, needs_verification, priority_override = classify_ticket(
                ticket.title, ticket.description, db
            )
        except Exception as ai_err:
            print(f"AI Classification Failed: {ai_err}. Falling back to default Unassigned.")
            dept_id = None
            confidence = 0.0
            needs_verification = True
            priority_override = None
            
        latency_ms = (time.time() - start_time) * 1000
        print(f"Classification execution completed in {latency_ms:.2f} ms")

        # Update the database record
        ticket.assigned_department_id = dept_id
        ticket.ai_confidence = confidence
        ticket.needs_verification = needs_verification
        ticket.status = "pending"  # Change status from processing to pending
        if priority_override:
            ticket.priority = priority_override

        db.commit()
        db.refresh(ticket)
        print(f"Ticket ID {ticket_id} database update committed successfully.")

        # Publish notification & save latency via Redis
        try:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            r = redis.Redis.from_url(redis_url)
            
            # 1. Publish WebSocket broadcast event
            message = {
                "event": "ticket_updated",
                "ticket_id": ticket.id,
                "status": ticket.status,
                "assigned_department_id": ticket.assigned_department_id
            }
            r.publish("ticket_updates", json.dumps(message))
            print(f"Successfully published WebSocket broadcast event for ticket ID {ticket_id}")
            
            # 2. Push classification latency telemetry
            telemetry_data = {
                "ticket_id": ticket.id,
                "latency_ms": round(latency_ms, 2),
                "timestamp": time.time()
            }
            r.lpush("egov:telemetry:latency", json.dumps(telemetry_data))
            r.ltrim("egov:telemetry:latency", 0, 99)
            print(f"Recorded telemetry classification latency: {latency_ms:.2f} ms")
            
        except Exception as pub_error:
            print(f"Failed to record Redis telemetry or broadcast: {pub_error}")

        return f"Ticket {ticket_id} successfully classified and assigned."

    except Exception as e:
        db.rollback()
        print(f"Error processing ticket ID {ticket_id}: {e}")
        raise e
    finally:
        db.close()


@celery_app.task(name="app.tasks.check_sla_violations")
def check_sla_violations():
    """
    Background worker: checks for resolved tickets where proof was requested
    and runs a multi-tier SLA escalation check (24h, 48h, 72h).
    """
    import datetime
    from app.models import Ticket, TicketAttachment, User, Notification, Department
    from app.email_utils import send_mock_email
    
    print("Running multi-tier SLA violation check...")
    db = SessionLocal()
    try:
        now = datetime.datetime.utcnow()
        
        # Find all resolved tickets that have a proof request outstanding
        candidates = db.query(Ticket).filter(
            Ticket.proof_requested_at.isnot(None),
            Ticket.status == "resolved"
        ).all()
        
        escalated_count = 0
        for ticket in candidates:
            # Check if proof was uploaded since request
            proof_exists = db.query(TicketAttachment).filter(
                TicketAttachment.ticket_id == ticket.id,
                TicketAttachment.is_proof == True
            ).first()
            
            if proof_exists:
                continue
                
            # Proof not provided yet, calculate elapsed time
            hours_elapsed = (now - ticket.proof_requested_at).total_seconds() / 3600.0
            
            # --- Tier 1 (24 - 48 Hours) ---
            if hours_elapsed >= 24.0 and hours_elapsed < 48.0:
                if not ticket.sla_violated:
                    ticket.sla_violated = True
                    escalated_count += 1
                    print(f"SLA Tier 1 Violation: Ticket #{ticket.id} ('{ticket.title}')")
                    
                    # Notify department admins
                    dept_admins = db.query(User).filter(
                        User.role == "dept_admin",
                        User.department_id == ticket.assigned_department_id
                    ).all()
                    
                    for admin in dept_admins:
                        notif = Notification(
                            user_id=admin.id,
                            ticket_id=ticket.id,
                            category="sla_alert",
                            message=f"SLA Violation Warning: Ticket #{ticket.id} ('{ticket.title}') resolved but lacks proof. Provide proof immediately to avoid supervisor escalation."
                        )
                        db.add(notif)
                        
                        send_mock_email(
                            admin.email,
                            f"SLA Warning Notice: Ticket #{ticket.id}",
                            f"Hello {admin.name},\n\nTicket #{ticket.id} ('{ticket.title}') has exceeded the 24-hour window for providing resolution proof.\n\nPlease upload proof immediately to avoid escalation to central supervisors."
                        )
            
            # --- Tier 2 (48 - 72 Hours) ---
            elif hours_elapsed >= 48.0 and hours_elapsed < 72.0:
                # Check if Tier 2 notification was already sent to avoid duplicate spamming
                tier2_sent = db.query(Notification).filter(
                    Notification.ticket_id == ticket.id,
                    Notification.message.like("%Escalation Tier 2%")
                ).first()
                
                if not tier2_sent:
                    escalated_count += 1
                    print(f"SLA Tier 2 Escalation: Ticket #{ticket.id} ('{ticket.title}')")
                    
                    # Notify all super admins
                    super_admins = db.query(User).filter(User.role == "super_admin").all()
                    for sa in super_admins:
                        notif = Notification(
                            user_id=sa.id,
                            ticket_id=ticket.id,
                            category="sla_alert",
                            message=f"SLA Escalation Tier 2: Ticket #{ticket.id} ('{ticket.title}') has been in breach for over 48 hours."
                        )
                        db.add(notif)
                        
                        send_mock_email(
                            sa.email,
                            f"SLA Escalation Tier 2 Alert - Ticket #{ticket.id}",
                            f"Hello {sa.name},\n\nTicket #{ticket.id} ('{ticket.title}') has been in SLA violation state for over 48 hours without resolution proof.\n\nPlease review supervisor actions."
                        )
            
            # --- Tier 3 (>= 72 Hours) ---
            elif hours_elapsed >= 72.0:
                # Check if Tier 3 notification was already sent
                tier3_sent = db.query(Notification).filter(
                    Notification.ticket_id == ticket.id,
                    Notification.category == "compliance_audit",
                    Notification.message.like("%SLA Escalation Tier 3%")
                ).first()
                
                if not tier3_sent:
                    escalated_count += 1
                    print(f"SLA Tier 3 Critical Escalation: Ticket #{ticket.id} ('{ticket.title}')")
                    
                    # Notify all super admins under compliance_audit category
                    super_admins = db.query(User).filter(User.role == "super_admin").all()
                    for sa in super_admins:
                        notif = Notification(
                            user_id=sa.id,
                            ticket_id=ticket.id,
                            category="compliance_audit",
                            message=f"SLA Escalation Tier 3 CRITICAL: Ticket #{ticket.id} ('{ticket.title}') in breach for over 72 hours. Department failed to respond."
                        )
                        db.add(notif)
                        
                    # Notify department admins under compliance_audit category
                    dept_admins = db.query(User).filter(
                        User.role == "dept_admin",
                        User.department_id == ticket.assigned_department_id
                    ).all()
                    for da in dept_admins:
                        notif = Notification(
                            user_id=da.id,
                            ticket_id=ticket.id,
                            category="compliance_audit",
                            message=f"SLA Escalation Tier 3 CRITICAL: Ticket #{ticket.id} ('{ticket.title}') in breach for over 72 hours. Official warning logged."
                        )
                        db.add(notif)
                        
                        send_mock_email(
                            da.email,
                            f"CRITICAL COMPLIANCE NOTICE: Ticket #{ticket.id}",
                            f"Hello {da.name},\n\nYour department has failed to provide resolution proof for Ticket #{ticket.id} for over 72 hours.\n\nThis critical violation has been logged to the compliance registry."
                        )
        
        if escalated_count > 0:
            db.commit()
            print(f"SLA check complete: {escalated_count} tickets escalated/updated.")
        else:
            print("SLA check complete: No new escalations needed.")
            
    except Exception as e:
        db.rollback()
        print(f"Error during SLA violation check: {e}")
        raise e
    finally:
        db.close()

