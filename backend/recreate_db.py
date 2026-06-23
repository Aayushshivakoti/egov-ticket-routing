import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import Base, engine
from app.seed import seed_db

def reset_database():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Seeding database...")
    seed_db()
    print("Done!")

if __name__ == "__main__":
    reset_database()
