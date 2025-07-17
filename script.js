/* ------------ CONFIG ------------ */
const topStocks = ["AAPL", "MSFT", "AMZN", "GOOGL", "META"];
const QUOTE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min cache
const TICKER_CYCLE_DELAY_MS = 5000; // 5s between calls
/* -------------------------------- */

const searchInput = document.getElementById("search");
const stockInfo = document.getElementById("stock-info");
const tickerContent = document.getElementById("ticker-content");
let stockChart;
const quoteCache = {};

/* Helpers */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Date.now();
const safeUpper = s => (s || "").trim().toUpperCase();
const isFresh = ts => now() - ts < QUOTE_CACHE_TTL_MS;

/* ------------ FETCH QUOTE (Yahoo) ------------ */
async function getQuote(symbol) {
    symbol = safeUpper(symbol);
    const cached = quoteCache[symbol];
    if (cached && isFresh(cached.ts)) return cached;

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        const quote = data.quoteResponse.result[0];

        if (!quote || !quote.regularMarketPrice) {
            return { symbol, invalid: true, ts: now() };
        }

        const result = {
            symbol,
            price: quote.regularMarketPrice.toFixed(2),
            change: (quote.regularMarketChange || 0).toFixed(2),
            changePct: (quote.regularMarketChangePercent || 0).toFixed(2) + "%",
            ts: now()
        };

        quoteCache[symbol] = result;
        return result;
    } catch {
        return { symbol, error: true, ts: now() };
    }
}

/* ------------ TICKER BAR ------------ */
async function cycleTickerFetch() {
    if (!tickerContent) return;

    while (true) {
        let htmlParts = [];

        for (let i = 0; i < topStocks.length; i++) {
            const sym = topStocks[i];
            const q = await getQuote(sym);

            let frag;
            if (q.error) frag = `<span>${sym}: Error</span>`;
            else if (q.invalid || !q.price) frag = `<span>${sym}: N/A</span>`;
            else frag = `<span>${sym}: $${q.price}</span>`;

            htmlParts.push(frag);
            tickerContent.innerHTML = htmlParts.join(" ");

            if (i < topStocks.length - 1) await sleep(TICKER_CYCLE_DELAY_MS);
        }

        await sleep(QUOTE_CACHE_TTL_MS);
    }
}
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

    if (q.error) {
        stockInfo.innerHTML = `<p>Error fetching data. Try again.</p>`;
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

/* ------------ HISTORICAL DATA (Yahoo) ------------ */
async function fetchChartData(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        const chart = data.chart.result[0];

        if (!chart || !chart.timestamp) {
            stockInfo.innerHTML += `<p style="color:red;">(No historical data.)</p>`;
            return;
        }

        const dates = chart.timestamp.map(ts => {
            const d = new Date(ts * 1000);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        });

        const prices = chart.indicators.quote[0].close;

        renderChart(dates, prices, symbol);
    } catch {
        stockInfo.innerHTML += `<p style="color:red;">(Failed to load chart.)</p>`;
    }
}

/* ------------ CHART RENDER ------------ */
function renderChart(labels, dataPoints, symbol) {
    const ctx = document.getElementById('stockChart').getContext('2d');
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
