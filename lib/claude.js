import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 4,        // SDK auto-retries connection drops + 429/5xx
  timeout: 120_000,     // 120s — web_search responses can be large/slow
});
const TOOLS = [{ type: 'web_search_20250305', name: 'web_search' }];

// Single source of truth for the model — flip back to 'claude-sonnet-4-6' to revert.
// Haiku 4.5 is ~3x cheaper ($1/$5 vs $3/$15 per 1M tokens), same web_search tool.
const MODEL = 'claude-haiku-4-5';

// ─── Retry helper ────────────────────────────────────────────────────────────

async function withRetry(fn, { retries = 3, baseDelay = 65000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err?.message || '';
      const is429 = err?.status === 429 || msg.includes('rate_limit');
      // Connection-level failures (the "Premature close" class) are transient —
      // retry them too, not just rate limits.
      const isConnErr = err?.status >= 500
        || /premature close|ECONNRESET|ETIMEDOUT|socket hang up|fetch failed|terminated|aborted/i.test(msg);
      const wait = is429 ? baseDelay * (attempt + 1) : 5000 * (attempt + 1);
      if ((is429 || isConnErr) && attempt < retries) {
        const why = is429 ? 'Rate limited' : 'Connection error';
        console.warn(`⏳ ${why} (${msg.slice(0, 60)}) — retrying in ${wait / 1000}s (attempt ${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

// ─── Web-search agent (all signal agents) ────────────────────────────────────

export async function runAgentWithSearch(systemPrompt, userPrompt) {
  const messages = [{ role: 'user', content: userPrompt }];
  let finalText = '';

  for (let turn = 0; turn < 10; turn++) {
    const response = await withRetry(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        tools: TOOLS,
        system: systemPrompt,
        messages,
      })
    );

    const textBlocks = response.content.filter(b => b.type === 'text');
    if (textBlocks.length) finalText = textBlocks.map(b => b.text).join('\n');

    if (response.stop_reason === 'end_turn') break;

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });
      const toolResults = response.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: '' }));
      messages.push({ role: 'user', content: toolResults });
    } else {
      break;
    }
  }

  return finalText;
}

// ─── Apify data analyser (Upwork agent) ──────────────────────────────────────

export async function analyzeScrapedData(systemPrompt, data) {
  const dataStr = JSON.stringify(data).slice(0, 12000);

  const response = await withRetry(() =>
    client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Here is the scraped data. Extract signals in the exact format specified:\n\n${dataStr}`,
      }],
    })
  );

  return response.content[0]?.text ?? '';
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
