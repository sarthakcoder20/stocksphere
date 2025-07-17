/* ---------------- CONFIG ---------------- */
const apiKey = "IWXEMN3H3LHZMIP8"; // <-- your key
const topStocks = ["AAPL", "MSFT", "AMZN", "GOOGL", "META"]; // NYSE
const TICKER_REFRESH_MS = 180000;   // refresh display every 3m (uses cache)
const QUOTE_CACHE_TTL_MS = 10 * 60 * 1000; // 10m cache to avoid API hammering
/* ---------------------------------------- */

/* DOM */
const searchInput   = document.getElementById("search");
const stockInfo     = document.getElementById("stock-info");
const tickerContent = document.getElementById("ticker-content");
let stockChart;

/* In‑memory cache: {SYM: {price, change, changePct, ts}} */
const quoteCache = {};

/* ---------- Helpers ---------- */
function isFresh(ts) {
    return Date.now() - ts < QUOTE_CACHE_TTL_MS;
}

function safeUpper(s) {
    return (s || "").trim().toUpperCase();
}

/* Fetch a single real‑time quote (cached) */
async function getQuote(symbol) {
    symbol = safeUpper(symbol);

    // Use cache if fresh
    const cached = quoteCache[symbol];
    if (cached && isFresh(cached.ts)) return cached;

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        // console.log(symbol, data); // uncomment for debugging

        if (data.Note || data.Information) {
            // Rate limited
            return { symbol, apiLimited: true, ts: Date.now() };
        }

        const q = data["Global Quote"];
        if (!q || !q["05. price"]) {
            return { symbol, invalid: true, ts: Date.now() };
        }

        const out = {
            symbol,
            price: parseFloat(q["05. price"]).toFixed(2),
            change: q["09. change"] ?? "—",
            changePct: q["10. change percent"] ?? "—",
            ts: Date.now()
        };
        quoteCache[symbol] = out; // cache good result
        return out;
    } catch (err) {
        return { symbol, error: true, ts: Date.now() };
    }
}

/* ---------- Ticker Bar ---------- */
async function renderTicker() {
    if (!tickerContent) return;

    let html = "";
    for (const sym of topStocks) {
        const q = await getQuote(sym);

        if (q.apiLimited) {
            html += `<span>${sym}: API Limit</span>`;
        } else if (q.error) {
            html += `<span>${sym}: Error</span>`;
        } else if (q.invalid || !q.price) {
            html += `<span>${sym}: N/A</span>`;
        } else {
            html += `<span>${sym}: $${q.price}</span>`;
        }
    }
    tickerContent.innerHTML = html;
}

// Initial render + periodic refresh (uses cache; few actual API calls)
renderTicker();
setInterval(renderTicker, TICKER_REFRESH_MS);

/* ---------- Search & Detail ---------- */
searchInput.addEventListener("keypress", async (e) => {
    if (e.key !== "Enter") return;

    const symbol = safeUpper(e.target.value);
    if (!symbol) {
        stockInfo.innerHTML = "Please enter a stock symbol.";
        return;
    }

    stockInfo.innerHTML = `<p>Loading...</p>`;

    const q = await getQuote(symbol);

    if (q.apiLimited) {
        stockInfo.innerHTML = `<p>API limit reached. Please wait a minute and try again.</p>`;
        return;
    }
    if (q.error) {
        stockInfo.innerHTML = `<p>Error fetching data. Please try again.</p>`;
        return;
    }
    if (q.invalid || !q.price) {
        stockInfo.innerHTML = `<p>Stock not found. Try another symbol.</p>`;
        return;
    }

    // Show quote
    stockInfo.innerHTML = `
        <h2>${symbol}</h2>
        <p><strong>Price:</strong> $${q.price}</p>
        <p><strong>Change:</strong> ${q.change}</p>
        <p><strong>Change %:</strong> ${q.changePct}</p>
    `;

    // Fetch historical data for chart
    await fetchChartData(symbol);
});

/* ---------- Historical Chart ---------- */
async function fetchChartData(symbol) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        // console.log("HIST", symbol, data);

        if (data.Note || data.Information) {
            stockInfo.innerHTML += `<p style="color:red;">(Historical data unavailable: API limit reached.)</p>`;
            return;
        }

        const ts = data["Time Series (Daily)"];
        if (!ts) {
            stockInfo.innerHTML += `<p style="color:red;">(No historical data.)</p>`;
            return;
        }

        const dates = Object.keys(ts).slice(0, 30).reverse();
        const prices = dates.map(d => parseFloat(ts[d]["4. close"]));
        renderChart(dates, prices, symbol);
    } catch (err) {
        stockInfo.innerHTML += `<p style="color:red;">(Failed to load chart.)</p>`;
    }
}

/* ---------- Chart Render ---------- */
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
                label: `${symbol} Stock Price (Last 30 Days)`,
                data: dataPoints,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0,123,255,0.1)',
                fill: true,
                tension: 0.2,
                pointRadius: 2,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: 'black' } },
                tooltip: { mode: 'index', intersect: false }
            },
            interaction: { mode: 'nearest', intersect: false },
            scales: {
                x: { ticks: { color: 'black' } },
                y: { ticks: { color: 'black' } }
            }
        }
    });
}
