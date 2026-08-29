// ======================================================
// STOCKPULSE - SERVER
// Upstox + Delta Exchange + Razorpay
// LIVE PRICES + REAL CANDLES
// Dynamic NSE Stock Search
// Premium Payment + Premium Signals
// ======================================================

"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Razorpay = require("razorpay");

const app = express();
const PORT = 3000;

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());

// ======================================================
// UPSTOX ACCESS TOKEN
// ======================================================

// APNA ACTUAL UPSTOX ACCESS TOKEN YAHAN RAKHO
const UPSTOX_ACCESS_TOKEN = "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI3QUJQNlQiLCJqdGkiOiI2YTg5MWZmNjg2YjRlNTc1YWY2MzY5OTciLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6dHJ1ZSwiaXNFeHRlbmRlZCI6dHJ1ZSwiaWF0IjoxNzg3MzcxNTEwLCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE4MTg5NzIwMDB9.M4BEZAY396h1SZiyjLryifnoYGLXoePVgsB6N17B8Tk";

// ======================================================
// UPSTOX
// ======================================================

const UPSTOX_API = "https://api.upstox.com";

function upstoxHeaders() {
    return {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${UPSTOX_ACCESS_TOKEN}`
    };
}

async function upstoxFetch(url) {

    const response = await fetch(url, {
        method: "GET",
        headers: upstoxHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.errors?.[0]?.message ||
            data.message ||
            "Upstox API request failed"
        );
    }

    return data;
}

async function getUpstoxData(instrumentKey) {

    const url =
        `${UPSTOX_API}/v2/market-quote/ltp` +
        `?instrument_key=${encodeURIComponent(instrumentKey)}`;

    return await upstoxFetch(url);
}

// ======================================================
// STATIC INSTRUMENTS
// ======================================================

const STATIC_INSTRUMENTS = {

    NIFTY50:
        "NSE_INDEX|Nifty 50",

    BANKNIFTY:
        "NSE_INDEX|Nifty Bank",

    NIFTYIT:
        "NSE_INDEX|Nifty IT",

    SENSEX:
        "BSE_INDEX|SENSEX",

    RELIANCE:
        "NSE_EQ|INE002A01018",

    TCS:
        "NSE_EQ|INE467B01029",

    ITC:
        "NSE_EQ|INE154A01025"
};

// ======================================================
// INDEX PRICE HELPER
// ======================================================

async function sendIndexPrice(
    res,
    name,
    instrumentKey,
    responseKey
) {

    try {

        const data =
            await getUpstoxData(instrumentKey);

        const index =
            data.data?.[responseKey];

        if (!index) {

            return res.status(404).json({
                success: false,
                error: `${name} data not found`
            });

        }

        const price =
            Number(index.last_price);

        if (!Number.isFinite(price)) {

            return res.status(502).json({
                success: false,
                error: `${name} price is invalid`
            });

        }

        res.json({
            success: true,
            name,
            price
        });

    } catch (error) {

        console.error(
            `${name} ERROR:`,
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// ======================================================
// INDEX ROUTES
// ======================================================

app.get("/api/nifty", async (req, res) => {

    await sendIndexPrice(
        res,
        "NIFTY 50",
        "NSE_INDEX|Nifty 50",
        "NSE_INDEX:Nifty 50"
    );

});

app.get("/api/banknifty", async (req, res) => {

    await sendIndexPrice(
        res,
        "BANK NIFTY",
        "NSE_INDEX|Nifty Bank",
        "NSE_INDEX:Nifty Bank"
    );

});

app.get("/api/niftyit", async (req, res) => {

    await sendIndexPrice(
        res,
        "NIFTY IT",
        "NSE_INDEX|Nifty IT",
        "NSE_INDEX:Nifty IT"
    );

});

app.get("/api/sensex", async (req, res) => {

    await sendIndexPrice(
        res,
        "SENSEX",
        "BSE_INDEX|SENSEX",
        "BSE_INDEX:SENSEX"
    );

});

// ======================================================
// FIND NSE INSTRUMENT
// ======================================================

async function findNSEInstrument(symbol) {

    const query =
        String(symbol || "")
            .trim()
            .toUpperCase();

    if (!query) {
        return null;
    }

    if (
        STATIC_INSTRUMENTS[query] &&
        STATIC_INSTRUMENTS[query].startsWith("NSE_EQ|")
    ) {

        return {
            instrumentKey:
                STATIC_INSTRUMENTS[query],
            symbol: query,
            name: query,
            exchange: "NSE"
        };

    }

    const url =
        `${UPSTOX_API}/v2/instruments/search` +
        `?query=${encodeURIComponent(query)}` +
        `&exchanges=NSE` +
        `&segments=EQ` +
        `&page_number=1` +
        `&records=30`;

    const data =
        await upstoxFetch(url);

    const results =
        Array.isArray(data.data)
            ? data.data
            : [];

    if (!results.length) {
        return null;
    }

    let match =
        results.find(item =>
            String(item.trading_symbol || "")
                .toUpperCase() === query &&
            String(item.segment || "")
                .toUpperCase() === "NSE_EQ"
        );

    if (!match) {

        match =
            results.find(item => {

                const tradingSymbol =
                    String(item.trading_symbol || "")
                        .toUpperCase();

                const shortName =
                    String(item.short_name || "")
                        .toUpperCase();

                const name =
                    String(item.name || "")
                        .toUpperCase();

                return (
                    tradingSymbol === query ||
                    shortName === query ||
                    name === query
                );

            });

    }

    if (!match) {

        match =
            results.find(item =>
                String(item.segment || "")
                    .toUpperCase() === "NSE_EQ"
            );

    }

    if (!match) {
        return null;
    }

    return {

        instrumentKey:
            match.instrument_key,

        symbol:
            match.trading_symbol || query,

        name:
            match.name || query,

        exchange:
            match.exchange || "NSE"

    };
}

// ======================================================
// SEARCH
// ======================================================

app.get("/api/search", async (req, res) => {

    try {

        const query =
            String(req.query.q || "")
                .trim()
                .toUpperCase();

        if (!query) {

            return res.status(400).json({
                success: false,
                error: "Please provide search query"
            });

        }

        const url =
            `${UPSTOX_API}/v2/instruments/search` +
            `?query=${encodeURIComponent(query)}` +
            `&exchanges=NSE` +
            `&segments=EQ` +
            `&page_number=1` +
            `&records=20`;

        const data =
            await upstoxFetch(url);

        const results =
            Array.isArray(data.data)
                ? data.data
                : [];

        const stocks =
            results
                .filter(item =>
                    String(item.segment || "")
                        .toUpperCase() === "NSE_EQ"
                )
                .map(item => ({

                    symbol:
                        item.trading_symbol ||
                        item.short_name ||
                        "",

                    name:
                        item.name || "",

                    instrumentKey:
                        item.instrument_key,

                    exchange:
                        item.exchange || "NSE"

                }))
                .filter(item => item.symbol);

        res.json({

            success: true,
            query,
            count: stocks.length,
            results: stocks

        });

    } catch (error) {

        console.error(
            "SEARCH ERROR:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});

// ======================================================
// STOCK PRICE
// ======================================================

app.get("/api/stock", async (req, res) => {

    try {

        const symbol =
            String(req.query.symbol || "")
                .toUpperCase()
                .trim();

        if (!symbol) {

            return res.status(400).json({
                success: false,
                error: "Please provide stock symbol"
            });

        }

        const instrument =
            await findNSEInstrument(symbol);

        if (!instrument) {

            return res.status(404).json({
                success: false,
                error:
                    `Stock ${symbol} not found on NSE`
            });

        }

        const data =
            await getUpstoxData(
                instrument.instrumentKey
            );

        const stock =
            Object.values(data.data || {})[0];

        if (!stock) {

            return res.status(404).json({
                success: false,
                error:
                    `Stock ${symbol} data not found`
            });

        }

        const price =
            Number(stock.last_price);

        if (!Number.isFinite(price)) {

            return res.status(502).json({
                success: false,
                error:
                    `${symbol} price is invalid`
            });

        }

        res.json({

            success: true,

            symbol,

            name:
                instrument.name || symbol,

            instrumentKey:
                instrument.instrumentKey,

            price

        });

    } catch (error) {

        console.error(
            "STOCK ERROR:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});

// ======================================================
// DELTA EXCHANGE
// ======================================================

const DELTA_API_URL =
    "https://api.india.delta.exchange";

async function getDeltaTicker(symbol) {

    const url =
        `${DELTA_API_URL}/v2/tickers/` +
        `${encodeURIComponent(symbol)}`;

    const response =
        await fetch(url, {

            method: "GET",

            headers: {
                Accept: "application/json",
                "User-Agent": "StockPulse/1.0"
            }

        });

    const data =
        await response.json();

    if (
        !response.ok ||
        !data.success
    ) {

        throw new Error(
            data.error?.message ||
            data.error ||
            "Delta ticker API failed"
        );

    }

    return data.result;
}

// ======================================================
// CRYPTO SYMBOLS
// ======================================================

const CRYPTO_SYMBOLS = {

    BTC: "BTCUSD",
    ETH: "ETHUSD",
    SOL: "SOLUSD",
    XRP: "XRPUSD"

};

// ======================================================
// CRYPTO PRICE
// ======================================================

app.get("/api/crypto", async (req, res) => {

    try {

        const symbol =
            String(req.query.symbol || "")
                .toUpperCase()
                .trim();

        if (!symbol) {

            return res.status(400).json({
                success: false,
                error:
                    "Please provide crypto symbol"
            });

        }

        const deltaSymbol =
            CRYPTO_SYMBOLS[symbol];

        if (!deltaSymbol) {

            return res.status(404).json({
                success: false,
                error:
                    `Crypto ${symbol} is not configured`
            });

        }

        const ticker =
            await getDeltaTicker(deltaSymbol);

        const price =
            ticker.close ??
            ticker.mark_price ??
            ticker.last_price;

        if (
            price === undefined ||
            price === null
        ) {

            return res.status(404).json({
                success: false,
                error:
                    `${symbol} price not available`
            });

        }

        res.json({

            success: true,

            symbol,

            deltaSymbol,

            price:
                Number(price)

        });

    } catch (error) {

        console.error(
            "CRYPTO ERROR:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});

// ======================================================
// TIMEFRAME CONFIG
// ======================================================

function getTimeframeConfig(timeframe) {

    const tf =
        String(timeframe || "1m")
            .toLowerCase()
            .trim();

    const configs = {

        "1m": {
            unit: "minutes",
            interval: "1"
        },

        "2m": {
            unit: "minutes",
            interval: "2"
        },

        "3m": {
            unit: "minutes",
            interval: "3"
        },

        "5m": {
            unit: "minutes",
            interval: "5"
        },

        "10m": {
            unit: "minutes",
            interval: "10"
        },

        "15m": {
            unit: "minutes",
            interval: "15"
        },

        "30m": {
            unit: "minutes",
            interval: "30"
        },

        "1h": {
            unit: "hours",
            interval: "1"
        },

        "2h": {
            unit: "hours",
            interval: "2"
        },

        "4h": {
            unit: "hours",
            interval: "4"
        },

        "1d": {
            unit: "days",
            interval: "1"
        },

        "1w": {
            unit: "weeks",
            interval: "1"
        },

        "1mth": {
            unit: "months",
            interval: "1"
        }

    };

    return configs[tf] || null;
}

// ======================================================
// IST DATE
// ======================================================

function getISTDate(daysAgo = 0) {

    const now =
        new Date();

    now.setUTCDate(
        now.getUTCDate() - daysAgo
    );

    return new Intl.DateTimeFormat(
        "en-CA",
        {

            timeZone: "Asia/Kolkata",

            year: "numeric",
            month: "2-digit",
            day: "2-digit"

        }
    ).format(now);

}

// ======================================================
// UPSTOX CANDLES
// ======================================================

async function getUpstoxCandles(
    instrumentKey,
    timeframe
) {

    const config =
        getTimeframeConfig(timeframe);

    if (!config) {
        throw new Error("Invalid timeframe");
    }

    if (
        ["minutes", "hours"]
            .includes(config.unit)
    ) {

        const url =
            `${UPSTOX_API}` +
            `/v3/historical-candle/intraday/` +
            `${encodeURIComponent(instrumentKey)}/` +
            `${config.unit}/` +
            `${config.interval}`;

        return await upstoxFetch(url);
    }

    let daysBack = 365;

    if (config.unit === "weeks") {
        daysBack = 365 * 3;
    }

    if (config.unit === "months") {
        daysBack = 365 * 5;
    }

    const toDate =
        getISTDate(0);

    const fromDate =
        getISTDate(daysBack);

    const url =
        `${UPSTOX_API}` +
        `/v3/historical-candle/` +
        `${encodeURIComponent(instrumentKey)}/` +
        `${config.unit}/` +
        `${config.interval}/` +
        `${toDate}/` +
        `${fromDate}`;

    return await upstoxFetch(url);
}

// ======================================================
// FORMAT UPSTOX CANDLES
// ======================================================

function formatUpstoxCandles(rawCandles) {

    if (!Array.isArray(rawCandles)) {
        return [];
    }

    return rawCandles

        .map(candle => {

            if (
                !Array.isArray(candle) ||
                candle.length < 5
            ) {
                return null;
            }

            const time = candle[0];

            const open =
                Number(candle[1]);

            const high =
                Number(candle[2]);

            const low =
                Number(candle[3]);

            const close =
                Number(candle[4]);

            const volume =
                Number(candle[5] || 0);

            if (
                !time ||
                !Number.isFinite(open) ||
                !Number.isFinite(high) ||
                !Number.isFinite(low) ||
                !Number.isFinite(close)
            ) {
                return null;
            }

            return {
                time,
                open,
                high,
                low,
                close,
                volume
            };

        })

        .filter(Boolean)

        .sort((a, b) => {

            const ta =
                new Date(a.time).getTime();

            const tb =
                new Date(b.time).getTime();

            return ta - tb;

        });

}

// ======================================================
// STOCK / INDEX CANDLES
// ======================================================

app.get("/api/candles", async (req, res) => {

    try {

        const symbol =
            String(req.query.symbol || "")
                .toUpperCase()
                .trim();

        const timeframe =
            String(req.query.timeframe || "1m")
                .toLowerCase()
                .trim();

        if (!symbol) {

            return res.status(400).json({
                success: false,
                error: "Please provide symbol"
            });

        }

        const config =
            getTimeframeConfig(timeframe);

        if (!config) {

            return res.status(400).json({
                success: false,
                error: "Invalid timeframe"
            });

        }

        let instrumentKey =
            STATIC_INSTRUMENTS[symbol];

        let instrumentName =
            symbol;

        if (!instrumentKey) {

            const instrument =
                await findNSEInstrument(symbol);

            if (!instrument) {

                return res.status(404).json({
                    success: false,
                    error:
                        `${symbol} instrument not found on NSE`
                });

            }

            instrumentKey =
                instrument.instrumentKey;

            instrumentName =
                instrument.name || symbol;

        }

        const data =
            await getUpstoxCandles(
                instrumentKey,
                timeframe
            );

        const rawCandles =
            Array.isArray(data.data?.candles)
                ? data.data.candles
                : [];

        const candles =
            formatUpstoxCandles(
                rawCandles
            );

        if (!candles.length) {

            return res.status(502).json({
                success: false,
                error:
                    "Upstox returned no valid candles"
            });

        }

        res.json({

            success: true,

            symbol,

            name:
                instrumentName,

            instrumentKey,

            timeframe,

            count:
                candles.length,

            candles

        });

    } catch (error) {

        console.error(
            "UPSTOX CANDLE ERROR:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});

// ======================================================
// DELTA RESOLUTIONS
// ======================================================

const DELTA_RESOLUTIONS = {

    "1m": { seconds: 60 },
    "3m": { seconds: 180 },
    "5m": { seconds: 300 },
    "15m": { seconds: 900 },
    "30m": { seconds: 1800 },
    "1h": { seconds: 3600 },
    "2h": { seconds: 7200 },
    "4h": { seconds: 14400 },
    "6h": { seconds: 21600 },
    "1d": { seconds: 86400 },
    "1w": { seconds: 604800 }

};

// ======================================================
// NORMALIZE DELTA CANDLE
// ======================================================

function normalizeDeltaCandle(candle) {

    if (Array.isArray(candle)) {

        if (candle.length < 5) {
            return null;
        }

        const time =
            Number(candle[0]);

        const open =
            Number(candle[1]);

        const high =
            Number(candle[2]);

        const low =
            Number(candle[3]);

        const close =
            Number(candle[4]);

        const volume =
            Number(candle[5] || 0);

        if (
            !Number.isFinite(time) ||
            !Number.isFinite(open) ||
            !Number.isFinite(high) ||
            !Number.isFinite(low) ||
            !Number.isFinite(close)
        ) {
            return null;
        }

        return {

            time:
                time > 100000000000
                    ? Math.floor(time / 1000)
                    : time,

            open,
            high,
            low,
            close,
            volume

        };

    }

    if (
        candle &&
        typeof candle === "object"
    ) {

        const rawTime =
            candle.time ??
            candle.timestamp ??
            candle.ts;

        const time =
            Number(rawTime);

        const open =
            Number(candle.open);

        const high =
            Number(candle.high);

        const low =
            Number(candle.low);

        const close =
            Number(candle.close);

        const volume =
            Number(
                candle.volume ??
                candle.v ??
                0
            );

        if (
            !Number.isFinite(time) ||
            !Number.isFinite(open) ||
            !Number.isFinite(high) ||
            !Number.isFinite(low) ||
            !Number.isFinite(close)
        ) {
            return null;
        }

        return {

            time:
                time > 100000000000
                    ? Math.floor(time / 1000)
                    : time,

            open,
            high,
            low,
            close,
            volume

        };

    }

    return null;
}

// ======================================================
// DELTA CRYPTO CANDLES
// ======================================================

app.get("/api/crypto/candles", async (req, res) => {

    try {

        const symbol =
            String(req.query.symbol || "BTC")
                .toUpperCase()
                .trim();

        const resolution =
            String(req.query.resolution || "1m")
                .toLowerCase()
                .trim();

        const deltaSymbol =
            CRYPTO_SYMBOLS[symbol];

        if (!deltaSymbol) {

            return res.status(404).json({
                success: false,
                error:
                    `Crypto ${symbol} is not configured`
            });

        }

        const config =
            DELTA_RESOLUTIONS[resolution];

        if (!config) {

            return res.status(400).json({
                success: false,
                error:
                    "Invalid crypto resolution"
            });

        }

        const candleCount = 200;

        const end =
            Math.floor(
                Date.now() / 1000
            );

        const start =
            end -
            (
                config.seconds *
                candleCount
            );

        const url =
            `${DELTA_API_URL}/v2/history/candles` +
            `?resolution=${encodeURIComponent(resolution)}` +
            `&symbol=${encodeURIComponent(deltaSymbol)}` +
            `&start=${start}` +
            `&end=${end}`;

        const response =
            await fetch(url, {

                method: "GET",

                headers: {
                    Accept: "application/json",
                    "User-Agent": "StockPulse/1.0"
                }

            });

        const data =
            await response.json();

        if (!response.ok) {

            return res.status(response.status).json({

                success: false,

                error:
                    data.error?.message ||
                    data.error ||
                    "Delta candle API failed"

            });

        }

        if (data.success === false) {

            return res.status(502).json({

                success: false,

                error:
                    data.error?.message ||
                    data.error ||
                    "Delta API returned an error"

            });

        }

        const rawCandles =
            Array.isArray(data.result)
                ? data.result
                : [];

        const candles =
            rawCandles
                .map(normalizeDeltaCandle)
                .filter(Boolean)
                .sort(
                    (a, b) =>
                        a.time - b.time
                );

        if (!candles.length) {

            return res.status(502).json({

                success: false,

                error:
                    "Delta returned no valid candles"

            });

        }

        res.json({

            success: true,

            symbol,

            deltaSymbol,

            resolution,

            count:
                candles.length,

            candles

        });

    } catch (error) {

        console.error(
            "DELTA CRYPTO CANDLE ERROR:",
            error.message
        );

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});

// ======================================================
// RAZORPAY
// ======================================================

const RAZORPAY_KEY_ID =
    process.env.RAZORPAY_KEY_ID;

const RAZORPAY_KEY_SECRET =
    process.env.RAZORPAY_KEY_SECRET;

if (
    !RAZORPAY_KEY_ID ||
    !RAZORPAY_KEY_SECRET
) {

    console.warn("");
    console.warn(
        "⚠️ RAZORPAY KEYS NOT FOUND"
    );
    console.warn(
        "Check your .env file."
    );
    console.warn("");

}

const razorpay =
    new Razorpay({

        key_id:
            RAZORPAY_KEY_ID,

        key_secret:
            RAZORPAY_KEY_SECRET

    });

const PREMIUM_AMOUNT = 200000;
const PREMIUM_CURRENCY = "INR";

// ======================================================
// PREMIUM TOKEN
// ======================================================

function createPremiumToken(paymentId) {

    const payload = {

        paymentId,

        premium: true,

        issuedAt:
            Date.now()

    };

    const payloadString =
        Buffer
            .from(
                JSON.stringify(payload)
            )
            .toString("base64url");

    const signature =
        crypto
            .createHmac(
                "sha256",
                RAZORPAY_KEY_SECRET
            )
            .update(payloadString)
            .digest("hex");

    return `${payloadString}.${signature}`;
}

function verifyPremiumToken(token) {

    try {

        if (!token) {
            return false;
        }

        const parts =
            token.split(".");

        if (parts.length !== 2) {
            return false;
        }

        const payloadString =
            parts[0];

        const signature =
            parts[1];

        const expectedSignature =
            crypto
                .createHmac(
                    "sha256",
                    RAZORPAY_KEY_SECRET
                )
                .update(payloadString)
                .digest("hex");

        if (
            signature.length !==
            expectedSignature.length
        ) {
            return false;
        }

        if (
            !crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            )
        ) {
            return false;
        }

        const payload =
            JSON.parse(
                Buffer
                    .from(
                        payloadString,
                        "base64url"
                    )
                    .toString("utf8")
            );

        if (!payload.premium) {
            return false;
        }

        return true;

    } catch (error) {

        return false;

    }

}

// ======================================================
// CREATE RAZORPAY ORDER
// ======================================================

app.post(
    "/api/payment/create-order",
    async (req, res) => {

        try {

            if (
                !RAZORPAY_KEY_ID ||
                !RAZORPAY_KEY_SECRET
            ) {

                return res.status(500).json({

                    success: false,

                    error:
                        "Razorpay keys are not configured"

                });

            }

            const order =
                await razorpay.orders.create({

                    amount:
                        PREMIUM_AMOUNT,

                    currency:
                        PREMIUM_CURRENCY,

                    receipt:
                        `stockpulse_${Date.now()}`,

                    notes: {

                        product:
                            "StockPulse Premium",

                        plan:
                            "Premium Membership"

                    }

                });

            res.json({

                success: true,

                keyId:
                    RAZORPAY_KEY_ID,

                order

            });

        } catch (error) {

            console.error(
                "RAZORPAY ORDER ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.error?.description ||
                    error.message ||
                    "Unable to create payment order"

            });

        }

    }
);

// ======================================================
// VERIFY RAZORPAY PAYMENT
// ======================================================

app.post(
    "/api/payment/verify",
    (req, res) => {

        try {

            const {

                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature

            } = req.body;

            if (
                !razorpay_order_id ||
                !razorpay_payment_id ||
                !razorpay_signature
            ) {

                return res.status(400).json({

                    success: false,

                    paid: false,

                    error:
                        "Payment verification data missing"

                });

            }

            const body =
                razorpay_order_id +
                "|" +
                razorpay_payment_id;

            const expectedSignature =
                crypto
                    .createHmac(
                        "sha256",
                        RAZORPAY_KEY_SECRET
                    )
                    .update(body)
                    .digest("hex");

            if (
                expectedSignature !==
                razorpay_signature
            ) {

                return res.status(400).json({

                    success: false,

                    paid: false,

                    error:
                        "Payment verification failed"

                });

            }

            const premiumToken =
                createPremiumToken(
                    razorpay_payment_id
                );

            res.json({

                success: true,

                paid: true,

                message:
                    "Payment verified successfully",

                paymentId:
                    razorpay_payment_id,

                premiumToken

            });

        } catch (error) {

            console.error(
                "PAYMENT VERIFY ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                paid: false,

                error:
                    "Payment verification error"

            });

        }

    }
);

// ======================================================
// ADMIN SIGNAL SYSTEM
// ======================================================

const SIGNALS_FILE =
    path.join(
        __dirname,
        "signals.json"
    );

const ADMIN_PASSWORD =
    "sodha@12345";

// ======================================================
// ADMIN AUTH
// ======================================================

function verifyAdmin(req, res, next) {

    const password =
        String(
            req.headers["x-admin-password"] || ""
        );

    if (
        !password ||
        password !== ADMIN_PASSWORD
    ) {

        return res.status(401).json({

            success: false,

            error:
                "Unauthorized admin access"

        });

    }

    next();

}

// ======================================================
// SIGNAL FILE
// ======================================================

function readSignals() {

    try {

        if (
            !fs.existsSync(
                SIGNALS_FILE
            )
        ) {

            fs.writeFileSync(

                SIGNALS_FILE,

                JSON.stringify(
                    {
                        signals: []
                    },
                    null,
                    2
                )

            );

        }

        const data =
            fs.readFileSync(
                SIGNALS_FILE,
                "utf8"
            );

        return JSON.parse(data);

    } catch (error) {

        console.error(
            "SIGNAL READ ERROR:",
            error.message
        );

        return {
            signals: []
        };

    }

}

// ======================================================
// SAVE SIGNALS
// ======================================================

function saveSignals(data) {

    fs.writeFileSync(

        SIGNALS_FILE,

        JSON.stringify(
            data,
            null,
            2
        )

    );

}

// ======================================================
// ADMIN LOGIN
// ======================================================

app.post(
    "/api/admin/login",
    (req, res) => {

        const password =
            String(
                req.body.password || ""
            );

        if (
            password !==
            ADMIN_PASSWORD
        ) {

            return res.status(401).json({

                success: false,

                error:
                    "Invalid admin password"

            });

        }

        res.json({

            success: true,

            message:
                "Admin login successful"

        });

    }
);

// ======================================================
// ADMIN GET SIGNALS
// ======================================================

app.get(
    "/api/admin/signals",
    verifyAdmin,
    (req, res) => {

        try {

            const data =
                readSignals();

            res.json({

                success: true,

                signals:
                    data.signals || []

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);

// ======================================================
// ADMIN SAVE SIGNAL
// ======================================================

app.post(
    "/api/admin/signals",
    verifyAdmin,
    (req, res) => {

        try {

            const {

                symbol,
                name,
                type,
                entry,
                stopLoss,
                target1,
                target2,
                target3,
                risk,
                note,
                active

            } = req.body;

            if (!symbol) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Stock symbol required"

                });

            }

            if (!type) {

                return res.status(400).json({

                    success: false,

                    error:
                        "BUY or SELL required"

                });

            }

            const data =
                readSignals();

            const signal = {

                id:
                    Date.now(),

                symbol:
                    String(symbol)
                        .toUpperCase()
                        .trim(),

                name:
                    name || symbol,

                type:
                    String(type)
                        .toUpperCase(),

                entry:
                    entry || "",

                stopLoss:
                    stopLoss || "",

                target1:
                    target1 || "",

                target2:
                    target2 || "",

                target3:
                    target3 || "",

                risk:
                    risk || "Medium",

                note:
                    note || "",

                active:
                    active !== false,

                updatedAt:
                    new Date().toISOString()

            };

            data.signals =
                data.signals || [];

            const existingIndex =
                data.signals.findIndex(
                    item =>
                        item.symbol ===
                        signal.symbol
                );

            if (
                existingIndex !== -1
            ) {

                signal.id =
                    data.signals[
                        existingIndex
                    ].id;

                data.signals[
                    existingIndex
                ] = signal;

            } else {

                data.signals.unshift(
                    signal
                );

            }

            saveSignals(data);

            res.json({

                success: true,

                message:
                    "Signal updated successfully",

                signal

            });

        } catch (error) {

            console.error(
                "SIGNAL SAVE ERROR:",
                error.message
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);

// ======================================================
// ADMIN DELETE SIGNAL
// ======================================================

app.delete(
    "/api/admin/signals/:id",
    verifyAdmin,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            const data =
                readSignals();

            data.signals =
                data.signals.filter(
                    signal =>
                        signal.id !== id
                );

            saveSignals(data);

            res.json({

                success: true,

                message:
                    "Signal deleted"

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);

// ======================================================
// CUSTOMER PREMIUM SIGNAL API
// ======================================================

app.get(
    "/api/signals",
    (req, res) => {

        try {

            const authHeader =
                String(
                    req.headers.authorization || ""
                );

            const token =
                authHeader.startsWith("Bearer ")
                    ? authHeader.substring(7)
                    : "";

            if (
                !verifyPremiumToken(token)
            ) {

                return res.status(403).json({

                    success: false,

                    premiumRequired: true,

                    error:
                        "Premium membership required"

                });

            }

            const data =
                readSignals();

            const activeSignals =
                (data.signals || [])
                    .filter(
                        signal =>
                            signal.active
                    );

            res.json({

                success: true,

                premium: true,

                signals:
                    activeSignals

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);

// ======================================================
// ADMIN PAGE
// ======================================================

app.get(
    ["/admin", "/admin.html"],
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "admin.html"
            )
        );

    }
);

// ======================================================
// SERVER STATUS
// ======================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "StockPulse API Server is running",

            chartEngine:
                "TradingView Lightweight Charts",

            marketData:
                "Upstox",

            cryptoData:
                "Delta Exchange",

            payment:
                "Razorpay Test Mode",

            premiumPrice:
                "₹2,000",

            endpoints: [

                "/api/nifty",

                "/api/banknifty",

                "/api/sensex",

                "/api/niftyit",

                "/api/stock?symbol=RELIANCE",

                "/api/stock?symbol=INFY",

                "/api/search?q=RELIANCE",

                "/api/candles?symbol=NIFTY50&timeframe=1m",

                "/api/candles?symbol=RELIANCE&timeframe=1m",

                "/api/candles?symbol=INFY&timeframe=5m",

                "/api/candles?symbol=NIFTY50&timeframe=1d",

                "/api/crypto?symbol=BTC",

                "/api/crypto/candles?symbol=BTC&resolution=1m",

                "/api/crypto/candles?symbol=ETH&resolution=5m",

                "/api/crypto/candles?symbol=SOL&resolution=15m",

                "/api/crypto/candles?symbol=XRP&resolution=1h",

                "/api/payment/create-order",

                "/api/payment/verify",

                "/api/signals"

            ]

        });

    }
);

// ======================================================
// START SERVER
// ======================================================

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "=========================================="
        );

        console.log(
            "🚀 STOCKPULSE SERVER STARTED"
        );

        console.log(
            "=========================================="
        );

        console.log(
            `🌐 http://localhost:${PORT}`
        );

        console.log(
            "📊 NIFTY: /api/nifty"
        );

        console.log(
            "🏦 BANKNIFTY: /api/banknifty"
        );

        console.log(
            "📈 SENSEX: /api/sensex"
        );

        console.log(
            "💻 NIFTY IT: /api/niftyit"
        );

        console.log(
            "🔍 Dynamic NSE Search: /api/search"
        );

        console.log(
            "📊 Real Candles: /api/candles"
        );

        console.log(
            "₿ CRYPTO: /api/crypto"
        );

        console.log(
            "📈 CRYPTO CANDLES: /api/crypto/candles"
        );

        console.log(
            "💳 RAZORPAY: TEST MODE"
        );

        console.log(
            "🔐 PREMIUM: ₹2,000"
        );

        console.log(
            "=========================================="
        );

    }
);