import dotenv from 'dotenv';
dotenv.config({ override: true });

const BASE = 'https://api.apify.com';

/**
 * Run an Apify actor synchronously and return dataset items.
 * @param {string} actorId  e.g. 'trudax~reddit-scraper-lite'
 * @param {object} input    actor input payload
 * @param {object} opts     { limit, timeout (seconds) }
 */
export async function runActor(actorId, input, { limit = 5, timeout = 90 } = {}) {
  const token = process.env.APIFY_API_KEY;
  if (!token) throw new Error('APIFY_API_KEY not set');

  const url =
    `${BASE}/v2/acts/${actorId}/run-sync-get-dataset-items` +
    `?token=${token}&timeout=${timeout}&memory=256&format=json&limit=${limit}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (timeout + 30) * 1000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Apify ${actorId}: HTTP ${res.status} — ${body.slice(0, 200)}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
