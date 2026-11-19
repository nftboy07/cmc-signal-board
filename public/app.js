// app.js — CMC Signal Board frontend. Vanilla JS, no build step.

const $ = (sel) => document.querySelector(sel);

function fmtMoney(v) {
  if (v === null || v === undefined) return '–';
  if (Math.abs(v) >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function fmtPrice(v) {
  if (v === null || v === undefined) return '–';
  if (v >= 1000) return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return '$' + v.toFixed(2);
  return '$' + v.toFixed(4);
}
function fmtPct(v) {
  if (v === null || v === undefined) return '–';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}
function pctClass(v) {
  return v === null || v === undefined ? '' : v >= 0 ? 'up' : 'down';
}
function sigClass(signal) {
  return signal.toLowerCase().replace(' momentum', '').replace(' ', '-');
}

function renderGlobal(g) {
  const cards = [
    { k: 'Total market cap', v: fmtMoney(g.totalMarketCap), s: fmtPct(g.marketCapChange24h) + ' vs yesterday', cls: pctClass(g.marketCapChange24h) },
    { k: '24h volume', v: fmtMoney(g.totalVolume24h), s: fmtPct(g.volumeChange24h) + ' vs yesterday', cls: pctClass(g.volumeChange24h) },
    { k: 'BTC dominance', v: g.btcDominance.toFixed(1) + '%', s: 'ETH ' + g.ethDominance.toFixed(1) + '%', cls: '' },
    { k: 'Active cryptocurrencies', v: g.activeCryptocurrencies.toLocaleString(), s: 'tracked by CoinMarketCap', cls: '' },
  ];
  $('#global-cards').innerHTML = cards
    .map((c) => `<div class="card"><div class="k">${c.k}</div><div class="v">${c.v}</div><div class="s ${c.cls}">${c.s}</div></div>`)
    .join('');
}

function renderMood(mood) {
  $('#mood-index').textContent = mood.index;
  $('#mood-label').textContent = mood.label;
  $('#mood-fill').style.left = `calc(${mood.index}% - 2px)`;
  $('#mood-explanation').textContent = mood.explanation;
  const names = {
    averageMomentum: 'Average coin momentum',
    breadth: 'Breadth (share of top coins green, 24h)',
    marketCapChange: 'Total market-cap change',
    volumeChange: 'Total volume change',
    dominanceShift: 'BTC dominance shift (rotation)',
  };
  $('#mood-components').innerHTML =
    '<tr><th>Component</th><th>Score</th><th>Weight</th></tr>' +
    Object.entries(mood.components)
      .map(([k, c]) => `<tr><td>${names[k] || k}</td><td>${c.value}</td><td>${Math.round(c.weight * 100)}%</td></tr>`)
      .join('');
}

function renderTrending(trending) {
  $('#trending').innerHTML = trending
    .map((t) => `<span class="chip">${t.position}. <strong>${t.symbol}</strong> ${fmtPrice(t.price)} <span class="${pctClass(t.change24h)}">${fmtPct(t.change24h)}</span></span>`)
    .join('');
}

function renderCoins(coins) {
  const tbody = document.querySelector('#coins tbody');
  tbody.innerHTML = coins
    .map(
      (c) => `<tr data-symbol="${c.symbol}">
        <td>${c.rank}</td>
        <td><span class="sym">${c.symbol}</span> <span class="name">${c.name}</span> ${c.trending ? '<span class="fire" title="Trending on CMC">🔥</span>' : ''}</td>
        <td>${fmtPrice(c.price)}</td>
        <td class="${pctClass(c.change1h)}">${fmtPct(c.change1h)}</td>
        <td class="${pctClass(c.change24h)}">${fmtPct(c.change24h)}</td>
        <td class="${pctClass(c.change7d)}">${fmtPct(c.change7d)}</td>
        <td class="${pctClass(c.change30d)}">${fmtPct(c.change30d)}</td>
        <td class="score-cell"><strong>${c.momentumScore}</strong><div class="score-bar"><div style="width:${c.momentumScore}%"></div></div></td>
        <td><span class="sig ${sigClass(c.signal)}">${c.signal}</span></td>
        <td>${c.turnover === null ? '–' : c.turnover.toFixed(2)}</td>
      </tr>`,
    )
    .join('');
  tbody.querySelectorAll('tr').forEach((row) => {
    row.addEventListener('click', () => loadCoin(row.dataset.symbol));
  });
}

async function loadCoin(symbol) {
  const panel = $('#coin-detail');
  panel.hidden = false;
  $('#detail-title').textContent = symbol + ' — loading…';
  $('#detail-body').innerHTML = '';
  try {
    const res = await fetch('/api/coin/' + encodeURIComponent(symbol));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'request failed');
    const c = data.coin;
    $('#detail-title').textContent = `${c.name} (${c.symbol}) — #${c.rank} by market cap`;
    $('#detail-body').innerHTML = `
      <p><strong>Price:</strong> ${fmtPrice(c.price)} · <strong>Market cap:</strong> ${fmtMoney(c.marketCap)} ·
      <strong>24h volume:</strong> ${fmtMoney(c.volume24h)} · <strong>Turnover:</strong> ${c.turnover === null ? '–' : c.turnover.toFixed(2)}</p>
      <p><strong>Momentum score:</strong> ${c.momentumScore}/100 — <span class="sig ${sigClass(c.signal)}">${c.signal}</span></p>
      <p class="explanation">${c.explanation}</p>
      <p class="hint">Detail quote via <code>/v2/cryptocurrency/quotes/latest</code>${data.source !== 'live' ? ' · sample data' : ''}.</p>`;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    $('#detail-title').textContent = symbol;
    $('#detail-body').innerHTML = `<p class="down">Could not load detail: ${err.message}</p>`;
  }
}

async function loadBoard() {
  const badge = $('#mode-badge');
  try {
    const res = await fetch('/api/board');
    const board = await res.json();
    if (!res.ok) throw new Error(board.error || 'request failed');

    if (board.source === 'live') {
      badge.textContent = '● LIVE — CoinMarketCap data';
      badge.className = 'badge live';
      $('#sample-banner').hidden = true;
      $('#fallback-banner').hidden = true;
    } else if (board.source === 'demo-fallback') {
      badge.textContent = '● SAMPLE DATA (live API unreachable)';
      badge.className = 'badge demo';
      $('#sample-banner').hidden = true;
      $('#fallback-banner').hidden = false;
    } else {
      badge.textContent = '● SAMPLE DATA — demo mode';
      badge.className = 'badge demo';
      $('#sample-banner').hidden = false;
      $('#fallback-banner').hidden = true;
    }

    renderGlobal(board.global);
    renderMood(board.mood);
    renderTrending(board.trending);
    renderCoins(board.coins);
    $('#generated-at').textContent = 'Board generated ' + new Date(board.generatedAt).toLocaleString() + ' · source: ' + board.source;
  } catch (err) {
    badge.textContent = 'Error loading board';
    badge.className = 'badge demo';
    $('#generated-at').textContent = 'Failed to load /api/board: ' + err.message;
  }
}

$('#refresh').addEventListener('click', loadBoard);
loadBoard();
