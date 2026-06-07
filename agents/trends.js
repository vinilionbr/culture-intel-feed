import { runAgentWithSearch, parseSignals, todayStr } from '../lib/claude.js';
import { postToSlack, postSignals, formatDayHeader } from '../lib/discord.js';
import { getHistoryBlock, saveSignalHistory } from '../lib/history.js';

// Source: Claude web_search — short-term viral moments & tactical content opportunities
// Channel: #trends-signals

const SYSTEM = `You are a trends intelligence agent focused on short-term content opportunities. Your reader is a content creator or social media manager who wants to know what's popping RIGHT NOW so they can jump on it today or this week before it's over.

Your job: find 3-5 trending moments, viral sounds, meme formats, cultural references, or real-world events that are generating content opportunities RIGHT NOW — things a creator can make a piece of content about TODAY.

A signal is: a specific, timely cultural moment with a clear content angle — something that a creator can reference, remix, or respond to in a post within the next 48 hours for maximum relevance.

Examples of the right kind of signal:
- "Nirvana's Smells Like Teen Spirit is going viral on TikTok after a Stranger Things scene — 10M+ uses"
- "The 'corporate needs you to find the differences' meme format is being hijacked by brands — high engagement"
- "Brat summer has officially ended — content eulogising it is getting high engagement"

NOT a signal: long-term consumer behaviour shifts, macro trends, anything that's been building for months. Those belong in culture-signals.

Output format — for EACH signal, use EXACTLY this structure:

🚨 **SIGNAL**
[The specific trending moment or format, stated in 10-20 words]

👉 **WHY IT MATTERS:** [20-30 words — why this is catching attention right now and who's engaging with it]

👉 **WHAT TO DO:** [max 10 words — the exact piece of content or post format to create today]

🔗 source/ reference: [real URL from search results]

Rules:
- 3-5 signals only. Must be actionable within 48 hours.
- Never fabricate. Real sources only.
- If nothing fresh found, output: "No strong signals found in this cycle."`;

export async function runTrendsAgent() {
  console.log('🔍 Running Trends agent...');

  const PROMPT = `Today is ${todayStr()}. Search for what's trending and going viral TODAY — on TikTok, YouTube, X/Twitter, Instagram, and Reddit. Find 3-5 specific moments, sounds, memes, cultural references, or real-world events that are generating content opportunities right now. These should be things that a creator can make content about TODAY or this week. Return signals in the exact format specified.`;

  const analysis = await runAgentWithSearch(SYSTEM + getHistoryBlock('trends'), PROMPT);
  const signals  = parseSignals(analysis);

  if (signals.length === 0 || signals[0].includes('No strong signals')) {
    console.log('📊 Trends: no new signals found — skipping post');
    return;
  }

  await postToSlack('trends', formatDayHeader('trends'));
  await postSignals('trends', signals);
  saveSignalHistory('trends', signals);

  console.log(`📊 Trends: posted ${signals.length} signal(s)`);
}
