from app.db import SessionLocal
from app.models import Ticket

db = SessionLocal()
t = db.query(Ticket).filter(Ticket.id == 3).first()
print("Before:", t.status, t.reopened)

t.reopened = True
db.commit()
db.refresh(t)

print("After commit:", t.status, t.reopened)

import sqlite3
conn = sqlite3.connect('egov_prod.db')
c = conn.cursor()
c.execute("SELECT id, status, reopened FROM tickets WHERE id=3")
print("In DB via sqlite3:", c.fetchone())
