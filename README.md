# Intelligent E-Governance Ticket Routing System

An intelligent, full-stack, enterprise-grade E-Governance platform designed for municipal governments. It streamlines citizen grievances through **Explainable AI (XAI)** routing, ensures absolute accountability via **Cryptographic Audit Trails**, visualizes geospatial data with **Map Clustering**, and manages large organizational structures with **Role-Based Access Control (RBAC)** and **Service Level Agreements (SLA)** tracking.

Built with **Python (FastAPI, Celery)** on the backend and **React.js (Vite, Tailwind CSS, Leaflet)** on the frontend. The project utilizes **SQLite** (or PostgreSQL) as the relational database engine and **Redis** for asynchronous message brokering and live WebSocket feeds.

---

## 🌟 Key Features

### 1. Explainable AI (XAI) Ticket Routing
- **NLP Heuristics & Confidence Scoring**: Automatically categorizes citizen complaints (e.g., water leaks, potholes, electrical outages) to the correct department using natural language keyword heuristic matching.
- **Explainability**: The system extracts exact keywords from the grievance that triggered the routing decision, providing transparency to administrators.
- **Fault-Tolerant Fallback**: If the AI model fails or encounters extreme ambiguity, it falls back to a safe "Unassigned" state for human intervention.
- **Asynchronous Processing**: Celery handles the classification entirely in the background, ensuring near-instantaneous API response times for citizens submitting tickets.

### 2. Service Level Agreements (SLA) & Citizen Feedback Loop
- **SLA Violation Tracking**: Strict countdown timers on ticket resolution. If a department fails to resolve a ticket within the SLA timeframe, warnings are generated, and Super Admins are notified.
- **Citizen Validation**: Once a ticket is marked "Resolved" by a department, the citizen must confirm their satisfaction. If dissatisfied, the ticket enters an **"Under Re-evaluation"** state requiring explicit clarification and re-working by the department.
- **Reopened Cases Monitor**: Dedicated dashboards for Super Admins and Department Heads to handle stalled or reopened cases and request clarifications.

### 3. Cryptographic System Audit Trail
- **Immutable Ledger**: Every critical state change (e.g., ticket resolution, role elevations, ticket deletions) is securely logged in the database.
- **SHA-256 Hash Chaining**: Inspired by blockchain mechanics, each audit log generates a cryptographic hash combining the current payload with the exact hash of the preceding database row.
- **Tamper Detection**: Super Admins can verify the integrity of the database in real-time. If a rogue administrator directly alters the database without updating the hash chain, the system instantly flags the compromised row.

### 4. Live Geospatial Information System (GIS)
- **Citizen Mapping**: Citizens can drop a pin on an interactive map or fetch their device's GPS coordinates when submitting a grievance.
- **Spatial Dashboard & Clustering**: Super Admins have a global view of all active grievances rendered on a dynamic Leaflet map. Uses `react-leaflet-cluster` to aggregate dense data points into numbered bubbles, ensuring the browser remains highly performant even with thousands of active tickets.

### 5. Advanced Role-Based Access Control (RBAC) & Approvals
- **Citizen**: Submit complaints, check status, view AI routing logic, attach proof of grievances, and participate in a Feedback Loop to verify ticket resolution.
- **Department Personnel (Field Operators & Support Reps)**: Manage tickets specifically assigned to their department. Provide photo proof of resolved issues.
- **Department Head**: Manage department queues, override assignments, and oversee SLA warnings. Strict database constraints allow only one Head per department. They can request role promotions for their staff.
- **Super Admin**: Approve or reject role promotions via an approvals queue, override AI routing, monitor global analytics, verify hash chains, and manage system-wide ticket deletions.

### 6. Live Telemetry & WebSockets
- **Global Dashboard**: Super Admins view live metrics including XAI accuracy, ingestion latency, and real-time state tracking.
- **WebSocket Feed**: The frontend establishes a live connection, displaying incoming tickets and status updates in real-time without refreshing the page.

---

## 🧠 Algorithms Used

1. **TF-IDF & Logistic Regression**:
   - **Use Case**: Primary classification model for predicting the appropriate department based on the citizen's grievance text.
   - **How It Works**: Converts raw text into a numerical format, giving higher importance to unique and domain-specific words. Logistic Regression computes probability scores (confidence) for each possible department.

2. **NLP Keyword Extraction (Explainable AI)**:
   - **Use Case**: Extracts the top 3 highest-weighted keywords causing the model to make its routing decision, making the AI "explainable".
   - **How It Works**: Multiplies the active TF-IDF weights by the Logistic Regression coefficients to determine which words/characters contributed most significantly to the final prediction.

3. **SHA-256 (Secure Hash Algorithm 256-bit)**:
   - **Use Case**: Cryptographic Hash Chaining for the system audit trail.
   - **How It Works**: Each audit log entry generates a cryptographic hash combining its current payload with the exact hash of the preceding database row. This creates an immutable blockchain-like ledger.

4. **Deterministic Heuristics (Fallback Routing)**:
   - **Use Case**: Failsafe mechanism for emergency keywords or if the ML model is unavailable/uncertain.
   - **How It Works**: Uses hardcoded dictionaries of English and Nepali emergency keywords (e.g., "flood", "short circuit") to bypass the AI and immediately assign a priority ticket to the relevant department with 100% confidence.

---

## 📂 Directory Architecture

```text
/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── api/              # Core endpoints (auth, tickets, audit, etc.)
│   │   ├── utils/            # Cryptographic hash utils & telemetry hooks
│   │   ├── tasks.py          # Celery background tasks
│   │   ├── classifier.py     # AI NLP Routing logic
│   │   ├── websocket_manager # Live socket and Redis listeners
│   │   ├── models.py         # Relational DB models
│   │   ├── schemas.py        # Pydantic validation
│   │   └── seed.py           # DB generation
│   ├── migrations/           # Alembic version files
│   ├── tests/                # Pytest suite
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React Application (Vite)
│   ├── src/
│   │   ├── components/       # Dashboards & UI elements
│   │   ├── context/          # React AuthContext
│   │   ├── App.jsx           # Main routing & state
│   │   └── index.css         # Tailwind directives & custom CSS
│   ├── package.json
│   └── tailwind.config.js
└── run.bat                   # Unified Windows Launcher
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js & npm
- Redis Server (Required for Celery and WebSockets)

### Quick Start: Unified Launcher (Windows)
If you have Redis installed locally, you can double-click `run.bat` in the root folder, or execute it from the command prompt:
```cmd
run.bat
```
This utility spins up the Backend, Frontend, and Celery Worker simultaneously in native command windows.

---

### Manual Local Installation

#### 1. Redis Setup
Ensure Redis is running locally on port `6379`.

#### 2. Backend Setup
1. Open a terminal in the `backend/` folder.
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run database migrations:
   ```bash
   alembic upgrade head
   ```
5. Seed database data:
   ```bash
   python app/seed.py
   ```
6. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload
   ```
7. In a new terminal (with the virtual environment activated), start the Celery worker:
   ```bash
   celery -A app.celery_app worker --loglevel=info --pool=solo
   ```

#### 3. Frontend Setup
1. Open a terminal in the `frontend/` folder.
2. Install node modules:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
4. Access the web interface at [http://localhost:5173](http://localhost:5173).

---

## 🧪 Testing
The backend features a comprehensive Pytest suite covering authentication, RBAC provisioning, AI fallbacks, and the cryptographic hash chain.
To run tests:
```bash
cd backend
python -m pytest tests/ -v
```

---

## 🔐 Default Seed Users
*Passwords for all seeded accounts are `password`.*
- **Super Admin**: `super@gov.com`
- **Department Head**: `water.head@gov.com`
- **Field Operator**: `water.field@gov.com`
- **Citizen**: `citizen1@example.com`

---
*Built as a capstone E-Governance software architecture project.*
