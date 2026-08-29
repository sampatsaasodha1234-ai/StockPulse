const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

// ======================================================
// UPSTOX ACCESS TOKEN
// ======================================================

const UPSTOX_ACCESS_TOKEN = "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI3QUJQNlQiLCJqdGkiOiI2YTg5MWZmNjg2YjRlNTc1YWY2MzY5OTciLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6dHJ1ZSwiaXNFeHRlbmRlZCI6dHJ1ZSwiaWF0IjoxNzg3MzcxNTEwLCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE4MTg5NzIwMDB9.M4BEZAY396h1SZiyjLryifnoYGLXoePVgsB6N17B8Tk";

// ======================================================
// SETTINGS
// ======================================================

app.use(cors());
app.use(express.json());

// ======================================================
// UPSTOX API HELPER
// ======================================================

async function getUpstoxData(instrumentKey) {
    const url =
        "https://api.upstox.com/v2/market-quote/ltp?instrument_key=" +
        encodeURIComponent(instrumentKey);

    const response = await fetch(url, {
        method: "GET",
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${UPSTOX_ACCESS_TOKEN}`
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.errors?.[0]?.message || "Upstox API request failed"
        );
    }

    return data;
}

// ======================================================
// NIFTY 50
// ======================================================

app.get("/api/nifty", async (req, res) => {
    try {
        const data = await getUpstoxData("NSE_INDEX|Nifty 50");

        const nifty = data.data["NSE_INDEX:Nifty 50"];

        if (!nifty) {
            return res.status(404).json({
                success: false,
                error: "NIFTY 50 data not found"
            });
        }

        res.json({
            success: true,
            name: "NIFTY 50",
            price: nifty.last_price
        });

    } catch (error) {
        console.error("NIFTY ERROR:", error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ======================================================
// BANK NIFTY
// ======================================================

app.get("/api/banknifty", async (req, res) => {
    try {
        const data = await getUpstoxData("NSE_INDEX|Nifty Bank");

        const bankNifty = data.data["NSE_INDEX:Nifty Bank"];

        if (!bankNifty) {
            return res.status(404).json({
                success: false,
                error: "BANK NIFTY data not found"
            });
        }

        res.json({
            success: true,
            name: "BANK NIFTY",
            price: bankNifty.last_price
        });

    } catch (error) {
        console.error("BANK NIFTY ERROR:", error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ======================================================
// SENSEX
// ======================================================

app.get("/api/sensex", async (req, res) => {
    try {
        const data = await getUpstoxData("BSE_INDEX|SENSEX");

        const sensex = data.data["BSE_INDEX:SENSEX"];

        if (!sensex) {
            return res.status(404).json({
                success: false,
                error: "SENSEX data not found"
            });
        }

        res.json({
            success: true,
            name: "SENSEX",
            price: sensex.last_price
        });

    } catch (error) {
        console.error("SENSEX ERROR:", error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ======================================================
// INDIVIDUAL STOCK
//
// Example:
// /api/stock?symbol=RELIANCE
// ======================================================

app.get("/api/stock", async (req, res) => {
    try {
        const symbol = req.query.symbol;

        if (!symbol) {
            return res.status(400).json({
                success: false,
                error: "Please provide stock symbol"
            });
        }

        const cleanSymbol = symbol.toUpperCase().trim();

        // NSE equity instrument key
        const instrumentKey = `NSE_EQ|${cleanSymbol}`;

        const data = await getUpstoxData(instrumentKey);

        const stockKey = `NSE_EQ:${cleanSymbol}`;

        const stock = data.data[stockKey];

        if (!stock) {
            return res.status(404).json({
                success: false,
                error: `Stock ${cleanSymbol} not found`
            });
        }

        res.json({
            success: true,
            symbol: cleanSymbol,
            price: stock.last_price
        });

    } catch (error) {
        console.error("STOCK ERROR:", error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ======================================================
// HOME / SERVER STATUS
// ======================================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "StockPulse API Server is running",
        endpoints: [
            "/api/nifty",
            "/api/banknifty",
            "/api/sensex",
            "/api/stock?symbol=RELIANCE"
        ]
    });
});

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {
    console.log(
        `StockPulse server running at http://localhost:${PORT}`
    );
});