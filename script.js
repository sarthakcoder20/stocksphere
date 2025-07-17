/* ------------ CONFIG ------------ */
const apiKey = "YOUR_ALPHA_VANTAGE_KEY";
const topStocks = ["AAPL", "MSFT", "AMZN", "GOOGL", "META"];
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min cache
/* -------------------------------- */

const searchInput = document.getElementById("search");
const stockInfo = document.getElementById("stock-info");
const tickerContent = document.getElementById("ticker-content");
let stockChart;
const cache = {}; // {SYM: {price, ts}}

/* Helpers */
const now = () => Date.now();
const safeUpper = s => (s || "").trim().toUpperCase();
const isFresh = ts => now() - ts < CACHE_TTL_MS;

/* ------------ Fetch Stock Quote ------------ */
async function getQuote(symbol) {
    symbol = safeUpper(symbol);

    if (cache[symbol] && isFresh(cache[symbol].ts)) {
        return cache[symbol];
    }

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.Note || data.Information) {
            return { error: "API limit reached" };
        }

        const q = data["Global Quote"];
        if (!q || !q["05. price"]) {
            return { error: "Invalid symbol" };
        }

        const result = {
            price: parseFloat(q["05. price"]).toFixed(2),
            change: q["09. change"],
            changePct: q["10. change percent"],
            ts: now()
        };
        cache[symbol] = result;
        return result;
    } catch {
        return { error: "Fetch failed" };
    }
}

/* ------------ Ticker Bar ------------ */
async function renderTicker() {
    let html = "";

    for (const sym of topStocks) {
        const q = await getQuote(sym);
        if (q.error) {
            html += `<span>${sym}: ${q.error.includes("limit") ? "API Limit" : "N/A"}</span>`;
        } else {
            html += `<span>${sym}: $${q.price}</span>`;
        }
        await new Promise(r => setTimeout(r, 12000)); // 12s delay per symbol (to avoid hitting limit)
    }

    tickerContent.innerHTML = html;

    setTimeout(renderTicker, CACHE_TTL_MS); // refresh every 10 min
}

renderTicker();

/* ------------ Search + Detail ------------ */
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
        stockInfo.innerHTML = `<p>${q.error}. Try again later.</p>`;
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

/* ------------ Historical Data ------------ */
async function fetchChartData(symbol) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.Note || data.Information) {
            stockInfo.innerHTML += `<p style="color:red;">API limit reached for historical data.</p>`;
            return;
        }

        const ts = data["Time Series (Daily)"];
        if (!ts) {
            stockInfo.innerHTML += `<p style="color:red;">No historical data found.</p>`;
            return;
        }

        const dates = Object.keys(ts).slice(0, 30).reverse();
        const prices = dates.map(d => parseFloat(ts[d]["4. close"]));

        renderChart(dates, prices, symbol);
    } catch {
        stockInfo.innerHTML += `<p style="color:red;">Failed to load chart.</p>`;
    }
}

/* ------------ Render Chart ------------ */
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
                tension: 0.2
            }]
        }
    });
}
