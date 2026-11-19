# SUBMISSION DRAFT — Build with CMC: API Hackathon (DoraHacks)
# Status: DRAFT ONLY — not submitted, not posted. Parent agent to submit
# once the repo is public and the demo is recorded.
# Submission window: 18 Nov 2026 00:00 UTC – 9 Dec 2026 23:59 UTC.

## Project title
CMC Signal Board

## Builder
Crypto Relic (solo builder)

## One-liner
A live crypto market signal dashboard that turns four CoinMarketCap Pro API
feeds into momentum scores, a fear/greed-style Market Mood index, and
plain-language explanations for every signal.

## Description
CoinMarketCap shows thousands of numbers; CMC Signal Board turns them into
decisions a person can understand at a glance. It pulls the top coins,
global market metrics and trending coins from the CoinMarketCap Pro API and
derives: (1) a 0–100 momentum score per coin from its 1h/24h/7d/30d price
changes, with labels from "Weak" to "Strong momentum"; (2) a 0–100 Market
Mood index for the whole market — a fear/greed-style composite of average
momentum, market breadth, market-cap change, volume change and the
BTC-dominance rotation; and (3) a plain-language explanation under every
signal, generated from the numbers themselves (e.g. calling out heavy
turnover behind a move, or an hourly reversal against the daily trend).
A small zero-dependency Node backend reads the API key only from an
environment variable, caches every endpoint (5–10 min TTLs, single-flight
dedupe) to stay frugal on the free Basic tier's 15,000 monthly credits, and
serves a clean vanilla-JS dashboard. With no key configured it runs in a
clearly-labelled demo mode on bundled sample API responses, so anyone —
including judges — can run the full app offline.

## CoinMarketCap Pro API endpoints used (named, as required)
- `GET /v1/cryptocurrency/listings/latest` — top-30 listings: prices,
  1h/24h/7d/30d changes, volume, market cap → momentum, breadth, turnover.
- `GET /v1/global-metrics/quotes/latest` — total market cap/volume and
  changes vs yesterday, BTC/ETH dominance → global cards + Market Mood.
- `GET /v1/cryptocurrency/trending/latest` — trending coins strip.
- `GET /v2/cryptocurrency/quotes/latest` — per-coin detail quotes (visible
  real API call when any coin row is clicked).

## Demo instructions
- Live demo: [TO BE FILLED by parent agent once hosted — e.g. GitHub Pages
  front-end is NOT possible (needs the Node backend); use the recorded
  video + run-locally instructions, or a hosted instance URL.]
- Run locally (no key, demo mode with sample data):
  `node server.js` → http://localhost:3000
- Run locally (live data): `CMC_API_KEY=<key> node server.js`
- Demo video: [TO BE RECORDED by parent agent — 2–3 min: open board,
  explain Market Mood, click a coin to show the live quotes/latest call,
  show /api/status with credit counter.]

## Repo
https://github.com/nftboy07/cmc-signal-board

## Required X post (DRAFT — do not post from this file; parent agent posts
## at submission time with the final repo/demo links filled in)
Built CMC Signal Board for #BuildwithCMC 📊

It turns the @CoinMarketCap Pro API into signals humans can read:
⚡ momentum scores for the top 30 coins
🌡️ a fear/greed-style Market Mood index
📝 a plain-language explanation for every move

4 CMC endpoints, zero-dependency Node, credit-frugal caching.
Repo + demo: [LINK]

## Checklist for the parent agent before submitting
- [ ] Create public GitHub repo from this folder (no key anywhere in history;
      .gitignore already excludes .env).
- [ ] Set the real CMC_API_KEY only in the hosting/runtime env, never in code.
- [ ] Confirm the account's CMC plan (Basic vs event Startup tier) and that
      the dashboard badge shows LIVE.
- [ ] Record the 2–3 min demo video; upload; fill the link above.
- [ ] Fill repo + demo links in this file and in the DoraHacks submission.
- [ ] Post the X post with #BuildwithCMC (submission requirement).
- [ ] Submit on DoraHacks before 9 Dec 2026 23:59 UTC.
