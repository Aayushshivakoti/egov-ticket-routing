import os
import joblib
from sqlalchemy.orm import Session
from typing import Optional
from app.models import Department
from ml.train import preprocess_text

# Load machine learning model and vectorizer once at startup
script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model_path = os.path.join(script_dir, 'ml', 'model.joblib')
vectorizer_path = os.path.join(script_dir, 'ml', 'vectorizer.joblib')

ml_model = None
ml_vectorizer = None

try:
    if os.path.exists(model_path) and os.path.exists(vectorizer_path):
        ml_model = joblib.load(model_path)
        ml_vectorizer = joblib.load(vectorizer_path)
except Exception as e:
    print(f"Error loading ML model in classifier: {e}")


def classify_ticket(title: str, description: str, db: Session) -> tuple[Optional[int], float, bool, Optional[str]]:
    """
    ML-based classifier to route tickets automatically to departments.
    Returns: (assigned_department_id, confidence, needs_verification, priority_override)
    """
    content = title + " " + description
    content_lower = content.lower()
    
    # Deterministic emergency keyword routing overrides
    water_emergencies = ['flood', 'pipe burst', 'pipe breakage', 'water logging', 'drainage overflow', 'बाढी', 'डुबान', 'पाइप फुट्यो', 'ढल बगायो']
    roads_emergencies = ['accident', 'landslide', 'sinkhole', 'bridge collapse', 'road collapse', 'दुर्घटना', 'पहिरो', 'भत्कियो', 'दुर्घटना भयो']
    electricity_emergencies = ['fire', 'transformer fire', 'spark', 'electrocution', 'short circuit', 'power surge', 'explosion', 'generator fire', 'electric shock', 'आगो', 'आगलागी', 'विद्युत सर्ट', 'विस्फोट', 'करेन्ट', 'विद्युत सर्ट सर्किट']

    # Water Supply Emergency
    if any(keyword in content_lower for keyword in water_emergencies):
        dept = db.query(Department).filter(Department.name == "Water Supply").first()
        dept_id = dept.id if dept else 1
        return dept_id, 1.0, False, "high"

    # Roads & Infrastructure Emergency
    if any(keyword in content_lower for keyword in roads_emergencies):
        dept = db.query(Department).filter(Department.name == "Roads & Infrastructure").first()
        dept_id = dept.id if dept else 2
        return dept_id, 1.0, False, "high"

    # Electricity Authority Emergency
    if any(keyword in content_lower for keyword in electricity_emergencies):
        dept = db.query(Department).filter(Department.name == "Electricity Authority").first()
        dept_id = dept.id if dept else 3
        return dept_id, 1.0, False, "high"

    # Check if ML model is loaded and vectorizer is ready
    if ml_model is not None and ml_vectorizer is not None:
        try:
            cleaned = preprocess_text(content)
            tfidf_feat = ml_vectorizer.transform([cleaned])
            pred_dept = int(ml_model.predict(tfidf_feat)[0])
            
            # Get confidence score
            probs = ml_model.predict_proba(tfidf_feat)[0]
            class_index = list(ml_model.classes_).index(pred_dept)
            confidence = float(probs[class_index])
            
            if confidence >= 0.65:
                return pred_dept, confidence, False, None
            else:
                # Route to General Administration and flag for human review
                gen_dept = db.query(Department).filter(Department.name == "General Administration").first()
                gen_id = gen_dept.id if gen_dept else 5
                return gen_id, confidence, True, None
        except Exception as e:
            print(f"ML classification failed: {e}. Falling back to keywords...")
            
    # Fallback keyword classifier if ML model is not available
    keywords = {
        "Water Supply": ["water", "leak", "pipe", "burst", "flood", "sewage", "drain", "purification", "tap", "ढल", "धारा", "पानी"],
        "Roads & Infrastructure": ["road", "pothole", "street", "pavement", "bridge", "light", "sidewalk", "traffic", "बाटो", "खाल्डो", "सडक"],
        "Electricity Authority": ["electricity", "power", "grid", "outage", "blackout", "voltage", "meter", "generator", "shortage", "बत्ती", "बिजुली", "भोल्टेज"],
        "Waste Management": ["garbage", "trash", "waste", "dumpster", "litter", "rubbish", "cleaning", "dump", "bin", "फोहोर", "प्लास्टिक", "कुहिएको"],
        "General Administration": ["license", "permit", "document", "fee", "grievance", "register", "appointment", "inquiry", "दर्ता", "नवीकरण", "कर"]
    }
    
    best_dept = None
    max_matches = 0
    
    for dept_name, keys in keywords.items():
        matches = sum(content_lower.count(k) for k in keys)
        if matches > max_matches:
            max_matches = matches
            best_dept = dept_name
            
    if best_dept:
        dept = db.query(Department).filter(Department.name == best_dept).first()
        if dept:
            confidence = min(0.70 + (max_matches * 0.05), 0.98)
            return dept.id, confidence, False, None
            
    gen_dept = db.query(Department).filter(Department.name == "General Administration").first()
    gen_id = gen_dept.id if gen_dept else 5
    return gen_id, 0.60, True, None


def get_reasoning_keywords(title: str, description: str, predicted_dept: Optional[int], db: Session) -> list[str]:
    """
    Computes/extracts the top 3 highest-weighted keywords causing the model to choose a specific department.
    """
    if not predicted_dept:
        return []
        
    content = title + " " + description
    content_lower = content.lower()
    
    # 1. Emergency routing rule matching
    water_emergencies = ['flood', 'pipe burst', 'pipe breakage', 'water logging', 'drainage overflow', 'बाढी', 'डुबान', 'पाइप फुट्यो', 'ढल बगायो']
    roads_emergencies = ['accident', 'landslide', 'sinkhole', 'bridge collapse', 'road collapse', 'दुर्घटना', 'पहिरो', 'भत्कियो', 'दुर्घटना भयो']
    electricity_emergencies = ['fire', 'transformer fire', 'spark', 'electrocution', 'short circuit', 'power surge', 'explosion', 'generator fire', 'electric shock', 'आगो', 'आगलागी', 'विद्युत सर्ट', 'विस्फोट', 'करेन्ट', 'विद्युत सर्ट सर्किट']

    matched_emergencies = []
    if predicted_dept == 1:
        matched_emergencies = [k for k in water_emergencies if k in content_lower]
    elif predicted_dept == 2:
        matched_emergencies = [k for k in roads_emergencies if k in content_lower]
    elif predicted_dept == 3:
        matched_emergencies = [k for k in electricity_emergencies if k in content_lower]
        
    if matched_emergencies:
        return list(set(matched_emergencies))[:3]

    # 2. Extract from Logistic Regression + TF-IDF model
    if ml_model is not None and ml_vectorizer is not None:
        try:
            cleaned = preprocess_text(content)
            words = list(set(cleaned.split()))
            if words:
                tfidf_feat = ml_vectorizer.transform([cleaned])
                if predicted_dept in ml_model.classes_:
                    class_index = list(ml_model.classes_).index(predicted_dept)
                    coef = ml_model.coef_[class_index]
                    feature_names = ml_vectorizer.get_feature_names_out()
                    
                    # Compute feature contributions (element-wise multiplication)
                    dense_tfidf = tfidf_feat.toarray()[0]
                    contributions = dense_tfidf * coef
                    
                    active_indices = [i for i, val in enumerate(dense_tfidf) if val > 0]
                    
                    word_scores = {}
                    for w in words:
                        w_score = 0.0
                        for idx in active_indices:
                            feat_name = feature_names[idx]
                            # Word features (word_tfidf__)
                            if feat_name.startswith("word_tfidf__"):
                                feat_word = feat_name.replace("word_tfidf__", "")
                                if w in feat_word:
                                    w_score += contributions[idx]
                            # Character features (char_tfidf__)
                            elif feat_name.startswith("char_tfidf__"):
                                feat_char = feat_name.replace("char_tfidf__", "")
                                if feat_char in w:
                                    # Character n-grams contribute slightly less per-match than full word
                                    w_score += contributions[idx] * 0.5
                        word_scores[w] = w_score
                        
                    # Sort words by score descending
                    sorted_words = sorted(word_scores.items(), key=lambda x: x[1], reverse=True)
                    return [w for w, score in sorted_words][:3]
        except Exception as e:
            print(f"Error calculating ML feature importance in XAI: {e}")

    # 3. Fallback Keyword Route
    keywords = {
        1: ["water", "leak", "pipe", "burst", "flood", "sewage", "drain", "purification", "tap", "ढल", "धारा", "पानी"],
        2: ["road", "pothole", "street", "pavement", "bridge", "light", "sidewalk", "traffic", "बाटो", "खाल्डो", "सडक"],
        3: ["electricity", "power", "grid", "outage", "blackout", "voltage", "meter", "generator", "shortage", "बत्ती", "बिजुली", "भोल्टेज"],
        4: ["garbage", "trash", "waste", "dumpster", "litter", "rubbish", "cleaning", "dump", "bin", "फोहोर", "प्लास्टिक", "कुहिएको"],
        5: ["license", "permit", "document", "fee", "grievance", "register", "appointment", "inquiry", "दर्ता", "नवीकरण", "कर"]
    }
    dept_keys = keywords.get(predicted_dept, [])
    matched_keys = [k for k in dept_keys if k in content_lower]
    if matched_keys:
        return matched_keys[:3]
        
    # Final generic words extraction fallback
    try:
        cleaned = preprocess_text(content)
        words = list(set(cleaned.split()))
        if words:
            return words[:3]
    except Exception:
        pass

    return []
