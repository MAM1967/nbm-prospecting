import { LucideIcon, Briefcase, TrendingUp, Users, Building2, Megaphone, ArrowUpRight } from "lucide-react";

// Types based on PRD
export type Industry = 
  | "Tech, SaaS, B2B software"
  | "Professional services"
  | "E-commerce & DTC brands"
  | "Healthcare & life sciences"
  | "Manufacturing & distribution"
  | "Hospitality & retail"
  | "Nonprofits & mission-driven orgs";

export type EventType = 
  | "rebrand"
  | "new_exec_hire"
  | "thought_leadership_spike"
  | "hiring_surge"
  | "m_and_a"
  | "office_expansion";

export interface ConversationStarter {
  role: string;
  starter: string;
}

export interface LeadershipRole {
  name: string;
  title: string;
  verified: boolean;
  profileUrl?: string;
}

export interface IntelligenceEvent {
  id: string;
  companyName: string;
  companyDomain: string;
  logoPlaceholder?: string; // We'll map to our generated images
  industry: Industry;
  eventType: EventType;
  date: string;
  summary: string;
  issues: string[];
  leadership: LeadershipRole[];
  starters: ConversationStarter[];
  sourceUrl: string;
  impactScore: number; // 1-100, purely for UI sorting
}

// Mock Data
export const MOCK_EVENTS: IntelligenceEvent[] = [
  {
    id: "evt-001",
    companyName: "NexusFlow Systems",
    companyDomain: "nexusflow.io",
    logoPlaceholder: "tech", // maps to one of our generated logos
    industry: "Tech, SaaS, B2B software",
    eventType: "rebrand",
    date: "2025-12-04",
    summary: "NexusFlow has announced a complete brand overhaul, shifting from 'data pipelines' to 'AI-driven operational intelligence'. New website emphasizes enterprise readiness and security compliance.",
    issues: ["Positioning", "Differentiation", "Funnel performance"],
    leadership: [
      { name: "Sarah Chen", title: "CMO", verified: true },
      { name: "David Miller", title: "VP of Sales", verified: true }
    ],
    starters: [
      { role: "CMO", starter: "Saw the shift to 'AI-driven ops'—bold move. Are you finding the new messaging is resonating with the enterprise segment yet, or is it still early days?" },
      { role: "VP of Sales", starter: "The new brand positioning looks sharp. Curious if this rebrand is being driven by a push to move upmarket into larger enterprise deals?" }
    ],
    sourceUrl: "https://techcrunch.com/mock-article",
    impactScore: 92
  },
  {
    id: "evt-002",
    companyName: "Global Logistics Partners",
    companyDomain: "glp-shipping.com",
    logoPlaceholder: "logistics",
    industry: "Manufacturing & distribution",
    eventType: "new_exec_hire",
    date: "2025-12-05",
    summary: "Appointed James Harrison as new Chief Revenue Officer. Harrison previously led sales at Flexport during their expansion phase.",
    issues: ["BD alignment", "Positioning", "Go-to-Market Strategy"],
    leadership: [
      { name: "James Harrison", title: "CRO", verified: true },
      { name: "Elena Ross", title: "CEO", verified: true }
    ],
    starters: [
      { role: "CRO", starter: "Congrats on the new role at GLP. Given your background at Flexport, I imagine optimizing the sales motion for the new digital products is high on the agenda?" },
      { role: "CEO", starter: "Saw James joined as CRO. It signals a strong push for revenue maturity—are you looking to revamp the outbound motion alongside his arrival?" }
    ],
    sourceUrl: "https://wsj.com/mock-logistics",
    impactScore: 88
  },
  {
    id: "evt-003",
    companyName: "MediCare Plus",
    companyDomain: "medicareplus.health",
    logoPlaceholder: "health",
    industry: "Healthcare & life sciences",
    eventType: "thought_leadership_spike",
    date: "2025-12-03",
    summary: "MediCare Plus leadership has published 5 articles this week on 'Patient-Centric AI' and appeared on 2 major industry podcasts.",
    issues: ["Thought leadership", "Demand Gen", "Brand Authority"],
    leadership: [
      { name: "Dr. Emily Weiss", title: "Chief Medical Officer", verified: true },
      { name: "Mark Stone", title: "VP Marketing", verified: true }
    ],
    starters: [
      { role: "VP Marketing", starter: "The recent content blitz on Patient-Centric AI is impressive. It’s clearly distinguishing you from the legacy players—how are you measuring the attribution on that thought leadership so far?" }
    ],
    sourceUrl: "https://healthnews.mock",
    impactScore: 75
  },
   {
    id: "evt-004",
    companyName: "Vanguard Retail",
    companyDomain: "vanguardretail.com",
    logoPlaceholder: "logistics", // reusing logistics logo for retail
    industry: "Hospitality & retail",
    eventType: "hiring_surge",
    date: "2025-12-02",
    summary: "Vanguard Retail has posted 15 new roles in Marketing and Digital Growth in the last 7 days, a 300% increase over their baseline.",
    issues: ["Demand Gen", "Funnel performance", "BD alignment"],
    leadership: [
      { name: "Lisa Patris", title: "Head of Talent", verified: true },
      { name: "Tom Ford", title: "Director of Digital", verified: false }
    ],
    starters: [
      { role: "Director of Digital", starter: "Noticed the massive hiring push in your growth team. Scaling that fast usually breaks existing funnel processes—how are you handling the influx?" }
    ],
    sourceUrl: "https://linkedin.com/mock-jobs",
    impactScore: 81
  }
];

export const INDUSTRIES: Industry[] = [
  "Tech, SaaS, B2B software",
  "Professional services",
  "E-commerce & DTC brands",
  "Healthcare & life sciences",
  "Manufacturing & distribution",
  "Hospitality & retail",
  "Nonprofits & mission-driven orgs"
];
