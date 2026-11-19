// server.js — CMC Signal Board backend. Zero dependencies: Node built-ins only.
//
// Routes:
//   GET /                  -> dashboard (public/index.html)
//   GET /static/*          -> frontend assets
//   GET /api/status        -> mode (live/demo), cache + credit info
//   GET /api/board         -> full signal board (listings + global + trending, derived)
//   GET /api/coin/:symbol  -> one coin's detail (quotes/latest), with its signal
//
// The API key is read only from the CMC_API_KEY env var (see lib/cmc.js).
// Without a key the app serves bundled sample data, labelled as such.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEndpoint, getStatus } from './lib/cmc.js';
import { buildBoard, coinSignal } from './lib/signals.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

async function serveStatic(res, filePath) {
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

async function handleBoard(res) {
  const [listings, globalMetrics, trending] = await Promise.all([
    getEndpoint('listings', { start: 1, limit: 30, convert: 'USD', sort: 'market_cap' }),
    getEndpoint('globalMetrics', { convert: 'USD' }),
    getEndpoint('trending', { start: 1, limit: 10, convert: 'USD' }),
  ]);
  const sources = [listings.source, globalMetrics.source, trending.source];
  const source = sources.includes('live')
    ? 'live'
    : sources.includes('demo-fallback')
      ? 'demo-fallback'
      : 'demo';
  const board = buildBoard({
    listingsPayload: listings.payload,
    globalPayload: globalMetrics.payload,
    trendingPayload: trending.payload,
  });
  sendJson(res, 200, { ...board, source });
}

async function handleCoin(res, symbol) {
  const sym = symbol.toUpperCase();
  const { payload, source } = await getEndpoint('quotes', { symbol: sym, convert: 'USD' });
  const entry = payload.data && payload.data[sym] && payload.data[sym][0];
  if (!entry) {
    sendJson(res, 404, { error: `No quote found for symbol ${sym}`, source });
    return;
  }
  sendJson(res, 200, { source, coin: coinSignal(entry) });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname === '/api/status') return sendJson(res, 200, getStatus());
    if (pathname === '/api/board') return await handleBoard(res);
    const coinMatch = pathname.match(/^\/api\/coin\/([A-Za-z0-9]{1,15})$/);
    if (coinMatch) return await handleCoin(res, coinMatch[1]);

    if (pathname === '/') return await serveStatic(res, path.join(publicDir, 'index.html'));
    if (pathname.startsWith('/static/')) {
      const rel = pathname.slice('/static/'.length).replace(/\.\.+/g, '');
      return await serveStatic(res, path.join(publicDir, rel));
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Internal error', detail: String(err && err.message) });
  }
});

server.listen(PORT, () => {
  const s = getStatus();
  console.log(`CMC Signal Board running at http://localhost:${PORT}`);
  console.log(`Mode: ${s.mode}${s.mode === 'demo' ? ' (no CMC_API_KEY set — serving bundled SAMPLE data)' : ' (live CoinMarketCap data, cached)'}`);
});
