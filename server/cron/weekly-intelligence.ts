import cron from "node-cron";
import { storage } from "../storage";
import { fetchIndustryNews, filterRecentArticles } from "../intelligence/news-fetcher";
import { detectEvent } from "../intelligence/event-detector";
import { extractCompaniesFromArticles } from "../intelligence/company-extractor";
import { analyzeHomepage } from "../intelligence/homepage-analyzer";
import { scrapeLeadership } from "../intelligence/leadership-scraper";
import { classifyIndustry } from "../intelligence/industry-classifier";
import { mapIssuesToEvent } from "../intelligence/event-detector";
import { mapIssuesToRoles, generateConversationStarters } from "../intelligence/conversation-generator";
import { buildDigestForUser, storeDigest } from "../intelligence/digest-builder";
import type { Industry } from "../intelligence/industry-classifier";

/**
 * Weekly cron job per PRD Appendix D
 * Runs every Monday at 9 AM
 */
export function setupWeeklyCron() {
  // Run every Monday at 9 AM
  cron.schedule("0 9 * * 1", async () => {
    console.log("Starting weekly intelligence cron job...");
    await runWeeklyIntelligence();
    console.log("Weekly intelligence cron job completed.");
  });

  console.log("Weekly cron job scheduled: Every Monday at 9 AM");
}

/**
 * Main weekly intelligence processing
 * Per PRD Appendix D: weekly_cron_job()
 */
async function runWeeklyIntelligence() {
  try {
    // 1. Fetch relevant industry news for all verticals
    console.log("Fetching news for all industry verticals...");
    const industries: Industry[] = [
      "Tech, SaaS, B2B software",
      "Professional services",
      "E-commerce & DTC brands",
      "Healthcare & life sciences",
      "Manufacturing & distribution",
      "Hospitality & retail",
      "Nonprofits & mission-driven orgs",
    ];

    const allArticles: Array<{ title: string; description: string; url: string; publishedAt: string }> = [];
    
    for (const industry of industries) {
      const articles = await fetchIndustryNews(industry);
      const recent = filterRecentArticles(articles, 90); // 90-day window per PRD
      allArticles.push(...recent);
    }

    console.log(`Fetched ${allArticles.length} articles total`);

    // 2. Filter to events of interest
    console.log("Detecting events...");
    const eventCandidates: Array<{
      article: { title: string; description: string; url: string; publishedAt: string };
      detected: { eventType: string; companyName: string; summary: string };
    }> = [];

    // Process up to 2,000 articles per PRD FR-01
    const articlesToProcess = allArticles.slice(0, 2000);
    
    for (const article of articlesToProcess) {
      const detected = await detectEvent(article.title, article.description);
      if (detected && detected.companyName) {
        eventCandidates.push({
          article,
          detected,
        });
      }
    }

    console.log(`Detected ${eventCandidates.length} events`);

    // 3. Extract companies from event articles
    console.log("Extracting companies...");
    const companies = await extractCompaniesFromArticles(
      eventCandidates.map(e => ({
        title: e.article.title,
        description: e.article.description || "",
        url: e.article.url,
      }))
    );

    console.log(`Extracted ${companies.length} unique companies`);

    // 4. Analyze each company
    console.log("Analyzing companies...");
    const companyResults: Record<string, any> = {};

    for (const company of companies) {
      try {
        // Get or create company in database
        const dbCompany = await storage.getOrCreateCompany({
          name: company.name,
          domain: company.domain || undefined,
          industry: undefined, // Will be classified
        });

        // Analyze homepage if domain exists
        let homepageSummary = "";
        if (company.domain) {
          const analysis = await analyzeHomepage(company.domain);
          if (analysis) {
            homepageSummary = analysis.summary;
            // Update company with homepage summary
            // Note: This would require a storage.updateCompany method
          }
        }

        // Classify industry
        const industry = await classifyIndustry(company.name, homepageSummary);
        // Update company industry in database
        // Note: This would require a storage.updateCompany method

        // Scrape leadership
        const leadership = company.domain
          ? await scrapeLeadership(company.domain)
          : [];

        // Store leadership
        for (const leader of leadership) {
          await storage.createLeadership({
            companyId: dbCompany.id,
            name: leader.name,
            title: leader.title,
            verified: leader.verified ? 1 : 0,
            profileUrl: leader.profileUrl,
          });
        }

        companyResults[company.name] = {
          company: dbCompany,
          industry,
          homepageSummary,
          leadership,
        };
      } catch (error) {
        console.error(`Error analyzing company ${company.name}:`, error);
      }
    }

    // 5. Create events and generate conversation starters
    console.log("Creating events and generating starters...");
    for (const eventCandidate of eventCandidates) {
      const companyName = eventCandidate.detected.companyName;
      const companyData = companyResults[companyName];

      if (!companyData) continue;

      const company = companyData.company;
      const issues = mapIssuesToEvent(eventCandidate.detected.eventType as any);
      const roles = mapIssuesToRoles(issues);

      // Create event
      const event = await storage.createEvent({
        companyId: company.id,
        eventType: eventCandidate.detected.eventType,
        date: new Date(eventCandidate.article.publishedAt),
        summary: eventCandidate.detected.summary,
        sourceUrl: eventCandidate.article.url,
        issues,
        impactScore: 50, // Default, could be calculated
        rawArticle: {
          title: eventCandidate.article.title,
          description: eventCandidate.article.description,
        },
      });

      // Generate conversation starters for each role
      for (const role of roles) {
        const starters = await generateConversationStarters(
          company.name,
          company.domain || "",
          eventCandidate.detected.eventType,
          issues,
          role,
          companyData.homepageSummary,
          eventCandidate.article.title,
          eventCandidate.article.description || ""
        );

        for (const starter of starters) {
          await storage.createConversationStarter({
            eventId: event.id,
            role: starter.role,
            starter: starter.starter,
          });
        }
      }
    }

    // 6. For each user, filter by selected industry and build digest
    console.log("Building digests for users...");
    const users = await storage.getAllUsers();

    for (const user of users) {
      if (!user.selectedIndustry) {
        console.log(`Skipping user ${user.id}: no industry selected`);
        continue;
      }

      try {
        const digest = await buildDigestForUser(user.id, user.selectedIndustry as Industry);
        await storeDigest(digest);
        console.log(`Digest created for user ${user.id}: ${digest.events.length} events`);
      } catch (error) {
        console.error(`Error building digest for user ${user.id}:`, error);
      }
    }

    console.log("Weekly intelligence processing complete");
  } catch (error) {
    console.error("Error in weekly intelligence cron:", error);
    throw error;
  }
}

