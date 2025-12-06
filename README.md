# NBM Prospecting - Prospect Intelligence Engine

An AI-powered sales intelligence platform that monitors news and generates personalized conversation starters for prospecting.

## Features

- **News Intelligence**: Fetches and processes tech news from RSS feeds (TechCrunch, The Verge, ArsTechnica)
- **Event Detection**: AI-powered detection of key business events (rebrands, executive hires, M&A, etc.)
- **Conversation Starters**: GPT-generated personalized outreach messages based on detected events
- **Executive Dashboard**: Clean, modern UI showing prioritized intelligence signals

## Tech Stack

- **Frontend**: React, TailwindCSS, Shadcn/UI, TanStack Query
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT for event analysis and conversation generation

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up PostgreSQL database
4. Create a `.env` file in the root directory with required environment variables
5. Run the development server: `npm run dev`

## Environment Variables

Create a `.env` file in the root directory:

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/nbm_prospecting
OPENAI_API_KEY=your_openai_api_key_here

# Optional
NEWSAPI_KEY=your_newsapi_key_here  # Will skip NewsAPI if not set
PORT=5000  # Defaults to 5000
```

### Setting up PostgreSQL

You can use a local PostgreSQL instance or a cloud service like:
- [Supabase](https://supabase.com) (free tier available)
- [Neon](https://neon.tech) (free tier available)
- [Railway](https://railway.app) (free tier available)

After setting up your database, run the migration:
```bash
npm run db:push
```

## Project Structure

```
├── client/           # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   └── lib/         # Utilities
├── server/           # Express backend
│   ├── intelligence/    # AI processing modules
│   └── routes.ts        # API endpoints
├── shared/           # Shared types and schemas
└── scripts/          # Utility scripts
```

## License

MIT
