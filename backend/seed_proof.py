import sqlite3
import datetime

conn = sqlite3.connect('egov_prod.db')
cur = conn.cursor()
cur.execute("INSERT INTO proof_requests (ticket_id, citizen_id, status, created_at) VALUES (?, ?, ?, ?)", (3, 1, 'pending', datetime.datetime.utcnow()))
conn.commit()
conn.close()
print("Seeded proof request")
