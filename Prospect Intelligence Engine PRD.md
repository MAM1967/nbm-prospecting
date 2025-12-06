PRODUCT REQUIREMENTS DOCUMENT (PRD)

Prospect Intelligence Engine — v1 (News-First Architecture)
Version: Final Draft
Owner: Michael / NextBestMove

⸻

1. PRODUCT OVERVIEW

1.1 Purpose

A weekly automated intelligence engine that:
	1.	Scans industry-relevant news
	2.	Detects trigger events
	3.	Identifies companies experiencing change
	4.	Analyzes each company’s website & leadership
	5.	Generates role-specific conversation starters
	6.	Delivers a curated weekly lead list for each user

This is news-driven, not list-driven.

⸻

1.2 Value Proposition

Fractional executives need timely, relevant, personalized signals to drive outbound.

This engine transforms public news into:
✔ fresh leads
✔ contextual insights
✔ role-specific conversation starters
✔ a weekly outbound-ready list

⸻

1.3 Target Users

Premium subscribers who are:
	•	Fractional CMOs
	•	Fractional CFO/COO equivalents
	•	Solo executives who rely on consistent outbound
	•	Users who select an industry vertical from the approved list

⸻

1.4 Success Criteria
	•	Each user receives up to 20 high-relevance events per week
	•	Each event yields human-quality conversation starters
	•	Role verification works via leadership-page scraping
	•	JSON output can feed a weekly email or in-app module
	•	No “stale” or generic suggestions

⸻

2. INDUSTRY SELECTION MODEL (ICP)

2.1 User-Selectable Verticals (v1)

When activating the feature, the user selects ONE:
	1.	Tech, SaaS, B2B software
	2.	Professional services (default)
	3.	E-commerce & DTC brands
	4.	Healthcare & life sciences
	5.	Manufacturing & distribution
	6.	Hospitality & retail
	7.	Nonprofits & mission-driven orgs

This selection determines:
	•	Which news sources to prioritize
	•	Which companies/events count as relevant
	•	How company websites are interpreted
	•	How conversation starters are framed

⸻

3. HIGH-LEVEL FLOW — NEWS-FIRST

News → Event Detection → Company Extraction → Homepage & Leadership Analysis → Industry Match → Issue Mapping → Role Mapping → Conversation Starters → Weekly Digest

This aligns with industry-standard sales intelligence tooling.

⸻

4. FEATURES IN SCOPE (v1)

4.1 Core Features
	•	Weekly cron-driven news ingestion
	•	Event detection (P1 + P2 classes)
	•	Organization identification & deduplication
	•	Homepage semantic summary
	•	Leadership-page extraction (role verification)
	•	Event → issue mapping
	•	Issue → role mapping
	•	Tailored conversation starter generation
	•	Industry-matching per user
	•	Weekly aggregated digest
	•	Logging

⸻

4.2 Out of Scope (v1)
	•	LinkedIn scraping
	•	Contact enrichment (emails, phones)
	•	Website behavioral intelligence
	•	UI dashboards
	•	Custom ICP logical expressions
	•	CRM integration
	•	Scoring or ranking companies
	•	Geo filtering
	•	User uploading custom company lists

⸻

5. FUNCTIONAL REQUIREMENTS

5.1 FR-01: Weekly News Ingestion

The system must:
	•	Pull news from NewsAPI + RSS feeds
	•	Filter by 90-day window
	•	Process up to 2,000 articles per run
	•	Extract company names using NLP or heuristics

⸻

5.2 FR-02: Event Detection

Event types:

P1 (High-importance):
	•	Rebrand
	•	New Executive Hire
	•	Thought Leadership Spike

P2 (Secondary but relevant):
	•	Hiring Surge
	•	M&A
	•	Office Expansion

The classifier uses:
	•	Rule-based keyword detection
	•	LLM fallback

⸻

5.3 FR-03: Company Extraction & Deduplication
	•	Normalize naming variants
	•	Resolve domain if possible
	•	Deduplicate via fuzzy matching

⸻

5.4 FR-04: Industry Matching

Each company must be classified into one of the supported industries.

Tools:
	•	Homepage keyword extraction
	•	LLM classification prompt
	•	Heuristic fallback

Only companies matching the user’s chosen industry are delivered.

⸻

5.5 FR-05: Homepage Interpretation

Extract:
	•	Title
	•	Meta description
	•	H1 / H2
	•	Service keywords
	•	Positioning signals

LLM helps summarize.

⸻

5.6 FR-06: Leadership Verification

Scrape:
	•	/team
	•	/leadership
	•	/about
	•	/people

Extract:
	•	Name
	•	Title
	•	Profile URL

Match target roles:
	•	Head of Marketing
	•	Practice Lead
	•	Chief of Staff
	•	CEO

Return "verified": true where matches exist.

⸻

5.7 FR-07: Issue Mapping

Event → issues (BD alignment, Positioning, Demand Gen, Differentiation, Funnel Performance, Thought Leadership)

⸻

5.8 FR-08: Role Mapping

Issue → roles
Roles limited to v1 scope.

⸻

5.9 FR-09: Conversation Starter Generation

LLM generates max 2 per role.

Requirements:
	•	Human tone
	•	Event-specific
	•	Useful as cold email openers
	•	No fluff

⸻

5.10 FR-10: Weekly Digest

Each user receives:
	•	Up to 20 events
	•	Each event includes:
	•	URLs
	•	Summaries
	•	Issues
	•	Role mappings
	•	Starters
	•	Verified contacts

⸻

6. NON-FUNCTIONAL REQUIREMENTS
	•	Batch job can run up to 30 minutes
	•	LLM calls allowed
	•	Token-secured internal API
	•	No public traffic
	•	Render/Railway recommended

⸻

7. OUTPUT SCHEMA

(Same as previously defined; includes events, issues, roles, starters, verification)

⸻

APPENDICES

⸻

Appendix A — Updated System Architecture Diagram

                           +--------------------------+
                           | Weekly Cron (per user)   |
                           +-----------+--------------+
                                       |
                                       v
                       +-------------------------------+
                       | Ingest All Relevant Industry   |
                       | News of the Week               |
                       +-------------------------------+
                                       |
                                       v
                           +--------------------------+
                           | Event Detection Engine   |
                           | P1/P2 Classification     |
                           +--------------------------+
                                       |
                                       v
                         +------------------------------+
                         | Extract Companies from News  |
                         | Normalize + Deduplicate      |
                         +------------------------------+
                                       |
                                       v
               +---------------------------------------------+
               | Homepage & Leadership Analysis per Company  |
               +---------------------------------------------+
                 |                 |                 |
                 v                 v                 v
       [Homepage Summary]   [Leadership Roles]   [Industry Classification]
                 \                 |                 /
                  \                |                /
                   \               |               /
                    +--------------+--------------+
                                   |
                                   v
                         +---------------------+
                         | Issue Mapping       |
                         +---------------------+
                                   |
                                   v
                         +---------------------+
                         | Role Mapping        |
                         +---------------------+
                                   |
                                   v
                     +------------------------------+
                     | Conversation Starter (LLM)   |
                     +------------------------------+
                                   |
                                   v
                    +-------------------------------+
                    | User Matching by Industry ICP |
                    +-------------------------------+
                                   |
                                   v
                    +-------------------------------+
                    | Weekly Digest per User        |
                    +-------------------------------+


⸻

Understood. Below are clean, polished, document-ready versions of Appendix B and Appendix C, rewritten for inclusion directly into your PRD.

They are structured, consistent, and ready for copy/paste into a formal document.

⸻

APPENDIX B — Module-by-Module Pseudocode 

This appendix describes the internal logic of the news-first Prospect Intelligence Engine. Pseudocode is written at a high level but is explicit enough for engineering implementation.

⸻

B.1 Module Overview

The system consists of the following major modules:
	1.	News Ingestion Engine
	2.	Event Detection Engine
	3.	Company Extraction & Normalization
	4.	Homepage Analysis Module
	5.	Leadership Verification Module
	6.	Industry Classification Module
	7.	Issue Mapping Module
	8.	Role Mapping Module
	9.	Conversation Starter Generator (LLM-powered)
	10.	Response Composer
	11.	User Matching & Digest Builder
	12.	Cron Orchestrator

Each module communicates with the next through structured objects (dicts/classes).

⸻

B.2 News Ingestion Engine

def ingest_industry_news():
    # Pull articles from multiple sources
    articles = []
    articles += newsapi_fetch(max_age_days=7)
    articles += rss_feeds_fetch(industry_sources)
    
    # Normalize: remove empty, malformed, duplicates
    articles = normalize_articles(articles)
    return dedupe_articles(articles)


⸻

B.3 Event Detection Engine

def detect_events(articles):
    event_articles = []

    for article in articles:
        if matches_trigger_keywords(article.title, article.summary):
            event_articles.append(article)
        else:
            # If unclear, use LLM classification
            event_type = classify_event_llm(article)
            if event_type in VALID_EVENT_TYPES:
                article.event_type = event_type
                event_articles.append(article)

    return event_articles


⸻

B.4 Company Extraction & Normalization

def extract_companies_from_events(event_articles):
    companies = {}

    for article in event_articles:
        company_name = extract_company_name(article)
        if not company_name:
            continue

        domain = resolve_company_domain(company_name)
        normalized_name = normalize_company_name(company_name)

        companies[normalized_name] = {
            "name": normalized_name,
            "domain": domain,
            "articles": companies.get(normalized_name, {}).get("articles", []) + [article]
        }

    return companies.values()


⸻

B.5 Homepage Analysis Module

def analyze_homepage(domain):
    html = http_get(f"https://{domain}")
    if not html:
        return None

    doc = parse_html(html)
    return {
        "title": extract_title(doc),
        "meta_description": extract_meta_description(doc),
        "headings": extract_headings(doc, levels=[1, 2]),
        "keywords": extract_keywords(doc)
    }


⸻

B.6 Leadership Verification Module

def extract_leadership(domain):
    potential_urls = find_team_pages(domain)
    leaders = []

    for url in potential_urls:
        html = http_get(url)
        if not html:
            continue

        doc = parse_html(html)
        leaders += parse_people(doc, base_url=url)

    return normalize_leadership_list(leaders)

def verify_roles(leadership_list, roles):
    verified = []

    for role in roles:
        match = fuzzy_match_role(leadership_list, role)
        if match:
            verified.append({
                "role_label": role,
                "name": match["name"],
                "title": match["title"],
                "profile_url": match.get("profile_url"),
                "verified": True
            })

    return verified


⸻

B.7 Industry Classification Module

def classify_industry(homepage_summary, company_name):
    prompt = build_industry_prompt(homepage_summary, company_name)
    result = llm_call(prompt)
    return parse_industry(result)

If classification fails, fallback to keyword heuristics.

⸻

B.8 Issue Mapping Module

def map_issues(event_type):
    ISSUE_MAP = {
        "rebrand": ["Positioning", "Differentiation", "Funnel performance"],
        "new_exec_hire": ["BD alignment", "Positioning", "Thought leadership"],
        "thought_leadership_spike": ["Thought leadership", "Demand Gen", "Differentiation"],
        "hiring_surge": ["Demand Gen", "Funnel performance", "BD alignment"],
        "m_and_a": ["Positioning", "Differentiation", "BD alignment"],
        "office_expansion": ["Demand Gen", "Funnel performance", "BD alignment"]
    }
    return ISSUE_MAP.get(event_type, [])


⸻

B.9 Role Mapping Module

def map_roles(issues):
    ROLE_MAP = {
        "Positioning": ["Head of Marketing", "CEO", "Practice Lead"],
        "Differentiation": ["Head of Marketing", "Practice Lead"],
        "Demand Gen": ["Head of Marketing", "CEO"],
        "Funnel performance": ["Head of Marketing", "CEO"],
        "BD alignment": ["Head of Marketing", "Practice Lead", "Chief of Staff", "CEO"],
        "Thought leadership": ["Head of Marketing", "Practice Lead", "CEO"]
    }

    roles = set()
    for issue in issues:
        roles.update(ROLE_MAP.get(issue, []))

    # Restrict to roles supported in v1
    allowed = {"Head of Marketing", "Practice Lead", "Chief of Staff", "CEO"}
    return [r for r in roles if r in allowed]


⸻

B.10 Conversation Starter Generator

def generate_starters(company, article, issues, roles, homepage_summary):
    starters_by_role = {}

    for role in roles:
        prompt = build_starter_prompt(
            company=company,
            article=article,
            issues=issues,
            role=role,
            homepage_summary=homepage_summary
        )
        llm_output = llm_call(prompt)
        starters = parse_starters(llm_output)
        starters_by_role[role] = starters[:2]  # max 2 per role

    return starters_by_role


⸻

B.11 Response Composer

def compose_company_analysis(company, events):
    summary = summarize_events_llm(company, events)

    return {
        "company": {
            "name": company["name"],
            "domain": company["domain"]
        },
        "events": events,
        "analysis_summary": summary,
        "generated_at": current_timestamp()
    }


⸻

B.12 User Matching & Digest Builder

def build_digest_for_user(user, all_company_results):
    matched = filter_companies_by_industry(all_company_results, user.industry)
    matched = matched[:20]  # v1 cap

    return {
        "user_id": user.id,
        "events": matched,
        "week_of": current_week(),
    }


⸻

B.13 Cron Orchestrator

weekly_cron():
    news = ingest_industry_news()
    events = detect_events(news)
    companies = extract_companies(events)

    analyses = {}
    for company in companies:
        analyses[company.name] = analyze_company(company)

    for user in get_users():
        digest = build_digest_for_user(user, analyses)
        deliver_digest(user, digest)

    log_job_stats()


⸻

APPENDIX C — LLM Prompt Templates 

These are clean, production-ready prompt templates that engineering can implement directly. They are modular and designed to support event classification, industry matching, issue mapping, role mapping, and conversation starter generation.

⸻

C.1 System Prompt (Global)

You are an expert analyst specializing in B2B companies, professional services, 
and fractional executive work. Your job is to:

1. Classify corporate news events.
2. Identify marketing, BD, and organizational issues implied by the event.
3. Determine which internal roles are most affected.
4. Generate human, concise, relevant cold-email conversation starters.
5. Produce strictly formatted JSON as instructed.

Do not invent facts not supported by the input.
Do not produce explanations outside of the JSON schema requested.


⸻

C.2 Event Classification Prompt

INPUT:
Article Title: {{article_title}}
Article Summary: {{article_summary}}
Homepage Summary: {{homepage_summary}}

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
}


⸻

C.3 Industry Classification Prompt

INPUT:
Company Name: {{company_name}}
Homepage Summary: {{homepage_summary}}

TASK:
Determine which industry the company belongs to. Choose ONE from:

1. Tech / SaaS / B2B Software
2. Professional Services (default)
3. E-commerce / DTC Brands
4. Healthcare & Life Sciences
5. Manufacturing & Distribution
6. Hospitality / Retail
7. Nonprofit / Mission-driven Orgs

Return:
{
  "industry": "..."
}


⸻

C.4 Issue Mapping Prompt

INPUT:
Event Type: {{event_type}}

TASK:
Identify 2–4 issues relevant to this event. Choose ONLY from:

- BD alignment
- Positioning
- Demand Gen
- Funnel performance
- Differentiation
- Thought leadership

Return:
{
  "issues": ["...", "..."]
}


⸻

C.5 Role Mapping Prompt

INPUT:
Issues: {{issues}}

TASK:
Map each issue to the roles most affected. Valid roles:

- Head of Marketing
- Practice Lead
- Chief of Staff
- CEO

Return:
{
  "roles": {
      "Positioning": ["Head of Marketing", "CEO"],
      "BD alignment": ["Head of Marketing", "Practice Lead", "Chief of Staff", "CEO"]
  }
}


⸻

C.6 Conversation Starter Generation Prompt

INPUT:
Company: {{company_name}}
Domain: {{company_domain}}
Event Type: {{event_type}}
Issues: {{issues}}
Role: {{target_role}}
Homepage Summary: {{homepage_summary}}
Article:
  Title: {{article_title}}
  Summary: {{article_summary}}

TASK:
Generate 1–2 highly relevant, human-sounding cold-email openers for the {{target_role}}.
Requirements:
- Must reference the actual event.
- Must be concise, credible, and non-generic.
- Should reflect real marketing/BD implications.
- No hype, no fluff, no generic praise.
- Do not mention "fractional".

Return ONLY:
{
  "role": "{{target_role}}",
  "starters": [
      "First line...",
      "Second line..."
  ]
}


⸻

C.7 Summary Prompt

INPUT:
Company: {{company_name}}
Events JSON: {{events_json}}

TASK:
Summarize in 1–3 sentences:
- What is happening at the company.
- What pressures or opportunities these events create.

Return a single string.

⸻

Appendix D — Updated Cron Orchestration Logic

weekly_cron_job():

    # 1. Fetch relevant industry news
    raw_news = fetch_news_for_all_verticals()

    # 2. Filter to events of interest
    event_candidates = []
    for article in raw_news:
        if contains_trigger_event(article):
            event_candidates.append(article)

    # 3. Extract companies from event articles
    companies = extract_unique_companies(event_candidates)

    # 4. Analyze each company
    company_results = {}
    for c in companies:
        result = analyze_company(c)
        company_results[c.name] = result

    # 5. For each user, filter by selected industry
    for user in get_users():
        industry = user.industry_preference
        matched = filter_by_industry(company_results, industry)
        matched = limit(matched, 20)
        
        digest = build_digest(user, matched)
        store_and_send(user, digest)

    log("cron complete")


