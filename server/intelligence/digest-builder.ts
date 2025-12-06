import { storage } from "../storage";
import type { Industry } from "./industry-classifier";

export interface WeeklyDigest {
  userId: string;
  weekOf: string; // ISO date string
  events: DigestEvent[];
}

export interface DigestEvent {
  id: string;
  companyName: string;
  companyDomain: string;
  industry: Industry;
  eventType: string;
  date: string;
  summary: string;
  issues: string[];
  leadership: Array<{
    name: string;
    title: string;
    verified: boolean;
    profileUrl?: string;
  }>;
  starters: Array<{
    role: string;
    starter: string;
  }>;
  sourceUrl: string;
  impactScore: number;
}

/**
 * Build weekly digest for a user
 * Per PRD Appendix B.12 and FR-10
 */
export async function buildDigestForUser(userId: string, industry: Industry): Promise<WeeklyDigest> {
  // Get all events matching user's industry
  const allEvents = await storage.getEnrichedEvents(industry, 200); // Get more than needed for filtering

  // Filter to user's industry and limit to 20 per PRD FR-10
  const matchedEvents = allEvents
    .filter(event => event.industry === industry)
    .slice(0, 20); // v1 cap per PRD

  // Format as digest events
  const digestEvents: DigestEvent[] = matchedEvents.map(event => ({
    id: event.id,
    companyName: event.companyName,
    companyDomain: event.companyDomain,
    industry: event.industry as Industry,
    eventType: event.eventType,
    date: event.date,
    summary: event.summary,
    issues: event.issues || [],
    leadership: event.leadership || [],
    starters: event.starters || [],
    sourceUrl: event.sourceUrl,
    impactScore: event.impactScore,
  }));

  // Get current week (Monday of current week)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  return {
    userId,
    weekOf: monday.toISOString().split('T')[0],
    events: digestEvents,
  };
}

/**
 * Store digest (could be extended to send email, store in DB, etc.)
 */
export async function storeDigest(digest: WeeklyDigest): Promise<void> {
  // For now, just log it
  // In future, could store in database or send via email
  console.log(`Digest for user ${digest.userId}: ${digest.events.length} events`);
}

