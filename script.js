/* ------------ CONFIG ------------ */
const topStocks = ["AAPL", "MSFT", "AMZN", "GOOGL", "META"];
const QUOTE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min cache
/* -------------------------------- */

const searchInput    = document.getElementById("search");
const stockInfo      = document.getElementById("stock-info");
const tickerContent  = document.getElementById("ticker-content");
let stockChart;
const quoteCache = {}; // {SYM:{...}}

/* Helpers */
const now = () => Date.now();
const safeUpper = s => (s || "").trim().toUpperCase();
const isFresh = ts => now() - ts < QUOTE_CACHE_TTL_MS;

/* -----------------------------------------------------------
   FETCH MULTIPLE QUOTES (Ticker use)
   ----------------------------------------------------------- */
async function fetchMultiQuotes(symbols) {
    const list = symbols.map(safeUpper).join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(list)}`;

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        const results = data?.quoteResponse?.result || [];
        const out = {};

        // map symbols -> result objects
        for (const s of symbols) {
            const up = safeUpper(s);
            const match = results.find(r => safeUpper(r.symbol) === up);
            if (!match || match.regularMarketPrice == null) {
                out[up] = { symbol: up, invalid: true, ts: now() };
            } else {
                out[up] = {
                    symbol: up,
                    price: Number(match.regularMarketPrice).toFixed(2),
                    change: Number(match.regularMarketChange || 0).toFixed(2),
                    changePct: Number(match.regularMarketChangePercent || 0).toFixed(2) + "%",
                    ts: now()
                };
            }
            quoteCache[up] = out[up]; // cache each
        }

        return out;
    } catch (err) {
        console.error("fetchMultiQuotes error:", err);
        // mark all as error
        const out = {};
        for (const s of symbols) {
            const up = safeUpper(s);
            out[up] = { symbol: up, error: true, ts: now() };
        }
        return out;
    }
}

/* -----------------------------------------------------------
   FETCH SINGLE QUOTE (Search use; uses cache, then network)
   ----------------------------------------------------------- */
async function getQuote(symbol) {
    symbol = safeUpper(symbol);

    const cached = quoteCache[symbol];
    if (cached && isFresh(cached.ts)) return cached;

    // Reuse multi-quote call pattern (single symbol)
    const res = await fetchMultiQuotes([symbol]);
    return res[symbol];
}

/* -----------------------------------------------------------
   RENDER TICKER BAR
   ----------------------------------------------------------- */
async function renderTicker() {
    if (!tickerContent) return;
    const data = await fetchMultiQuotes(topStocks);

    const html = topStocks.map(sym => {
        const q = data[safeUpper(sym)];
        if (q.error)   return `<span>${sym}: Error</span>`;
        if (q.invalid) return `<span>${sym}: N/A</span>`;
        return `<span>${sym}: $${q.price}</span>`;
    }).join(" ");

    tickerContent.innerHTML = html;
}

// initial + periodic refresh (cache prevents heavy network load)
renderTicker();
setInterval(renderTicker, QUOTE_CACHE_TTL_MS); // every 10 min

/* -----------------------------------------------------------
   SEARCH HANDLER
   ----------------------------------------------------------- */
searchInput.addEventListener("keypress", async (e) => {
    if (e.key !== "Enter") return;
    const symbol = safeUpper(e.target.value);

    if (!symbol) {
        stockInfo.innerHTML = "Please enter a stock symbol.";
        return;
    }

    stockInfo.innerHTML = `<p>Loading...</p>`;
    const q = await getQuote(symbol);

    if (q.error) {
        stockInfo.innerHTML = `<p>Error fetching data (network or CORS). Try again.</p>`;
        return;
    }
    if (q.invalid || !q.price) {
        stockInfo.innerHTML = `<p>Stock not found. Try AAPL, MSFT, META.</p>`;
        return;
    }

    stockInfo.innerHTML = `
        <h2>${symbol}</h2>
        <p><strong>Price:</strong> $${q.price}</p>
        <p><strong>Change:</strong> ${q.change}</p>
        <p><strong>Change %:</strong> ${q.changePct}</p>
    `;

    await fetchChartData(symbol);
});

/* -----------------------------------------------------------
   FETCH HISTORICAL DATA (Yahoo)
   ----------------------------------------------------------- */
async function fetchChartData(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const result = data?.chart?.result?.[0];

        if (!result) {
            stockInfo.innerHTML += `<p style="color:red;">(No historical data.)</p>`;
            return;
        }

        const { timestamp, indicators } = result;
        const closes = indicators?.quote?.[0]?.close;

        if (!timestamp || !closes) {
            stockInfo.innerHTML += `<p style="color:red;">(Incomplete historical data.)</p>`;
            return;
        }

        // Some close values can be null (market closed days) – filter
        const points = [];
        const labels = [];
        for (let i = 0; i < timestamp.length; i++) {
            const p = closes[i];
            if (p == null) continue;
            const d = new Date(timestamp[i] * 1000);
            labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
            points.push(Number(p));
        }

        renderChart(labels, points, symbol);
    } catch (err) {
        console.error("fetchChartData error:", err);
        stockInfo.innerHTML += `<p style="color:red;">(Failed to load chart.)</p>`;
    }
}

/* -----------------------------------------------------------
   CHART RENDER
   ----------------------------------------------------------- */
function renderChart(labels, dataPoints, symbol) {
    const canvas = document.getElementById('stockChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (stockChart) stockChart.destroy();

    stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: `${symbol} (Last 30 Days)`,
                data: dataPoints,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0,123,255,0.1)',
                fill: true,
                tension: 0.2,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: 'black' } }
            },
            scales: {
                x: { ticks: { color: 'black' } },
                y: { ticks: { color: 'black' } }
            }
        }
    });
}
