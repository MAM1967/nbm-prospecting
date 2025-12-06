# News Extractor Setup

## Why Use newspaper4k?

Based on the [news crawlers comparison](https://github.com/free-news-api/news-crawlers), **newspaper4k** is the most robust solution:
- **High Accuracy**: F1-score of 0.9460 (vs our custom scraper's unknown performance)
- **Actively Maintained**: Regular updates and community support
- **Proven**: Used by thousands of projects
- **Feature-Rich**: Multithreading, 80+ languages, NLP integration

## Setup Instructions

### 1. Install Python Dependencies

```bash
pip3 install -r requirements-news.txt
```

Or install manually:
```bash
pip3 install newspaper4k feedparser requests lxml beautifulsoup4
```

### 2. Test the Service

```bash
python3 news-extractor-service.py --url "https://techcrunch.com/2024/01/15/example-article"
```

### 3. Test RSS Feed

```bash
python3 news-extractor-service.py --rss "https://techcrunch.com/feed/" --days 90
```

### 4. Restart Node.js Server

The Node.js server will automatically detect if Python service is available and use it. If not available, it falls back to the Node.js RSS parser.

## Benefits

✅ **Robust**: Handles dynamic content, anti-scraping measures  
✅ **Accurate**: High-quality article extraction  
✅ **Maintained**: Community-driven updates  
✅ **Fast**: Multithreading support  
✅ **Fallback**: Node.js scraper still works if Python unavailable

## Troubleshooting

- **Python not found**: Install Python 3.8+
- **newspaper4k import error**: Run `pip3 install newspaper4k`
- **Service fails**: Check logs for specific errors, falls back to Node.js scraper

