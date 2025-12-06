#!/usr/bin/env python3
"""
NER (Named Entity Recognition) extraction service using spaCy
Extracts PERSON and ORG entities with title detection
"""

import sys
import json
import argparse
import re

try:
    import spacy
except ImportError:
    print("Error: spaCy not installed. Run: pip3 install spacy && python3 -m spacy download en_core_web_sm", file=sys.stderr)
    sys.exit(1)

# Try to load the best available model, fallback to smaller ones
nlp = None
for model_name in ["en_core_web_trf", "en_core_web_lg", "en_core_web_md", "en_core_web_sm"]:
    try:
        nlp = spacy.load(model_name)
        print(f"Loaded spaCy model: {model_name}", file=sys.stderr)
        break
    except OSError:
        continue

if nlp is None:
    print("Error: No spaCy model found. Run: python3 -m spacy download en_core_web_sm", file=sys.stderr)
    sys.exit(1)

# Executive title patterns (case-insensitive)
EXECUTIVE_TITLES = [
    r'\bCEO\b', r'\bCTO\b', r'\bCFO\b', r'\bCMO\b', r'\bCOO\b',
    r'\bChief Executive Officer\b', r'\bChief Technology Officer\b',
    r'\bChief Financial Officer\b', r'\bChief Marketing Officer\b',
    r'\bChief Operating Officer\b',
    r'\bPresident\b', r'\bVice President\b', r'\bVP\b',
    r'\bManaging Director\b', r'\bExecutive Director\b',
    r'\bFounder\b', r'\bCo-founder\b', r'\bCo-Founder\b',
    r'\bHead of\b', r'\bDirector of\b', r'\bManaging Partner\b',
    r'\bPrincipal\b', r'\bBoard Member\b', r'\bChairman\b',
    r'\bChief of Staff\b', r'\bPractice Lead\b',
]

EXECUTIVE_TITLE_PATTERN = re.compile('|'.join(EXECUTIVE_TITLE for EXECUTIVE_TITLE in EXECUTIVE_TITLES), re.IGNORECASE)

# Title cue words that indicate someone was appointed/named/hired
TITLE_CUE_WORDS = [
    'appointed', 'named', 'hired', 'joins as', 'joined as', 'serves as',
    'is', 'was', 'became', 'named as', 'hired as', 'appointed as',
    'announced', 'revealed', 'confirmed'
]

def find_title_near_person(doc, person_span):
    """
    Find executive title near a PERSON entity by looking at surrounding context
    """
    # Look in a window around the person (3 sentences before/after)
    person_sent = None
    for sent in doc.sents:
        if sent.start <= person_span.end and sent.end >= person_span.start:
            person_sent = sent
            break
    
    if person_sent is None:
        return None
    
    # Search for title patterns in the sentence containing the person
    sentence_text = person_sent.text
    
    # Look for title patterns
    title_matches = list(EXECUTIVE_TITLE_PATTERN.finditer(sentence_text))
    if not title_matches:
        return None
    
    # Find the closest title to the person
    person_start_in_sent = person_span.start - person_sent.start
    person_end_in_sent = person_span.end - person_sent.start
    
    closest_title = None
    min_distance = float('inf')
    
    for match in title_matches:
        title_start = match.start()
        title_end = match.end()
        
        # Calculate distance (prefer titles after the person name)
        if title_start >= person_end_in_sent:
            distance = title_start - person_end_in_sent
        elif title_end <= person_start_in_sent:
            distance = person_start_in_sent - title_end
        else:
            distance = 0  # Overlapping or very close
        
        if distance < min_distance and distance < 50:  # Within 50 chars
            min_distance = distance
            closest_title = match.group().strip()
    
    return closest_title if closest_title else None

def extract_executives(text):
    """
    Extract executives (PERSON entities with titles) from text
    """
    doc = nlp(text)
    executives = []
    seen = set()
    
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            person_name = ent.text.strip()
            
            # Skip if too short or too long
            if len(person_name) < 3 or len(person_name) > 50:
                continue
            
            # Skip if contains invalid characters
            if '\n' in person_name or '#' in person_name or '{' in person_name or '}' in person_name:
                continue
            
            # Skip if looks like a sentence fragment
            person_lower = person_name.lower()
            if any(person_lower.startswith(word) for word in ['who', 'what', 'where', 'when', 'why', 'how', 'which', 'that', 'this', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they']):
                continue
            
            # Find title near this person
            title = find_title_near_person(doc, ent)
            
            # Only include if we found a title (executives should have titles)
            if title:
                # Normalize title
                title_normalized = title.strip()
                
                # Create unique key
                key = f"{person_name.lower()}-{title_normalized.lower()}"
                if key not in seen:
                    seen.add(key)
                    executives.append({
                        "name": person_name,
                        "title": title_normalized,
                        "confidence": 0.9,  # High confidence with spaCy + title detection
                    })
    
    return executives

def extract_companies(text):
    """
    Extract companies (ORG entities) from text
    """
    doc = nlp(text)
    companies = []
    seen = set()
    
    for ent in doc.ents:
        if ent.label_ == "ORG":
            company_name = ent.text.strip()
            
            # Skip if too short or too long
            if len(company_name) < 2 or len(company_name) > 50:
                continue
            
            # Skip if contains invalid characters
            if '\n' in company_name or '#' in company_name or '{' in company_name or '}' in company_name:
                continue
            
            # Skip common non-company ORG entities
            company_lower = company_name.lower()
            if any(company_lower.startswith(word) for word in ['the ', 'a ', 'an ']):
                # Remove articles
                company_name = re.sub(r'^(the|a|an)\s+', '', company_name, flags=re.IGNORECASE).strip()
            
            # Skip if it's a single-word title (CEO, CTO, CFO, etc.)
            if company_lower in ['ceo', 'cto', 'cfo', 'cmo', 'coo', 'president', 'vp', 'founder', 'co-founder']:
                continue
            
            # Skip if looks like a sentence fragment
            if any(company_lower.startswith(word) for word in ['after', 'before', 'when', 'while', 'during', 'since', 'until', 'if', 'unless', 'because', 'although', 'though']):
                continue
            
            # Skip if contains verbs (likely a sentence)
            if re.search(r'\s+(is|was|are|were|has|have|had|will|would|can|could|should|may|might|being|been)\s+', company_lower):
                # But allow if it's a known company pattern like "X and Y" or "X of Y"
                if not re.search(r'\s+(and|of|&|inc|llc|corp|ltd)\s+', company_lower):
                    continue
            
            # Create unique key
            key = company_name.lower()
            if key not in seen:
                seen.add(key)
                companies.append({
                    "name": company_name,
                    "normalizedName": company_name.lower().strip(),
                })
    
    return companies

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NER extraction service using spaCy")
    parser.add_argument("--text", help="Text to extract entities from", required=True)
    parser.add_argument("--type", choices=["executives", "companies", "both"], default="both", help="Type of extraction")
    
    args = parser.parse_args()
    
    try:
        result = {}
        
        if args.type in ["executives", "both"]:
            executives = extract_executives(args.text)
            result["executives"] = executives
        
        if args.type in ["companies", "both"]:
            companies = extract_companies(args.text)
            result["companies"] = companies
        
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

