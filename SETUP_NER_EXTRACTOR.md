# Setup Guide: spaCy NER Extractor Service

This document provides instructions to set up the Python-based NER (Named Entity Recognition) extraction service, which uses spaCy for robust person and company name extraction.

## Prerequisites

1. **Python 3**: Ensure Python 3 is installed on your system.
2. **pip3**: Python's package installer.

## Installation Steps

1. **Navigate to the project root directory**:

   ```bash
   cd /path/to/your/NBM-prospecting
   ```

2. **Install Python dependencies**:

   ```bash
   pip3 install -r requirements-news.txt
   ```

3. **Download spaCy language model**:
   The service will try to load models in this order (best to good):

   - `en_core_web_trf` (transformer-based, most accurate but largest)
   - `en_core_web_lg` (large model)
   - `en_core_web_md` (medium model)
   - `en_core_web_sm` (small model, fastest)

   For best results, install the transformer model:

   ```bash
   python3 -m spacy download en_core_web_trf
   ```

   Or for a smaller/faster option:

   ```bash
   python3 -m spacy download en_core_web_sm
   ```

4. **Make the Python script executable**:
   ```bash
   chmod +x ner-extractor-service.py
   ```

## Testing the NER Service

You can test the NER service independently:

1. **Test executive extraction**:

   ```bash
   python3 ner-extractor-service.py --text "John Smith, CEO of Acme Corp, announced a new product." --type executives
   ```

2. **Test company extraction**:

   ```bash
   python3 ner-extractor-service.py --text "Acme Corp announced a merger with Tech Inc." --type companies
   ```

3. **Test both**:
   ```bash
   python3 ner-extractor-service.py --text "John Smith, CEO of Acme Corp, announced a merger with Tech Inc." --type both
   ```

## Integration with Node.js Application

The Node.js application automatically detects and utilizes this Python service if it's available.

1. **Ensure the Python dependencies are installed** (as per step 2 above).
2. **Ensure a spaCy model is downloaded** (as per step 3 above).
3. **Restart your Node.js server**:
   ```bash
   npm run dev
   ```

Upon startup, you should see:

```
[NER Extractor] Python spaCy service is available
```

If the service is not detected, the application will gracefully fall back to regex-based extraction.

## How It Works

The spaCy NER service:

1. **Extracts PERSON entities** from text using spaCy's NER model
2. **Finds executive titles** by searching for title patterns (CEO, CTO, CFO, etc.) near person names
3. **Extracts ORG entities** (companies) from text
4. **Filters out invalid entities** (sentence fragments, HTML artifacts, etc.)
5. **Returns structured JSON** with executives and companies

This hybrid approach provides:

- **High recall**: Catches most potential exec-name mentions
- **Reasonable precision**: Filters to likely executives with titles
- **Better than regex**: Handles complex sentence structures and context

## Troubleshooting

- **`spaCy not installed` warning**: Ensure `pip3 install spacy` completed successfully
- **`No spaCy model found` error**: Run `python3 -m spacy download en_core_web_sm`
- **`Permission denied` error**: Ensure `chmod +x ner-extractor-service.py` was run
- **No output from Python script**: Run the test commands above to debug the Python script directly
- **Model download fails**: Try downloading a smaller model first (`en_core_web_sm`)
