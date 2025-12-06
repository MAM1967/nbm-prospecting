import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function main() {
  const repoName = 'nbm-prospecting';
  const workDir = '/tmp/nbm-export';
  const sourceDir = process.cwd();
  
  console.log('🔗 Connecting to GitHub...');
  const octokit = await getUncachableGitHubClient();
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`✅ Authenticated as: ${user.login}`);
  
  console.log('📁 Preparing export directory...');
  execSync(`rm -rf ${workDir}`, { stdio: 'inherit' });
  execSync(`mkdir -p ${workDir}`, { stdio: 'inherit' });
  
  const filesToCopy = [
    'client',
    'server', 
    'shared',
    'scripts',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'tailwind.config.ts',
    'postcss.config.js',
    'drizzle.config.ts',
    'components.json',
    'replit.md',
    '.local/state/memory/persisted_information.md',
  ];
  
  for (const item of filesToCopy) {
    const src = path.join(sourceDir, item);
    const dest = path.join(workDir, item);
    if (fs.existsSync(src)) {
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      execSync(`cp -r "${src}" "${dest}"`, { stdio: 'inherit' });
      console.log(`  ✓ ${item}`);
    }
  }
  
  const readme = `# NBM Prospecting - Prospect Intelligence Engine

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
2. Install dependencies: \`npm install\`
3. Set up PostgreSQL database
4. Add your OpenAI API key to environment variables
5. Run the development server: \`npm run dev\`

## Environment Variables

- \`DATABASE_URL\`: PostgreSQL connection string
- \`OPENAI_API_KEY\`: OpenAI API key for GPT integration

## Project Structure

\`\`\`
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
\`\`\`

## License

MIT
`;
  
  fs.writeFileSync(path.join(workDir, 'README.md'), readme);
  console.log('  ✓ README.md');
  
  const gitignore = `node_modules
.env
.env.local
*.log
dist
.DS_Store
`;
  fs.writeFileSync(path.join(workDir, '.gitignore'), gitignore);
  console.log('  ✓ .gitignore');
  
  console.log('\n📤 Initializing git and pushing...');
  const accessToken = await getAccessToken();
  const remoteUrl = `https://${accessToken}@github.com/${user.login}/${repoName}.git`;
  
  execSync(`cd ${workDir} && git init`, { stdio: 'inherit' });
  execSync(`cd ${workDir} && git config user.email "replit@users.noreply.github.com"`, { stdio: 'inherit' });
  execSync(`cd ${workDir} && git config user.name "Replit Agent"`, { stdio: 'inherit' });
  execSync(`cd ${workDir} && git add -A`, { stdio: 'inherit' });
  execSync(`cd ${workDir} && git commit -m "Initial commit: Prospect Intelligence Engine"`, { stdio: 'inherit' });
  execSync(`cd ${workDir} && git branch -M main`, { stdio: 'inherit' });
  execSync(`cd ${workDir} && git remote add origin "${remoteUrl}"`, { stdio: 'inherit' });
  execSync(`cd ${workDir} && git push -u origin main --force`, { stdio: 'inherit' });
  
  console.log(`\n🎉 Success! Your code is now on GitHub:`);
  console.log(`   https://github.com/${user.login}/${repoName}`);
  
  execSync(`rm -rf ${workDir}`, { stdio: 'inherit' });
}

main().catch(console.error);
