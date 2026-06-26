import cron from 'node-cron';
import dotenv from 'dotenv';
dotenv.config({ override: true });
import { runSocialAgent }  from './agents/social.js';
import { runCultureAgent } from './agents/culture.js';
import { runTrendsAgent }  from './agents/trends.js';
import { runAIAgent }      from './agents/ai.js';
import { runWeb3Agent }    from './agents/web3.js';

const AGENTS = {
  social:  runSocialAgent,
  culture: runCultureAgent,
  trends:  runTrendsAgent,
  ai:      runAIAgent,
  web3:    runWeb3Agent,
};

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
  console.log(`\n✅ All agents complete. (${entries.length - failed}/${entries.length} succeeded)\n`);

  // If every agent failed, this is an outage (e.g. API/connection down) —
  // exit non-zero so the GitHub Actions run goes RED instead of silently green.
  if (failed === entries.length) {
    console.error('💥 Every agent failed — flagging the run as failed.');
    process.exitCode = 1;
  }
}

const args = process.argv.slice(2);
const channelIdx = args.indexOf('--channel');
const runNow = args.includes('--now');

if (channelIdx !== -1) {
  const channel = args[channelIdx + 1];
  const agent = AGENTS[channel];
  if (!agent) {
    console.error(`Unknown channel: "${channel}". Valid options: ${Object.keys(AGENTS).join(', ')}`);
    process.exit(1);
  }
  agent().catch(err => { console.error(err.message); process.exit(1); });
} else if (runNow) {
  runAll().catch(err => { console.error(err.message); process.exit(1); });
} else {
  const schedule = process.env.CRON_SCHEDULE || '0 21 * * *';
  const tz = process.env.TIMEZONE || 'Australia/Brisbane';
  console.log(`⏰ Scheduler active — cron: ${schedule} (${tz})`);
  cron.schedule(schedule, runAll, { timezone: tz });
  runAll();
}
