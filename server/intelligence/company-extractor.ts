import Fuse from "fuse.js";
import axios from "axios";

export interface ExtractedCompany {
  name: string;
  domain: string | null;
  normalizedName: string;
}

// Common words to exclude from company name extraction
const EXCLUDED_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",
  "this",
  "that",
  "these",
  "those",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "where",
  "when",
  "why",
  "how",
  "all",
  "each",
  "every",
  "some",
  "any",
  "no",
  "not",
  "only",
  "just",
  "more",
  "most",
  "many",
  "much",
  "few",
  "little",
  "new",
  "old",
  "first",
  "last",
  "next",
  "previous",
  "recent",
  "latest",
]);

/**
 * Check if a word/phrase is a valid company name (not a common word)
 */
// Invalid patterns that indicate this is NOT a company name
const INVALID_PATTERNS = [
  /^(after|before|when|while|during|since|until|if|unless|because|although|though)\s+/i, // Sentence starters
  /^(the|a|an)\s+[a-z]+\s+(is|was|are|were|has|have|had|will|would|can|could|should|may|might)\s+/i, // "The X is/was..."
  /\s+(is|was|are|were|has|have|had|will|would|can|could|should|may|might|being|been)\s+/i, // Contains verbs mid-phrase
  /^(my|your|his|her|its|our|their)\s+/i, // Possessive pronouns
  /^(i|you|he|she|it|we|they)\s+/i, // Personal pronouns
  /^[a-z]+\s+(son|daughter|father|mother|brother|sister|parent|child|kid|baby)/i, // Personal relationships
  /^(north|south|east|west)\s+[a-z]+$/i, // Geographic regions (unless it's a known company)
  /^(star|liquid|flying|bad|kindle|postal|amazon|netflix|apple|meta|warner|oracle)\s+(wars|swords|antigravity|robot|scribe|service|rainforest|luna|music|bros|netsuite)/i, // Common false positives
];

// Known valid company names that might match invalid patterns
const VALID_COMPANY_NAMES = new Set([
  "north carolina state university",
  "south carolina",
  "east carolina",
  "west carolina",
]);

function isValidCompanyName(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  const words = normalized.split(/\s+/);

  // Check against known valid companies first
  if (VALID_COMPANY_NAMES.has(normalized)) {
    return true;
  }

  // Single word must not be excluded and be reasonable
  if (words.length === 1) {
    if (EXCLUDED_WORDS.has(normalized)) return false;
    if (normalized.length < 3) return false;
    if (normalized.length > 30) return false; // Too long for a single-word company
    return true;
  }

  // Multi-word: first word shouldn't be excluded
  if (EXCLUDED_WORDS.has(words[0])) {
    return false;
  }

  // Check against invalid patterns
  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(normalized)) {
      return false;
    }
  }

  // Must have at least 2 non-excluded words
  const meaningfulWords = words.filter((w) => !EXCLUDED_WORDS.has(w));
  if (meaningfulWords.length < 2) {
    return false;
  }

  // Reject if it looks like a sentence (contains common sentence structures)
  if (
    normalized.match(
      /\s+(is|was|are|were|has|have|had|will|would|can|could|should|may|might|being|been|to|for|with|from|by)\s+/
    )
  ) {
    // But allow if it's a known company pattern like "X and Y" or "X of Y"
    if (!normalized.match(/\s+(and|of|&|inc|llc|corp|ltd)\s+/i)) {
      return false;
    }
  }

  // Reject if too long (likely a sentence fragment)
  if (normalized.length > 50) {
    return false;
  }

  return true;
}

/**
 * Extract company name from article title/description
 * Per PRD FR-03: Extract company names using NLP or heuristics
 * Improved to filter out common words and use LLM as fallback
 */
export function extractCompanyName(
  title: string,
  description: string = ""
): string | null {
  const text = `${title} ${description}`;

  // Pattern 1: "CompanyName announces/hires/launches/acquires"
  const pattern1 =
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})\s+(?:announces|hires|launches|acquires|appoints|names|introduces|releases|partners|collaborates)/i;
  const match1 = text.match(pattern1);
  if (match1 && isValidCompanyName(match1[1])) {
    return normalizeCompanyName(match1[1]);
  }

  // Pattern 2: "CompanyName, a/an/the..."
  const pattern2 = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4}),\s+(?:a|an|the)/i;
  const match2 = text.match(pattern2);
  if (match2 && isValidCompanyName(match2[1])) {
    return normalizeCompanyName(match2[1]);
  }

  // Pattern 3: "CompanyName has/is/was/will..." - but be more strict
  // Reject if it looks like a sentence (e.g., "Kanye West is now being")
  const pattern3 =
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(?:has|is|was|will|recently|just|now)\s+/i;
  const match3 = text.match(pattern3);
  if (match3) {
    const candidate = match3[1];
    // Reject if followed by common sentence words (indicates it's a sentence, not a company)
    const afterMatch = text
      .substring(
        match3.index! + match3[0].length,
        match3.index! + match3[0].length + 20
      )
      .toLowerCase();
    if (
      afterMatch.match(
        /^(being|doing|going|coming|having|making|taking|getting|seeing|knowing|saying|telling|thinking|feeling|becoming|trying|working|playing|living|dying|buying|selling|building|creating|developing|designing|writing|reading|learning|teaching|studying|researching|analyzing|planning|starting|finishing|ending|beginning|continuing|stopping|moving|changing|improving|growing|expanding|reducing|increasing|decreasing|raising|lowering|opening|closing|breaking|fixing|repairing|replacing|updating|upgrading|downgrading|installing|uninstalling|downloading|uploading|sharing|sending|receiving|giving|taking|putting|setting|getting|finding|losing|winning|beating|missing|hitting|catching|throwing|running|walking|jumping|flying|driving|riding|sitting|standing|lying|sleeping|waking|eating|drinking|cooking|cleaning|washing|drying|wearing|buying|selling|paying|spending|saving|earning|making|breaking|fixing|building|destroying|creating|destroying|killing|saving|helping|hurting|protecting|attacking|defending|fighting|winning|losing|drawing|painting|singing|dancing|playing|watching|listening|hearing|seeing|smelling|tasting|touching|feeling|thinking|knowing|understanding|believing|hoping|wishing|wanting|needing|liking|loving|hating|fearing|worrying|caring|forgetting|remembering|learning|teaching|studying|practicing|training|exercising|competing|winning|losing|drawing|painting|singing|dancing|playing|watching|listening|hearing|seeing|smelling|tasting|touching|feeling|thinking|knowing|understanding|believing|hoping|wishing|wanting|needing|liking|loving|hating|fearing|worrying|caring|forgetting|remembering|learning|teaching|studying|practicing|training|exercising|competing)/
      )
    ) {
      return null; // This is a sentence, not a company name
    }
    if (isValidCompanyName(candidate)) {
      return normalizeCompanyName(candidate);
    }
  }

  // Pattern 4: Extract from quotes or mentions
  const pattern4 = /"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})"/;
  const match4 = text.match(pattern4);
  if (match4 && isValidCompanyName(match4[1])) {
    return normalizeCompanyName(match4[1]);
  }

  // Pattern 5: "at CompanyName" or "from CompanyName"
  const pattern5 = /(?:at|from|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})/i;
  const match5 = text.match(pattern5);
  if (match5 && isValidCompanyName(match5[1])) {
    return normalizeCompanyName(match5[1]);
  }

  // Pattern 6: Look for capitalized phrases that might be company names
  // Must be 2-5 words, all capitalized, not at start (likely mid-sentence mention)
  const pattern6 = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\b/g;
  let match6;
  while ((match6 = pattern6.exec(text)) !== null) {
    const candidate = match6[1];
    if (isValidCompanyName(candidate) && candidate.length > 5) {
      // Check if it's not part of a sentence start
      const beforeMatch = text.substring(
        Math.max(0, match6.index - 20),
        match6.index
      );
      if (!beforeMatch.match(/^[.!?]\s*$/)) {
        return normalizeCompanyName(candidate);
      }
    }
  }

  return null;
}

/**
 * Normalize company name (remove common suffixes, standardize)
 */
export function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/,\s*(Inc|LLC|Ltd|Corp|Corporation|Company|Co)\.?$/i, "")
    .trim();
}

/**
 * Resolve company domain from company name
 * Per PRD FR-03: Resolve domain if possible
 */
export async function resolveCompanyDomain(
  companyName: string
): Promise<string | null> {
  const normalized = normalizeCompanyName(companyName);

  // Try common domain patterns
  const domainPatterns = [
    normalized.toLowerCase().replace(/\s+/g, ""),
    normalized.toLowerCase().replace(/\s+/g, "-"),
    normalized
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, ""),
  ];

  for (const pattern of domainPatterns) {
    const domains = [
      `${pattern}.com`,
      `www.${pattern}.com`,
      `${pattern}.io`,
      `${pattern}.co`,
    ];

    for (const domain of domains) {
      if (await checkDomainExists(domain)) {
        return domain;
      }
    }
  }

  return null;
}

/**
 * Check if a domain exists and is accessible
 */
async function checkDomainExists(domain: string): Promise<boolean> {
  try {
    const response = await axios.head(`https://${domain}`, {
      timeout: 3000,
      validateStatus: (status) => status < 500, // Accept redirects
    });
    return response.status < 400;
  } catch {
    return false;
  }
}

/**
 * Deduplicate companies using fuzzy matching
 * Per PRD FR-03: Deduplicate via fuzzy matching
 */
export function deduplicateCompanies(
  companies: ExtractedCompany[],
  threshold: number = 0.6
): ExtractedCompany[] {
  if (companies.length === 0) return [];

  // Use Fuse.js for fuzzy matching
  const fuse = new Fuse(companies, {
    keys: ["normalizedName", "name"],
    threshold,
    includeScore: true,
  });

  const unique: ExtractedCompany[] = [];
  const processed = new Set<string>();

  for (const company of companies) {
    const key = company.normalizedName.toLowerCase();

    if (processed.has(key)) {
      continue; // Already processed
    }

    // Find similar companies
    const results = fuse.search(company.normalizedName);

    // If we find exact or very similar matches, use the first one
    const similar = results.filter((r) => r.score && r.score < 0.3);

    if (similar.length > 0) {
      // Use the first (best) match
      const bestMatch = similar[0].item;
      if (!processed.has(bestMatch.normalizedName.toLowerCase())) {
        unique.push(bestMatch);
        processed.add(bestMatch.normalizedName.toLowerCase());
      }
    } else {
      // No similar matches, add as new
      unique.push(company);
      processed.add(key);
    }
  }

  return unique;
}

/**
 * Extract company name using LLM as fallback (if API key available)
 */
async function extractCompanyNameWithLLM(
  title: string,
  description: string
): Promise<string | null> {
  const openai = (await import("openai")).default;
  const key = process.env.OPENAI_API_KEY;

  if (!key || key === "your_openai_api_key_here" || !key.startsWith("sk-")) {
    return null;
  }

  try {
    const client = new openai({ apiKey: key });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // Use cheaper model for extraction
      messages: [
        {
          role: "system",
          content:
            "Extract the company name from the article. Return ONLY the company name, nothing else. If no clear company name, return null.",
        },
        {
          role: "user",
          content: `Title: ${title}\nDescription: ${description}\n\nExtract the company name:`,
        },
      ],
      max_tokens: 50,
      temperature: 0,
    });

    const extracted = response.choices[0]?.message?.content?.trim();
    if (
      extracted &&
      extracted !== "null" &&
      extracted.length > 2 &&
      extracted.length < 100
    ) {
      return normalizeCompanyName(extracted);
    }
  } catch (error) {
    // Silently fail, use heuristic extraction
  }

  return null;
}

/**
 * Extract and normalize companies from articles
 * Improved with LLM fallback and better domain extraction
 */
export async function extractCompaniesFromArticles(
  articles: Array<{
    title: string;
    description?: string;
    url: string;
    content?: string;
  }>
): Promise<ExtractedCompany[]> {
  const companies: ExtractedCompany[] = [];

  for (const article of articles) {
    const articleText = `${article.title} ${article.description || ""} ${
      article.content || ""
    }`;

    // Try spaCy NER first (most accurate)
    let companyName: string | null = null;
    try {
      const { extractCompaniesWithNER } = await import(
        "./ner-extractor-service"
      );
      const nerCompanies = await extractCompaniesWithNER(articleText);
      if (nerCompanies.length > 0) {
        // Use the first company found (most likely the main subject)
        companyName = nerCompanies[0].name;
      }
    } catch (error) {
      // spaCy not available, continue with fallbacks
    }

    // If NER didn't find anything, try heuristic extraction
    if (!companyName) {
      companyName = extractCompanyName(
        article.title,
        article.description || ""
      );
    }

    // If heuristic fails, try LLM extraction
    if (!companyName) {
      companyName =
        (await extractCompanyNameWithLLM(
          article.title,
          article.description || ""
        )) || null;
    }

    if (!companyName) {
      continue;
    }

    const normalizedName = normalizeCompanyName(companyName);
    let domain: string | null = null;

    // Try to extract domain from article URL first (most reliable)
    try {
      const url = new URL(article.url);
      domain = url.hostname.replace("www.", "");

      // If domain looks like a news site, try to find company domain in article
      const newsDomains = [
        "techcrunch.com",
        "theverge.com",
        "arstechnica.com",
        "wired.com",
        "statnews.com",
        "healthleadersmedia.com",
        "forbes.com",
        "bloomberg.com",
      ];
      if (newsDomains.some((nd) => domain?.includes(nd))) {
        // This is a news site, domain is not the company domain
        // Try to resolve from company name instead
        domain = await resolveCompanyDomain(companyName);
      }
    } catch {
      // If URL parsing fails, try to resolve from company name
      domain = await resolveCompanyDomain(companyName);
    }

    companies.push({
      name: companyName,
      domain,
      normalizedName,
    });
  }

  // Deduplicate
  return deduplicateCompanies(companies);
}
