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

export interface ConversationStarter {
  role: string;
  starter: string;
}

export interface ExecutiveInfo {
  name: string;
  title: string;
}

// Helper to validate executive names (reject garbage)
function isValidExecutiveName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 50) return false;
  // Reject if contains HTML/newlines/formatting
  if (
    name.includes("\n") ||
    name.includes("#") ||
    name.includes("{") ||
    name.includes("}")
  )
    return false;
  // Reject if looks like a sentence fragment
  if (
    name
      .toLowerCase()
      .match(
        /^(who|what|where|when|why|how|which|that|this|these|those|i|you|he|she|it|we|they|my|your|his|her|its|our|their)\s+/
      )
  )
    return false;
  if (
    name
      .toLowerCase()
      .match(
        /\s+(is|was|are|were|has|have|had|will|would|can|could|should|may|might|being|been|to|for|with|from|by|put|called|said|told|shared|wakes|wore|arrive|arrived|wakes|without|alarm|shared|tips|help|be|point|requesting|put|company|sale|october|called|theatres|an)\s+/
      )
  )
    return false;
  // Must start with capital letter
  if (!/^[A-Z]/.test(name.trim())) return false;
  return true;
}

// PRD-specified roles (v1 scope)
export type TargetRole =
  | "Head of Marketing"
  | "Practice Lead"
  | "Chief of Staff"
  | "CEO";

/**
 * Map issues to roles per PRD Appendix B.9
 * Roles are determined by issues, not event types
 */
export function mapIssuesToRoles(issues: string[]): TargetRole[] {
  const ROLE_MAP: Record<string, TargetRole[]> = {
    Positioning: ["Head of Marketing", "CEO", "Practice Lead"],
    Differentiation: ["Head of Marketing", "Practice Lead"],
    "Demand Gen": ["Head of Marketing", "CEO"],
    "Funnel performance": ["Head of Marketing", "CEO"],
    "BD alignment": [
      "Head of Marketing",
      "Practice Lead",
      "Chief of Staff",
      "CEO",
    ],
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
  const allowed: TargetRole[] = [
    "Head of Marketing",
    "Practice Lead",
    "Chief of Staff",
    "CEO",
  ];
  return Array.from(roles).filter((r) => allowed.includes(r));
}

/**
 * Generate conversation starters per PRD Appendix C.6
 */
/**
 * Generate fallback conversation starters when LLM is unavailable
 * These are template-based but still useful
 */
function generateFallbackStarters(
  companyName: string,
  eventType: string,
  issues: string[],
  role: TargetRole,
  articleTitle: string,
  executive?: ExecutiveInfo
): ConversationStarter[] {
  const starters: ConversationStarter[] = [];

  // Create context-aware starters based on event type and issues
  const eventContext = {
    m_and_a: `I noticed ${companyName} recently made an acquisition`,
    rebrand: `I saw ${companyName} just rebranded`,
    new_exec_hire: `I noticed ${companyName} recently hired a new executive`,
    thought_leadership_spike: `I saw ${companyName} published some interesting content`,
    hiring_surge: `I noticed ${companyName} is expanding their team`,
    office_expansion: `I saw ${companyName} is opening new locations`,
  };

  const issueContext = {
    Positioning: "positioning strategy",
    Differentiation: "differentiation in the market",
    "Demand Gen": "demand generation",
    "Funnel performance": "funnel optimization",
    "BD alignment": "business development alignment",
    "Thought leadership": "thought leadership",
  };

  const context =
    eventContext[eventType as keyof typeof eventContext] ||
    `I noticed ${companyName} recently`;
  const primaryIssue = issues[0] || "marketing";
  const issueText =
    issueContext[primaryIssue as keyof typeof issueContext] ||
    "marketing strategy";

  // Include executive name if available for personalization (only if it's a valid name)
  const executiveFirstName =
    executive && isValidExecutiveName(executive.name)
      ? executive.name.split(" ")[0]
      : null;
  const greeting = executiveFirstName ? `Hi ${executiveFirstName}, ` : "";

  // Generate 2 starters with executive name if available
  starters.push({
    role,
    starter: `${greeting}${context}. This often creates opportunities to refine ${issueText}.`,
  });

  starters.push({
    role,
    starter: `${greeting}${context}. How is this impacting your ${issueText}?`,
  });

  return starters;
}

export async function generateConversationStarters(
  companyName: string,
  companyDomain: string,
  eventType: string,
  issues: string[],
  role: TargetRole,
  homepageSummary: string,
  articleTitle: string,
  articleSummary: string,
  executive?: ExecutiveInfo
): Promise<ConversationStarter[]> {
  // If API key is invalid, use fallback starters instead of returning empty
  if (!isValidApiKey()) {
    console.log(
      `Using fallback conversation starters for ${companyName} (LLM unavailable)`
    );
    return generateFallbackStarters(
      companyName,
      eventType,
      issues,
      role,
      articleTitle,
      executive
    );
  }

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
Target Role: ${role}
${
  executive
    ? `Executive Name: ${executive.name}\nExecutive Title: ${executive.title}`
    : "No verified executive found for this role"
}
Homepage Summary: ${homepageSummary}
Article:
  Title: ${articleTitle}
  Summary: ${articleSummary}

TASK:
Generate 1–2 highly relevant, human-sounding cold-email openers for ${
            executive ? executive.name : `the ${role}`
          }.
Requirements:
${
  executive
    ? `- MUST use the executive's first name: ${executive.name.split(" ")[0]}`
    : "- If no executive name available, address generically"
}
- Must reference the actual event.
- Must be concise, credible, and non-generic.
- Should reflect real marketing/BD implications.
- No hype, no fluff, no generic praise.
- Do not mention "fractional".
${
  executive
    ? `- Personalize using ${executive.name}'s title: ${executive.title}`
    : ""
}

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
      // Return max 2 starters per company (not per role) - caller will handle limiting
      return result.starters.slice(0, 2).map((starter: string) => ({
        role,
        starter,
      }));
    }

    return [];
  } catch (error: any) {
    // Only log authentication errors once
    if (error?.code === "invalid_api_key" || error?.status === 401) {
      if (!(global as any).__openai_key_warned) {
        console.warn("OpenAI API key is invalid. LLM features disabled.");
        (global as any).__openai_key_warned = true;
      }
    } else {
      console.error(
        `Failed to generate starter for ${role}:`,
        error?.message || error
      );
    }
    return [];
  }
}
