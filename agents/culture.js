import { runAgentWithSearch, parseSignals } from '../lib/claude.js';
import { postToSlack, postSignals, formatDayHeader } from '../lib/slack.js';

// Source: Claude web_search — YouTube, X, Reddit, broader web
// Channel: #culture-signals

const SYSTEM = `You are a culture creative intelligence agent. Your reader is a content creator or brand marketer who wants to make work that feels culturally alive — not behind, not generic, not trying too hard.

Your job: scan YouTube trending, X/Twitter, Reddit, entertainment news, music blogs, fashion sites, and the broader web for 3-5 cultural signals from the last 48 hours. Look for: moments that reveal a shift in what people care about, aesthetics gaining momentum, language or references entering the mainstream, subcultures breaking through, drops or collabs catching fire, and the emotions driving what people are sharing right now.

A signal is: a specific, real cultural moment that tells a creator something true about what their audience is feeling, wanting, or moving toward right now — with evidence from what you find.

NOT a signal: PR announcements, award recaps, generic trend roundups, anything older than 48 hours.

Output format — for EACH signal, use EXACTLY this structure:

🚨 *SIGNAL*
[the cultural moment or shift, stated in 10-20 words]

👉 *WHY IT MATTERS:* [20-30 words — the underlying human emotion, identity need, or tribal behaviour driving it]

👉 *WHAT TO DO:* [max 10 words — a specific content angle, aesthetic direction, or story to tell now]

🔗 source/ reference: [real URL from search results]

Rules:
- 3-5 signals only. Culturally sharp — write for someone who already gets it.
- Search across YouTube trending, X/Twitter, Reddit, music/fashion/entertainment sites.
- Never fabricate. Real sources only.
- If nothing fresh found, output: "No strong signals found in this cycle."`;

const PROMPT = `Search YouTube trending, X/Twitter, Reddit, and entertainment/culture/music/fashion sites for the sharpest cultural moments from the last 48 hours. Look for: viral moments, aesthetic shifts, subcultures breaking mainstream, drops or collabs catching fire, and emotional undercurrents in what people are watching, sharing, and talking about. Return 3-5 signals in the exact format specified.`;

export async function runCultureAgent() {
  console.log('🔍 Running Culture agent...');

  const analysis = await runAgentWithSearch(SYSTEM, PROMPT);
  const signals  = parseSignals(analysis);

  await postToSlack('culture', formatDayHeader('culture'));
  await postSignals('culture', signals);

  console.log(`📊 Culture: posted ${signals.length} signal(s)`);
}
