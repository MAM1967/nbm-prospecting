import * as cheerio from "cheerio";
import axios from "axios";

export interface LeadershipPerson {
  name: string;
  title: string;
  profileUrl?: string;
  verified: boolean; // true if matches target roles
  source?: "theorg" | "scraped" | "article"; // Track source for API usage
}

// Target roles per PRD section 5.6
const TARGET_ROLES = [
  "Head of Marketing",
  "Practice Lead",
  "Chief of Staff",
  "CEO",
];

// Common leadership page paths per PRD FR-06
const LEADERSHIP_PATHS = [
  "/team",
  "/leadership",
  "/about",
  "/people",
  "/executives",
  "/management",
];

/**
 * Fetch executives from The Org API
 * Per PRD: Use The Org API to find verified executives
 * Limited to 10 API credits, so use sparingly
 */
async function fetchFromTheOrg(domain: string): Promise<LeadershipPerson[]> {
  const apiKey = process.env.THE_ORG_API_KEY;
  if (!apiKey || apiKey === "your_the_org_api_key_here") {
    return [];
  }

  // Track API usage to avoid exceeding 10 credits
  if (!(global as any).__theorg_api_usage) {
    (global as any).__theorg_api_usage = { count: 0, lastReset: Date.now() };
  }
  const apiUsage = (global as any).__theorg_api_usage;

  if (apiUsage.count >= 10) {
    console.warn("The Org API: 10 credit limit reached, skipping API calls");
    return [];
  }

  try {
    // The Org API - try multiple endpoint formats
    let orgId: string | null = null;
    const cleanDomain = domain.replace("www.", "").replace(/^https?:\/\//, "");

    // Try format 1: Search by domain (v1)
    try {
      const searchResponse = await axios.get(
        "https://api.theorg.com/v1/organizations",
        {
          params: {
            domain: cleanDomain,
          },
          headers: {
            "X-API-Key": apiKey,
            Accept: "application/json",
          },
          timeout: 10000,
        }
      );

      if (searchResponse.data?.organizations?.[0]?.id) {
        orgId = searchResponse.data.organizations[0].id;
        apiUsage.count++;
        console.log(
          `[The Org API] Found org ID ${orgId} for ${cleanDomain} (format 1)`
        );
      } else if (searchResponse.data?.id) {
        orgId = searchResponse.data.id;
        apiUsage.count++;
        console.log(
          `[The Org API] Found org ID ${orgId} for ${cleanDomain} (format 1, direct)`
        );
      } else if (
        Array.isArray(searchResponse.data) &&
        searchResponse.data[0]?.id
      ) {
        orgId = searchResponse.data[0].id;
        apiUsage.count++;
        console.log(
          `[The Org API] Found org ID ${orgId} for ${cleanDomain} (format 1, array)`
        );
      }
    } catch (searchError: any) {
      // Try alternative format if first fails
      if (
        searchError.response?.status === 404 ||
        searchError.response?.status === 401
      ) {
        console.log(
          `[The Org API] Format 1 failed for ${cleanDomain} (status: ${searchError.response?.status}), trying alternatives...`
        );
      }
    }

    // Try format 2: Search by domain (v2) if format 1 failed
    if (!orgId) {
      try {
        const searchResponse2 = await axios.get(
          "https://api.theorg.com/v2/organizations",
          {
            params: {
              domain: cleanDomain,
            },
            headers: {
              "X-API-Key": apiKey,
              Accept: "application/json",
            },
            timeout: 10000,
          }
        );

        if (searchResponse2.data?.organizations?.[0]?.id) {
          orgId = searchResponse2.data.organizations[0].id;
          apiUsage.count++;
          console.log(
            `[The Org API] Found org ID ${orgId} for ${cleanDomain} (format 2)`
          );
        } else if (searchResponse2.data?.id) {
          orgId = searchResponse2.data.id;
          apiUsage.count++;
          console.log(
            `[The Org API] Found org ID ${orgId} for ${cleanDomain} (format 2, direct)`
          );
        }
      } catch (searchError2: any) {
        // Try format 3: Direct lookup by domain
        if (
          searchError2.response?.status === 404 ||
          searchError2.response?.status === 401
        ) {
          console.log(
            `[The Org API] Format 2 failed for ${cleanDomain}, trying direct lookup...`
          );
        }
      }
    }

    // Try format 3: Direct lookup by domain as path
    if (!orgId) {
      try {
        const directResponse = await axios.get(
          `https://api.theorg.com/v1/organizations/${cleanDomain}`,
          {
            headers: {
              "X-API-Key": apiKey,
              Accept: "application/json",
            },
            timeout: 10000,
          }
        );

        if (directResponse.data?.id) {
          orgId = directResponse.data.id;
          apiUsage.count++;
          console.log(
            `[The Org API] Found org ID ${orgId} for ${cleanDomain} (format 3, direct path)`
          );
        }
      } catch (directError: any) {
        // All formats failed
        if (
          directError.response?.status === 404 ||
          directError.response?.status === 401
        ) {
          console.log(
            `[The Org API] All formats failed for ${cleanDomain}, organization not found`
          );
        }
      }
    }

    if (!orgId) {
      return [];
    }

    // Fetch people from the organization - try multiple endpoint formats
    let peopleData: any = null;

    // Try v1 endpoint
    try {
      const peopleResponse = await axios.get(
        `https://api.theorg.com/v1/organizations/${orgId}/people`,
        {
          headers: {
            "X-API-Key": apiKey,
            Accept: "application/json",
          },
          timeout: 10000,
        }
      );
      peopleData = peopleResponse.data;
      apiUsage.count++;
    } catch (v1Error: any) {
      // Try v2 endpoint if v1 fails
      if (v1Error.response?.status === 404) {
        try {
          const peopleResponse2 = await axios.get(
            `https://api.theorg.com/v2/organizations/${orgId}/people`,
            {
              headers: {
                "X-API-Key": apiKey,
                Accept: "application/json",
              },
              timeout: 10000,
            }
          );
          peopleData = peopleResponse2.data;
          apiUsage.count++;
        } catch (v2Error: any) {
          console.log(
            `[The Org API] Could not fetch people for org ${orgId} (both v1 and v2 failed)`
          );
          return [];
        }
      } else {
        console.log(
          `[The Org API] Error fetching people for org ${orgId}:`,
          v1Error.response?.status || v1Error.message
        );
        return [];
      }
    }

    (global as any).__theorg_api_usage = apiUsage;

    // Handle different response formats
    const people = peopleData?.people || peopleData?.data || peopleData || [];
    if (!Array.isArray(people) || people.length === 0) {
      return [];
    }

    const leaders: LeadershipPerson[] = [];
    for (const person of people) {
      if (person.name && person.title) {
        const matchesRole = matchesTargetRole(person.title);

        leaders.push({
          name: person.name,
          title: person.title,
          profileUrl:
            person.profileUrl ||
            person.linkedinUrl ||
            person.profile_url ||
            person.linkedin_url,
          verified: matchesRole,
          source: "theorg",
        });
      }
    }

    // Filter to verified leads only, limit to 2 per PRD
    const verified = leaders.filter((l) => l.verified).slice(0, 2);

    if (verified.length > 0) {
      console.log(
        `The Org API: Found ${verified.length} verified leads for ${domain} (API usage: ${apiUsage.count}/10)`
      );
    }

    return verified;
  } catch (error: any) {
    // Only log if it's not a 404 (company not found) or 401 (auth issue)
    if (error.response?.status !== 404 && error.response?.status !== 401) {
      console.error(
        `The Org API error for ${domain}:`,
        error.response?.status || error.message || error
      );
    }
    return [];
  }
}

/**
 * Scrapes leadership pages to find executives matching target roles
 * Per PRD FR-06: Scrape /team, /leadership, /about, /people
 * Also uses The Org API as primary source if available
 */
export async function scrapeLeadership(
  domain: string
): Promise<LeadershipPerson[]> {
  // Try The Org API first (more reliable, but limited credits)
  const theOrgLeaders = await fetchFromTheOrg(domain);
  if (theOrgLeaders.length >= 2) {
    // If we got 2 verified leads from The Org, return them (per PRD: max 2)
    console.log(
      `Found ${theOrgLeaders.length} verified leads from The Org for ${domain}`
    );
    return theOrgLeaders.slice(0, 2);
  }

  // Fallback to scraping if The Org didn't return enough
  // Skip scraping for news.google.com and other news aggregators (they don't have company leadership pages)
  if (domain.includes("news.google.com") || domain.includes("google.com")) {
    console.log(
      `[Leadership] Skipping scraping for news aggregator: ${domain}`
    );
    return theOrgLeaders;
  }

  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  const leaders: LeadershipPerson[] = [];

  // Use axios with SSL handling (same as homepage analyzer)
  const axios = (await import("axios")).default;
  const https = await import("https");

  // Try each common leadership page path
  for (const path of LEADERSHIP_PATHS) {
    try {
      const url = `${baseUrl}${path}`;

      let html: string;
      try {
        const response = await axios.get(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: false, // Handle SSL issues
          }),
          timeout: 10000,
          validateStatus: () => true, // Accept any status
        });

        if (response.status >= 400) {
          continue; // Try next path
        }

        html = response.data;
      } catch (error) {
        continue; // Try next path
      }

      const $ = cheerio.load(html);

      // Common patterns for leadership pages
      const people = extractPeopleFromPage($, baseUrl);
      // Filter out garbage data (HTML elements, CSS, etc.)
      const validPeople = people.filter((p) => {
        // Filter out obvious garbage
        if (
          p.name.includes("#") ||
          p.name.includes("{") ||
          p.name.includes("}")
        )
          return false;
        if (
          p.title.includes("#") ||
          p.title.includes("{") ||
          p.title.includes("}")
        )
          return false;
        if (p.name.length < 2 || p.title.length < 2) return false;
        if (p.name.length > 100 || p.title.length > 100) return false; // Too long, probably HTML
        if (
          p.name.toLowerCase().includes("your") &&
          p.name.toLowerCase().includes("briefing")
        )
          return false;
        return true;
      });
      leaders.push(...validPeople);

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
  return uniqueLeaders.map((leader) => ({
    ...leader,
    verified: matchesTargetRole(leader.title),
  }));
}

/**
 * Extract people from a parsed HTML page
 * Looks for common patterns in leadership/team pages
 */
function extractPeopleFromPage(
  $: cheerio.CheerioAPI,
  baseUrl: string
): LeadershipPerson[] {
  const people: LeadershipPerson[] = [];

  // Pattern 1: Cards with name and title (expanded selectors)
  $(
    '[class*="team"], [class*="leadership"], [class*="person"], [class*="member"], [class*="executive"], [class*="staff"], [class*="employee"]'
  ).each((_, el) => {
    const $el = $(el);
    const name = $el
      .find('h1, h2, h3, h4, [class*="name"], [data-name], .name')
      .first()
      .text()
      .trim();
    const title = $el
      .find(
        '[class*="title"], [class*="role"], [class*="position"], [class*="job"], [data-title], .title, .role'
      )
      .first()
      .text()
      .trim();
    const link = $el.find("a").first().attr("href");

    if (name && title && name.length > 2 && title.length > 2) {
      // Filter out common non-person text
      if (!name.match(/^(team|leadership|about|contact|home)$/i)) {
        people.push({
          name,
          title,
          profileUrl: link
            ? link.startsWith("http")
              ? link
              : `${baseUrl}${link}`
            : undefined,
          verified: false, // Will be set later
        });
      }
    }
  });

  // Pattern 2: Structured data or semantic HTML (improved)
  $("article, section, div[class*='bio'], div[class*='profile']").each(
    (_, el) => {
      const $el = $(el);
      const name = $el.find("h1, h2, h3, h4, strong, b").first().text().trim();
      const title = $el
        .find("p, span, div")
        .filter((_, p) => {
          const text = $(p).text().toLowerCase();
          return (
            text.includes("chief") ||
            text.includes("head") ||
            text.includes("director") ||
            text.includes("vp") ||
            text.includes("president") ||
            text.includes("ceo") ||
            text.includes("cmo") ||
            text.includes("cfo") ||
            text.includes("coo") ||
            text.includes("marketing") ||
            text.includes("practice") ||
            text.includes("lead")
          );
        })
        .first()
        .text()
        .trim();

      if (name && title && name.length > 2 && title.length > 2) {
        if (!name.match(/^(team|leadership|about|contact|home)$/i)) {
          const link = $el.find("a").first().attr("href");
          people.push({
            name,
            title,
            profileUrl: link
              ? link.startsWith("http")
                ? link
                : `${baseUrl}${link}`
              : undefined,
            verified: false,
          });
        }
      }
    }
  );

  // Pattern 3: Table-based layouts
  $("table tr").each((_, row) => {
    const $row = $(row);
    const cells = $row.find("td, th");
    if (cells.length >= 2) {
      const name = $(cells[0]).text().trim();
      const title = $(cells[1]).text().trim();
      if (name && title && name.length > 2 && title.length > 2) {
        if (!name.match(/^(name|title|position|role|team|leadership)$/i)) {
          people.push({
            name,
            title,
            verified: false,
          });
        }
      }
    }
  });

  // Pattern 4: Look for LinkedIn-style profiles or structured data
  $('[itemtype*="Person"], [itemtype*="OrganizationRole"]').each((_, el) => {
    const $el = $(el);
    const name = $el
      .find('[itemprop="name"], .name, h2, h3')
      .first()
      .text()
      .trim();
    const title = $el
      .find('[itemprop="jobTitle"], .title, .position')
      .first()
      .text()
      .trim();
    if (name && title && name.length > 2 && title.length > 2) {
      people.push({
        name,
        title,
        verified: false,
      });
    }
  });

  // Pattern 5: Look for divs with data attributes
  $("[data-name], [data-title]").each((_, el) => {
    const $el = $(el);
    const name =
      $el.attr("data-name") ||
      $el.find("[data-name]").first().attr("data-name") ||
      $el.find("h1, h2, h3").first().text().trim();
    const title =
      $el.attr("data-title") ||
      $el.find("[data-title]").first().attr("data-title") ||
      $el.find("p, span").first().text().trim();
    if (name && title && name.length > 2 && title.length > 2) {
      if (!name.match(/^(team|leadership|about|contact|home)$/i)) {
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
    "Head of Marketing": [
      "head of marketing",
      "marketing head",
      "vp marketing",
      "cmo",
      "chief marketing",
    ],
    "Practice Lead": ["practice lead", "practice leader", "practice head"],
    "Chief of Staff": ["chief of staff", "coo", "chief operating"],
    CEO: ["ceo", "chief executive", "president", "founder"],
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
