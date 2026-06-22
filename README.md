# Intelligent E-Governance Ticket Routing System

An intelligent, full-stack, role-based ticket management and automatic routing platform designed for municipal governments. Built with **Python (FastAPI)** on the backend and **React.js (Vite)** on the frontend with **Tailwind CSS**, using **PostgreSQL** as the relational database engine.

---

## Key Features

1. **Intelligent Ticket Routing**: Auto-categorizes citizen complaints using natural language keyword heuristic heuristics (mapping queries relating to water leaks, potholes, electrical power outages, garbage disposal, license applications, etc.) to one of the 5 standard city departments with calculated AI confidence scores.
2. **Role-Based Access Control (RBAC)**:
   - **Citizen**: Submit complaints, check status, and view dynamic routing diagnoses from the AI engine.
   - **Department Admin**: Access logs restricted to their department, update ticket progress, and resolve incidents.
   - **Super Admin**: Monitor analytics across all departments, update ticket states, and manually re-route tickets to override the AI decisions.
3. **Database Version Control**: Fully configured database migrations using Alembic.
4. **Pre-Seeded Data**: Ready-to-go environment populated with departments, default profiles, and sample ticket histories.

---

## Directory Architecture

```
/
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── api/              # Auth, Departments, and Tickets endpoints
│   │   ├── config.py         # Pydantic Settings
│   │   ├── db.py             # SQLAlchemy Session management
│   │   ├── models.py         # Relational database models
│   │   ├── schemas.py        # Pydantic validation schemas
│   │   └── seed.py           # Seeding script for DB
│   ├── migrations/           # Alembic version files
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # React Application (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── context/          # Session AuthContext
│   │   ├── pages/            # Login & Dashboard Views
│   │   ├── App.jsx
│   │   ├── index.css         # Styling & Tailwind directives
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── tailwind.config.js
│   └── postcss.config.js
├── docker-compose.yml        # Multi-container local orchestration
└── README.md
```

---

## Relational Database Schema Design

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
        string password_hash
        string role "citizen | dept_admin | super_admin"
        int department_id FK
    }
    TICKETS {
        int id PK
        int citizen_id FK
        string title
        text description
        int assigned_department_id FK
        float ai_confidence
        string priority "low | medium | high"
        string status "pending | in_progress | resolved"
        timestamp created_at
        timestamp updated_at
    }

    DEPARTMENTS ||--o{ USERS : "contains"
    DEPARTMENTS ||--o{ TICKETS : "assigned_to"
    USERS ||--o{ TICKETS : "submits"
```

---

## Getting Started

### Method A: Docker Compose (Recommended)

Spins up PostgreSQL, FastAPI Backend, and React Frontend in a hot-reloading environment.

1. Ensure Docker is running.
2. In the root directory, run:
   ```bash
   docker-compose up --build
   ```
3. Once running:
   - Backend API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
   - Frontend Dashboard: [http://localhost:5173](http://localhost:5173)

---

### Method B: Manual Local Installation

#### 1. Database Setup
Create a PostgreSQL database named `egov_helpdesk` on your local system, or update the `DATABASE_URL` settings in `backend/.env`.

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
6. Start the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

#### 3. Frontend Setup
1. Open a terminal in the `frontend/` folder.
2. Install node modules:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Access the web interface at [http://localhost:5173](http://localhost:5173).

---

## Testing Credentials

Use these presets in the login panel shortcut buttons to easily switch roles and verify specific capabilities:

| Role | Username | Password | Context |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@egov.gov.np` | `password123` | Can oversee all departments, reassign tickets, and change status. |
| **Water Admin** | `water_admin@egov.gov.np` | `password123` | Can view/manage tickets routed to **Water Supply**. |
| **Roads Admin** | `roads_admin@egov.gov.np` | `password123` | Can view/manage tickets routed to **Roads & Infrastructure**. |
| **Citizen (Hari)** | `hari@gmail.com` | `password123` | Can submit complaints and review status. |
