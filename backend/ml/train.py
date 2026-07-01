import os
import re
import string
import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import FeatureUnion
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report, confusion_matrix

# Nepali stop words list
NEPALI_STOPWORDS = {
    'र', 'त', 'नेपाल', 'को', 'का', 'की', 'ले', 'मा', 'नि', 'पनि', 'छ', 'छन्', 'थिए', 'भयो', 'गरे', 'गर्नु', 'हुने', 'हो', 'हुन्', 'बाट', 'लाई', 'देखि', 'म', 'हामी', 'तपाई', 'ऊ', 'यो', 'त्यो', 'यस', 'त्यस', 'भने', 'रहेको', 'गरेको', 'भनेर', 'रुपमा', 'पर्ने', 'गर्न', 'पर्छ', 'यस्तो', 'त्यस्तो', 'पनि', 'हुन'
}

def stem_nepali(word: str) -> str:
    """
    Remove common suffixes from Nepali Devanagari words to normalize variations.
    """
    suffixes = [
        'हरू', 'लाई', 'बाट', 'सँग', 'सँगै', 'भन्दा', 'सम्म',
        'को', 'का', 'की', 'ले', 'मा', 'नि', 'नै',
        'देखि', 'द्वारा', 'तर्फ', 'माथि', 'मुनि', 'हरूलाई', 'हरूबाट'
    ]
    suffixes.sort(key=len, reverse=True)
    for suffix in suffixes:
        if word.endswith(suffix) and len(word) > len(suffix) + 1:
            return word[:-len(suffix)]
    return word

# Pure Python fallback preprocessing function
def fallback_preprocess_text(text: str) -> str:
    text = text.lower()
    punc_to_strip = string.punctuation + '।॥'
    text = text.translate(str.maketrans('', '', punc_to_strip))
    tokens = text.split()
    
    STOP_WORDS_EN = {
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
        
    cleaned = []
    for word in tokens:
        if word in STOP_WORDS_EN or word in NEPALI_STOPWORDS:
            continue
        if re.match(r'^[a-z]+$', word):
            cleaned.append(basic_lemma(word))
        else:
            cleaned.append(stem_nepali(word))
    return " ".join(cleaned)

# Attempt NLTK preprocessing setup
try:
    import nltk
    from nltk.corpus import stopwords
    from nltk.tokenize import word_tokenize
    from nltk.stem import WordNetLemmatizer
    
    # Download datasets silently
    nltk.download('punkt', quiet=True)
    nltk.download('punkt_tab', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('wordnet', quiet=True)
    nltk.download('omw-1.4', quiet=True)
    
    STOP_WORDS_EN = set(stopwords.words('english'))
    lemmatizer = WordNetLemmatizer()
    
    def preprocess_text(text: str) -> str:
        try:
            text = text.lower()
            punc_to_strip = string.punctuation + '।॥'
            text = text.translate(str.maketrans('', '', punc_to_strip))
            tokens = word_tokenize(text)
            
            cleaned = []
            for word in tokens:
                if word in STOP_WORDS_EN or word in NEPALI_STOPWORDS:
                    continue
                # Lemmatize English terms, stem Devanagari
                if re.match(r'^[a-z]+$', word):
                    cleaned.append(lemmatizer.lemmatize(word))
                else:
                    cleaned.append(stem_nepali(word))
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
    
    print("Setting up hybrid character/word-level TF-IDF vectorizer...")
    word_vectorizer = TfidfVectorizer(analyzer='word', ngram_range=(1, 2), min_df=2)
    char_vectorizer = TfidfVectorizer(analyzer='char', ngram_range=(3, 5), min_df=2)
    
    vectorizer = FeatureUnion([
        ('word_tfidf', word_vectorizer),
        ('char_tfidf', char_vectorizer)
    ])
    
    print("Fitting and transforming text features...")
    X_train_tfidf = vectorizer.fit_transform(X_train)
    X_test_tfidf = vectorizer.transform(X_test)
    
    print("Training Calibrated LinearSVC classifier...")
    base_svc = LinearSVC(C=1.0, random_state=42, dual=False, max_iter=2000)
    model = CalibratedClassifierCV(estimator=base_svc, cv=5)
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
