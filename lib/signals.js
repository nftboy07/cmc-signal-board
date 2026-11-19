// signals.js — derives CMC Signal Board's signals from raw CMC payloads.
//
// Nothing here calls the API; it is pure transformation of the listings,
// global-metrics and trending payloads, so it works identically on live
// data and on the bundled sample data.
//
// Signals derived:
//  1. Momentum score (0-100) per coin: weighted blend of its 1h / 24h / 7d /
//     30d percent changes, each mapped onto a 0-100 scale around neutral 50.
//  2. Market Mood index (0-100): a fear/greed-style composite for the whole
//     market, built from average momentum, market breadth (share of listed
//     coins up in 24h), total market-cap change, volume change, and the
//     BTC-dominance shift (money rotating into BTC = defensive = fearful).
//  3. Turnover ratio per coin: 24h volume / market cap — how actively a
//     coin is actually changing hands relative to its size.
//  4. Plain-language explanations generated from the numbers themselves.

const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;

// Map a percent change onto 0-100 (50 = flat). `scale` is the % move that
// counts as "full strength" for that horizon.
function pctToScore(pct, scale) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return 50;
  return clamp(50 + (pct / scale) * 50);
}

export function momentumScore(quote) {
  const parts = [
    { score: pctToScore(quote.percent_change_1h, 3), weight: 0.15 },
    { score: pctToScore(quote.percent_change_24h, 10), weight: 0.35 },
    { score: pctToScore(quote.percent_change_7d, 25), weight: 0.3 },
    { score: pctToScore(quote.percent_change_30d, 50), weight: 0.2 },
  ];
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  return round1(parts.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight);
}

export function signalLabel(score) {
  if (score >= 65) return 'Strong momentum';
  if (score >= 55) return 'Building';
  if (score >= 45) return 'Neutral';
  if (score >= 35) return 'Cooling';
  return 'Weak';
}

function fmtPct(v) {
  if (v === null || v === undefined) return 'n/a';
  return `${v >= 0 ? '+' : ''}${round1(v)}%`;
}

export function explainCoin(coin, quote, momentum) {
  const bits = [];
  const d24 = quote.percent_change_24h || 0;
  const d7 = quote.percent_change_7d || 0;
  bits.push(
    `${coin.symbol} is ${d24 >= 0 ? 'up' : 'down'} ${Math.abs(round1(d24))}% in 24h and ${d7 >= 0 ? 'up' : 'down'} ${Math.abs(round1(d7))}% over 7 days.`,
  );
  const turnover = quote.market_cap ? quote.volume_24h / quote.market_cap : 0;
  if (turnover >= 0.12) bits.push('Trading is heavy for its size, so the move has real participation behind it.');
  else if (turnover <= 0.03 && quote.volume_24h < 1e9) bits.push('Trading is thin for its size, so treat the move cautiously — small orders can push the price.');
  const h1 = quote.percent_change_1h;
  const h24 = quote.percent_change_24h;
  if (h1 !== null && h24 !== null && Math.sign(h1) !== Math.sign(h24) && Math.abs(h24) > 1) {
    bits.push('The last hour points the other way from the 24h trend, which often means the move is pausing or reversing.');
  }
  if (momentum >= 65) bits.push('Momentum is strong across several timeframes at once, not just a single spike.');
  else if (momentum <= 35) bits.push('Momentum is weak on most timeframes — recent buyers are underwater.');
  return bits.join(' ');
}

export function coinSignal(coin) {
  const quote = coin.quote.USD;
  const momentum = momentumScore(quote);
  return {
    id: coin.id,
    rank: coin.cmc_rank,
    name: coin.name,
    symbol: coin.symbol,
    slug: coin.slug,
    price: quote.price,
    marketCap: quote.market_cap,
    volume24h: quote.volume_24h,
    turnover: quote.market_cap ? Math.round((quote.volume_24h / quote.market_cap) * 1000) / 1000 : null,
    change1h: quote.percent_change_1h,
    change24h: quote.percent_change_24h,
    change7d: quote.percent_change_7d,
    change30d: quote.percent_change_30d,
    momentumScore: momentum,
    signal: signalLabel(momentum),
    explanation: explainCoin(coin, quote, momentum),
    lastUpdated: quote.last_updated,
  };
}

export function marketMood(listings, global) {
  const coins = listings.map((c) => c.quote.USD);
  const avgMomentum = listings.reduce((s, c) => s + momentumScore(c.quote.USD), 0) / Math.max(listings.length, 1);
  const upCount = coins.filter((q) => (q.percent_change_24h || 0) > 0).length;
  const breadth = (upCount / Math.max(coins.length, 1)) * 100; // 0-100 directly
  const g = global.quote.USD;
  const mcapScore = pctToScore(g.total_market_cap_yesterday_percentage_change, 6);
  const volumeScore = pctToScore(g.total_volume_24h_yesterday_percentage_change, 30);
  // BTC dominance rising vs yesterday = money hiding in BTC = defensive.
  const domShift = (global.btc_dominance_yesterday ?? global.btc_dominance) - global.btc_dominance; // positive = dominance fell
  const dominanceScore = clamp(50 + domShift * 40);

  const components = {
    averageMomentum: { value: round1(avgMomentum), weight: 0.3 },
    breadth: { value: round1(breadth), weight: 0.25 },
    marketCapChange: { value: round1(mcapScore), weight: 0.2 },
    volumeChange: { value: round1(volumeScore), weight: 0.15 },
    dominanceShift: { value: round1(dominanceScore), weight: 0.1 },
  };
  const index = round1(
    Object.values(components).reduce((s, c) => s + c.value * c.weight, 0),
  );

  let label;
  if (index <= 24) label = 'Extreme Fear';
  else if (index <= 44) label = 'Fear';
  else if (index <= 55) label = 'Neutral';
  else if (index <= 74) label = 'Greed';
  else label = 'Extreme Greed';

  const explanation =
    `Market Mood is ${label} (${index}/100). ` +
    `${upCount} of ${coins.length} top coins are green in the last 24h, total market cap is ${fmtPct(g.total_market_cap_yesterday_percentage_change)} vs yesterday, ` +
    `and BTC dominance is ${round1(global.btc_dominance)}% (${domShift >= 0 ? 'easing' : 'rising'}, which means money is ${domShift >= 0 ? 'rotating out into altcoins' : 'rotating defensively into Bitcoin'}).`;

  return { index, label, components, explanation };
}

export function buildBoard({ listingsPayload, globalPayload, trendingPayload }) {
  const listings = listingsPayload.data || [];
  const global = globalPayload.data;
  const coins = listings.map(coinSignal).sort((a, b) => a.rank - b.rank);
  const trendingSymbols = new Set((trendingPayload.data || []).map((t) => t.symbol));
  for (const c of coins) c.trending = trendingSymbols.has(c.symbol);

  return {
    generatedAt: new Date().toISOString(),
    global: {
      totalMarketCap: global.quote.USD.total_market_cap,
      totalVolume24h: global.quote.USD.total_volume_24h,
      marketCapChange24h: global.quote.USD.total_market_cap_yesterday_percentage_change,
      volumeChange24h: global.quote.USD.total_volume_24h_yesterday_percentage_change,
      btcDominance: global.btc_dominance,
      ethDominance: global.eth_dominance,
      activeCryptocurrencies: global.active_cryptocurrencies,
    },
    mood: marketMood(listings, global),
    trending: (trendingPayload.data || []).map((t, i) => ({
      position: i + 1,
      symbol: t.symbol,
      name: t.name,
      price: t.quote.USD.price,
      change24h: t.quote.USD.percent_change_24h,
    })),
    coins,
  };
}
