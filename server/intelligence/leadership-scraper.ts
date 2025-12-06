import * as cheerio from "cheerio";

export interface LeadershipPerson {
  name: string;
  title: string;
  profileUrl?: string;
  verified: boolean; // true if matches target roles
}

// Target roles per PRD section 5.6
const TARGET_ROLES = [
  "Head of Marketing",
  "Practice Lead",
  "Chief of Staff",
  "CEO",
];

// Common leadership page paths per PRD FR-06
const LEADERSHIP_PATHS = ["/team", "/leadership", "/about", "/people", "/executives", "/management"];

/**
 * Scrapes leadership pages to find executives matching target roles
 * Per PRD FR-06: Scrape /team, /leadership, /about, /people
 */
export async function scrapeLeadership(domain: string): Promise<LeadershipPerson[]> {
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  const leaders: LeadershipPerson[] = [];

  // Try each common leadership page path
  for (const path of LEADERSHIP_PATHS) {
    try {
      const url = `${baseUrl}${path}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      if (!response.ok) {
        continue; // Try next path
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Common patterns for leadership pages
      const people = extractPeopleFromPage($, baseUrl);
      leaders.push(...people);

      // If we found people on this page, we can stop (or continue to find more)
      if (people.length > 0) {
        // Continue to check other pages for completeness
      }
    } catch (error) {
      // Silently continue to next path
      continue;
    }
  }

  // Deduplicate by name + title combination
  const uniqueLeaders = deduplicateLeaders(leaders);

  // Mark verified if title matches target roles
  return uniqueLeaders.map(leader => ({
    ...leader,
    verified: matchesTargetRole(leader.title),
  }));
}

/**
 * Extract people from a parsed HTML page
 * Looks for common patterns in leadership/team pages
 */
function extractPeopleFromPage($: cheerio.CheerioAPI, baseUrl: string): LeadershipPerson[] {
  const people: LeadershipPerson[] = [];

  // Pattern 1: Cards with name and title
  $('[class*="team"], [class*="leadership"], [class*="person"], [class*="member"]').each((_, el) => {
    const $el = $(el);
    const name = $el.find('h1, h2, h3, [class*="name"]').first().text().trim();
    const title = $el.find('[class*="title"], [class*="role"], [class*="position"]').first().text().trim();
    const link = $el.find('a').first().attr("href");

    if (name && title) {
      people.push({
        name,
        title,
        profileUrl: link ? (link.startsWith("http") ? link : `${baseUrl}${link}`) : undefined,
        verified: false, // Will be set later
      });
    }
  });

  // Pattern 2: Structured data or semantic HTML
  $("article, section").each((_, el) => {
    const $el = $(el);
    const name = $el.find("h1, h2, h3").first().text().trim();
    const title = $el.find("p, span").filter((_, p) => {
      const text = $(p).text().toLowerCase();
      return text.includes("chief") || text.includes("head") || text.includes("director") || text.includes("vp") || text.includes("president");
    }).first().text().trim();

    if (name && title) {
      const link = $el.find("a").first().attr("href");
      people.push({
        name,
        title,
        profileUrl: link ? (link.startsWith("http") ? link : `${baseUrl}${link}`) : undefined,
        verified: false,
      });
    }
  });

  // Pattern 3: Table-based layouts
  $("table tr").each((_, row) => {
    const $row = $(row);
    const cells = $row.find("td");
    if (cells.length >= 2) {
      const name = $(cells[0]).text().trim();
      const title = $(cells[1]).text().trim();
      if (name && title) {
        people.push({
          name,
          title,
          verified: false,
        });
      }
    }
  });

  return people;
}

/**
 * Check if a title matches any target role using fuzzy matching
 * Per PRD: Match target roles (Head of Marketing, Practice Lead, Chief of Staff, CEO)
 */
function matchesTargetRole(title: string): boolean {
  const titleLower = title.toLowerCase();

  // Exact matches
  for (const targetRole of TARGET_ROLES) {
    if (titleLower.includes(targetRole.toLowerCase())) {
      return true;
    }
  }

  // Fuzzy matches for common variations
  const rolePatterns: Record<string, string[]> = {
    "Head of Marketing": ["head of marketing", "marketing head", "vp marketing", "cmo", "chief marketing"],
    "Practice Lead": ["practice lead", "practice leader", "practice head"],
    "Chief of Staff": ["chief of staff", "coo", "chief operating"],
    "CEO": ["ceo", "chief executive", "president", "founder"],
  };

  for (const [role, patterns] of Object.entries(rolePatterns)) {
    for (const pattern of patterns) {
      if (titleLower.includes(pattern)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Deduplicate leaders by name + title
 */
function deduplicateLeaders(leaders: LeadershipPerson[]): LeadershipPerson[] {
  const seen = new Set<string>();
  const unique: LeadershipPerson[] = [];

  for (const leader of leaders) {
    const key = `${leader.name.toLowerCase()}-${leader.title.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(leader);
    }
  }

  return unique;
}

