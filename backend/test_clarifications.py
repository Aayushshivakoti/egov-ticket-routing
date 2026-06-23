import requests
import sqlite3

resp = requests.post('http://localhost:8000/api/auth/login', data={'username': 'admin_admin@egov.gov.np', 'password': 'password123'})
token = resp.json().get('access_token')

conn = sqlite3.connect('egov_prod.db')
c = conn.cursor()
c.execute("INSERT INTO tickets (id, citizen_id, title, description, priority, status, needs_verification, sla_violated, reassignment_requested, reopened, created_at, updated_at) VALUES (998, 1, 'Test', 'Test', 'medium', 'Under Re-evaluation', 0, 0, 0, 1, '2026-06-23', '2026-06-23')")
conn.commit()

headers = {'Authorization': f'Bearer {token}'}

# Test GET clarifications
resp_get = requests.get('http://localhost:8000/api/tickets/998/clarifications', headers=headers)
print('GET clarifications:', resp_get.status_code, resp_get.text)

# Test POST clarifications
files = {'files': ('test.txt', b'hello')}
data = {'message': 'Admin clarification response'}
resp_post = requests.post('http://localhost:8000/api/tickets/998/clarifications', headers=headers, data=data, files=files)
print('POST clarifications:', resp_post.status_code, resp_post.text)

# Test PUT status
files = {'files': ('test.txt', b'hello')}
data = {'status': 'resolved', 'remarks': 'Issue resolved', 'report': 'Done'}
resp_put = requests.put('http://localhost:8000/api/tickets/998/status', headers=headers, data=data, files=files)
print('PUT status:', resp_put.status_code, resp_put.text)

c.execute("DELETE FROM ticket_clarifications WHERE ticket_id=998")
c.execute("DELETE FROM tickets WHERE id=998")
conn.commit()
