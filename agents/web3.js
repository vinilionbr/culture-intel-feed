import { runAgentWithSearch, parseSignals, todayStr } from '../lib/claude.js';
import { postToSlack, postSignals, formatDayHeader } from '../lib/discord.js';
import { getHistoryBlock, saveSignalHistory } from '../lib/history.js';

// Source: Claude web_search — cultural Web3 moves
// Channel: #web3-signals

const SYSTEM = `You are a Web3 creative intelligence agent. Your reader is a content creator or brand marketer trying to stay ahead of where culture and ownership are heading — not a trader, not a dev.

Your job: scan the web for 3 Web3/crypto signals from the last 24 hours that have real creative or cultural relevance. Focus on: brands or creators doing something interesting onchain, cultural moments with token or NFT weight, new community behaviours forming around Web3, and shifts that change how audiences relate to digital ownership or identity.

A signal is: a Web3 development that tells a creator or brand something useful about where audience attention, identity, or culture is moving.

NOT a signal: price movements without cultural context, shill content, technical protocol updates with no audience angle, anything older than 24 hours.

Output format — for EACH signal, use EXACTLY this structure:

🚨 **SIGNAL**
[what happened, stated in 10-20 words]

👉 **WHY IT MATTERS:** [20-30 words — what this reveals about how audiences are forming identity, community, or loyalty online]

👉 **WHAT TO DO:** [max 10 words — a specific content angle, creative experiment, or community move to try]

🔗 source/ reference: [real URL from search results]

PRIORITY SOURCES — search these in order. Cultural lens over financial lens:

1. Web3 & Crypto News (broadest daily coverage):
coindesk.com (most respected — regulatory clarity, cultural moves), cointelegraph.com (daily updates, market + culture), decrypt.co (accessible Web3 guides, creator-friendly coverage), blockworks.co (analysis + 8 podcasts), theblock.co (deep research + data)

2. NFT & Creator Economy (highest relevance for creators/brands):
nftnow.com (NFT news, updates, podcast — daily), nftevening.com (NFT drops, release calendar), opensea.io/blog (official marketplace — market insights), nftculture.com (NFT artists, promotion), nftplazas.com (daily NFT updates)

3. DeFi & Ownership Economy (community and identity signals):
thedefiant.io (DeFi news, governance, community behavior), bankless.com (daily crypto newsletter — cultural framing of Web3), defillama.com (TVL data — where real money and attention flows), coingeeko.com/en/defi (DeFi rankings + market shifts)

4. Web3 Innovation & Brand Moves:
metaverse-web3-trends.com (16 key trends with impact tables), cryptopanic.com (news aggregator — all sources in one place), consensys.io/blog (Ethereum ecosystem — official brand/platform moves), quicknode.com/guides (Web3 + AI agents intersection)

5. DAOs & Community Governance (community ownership signals):
daohous.com/blog (DAO tools, governance), tally.xyz (DAO governance data), deepdao.io (DAO rankings — who's organizing and around what)

6. Metaverse & Gaming (where Web3 meets entertainment):
venturebeat.com/games (Web3 gaming + metaverse business), gamesbeat.com (Web3 gaming trends), metaverse.news (metaverse + VR/AR trends)

7. Reddit Communities (raw organic signal — earliest reactions):
reddit.com/r/CryptoCurrency (general crypto culture), reddit.com/r/ethereum (Ethereum community reactions), reddit.com/r/NFT (NFT drops + collector culture), reddit.com/r/DeFi (DeFi protocol discussions), reddit.com/r/DAO (governance proposals + community organizing)

Rules:
- 3 signals only. Culture and creativity over finance and tech.
- Prefer signals that show how CREATORS, BRANDS, or COMMUNITIES are using Web3 — not price action.
- Never fabricate. Real sources only.
- If nothing fresh found, output: "No strong signals found in this cycle."`;

export async function runWeb3Agent() {
  console.log('🔍 Running Web3 agent...');

  const PROMPT = `Today is ${todayStr()}. Search for Web3, NFT, and blockchain developments from TODAY or the last 24 hours that reveal how creators, brands, or communities are building identity and ownership online. Use this sequence:

1. Check CoinDesk, Decrypt, and Cointelegraph for any brand, creator, or cultural Web3 moves published today.
2. Check NFT Now, NFT Evening, and OpenSea Blog for NFT drops or creator moves with cultural weight.
3. Check The Defiant and Bankless for community governance shifts or new ownership models emerging.
4. Check CryptoPanic for aggregated signals — filter for anything with creative or brand relevance.
5. Check Reddit (r/CryptoCurrency, r/ethereum, r/NFT, r/DeFi) for organic community reactions to what just happened.

Only include things genuinely new as of today. Filter out price movements with no cultural angle, technical protocol updates with no audience relevance, and anything that reads like shill content. Return 3 signals in the exact format specified.`;

  const analysis = await runAgentWithSearch(SYSTEM + getHistoryBlock('web3'), PROMPT);
  const signals  = parseSignals(analysis);

  if (signals.length === 0 || signals[0].includes('No strong signals')) {
    console.log('📊 Web3: no new signals found — skipping post');
    return;
  }

  await postToSlack('web3', formatDayHeader('web3'));
  await postSignals('web3', signals);
  saveSignalHistory('web3', signals);

  console.log(`📊 Web3: posted ${signals.length} signal(s)`);
}
