import dotenv from 'dotenv';
dotenv.config({ override: true });

const WEBHOOKS = {
  social:  process.env.DISCORD_WEBHOOK_SOCIAL,
  culture: process.env.DISCORD_WEBHOOK_CULTURE,
  trends:  process.env.DISCORD_WEBHOOK_TRENDS,
  ai:      process.env.DISCORD_WEBHOOK_AI,
  web3:    process.env.DISCORD_WEBHOOK_WEB3,
  jobs:    process.env.DISCORD_WEBHOOK_JOBS,
  upwork:  process.env.DISCORD_WEBHOOK_UPWORK,
};

export async function postToSlack(channel, text) {
  const webhook = WEBHOOKS[channel];
  if (!webhook) throw new Error(`No webhook configured for channel: ${channel}`);

  // Discord has a 2000 char limit per message — truncate if needed
  const content = text.length > 1990 ? text.slice(0, 1987) + '...' : text;

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) throw new Error(`Discord post failed for #${channel}: ${res.status} ${res.statusText}`);
  console.log(`✅ Posted to #${channel}`);
}

/**
 * Collapse a signal's whitespace to the tight Sonnet-style layout:
 * no blank lines inside a section, exactly one blank line before each
 * labelled block (WHY IT MATTERS / WHAT TO DO / source). Model-agnostic —
 * works no matter how much padding the model adds.
 */
function tightenSpacing(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    if (out.length && (line.startsWith('👉') || line.startsWith('🔗'))) {
      out.push(''); // single blank line before each labelled section
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * Post individual signal strings one at a time with a 1s delay between each.
 */
export async function postSignals(channel, signals) {
  for (const signal of signals) {
    if (!signal?.trim()) continue;
    const clean = tightenSpacing(signal).replace(/\n[-─]+\s*$/, '');
    await postToSlack(channel, `${clean}\n----`);
    await new Promise(r => setTimeout(r, 1000));
  }
}

export function formatDayHeader(channel) {
  const date = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: process.env.TIMEZONE || 'Australia/Brisbane',
  });
  return `📡 **${channel.toUpperCase()} — ${date}**\n${'─'.repeat(48)}`;
}
