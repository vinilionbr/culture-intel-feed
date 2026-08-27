// AI layer for SCOUT — now free: Groq (Llama 3.3 70B) for synthesis + Tavily for
// live web search. Same exports as before, so the agents don't change.
// (The previous Anthropic/Haiku version is one `git revert` away if needed.)
import dotenv from 'dotenv';
dotenv.config({ override: true });

const GROQ_KEY   = process.env.GROQ_API_KEY;
const TAVILY_KEY = process.env.TAVILY_API_KEY;
const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const TAVILY_URL = 'https://api.tavily.com/search';
const MODEL      = 'openai/gpt-oss-120b';

// ─── Retry helper (network / rate-limit tolerant) ────────────────────────────

async function withRetry(fn, { retries = 3, baseDelay = 5000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err?.message || '';
      const retryable = /429|rate|5\d\d|timeout|ECONNRESET|ETIMEDOUT|fetch failed|network|aborted/i.test(msg);
      if (retryable && attempt < retries) {
        const wait = baseDelay * (attempt + 1);
        console.warn(`⏳ ${msg.slice(0, 70)} — retrying in ${wait / 1000}s (${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

// ─── Groq chat (OpenAI-compatible) ───────────────────────────────────────────

async function groqChat(messages, { max_tokens = 1500, temperature = 0.4, json = false } = {}) {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY not set');
  const body = { model: MODEL, messages, max_tokens, temperature, reasoning_effort: 'low' };
  if (json) body.response_format = { type: 'json_object' };

  const data = await withRetry(async () => {
    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`);
    return r.json();
  });
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Tavily live web search ──────────────────────────────────────────────────

async function tavilySearch(query) {
  if (!TAVILY_KEY) throw new Error('TAVILY_API_KEY not set');
  return withRetry(async () => {
    const r = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TAVILY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        max_results: 8,
        search_depth: 'basic',
        topic: 'news',
        days: 14,
        include_answer: false,
      }),
    });
    if (!r.ok) throw new Error(`Tavily ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`);
    const data = await r.json();
    return (data.results || []).map(x => ({
      title: x.title,
      url: x.url,
      content: (x.content || '').slice(0, 380),
    }));
  });
}

// ─── Web-search agent: generate queries → search → synthesise ────────────────

export async function runAgentWithSearch(systemPrompt, userPrompt) {
  // 1. Ask the model for targeted, fresh search queries.
  let queries = [];
  try {
    const raw = await groqChat([
      { role: 'system', content: 'You generate queries for a news search engine. Output ONLY JSON like {"queries":["...","..."]}. Rules: exactly 4 queries, each 3 to 7 plain words about the subject. NO site: operators, NO URLs, NO exact dates, NO quotation marks. Just natural topics people would search.' },
      { role: 'user', content: `Topic to research:\n${userPrompt.slice(0, 450)}\n\nReturn 4 short, natural search queries about the key subjects here.` },
    ], { max_tokens: 300, temperature: 0.3, json: true });
    queries = JSON.parse(raw).queries || [];
  } catch {
    /* fall through to fallback below */
  }
  if (!Array.isArray(queries) || queries.length === 0) queries = [userPrompt.slice(0, 120)];
  queries = queries.slice(0, 5);

  // 2. Run the searches sequentially (free tier is ~1 req/sec), dedupe by URL.
  const seen = new Set();
  const results = [];
  for (const q of queries) {
    try {
      const list = await tavilySearch(q);
      for (const r of list) {
        if (r.url && !seen.has(r.url)) { seen.add(r.url); results.push(r); }
      }
    } catch (e) {
      console.warn(`   ⚠️ search failed: ${(e.message || '').slice(0, 70)}`);
    }
    await new Promise(r => setTimeout(r, 1100));
  }
  console.log(`   🔎 ${queries.length} queries → ${results.length} results`);
  if (results.length === 0) return 'No strong signals found in this cycle.';

  // 3. Synthesise the signals strictly from what the search returned.
  // Cap the context to the top results to stay well within free token limits.
  const context = results.slice(0, 12).map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`).join('\n\n');
  return groqChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `${userPrompt}\n\nBase your signals ONLY on these fresh web search results below. For each signal's source line, use the exact real URL of the result you drew from. The results below are relevant to the task, so produce the requested number of signals from them. Only output "No strong signals found in this cycle." if the results are genuinely off-topic or empty.\n\n${context}` },
  ], { max_tokens: 2800, temperature: 0.5 });
}

// ─── Scraped-data analyser (Upwork agent — dormant) ──────────────────────────

export async function analyzeScrapedData(systemPrompt, data) {
  const dataStr = JSON.stringify(data).slice(0, 12000);
  return groqChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Here is the scraped data. Extract signals in the exact format specified:\n\n${dataStr}` },
  ], { max_tokens: 1500, temperature: 0.4 });
}

// ─── Signal parser ───────────────────────────────────────────────────────────

export function parseSignals(text) {
  if (!text?.trim()) return [];
  if (text.includes('No strong signals')) return [text.trim()];

  const parts = text
    .split(/(?=🚨)/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.startsWith('🚨'));

  if (parts.length > 1) return parts;
  return [text.trim()];
}

// ─── Date helper ─────────────────────────────────────────────────────────────

export function todayStr() {
  return new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Australia/Brisbane',
  });
}
