// cmc.js — CoinMarketCap Pro API client for CMC Signal Board.
//
// - Reads the API key ONLY from the CMC_API_KEY environment variable.
// - With no key set, the app runs in DEMO mode: bundled sample responses
//   (data/*.json, shaped exactly like real CMC payloads) are served through
//   the same code path and clearly labelled as sample data.
// - With a key set, live responses are cached in memory with generous TTLs
//   and single-flight de-duplication, because the free Basic tier allows
//   15,000 call credits / month. If a live call fails (network, quota),
//   the client falls back to the sample data and labels it demo-fallback
//   so the UI never silently presents stale sample numbers as live.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = 'https://pro-api.coinmarketcap.com';
const API_KEY = process.env.CMC_API_KEY || '';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

// endpoint name -> { path, ttlMs, sampleFile }
export const ENDPOINTS = {
  listings: {
    path: '/v1/cryptocurrency/listings/latest',
    ttlMs: 5 * 60 * 1000, // 5 min — listings move slowly, credits are precious
    sampleFile: 'listings-latest.json',
  },
  globalMetrics: {
    path: '/v1/global-metrics/quotes/latest',
    ttlMs: 5 * 60 * 1000,
    sampleFile: 'global-metrics-latest.json',
  },
  trending: {
    path: '/v1/cryptocurrency/trending/latest',
    ttlMs: 10 * 60 * 1000, // 10 min
    sampleFile: 'trending-latest.json',
  },
  quotes: {
    path: '/v2/cryptocurrency/quotes/latest',
    ttlMs: 2 * 60 * 1000, // 2 min — quotes are the freshest data we show
    sampleFile: 'quotes-latest.json',
  },
};

const cache = new Map(); // key -> { expiresAt, payload }
const inflight = new Map(); // key -> Promise (single-flight)
let liveCalls = 0; // approximate CMC credit spend this process lifetime
let liveErrors = 0;

async function loadSample(name) {
  const raw = await readFile(path.join(dataDir, ENDPOINTS[name].sampleFile), 'utf8');
  return JSON.parse(raw);
}

async function fetchLive(name, params) {
  const ep = ENDPOINTS[name];
  const url = new URL(BASE_URL + ep.path);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { 'X-CMC_PRO_API_KEY': API_KEY, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || (body.status && body.status.error_code !== 0)) {
    const msg = (body && body.status && body.status.error_message) || `HTTP ${res.status}`;
    throw new Error(`CMC ${ep.path} failed: ${msg}`);
  }
  liveCalls += (body.status && body.status.credit_count) || 1;
  return body;
}

/**
 * Get a CMC endpoint payload.
 * Returns { payload, source } where source is 'live' | 'demo' | 'demo-fallback'.
 */
export async function getEndpoint(name, params) {
  const cacheKey = name + ':' + JSON.stringify(params || {});
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return { payload: hit.payload, source: hit.source };
  if (inflight.has(cacheKey)) return inflight.get(cacheKey);

  const job = (async () => {
    let payload;
    let source;
    if (!API_KEY) {
      payload = await loadSample(name);
      source = 'demo';
    } else {
      try {
        payload = await fetchLive(name, params);
        source = 'live';
      } catch (err) {
        liveErrors += 1;
        console.warn(`[cmc] live fetch failed for ${name}: ${err.message} — serving sample data`);
        payload = await loadSample(name);
        source = 'demo-fallback';
      }
    }
    cache.set(cacheKey, { payload, source, expiresAt: Date.now() + ENDPOINTS[name].ttlMs });
    inflight.delete(cacheKey);
    return { payload, source };
  })();

  inflight.set(cacheKey, job);
  return job;
}

export function getStatus() {
  return {
    mode: API_KEY ? 'live' : 'demo',
    keyConfigured: Boolean(API_KEY),
    liveCreditsUsedApprox: liveCalls,
    liveErrors,
    cacheEntries: cache.size,
    endpoints: Object.fromEntries(
      Object.entries(ENDPOINTS).map(([name, ep]) => [name, { path: ep.path, cacheTtlSeconds: ep.ttlMs / 1000 }]),
    ),
  };
}
