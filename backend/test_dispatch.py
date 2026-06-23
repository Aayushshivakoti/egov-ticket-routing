import requests

login_resp = requests.post('http://localhost:8000/api/auth/login', data={'username': 'hari@gmail.com', 'password': 'password123'})
token = login_resp.json().get('access_token')

headers = {'Authorization': f'Bearer {token}'}
data = {
    'title': 'Test dispatch',
    'description': 'Test dispatch description',
    'priority': 'medium'
}
files = {'files': ('test.txt', b'hello')}
resp = requests.post('http://localhost:8000/api/tickets/create', headers=headers, data=data, files=files)
print("Dispatch Response:", resp.status_code, resp.text)
