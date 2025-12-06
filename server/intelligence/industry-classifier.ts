import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Industry types per PRD section 2.1
export type Industry =
  | "Tech, SaaS, B2B software"
  | "Professional services"
  | "E-commerce & DTC brands"
  | "Healthcare & life sciences"
  | "Manufacturing & distribution"
  | "Hospitality & retail"
  | "Nonprofits & mission-driven orgs";

/**
 * Classify a company into one of the 7 supported industries
 * Per PRD FR-04 and Appendix C.3
 */
export async function classifyIndustry(
  companyName: string,
  homepageSummary: string
): Promise<Industry> {
  // First try LLM classification
  const llmResult = await classifyIndustryWithLLM(companyName, homepageSummary);
  if (llmResult) {
    return llmResult;
  }

  // Fallback to keyword heuristics
  return classifyIndustryWithHeuristics(companyName, homepageSummary);
}

/**
 * LLM-based industry classification
 * Per PRD Appendix C.3 Industry Classification Prompt
 */
async function classifyIndustryWithLLM(
  companyName: string,
  homepageSummary: string
): Promise<Industry | null> {
  try {
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
          content: `INPUT:
Company Name: ${companyName}
Homepage Summary: ${homepageSummary}

TASK:
Determine which industry the company belongs to. Choose ONE from:

1. Tech / SaaS / B2B Software
2. Professional Services (default)
3. E-commerce / DTC Brands
4. Healthcare & Life Sciences
5. Manufacturing & Distribution
6. Hospitality / Retail
7. Nonprofit / Mission-driven Orgs

Return:
{
  "industry": "..."
}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const industry = result.industry;

    // Map to our exact type
    const industryMap: Record<string, Industry> = {
      "Tech / SaaS / B2B Software": "Tech, SaaS, B2B software",
      "Professional Services": "Professional services",
      "E-commerce / DTC Brands": "E-commerce & DTC brands",
      "Healthcare & Life Sciences": "Healthcare & life sciences",
      "Manufacturing & Distribution": "Manufacturing & distribution",
      "Hospitality / Retail": "Hospitality & retail",
      "Nonprofit / Mission-driven Orgs": "Nonprofits & mission-driven orgs",
    };

    return industryMap[industry] || null;
  } catch (error) {
    console.error("Error classifying industry with LLM:", error);
    return null;
  }
}

/**
 * Fallback keyword-based classification
 */
function classifyIndustryWithHeuristics(
  companyName: string,
  homepageSummary: string
): Industry {
  const text = `${companyName} ${homepageSummary}`.toLowerCase();

  // Tech/SaaS keywords
  if (
    text.match(/\b(software|saas|platform|api|cloud|tech|digital|app|solution|system)\b/i)
  ) {
    return "Tech, SaaS, B2B software";
  }

  // Healthcare keywords
  if (
    text.match(/\b(health|medical|pharma|biotech|clinical|patient|hospital|diagnostic)\b/i)
  ) {
    return "Healthcare & life sciences";
  }

  // E-commerce keywords
  if (
    text.match(/\b(ecommerce|e-commerce|retail|store|shop|marketplace|dtc|direct to consumer)\b/i)
  ) {
    return "E-commerce & DTC brands";
  }

  // Manufacturing keywords
  if (
    text.match(/\b(manufacturing|factory|production|supply chain|logistics|distribution|industrial)\b/i)
  ) {
    return "Manufacturing & distribution";
  }

  // Hospitality/Retail keywords
  if (
    text.match(/\b(hotel|restaurant|hospitality|retail|store|boutique|food service)\b/i)
  ) {
    return "Hospitality & retail";
  }

  // Nonprofit keywords
  if (
    text.match(/\b(nonprofit|non-profit|charity|foundation|mission|social impact|ngo)\b/i)
  ) {
    return "Nonprofits & mission-driven orgs";
  }

  // Default to Professional Services
  return "Professional services";
}

