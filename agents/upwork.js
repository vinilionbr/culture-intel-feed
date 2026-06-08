import { runActor } from '../lib/apify.js';
import { analyzeScrapedData, parseSignals } from '../lib/claude.js';
import { postToSlack, postSignals } from '../lib/discord.js';

// Source: Apify Upwork scraper
// Channel: #upwork-gigs

const SYSTEM = `You are a freelance gig scout for marketers. Your reader is a marketing professional looking for well-paid Upwork gigs — not the $5 stuff, the real projects.

From the Upwork job data provided, extract the 5 best gigs for marketers. Judge quality by: budget size, client rating and history, project scope, and whether it's actually a marketing role (not design or dev disguised as marketing).

For each gig, use EXACTLY this format:

🎯 **[Gig Title]**
💰 [Budget or hourly rate] | ⭐ Client rating: [rating if available]
[1 sentence — what the project actually involves and why it's worth bidding on]
🔗 Apply: [URL]

Rules:
- 5 gigs only. Best ones — filter out low-budget, low-rated, or vague listings.
- Marketing roles only: strategy, content, social, SEO, ads, email, brand, growth, copywriting.
- No dev, design-only, or data entry gigs.
- Never fabricate. Only use what's in the data.
- If data is empty or no quality marketing gigs found, output: "No strong gigs found in this cycle."`;

export async function runUpworkAgent() {
  console.log('🔍 Running Upwork agent...');

  // Actor: neatrat/upwork-job-scraper — 4,363 users, 99.5% success rate
  // maxJobAge limits to last 24h so we only get fresh listings
  const searchQueries = [
    'marketing strategy',
    'content marketing',
    'social media manager',
    'copywriter',
    'email marketing',
  ];

  const results = await Promise.allSettled(
    searchQueries.map(q =>
      runActor(
        'neatrat/upwork-job-scraper',
        {
          query:           q,
          sort:            'newest',
          paymentVerified: true,
          maxJobAge:       { value: 24, unit: 'hours' },
          pagesToScrape:   1,
          perPage:         10,
        },
        { limit: 10, timeout: 120 }
      )
    )
  );

  const gigs = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(Boolean);

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    console.warn(`⚠️  ${failed.length}/${results.length} Upwork queries failed:`, failed[0].reason?.message);
  }

  if (gigs.length === 0) {
    console.warn('⚠️  Upwork: no gigs returned — skipping post');
    return;
  }

  console.log(`🔎 Upwork: ${gigs.length} raw gigs fetched — analysing...`);

  const analysis = await analyzeScrapedData(SYSTEM, { gigs });
  const signals  = parseUpworkGigs(analysis);

  if (signals.length === 0 || signals[0].includes('No strong gigs')) {
    console.log('📊 Upwork: no quality marketing gigs found — skipping post');
    return;
  }

  await postToSlack('upwork', formatUpworkHeader());
  await postSignals('upwork', signals);

  console.log(`📊 Upwork: posted ${signals.length} gig(s)`);
}

function parseUpworkGigs(text) {
  if (!text?.trim()) return [];
  const byGig = text
    .split(/(?=🎯)/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.startsWith('🎯'));
  if (byGig.length > 0) return byGig;
  return [text.trim()];
}

function formatUpworkHeader() {
  const date = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: process.env.TIMEZONE || 'Australia/Brisbane',
  });
  return `🎯 **UPWORK MARKETING GIGS — ${date}**\n${'─'.repeat(48)}`;
}
