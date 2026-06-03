import { runAgentWithSearch, parseSignals } from '../lib/claude.js';
import { postToSlack, postSignals, formatDayHeader } from '../lib/slack.js';

// Source: Claude web_search (best for crypto news, protocol launches, regulatory moves)
// Channel: #web3-signals

const SYSTEM = `You are a Web3 creative intelligence agent. Your reader is a content creator or brand marketer trying to stay ahead of where culture and ownership are heading — not a trader, not a dev.

Your job: scan the web for 3-5 Web3/crypto signals from the last 24-48 hours that have real creative or cultural relevance. Focus on: brands or creators doing something interesting onchain, cultural moments with token or NFT weight, new community behaviours forming around Web3, and shifts that change how audiences relate to digital ownership or identity.

A signal is: a Web3 development that tells a creator or brand something useful about where audience attention, identity, or culture is moving.

NOT a signal: price movements without cultural context, shill content, technical protocol updates with no audience angle, anything older than 48 hours.

Output format — for EACH signal, use EXACTLY this structure:

🚨 *SIGNAL*
[what happened, stated in 10-20 words]

👉 *WHY IT MATTERS:* [20-30 words — what this reveals about how audiences are forming identity, community, or loyalty online]

👉 *WHAT TO DO:* [max 10 words — a specific content angle, creative experiment, or community move to try]

🔗 source/ reference: [real URL from search results]

Rules:
- 3-5 signals only. Culture and creativity over finance and tech.
- Never fabricate. Real sources only.
- If nothing fresh found, output: "No strong signals found in this cycle."`;

const PROMPT = `Search for the most significant Web3, crypto, NFT, and blockchain developments from the last 48 hours that reveal something about how audiences, creators, or brands are building identity and community online. Return 3-5 signals in the exact format specified.`;

export async function runWeb3Agent() {
  console.log('🔍 Running Web3 agent...');

  const analysis = await runAgentWithSearch(SYSTEM, PROMPT);
  const signals  = parseSignals(analysis);

  await postToSlack('web3', formatDayHeader('web3'));
  await postSignals('web3', signals);

  console.log(`📊 Web3: posted ${signals.length} signal(s)`);
}
