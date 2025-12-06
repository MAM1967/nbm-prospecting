import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';

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
  const description = 'Prospect Intelligence Engine - AI-powered sales intelligence platform that monitors news and generates personalized conversation starters';
  
  console.log('🔗 Connecting to GitHub...');
  const octokit = await getUncachableGitHubClient();
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`✅ Authenticated as: ${user.login}`);
  
  let repoExists = false;
  try {
    await octokit.repos.get({
      owner: user.login,
      repo: repoName,
    });
    repoExists = true;
    console.log(`📦 Repository ${repoName} already exists`);
  } catch (error: any) {
    if (error.status === 404) {
      console.log(`📦 Creating repository: ${repoName}...`);
      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description,
        private: false,
        auto_init: false,
      });
      console.log(`✅ Repository created: https://github.com/${user.login}/${repoName}`);
    } else {
      throw error;
    }
  }
  
  const accessToken = await getAccessToken();
  const remoteUrl = `https://${accessToken}@github.com/${user.login}/${repoName}.git`;
  
  console.log('📤 Configuring git remote...');
  try {
    execSync('git remote remove github-origin 2>/dev/null || true', { stdio: 'inherit' });
  } catch {}
  
  execSync(`git remote add github-origin "${remoteUrl}"`, { stdio: 'inherit' });
  
  console.log('📤 Pushing code to GitHub...');
  execSync('git push -u github-origin main --force', { stdio: 'inherit' });
  
  console.log(`\n🎉 Success! Your code is now on GitHub:`);
  console.log(`   https://github.com/${user.login}/${repoName}`);
}

main().catch(console.error);
