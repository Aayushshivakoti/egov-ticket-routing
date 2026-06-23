from app.db import SessionLocal
from app.api.tickets import submit_ticket_feedback
from fastapi import Form
from app.models import User, Ticket

db = SessionLocal()
t = db.query(Ticket).filter(Ticket.id == 3).first()
t.status = "resolved"
db.commit()

user = db.query(User).filter(User.email == 'hari@gmail.com').first()

try:
    submit_ticket_feedback(ticket_id=3, satisfied=False, db=db, current_user=user)
except Exception as e:
    print("Exception:", e)

# check db again directly
t2 = db.query(Ticket).filter(Ticket.id == 3).first()
print("Final state:", t2.status, t2.reopened)

db.close()
