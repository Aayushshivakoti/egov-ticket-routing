import os
import sys
import joblib

# Import preprocess_text from train.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from train import preprocess_text

def main():
    if len(sys.argv) < 2:
        # Fallback default test string
        test_str = "The garbage truck hasn't collected our neighborhood bins, there is trash everywhere."
        print(f"No custom query input found. Running test on default: '{test_str}'")
    else:
        test_str = " ".join(sys.argv[1:])
        print(f"Running prediction on input query: '{test_str}'")
        
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, 'model.joblib')
    vectorizer_path = os.path.join(script_dir, 'vectorizer.joblib')
    
    if not os.path.exists(model_path) or not os.path.exists(vectorizer_path):
        print("Error: Serialized model/vectorizer assets not found. Run train.py first to build them.")
        sys.exit(1)
        
    # Load model and vectorizer
    model = joblib.load(model_path)
    vectorizer = joblib.load(vectorizer_path)
    
    # Predict
    cleaned = preprocess_text(test_str)
    tfidf_feat = vectorizer.transform([cleaned])
    pred_dept = int(model.predict(tfidf_feat)[0])
    
    # Calculate confidence probabilities
    try:
        probs = model.predict_proba(tfidf_feat)[0]
        # Classes correspond to 1, 2, 3, 4, 5
        # Index corresponds to class_value - 1
        class_index = list(model.classes_).index(pred_dept)
        confidence = float(probs[class_index])
    except Exception:
        confidence = 1.0 # fallback
        
    dept_names = {
        1: "Water Supply",
        2: "Roads & Infrastructure",
        3: "Electricity Authority",
        4: "Waste Management",
        5: "General Administration"
    }
    
    print("\n=== PREDICTION ENGINE DIAGNOSTIC ===")
    print(f"Raw grievance:       {test_str}")
    print(f"Routed Department:   {dept_names.get(pred_dept, 'Unknown')}")
    print(f"Target Dept ID:      {pred_dept}")
    print(f"Confidence Level:    {confidence * 100:.1f}%")

if __name__ == "__main__":
    main()
