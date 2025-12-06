import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchNewsFromRSS, filterRecentArticles } from "./intelligence/news-fetcher";
import { detectEvent, mapIssuesToEvent } from "./intelligence/event-detector";
import { generateConversationStarters, mockLeadershipData } from "./intelligence/conversation-generator";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get enriched events for dashboard
  app.get("/api/events", async (req, res) => {
    try {
      const industry = req.query.industry as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      const events = await storage.getEnrichedEvents(industry, limit);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // Trigger intelligence engine (manual run)
  app.post("/api/intelligence/run", async (req, res) => {
    try {
      const { industry = "Tech, SaaS, B2B software" } = req.body;

      // Step 1: Fetch news
      console.log("Fetching news from RSS feeds...");
      const allArticles = await fetchNewsFromRSS('tech');
      const recentArticles = filterRecentArticles(allArticles, 7);
      console.log(`Found ${recentArticles.length} recent articles`);

      // Step 2: Detect events (process first 10 to save costs)
      const articlesToProcess = recentArticles.slice(0, 10);
      const processedEvents = [];

      for (const article of articlesToProcess) {
        const detected = await detectEvent(article.title, article.description);
        
        if (detected && detected.companyName) {
          console.log(`Detected ${detected.eventType} for ${detected.companyName}`);
          
          // Step 3: Create/get company
          const company = await storage.getOrCreateCompany({
            name: detected.companyName,
            domain: new URL(article.url).hostname,
            industry,
            logoPlaceholder: industry.toLowerCase().includes('tech') ? 'tech' : 
                           industry.toLowerCase().includes('health') ? 'health' : 'logistics',
          });

          // Step 4: Map issues
          const issues = mapIssuesToEvent(detected.eventType);

          // Step 5: Create event
          const event = await storage.createEvent({
            companyId: company.id,
            eventType: detected.eventType,
            date: new Date(article.publishedAt),
            summary: detected.summary,
            sourceUrl: article.url,
            issues,
            impactScore: Math.floor(detected.confidence * 100),
            rawArticle: { title: article.title, description: article.description },
          });

          // Step 6: Generate conversation starters
          const starters = await generateConversationStarters(
            company.name,
            detected.eventType,
            detected.summary,
            issues
          );

          for (const starter of starters) {
            await storage.createConversationStarter({
              eventId: event.id,
              role: starter.role,
              starter: starter.starter,
            });
          }

          // Step 7: Mock leadership data (would normally scrape website)
          const roles = starters.map(s => s.role);
          const leaders = mockLeadershipData(company.name, roles);
          
          for (const leader of leaders) {
            await storage.createLeadership({
              companyId: company.id,
              name: leader.name,
              title: leader.title,
              verified: leader.verified ? 1 : 0,
            });
          }

          processedEvents.push({ company: company.name, event: detected.eventType });
        }
      }

      res.json({
        success: true,
        processed: processedEvents.length,
        events: processedEvents,
      });
    } catch (error) {
      console.error("Intelligence engine error:", error);
      res.status(500).json({ error: "Intelligence engine failed", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Update user industry preference
  app.post("/api/user/industry", async (req, res) => {
    try {
      const { userId, industry } = req.body;
      
      if (!userId || !industry) {
        return res.status(400).json({ error: "userId and industry are required" });
      }

      await storage.updateUserIndustry(userId, industry);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user industry:", error);
      res.status(500).json({ error: "Failed to update industry" });
    }
  });

  return httpServer;
}
