import Fuse from "fuse.js";
import axios from "axios";

export interface ExtractedCompany {
  name: string;
  domain: string | null;
  normalizedName: string;
}

/**
 * Extract company name from article title/description
 * Per PRD FR-03: Extract company names using NLP or heuristics
 */
export function extractCompanyName(title: string, description: string = ""): string | null {
  const text = `${title} ${description}`;

  // Pattern 1: "CompanyName announces/hires/launches"
  const pattern1 = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:announces|hires|launches|acquires|appoints|names|introduces)/i;
  const match1 = text.match(pattern1);
  if (match1) {
    return normalizeCompanyName(match1[1]);
  }

  // Pattern 2: "CompanyName, a..."
  const pattern2 = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+(?:a|an|the)/i;
  const match2 = text.match(pattern2);
  if (match2) {
    return normalizeCompanyName(match2[1]);
  }

  // Pattern 3: First capitalized words before common verbs
  const pattern3 = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:has|is|was|will|recently)/i;
  const match3 = text.match(pattern3);
  if (match3) {
    return normalizeCompanyName(match3[1]);
  }

  // Pattern 4: Extract from quotes or mentions
  const pattern4 = /"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)"/;
  const match4 = text.match(pattern4);
  if (match4) {
    return normalizeCompanyName(match4[1]);
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
export async function resolveCompanyDomain(companyName: string): Promise<string | null> {
  const normalized = normalizeCompanyName(companyName);
  
  // Try common domain patterns
  const domainPatterns = [
    normalized.toLowerCase().replace(/\s+/g, ""),
    normalized.toLowerCase().replace(/\s+/g, "-"),
    normalized.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, ""),
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
    const similar = results.filter(r => r.score && r.score < 0.3);
    
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
 * Extract and normalize companies from articles
 */
export async function extractCompaniesFromArticles(
  articles: Array<{ title: string; description?: string; url: string }>
): Promise<ExtractedCompany[]> {
  const companies: ExtractedCompany[] = [];

  for (const article of articles) {
    const companyName = extractCompanyName(article.title, article.description || "");
    
    if (!companyName) {
      continue;
    }

    const normalizedName = normalizeCompanyName(companyName);
    let domain: string | null = null;

    // Try to extract domain from article URL first
    try {
      const url = new URL(article.url);
      domain = url.hostname.replace("www.", "");
    } catch {
      // If that fails, try to resolve from company name
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

