import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ConversationStarter {
  role: string;
  starter: string;
}

// PRD-specified roles (v1 scope)
export type TargetRole = "Head of Marketing" | "Practice Lead" | "Chief of Staff" | "CEO";

/**
 * Map issues to roles per PRD Appendix B.9
 * Roles are determined by issues, not event types
 */
export function mapIssuesToRoles(issues: string[]): TargetRole[] {
  const ROLE_MAP: Record<string, TargetRole[]> = {
    "Positioning": ["Head of Marketing", "CEO", "Practice Lead"],
    "Differentiation": ["Head of Marketing", "Practice Lead"],
    "Demand Gen": ["Head of Marketing", "CEO"],
    "Funnel performance": ["Head of Marketing", "CEO"],
    "BD alignment": ["Head of Marketing", "Practice Lead", "Chief of Staff", "CEO"],
    "Thought leadership": ["Head of Marketing", "Practice Lead", "CEO"],
  };

  const roles = new Set<TargetRole>();
  for (const issue of issues) {
    const issueRoles = ROLE_MAP[issue] || [];
    for (const role of issueRoles) {
      roles.add(role);
    }
  }

  // Restrict to roles supported in v1 per PRD
  const allowed: TargetRole[] = ["Head of Marketing", "Practice Lead", "Chief of Staff", "CEO"];
  return Array.from(roles).filter(r => allowed.includes(r));
}

/**
 * Generate conversation starters per PRD Appendix C.6
 */
export async function generateConversationStarters(
  companyName: string,
  companyDomain: string,
  eventType: string,
  issues: string[],
  role: TargetRole,
  homepageSummary: string,
  articleTitle: string,
  articleSummary: string
): Promise<ConversationStarter[]> {
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
Company: ${companyName}
Domain: ${companyDomain}
Event Type: ${eventType}
Issues: ${issues.join(", ")}
Role: ${role}
Homepage Summary: ${homepageSummary}
Article:
  Title: ${articleTitle}
  Summary: ${articleSummary}

TASK:
Generate 1–2 highly relevant, human-sounding cold-email openers for the ${role}.
Requirements:
- Must reference the actual event.
- Must be concise, credible, and non-generic.
- Should reflect real marketing/BD implications.
- No hype, no fluff, no generic praise.
- Do not mention "fractional".

Return ONLY:
{
  "role": "${role}",
  "starters": [
      "First line...",
      "Second line..."
  ]
}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    if (result.starters && Array.isArray(result.starters)) {
      // Return max 2 starters per PRD
      return result.starters.slice(0, 2).map((starter: string) => ({
        role,
        starter,
      }));
    }

    return [];
  } catch (error) {
    console.error(`Failed to generate starter for ${role}:`, error);
    return [];
  }
}
