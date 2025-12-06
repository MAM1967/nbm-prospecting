import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  rebrand: ['rebrand', 'new brand', 'brand refresh', 'logo redesign', 'rebranding'],
  new_exec_hire: ['hired', 'appoints', 'new ceo', 'new cmo', 'new cfo', 'joins as', 'named chief'],
  thought_leadership_spike: ['publishes', 'article', 'podcast', 'keynote', 'speaking at', 'thought leader'],
  hiring_surge: ['hiring', 'open positions', 'job openings', 'recruitment', 'expanding team'],
  m_and_a: ['acquires', 'acquisition', 'merger', 'acquired by', 'merges with'],
  office_expansion: ['new office', 'opens headquarters', 'expands to', 'new location'],
};

export async function detectEvent(title: string, description: string): Promise<DetectedEvent | null> {
  const text = `${title} ${description}`.toLowerCase();

  // First, try keyword detection
  for (const [eventType, keywords] of Object.entries(EVENT_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
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

  // Fallback to LLM (only if keywords didn't match)
  return await detectEventWithLLM(title, description);
}

async function detectEventWithLLM(title: string, description: string): Promise<DetectedEvent | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an event detection system. Analyze news articles and detect these event types:
- rebrand: Company rebrand or brand refresh
- new_exec_hire: New executive hire (C-level or VP+)
- thought_leadership_spike: Published articles, podcasts, speaking events
- hiring_surge: Mass hiring or team expansion
- m_and_a: Mergers and acquisitions
- office_expansion: New office or geographic expansion

Return JSON: { "eventType": string | null, "confidence": 0-1, "companyName": string, "summary": string }
If no relevant event, return eventType as null.`,
        },
        {
          role: "user",
          content: `Title: ${title}\n\nDescription: ${description}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    if (result.eventType && result.confidence > 0.6) {
      return result as DetectedEvent;
    }
    
    return null;
  } catch (error) {
    console.error('LLM detection failed:', error);
    return null;
  }
}

function extractCompanyName(title: string): string | null {
  // Simple heuristic: company names are often capitalized words before verbs
  const patterns = [
    /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s(?:appoints|hires|announces|launches|acquires)/,
    /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s/,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

// Map event types to issues per PRD
export function mapIssuesToEvent(eventType: EventType): string[] {
  const ISSUE_MAP: Record<EventType, string[]> = {
    rebrand: ["Positioning", "Differentiation", "Funnel performance"],
    new_exec_hire: ["BD alignment", "Positioning", "Thought leadership"],
    thought_leadership_spike: ["Thought leadership", "Demand Gen", "Differentiation"],
    hiring_surge: ["Demand Gen", "Funnel performance", "BD alignment"],
    m_and_a: ["Positioning", "Differentiation", "BD alignment"],
    office_expansion: ["Demand Gen", "Funnel performance", "BD alignment"],
  };

  return ISSUE_MAP[eventType] || [];
}
