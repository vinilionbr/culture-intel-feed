import dotenv from 'dotenv';
dotenv.config({ override: true });

const WEBHOOKS = {
  social:  process.env.SLACK_WEBHOOK_SOCIAL,
  culture: process.env.SLACK_WEBHOOK_CULTURE,
  ai:      process.env.SLACK_WEBHOOK_AI,
  web3:    process.env.SLACK_WEBHOOK_WEB3,
};

export async function postToSlack(channel, text) {
  const webhook = WEBHOOKS[channel];
  if (!webhook) throw new Error(`No webhook configured for channel: ${channel}`);

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) throw new Error(`Slack post failed for #${channel}-signals: ${res.status} ${res.statusText}`);
  console.log(`✅ Posted to #${channel}-signals`);
}

/**
 * Post individual signal strings one at a time with a 1s delay between each.
 */
export async function postSignals(channel, signals) {
  for (const signal of signals) {
    if (!signal?.trim()) continue;
    // Strip any trailing dashes Claude may have appended, then add exactly one ----
    const clean = signal.trim().replace(/\n[-─]+\s*$/, '');
    await postToSlack(channel, `${clean}\n----`);
    await new Promise(r => setTimeout(r, 1000));
  }
}

export function formatDayHeader(channel) {
  const date = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: process.env.TIMEZONE || 'Australia/Brisbane',
  });
  return `*📡 ${channel.toUpperCase()} INTELLIGENCE FEED — ${date}*\n${'─'.repeat(48)}`;
}
