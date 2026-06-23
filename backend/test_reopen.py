import requests

login_resp = requests.post('http://localhost:8000/api/auth/login', data={'username': 'hari@gmail.com', 'password': 'password123'})
token = login_resp.json().get('access_token')

if not token:
    print("Login failed:", login_resp.text)
else:
    print("Login success")
    headers = {'Authorization': f'Bearer {token}'}
    resp = requests.post('http://localhost:8000/api/tickets/3/feedback', headers=headers, data={'satisfied': 'false'})
    print("Feedback Response:", resp.status_code, resp.text)
    
    # Now check what the tickets endpoint returns
    resp_tickets = requests.get('http://localhost:8000/api/tickets/', headers=headers)
    import json
    for t in resp_tickets.json():
        if t['id'] == 3:
            print("Ticket 3 reopened:", t['reopened'], "status:", t['status'])
