import * as cheerio from "cheerio";
import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Check if OpenAI API key is valid (not placeholder)
function isValidApiKey(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return (
    !!key &&
    key !== "your_openai_api_key_here" &&
    key.length > 20 &&
    key.startsWith("sk-")
  );
}

export interface HomepageAnalysis {
  title: string;
  metaDescription: string;
  headings: string[];
  keywords: string[];
  summary: string; // LLM-generated semantic summary
}

/**
 * Analyzes a company homepage and extracts key information
 * Per PRD FR-05: Extract title, meta description, H1/H2, service keywords
 */
export async function analyzeHomepage(
  domain: string
): Promise<HomepageAnalysis | null> {
  try {
    // Try to fetch the homepage
    const url = domain.startsWith("http") ? domain : `https://${domain}`;

    // Use axios with relaxed SSL verification for problematic certificates
    // This is a common workaround for self-signed or misconfigured certificates
    const axios = (await import("axios")).default;
    const https = await import("https");

    let response: any;
    try {
      const axiosResponse = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false, // Allow self-signed certificates
        }),
        timeout: 10000,
        validateStatus: () => true, // Accept any status
      });

      // Convert axios response to fetch-like response for compatibility
      response = {
        ok: axiosResponse.status < 400,
        status: axiosResponse.status,
        text: async () => axiosResponse.data,
        headers: axiosResponse.headers,
      };
    } catch (error: any) {
      // If axios fails, log and return null
      if (
        error.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
        error.message?.includes("certificate")
      ) {
        console.error(
          `Error analyzing homepage for ${domain}: SSL certificate verification failed`
        );
      } else {
        console.error(
          `Error analyzing homepage for ${domain}:`,
          error.message || error
        );
      }
      return null;
    }

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html =
      typeof response.text === "function"
        ? await response.text()
        : response.text;
    const $ = cheerio.load(html);

    // Extract basic elements
    const title = $("title").first().text().trim() || "";
    const metaDescription = $('meta[name="description"]').attr("content") || "";

    // Extract H1 and H2 headings
    const headings: string[] = [];
    $("h1").each((_, el) => {
      const text = $(el).text().trim();
      if (text) headings.push(text);
    });
    $("h2").each((_, el) => {
      const text = $(el).text().trim();
      if (text) headings.push(text);
    });

    // Extract service keywords from common sections
    const keywords: string[] = [];
    const keywordSelectors = [
      'meta[name="keywords"]',
      '[class*="service"]',
      '[class*="product"]',
      '[class*="solution"]',
    ];

    $('meta[name="keywords"]').each((_, el) => {
      const content = $(el).attr("content");
      if (content) {
        keywords.push(...content.split(",").map((k) => k.trim()));
      }
    });

    // Generate semantic summary using LLM (PRD Appendix C.7)
    const summary = await generateHomepageSummary(
      title,
      metaDescription,
      headings.join(" "),
      keywords.join(" ")
    );

    return {
      title,
      metaDescription,
      headings: headings.slice(0, 10), // Limit to first 10 headings
      keywords: keywords.slice(0, 20), // Limit to first 20 keywords
      summary,
    };
  } catch (error) {
    console.error(`Error analyzing homepage for ${domain}:`, error);
    return null;
  }
}

/**
 * Generate semantic summary using LLM
 * Per PRD Appendix C.7 Summary Prompt
 */
async function generateHomepageSummary(
  title: string,
  metaDescription: string,
  headings: string,
  keywords: string
): Promise<string> {
  // Skip LLM if API key is invalid
  if (!isValidApiKey()) {
    return `${title}. ${metaDescription}`;
  }

  try {
    const content = `Title: ${title}
Meta Description: ${metaDescription}
Headings: ${headings}
Keywords: ${keywords}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert analyst specializing in B2B companies, professional services, 
and fractional executive work. Your job is to:
1. Classify corporate news events.
2. Identify marketing, BD, and organizational issues implied by the event.
3. Determine which internal roles are most affected.
4. Generate human, concise, relevant cold-email conversation starters.
5. Produce strictly formatted JSON as instructed.

Do not invent facts not supported by the input.
Do not produce explanations outside of the JSON schema requested.`,
        },
        {
          role: "user",
          content: `Analyze this company homepage and provide a 1-3 sentence summary describing:
- What the company does
- Their primary services/products
- Their positioning

${content}

Return a single string summary.`,
        },
      ],
    });

    return response.choices[0].message.content?.trim() || "";
  } catch (error: any) {
    // Only log authentication errors once
    if (error?.code === "invalid_api_key" || error?.status === 401) {
      if (!(global as any).__openai_key_warned) {
        console.warn("OpenAI API key is invalid. LLM features disabled.");
        (global as any).__openai_key_warned = true;
      }
    } else {
      console.error(
        "Error generating homepage summary:",
        error?.message || error
      );
    }
    return `${title}. ${metaDescription}`;
  }
}
