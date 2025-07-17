/* ------------ CONFIG ------------ */
const apiKey = "YOUR_API_KEY"; // <-- replace with your Alpha Vantage key
/* -------------------------------- */

const searchInput = document.getElementById("search");
const stockInfo   = document.getElementById("stock-info");
let stockChart;

/* Detect currency: INR for NSE/BSE, else USD */
function currencyFor(symbol) {
    const s = symbol.toUpperCase();
    if (s.endsWith(".NSE") || s.endsWith(".BSE")) return "₹";
    return "$";
}

/* ------------ SEARCH HANDLER ------------ */
searchInput.addEventListener("keypress", async (e) => {
    if (e.key !== "Enter") return;

    const symbol = (e.target.value || "").trim().toUpperCase();
    if (!symbol) {
        stockInfo.innerHTML = "Please enter a stock symbol.";
        return;
    }

    stockInfo.innerHTML = `<p>Loading...</p>`;
    const quote = await fetchQuote(symbol);

    if (quote.error) {
        stockInfo.innerHTML = `<p>${quote.error}</p>`;
        return;
    }

    const curr = currencyFor(symbol);
    stockInfo.innerHTML = `
        <h2>${symbol}</h2>
        <p><strong>Price:</strong> ${curr}${quote.price}</p>
        <p><strong>Change:</strong> ${quote.change ?? "—"}</p>
        <p><strong>Change %:</strong> ${quote.changePct ?? "—"}</p>
    `;

    await fetchChartData(symbol, curr);
});

/* ------------ FETCH QUOTE ------------ */
async function fetchQuote(symbol) {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.Note || data.Information) {
            return { error: "API limit reached. Please wait and try again." };
        }

        const q = data["Global Quote"];
        if (!q || !q["05. price"]) {
            return { error: "Stock not found." };
        }

        return {
            price: parseFloat(q["05. price"]).toFixed(2),
            change: q["09. change"],
            changePct: q["10. change percent"]
        };
    } catch {
        return { error: "Error fetching data. Please try again." };
    }
}

/* ------------ FETCH HISTORICAL DATA ------------ */
async function fetchChartData(symbol, currSymbol) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.Note || data.Information) {
            stockInfo.innerHTML += `<p style="color:red;">(Chart unavailable: API limit reached.)</p>`;
            return;
        }

        const ts = data["Time Series (Daily)"];
        if (!ts) {
            stockInfo.innerHTML += `<p style="color:red;">(No historical data.)</p>`;
            return;
        }

        // Last 30 entries, newest first in object → slice then reverse to chronological
        const dates = Object.keys(ts).slice(0, 30).reverse();
        const prices = dates.map(d => parseFloat(ts[d]["4. close"]));

        renderChart(dates, prices, symbol, currSymbol);
    } catch {
        stockInfo.innerHTML += `<p style="color:red;">(Failed to load chart.)</p>`;
    }
}

/* ------------ RENDER CHART ------------ */
function renderChart(labels, dataPoints, symbol, currSymbol) {
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
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${currSymbol}${ctx.parsed.y}`
                    }
                },
                legend: { labels: { color: 'black' } }
            },
            scales: {
                x: { ticks: { color: 'black' } },
                y: { ticks: { color: 'black' } }
            }
        }
    });
}
