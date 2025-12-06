import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, desc, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  User,
  InsertUser,
  Company,
  InsertCompany,
  Event,
  InsertEvent,
  Leadership,
  InsertLeadership,
  ConversationStarter,
  InsertConversationStarter,
} from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserIndustry(userId: string, industry: string): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // Company operations
  getOrCreateCompany(data: InsertCompany): Promise<Company>;
  getCompanyById(id: number): Promise<Company | undefined>;

  // Event operations
  createEvent(event: InsertEvent): Promise<Event>;
  getRecentEvents(limit?: number): Promise<Event[]>;
  getEventsByIndustry(industry: string, limit?: number): Promise<Event[]>;
  getEventById(id: number): Promise<Event | undefined>;
  // Check if event already exists (deduplication)
  eventExists(
    companyId: number,
    eventType: string,
    sourceUrl: string
  ): Promise<boolean>;
  getEventByCompanyAndUrl(
    companyId: number,
    sourceUrl: string
  ): Promise<Event | undefined>;
  deleteEvent(eventId: number): Promise<void>;

  // Leadership operations
  createLeadership(leadership: InsertLeadership): Promise<Leadership>;
  getLeadershipByCompany(companyId: number): Promise<Leadership[]>;

  // Conversation Starter operations
  createConversationStarter(
    starter: InsertConversationStarter
  ): Promise<ConversationStarter>;
  getStartersByEvent(eventId: number): Promise<ConversationStarter[]>;

  // Aggregate query for full event data (joins)
  getEnrichedEvents(industry?: string, limit?: number): Promise<any[]>;
}

export class Storage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(schema.users).values(user).returning();
    return newUser;
  }

  async updateUserIndustry(userId: string, industry: string): Promise<void> {
    await db
      .update(schema.users)
      .set({ selectedIndustry: industry })
      .where(eq(schema.users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(schema.users);
  }

  async getOrCreateCompany(data: InsertCompany): Promise<Company> {
    // Try to find existing company by name or domain
    const existing = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.name, data.name))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const [newCompany] = await db
      .insert(schema.companies)
      .values(data)
      .returning();
    return newCompany;
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.id, id))
      .limit(1);
    return company;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(schema.events).values(event).returning();
    return newEvent;
  }

  async getRecentEvents(limit: number = 20): Promise<Event[]> {
    return await db
      .select()
      .from(schema.events)
      .orderBy(desc(schema.events.date))
      .limit(limit);
  }

  async getEventsByIndustry(
    industry: string,
    limit: number = 20
  ): Promise<Event[]> {
    // Join with companies to filter by industry
    return await db
      .select({
        id: schema.events.id,
        companyId: schema.events.companyId,
        eventType: schema.events.eventType,
        date: schema.events.date,
        summary: schema.events.summary,
        sourceUrl: schema.events.sourceUrl,
        issues: schema.events.issues,
        impactScore: schema.events.impactScore,
        rawArticle: schema.events.rawArticle,
        processedAt: schema.events.processedAt,
      })
      .from(schema.events)
      .innerJoin(
        schema.companies,
        eq(schema.events.companyId, schema.companies.id)
      )
      .where(eq(schema.companies.industry, industry))
      .orderBy(desc(schema.events.date))
      .limit(limit);
  }

  async getEventById(id: number): Promise<Event | undefined> {
    const [event] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, id))
      .limit(1);
    return event;
  }

  async eventExists(
    companyId: number,
    eventType: string,
    sourceUrl: string
  ): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(schema.events)
      .where(
        sql`${schema.events.companyId} = ${companyId} AND ${schema.events.eventType} = ${eventType} AND ${schema.events.sourceUrl} = ${sourceUrl}`
      )
      .limit(1);
    return !!existing;
  }

  async getEventByCompanyAndUrl(
    companyId: number,
    sourceUrl: string
  ): Promise<Event | undefined> {
    const [event] = await db
      .select()
      .from(schema.events)
      .where(
        sql`${schema.events.companyId} = ${companyId} AND ${schema.events.sourceUrl} = ${sourceUrl}`
      )
      .limit(1);
    return event;
  }

  async deleteEvent(eventId: number): Promise<void> {
    // Delete conversation starters first (foreign key constraint)
    await db
      .delete(schema.conversationStarters)
      .where(eq(schema.conversationStarters.eventId, eventId));
    // Delete the event
    await db.delete(schema.events).where(eq(schema.events.id, eventId));
  }

  async createLeadership(leadership: InsertLeadership): Promise<Leadership> {
    const [newLeadership] = await db
      .insert(schema.leadership)
      .values(leadership)
      .returning();
    return newLeadership;
  }

  async getLeadershipByCompany(companyId: number): Promise<Leadership[]> {
    return await db
      .select()
      .from(schema.leadership)
      .where(eq(schema.leadership.companyId, companyId));
  }

  async createConversationStarter(
    starter: InsertConversationStarter
  ): Promise<ConversationStarter> {
    const [newStarter] = await db
      .insert(schema.conversationStarters)
      .values(starter)
      .returning();
    return newStarter;
  }

  async getStartersByEvent(eventId: number): Promise<ConversationStarter[]> {
    return await db
      .select()
      .from(schema.conversationStarters)
      .where(eq(schema.conversationStarters.eventId, eventId));
  }

  async getEnrichedEvents(
    industry?: string,
    limit: number = 20
  ): Promise<any[]> {
    // Complex join to get full event data with company, leadership, and starters
    let query = db
      .select({
        event: schema.events,
        company: schema.companies,
      })
      .from(schema.events)
      .innerJoin(
        schema.companies,
        eq(schema.events.companyId, schema.companies.id)
      )
      .orderBy(desc(schema.events.date))
      .limit(limit);

    const results = await query;

    // Enrich with leadership and starters
    const enriched = await Promise.all(
      results.map(async (row) => {
        const leadership = await this.getLeadershipByCompany(row.company.id);
        const starters = await this.getStartersByEvent(row.event.id);

        return {
          id: row.event.id.toString(),
          companyName: row.company.name,
          companyDomain: row.company.domain || "",
          logoPlaceholder: row.company.logoPlaceholder || "tech",
          industry: row.company.industry || "Tech, SaaS, B2B software",
          eventType: row.event.eventType,
          date: row.event.date.toISOString().split("T")[0],
          summary: row.event.summary,
          issues: row.event.issues || [],
          // Per PRD: Limit to 2 verified leads per company
          leadership: leadership
            .filter((l) => l.verified === 1)
            .slice(0, 2)
            .map((l) => ({
              name: l.name,
              title: l.title,
              verified: l.verified === 1,
              profileUrl: l.profileUrl || undefined,
            })),
          // Per PRD: Limit to 2 conversation starters per company
          starters: starters.slice(0, 2).map((s) => ({
            role: s.role,
            starter: s.starter,
          })),
          sourceUrl: row.event.sourceUrl || "",
          impactScore: row.event.impactScore || 50,
        };
      })
    );

    return enriched;
  }
}

export const storage = new Storage();
