import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOLS = [{ type: 'web_search_20250305', name: 'web_search' }];

// ─── Retry helper ────────────────────────────────────────────────────────────

async function withRetry(fn, { retries = 3, baseDelay = 65000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.status === 429 || err?.message?.includes('rate_limit');
      if (is429 && attempt < retries) {
        const wait = baseDelay * (attempt + 1);
        console.warn(`⏳ Rate limited — retrying in ${wait / 1000}s (attempt ${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

// ─── Web-search agent (all 4 agents) ────────────────────────────────────────

export async function runAgentWithSearch(systemPrompt, userPrompt) {
  const messages = [{ role: 'user', content: userPrompt }];
  let finalText = '';

  for (let turn = 0; turn < 10; turn++) {
    const response = await withRetry(() =>
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        tools: TOOLS,
        system: systemPrompt,
        messages,
      })
    );

    const textBlocks = response.content.filter(b => b.type === 'text');
    if (textBlocks.length) {
      finalText = textBlocks.map(b => b.text).join('\n');
    }

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

// ─── Apify data analyser (kept for optional use) ────────────────────────────

export async function analyzeScrapedData(systemPrompt, data) {
  const dataStr = JSON.stringify(data).slice(0, 12000);

  const response = await withRetry(() =>
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Here is the scraped social data. Extract 3-5 signals in the exact format specified:\n\n${dataStr}`,
      }],
    })
  );

  return response.content[0]?.text ?? '';
}

// ─── Signal parser (all agents) ─────────────────────────────────────────────

export function parseSignals(text) {
  if (!text?.trim()) return [];
  if (text.includes('No strong signals')) return [text.trim()];

  // Split on any 🚨 marker (handles both old and new format)
  const parts = text
    .split(/(?=🚨)/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.startsWith('🚨'));

  if (parts.length > 1) return parts;

  return [text.trim()];
}
