import sqlite3

conn = sqlite3.connect('egov_prod.db')
c = conn.cursor()
c.execute("SELECT id, status, reopened FROM tickets WHERE id=3")
print("Ticket 3 in DB:", c.fetchone())
