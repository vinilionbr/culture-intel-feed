import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = join(__dir, '..', 'signal-history.json');
const RETENTION_DAYS = 14;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function load() {
  if (!existsSync(HISTORY_FILE)) return { signals: [] };
  try { return JSON.parse(readFileSync(HISTORY_FILE, 'utf8')); }
  catch { return { signals: [] }; }
}

function save(history) {
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function cutoff() {
  const d = new Date();
  d.setDate(d.getDate() - RETENTION_DAYS);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Extract a short topic label from a raw signal string */
function extractTopic(signal) {
  const lines = signal.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('🚨') || lines[i].includes('SIGNAL')) {
      // The descriptive line is right after the 🚨 **SIGNAL** header
      const next = lines[i + 1] || lines[i];
      return next.replace(/\*\*/g, '').replace(/[🚨💼🎯]/g, '').trim().slice(0, 120);
    }
  }
  return lines[0]?.replace(/\*\*/g, '').replace(/[🚨💼🎯]/g, '').trim().slice(0, 120) || '';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a string to append to a system prompt warning the agent
 * about topics already covered in the last RETENTION_DAYS days.
 * Returns '' if no history exists yet for this channel.
 */
export function getHistoryBlock(channel) {
  const history = load();
  const since = cutoff();

  const topics = history.signals
    .filter(s => s.date >= since && s.channel === channel)
    .flatMap(s => s.topics);

  if (topics.length === 0) return '';

  return `

ALREADY COVERED — do NOT post signals on these topics (already sent in the last ${RETENTION_DAYS} days):
${topics.map(t => `- ${t}`).join('\n')}

If you cannot find ${3}+ genuinely NEW and different signals, output: "No strong signals found in this cycle." Never recycle a topic already on this list.`;
}

/**
 * After an agent posts, call this to record what topics were covered.
 * Persists to signal-history.json so the next run can read it.
 */
export function saveSignalHistory(channel, signals) {
  if (!signals?.length) return;

  const topics = signals
    .map(extractTopic)
    .filter(t => t.length > 10);

  if (topics.length === 0) return;

  const history = load();
  const date = today();

  // Replace today's entry for this channel (idempotent if re-run)
  history.signals = history.signals.filter(
    s => !(s.date === date && s.channel === channel)
  );
  history.signals.push({ date, channel, topics });

  // Prune old entries
  const since = cutoff();
  history.signals = history.signals.filter(s => s.date >= since);

  save(history);
  console.log(`💾 History: saved ${topics.length} topic(s) for [${channel}]`);
}
