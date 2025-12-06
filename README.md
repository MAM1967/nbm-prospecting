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
4. Add your OpenAI API key to environment variables
5. Run the development server: `npm run dev`

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key for GPT integration

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
