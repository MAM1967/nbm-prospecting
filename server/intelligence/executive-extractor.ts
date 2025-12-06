/**
 * Extract executive names and titles from news articles
 * Uses NER (Named Entity Recognition) patterns and LLM fallback
 */

import OpenAI from "openai";
import * as cheerio from "cheerio";

export interface ExtractedExecutive {
  name: string;
  title: string;
  company?: string;
  confidence: number;
}

/**
 * Extract executives from article content using pattern matching
 */
export function extractExecutivesFromText(
  title: string,
  description: string,
  content?: string
): ExtractedExecutive[] {
  // Combine all text, prioritizing content if available
  const text = content && content.length > 100 
    ? `${title} ${description} ${content}` 
    : `${title} ${description} ${content || ""}`;
  const executives: ExtractedExecutive[] = [];
  
  // If text is too short, return empty (need at least 50 chars for meaningful extraction)
  if (text.length < 50) {
    return [];
  }

  // Helper to validate if a name looks like a real person name
  function isValidPersonName(name: string): boolean {
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 50) return false;
    
    // Must be 1-4 words, all starting with capital letters
    const words = trimmed.split(/\s+/);
    if (words.length < 1 || words.length > 4) return false;
    
    // Each word should start with capital and be 2+ chars
    for (const word of words) {
      if (word.length < 2) return false;
      if (!/^[A-Z][a-z]+$/.test(word)) return false;
      // Reject common non-name words
      if (['The', 'A', 'An', 'And', 'Or', 'But', 'For', 'With', 'From', 'To', 'Of', 'In', 'On', 'At', 'By'].includes(word)) return false;
    }
    
    // Reject if contains HTML/newlines/formatting
    if (trimmed.includes('\n') || trimmed.includes('#') || trimmed.includes('{') || trimmed.includes('}')) return false;
    
    // Reject if looks like a sentence fragment
    if (trimmed.toLowerCase().match(/^(who|what|where|when|why|how|which|that|this|these|those)\s+/)) return false;
    if (trimmed.toLowerCase().match(/\s+(is|was|are|were|has|have|had|will|would|can|could|should|may|might|being|been|to|for|with|from|by|put|called|said|told|shared|wakes|wore|arrive|arrived)\s+/)) return false;
    
    return true;
  }

  // Pattern 1: "John Smith, CEO of Company X" or "John Smith, CEO"
  const pattern1 = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+),\s*(CEO|CTO|CFO|CMO|COO|President|VP|Vice President|Head of|Director of|Chief\s+\w+|Managing Director|Executive Director|Founder|Co-founder)/gi;
  let match1;
  while ((match1 = pattern1.exec(text)) !== null) {
    const name = match1[1].trim();
    if (isValidPersonName(name)) {
      executives.push({
        name,
        title: match1[2].trim(),
        confidence: 0.8,
      });
    }
  }

  // Pattern 2: "Company X CEO John Smith" or "CEO John Smith"
  const pattern2 = /(?:([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+)?(CEO|CTO|CFO|CMO|COO|President|VP|Vice President|Head of|Director of|Chief\s+\w+|Managing Director|Executive Director|Founder|Co-founder)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi;
  let match2;
  while ((match2 = pattern2.exec(text)) !== null) {
    const name = match2[3]?.trim() || "";
    if (name && isValidPersonName(name)) {
      executives.push({
        name,
        title: match2[2].trim(),
        company: match2[1]?.trim(),
        confidence: 0.7,
      });
    }
  }

  // Pattern 3: "John Smith, who serves as CEO" or "John Smith is CEO"
  const pattern3 = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+),?\s+(?:who\s+)?(?:serves\s+as|is|was|named|appointed|hired as)\s+(?:the\s+)?(CEO|CTO|CFO|CMO|COO|President|VP|Vice President|Head of|Director of|Chief\s+\w+|Managing Director|Executive Director|Founder|Co-founder)/gi;
  let match3;
  while ((match3 = pattern3.exec(text)) !== null) {
    const name = match3[1].trim();
    if (isValidPersonName(name)) {
      executives.push({
        name,
        title: match3[2].trim(),
        confidence: 0.75,
      });
    }
  }

  // Pattern 4: "CEO John Smith announced" or "John Smith, CEO, said"
  const pattern4 = /(?:([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+),?\s+)?(CEO|CTO|CFO|CMO|COO|President|VP|Vice President|Head of|Director of|Chief\s+\w+|Managing Director|Executive Director|Founder|Co-founder)(?:,?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+))?\s+(?:announced|said|stated|commented|told|explained|added|noted)/gi;
  let match4;
  while ((match4 = pattern4.exec(text)) !== null) {
    // Pattern 4 can match in two ways: "CEO John Smith" or "John Smith, CEO"
    const name = match4[1] || match4[3] || "";
    const title = match4[2] || "";
    if (name && title && isValidPersonName(name)) {
      executives.push({
        name: name.trim(),
        title: title.trim(),
        confidence: 0.7,
      });
    }
  }

  // Deduplicate by name
  const seen = new Set<string>();
  const unique: ExtractedExecutive[] = [];
  for (const exec of executives) {
    const key = `${exec.name.toLowerCase()}-${exec.title.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(exec);
    }
  }

  return unique;
}

/**
 * Extract executives using LLM (more accurate but slower)
 */
export async function extractExecutivesWithLLM(
  title: string,
  description: string,
  content?: string
): Promise<ExtractedExecutive[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your_openai_api_key_here" || !apiKey.startsWith("sk-")) {
    return [];
  }

  try {
    const openai = new OpenAI({ apiKey });
    const text = content || description || title;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract executive names and titles from the article. Return JSON array of executives with name, title, and company (if mentioned). Only return executives with titles like CEO, CTO, CFO, CMO, COO, President, VP, Head of, Director, Chief.`,
        },
        {
          role: "user",
          content: `Article Title: ${title}\nDescription: ${description}\nContent: ${text.slice(0, 2000)}\n\nExtract executives:`,
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    const executives = result.executives || result;

    if (!Array.isArray(executives)) {
      return [];
    }

    return executives.map((e: any) => ({
      name: e.name || "",
      title: e.title || "",
      company: e.company,
      confidence: 0.9,
    })).filter((e: ExtractedExecutive) => e.name && e.title);
  } catch (error) {
    console.error("LLM executive extraction failed:", error);
    return [];
  }
}

/**
 * Extract executives from article (uses spaCy NER first, then pattern matching, then LLM)
 */
export async function extractExecutivesFromArticle(
  title: string,
  description: string,
  content?: string
): Promise<ExtractedExecutive[]> {
  const text = content || description || title;
  const fullText = `${title} ${description} ${content || ""}`;
  
  // Try spaCy NER first (most accurate)
  try {
    const { extractExecutivesWithNER } = await import("./ner-extractor-service");
    const nerExecutives = await extractExecutivesWithNER(fullText);
    if (nerExecutives.length > 0) {
      return nerExecutives;
    }
  } catch (error) {
    // spaCy not available, continue with fallbacks
  }
  
  // Fallback to pattern matching (fast)
  const patternMatches = extractExecutivesFromText(title, description, content);
  if (patternMatches.length > 0) {
    return patternMatches;
  }

  // Last resort: try LLM (slower but more accurate)
  const llmMatches = await extractExecutivesWithLLM(title, description, content);
  return llmMatches;
}

