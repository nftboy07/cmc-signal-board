# 📊 CMC Signal Board

**Live crypto market signals from the CoinMarketCap Pro API — scored, and explained in plain language.**

Built by **Crypto Relic** for the **Build with CMC: API Hackathon** (CoinMarketCap × DoraHacks).

CoinMarketCap shows you thousands of numbers. CMC Signal Board turns four of its
API feeds into three things a person can actually act on:

1. **A momentum score (0–100) for every top coin** — a weighted blend of its
   1h / 24h / 7d / 30d price changes, labelled *Strong momentum / Building /
   Neutral / Cooling / Weak*.
2. **A Market Mood index (0–100)** — a fear/greed-style composite for the whole
   market, built from average coin momentum, market breadth (share of top coins
   green in 24h), total market-cap change, volume change, and the BTC-dominance
   shift (money rotating into BTC = defensive).
3. **A plain-language explanation for every signal** — generated from the
   numbers themselves, e.g. *"SOL is up +5.42% in 24h and +11.60% over 7 days.
   Trading is heavy for its size, so the move has real participation behind it."*

It also shows global market stats (total market cap, volume, BTC/ETH dominance)
and the coins currently trending on CoinMarketCap.

---

## CoinMarketCap Pro API endpoints used

| Endpoint | What it feeds |
|---|---|
| `GET /v1/cryptocurrency/listings/latest` | Top-30 coins by market cap: price, 1h/24h/7d/30d % changes, volume, market cap → momentum scores, breadth, turnover |
| `GET /v1/global-metrics/quotes/latest` | Total market cap & volume (+ change vs yesterday), BTC/ETH dominance → global cards and 3 of the 5 Market Mood components |
| `GET /v1/cryptocurrency/trending/latest` | Coins trending on CMC → trending strip, 🔥 markers in the table |
| `GET /v2/cryptocurrency/quotes/latest` | Per-coin detail quote when a row is clicked → the detail panel |

## How to run

Requires Node.js ≥ 18. **Zero npm dependencies** — nothing to install.

### Demo mode (no key needed)

```bash
node server.js
# open http://localhost:3000
```

With no key set, the app serves **bundled sample API responses** (`data/*.json`,
recorded in the exact shape of the real CMC payloads) through the same code
path as live mode. The UI is badged **"SAMPLE DATA — demo mode"** and shows a
warning banner: nothing on screen is a live price.

### Live mode (real CoinMarketCap data)

```bash
export CMC_API_KEY=your_key_here   # free Basic key: https://pro.coinmarketcap.com
node server.js
# open http://localhost:3000
```

The key is read **only** from the `CMC_API_KEY` environment variable — it is
never hardcoded and never sent to the browser. The UI badge switches to
**"LIVE — CoinMarketCap data"**.

If a live call fails (network down, quota hit), the server falls back to the
sample data and labels it **demo-fallback** in the API response and the UI —
stale sample numbers are never silently presented as live.

## Credit frugality (free Basic tier = 15,000 credits/month)

- Every endpoint response is cached in memory: listings & global metrics
  5 min, trending 10 min, quotes 2 min.
- Concurrent requests for the same endpoint are single-flight de-duplicated —
  one upstream call serves them all.
- `GET /api/status` reports the mode, cache size, and the approximate number
  of CMC credits this process has consumed.
- At these TTLs a continuously open dashboard costs roughly **350–450 credits/day**
  worst case — comfortably inside the free tier.

## Architecture

```
server.js          Zero-dependency Node http server.
                   Routes: / (dashboard), /static/*, /api/status,
                   /api/board, /api/coin/:symbol
lib/cmc.js         CMC Pro API client. Env-only key, in-memory cache with
                   per-endpoint TTLs, single-flight dedupe, live -> sample
                   fallback with honest labelling.
lib/signals.js     Pure signal derivation (no I/O): momentum scores,
                   Market Mood index, turnover, explanation generator.
                   Works identically on live and sample payloads.
public/            Vanilla HTML/CSS/JS dashboard (no build step).
data/              Bundled sample CMC responses for demo mode, in the exact
                   shape of the real API payloads.
```

### How the signals are derived

- **Momentum score** — each horizon's % change is mapped to 0–100 around a
  neutral 50 (`50 + pct/scale × 50`, clamped), with full-strength scales of
  3% (1h), 10% (24h), 25% (7d), 50% (30d); weighted 15/35/30/20.
- **Market Mood** — weighted composite: average momentum 30%, breadth 25%,
  market-cap change 20%, volume change 15%, dominance shift 10%. Labelled
  *Extreme Fear ≤24 · Fear ≤44 · Neutral ≤55 · Greed ≤74 · Extreme Greed >74*.
  Every component score is shown in the UI ("How the mood index is built").
- **Turnover** — 24h volume ÷ market cap; flags moves with real participation
  vs thin, easily-pushed moves.

## What is real vs sample data

- **Live mode (key set):** every number comes from the CoinMarketCap Pro API
  in real time (subject to the cache TTLs above). The derived scores are
  computed locally by `lib/signals.js`.
- **Demo mode (no key):** prices and metrics are **static sample values**
  bundled in `data/` for judging/offline use. The signal math is the real
  production code running on those samples — only the inputs are canned.
  The UI always says which mode you are in.

## Disclaimer

Signals are informational summaries of public market data, not financial advice.

## License

MIT
