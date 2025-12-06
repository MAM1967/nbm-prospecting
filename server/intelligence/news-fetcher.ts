import Parser from "rss-parser";
import axios from "axios";
import type { Industry } from "./industry-classifier";

// Cost-effective news fetching using RSS feeds + NewsAPI
// NewsAPI has a free tier but limited to 100 requests/day, so we'll use RSS primarily

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
  content?: string;
}

// Industry-specific RSS feeds per PRD section 2.1
const RSS_FEEDS: Record<string, string[]> = {
  "Tech, SaaS, B2B software": [
    'https://techcrunch.com/feed/',
    'https://www.theverge.com/rss/index.xml',
    'https://feeds.arstechnica.com/arstechnica/index',
    'https://feeds.feedburner.com/oreilly/radar',
  ],
  "Professional services": [
    'https://feeds.bbci.co.uk/news/business/rss.xml',
    'https://www.forbes.com/business/feed/',
    'https://feeds.hbr.org/harvardbusiness',
  ],
  "E-commerce & DTC brands": [
    'https://www.retaildive.com/feeds/news/',
    'https://www.modernretail.co/feed/',
    'https://www.digitalcommerce360.com/feed/',
  ],
  "Healthcare & life sciences": [
    'https://www.statnews.com/feed/',
    'https://www.fiercehealthcare.com/rss/xml',
    'https://www.healthleadersmedia.com/rss.xml',
  ],
  "Manufacturing & distribution": [
    'https://www.industryweek.com/rss.xml',
    'https://www.supplychaindive.com/feeds/news/',
    'https://www.mhlnews.com/rss.xml',
  ],
  "Hospitality & retail": [
    'https://www.hotel-online.com/feed/',
    'https://www.restaurantbusinessonline.com/rss.xml',
    'https://www.retaildive.com/feeds/news/',
  ],
  "Nonprofits & mission-driven orgs": [
    'https://nonprofitquarterly.org/feed/',
    'https://www.chronicleofphilanthropy.com/rss.xml',
    'https://www.insidephilanthropy.com/feed',
  ],
};

const parser = new Parser();

/**
 * Fetch news from RSS feeds for a specific industry
 * Per PRD FR-01: Pull news from NewsAPI + RSS feeds
 */
export async function fetchNewsFromRSS(industry: Industry = "Tech, SaaS, B2B software"): Promise<NewsArticle[]> {
  const feeds = RSS_FEEDS[industry] || RSS_FEEDS["Tech, SaaS, B2B software"];
  const articles: NewsArticle[] = [];

  for (const feedUrl of feeds) {
    try {
      const feed = await parser.parseURL(feedUrl);
      
      if (feed.items) {
        for (const item of feed.items) {
          if (item.title && item.link) {
            articles.push({
              title: item.title,
              description: item.contentSnippet || item.content || item.description || '',
              url: item.link,
              publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
              source: new URL(item.link || '').hostname,
              content: item.content,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${feedUrl}:`, error);
    }
  }

  return articles;
}

/**
 * Fetch news from NewsAPI
 * Per PRD FR-01: Pull news from NewsAPI + RSS feeds
 */
export async function fetchNewsFromNewsAPI(industry: Industry = "Tech, SaaS, B2B software"): Promise<NewsArticle[]> {
  if (!process.env.NEWSAPI_KEY) {
    console.warn("NEWSAPI_KEY not set, skipping NewsAPI fetch");
    return [];
  }

  try {
    // Map industry to NewsAPI category/keywords
    const categoryMap: Record<string, string> = {
      "Tech, SaaS, B2B software": "technology",
      "Professional services": "business",
      "E-commerce & DTC brands": "business",
      "Healthcare & life sciences": "health",
      "Manufacturing & distribution": "business",
      "Hospitality & retail": "business",
      "Nonprofits & mission-driven orgs": "general",
    };

    const category = categoryMap[industry] || "business";
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 90); // 90-day window per PRD FR-01

    const response = await axios.get("https://newsapi.org/v2/everything", {
      params: {
        apiKey: process.env.NEWSAPI_KEY,
        category,
        from: fromDate.toISOString().split('T')[0],
        sortBy: "publishedAt",
        pageSize: 100, // Max per request
        language: "en",
      },
      timeout: 10000,
    });

    if (response.data.articles) {
      return response.data.articles.map((article: any) => ({
        title: article.title || '',
        description: article.description || '',
        url: article.url || '',
        publishedAt: article.publishedAt || new Date().toISOString(),
        source: article.source?.name || 'newsapi',
        content: article.content,
      }));
    }

    return [];
  } catch (error) {
    console.error("Error fetching from NewsAPI:", error);
    return [];
  }
}

/**
 * Fetch all industry news (RSS + NewsAPI combined)
 * Per PRD FR-01: Process up to 2,000 articles per run
 */
export async function fetchIndustryNews(industry: Industry = "Tech, SaaS, B2B software"): Promise<NewsArticle[]> {
  const [rssArticles, newsApiArticles] = await Promise.all([
    fetchNewsFromRSS(industry),
    fetchNewsFromNewsAPI(industry),
  ]);

  // Combine and deduplicate by URL
  const allArticles = [...rssArticles, ...newsApiArticles];
  const uniqueArticles = deduplicateArticles(allArticles);

  // Limit to 2,000 articles per PRD FR-01
  return uniqueArticles.slice(0, 2000);
}

/**
 * Deduplicate articles by URL
 */
function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const unique: NewsArticle[] = [];

  for (const article of articles) {
    const url = new URL(article.url).href; // Normalize URL
    if (!seen.has(url)) {
      seen.add(url);
      unique.push(article);
    }
  }

  return unique;
}

/**
 * Filter articles from the last N days
 * Per PRD FR-01: Filter by 90-day window
 */
export function filterRecentArticles(articles: NewsArticle[], daysBack: number = 90): NewsArticle[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return articles.filter(article => {
    const articleDate = new Date(article.publishedAt);
    return articleDate >= cutoffDate;
  });
}
