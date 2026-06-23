import requests
import sqlite3

resp = requests.post('http://localhost:8000/api/auth/login', data={'username': 'admin_admin@egov.gov.np', 'password': 'password123'})
token = resp.json().get('access_token')

conn = sqlite3.connect('egov_prod.db')
c = conn.cursor()
c.execute("INSERT INTO tickets (id, citizen_id, title, description, priority, status, needs_verification, sla_violated, reassignment_requested, reopened, created_at, updated_at) VALUES (999, 1, 'Test', 'Test', 'medium', 'resolved', 0, 0, 0, 0, '2026-06-23', '2026-06-23')")
c.execute("INSERT INTO proof_requests (id, ticket_id, citizen_id, status, created_at) VALUES (999, 999, 1, 'pending', '2026-06-23')")
conn.commit()

headers = {'Authorization': f'Bearer {token}'}
files = {'files': ('test.txt', b'hello')}
resp_upload = requests.post('http://localhost:8000/api/tickets/proof-requests/999/fulfill', headers=headers, files=files)
print('Upload Status:', resp_upload.status_code, resp_upload.text)

c.execute("DELETE FROM proof_requests WHERE id=999")
c.execute("DELETE FROM tickets WHERE id=999")
conn.commit()
