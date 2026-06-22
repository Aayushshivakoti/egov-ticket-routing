import os
import sys

# Add the project root to path to ensure app imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db import Base, engine, SessionLocal
from app.models import Department, User, Ticket
from app.api.auth_utils import get_password_hash

def seed_db():
    print("Initializing database connection...")
    # Create tables if not exist (as fallback, alembic is preferred)
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        # Clear existing data in reverse order of dependencies
        print("Clearing existing data...")
        db.query(Ticket).delete()
        db.query(User).delete()
        db.query(Department).delete()
        db.commit()

        print("Seeding Departments...")
        departments = [
            Department(
                name="Water Supply",
                description="Responsible for municipal water distribution, water treatment plants, main pipelines, and drinking water safety."
            ),
            Department(
                name="Roads & Infrastructure",
                description="Handles urban planning, road construction, repairs, potholes, sidewalks, and traffic signal infrastructure."
            ),
            Department(
                name="Electricity Authority",
                description="Manages power grid stability, transmission lines, street lights, electrical outages, and metering issues."
            ),
            Department(
                name="Waste Management",
                description="Manages municipal garbage collection, public sanitation, recycling programs, waste disposal, and street cleaning."
            ),
            Department(
                name="General Administration",
                description="Handles licensing, permits, official documents, civic registrations, public grievances, and general municipal inquiries."
            )
        ]
        db.add_all(departments)
        db.commit()
        
        # Refresh departments to get their generated IDs
        for dept in departments:
            db.refresh(dept)
        
        print("Seeding Users...")
        # Common password for all seeded users
        hashed_password = get_password_hash("password123")
        
        # 1. Super Admin
        super_admin = User(
            name="Super Admin",
            email="admin@egov.gov.np",
            password_hash=hashed_password,
            role="super_admin",
            department_id=None
        )
        db.add(super_admin)

        # 2. Department Admins
        dept_admins = [
            User(
                name="Water Department Admin",
                email="water_admin@egov.gov.np",
                password_hash=hashed_password,
                role="dept_admin",
                department_id=departments[0].id
            ),
            User(
                name="Roads Department Admin",
                email="roads_admin@egov.gov.np",
                password_hash=hashed_password,
                role="dept_admin",
                department_id=departments[1].id
            ),
            User(
                name="Electricity Department Admin",
                email="electricity_admin@egov.gov.np",
                password_hash=hashed_password,
                role="dept_admin",
                department_id=departments[2].id
            ),
            User(
                name="Waste Department Admin",
                email="waste_admin@egov.gov.np",
                password_hash=hashed_password,
                role="dept_admin",
                department_id=departments[3].id
            ),
            User(
                name="General Admin Officer",
                email="admin_admin@egov.gov.np",
                password_hash=hashed_password,
                role="dept_admin",
                department_id=departments[4].id
            )
        ]
        db.add_all(dept_admins)

        # 3. Citizens
        citizens = [
            User(
                name="Hari Prasad",
                email="hari@gmail.com",
                password_hash=hashed_password,
                role="citizen",
                department_id=None
            ),
            User(
                name="Sita Kumari",
                email="sita@gmail.com",
                password_hash=hashed_password,
                role="citizen",
                department_id=None
            )
        ]
        db.add_all(citizens)
        db.commit()

        # Refresh to get IDs
        db.refresh(super_admin)
        for da in dept_admins:
            db.refresh(da)
        for cit in citizens:
            db.refresh(cit)

        print("Seeding Tickets...")
        tickets = [
            Ticket(
                citizen_id=citizens[0].id,
                title="Leaking Main Pipeline in New Road",
                description="There is a major pipe burst near the city square on New Road. Water has been flooding the street since early morning, blocking pedestrian crossings.",
                assigned_department_id=departments[0].id,
                ai_confidence=0.94,
                priority="high",
                status="in_progress"
            ),
            Ticket(
                citizen_id=citizens[1].id,
                title="Massive Pothole near Central Park Gate",
                description="A large pothole has opened up right outside the Central Park main entrance. Several motorcyclists have nearly slipped due to this. Needs urgent asphalt repairs.",
                assigned_department_id=departments[1].id,
                ai_confidence=0.88,
                priority="medium",
                status="pending"
            ),
            Ticket(
                citizen_id=citizens[0].id,
                title="Frequent Voltage Fluctuations and Shortages",
                description="Over the past 48 hours, our neighborhood has been experiencing constant voltage drops, causing refrigerator and computer shutdowns. Worried it might damage electronics.",
                assigned_department_id=departments[2].id,
                ai_confidence=0.92,
                priority="high",
                status="resolved"
            ),
            Ticket(
                citizen_id=citizens[1].id,
                title="Overflowing Dumpster and Trash in Market Street",
                description="The waste collection truck hasn't visited Market Street for 3 days. The communal waste dumpster is overflowing, causing bad smell and attracting street animals.",
                assigned_department_id=departments[3].id,
                ai_confidence=0.87,
                priority="low",
                status="pending"
            ),
            Ticket(
                citizen_id=citizens[0].id,
                title="Query Regarding Renewal of Trade Licenses",
                description="I would like to inquire about the documentation checklist and fee structure for renewing a retail shop trade license online.",
                assigned_department_id=departments[4].id,
                ai_confidence=0.78,
                priority="low",
                status="pending"
            )
        ]
        db.add_all(tickets)
        db.commit()

        print("Database seeded successfully!")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
