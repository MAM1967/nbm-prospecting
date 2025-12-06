import OpenAI from "openai";
import type { EventType } from "./event-detector";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ConversationStarter {
  role: string;
  starter: string;
}

// Map event types to relevant executive roles
export function getRolesForEvent(eventType: EventType): string[] {
  const ROLE_MAP: Record<EventType, string[]> = {
    rebrand: ["CMO", "VP of Marketing", "Brand Director"],
    new_exec_hire: ["CEO", "CRO", "VP of Sales"],
    thought_leadership_spike: ["VP of Marketing", "Head of Content", "CMO"],
    hiring_surge: ["Director of Operations", "Head of Talent", "VP of Growth"],
    m_and_a: ["CEO", "CFO", "COO"],
    office_expansion: ["Director of Operations", "VP of Growth", "CEO"],
  };

  return ROLE_MAP[eventType] || ["CMO"];
}

export async function generateConversationStarters(
  companyName: string,
  eventType: EventType,
  summary: string,
  issues: string[]
): Promise<ConversationStarter[]> {
  const roles = getRolesForEvent(eventType);
  const starters: ConversationStarter[] = [];

  // Generate max 2 starters (cost control)
  const targetRoles = roles.slice(0, 2);

  for (const role of targetRoles) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are an expert cold email writer for fractional executives. Generate a single conversation starter (1-2 sentences) that:
- Is personalized to the specific event
- Sounds natural and human
- Asks a thoughtful question or makes an observation
- Does NOT use salesy language
- References the event naturally
- Is suitable for a LinkedIn message or cold email opener

Focus on these business issues: ${issues.join(", ")}

Return JSON: { "starter": string }`,
          },
          {
            role: "user",
            content: `Company: ${companyName}
Event: ${eventType}
Context: ${summary}
Target Role: ${role}

Write a conversation starter for a Fractional CMO reaching out to this ${role}.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (result.starter) {
        starters.push({
          role,
          starter: result.starter,
        });
      }
    } catch (error) {
      console.error(`Failed to generate starter for ${role}:`, error);
    }
  }

  return starters;
}

// Mock leadership extraction (would normally scrape company website)
export function mockLeadershipData(companyName: string, roles: string[]): Array<{ name: string; title: string; verified: boolean }> {
  return roles.slice(0, 2).map((role, idx) => ({
    name: `${['Sarah', 'Michael', 'Jennifer', 'David'][idx % 4]} ${['Chen', 'Smith', 'Johnson', 'Williams'][idx % 4]}`,
    title: role,
    verified: true,
  }));
}
