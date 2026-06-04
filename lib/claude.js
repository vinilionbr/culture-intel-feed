import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = 'gemini-2.5-flash';

// ─── Retry helper ────────────────────────────────────────────────────────────

async function withRetry(fn, { retries = 3, baseDelay = 30000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err?.status === 429 || err?.message?.includes('quota') || err?.message?.includes('rate');
      if (isRateLimit && attempt < retries) {
        const wait = baseDelay * (attempt + 1);
        console.warn(`⏳ Rate limited — retrying in ${wait / 1000}s (attempt ${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

// ─── Web-search agent (Gemini + Google Search grounding) ─────────────────────
// No agentic loop needed — Gemini handles search automatically

export async function runAgentWithSearch(systemPrompt, userPrompt) {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
    tools: [{ googleSearch: {} }],
  });

  const result = await withRetry(() => model.generateContent(userPrompt));
  return result.response.text();
}

// ─── Apify data analyser (no search needed) ──────────────────────────────────

export async function analyzeScrapedData(systemPrompt, data) {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
  });

  const dataStr = JSON.stringify(data).slice(0, 12000);
  const result = await withRetry(() =>
    model.generateContent(
      `Here is the scraped data. Extract signals in the exact format specified:\n\n${dataStr}`
    )
  );
  return result.response.text();
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
