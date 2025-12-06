import Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";
import type { Industry } from "./industry-classifier";
import {
  fetchRSSWithNewspaper4k,
  checkPythonService,
  type ExtractedArticle,
} from "./news-extractor-service";

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
// Expanded with more sources for better 90-day coverage
// Added Google News RSS feeds for better coverage
const RSS_FEEDS: Record<string, string[]> = {
  "Tech, SaaS, B2B software": [
    "https://techcrunch.com/feed/",
    "https://www.theverge.com/rss/index.xml",
    "https://feeds.arstechnica.com/arstechnica/index",
    "https://feeds.feedburner.com/oreilly/radar",
    "https://www.wired.com/feed/rss",
    "https://feeds.feedburner.com/venturebeat/SZYF",
    "https://www.zdnet.com/news/rss.xml",
    "https://www.cnet.com/rss/news/",
    "https://www.businessinsider.com/rss",
    "https://news.google.com/rss/search?q=tech+startup+saas&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=b2b+software&hl=en-US&gl=US&ceid=US:en",
    "https://feeds.feedburner.com/oreilly/radar",
    "https://www.techrepublic.com/rssfeeds/articles/",
    "https://www.engadget.com/rss.xml",
  ],
  "Professional services": [
    "https://feeds.bbci.co.uk/news/business/rss.xml",
    "https://www.forbes.com/business/feed/",
    "https://feeds.hbr.org/harvardbusiness",
    "https://www.ft.com/rss",
    "https://feeds.reuters.com/reuters/businessNews",
    "https://www.bloomberg.com/feed/topics/business",
    "https://www.wsj.com/xml/rss/3_7085.xml",
    "https://news.google.com/rss/search?q=consulting+professional+services&hl=en-US&gl=US&ceid=US:en",
    "https://www.consulting.us/rss",
    "https://www.accountingtoday.com/rss",
  ],
  "E-commerce & DTC brands": [
    "https://www.retaildive.com/feeds/news/",
    "https://www.modernretail.co/feed/",
    "https://www.digitalcommerce360.com/feed/",
    "https://www.ecommercetimes.com/perl/syndication/rssfull.pl",
    "https://www.practicalecommerce.com/feed",
    "https://news.google.com/rss/search?q=ecommerce+dtc+brands&hl=en-US&gl=US&ceid=US:en",
    "https://www.shopify.com/blogs/news.atom",
    "https://www.bigcommerce.com/blog/rss/",
  ],
  "Healthcare & life sciences": [
    "https://www.statnews.com/feed/",
    "https://www.fiercehealthcare.com/rss/xml",
    "https://www.healthleadersmedia.com/rss.xml",
    "https://www.biospace.com/rss",
    "https://www.fiercebiotech.com/rss/xml",
    "https://news.google.com/rss/search?q=healthcare+pharma+biotech&hl=en-US&gl=US&ceid=US:en",
    "https://www.modernhealthcare.com/rss",
    "https://www.pharmaceutical-technology.com/feed/",
  ],
  "Manufacturing & distribution": [
    "https://www.industryweek.com/rss.xml",
    "https://www.supplychaindive.com/feeds/news/",
    "https://www.mhlnews.com/rss.xml",
    "https://www.manufacturing.net/rss",
    "https://news.google.com/rss/search?q=manufacturing+supply+chain&hl=en-US&gl=US&ceid=US:en",
    "https://www.scmr.com/rss",
    "https://www.logisticsmgmt.com/rss",
  ],
  "Hospitality & retail": [
    "https://www.hotel-online.com/feed/",
    "https://www.restaurantbusinessonline.com/rss.xml",
    "https://www.retaildive.com/feeds/news/",
    "https://www.hotelnewsnow.com/Articles/rss.ashx",
    "https://news.google.com/rss/search?q=hospitality+retail&hl=en-US&gl=US&ceid=US:en",
    "https://www.chainstoreage.com/rss",
    "https://www.nrn.com/rss",
  ],
  "Nonprofits & mission-driven orgs": [
    "https://nonprofitquarterly.org/feed/",
    "https://www.chronicleofphilanthropy.com/rss.xml",
    "https://www.insidephilanthropy.com/feed",
    "https://www.nonprofitpro.com/feed/",
    "https://news.google.com/rss/search?q=nonprofit+charity+philanthropy&hl=en-US&gl=US&ceid=US:en",
    "https://philanthropynewsdigest.org/news/rss",
  ],
};

// Configure parser with proper user-agent to avoid 403 errors
const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  timeout: 10000,
  maxRedirects: 5,
});

/**
 * Fetch news from RSS feeds for a specific industry
 * RSS feeds typically return 10-50 recent items, so we fetch from multiple sources
 * Per PRD FR-01: Pull news from NewsAPI + RSS feeds
 */
export async function fetchNewsFromRSS(
  industry: Industry = "Tech, SaaS, B2B software"
): Promise<NewsArticle[]> {
  const feeds = RSS_FEEDS[industry] || RSS_FEEDS["Tech, SaaS, B2B software"];
  const articles: NewsArticle[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90); // 90-day window

  console.log(
    `[News Fetch] Starting RSS fetch for ${industry} from ${feeds.length} feeds`
  );

  // Check if Python newspaper4k service is available (preferred method)
  const usePythonService = await checkPythonService();
  if (usePythonService) {
    console.log(
      `[News Fetch] Using Python newspaper4k service for robust extraction`
    );
    const feedPromises = feeds.slice(0, 10).map(async (feedUrl) => {
      // Limit to 10 feeds to avoid overwhelming the service
      try {
        const extractedArticles = await fetchRSSWithNewspaper4k(feedUrl, 90);
        return extractedArticles.map((article: ExtractedArticle) => ({
          title: article.title,
          description: article.description || article.summary || "",
          url: article.url,
          publishedAt:
            article.publishedAt ||
            article.publish_date ||
            new Date().toISOString(),
          source: article.source || new URL(article.url).hostname,
          content: article.text,
        }));
      } catch (error: any) {
        console.error(
          `[News Fetch] Python service error for ${feedUrl}:`,
          error.message
        );
        return [];
      }
    });

    const results = await Promise.all(feedPromises);
    for (const feedArticles of results) {
      articles.push(...feedArticles);
    }

    console.log(
      `[News Fetch] Python service fetched ${articles.length} articles`
    );
    return articles;
  }

  // Fallback to Node.js RSS parser if Python service not available
  console.log(
    `[News Fetch] Python service not available, using Node.js RSS parser (fallback)`
  );

  // Fetch all feeds in parallel for better performance
  const feedPromises = feeds.map(async (feedUrl) => {
    try {
      const feed = await parser.parseURL(feedUrl);
      const feedArticles: NewsArticle[] = [];
      let articlesInWindow = 0;
      let articlesOutOfWindow = 0;

      if (feed.items) {
        for (const item of feed.items) {
          if (item.title && item.link) {
            const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();

            // Include all articles, but mark date for filtering later
            // RSS feeds often only return 10-50 recent items, so we need to be less strict
            // If date is missing or invalid, include it anyway (better to have it than not)
            const isValidDate =
              pubDate instanceof Date && !isNaN(pubDate.getTime());
            const isInWindow = isValidDate && pubDate >= cutoffDate;

            if (isInWindow || !isValidDate) {
              // Include if in window OR if date is invalid (many feeds don't have proper dates)
              feedArticles.push({
                title: item.title,
                description:
                  item.contentSnippet ||
                  item.content ||
                  (item as any).description ||
                  "",
                url: item.link,
                publishedAt: isValidDate
                  ? pubDate.toISOString()
                  : new Date().toISOString(),
                source: new URL(item.link || "").hostname,
                content: item.content,
              });
              if (isInWindow) articlesInWindow++;
            } else {
              articlesOutOfWindow++;
            }
          }
        }
      }

      if (feedArticles.length > 0) {
        console.log(
          `[News Fetch] ${feedUrl}: ${feedArticles.length} articles (${articlesInWindow} in 90-day window, ${articlesOutOfWindow} older)`
        );
      }

      return feedArticles;
    } catch (error: any) {
      // Log all errors for debugging, but don't fail completely
      const statusCode = error?.statusCode || error?.response?.status;
      if (statusCode === 404 || statusCode === 403) {
        console.log(
          `[News Fetch] ${feedUrl}: ${statusCode} (expected for some feeds)`
        );
      } else {
        console.error(
          `[News Fetch] Failed to fetch ${feedUrl}:`,
          error?.message || error?.code || error
        );
      }
      return [];
    }
  });

  // Wait for all feeds and combine results
  const results = await Promise.all(feedPromises);
  for (const feedArticles of results) {
    articles.push(...feedArticles);
  }

  console.log(`[News Fetch] Total RSS articles fetched: ${articles.length}`);
  return articles;
}

/**
 * Fetch news from NewsAPI
 * Note: Free tier only supports "top-headlines" endpoint, not "everything"
 * "Everything" endpoint requires paid plan. We'll use top-headlines with keywords.
 * Per PRD FR-01: Pull news from NewsAPI + RSS feeds
 */
export async function fetchNewsFromNewsAPI(
  industry: Industry = "Tech, SaaS, B2B software"
): Promise<NewsArticle[]> {
  if (
    !process.env.NEWSAPI_KEY ||
    process.env.NEWSAPI_KEY === "your_newsapi_key_here"
  ) {
    console.warn("[News Fetch] NEWSAPI_KEY not set, skipping NewsAPI fetch");
    return [];
  }

  try {
    // Map industry to NewsAPI category and keywords
    const industryConfig: Record<
      string,
      { category: string; keywords: string[] }
    > = {
      "Tech, SaaS, B2B software": {
        category: "technology",
        keywords: ["tech", "software", "SaaS", "startup", "technology"],
      },
      "Professional services": {
        category: "business",
        keywords: ["business", "consulting", "professional services"],
      },
      "E-commerce & DTC brands": {
        category: "business",
        keywords: ["ecommerce", "retail", "DTC", "direct-to-consumer"],
      },
      "Healthcare & life sciences": {
        category: "health",
        keywords: ["healthcare", "pharma", "biotech", "medical"],
      },
      "Manufacturing & distribution": {
        category: "business",
        keywords: ["manufacturing", "supply chain", "industrial"],
      },
      "Hospitality & retail": {
        category: "business",
        keywords: ["hospitality", "retail", "hotel", "restaurant"],
      },
      "Nonprofits & mission-driven orgs": {
        category: "general",
        keywords: ["nonprofit", "charity", "philanthropy"],
      },
    };

    const config =
      industryConfig[industry] || industryConfig["Professional services"];

    // Use top-headlines (free tier) with multiple keyword queries
    const articles: NewsArticle[] = [];

    // Fetch multiple pages with different keywords to get more coverage
    for (const keyword of config.keywords.slice(0, 3)) {
      // Limit to 3 keywords to stay within rate limits
      try {
        const response = await axios.get(
          "https://newsapi.org/v2/top-headlines",
          {
            params: {
              apiKey: process.env.NEWSAPI_KEY,
              category: config.category,
              q: keyword,
              pageSize: 20, // Free tier limit
              language: "en",
              country: "us",
            },
            timeout: 10000,
          }
        );

        if (response.data.articles) {
          for (const article of response.data.articles) {
            // Only include articles from last 90 days
            const articleDate = new Date(article.publishedAt || new Date());
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);

            if (articleDate >= cutoffDate) {
              articles.push({
                title: article.title || "",
                description: article.description || "",
                url: article.url || "",
                publishedAt: article.publishedAt || new Date().toISOString(),
                source: article.source?.name || "newsapi",
                content: article.content,
              });
            }
          }
        }
      } catch (error: any) {
        // If we hit rate limit or auth error, stop trying more keywords
        if (error.response?.status === 429) {
          console.warn(
            "NewsAPI rate limit reached, skipping remaining keywords"
          );
          break;
        }
        if (error.response?.status === 401) {
          // Only log once per process
          if (!(global as any).__newsapi_key_warned) {
            console.warn(
              "NewsAPI key is invalid or expired. Skipping NewsAPI fetch. Using RSS feeds only."
            );
            (global as any).__newsapi_key_warned = true;
          }
          break; // Stop trying more keywords if auth fails
        }
        // Only log other errors
        if (error.response?.status !== 401) {
          console.error(
            `Error fetching NewsAPI for keyword ${keyword}:`,
            error.message
          );
        }
      }
    }

    return articles;
  } catch (error) {
    console.error("Error fetching from NewsAPI:", error);
    return [];
  }
}

/**
 * Scrape full article content from URL
 * Uses Python newspaper4k service if available, otherwise falls back to Cheerio
 */
async function scrapeArticleContent(url: string): Promise<string> {
  // Try Python newspaper4k service first (more robust)
  const usePythonService = await checkPythonService();
  if (usePythonService) {
    try {
      const { extractArticleWithNewspaper4k } = await import(
        "./news-extractor-service"
      );
      const article = await extractArticleWithNewspaper4k(url);
      if (article && article.text) {
        return article.text.slice(0, 5000);
      }
    } catch (error) {
      console.warn(
        `[News Fetch] Python service failed for ${url}, using fallback`
      );
    }
  }

  // Fallback to Cheerio scraping
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
      timeout: 10000,
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      return "";
    }

    const $ = cheerio.load(response.data);

    // Remove script and style elements
    $("script, style").remove();

    // Try to get main article content
    const selectors = [
      "article",
      '[role="article"]',
      ".article-content",
      ".post-content",
      ".entry-content",
      "main",
      ".content",
    ];

    let content = "";
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length) {
        content = element.text().trim();
        if (content.length > 200) {
          break;
        }
      }
    }

    // Fallback to body if no article content found
    if (!content || content.length < 200) {
      content = $("body").text().trim();
    }

    return content.slice(0, 5000); // Limit to 5000 chars
  } catch (error) {
    // Silently fail - we'll use description if scraping fails
    return "";
  }
}

/**
 * Fetch all industry news (RSS + NewsAPI combined)
 * Per PRD FR-01: Process up to 2,000 articles per run
 */
export async function fetchIndustryNews(
  industry: Industry = "Tech, SaaS, B2B software"
): Promise<NewsArticle[]> {
  console.log(`[News Fetch] Starting fetch for ${industry}...`);

  const [rssArticles, newsApiArticles] = await Promise.all([
    fetchNewsFromRSS(industry),
    fetchNewsFromNewsAPI(industry),
  ]);

  console.log(
    `[News Fetch] RSS: ${rssArticles.length}, NewsAPI: ${newsApiArticles.length}`
  );

  // Combine and deduplicate by URL
  const allArticles = [...rssArticles, ...newsApiArticles];
  const uniqueArticles = deduplicateArticles(allArticles);

  console.log(
    `[News Fetch] After deduplication: ${uniqueArticles.length} unique articles`
  );

  // Scrape full content for articles that only have snippets (limit to first 100 for performance)
  const articlesToScrape = uniqueArticles
    .filter((a) => !a.content || a.content.length < 200)
    .slice(0, 100);
  if (articlesToScrape.length > 0) {
    console.log(
      `[News Fetch] Scraping full content for ${articlesToScrape.length} articles...`
    );
    const scrapePromises = articlesToScrape.map(async (article) => {
      const content = await scrapeArticleContent(article.url);
      if (content) {
        article.content = content;
        article.description = article.description || content.slice(0, 500);
      }
      return article;
    });
    await Promise.all(scrapePromises);
  }

  // Filter to 90-day window AFTER scraping (so we have more content to work with)
  // But be lenient - if date is missing or invalid, include it anyway
  const filtered = uniqueArticles.filter((article) => {
    const articleDate = new Date(article.publishedAt);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    // Include if date is valid and in window, OR if date is invalid (many RSS feeds don't have proper dates)
    const isValidDate =
      articleDate instanceof Date && !isNaN(articleDate.getTime());
    return !isValidDate || articleDate >= cutoffDate;
  });
  console.log(`[News Fetch] After 90-day filter: ${filtered.length} articles`);

  // Limit to 2,000 articles per PRD FR-01
  const limited = filtered.slice(0, 2000);
  console.log(`[News Fetch] Final count: ${limited.length} articles`);

  return limited;
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
export function filterRecentArticles(
  articles: NewsArticle[],
  daysBack: number = 90
): NewsArticle[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return articles.filter((article) => {
    const articleDate = new Date(article.publishedAt);
    return articleDate >= cutoffDate;
  });
}
