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
        dept_id, confidence, needs_verification, priority_override = classify_ticket(
            ticket.title, ticket.description, db
        )
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
