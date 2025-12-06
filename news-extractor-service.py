#!/usr/bin/env python3
"""
News extraction microservice using newspaper4k
Provides robust article extraction that's proven and maintained
"""

import sys
import json
import argparse
from newspaper import Article
from datetime import datetime, timedelta
import requests
from typing import List, Dict, Optional

def extract_article(url: str) -> Optional[Dict]:
    """Extract article content using newspaper4k"""
    try:
        article = Article(url)
        article.download()
        article.parse()
        
        return {
            "title": article.title or "",
            "text": article.text or "",
            "authors": article.authors or [],
            "publish_date": article.publish_date.isoformat() if article.publish_date else None,
            "summary": article.summary or "",
            "keywords": article.keywords or [],
            "url": url,
        }
    except Exception as e:
        print(f"Error extracting {url}: {e}", file=sys.stderr)
        return None

def fetch_rss_articles(feed_url: str, days_back: int = 90) -> List[Dict]:
    """Fetch articles from RSS feed and extract full content"""
    try:
        import feedparser
        feed = feedparser.parse(feed_url)
        articles = []
        cutoff_date = datetime.now() - timedelta(days=days_back)
        
        for entry in feed.entries[:50]:  # Limit to 50 most recent
            url = entry.get('link', '')
            if not url:
                continue
            
            # Check date if available
            pub_date = None
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                pub_date = datetime(*entry.published_parsed[:6])
            elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                pub_date = datetime(*entry.updated_parsed[:6])
            
            # Include if date is missing or within window
            if pub_date is None or pub_date >= cutoff_date:
                article_data = extract_article(url)
                if article_data:
                    article_data["publishedAt"] = pub_date.isoformat() if pub_date else datetime.now().isoformat()
                    article_data["description"] = entry.get('summary', article_data.get('summary', ''))
                    article_data["source"] = feed.feed.get('title', '')
                    articles.append(article_data)
        
        return articles
    except Exception as e:
        print(f"Error fetching RSS {feed_url}: {e}", file=sys.stderr)
        return []

def main():
    parser = argparse.ArgumentParser(description='News extraction service')
    parser.add_argument('--url', help='Extract single article URL')
    parser.add_argument('--rss', help='Fetch from RSS feed URL')
    parser.add_argument('--days', type=int, default=90, help='Days back to fetch')
    
    args = parser.parse_args()
    
    if args.url:
        result = extract_article(args.url)
        if result:
            print(json.dumps(result))
    elif args.rss:
        articles = fetch_rss_articles(args.rss, args.days)
        print(json.dumps(articles))
    else:
        print(json.dumps({"error": "Must provide --url or --rss"}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

