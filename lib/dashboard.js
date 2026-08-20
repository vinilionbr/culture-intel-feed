import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dir, '..', 'docs');
const DATA_FILE = join(DOCS_DIR, 'data.json');
const RETENTION_DAYS = 14;

// ─── Signal parser: turn the raw signal text into structured fields ──────────

function parseSignal(raw) {
  const text = raw.replace(/\r/g, '').trim();

  // Split on the labelled markers so we can pull each block out cleanly.
  const whyIdx  = text.search(/👉?\s*\*?\*?WHY IT MATTERS/i);
  const whatIdx = text.search(/👉?\s*\*?\*?WHAT TO DO/i);
  const srcIdx  = text.search(/🔗|source\s*\/?\s*reference|source:/i);

  const between = (start, end) => {
    if (start < 0) return '';
    const slice = text.slice(start, end < 0 ? undefined : end);
    return slice
      .replace(/👉?\s*\*?\*?(WHY IT MATTERS|WHAT TO DO):?\*?\*?/i, '')
      .replace(/🔗.*/s, '')
      .trim();
  };

  // Headline: everything before WHY, minus the SIGNAL header line.
  let headline = text.slice(0, whyIdx < 0 ? text.length : whyIdx)
    .replace(/🚨\s*\*?\*?SIGNAL[^\n]*\n?/i, '')
    .replace(/\*\*/g, '')
    .trim();
  headline = headline.split('\n').map(l => l.trim()).filter(Boolean).join(' ');

  const why  = between(whyIdx,  whatIdx < 0 ? srcIdx : whatIdx).replace(/\*\*/g, '');
  const what = between(whatIdx, srcIdx).replace(/\*\*/g, '');

  const urlMatch = text.match(/https?:\/\/[^\s)]+/);
  const source = urlMatch ? urlMatch[0].replace(/[.,]$/, '') : '';

  return {
    headline: headline || text.split('\n')[0].replace(/\*\*/g, '').trim(),
    why: why || '',
    what: what || '',
    source,
    raw: text,
  };
}

// ─── Data file helpers ───────────────────────────────────────────────────────

function load() {
  if (!existsSync(DATA_FILE)) return { updated: null, signals: [] };
  try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')); }
  catch { return { updated: null, signals: [] }; }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function cutoff() {
  const d = new Date();
  d.setDate(d.getDate() - RETENTION_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * Write a channel's signals into the dashboard data file (docs/data.json).
 * Idempotent per (date, channel): re-running an agent replaces that day's
 * entries rather than duplicating them. Mirrors the history.js pattern.
 */
export function saveToDashboard(channel, signals) {
  if (!signals?.length) return;
  const parsed = signals
    .map(parseSignal)
    .filter(s => s.headline && !s.headline.includes('No strong signals'));
  if (parsed.length === 0) return;

  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });

  const data = load();
  const date = today();
  const since = cutoff();

  // drop this channel's existing entries for today, then re-add
  data.signals = data.signals.filter(
    s => !(s.date === date && s.channel === channel)
  );
  for (const p of parsed) {
    data.signals.push({ date, channel, ...p });
  }

  // prune anything older than the retention window
  data.signals = data.signals.filter(s => s.date >= since);
  data.updated = new Date().toISOString();

  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`🖥️  Dashboard: saved ${parsed.length} signal(s) for [${channel}]`);
}
