/* ------------ CONFIG ------------ */
const topStocks = ["AAPL", "MSFT", "AMZN", "GOOGL", "META"];
const apiKey = "YOUR_ALPHA_VANTAGE_KEY";
/* -------------------------------- */

const searchInput = document.getElementById("search");
const stockInfo = document.getElementById("stock-info");
const tickerContent = document.getElementById("ticker-content");
let stockChart;

/* ------------ Ticker Bar (Names Only) ------------ */
function renderTickerNames() {
    const html = topStocks.map(sym => `<span>${sym}</span>`).join(" ");
    tickerContent.innerHTML = html;
}
renderTickerNames();

/* ------------ SEARCH + DETAIL ------------ */
searchInput.addEventListener("keypress", async (e) => {
    if (e.key !== "Enter") return;

    const symbol = (e.target.value || "").trim().toUpperCase();
    if (!symbol) {
        stockInfo.innerHTML = "Please enter a stock symbol.";
        return;
    }

    stockInfo.innerHTML = `<p>Loading...</p>`;
    const q = await fetchQuote(symbol);

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

/* ------------ Fetch Stock Quote ------------ */
async function fetchQuote(symbol) {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.Note || data.Information) return { error: "API limit reached" };
        const q = data["Global Quote"];
        if (!q || !q["05. price"]) return { error: "Stock not found" };

        return {
            price: parseFloat(q["05. price"]).toFixed(2),
            change: q["09. change"],
            changePct: q["10. change percent"]
        };
    } catch {
        return { error: "Failed to fetch data" };
    }
}

/* ------------ Fetch Historical Data ------------ */
async function fetchChartData(symbol) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.Note || data.Information) {
            stockInfo.innerHTML += `<p style="color:red;">(API limit for chart reached.)</p>`;
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
    } catch {
        stockInfo.innerHTML += `<p style="color:red;">(Failed to load chart.)</p>`;
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
