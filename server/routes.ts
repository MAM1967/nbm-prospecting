import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchIndustryNews, filterRecentArticles } from "./intelligence/news-fetcher";
import { detectEvent, mapIssuesToEvent } from "./intelligence/event-detector";
import { mapIssuesToRoles, generateConversationStarters } from "./intelligence/conversation-generator";
import { extractCompaniesFromArticles } from "./intelligence/company-extractor";
import { analyzeHomepage } from "./intelligence/homepage-analyzer";
import { scrapeLeadership } from "./intelligence/leadership-scraper";
import { classifyIndustry } from "./intelligence/industry-classifier";
import type { Industry } from "./intelligence/industry-classifier";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get enriched events for dashboard
  // Filters by user industry preference if userId provided
  app.get("/api/events", async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const industry = req.query.industry as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      // If userId provided, get user's industry preference
      let filterIndustry = industry;
      if (userId && !industry) {
        const user = await storage.getUser(userId);
        if (user && user.selectedIndustry) {
          filterIndustry = user.selectedIndustry;
        }
      }

      const events = await storage.getEnrichedEvents(filterIndustry, limit);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // Trigger intelligence engine (manual run)
  app.post("/api/intelligence/run", async (req, res) => {
    const startTime = Date.now();
    const MAX_RUNTIME = 30 * 60 * 1000; // 30 minutes per PRD
    
    try {
      const { industry = "Tech, SaaS, B2B software" } = req.body;
      const targetIndustry = industry as Industry;

      // Step 1: Fetch news (90-day window, up to 2,000 articles per PRD FR-01)
      console.log(`Fetching news for ${targetIndustry}...`);
      const allArticles = await fetchIndustryNews(targetIndustry);
      const recentArticles = filterRecentArticles(allArticles, 90); // 90-day window
      console.log(`Found ${recentArticles.length} recent articles`);

      // Step 2: Extract companies with deduplication
      console.log("Extracting companies...");
      const extractedCompanies = await extractCompaniesFromArticles(
        recentArticles.map(a => ({
          title: a.title,
          description: a.description || "",
          url: a.url,
        }))
      );
      console.log(`Extracted ${extractedCompanies.length} unique companies`);

      // Step 3: Detect events and process companies
      // Process up to 2,000 articles per PRD FR-01
      const articlesToProcess = recentArticles.slice(0, 2000);
      const processedEvents = [];
      const processedCompanies = new Set<string>();

      // Batch processing with timeout handling
      for (let i = 0; i < articlesToProcess.length; i++) {
        // Check timeout
        if (Date.now() - startTime > MAX_RUNTIME) {
          console.log("Reached 30-minute timeout, stopping processing");
          break;
        }

        const article = articlesToProcess[i];
        
        // Detect event
        const detected = await detectEvent(article.title, article.description);
        
        if (!detected || !detected.companyName) {
          continue;
        }

        // Find matching extracted company
        const extractedCompany = extractedCompanies.find(
          c => c.normalizedName.toLowerCase() === detected.companyName.toLowerCase()
        );

        if (!extractedCompany) {
          continue;
        }

        // Skip if already processed
        if (processedCompanies.has(extractedCompany.normalizedName)) {
          continue;
        }

        processedCompanies.add(extractedCompany.normalizedName);

        try {
          console.log(`Processing ${detected.companyName} - ${detected.eventType}`);

          // Analyze homepage if domain exists
          let homepageSummary = "";
          if (extractedCompany.domain) {
            const analysis = await analyzeHomepage(extractedCompany.domain);
            if (analysis) {
              homepageSummary = analysis.summary;
            }
          }

          // Classify industry
          const classifiedIndustry = await classifyIndustry(
            extractedCompany.name,
            homepageSummary
          );

          // Create/get company
          const company = await storage.getOrCreateCompany({
            name: extractedCompany.name,
            domain: extractedCompany.domain || undefined,
            industry: classifiedIndustry,
            logoPlaceholder: classifiedIndustry.toLowerCase().includes('tech') ? 'tech' : 
                           classifiedIndustry.toLowerCase().includes('health') ? 'health' : 'logistics',
          });

          // Scrape leadership
          let leadership = [];
          if (extractedCompany.domain) {
            leadership = await scrapeLeadership(extractedCompany.domain);
            
            // Store leadership
            for (const leader of leadership) {
              await storage.createLeadership({
                companyId: company.id,
                name: leader.name,
                title: leader.title,
                verified: leader.verified ? 1 : 0,
                profileUrl: leader.profileUrl,
              });
            }
          }

          // Map issues
          const issues = mapIssuesToEvent(detected.eventType);

          // Map issues to roles
          const roles = mapIssuesToRoles(issues);

          // Create event
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

          // Generate conversation starters for each role
          for (const role of roles) {
            const starters = await generateConversationStarters(
              company.name,
              company.domain || "",
              detected.eventType,
              issues,
              role,
              homepageSummary,
              article.title,
              article.description || ""
            );

            for (const starter of starters) {
              await storage.createConversationStarter({
                eventId: event.id,
                role: starter.role,
                starter: starter.starter,
              });
            }
          }

          processedEvents.push({ 
            company: company.name, 
            event: detected.eventType,
            industry: classifiedIndustry,
          });
        } catch (error) {
          console.error(`Error processing company ${detected.companyName}:`, error);
          // Continue with next article
        }
      }

      res.json({
        success: true,
        processed: processedEvents.length,
        events: processedEvents,
        runtime: Math.round((Date.now() - startTime) / 1000),
      });
    } catch (error) {
      console.error("Intelligence engine error:", error);
      res.status(500).json({ 
        error: "Intelligence engine failed", 
        details: error instanceof Error ? error.message : "Unknown error" 
      });
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
