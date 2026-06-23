import requests

# Test the request-proof endpoint directly on an existing resolved ticket
# Ticket 3 is resolved, let's use that
resp = requests.post('http://localhost:8000/api/tickets/3/request-proof')
print(resp.status_code, resp.text)
