/* ------------ CONFIG ------------ */
const apiKey = "IWXEMN3H3LHZMIP8"; // your key
const topStocks = ["AAPL", "MSFT", "AMZN", "GOOGL", "META"];
const QUOTE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TICKER_CYCLE_DELAY_MS = 12000;       // 12s between ticker fetches -> <=5/min
/* -------------------------------- */

/* DOM refs */
const searchInput   = document.getElementById("search");
const stockInfo     = document.getElementById("stock-info");
const tickerContent = document.getElementById("ticker-content");
let stockChart;

/* cache {SYM: {price, change, changePct, ts}} */
const quoteCache = {};

/* util */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now   = () => Date.now();
const safeUpper = s => (s || "").trim().toUpperCase();
const isFresh = ts => now() - ts < QUOTE_CACHE_TTL_MS;

/* ------------ QUOTE FETCH (with cache + rate-limit detect) ------------ */
async function getQuote(symbol) {
    symbol = safeUpper(symbol);

    // cache hit?
    const cached = quoteCache[symbol];
    if (cached && isFresh(cached.ts)) return cached;

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        // console.log("QUOTE", symbol, data);

        if (data.Note || data.Information) {
            return { symbol, apiLimited: true, ts: now() };
        }

        const q = data["Global Quote"];
        if (!q || !q["05. price"]) {
            return { symbol, invalid: true, ts: now() };
        }

        const out = {
            symbol,
            price: parseFloat(q["05. price"]).toFixed(2),
            change: q["09. change"] ?? "—",
            changePct: q["10. change percent"] ?? "—",
            ts: now()
        };
        quoteCache[symbol] = out;
        return out;
    } catch (err) {
        return { symbol, error: true, ts: now() };
    }
}

/* ------------ TICKER BAR ------------ */
/* Fetch each symbol one at a time, spaced out, so we never exceed quota. */
async function cycleTickerFetch() {
    if (!tickerContent) return;

    let htmlParts = [];
    for (let i = 0; i < topStocks.length; i++) {
        const sym = topStocks[i];
        const q = await getQuote(sym);

        let frag;
        if (q.apiLimited) {
            frag = `<span>${sym}: API Limit</span>`;
        } else if (q.error) {
            frag = `<span>${sym}: Error</span>`;
        } else if (q.invalid || !q.price) {
            frag = `<span>${sym}: N/A</span>`;
        } else {
            frag = `<span>${sym}: $${q.price}</span>`;
        }

        htmlParts.push(frag);
        tickerContent.innerHTML = htmlParts.join(""); // update progressively

        // pause before next API call (except after the last one)
        if (i < topStocks.length - 1) {
            await sleep(TICKER_CYCLE_DELAY_MS);
        }
    }

    // after finishing all, wait long enough so the next full cycle won't hit limits
    await sleep(QUOTE_CACHE_TTL_MS); // 10m pause before fresh fetches
    cycleTickerFetch();              // repeat
}

// start ticker cycle
cycleTickerFetch();

/* ------------ SEARCH + DETAIL ------------ */
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
        stockInfo.innerHTML = `<p>Stock not found. Check ticker (try AAPL, MSFT, META).</p>`;
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

/* ------------ HISTORICAL DATA FOR CHART ------------ */
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

/* ------------ CHART RENDER ------------ */
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
