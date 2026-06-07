import { runAgentWithSearch, parseSignals, todayStr } from '../lib/claude.js';
import { postToSlack, postSignals, formatDayHeader } from '../lib/discord.js';
import { getHistoryBlock, saveSignalHistory } from '../lib/history.js';

// Source: Claude web_search — remote marketing job boards
// Channel: #remote-jobs

const SYSTEM = `You are a remote marketing jobs scout. Your reader is a marketing professional at any level — from entry-level to CMO — who wants fully remote roles and is tired of job boards clogged with dev jobs.

Your job: find 5 fully remote marketing job openings posted or updated in the last 48 hours. Search LinkedIn, Indeed, Remote.co, We Work Remotely, Remotive, Wellfound, and company career pages.

Include all levels (entry, mid, senior, lead, director, VP, CMO) and all marketing disciplines — brand, content, social media, performance, growth, creative, copywriting, email, SEO, paid media, influencer, PR, strategy, product marketing, and more.

Only include roles that are:
- Explicitly fully remote (not hybrid, not "remote-friendly")
- In a marketing or creative discipline
- At companies that actually exist and have a real job posting

For each role, use EXACTLY this format:

💼 **[Job Title] — [Company]**
📍 Fully Remote | [Salary range if listed, otherwise omit]
[1 sentence — what makes this role or company worth a look]
🔗 Apply: [direct URL to the job posting]

Rules:
- 5 roles only.
- No dev, engineering, or technical roles.
- No "remote-friendly" or hybrid — fully remote only.
- Never fabricate a job posting. Real listings only.
- If fewer than 5 real remote marketing roles found, list only what's real.`;

export async function runJobsAgent() {
  console.log('🔍 Running Jobs agent...');

  const PROMPT = `Today is ${todayStr()}. Search for fully remote marketing job openings posted in the last 48 hours. Look across LinkedIn, Indeed, Remote.co, We Work Remotely, Remotive, and Wellfound. Find 5 real openings across all levels (entry to CMO) and all marketing disciplines. Fully remote only, no hybrid. Only listings posted today or yesterday. Return in the exact format specified.`;

  const raw     = await runAgentWithSearch(SYSTEM + getHistoryBlock('jobs'), PROMPT);
  const signals = parseJobs(raw);

  if (signals.length === 0) {
    console.log('📊 Jobs: no new roles found — skipping post');
    return;
  }

  await postToSlack('jobs', formatJobsHeader());
  await postSignals('jobs', signals);
  saveSignalHistory('jobs', signals);

  console.log(`📊 Jobs: posted ${signals.length} role(s)`);
}

function parseJobs(text) {
  if (!text?.trim()) return [];
  const byRole = text
    .split(/(?=💼)/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.startsWith('💼'));
  if (byRole.length > 0) return byRole;
  return [text.trim()];
}

function formatJobsHeader() {
  const date = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: process.env.TIMEZONE || 'Australia/Brisbane',
  });
  return `💼 **REMOTE MARKETING JOBS — ${date}**\n${'─'.repeat(48)}`;
}
