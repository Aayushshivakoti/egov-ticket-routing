from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Create database engine
# For PostgreSQL, we connect via psycopg2
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True, # Proactively check connection health
    pool_size=10,
    max_overflow=20
)

# Create local session class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base model class
Base = declarative_base()

# Dependency to get db session in API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
