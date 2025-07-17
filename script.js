const apiKey = "YOUR_API_KEY"; // Replace with your Alpha Vantage API key
const searchInput = document.getElementById("search");
const stockInfo = document.getElementById("stock-info");
let stockChart; // For updating the chart later

// Event listener for Enter key
searchInput.addEventListener("keypress", async (e) => {
    if (e.key === "Enter") {
        const symbol = e.target.value.toUpperCase();
        if (!symbol) {
            stockInfo.innerHTML = "Please enter a stock symbol.";
            return;
        }

        // Show loading
        stockInfo.innerHTML = `<p>Loading...</p>`;

        try {
            // Fetch current price
            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data["Global Quote"] && data["Global Quote"]["05. price"]) {
                const quote = data["Global Quote"];
                stockInfo.innerHTML = `
                    <h2>${symbol}</h2>
                    <p><strong>Price:</strong> ₹${quote["05. price"]}</p>
                    <p><strong>Change:</strong> ${quote["09. change"]}</p>
                    <p><strong>Change %:</strong> ${quote["10. change percent"]}</p>
                `;

                // Fetch historical data for the chart
                await fetchChartData(symbol);
            } else {
                stockInfo.innerHTML = `<p>Stock not found. Try another symbol.</p>`;
            }
        } catch (error) {
            stockInfo.innerHTML = `<p>Error fetching data. Please try again.</p>`;
        }
    }
});

// Fetch historical data and render chart
async function fetchChartData(symbol) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    const timeSeries = data["Time Series (Daily)"];

    if (!timeSeries) return;

    // Get last 30 days of data
    const dates = Object.keys(timeSeries).slice(0, 30).reverse();
    const prices = dates.map(date => parseFloat(timeSeries[date]["4. close"]));

    renderChart(dates, prices, symbol);
}

// Render or update the chart
function renderChart(labels, dataPoints, symbol) {
    const ctx = document.getElementById('stockChart').getContext('2d');

    if (stockChart) {
        stockChart.destroy(); // Remove old chart before creating new
    }

    stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${symbol} Stock Price (Last 30 Days)`,
                data: dataPoints,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0,123,255,0.1)',
                fill: true,
                tension: 0.2
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
