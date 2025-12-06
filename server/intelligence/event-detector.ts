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

export type EventType =
  | "rebrand"
  | "new_exec_hire"
  | "thought_leadership_spike"
  | "hiring_surge"
  | "m_and_a"
  | "office_expansion";

interface DetectedEvent {
  eventType: EventType;
  confidence: number;
  companyName: string;
  summary: string;
}

// Keyword-based detection (fast, cheap)
const EVENT_KEYWORDS: Record<EventType, string[]> = {
  rebrand: [
    "rebrand",
    "new brand",
    "brand refresh",
    "logo redesign",
    "rebranding",
  ],
  new_exec_hire: [
    "hired",
    "appoints",
    "new ceo",
    "new cmo",
    "new cfo",
    "joins as",
    "named chief",
  ],
  thought_leadership_spike: [
    "publishes",
    "article",
    "podcast",
    "keynote",
    "speaking at",
    "thought leader",
  ],
  hiring_surge: [
    "hiring",
    "open positions",
    "job openings",
    "recruitment",
    "expanding team",
  ],
  m_and_a: ["acquires", "acquisition", "merger", "acquired by", "merges with"],
  office_expansion: [
    "new office",
    "opens headquarters",
    "expands to",
    "new location",
  ],
};

export async function detectEvent(
  title: string,
  description: string,
  homepageSummary?: string
): Promise<DetectedEvent | null> {
  const text = `${title} ${description}`.toLowerCase();

  // First, try keyword detection
  for (const [eventType, keywords] of Object.entries(EVENT_KEYWORDS)) {
    if (keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      const companyName = extractCompanyName(title);

      if (companyName) {
        return {
          eventType: eventType as EventType,
          confidence: 0.8,
          companyName,
          summary: description.slice(0, 300),
        };
      }
    }
  }

  // Fallback to LLM (only if keywords didn't match and API key is valid)
  if (isValidApiKey()) {
    return await detectEventWithLLM(title, description, homepageSummary);
  }

  // If no API key, return null (keyword detection already tried)
  return null;
}

async function detectEventWithLLM(
  title: string,
  description: string,
  homepageSummary?: string
): Promise<DetectedEvent | null> {
  // Double-check API key before making request
  if (!isValidApiKey()) {
    return null;
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
Article Title: ${title}
Article Summary: ${description}
Homepage Summary: ${homepageSummary || "N/A"}

TASK:
Classify this event into exactly ONE of the following types:
- rebrand
- new_exec_hire
- thought_leadership_spike
- hiring_surge
- m_and_a
- office_expansion

Return ONLY:
{
  "event_type": "..."
}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const eventType = result.event_type;

    if (
      eventType &&
      Object.values([
        "rebrand",
        "new_exec_hire",
        "thought_leadership_spike",
        "hiring_surge",
        "m_and_a",
        "office_expansion",
      ]).includes(eventType)
    ) {
      const companyName = extractCompanyName(title);
      return {
        eventType: eventType as EventType,
        confidence: 0.8,
        companyName: companyName || "Unknown",
        summary: description.slice(0, 300),
      };
    }

    return null;
  } catch (error: any) {
    // Only log authentication errors once, not for every article
    if (error?.code === "invalid_api_key" || error?.status === 401) {
      // Log once per process, not per article
      if (!(global as any).__openai_key_warned) {
        console.warn(
          "OpenAI API key is invalid or missing. LLM-based event detection disabled. Using keyword-based detection only."
        );
        (global as any).__openai_key_warned = true;
      }
    } else {
      // Log other errors normally
      console.error("LLM detection failed:", error?.message || error);
    }
    return null;
  }
}

// Import company extractor to use same logic
import { extractCompanyName as extractCompanyNameFromText } from "./company-extractor";

function extractCompanyName(title: string): string | null {
  // Use the same extraction logic as company-extractor for consistency
  return extractCompanyNameFromText(title, "");
}

// Map event types to issues per PRD
export function mapIssuesToEvent(eventType: EventType): string[] {
  const ISSUE_MAP: Record<EventType, string[]> = {
    rebrand: ["Positioning", "Differentiation", "Funnel performance"],
    new_exec_hire: ["BD alignment", "Positioning", "Thought leadership"],
    thought_leadership_spike: [
      "Thought leadership",
      "Demand Gen",
      "Differentiation",
    ],
    hiring_surge: ["Demand Gen", "Funnel performance", "BD alignment"],
    m_and_a: ["Positioning", "Differentiation", "BD alignment"],
    office_expansion: ["Demand Gen", "Funnel performance", "BD alignment"],
  };

  return ISSUE_MAP[eventType] || [];
}
