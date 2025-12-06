import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  fetchIndustryNews,
  filterRecentArticles,
} from "./intelligence/news-fetcher";
import { detectEvent, mapIssuesToEvent } from "./intelligence/event-detector";
import {
  mapIssuesToRoles,
  generateConversationStarters,
} from "./intelligence/conversation-generator";

// Helper to check if a lead's title matches a target role
function matchesRoleForLead(title: string, role: string): boolean {
  if (role === "any") {
    // Check against all target roles
    const titleLower = title.toLowerCase();
    return (
      titleLower.includes("marketing") ||
      titleLower.includes("practice") ||
      titleLower.includes("chief of staff") ||
      titleLower.includes("ceo") ||
      titleLower.includes("chief executive") ||
      titleLower.includes("president") ||
      titleLower.includes("cmo") ||
      titleLower.includes("coo")
    );
  }
  const titleLower = title.toLowerCase();
  const roleLower = role.toLowerCase();

  if (roleLower.includes("marketing")) {
    return titleLower.includes("marketing") || titleLower.includes("cmo");
  }
  if (roleLower.includes("practice lead")) {
    return titleLower.includes("practice") || titleLower.includes("lead");
  }
  if (roleLower.includes("chief of staff")) {
    return titleLower.includes("chief of staff") || titleLower.includes("coo");
  }
  if (roleLower.includes("ceo")) {
    return (
      titleLower.includes("ceo") ||
      titleLower.includes("chief executive") ||
      titleLower.includes("president")
    );
  }
  return false;
}
import { extractCompaniesFromArticles } from "./intelligence/company-extractor";
import { analyzeHomepage } from "./intelligence/homepage-analyzer";
import {
  scrapeLeadership,
  type LeadershipPerson,
} from "./intelligence/leadership-scraper";
import { classifyIndustry } from "./intelligence/industry-classifier";
import type { Industry } from "./intelligence/industry-classifier";
import { extractExecutivesFromArticle } from "./intelligence/executive-extractor";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get enriched events for dashboard
  // Filters by user industry preference if userId provided
  // Per PRD FR-10: Returns up to 20 events per user
  app.get("/api/events", async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const industry = req.query.industry as string | undefined;
      const limit = 20; // Fixed at 20 per PRD FR-10

      // If userId provided, get user's industry preference
      let filterIndustry = industry;
      if (userId && !industry) {
        const user = await storage.getUser(userId);
        if (user && user.selectedIndustry) {
          filterIndustry = user.selectedIndustry;
        }
      }

      // Get events filtered by industry, limited to 20 per user
      const events = await storage.getEnrichedEvents(filterIndustry, limit);

      // Ensure we return exactly 20 or fewer
      const limitedEvents = events.slice(0, limit);

      res.json(limitedEvents);
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
      // fetchIndustryNews already filters to 90 days, so no need to filter again
      console.log(`[Intelligence] Fetching news for ${targetIndustry}...`);
      const recentArticles = await fetchIndustryNews(targetIndustry);
      console.log(
        `[Intelligence] Found ${recentArticles.length} recent articles`
      );

      // Step 2: Extract companies with deduplication
      console.log("Extracting companies...");
      const extractedCompanies = await extractCompaniesFromArticles(
        recentArticles.map((a) => ({
          title: a.title,
          description: a.description || "",
          url: a.url,
        }))
      );
      console.log(`Extracted ${extractedCompanies.length} unique companies`);

      // Step 3: Detect events and process companies
      // Process up to 2,000 articles per PRD FR-01
      // But limit to 20 companies per user per week per PRD FR-10
      const articlesToProcess = recentArticles.slice(0, 2000);
      const processedEvents = [];
      const processedCompanies = new Set<string>();
      const MAX_COMPANIES_PER_USER = 20; // Per PRD FR-10

      let eventsDetected = 0;
      let companiesMatched = 0;
      let eventsProcessed = 0;

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

        eventsDetected++;

        // Find matching extracted company with improved fuzzy matching
        const detectedNormalized = detected.companyName.toLowerCase().trim();

        // Try multiple matching strategies
        let companyToProcess = extractedCompanies.find(
          (c) => c.normalizedName.toLowerCase() === detectedNormalized
        );

        if (!companyToProcess) {
          // Try substring match (one contains the other)
          companyToProcess = extractedCompanies.find((c) => {
            const cNorm = c.normalizedName.toLowerCase();
            return (
              cNorm.includes(detectedNormalized) ||
              detectedNormalized.includes(cNorm)
            );
          });
        }

        if (!companyToProcess) {
          // Try word-based matching (at least 2 words match)
          const detectedWords = detectedNormalized
            .split(/\s+/)
            .filter((w) => w.length > 2);
          companyToProcess = extractedCompanies.find((c) => {
            const cWords = c.normalizedName
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length > 2);
            const matchingWords = detectedWords.filter((dw) =>
              cWords.some((cw) => cw.includes(dw) || dw.includes(cw))
            );
            return matchingWords.length >= Math.min(2, detectedWords.length);
          });
        }

        if (!companyToProcess) {
          // Use Fuse.js for fuzzy matching as last resort
          const Fuse = (await import("fuse.js")).default;
          const fuse = new Fuse(extractedCompanies, {
            keys: ["normalizedName", "name"],
            threshold: 0.4, // More lenient threshold
            includeScore: true,
          });
          const results = fuse.search(detected.companyName);
          if (results.length > 0 && results[0].score! < 0.4) {
            companyToProcess = results[0].item;
          }
        }

        if (!companyToProcess) {
          continue;
        }

        companiesMatched++;

        // Skip if already processed
        if (processedCompanies.has(companyToProcess.normalizedName)) {
          continue;
        }

        // Limit to 20 companies per user per week per PRD FR-10
        if (processedCompanies.size >= MAX_COMPANIES_PER_USER) {
          console.log(
            `Reached limit of ${MAX_COMPANIES_PER_USER} companies per user`
          );
          break;
        }

        processedCompanies.add(companyToProcess.normalizedName);

        try {
          console.log(
            `Processing ${detected.companyName} - ${detected.eventType}`
          );

          // Analyze homepage if domain exists
          let homepageSummary = "";
          if (companyToProcess.domain) {
            const analysis = await analyzeHomepage(companyToProcess.domain);
            if (analysis) {
              homepageSummary = analysis.summary;
            }
          }

          // Classify industry
          const classifiedIndustry = await classifyIndustry(
            companyToProcess.name,
            homepageSummary
          );

          // Create/get company
          const company = await storage.getOrCreateCompany({
            name: companyToProcess.name,
            domain: companyToProcess.domain || undefined,
            industry: classifiedIndustry,
            logoPlaceholder: classifiedIndustry.toLowerCase().includes("tech")
              ? "tech"
              : classifiedIndustry.toLowerCase().includes("health")
              ? "health"
              : "logistics",
          });

          // Extract executives from article first (fast, from article content)
          let leadership: LeadershipPerson[] = [];

          // Try to extract executives directly from the article
          try {
            const articleText = `${article.title} ${
              article.description || ""
            } ${(article as any).content || ""}`;

            // Only log if verbose mode enabled
            const verbose = process.env.VERBOSE_LOGS === "true";
            if (verbose) {
              console.log(
                `[Executive Extract] Processing article for ${companyToProcess.name}, text length: ${articleText.length}`
              );
            }

            const articleExecutives = await extractExecutivesFromArticle(
              article.title,
              article.description || "",
              (article as any).content
            );

            if (verbose && articleExecutives.length > 0) {
              console.log(
                `[Executive Extract] Extracted ${articleExecutives.length} executives from article for ${companyToProcess.name}`
              );
            }

            // Filter to executives that match the company name (be lenient)
            const matchingExecutives = articleExecutives.filter((exec) => {
              const execCompany = exec.company?.toLowerCase() || "";
              const companyName = companyToProcess.name.toLowerCase();
              const companyWords = companyName
                .split(/\s+/)
                .filter((w) => w.length > 3);

              // Include if:
              // 1. Company matches exactly or partially
              // 2. No company specified (likely from context)
              // 3. At least one significant word matches
              if (!exec.company) {
                return true; // Include if no company specified
              }

              if (
                execCompany.includes(companyName) ||
                companyName.includes(execCompany)
              ) {
                return true;
              }

              // Check if any significant words match
              const execWords = execCompany
                .split(/\s+/)
                .filter((w) => w.length > 3);
              const hasMatchingWord = companyWords.some((cw) =>
                execWords.some((ew) => ew.includes(cw) || cw.includes(ew))
              );

              return hasMatchingWord;
            });

            if (matchingExecutives.length > 0) {
              const verbose = process.env.VERBOSE_LOGS === "true";
              if (verbose) {
                console.log(
                  `[Executive Extract] Found ${matchingExecutives.length} matching executives for ${companyToProcess.name}:`,
                  matchingExecutives.map((e) => `${e.name} (${e.title})`)
                );
              }
              leadership.push(
                ...matchingExecutives.map((exec) => ({
                  name: exec.name,
                  title: exec.title,
                  verified: matchesRoleForLead(exec.title, "any"), // Will be checked later
                  source: "article" as const,
                }))
              );
            }
          } catch (error) {
            console.error(
              `[Executive Extract] Error extracting executives from article:`,
              error
            );
          }

          // Also scrape from company website (The Org API + scraping)
          if (companyToProcess.domain) {
            try {
              const scrapedLeaders = await scrapeLeadership(
                companyToProcess.domain
              );
              // Merge with article executives, deduplicate by name
              const existingNames = new Set(
                leadership.map((l) => l.name.toLowerCase())
              );
              for (const leader of scrapedLeaders) {
                if (!existingNames.has(leader.name.toLowerCase())) {
                  leadership.push(leader);
                }
              }
              console.log(
                `[Leadership] Total ${leadership.length} leadership profiles for ${companyToProcess.name} (${scrapedLeaders.length} from website)`
              );

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
            } catch (error) {
              console.error(
                `Error scraping leadership for ${companyToProcess.domain}:`,
                error
              );
              // Continue even if leadership scraping fails
            }
          }

          // Check if event already exists (deduplication by company + event type + source URL)
          // But only skip if it was created recently (within last 7 days) to allow re-processing older events
          const eventExists = await storage.eventExists(
            company.id,
            detected.eventType,
            article.url
          );
          if (eventExists) {
            // Check if event is recent (created within last 7 days)
            const recentEvent = await storage.getEventByCompanyAndUrl(
              company.id,
              article.url
            );
            if (recentEvent) {
              const eventAge =
                Date.now() -
                new Date(recentEvent.processedAt || recentEvent.date).getTime();
              const sevenDays = 7 * 24 * 60 * 60 * 1000;
              if (eventAge < sevenDays) {
                console.log(
                  `Skipping recent duplicate event: ${company.name} - ${detected.eventType} from ${article.url}`
                );
                continue;
              } else {
                console.log(
                  `Re-processing old event (${Math.round(
                    eventAge / (24 * 60 * 60 * 1000)
                  )} days old): ${company.name} - ${detected.eventType}`
                );
                // Delete old event to create new one with updated data
                await storage.deleteEvent(recentEvent.id);
              }
            } else {
              console.log(
                `Skipping duplicate event: ${company.name} - ${detected.eventType} from ${article.url}`
              );
              continue;
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
            rawArticle: {
              title: article.title,
              description: article.description,
            },
          });

          // Get verified leads for this company to include in conversation starters
          const verifiedLeads = leadership
            .filter((l: LeadershipPerson) => l.verified)
            .slice(0, 2);

          // Generate conversation starters - Per PRD: max 2 total per company (not per role)
          // Include executive names in starters for personalization
          const MAX_STARTERS_PER_COMPANY = 2;
          let totalStarters = 0;

          // Generate starters for each role until we hit the limit
          // Prioritize roles that match verified leads
          const rolesWithLeads = roles.filter((role) =>
            verifiedLeads.some((lead) => matchesRoleForLead(lead.title, role))
          );
          const rolesToProcess = [
            ...rolesWithLeads,
            ...roles.filter((r) => !rolesWithLeads.includes(r)),
          ];

          for (const role of rolesToProcess) {
            if (totalStarters >= MAX_STARTERS_PER_COMPANY) {
              break; // Per PRD: max 2 starters per company
            }

            // Find matching lead for this role
            const matchingLead = verifiedLeads.find((lead) =>
              matchesRoleForLead(lead.title, role)
            );

            try {
              const starters = await generateConversationStarters(
                company.name,
                company.domain || "",
                detected.eventType,
                issues,
                role,
                homepageSummary,
                article.title,
                article.description || "",
                matchingLead
                  ? { name: matchingLead.name, title: matchingLead.title }
                  : undefined
              );

              // Only add starters up to the limit
              const remaining = MAX_STARTERS_PER_COMPANY - totalStarters;
              const startersToAdd = starters.slice(0, remaining);

              for (const starter of startersToAdd) {
                await storage.createConversationStarter({
                  eventId: event.id,
                  role: starter.role,
                  starter: starter.starter,
                });
                totalStarters++;
              }
            } catch (error) {
              console.error(`Error generating starters for ${role}:`, error);
              // Continue with next role
            }
          }
          console.log(
            `Generated ${totalStarters} conversation starters for ${company.name} event (limit: ${MAX_STARTERS_PER_COMPANY}, ${verifiedLeads.length} verified leads)`
          );

          processedEvents.push({
            company: company.name,
            event: detected.eventType,
            industry: classifiedIndustry,
          });
        } catch (error) {
          console.error(
            `Error processing company ${detected.companyName}:`,
            error
          );
          // Continue with next article
        }
      }

      console.log(
        `Processing summary: ${eventsDetected} events detected, ${companiesMatched} companies matched, ${eventsProcessed} events processed`
      );

      res.json({
        success: true,
        processed: processedEvents.length,
        events: processedEvents,
        runtime: Math.round((Date.now() - startTime) / 1000),
        stats: {
          articlesProcessed: articlesToProcess.length,
          eventsDetected,
          companiesMatched,
          eventsProcessed,
        },
      });
    } catch (error) {
      console.error("Intelligence engine error:", error);
      res.status(500).json({
        error: "Intelligence engine failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Update user industry preference
  app.post("/api/user/industry", async (req, res) => {
    try {
      const { userId, industry } = req.body;

      if (!userId || !industry) {
        return res
          .status(400)
          .json({ error: "userId and industry are required" });
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
