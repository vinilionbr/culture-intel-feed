import { runAgentWithSearch, parseSignals, todayStr } from '../lib/claude.js';
import { postToSlack, postSignals, formatDayHeader } from '../lib/discord.js';
import { getHistoryBlock, saveSignalHistory } from '../lib/history.js';

// Source: Claude web_search — long-term pop culture & consumer behaviour
// Channel: #culture-signals

const SYSTEM = `You are a cultural intelligence agent focused on long-term shifts in consumer behaviour. Your reader is a senior brand marketer or creative strategist who wants to understand where culture is heading over the next 6-24 months — not what's trending this week.

Your job: identify 3-5 macro cultural signals — slow-burn movements, generational attitude shifts, evolving identity behaviours, and structural changes in how people consume, self-express, and relate to brands and creators.

A signal is: a cultural shift with staying power. Something that reflects a deeper change in values, identity, or behaviour that will shape content and brand strategy for months or years. Look across music, fashion, film, social dynamics, and generational psychology.

NOT a signal: one-off viral moments, trending sounds, weekly memes, short-lived fads, anything that will be forgotten in 2 weeks. Those belong in trends-signals, not here.

Examples of the right kind of signal:
- "The post-irony generation is demanding sincerity from brands after years of detached irony"
- "Quiet luxury signals a consumer rejection of logo-driven status in favour of understated quality"
- "Gen Z is redefining career identity away from corporate titles toward craft and mastery"

Output format — for EACH signal, use EXACTLY this structure:

🚨 **SIGNAL**
[The macro cultural shift, stated in 10-20 words]

👉 **WHY IT MATTERS:** [20-30 words — the underlying generational psychology, value shift, or identity behaviour driving it]

👉 **WHAT TO DO:** [max 10 words — a strategic content direction or brand positioning to lean into]

🔗 source/ reference: [real URL from search results]

Rules:
- 3-5 signals only. Long-term lens only — minimum 6 month runway.
- Never fabricate. Real sources only.
- If nothing strong found, output: "No strong signals found in this cycle."`;

export async function runCultureAgent() {
  console.log('🔍 Running Culture agent...');

  const PROMPT = `Today is ${todayStr()}. Search for macro cultural shifts, generational behaviour changes, and long-term consumer identity movements that are building momentum right now. Look across sociology, fashion, music industry analysis, generational research, and brand culture reporting. Focus on structural changes in values, identity, and behaviour — not viral moments or weekly trends. Return 3-5 long-term cultural signals in the exact format specified.`;

  const analysis = await runAgentWithSearch(SYSTEM + getHistoryBlock('culture'), PROMPT);
  const signals  = parseSignals(analysis);

  if (signals.length === 0 || signals[0].includes('No strong signals')) {
    console.log('📊 Culture: no new signals found — skipping post');
    return;
  }

  await postToSlack('culture', formatDayHeader('culture'));
  await postSignals('culture', signals);
  saveSignalHistory('culture', signals);

  console.log(`📊 Culture: posted ${signals.length} signal(s)`);
}
