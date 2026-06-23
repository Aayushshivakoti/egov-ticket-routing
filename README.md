# Intelligent E-Governance Ticket Routing System

An intelligent, full-stack, enterprise-grade E-Governance platform designed for municipal governments. It streamlines citizen grievances through **Explainable AI (XAI)** routing, ensures absolute accountability via **Cryptographic Audit Trails**, visualizes geospatial data with **Map Clustering**, and manages large organizational structures with **Role-Based Access Control (RBAC)**.

Built with **Python (FastAPI, Celery)** on the backend and **React.js (Vite, Tailwind CSS, Leaflet)** on the frontend. The project utilizes **SQLite** (or PostgreSQL) as the relational database engine and **Redis** for asynchronous message brokering and live WebSocket feeds.

---

## 🌟 Key Features

### 1. Explainable AI (XAI) Ticket Routing
- **NLP Heuristics & Confidence Scoring**: Automatically categorizes citizen complaints (e.g., water leaks, potholes, electrical outages) to the correct department using natural language keyword heuristic matching.
- **Explainability**: The system extracts exact keywords from the grievance that triggered the routing decision, providing transparency to administrators.
- **Fault-Tolerant Fallback**: If the AI model fails or encounters extreme ambiguity, it falls back to a safe "Unassigned" state for human intervention.
- **Asynchronous Processing**: Celery handles the classification entirely in the background, ensuring near-instantaneous API response times for citizens submitting tickets.

### 2. Cryptographic System Audit Trail
- **Immutable Ledger**: Every critical state change (e.g., ticket resolution, role elevations) is securely logged in the database.
- **SHA-256 Hash Chaining**: Inspired by blockchain mechanics, each audit log generates a cryptographic hash combining the current payload with the exact hash of the preceding database row.
- **Tamper Detection**: Super Admins can verify the integrity of the database in real-time. If a rogue administrator directly alters the database without updating the hash chain, the system instantly flags the compromised row.

### 3. Live Geospatial Information System (GIS)
- **Citizen Mapping**: Citizens can drop a pin on an interactive map or fetch their device's GPS coordinates when submitting a grievance.
- **Spatial Dashboard & Clustering**: Super Admins have a global view of all active grievances rendered on a dynamic Leaflet map. Uses `react-leaflet-cluster` to aggregate dense data points into numbered bubbles, ensuring the browser remains highly performant even with thousands of active tickets.

### 4. Advanced Role-Based Access Control (RBAC) & Approvals
- **Citizen**: Submit complaints, check status, view AI routing logic, attach proof of grievances, and participate in a Feedback Loop (thumbs up / thumbs down) to verify ticket resolution.
- **Department Personnel (Field Operators & Support Reps)**: Manage tickets specifically assigned to their department.
- **Department Head (Singleton Rule)**: Strict database constraints allow only one Head per department. They can request role promotions for their staff.
- **Super Admin**: Approve or reject role promotions via an approvals queue, override AI routing, monitor global analytics, verify hash chains, and export database state to CSV.

### 5. Live Telemetry & WebSockets
- **Global Dashboard**: Super Admins view live metrics including XAI accuracy, ingestion latency, and live state tracking.
- **WebSocket Feed**: The frontend establishes a live connection, displaying incoming tickets and status updates in real-time without refreshing the page.

---

## 📂 Directory Architecture

```
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

## 🛠️ Relational Database Schema Design

```mermaid
erDiagram
    DEPARTMENTS {
        int id PK
        string name UNIQUE
        text description
    }
    USERS {
        int id PK
        string name
        string email UNIQUE
        string role "citizen | dept_admin | super_admin"
        string dept_role "Support Rep | Field Operator | Department Head"
        int department_id FK
    }
    TICKETS {
        int id PK
        int citizen_id FK
        int assigned_department_id FK
        string status "pending | in_progress | resolved | Under Re-evaluation"
        float ai_confidence
        float latitude
        float longitude
        boolean citizen_satisfied
    }
    SYSTEM_AUDIT_LOGS {
        int id PK
        int user_id FK
        string action_performed
        string payload
        string previous_row_hash
        string current_row_hash
    }

    DEPARTMENTS ||--o{ USERS : "employs"
    DEPARTMENTS ||--o{ TICKETS : "assigned_to"
    USERS ||--o{ TICKETS : "submits"
    USERS ||--o{ SYSTEM_AUDIT_LOGS : "triggers"
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
