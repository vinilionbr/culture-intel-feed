import dotenv from 'dotenv';
dotenv.config({ override: true });
import { runSocialAgent }  from './agents/social.js';
import { runCultureAgent } from './agents/culture.js';
import { runTrendsAgent }  from './agents/trends.js';
import { runAIAgent }      from './agents/ai.js';
import { runWeb3Agent }    from './agents/web3.js';

// ─── Channel registry ────────────────────────────────────────────────────────
// Every channel SCOUT knows how to run.
const REGISTRY = {
  social:  runSocialAgent,
  culture: runCultureAgent,
  trends:  runTrendsAgent,
  ai:      runAIAgent,
  web3:    runWeb3Agent,
};

// ─── MANAGE YOUR CHANNELS HERE ───────────────────────────────────────────────
// This is the one line to edit. Remove a channel to stop tracking it,
// re-add it to bring it back. (To add a brand-new beat, ask Claude to
// create the agent, then add its key here.)
const ENABLED = ['social', 'culture', 'trends', 'ai', 'web3'];

const AGENTS = Object.fromEntries(
  ENABLED.filter(k => REGISTRY[k]).map(k => [k, REGISTRY[k]])
);

const AGENT_GAP_MS = 70_000; // 70s between agents — keeps each run inside its own TPM window

async function runAll() {
  console.log(`\n🚀 SCOUT — ${new Date().toISOString()}\n`);
  const entries = Object.entries(AGENTS);
  let failed = 0;
  for (let i = 0; i < entries.length; i++) {
    const [name, agent] = entries[i];
    try {
      await agent();
    } catch (err) {
      failed++;
      console.error(`❌ ${name} agent failed:`, err.message);
    }
    if (i < entries.length - 1) {
      console.log(`⏳ Waiting ${AGENT_GAP_MS / 1000}s before next agent...\n`);
      await new Promise(r => setTimeout(r, AGENT_GAP_MS));
    }
  }
  console.log(`\n✅ Refresh complete. (${entries.length - failed}/${entries.length} channels succeeded)\n`);

  // If every agent failed, this is an outage — exit non-zero so a manual
  // GitHub run goes RED instead of silently green.
  if (failed === entries.length) {
    console.error('💥 Every channel failed — flagging the run as failed.');
    process.exitCode = 1;
  }
}

// ─── On-demand entry point ───────────────────────────────────────────────────
// SCOUT is pull-based now: it runs when you ask it to, not on a schedule.
//   node index.js               → refresh all enabled channels
//   node index.js --channel ai  → refresh a single channel
const args = process.argv.slice(2);
const channelIdx = args.indexOf('--channel');

if (channelIdx !== -1) {
  const channel = args[channelIdx + 1];
  const agent = AGENTS[channel];
  if (!agent) {
    console.error(`Unknown or disabled channel: "${channel}". Enabled: ${Object.keys(AGENTS).join(', ')}`);
    process.exit(1);
  }
  agent().catch(err => { console.error(err.message); process.exit(1); });
} else {
  runAll().catch(err => { console.error(err.message); process.exit(1); });
}
