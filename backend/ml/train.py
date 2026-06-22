import os
import re
import string
import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix

# Pure Python fallback preprocessing function
def fallback_preprocess_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    tokens = text.split()
    
    STOP_WORDS = {
        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll", "you'd",
        'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers',
        'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
        'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
        'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
        'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
        'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
        'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
        'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', "don't", 'should',
        "should've", 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', "aren't", 'couldn', "couldn't",
        'didn', "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't", 'isn', "isn't",
        'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't", 'shan', "shan't", 'shouldn', "shouldn't",
        'wasn', "wasn't", 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't"
    }
    
    def basic_lemma(word: str) -> str:
        if len(word) > 4:
            if word.endswith('ies'): return word[:-3] + 'y'
            if word.endswith('es') and not word.endswith('aes'): return word[:-2]
            if word.endswith('s') and not word.endswith('ss'): return word[:-1]
            if word.endswith('ing'): return word[:-3]
            if word.endswith('ed'): return word[:-2]
        return word
        
    cleaned = [basic_lemma(word) for word in tokens if word not in STOP_WORDS]
    return " ".join(cleaned)

# Attempt NLTK preprocessing setup
try:
    import nltk
    from nltk.corpus import stopwords
    from nltk.tokenize import word_tokenize
    from nltk.stem import WordNetLemmatizer
    
    # Download datasets silently, including the punkt_tab required in nltk >= 3.9
    nltk.download('punkt', quiet=True)
    nltk.download('punkt_tab', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('wordnet', quiet=True)
    nltk.download('omw-1.4', quiet=True)
    
    STOP_WORDS = set(stopwords.words('english'))
    lemmatizer = WordNetLemmatizer()
    
    def preprocess_text(text: str) -> str:
        try:
            text = text.lower()
            text = text.translate(str.maketrans('', '', string.punctuation))
            tokens = word_tokenize(text)
            cleaned = [lemmatizer.lemmatize(word) for word in tokens if word not in STOP_WORDS]
            return " ".join(cleaned)
        except Exception:
            return fallback_preprocess_text(text)
            
except Exception as e:
    print(f"NLTK setup failed ({e}). Falling back to pure Python preprocessing...")
    def preprocess_text(text: str) -> str:
        return fallback_preprocess_text(text)

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, 'dataset.csv')
    
    print(f"Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    
    print("Cleaning & preprocessing texts...")
    df['cleaned_text'] = df['text'].apply(preprocess_text)
    
    X = df['cleaned_text']
    y = df['department_id']
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print("Transforming texts using TF-IDF (ngrams=1-2)...")
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=2)
    X_train_tfidf = vectorizer.fit_transform(X_train)
    X_test_tfidf = vectorizer.transform(X_test)
    
    print("Training Logistic Regression classifier...")
    model = LogisticRegression(C=1.0, random_state=42, max_iter=1000)
    model.fit(X_train_tfidf, y_train)
    
    predictions = model.predict(X_test_tfidf)
    print("\n=== CLASSIFICATION REPORT ===")
    print(classification_report(y_test, predictions, target_names=[
        "Water Supply", "Roads & Infrastructure", "Electricity Authority", "Waste Management", "General Administration"
    ]))
    
    print("=== CONFUSION MATRIX ===")
    print(confusion_matrix(y_test, predictions))
    
    print("\nSerializing and saving trained vectorizer and model...")
    joblib.dump(model, os.path.join(script_dir, 'model.joblib'))
    joblib.dump(vectorizer, os.path.join(script_dir, 'vectorizer.joblib'))
    print("Success: Vectorizer and Model saved successfully.")

if __name__ == "__main__":
    main()
