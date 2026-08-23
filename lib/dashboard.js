import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dir, '..', 'docs');
const DATA_FILE = join(DOCS_DIR, 'data.json');
const RETENTION_DAYS = 365; // keep a full year so the dashboard's Archive view has history

// ─── Signal parser: raw signal text → structured fields ──────────────────────

function clean(s) {
  return (s || '')
    .replace(/[👉🔗🚨]/g, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-–—:]\s*/, '')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

function parseSignal(raw) {
  const text = raw.replace(/\r/g, '').trim();

  const defs = [
    ['title',  /\*{0,2}TITLE\*{0,2}\s*:/i],
    ['whatIs', /\*{0,2}WHAT IT IS\*{0,2}\s*:/i],
    ['why',    /👉?\s*\*{0,2}WHY IT MATTERS\*{0,2}\s*:/i],
    ['what',   /👉?\s*\*{0,2}WHAT TO DO\*{0,2}\s*:/i],
  ];

  const marks = [];
  for (const [name, re] of defs) {
    const m = text.match(re);
    if (m) marks.push({ name, start: m.index, after: m.index + m[0].length });
  }
  const srcM = text.match(/🔗|https?:\/\//);
  const srcPos = srcM ? srcM.index : text.length;
  marks.sort((a, b) => a.start - b.start);

  const out = {};
  marks.forEach((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : srcPos;
    out[mk.name] = clean(text.slice(mk.after, end));
  });

  const urlMatch = text.match(/https?:\/\/[^\s)]+/);
  const source = urlMatch ? urlMatch[0].replace(/[.,]$/, '') : '';

  // Fallback for the old format (no TITLE / WHAT IT IS markers): the pre-WHY
  // blob becomes "what it is", and the title is derived from its opening.
  if (!out.title && !out.whatIs) {
    const whyStart = marks.find(m => m.name === 'why')?.start ?? text.search(/WHY IT MATTERS/i);
    let blob = text.slice(0, whyStart < 0 ? text.length : whyStart)
      .replace(/🚨\s*\*{0,2}SIGNAL\*{0,2}[^\n]*\n?/i, '');
    blob = clean(blob);
    out.whatIs = blob;
    out.title = blob.split(/[.—]/)[0].trim().split(' ').slice(0, 9).join(' ');
  }

  return {
    title:  out.title || (out.whatIs || '').split('.')[0].slice(0, 80),
    whatIs: out.whatIs || '',
    why:    out.why || '',
    what:   out.what || '',
    source,
  };
}

// ─── Thumbnail: pull the Open Graph image from the source page ───────────────

async function fetchOgImage(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CultureScout/1.0)' },
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    const html = (await res.text()).slice(0, 200_000);
    const m =
      html.match(/<meta[^>]+(?:property|name)=["']og:image(?::url)?["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
    if (!m) return '';
    let img = m[1].trim().replace(/&amp;/g, '&');
    if (img.startsWith('//')) img = 'https:' + img;
    else if (img.startsWith('/')) { try { img = new URL(img, url).href; } catch {} }
    return img.startsWith('http') ? img : '';
  } catch {
    return '';
  }
}

// ─── Data file helpers ───────────────────────────────────────────────────────

function load() {
  if (!existsSync(DATA_FILE)) return { updated: null, signals: [] };
  try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')); }
  catch { return { updated: null, signals: [] }; }
}

const today  = () => new Date().toISOString().slice(0, 10);
const cutoff = () => { const d = new Date(); d.setDate(d.getDate() - RETENTION_DAYS); return d.toISOString().slice(0, 10); };

/**
 * Parse a channel's signals, enrich each with a thumbnail, and write them to
 * docs/data.json. Idempotent per (date, channel). Mirrors history.js.
 */
export async function saveToDashboard(channel, signals) {
  if (!signals?.length) return;

  const parsed = signals
    .map(parseSignal)
    .filter(s => s.title && !s.title.includes('No strong signals') && !s.whatIs.includes('No strong signals'));
  if (parsed.length === 0) return;

  // Pull thumbnails in parallel (each is best-effort with a 6s timeout).
  await Promise.all(parsed.map(async p => { p.image = p.source ? await fetchOgImage(p.source) : ''; }));

  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });

  const data = load();
  const date = today();
  const since = cutoff();

  data.signals = data.signals.filter(s => !(s.date === date && s.channel === channel));
  for (const p of parsed) data.signals.push({ date, channel, ...p });

  data.signals = data.signals.filter(s => s.date >= since);
  data.updated = new Date().toISOString();

  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  const withImg = parsed.filter(p => p.image).length;
  console.log(`🖥️  Dashboard: saved ${parsed.length} signal(s) for [${channel}] (${withImg} with thumbnail)`);
}
