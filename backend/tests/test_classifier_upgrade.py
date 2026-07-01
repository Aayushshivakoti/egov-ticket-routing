import os
import sys
import pytest
from sqlalchemy.orm import Session

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.train import stem_nepali, preprocess_text
from app.classifier import classify_ticket, get_reasoning_keywords
from app.models import Department
from app.db import Base, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_classifier_upgrade_db.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    water_dept = Department(id=1, name="Water Supply", description="Water distribution systems")
    roads_dept = Department(id=2, name="Roads & Infrastructure", description="Road network")
    electricity_dept = Department(id=3, name="Electricity Authority", description="Power grid")
    waste_dept = Department(id=4, name="Waste Management", description="Sanitation services")
    general_dept = Department(id=5, name="General Administration", description="General administrative inquiries")
    db.add_all([water_dept, roads_dept, electricity_dept, waste_dept, general_dept])
    db.commit()
    db.close()
    
    yield
    
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_classifier_upgrade_db.db"):
        try:
            os.remove("./test_classifier_upgrade_db.db")
        except:
            pass

def test_stem_nepali():
    # Suffix: 'को'
    assert stem_nepali("पानीको") == "पानी"
    # Suffix: 'लाई'
    assert stem_nepali("नागरिकलाई") == "नागरिक"
    # Suffix: 'बाट'
    assert stem_nepali("काठमाडौंबाट") == "काठमाडौं"
    # Word too short to stem
    assert stem_nepali("को") == "को"

def test_preprocess_text():
    # Multi-lingual clean
    text = "Water pipes burst र बाटोमा पानीको बाढी भयो।"
    cleaned = preprocess_text(text)
    # 'र' is stopword, 'पानीको' should become 'पानी'
    assert "पानी" in cleaned
    assert "को" not in cleaned

def test_classify_ticket_ml():
    db = TestingSessionLocal()
    
    # 1. Test standard English classification
    dept_id, confidence, needs_review, override = classify_ticket(
        "Water leak", 
        "Water is leaking from the main pipeline and flooding the street.", 
        db
    )
    # Should route to Water Supply (ID: 1)
    assert dept_id == 1
    assert confidence > 0.5
    
    # 2. Test standard Nepali Devanagari classification
    dept_id2, confidence2, needs_review2, override2 = classify_ticket(
        "सडक पिच भत्कियो", 
        "नयाँ जडान गरिएका सडक बत्तीहरू बलेका छैनन् र सडक पिच भत्किएर गिटी उडेको छ।", 
        db
    )
    # Should route to Roads & Infrastructure (ID: 2)
    assert dept_id2 == 2
    assert confidence2 > 0.65
    
    # 3. Test XAI keyword extraction on the calibrated SVM
    keywords = get_reasoning_keywords(
        "सडक पिच भत्कियो", 
        "नयाँ जडान गरिएका सडक बत्तीहरू बलेका छैनन् र सडक पिच भत्किएर गिटी उडेको छ।", 
        dept_id2, 
        db
    )
    # At least one Devanagari keyword matching the topic should be returned
    assert len(keywords) > 0
    assert any("भत्कियो" in k or "सडक" in k for k in keywords)
    
    db.close()
