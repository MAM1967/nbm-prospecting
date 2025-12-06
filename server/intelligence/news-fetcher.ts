// Cost-effective news fetching using free RSS feeds
// NewsAPI has a free tier but limited to 100 requests/day, so we'll use RSS primarily

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
  content?: string;
}

// Free RSS feeds for tech/business news
const RSS_FEEDS = {
  tech: [
    'https://techcrunch.com/feed/',
    'https://www.theverge.com/rss/index.xml',
    'https://feeds.arstechnica.com/arstechnica/index',
  ],
  business: [
    'https://feeds.bbci.co.uk/news/business/rss.xml',
    'https://www.forbes.com/business/feed/',
  ],
};

export async function fetchNewsFromRSS(category: 'tech' | 'business' = 'tech'): Promise<NewsArticle[]> {
  const feeds = RSS_FEEDS[category];
  const articles: NewsArticle[] = [];

  for (const feedUrl of feeds) {
    try {
      const response = await fetch(feedUrl);
      const xmlText = await response.text();
      
      // Simple XML parsing for RSS feeds
      const items = parseRSSFeed(xmlText);
      articles.push(...items);
    } catch (error) {
      console.error(`Failed to fetch ${feedUrl}:`, error);
    }
  }

  return articles;
}

function parseRSSFeed(xml: string): NewsArticle[] {
  const articles: NewsArticle[] = [];
  
  // Extract <item> tags
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const items = xml.match(itemRegex) || [];

  for (const item of items) {
    const title = extractTag(item, 'title');
    const description = extractTag(item, 'description');
    const link = extractTag(item, 'link');
    const pubDate = extractTag(item, 'pubDate');
    
    if (title && link) {
      articles.push({
        title: cleanHTML(title),
        description: cleanHTML(description || ''),
        url: link,
        publishedAt: pubDate || new Date().toISOString(),
        source: new URL(link).hostname,
      });
    }
  }

  return articles;
}

function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>`, 's');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

function cleanHTML(text: string): string {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

// Filter articles from the last 7 days
export function filterRecentArticles(articles: NewsArticle[], daysBack: number = 7): NewsArticle[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return articles.filter(article => {
    const articleDate = new Date(article.publishedAt);
    return articleDate >= cutoffDate;
  });
}
