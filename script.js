const apiKey = "YOUR_API_KEY"; // Replace with your Alpha Vantage API key
const searchInput = document.getElementById("search");
const stockInfo = document.getElementById("stock-info");

searchInput.addEventListener("keypress", async (e) => {
    if (e.key === "Enter") {
        const symbol = e.target.value.toUpperCase();
        if (!symbol) {
            stockInfo.innerHTML = "Please enter a stock symbol.";
            return;
        }

        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;

        stockInfo.innerHTML = `<p>Loading...</p>`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data["Global Quote"] && data["Global Quote"]["05. price"]) {
                const quote = data["Global Quote"];
                stockInfo.innerHTML = `
                    <h2>${symbol}</h2>
                    <p><strong>Price:</strong> $${quote["05. price"]}</p>
                    <p><strong>Change:</strong> ${quote["09. change"]}</p>
                    <p><strong>Change %:</strong> ${quote["10. change percent"]}</p>
                `;
            } else {
                stockInfo.innerHTML = `<p>Stock not found. Try another symbol.</p>`;
            }
        } catch (error) {
            stockInfo.innerHTML = `<p>Error fetching data. Please try again.</p>`;
        }
    }
});
