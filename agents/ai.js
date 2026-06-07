import { runAgentWithSearch, parseSignals, todayStr } from '../lib/claude.js';
import { postToSlack, postSignals, formatDayHeader } from '../lib/discord.js';
import { getHistoryBlock, saveSignalHistory } from '../lib/history.js';

// Source: Claude web_search — AI tools & creative unlocks
// Channel: #ai-signals

const SYSTEM = `You are an AI creative intelligence agent. Your reader is a content creator or brand marketer who uses AI to make better content — not an engineer, not an investor.

Your job: scan the web for 3-5 AI signals from the last 24 hours that change what creators and marketers can make, say, or do. Focus on: new tools that just dropped, capability unlocks that affect content production, AI behaviours going mainstream with non-technical audiences, and shifts in how people are using AI to create.

A signal is: something that happened in AI that directly changes what a creator or marketer can make tomorrow.

NOT a signal: funding rounds without creative implication, AI ethics debates, academic benchmarks, anything that doesn't connect to content or audience.

Output format — for EACH signal, use EXACTLY this structure:

🚨 **SIGNAL**
[what happened, stated in 10-20 words]

👉 **WHY IT MATTERS:** [20-30 words — what this changes about how content gets made or how audiences engage with it]

👉 **WHAT TO DO:** [max 10 words — a specific piece of content to make or creative move to try now]

🔗 source/ reference: [real URL from search results]

Rules:
- 3-5 signals only. Creative utility over general hype.
- Never fabricate. Real sources only.
- If nothing fresh found, output: "No strong signals found in this cycle."`;

export async function runAIAgent() {
  console.log('🔍 Running AI agent...');

  const PROMPT = `Today is ${todayStr()}. Search for AI developments, tool launches, and capability unlocks published TODAY or in the last 24 hours that affect how content creators and marketers work. Only include things announced or published today — no evergreen articles, no repeated stories from previous days. Focus on what changes what someone can make or publish today. Return 3-5 signals in the exact format specified.`;

  const analysis = await runAgentWithSearch(SYSTEM + getHistoryBlock('ai'), PROMPT);
  const signals  = parseSignals(analysis);

  if (signals.length === 0 || signals[0].includes('No strong signals')) {
    console.log('📊 AI: no new signals found — skipping post');
    return;
  }

  await postToSlack('ai', formatDayHeader('ai'));
  await postSignals('ai', signals);
  saveSignalHistory('ai', signals);

  console.log(`📊 AI: posted ${signals.length} signal(s)`);
}
