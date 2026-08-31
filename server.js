// ======================================================
// STOCKPULSE - COMPLETE SERVER
// Upstox + Delta Exchange + Razorpay + MongoDB
// Live Prices + Real Candles
// Dynamic NSE Search
// Premium Payments
// Customer Records
// Admin Dashboard
// Premium Signals - 4 Categories
// ======================================================

"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");

const app = express();

const PORT = process.env.PORT || 3000;

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());

// ======================================================
// ENV CONFIGURATION
// ======================================================

const UPSTOX_ACCESS_TOKEN =
    process.env.UPSTOX_ACCESS_TOKEN || "";

const RAZORPAY_KEY_ID =
    process.env.RAZORPAY_KEY_ID || "";

const RAZORPAY_KEY_SECRET =
    process.env.RAZORPAY_KEY_SECRET || "";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "";

const MONGODB_URI =
    process.env.MONGODB_URI || "";

// ======================================================
// CONFIGURATION STATUS
// ======================================================

console.log("");
console.log("==========================================");
console.log("       STOCKPULSE CONFIGURATION");
console.log("==========================================");

console.log(
    "UPSTOX: " +
    (UPSTOX_ACCESS_TOKEN
        ? "Configured"
        : "NOT CONFIGURED")
);

console.log(
    "RAZORPAY: " +
    (
        RAZORPAY_KEY_ID &&
        RAZORPAY_KEY_SECRET
            ? "Configured"
            : "NOT CONFIGURED"
    )
);

console.log(
    "ADMIN PASSWORD: " +
    (
        ADMIN_PASSWORD
            ? "Configured"
            : "NOT CONFIGURED"
    )
);

console.log(
    "MONGODB: " +
    (
        MONGODB_URI
            ? "Configured"
            : "NOT CONFIGURED"
    )
);

console.log("==========================================");

// ======================================================
// MONGODB CONNECTION
// ======================================================

let mongoConnected = false;

async function connectMongoDB() {

    if (!MONGODB_URI) {

        console.warn("");
        console.warn(
            "MONGODB_URI is not configured."
        );

        return false;
    }

    try {

        console.log("");
        console.log(
            "MongoDB: Connecting..."
        );

        await mongoose.connect(
            MONGODB_URI.trim()
        );

        mongoConnected = true;

        console.log("");
        console.log(
            "=========================================="
        );

        console.log(
            "MONGODB CONNECTED SUCCESSFULLY"
        );

        console.log(
            "=========================================="
        );

        console.log(
            "Database:",
            mongoose.connection.name || "-"
        );

        console.log(
            "Host:",
            mongoose.connection.host || "-"
        );

        console.log(
            "Ready State:",
            mongoose.connection.readyState
        );

        return true;

    } catch (error) {

        mongoConnected = false;

        console.error("");
        console.error(
            "=========================================="
        );

        console.error(
            "MONGODB CONNECTION ERROR"
        );

        console.error(
            "=========================================="
        );

        console.error(
            "Name:",
            error.name || "Unknown"
        );

        console.error(
            "Code:",
            error.code || "N/A"
        );

        console.error(
            "Message:",
            error.message || "Unknown error"
        );

        console.error(
            "=========================================="
        );

        return false;
    }
}

// ======================================================
// MONGODB EVENTS
// ======================================================

mongoose.connection.on(
    "connected",
    () => {

        mongoConnected = true;

        console.log(
            "MongoDB event: connected"
        );
    }
);

mongoose.connection.on(
    "disconnected",
    () => {

        mongoConnected = false;

        console.warn(
            "MongoDB disconnected"
        );
    }
);

mongoose.connection.on(
    "error",
    error => {

        mongoConnected = false;

        console.error(
            "MongoDB event error:",
            error.message
        );
    }
);

// ======================================================
// PAYMENT SCHEMA
// ======================================================

const paymentSchema =
    new mongoose.Schema(
        {

            customerName: {
                type: String,
                default: "Not Provided"
            },

            customerEmail: {
                type: String,
                default: "Not Provided"
            },

            customerPhone: {
                type: String,
                default: "Not Provided"
            },

            paymentId: {
                type: String,
                required: true,
                unique: true
            },

            orderId: {
                type: String,
                default: ""
            },

            amount: {
                type: Number,
                default: 0
            },

            currency: {
                type: String,
                default: "INR"
            },

            status: {
                type: String,
                default: "SUCCESS"
            },

            method: {
                type: String,
                default: ""
            },

            premium: {
                type: Boolean,
                default: true
            },

            premiumStartDate: {
                type: Date,
                default: Date.now
            },

            premiumExpiry: {
                type: Date
            },

            paymentDate: {
                type: Date,
                default: Date.now
            }

        },
        {
            timestamps: true
        }
    );

const Payment =
    mongoose.model(
        "Payment",
        paymentSchema
    );

// ======================================================
// PREMIUM SIGNAL SCHEMA
// ======================================================

const signalSchema =
    new mongoose.Schema(
        {

            category: {
                type: String,
                enum: [
                    "stocks",
                    "crypto",
                    "commodity",
                    "intraday"
                ],
                required: true,
                lowercase: true
            },

            symbol: {
                type: String,
                required: true,
                uppercase: true,
                trim: true
            },

            name: {
                type: String,
                default: ""
            },

            type: {
                type: String,
                enum: [
                    "BUY",
                    "SELL"
                ],
                default: "BUY"
            },

            entry: {
                type: String,
                default: ""
            },

            stopLoss: {
                type: String,
                default: ""
            },

            target1: {
                type: String,
                default: ""
            },

            target2: {
                type: String,
                default: ""
            },

            target3: {
                type: String,
                default: ""
            },

            risk: {
                type: String,
                default: "Medium"
            },

            note: {
                type: String,
                default: ""
            },

            active: {
                type: Boolean,
                default: true
            }

        },
        {
            timestamps: true
        }
    );

const Signal =
    mongoose.model(
        "Signal",
        signalSchema
    );

// ======================================================
// UPSTOX
// ======================================================

const UPSTOX_API =
    "https://api.upstox.com";

function upstoxHeaders() {

    return {

        Accept:
            "application/json",

        "Content-Type":
            "application/json",

        Authorization:
            "Bearer " + UPSTOX_ACCESS_TOKEN
    };
}

async function upstoxFetch(url) {

    if (!UPSTOX_ACCESS_TOKEN) {

        throw new Error(
            "UPSTOX_ACCESS_TOKEN is not configured"
        );
    }

    const response =
        await fetch(
            url,
            {
                method: "GET",
                headers: upstoxHeaders()
            }
        );

    let data;

    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            "Upstox returned invalid response (" +
            response.status +
            ")"
        );
    }

    if (!response.ok) {

        throw new Error(
            data.errors?.[0]?.message ||
            data.message ||
            "Upstox API request failed"
        );
    }

    return data;
}

async function getUpstoxData(
    instrumentKey
) {

    const url =
        UPSTOX_API +
        "/v2/market-quote/ltp" +
        "?instrument_key=" +
        encodeURIComponent(
            instrumentKey
        );

    return await upstoxFetch(
        url
    );
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
            await getUpstoxData(
                instrumentKey
            );

        const index =
            data.data?.[responseKey];

        if (!index) {

            return res.status(404).json({

                success: false,

                error:
                    name +
                    " data not found"
            });
        }

        const price =
            Number(
                index.last_price
            );

        if (!Number.isFinite(price)) {

            return res.status(502).json({

                success: false,

                error:
                    name +
                    " price is invalid"
            });
        }

        res.json({

            success: true,

            name,

            price
        });

    } catch (error) {

        console.error(
            name + " ERROR:",
            error.message
        );

        res.status(500).json({

            success: false,

            error:
                error.message
        });
    }
}

// ======================================================
// INDEX ROUTES
// ======================================================

app.get(
    "/api/nifty",
    async (req, res) => {

        await sendIndexPrice(
            res,
            "NIFTY 50",
            "NSE_INDEX|Nifty 50",
            "NSE_INDEX:Nifty 50"
        );
    }
);

app.get(
    "/api/banknifty",
    async (req, res) => {

        await sendIndexPrice(
            res,
            "BANK NIFTY",
            "NSE_INDEX|Nifty Bank",
            "NSE_INDEX:Nifty Bank"
        );
    }
);

app.get(
    "/api/niftyit",
    async (req, res) => {

        await sendIndexPrice(
            res,
            "NIFTY IT",
            "NSE_INDEX|Nifty IT",
            "NSE_INDEX:Nifty IT"
        );
    }
);

app.get(
    "/api/sensex",
    async (req, res) => {

        await sendIndexPrice(
            res,
            "SENSEX",
            "BSE_INDEX|SENSEX",
            "BSE_INDEX:SENSEX"
        );
    }
);

// ======================================================
// FIND NSE INSTRUMENT
// ======================================================

async function findNSEInstrument(
    symbol
) {

    const query =
        String(symbol || "")
            .trim()
            .toUpperCase();

    if (!query) {
        return null;
    }

    if (
        STATIC_INSTRUMENTS[query] &&
        STATIC_INSTRUMENTS[query]
            .startsWith("NSE_EQ|")
    ) {

        return {

            instrumentKey:
                STATIC_INSTRUMENTS[query],

            symbol:
                query,

            name:
                query,

            exchange:
                "NSE"
        };
    }

    const url =
        UPSTOX_API +
        "/v2/instruments/search" +
        "?query=" +
        encodeURIComponent(query) +
        "&exchanges=NSE" +
        "&segments=EQ" +
        "&page_number=1" +
        "&records=30";

    const data =
        await upstoxFetch(
            url
        );

    const results =
        Array.isArray(data.data)
            ? data.data
            : [];

    if (!results.length) {
        return null;
    }

    let match =
        results.find(
            item =>
                String(
                    item.trading_symbol || ""
                )
                    .toUpperCase() ===
                query &&
                String(
                    item.segment || ""
                )
                    .toUpperCase() ===
                "NSE_EQ"
        );

    if (!match) {

        match =
            results.find(
                item => {

                    const tradingSymbol =
                        String(
                            item.trading_symbol || ""
                        )
                            .toUpperCase();

                    const shortName =
                        String(
                            item.short_name || ""
                        )
                            .toUpperCase();

                    const name =
                        String(
                            item.name || ""
                        )
                            .toUpperCase();

                    return (
                        tradingSymbol === query ||
                        shortName === query ||
                        name === query
                    );
                }
            );
    }

    if (!match) {

        match =
            results.find(
                item =>
                    String(
                        item.segment || ""
                    )
                        .toUpperCase() ===
                    "NSE_EQ"
            );
    }

    if (!match) {
        return null;
    }

    return {

        instrumentKey:
            match.instrument_key,

        symbol:
            match.trading_symbol ||
            query,

        name:
            match.name ||
            query,

        exchange:
            match.exchange ||
            "NSE"
    };
}

// ======================================================
// SEARCH
// ======================================================

app.get(
    "/api/search",
    async (req, res) => {

        try {

            const query =
                String(
                    req.query.q || ""
                )
                    .trim()
                    .toUpperCase();

            if (!query) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Please provide search query"
                });
            }

            const url =
                UPSTOX_API +
                "/v2/instruments/search" +
                "?query=" +
                encodeURIComponent(query) +
                "&exchanges=NSE" +
                "&segments=EQ" +
                "&page_number=1" +
                "&records=20";

            const data =
                await upstoxFetch(
                    url
                );

            const results =
                Array.isArray(data.data)
                    ? data.data
                    : [];

            const stocks =
                results
                    .filter(
                        item =>
                            String(
                                item.segment || ""
                            )
                                .toUpperCase() ===
                            "NSE_EQ"
                    )
                    .map(
                        item => ({

                            symbol:
                                item.trading_symbol ||
                                item.short_name ||
                                "",

                            name:
                                item.name ||
                                "",

                            instrumentKey:
                                item.instrument_key,

                            exchange:
                                item.exchange ||
                                "NSE"
                        })
                    )
                    .filter(
                        item =>
                            item.symbol
                    );

            res.json({

                success: true,

                query,

                count:
                    stocks.length,

                results:
                    stocks
            });

        } catch (error) {

            console.error(
                "SEARCH ERROR:",
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
// STOCK PRICE
// ======================================================

app.get(
    "/api/stock",
    async (req, res) => {

        try {

            const symbol =
                String(
                    req.query.symbol || ""
                )
                    .toUpperCase()
                    .trim();

            if (!symbol) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Please provide stock symbol"
                });
            }

            const instrument =
                await findNSEInstrument(
                    symbol
                );

            if (!instrument) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Stock " +
                        symbol +
                        " not found on NSE"
                });
            }

            const data =
                await getUpstoxData(
                    instrument.instrumentKey
                );

            const stock =
                Object.values(
                    data.data || {}
                )[0];

            if (!stock) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Stock " +
                        symbol +
                        " data not found"
                });
            }

            const price =
                Number(
                    stock.last_price
                );

            if (!Number.isFinite(price)) {

                return res.status(502).json({

                    success: false,

                    error:
                        symbol +
                        " price is invalid"
                });
            }

            res.json({

                success: true,

                symbol,

                name:
                    instrument.name ||
                    symbol,

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

                error:
                    error.message
            });
        }
    }
);

// ======================================================
// DELTA EXCHANGE
// ======================================================

const DELTA_API_URL =
    "https://api.india.delta.exchange";

async function getDeltaTicker(
    symbol
) {

    const url =
        DELTA_API_URL +
        "/v2/tickers/" +
        encodeURIComponent(symbol);

    const response =
        await fetch(
            url,
            {

                method:
                    "GET",

                headers: {

                    Accept:
                        "application/json",

                    "User-Agent":
                        "StockPulse/1.0"
                }
            }
        );

    let data;

    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            "Delta returned invalid response (" +
            response.status +
            ")"
        );
    }

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

    BTC:
        "BTCUSD",

    ETH:
        "ETHUSD",

    SOL:
        "SOLUSD",

    XRP:
        "XRPUSD"
};

// ======================================================
// CRYPTO PRICE
// ======================================================

app.get(
    "/api/crypto",
    async (req, res) => {

        try {

            const symbol =
                String(
                    req.query.symbol || ""
                )
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
                CRYPTO_SYMBOLS[
                    symbol
                ];

            if (!deltaSymbol) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Crypto " +
                        symbol +
                        " is not configured"
                });
            }

            const ticker =
                await getDeltaTicker(
                    deltaSymbol
                );

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
                        symbol +
                        " price not available"
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

                error:
                    error.message
            });
        }
    }
);

// ======================================================
// TIMEFRAME CONFIG
// ======================================================

function getTimeframeConfig(
    timeframe
) {

    const tf =
        String(
            timeframe || "1m"
        )
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

function getISTDate(
    daysAgo = 0
) {

    const now =
        new Date();

    now.setUTCDate(
        now.getUTCDate() -
        daysAgo
    );

    return new Intl.DateTimeFormat(
        "en-CA",
        {

            timeZone:
                "Asia/Kolkata",

            year:
                "numeric",

            month:
                "2-digit",

            day:
                "2-digit"
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
        getTimeframeConfig(
            timeframe
        );

    if (!config) {

        throw new Error(
            "Invalid timeframe"
        );
    }

    if (
        [
            "minutes",
            "hours"
        ].includes(
            config.unit
        )
    ) {

        const url =
            UPSTOX_API +
            "/v3/historical-candle/intraday/" +
            encodeURIComponent(
                instrumentKey
            ) +
            "/" +
            config.unit +
            "/" +
            config.interval;

        return await upstoxFetch(
            url
        );
    }

    let daysBack = 365;

    if (
        config.unit ===
        "weeks"
    ) {

        daysBack =
            365 * 3;
    }

    if (
        config.unit ===
        "months"
    ) {

        daysBack =
            365 * 5;
    }

    const toDate =
        getISTDate(0);

    const fromDate =
        getISTDate(
            daysBack
        );

    const url =
        UPSTOX_API +
        "/v3/historical-candle/" +
        encodeURIComponent(
            instrumentKey
        ) +
        "/" +
        config.unit +
        "/" +
        config.interval +
        "/" +
        toDate +
        "/" +
        fromDate;

    return await upstoxFetch(
        url
    );
}

// ======================================================
// FORMAT UPSTOX CANDLES
// ======================================================

function formatUpstoxCandles(
    rawCandles
) {

    if (
        !Array.isArray(
            rawCandles
        )
    ) {

        return [];
    }

    return rawCandles
        .map(
            candle => {

                if (
                    !Array.isArray(
                        candle
                    ) ||
                    candle.length < 5
                ) {

                    return null;
                }

                const time =
                    candle[0];

                const open =
                    Number(
                        candle[1]
                    );

                const high =
                    Number(
                        candle[2]
                    );

                const low =
                    Number(
                        candle[3]
                    );

                const close =
                    Number(
                        candle[4]
                    );

                const volume =
                    Number(
                        candle[5] || 0
                    );

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
            }
        )
        .filter(Boolean)
        .sort(
            (a, b) => {

                const ta =
                    new Date(
                        a.time
                    ).getTime();

                const tb =
                    new Date(
                        b.time
                    ).getTime();

                return ta - tb;
            }
        );
}

// ======================================================
// STOCK / INDEX CANDLES
// ======================================================

app.get(
    "/api/candles",
    async (req, res) => {

        try {

            const symbol =
                String(
                    req.query.symbol || ""
                )
                    .toUpperCase()
                    .trim();

            const timeframe =
                String(
                    req.query.timeframe || "1m"
                )
                    .toLowerCase()
                    .trim();

            if (!symbol) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Please provide symbol"
                });
            }

            const config =
                getTimeframeConfig(
                    timeframe
                );

            if (!config) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid timeframe"
                });
            }

            let instrumentKey =
                STATIC_INSTRUMENTS[
                    symbol
                ];

            let instrumentName =
                symbol;

            if (!instrumentKey) {

                const instrument =
                    await findNSEInstrument(
                        symbol
                    );

                if (!instrument) {

                    return res.status(404).json({

                        success: false,

                        error:
                            symbol +
                            " instrument not found on NSE"
                    });
                }

                instrumentKey =
                    instrument.instrumentKey;

                instrumentName =
                    instrument.name ||
                    symbol;
            }

            const data =
                await getUpstoxCandles(
                    instrumentKey,
                    timeframe
                );

            const rawCandles =
                Array.isArray(
                    data.data?.candles
                )
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

                error:
                    error.message
            });
        }
    }
);

// ======================================================
// DELTA RESOLUTIONS
// ======================================================

const DELTA_RESOLUTIONS = {

    "1m": {
        seconds: 60
    },

    "3m": {
        seconds: 180
    },

    "5m": {
        seconds: 300
    },

    "15m": {
        seconds: 900
    },

    "30m": {
        seconds: 1800
    },

    "1h": {
        seconds: 3600
    },

    "2h": {
        seconds: 7200
    },

    "4h": {
        seconds: 14400
    },

    "6h": {
        seconds: 21600
    },

    "1d": {
        seconds: 86400
    },

    "1w": {
        seconds: 604800
    }
};

// ======================================================
// NORMALIZE DELTA CANDLE
// ======================================================

function normalizeDeltaCandle(
    candle
) {

    if (
        Array.isArray(
            candle
        )
    ) {

        if (
            candle.length < 5
        ) {

            return null;
        }

        const time =
            Number(
                candle[0]
            );

        const open =
            Number(
                candle[1]
            );

        const high =
            Number(
                candle[2]
            );

        const low =
            Number(
                candle[3]
            );

        const close =
            Number(
                candle[4]
            );

        const volume =
            Number(
                candle[5] || 0
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
                    ? Math.floor(
                        time / 1000
                    )
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
        typeof candle ===
            "object"
    ) {

        const rawTime =
            candle.time ??
            candle.timestamp ??
            candle.ts;

        const time =
            Number(
                rawTime
            );

        const open =
            Number(
                candle.open
            );

        const high =
            Number(
                candle.high
            );

        const low =
            Number(
                candle.low
            );

        const close =
            Number(
                candle.close
            );

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
                    ? Math.floor(
                        time / 1000
                    )
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

app.get(
    "/api/crypto/candles",
    async (req, res) => {

        try {

            const symbol =
                String(
                    req.query.symbol || "BTC"
                )
                    .toUpperCase()
                    .trim();

            const resolution =
                String(
                    req.query.resolution || "1m"
                )
                    .toLowerCase()
                    .trim();

            const deltaSymbol =
                CRYPTO_SYMBOLS[
                    symbol
                ];

            if (!deltaSymbol) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Crypto " +
                        symbol +
                        " is not configured"
                });
            }

            const config =
                DELTA_RESOLUTIONS[
                    resolution
                ];

            if (!config) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid crypto resolution"
                });
            }

            const candleCount =
                200;

            const end =
                Math.floor(
                    Date.now() /
                    1000
                );

            const start =
                end -
                (
                    config.seconds *
                    candleCount
                );

            const url =
                DELTA_API_URL +
                "/v2/history/candles" +
                "?resolution=" +
                encodeURIComponent(
                    resolution
                ) +
                "&symbol=" +
                encodeURIComponent(
                    deltaSymbol
                ) +
                "&start=" +
                start +
                "&end=" +
                end;

            const response =
                await fetch(
                    url,
                    {

                        method:
                            "GET",

                        headers: {

                            Accept:
                                "application/json",

                            "User-Agent":
                                "StockPulse/1.0"
                        }
                    }
                );

            let data;

            try {

                data =
                    await response.json();

            } catch {

                throw new Error(
                    "Delta returned invalid response (" +
                    response.status +
                    ")"
                );
            }

            if (!response.ok) {

                return res.status(
                    response.status
                ).json({

                    success: false,

                    error:
                        data.error?.message ||
                        data.error ||
                        "Delta candle API failed"
                });
            }

            if (
                data.success ===
                false
            ) {

                return res.status(502).json({

                    success: false,

                    error:
                        data.error?.message ||
                        data.error ||
                        "Delta API returned an error"
                });
            }

            const rawCandles =
                Array.isArray(
                    data.result
                )
                    ? data.result
                    : [];

            const candles =
                rawCandles
                    .map(
                        normalizeDeltaCandle
                    )
                    .filter(Boolean)
                    .sort(
                        (a, b) =>
                            a.time -
                            b.time
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

                error:
                    error.message
            });
        }
    }
);

// ======================================================
// RAZORPAY
// ======================================================

const razorpay =
    RAZORPAY_KEY_ID &&
    RAZORPAY_KEY_SECRET
        ? new Razorpay({

            key_id:
                RAZORPAY_KEY_ID,

            key_secret:
                RAZORPAY_KEY_SECRET

        })
        : null;

const PREMIUM_AMOUNT =
    200000;

const PREMIUM_CURRENCY =
    "INR";

// ======================================================
// PREMIUM TOKEN
// ======================================================

function createPremiumToken(
    paymentId,
    expiry
) {

    const payload = {

        paymentId,

        premium:
            true,

        expiry:
            new Date(
                expiry
            ).getTime(),

        issuedAt:
            Date.now()
    };

    const payloadString =
        Buffer
            .from(
                JSON.stringify(
                    payload
                )
            )
            .toString(
                "base64url"
            );

    const signature =
        crypto
            .createHmac(
                "sha256",
                RAZORPAY_KEY_SECRET
            )
            .update(
                payloadString
            )
            .digest(
                "hex"
            );

    return (
        payloadString +
        "." +
        signature
    );
}

function verifyPremiumToken(
    token
) {

    try {

        if (!token) {
            return false;
        }

        if (!RAZORPAY_KEY_SECRET) {
            return false;
        }

        const parts =
            token.split(".");

        if (
            parts.length !== 2
        ) {
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
                .update(
                    payloadString
                )
                .digest(
                    "hex"
                );

        if (
            signature.length !==
            expectedSignature.length
        ) {
            return false;
        }

        if (
            !crypto.timingSafeEqual(
                Buffer.from(
                    signature
                ),
                Buffer.from(
                    expectedSignature
                )
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
                    .toString(
                        "utf8"
                    )
            );

        if (
            !payload.premium
        ) {
            return false;
        }

        if (
            payload.expiry &&
            Date.now() >
                Number(
                    payload.expiry
                )
        ) {
            return false;
        }

        return true;

    } catch {

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
                !RAZORPAY_KEY_SECRET ||
                !razorpay
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
                        "stockpulse_" +
                        Date.now(),

                    notes: {

                        product:
                            "StockPulse Premium",

                        plan:
                            "6 Month Premium Membership"
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
    async (req, res) => {

        try {

            if (
                !RAZORPAY_KEY_SECRET ||
                !razorpay
            ) {

                return res.status(500).json({

                    success: false,

                    paid: false,

                    error:
                        "Razorpay is not configured"
                });
            }

            const {

                razorpay_order_id,

                razorpay_payment_id,

                razorpay_signature,

                customerName,

                customerEmail,

                customerPhone

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
                    .update(
                        body
                    )
                    .digest(
                        "hex"
                    );

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

            let paymentDetails =
                null;

            try {

                paymentDetails =
                    await razorpay.payments.fetch(
                        razorpay_payment_id
                    );

            } catch (error) {

                console.error(
                    "PAYMENT FETCH ERROR:",
                    error.message
                );
            }

            if (
                paymentDetails &&
                paymentDetails.status &&
                paymentDetails.status !==
                    "captured"
            ) {

                return res.status(400).json({

                    success: false,

                    paid: false,

                    error:
                        "Payment status is " +
                        paymentDetails.status
                });
            }

            const premiumStartDate =
                new Date();

            const premiumExpiry =
                new Date(
                    premiumStartDate
                );

            premiumExpiry.setMonth(
                premiumExpiry.getMonth() +
                6
            );

            let paymentRecord =
                await Payment.findOne({

                    paymentId:
                        razorpay_payment_id
                });

            if (!paymentRecord) {

                paymentRecord =
                    await Payment.create({

                        customerName:
                            customerName ||
                            "Not Provided",

                        customerEmail:
                            customerEmail ||
                            paymentDetails?.email ||
                            "Not Provided",

                        customerPhone:
                            customerPhone ||
                            paymentDetails?.contact ||
                            "Not Provided",

                        paymentId:
                            razorpay_payment_id,

                        orderId:
                            razorpay_order_id,

                        amount:
                            paymentDetails?.amount ??
                            PREMIUM_AMOUNT,

                        currency:
                            paymentDetails?.currency ??
                            PREMIUM_CURRENCY,

                        status:
                            "SUCCESS",

                        method:
                            paymentDetails?.method ||
                            "",

                        premium:
                            true,

                        premiumStartDate,

                        premiumExpiry,

                        paymentDate:
                            paymentDetails?.created_at
                                ? new Date(
                                    paymentDetails.created_at *
                                    1000
                                )
                                : new Date()
                    });

                console.log(
                    "PAYMENT SAVED TO MONGODB"
                );
            }

            const premiumToken =
                createPremiumToken(
                    razorpay_payment_id,
                    paymentRecord.premiumExpiry
                );

            res.json({

                success: true,

                paid: true,

                message:
                    "Payment verified successfully",

                paymentId:
                    razorpay_payment_id,

                premiumExpiry:
                    paymentRecord.premiumExpiry,

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
// ADMIN AUTH
// ======================================================

function verifyAdmin(req, res, next) {

    const headerPassword =
        String(
            req.headers["x-admin-password"] || ""
        ).trim();

    const authorization =
        String(
            req.headers.authorization || ""
        ).trim();

    let password = headerPassword;

    // Support: Authorization: Bearer <password>
    if (
        !password &&
        authorization.toLowerCase().startsWith("bearer ")
    ) {
        password =
            authorization
                .slice(7)
                .trim();
    }

    if (
        !ADMIN_PASSWORD
    ) {

        console.error(
            "ADMIN AUTH ERROR: ADMIN_PASSWORD is not configured"
        );

        return res.status(500).json({

            success: false,

            error:
                "ADMIN_PASSWORD is not configured on server"
        });
    }

    if (
        !password ||
        password !== ADMIN_PASSWORD
    ) {

        console.warn(
            "ADMIN AUTH FAILED:",
            req.method,
            req.originalUrl
        );

        return res.status(401).json({

            success: false,

            error:
                "Unauthorized admin access"
        });
    }

    next();
}


// ======================================================
// ADMIN LOGIN
// ======================================================

app.post(
    "/api/admin/login",
    (req, res) => {

        try {

            const password =
                String(
                    req.body?.password || ""
                ).trim();

            if (
                !ADMIN_PASSWORD
            ) {

                return res.status(500).json({

                    success: false,

                    error:
                        "ADMIN_PASSWORD is not configured on server"
                });
            }

            if (
                !password ||
                password !== ADMIN_PASSWORD
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
                    "Admin login successful",

                // Admin HTML can use this value
                // as x-admin-password
                adminPassword:
                    password
            });

        } catch (error) {

            console.error(
                "ADMIN LOGIN ERROR:",
                error.message
            );

            res.status(500).json({

                success: false,

                error:
                    "Admin login failed"
            });
        }
    }
);


// ======================================================
// ADMIN STATUS
// ======================================================
// Admin HTML mein agar /api/admin/status call ho
// to 404 nahi aayega.
// ======================================================

app.get(
    "/api/admin/status",
    verifyAdmin,
    async (req, res) => {

        res.json({

            success: true,

            authenticated: true,

            mongoConnected:
                mongoConnected,

            message:
                "Admin authentication successful"
        });
    }
);
// ======================================================
// ADMIN DASHBOARD STATS
// ======================================================

app.get(
    "/api/admin/stats",
    verifyAdmin,
    async (req, res) => {

        try {

            if (!mongoConnected) {

                return res.status(503).json({

                    success: false,

                    error:
                        "MongoDB is not connected"
                });
            }

            const totalPayments =
                await Payment.countDocuments();

            const successfulPayments =
                await Payment.countDocuments({

                    status:
                        "SUCCESS"
                });

            const customerPhones =
                await Payment.distinct(

                    "customerPhone",

                    {
                        status:
                            "SUCCESS"
                    }
                );

            const customerEmails =
                await Payment.distinct(

                    "customerEmail",

                    {
                        status:
                            "SUCCESS"
                    }
                );

            const customers =
                new Set();

            customerPhones.forEach(
                phone => {

                    if (
                        phone &&
                        phone !==
                            "Not Provided"
                    ) {

                        customers.add(
                            "phone:" +
                            phone
                        );
                    }
                }
            );

            customerEmails.forEach(
                email => {

                    if (
                        email &&
                        email !==
                            "Not Provided"
                    ) {

                        customers.add(
                            "email:" +
                            email
                        );
                    }
                }
            );

            const activePremium =
                await Payment.countDocuments({

                    premium:
                        true,

                    premiumExpiry: {
                        $gt:
                            new Date()
                    },

                    status:
                        "SUCCESS"
                });

            const revenueResult =
                await Payment.aggregate([

                    {
                        $match: {

                            status:
                                "SUCCESS"
                        }
                    },

                    {
                        $group: {

                            _id:
                                null,

                            total: {

                                $sum:
                                    "$amount"
                            }
                        }
                    }
                ]);

            const totalRevenuePaise =
                revenueResult[0]?.total ||
                0;

            const totalSignals =
                await Signal.countDocuments();

            const activeSignals =
                await Signal.countDocuments({

                    active:
                        true
                });

            res.json({

                success: true,

                stats: {

                    totalCustomers:
                        customers.size,

                    totalPayments,

                    successfulPayments,

                    totalRevenue:
                        totalRevenuePaise /
                        100,

                    activePremium,

                    totalSignals,

                    activeSignals
                }
            });

        } catch (error) {

            console.error(
                "ADMIN STATS ERROR:",
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
// ADMIN CUSTOMER RECORDS
// ======================================================

app.get(
    "/api/admin/customers",
    verifyAdmin,
    async (req, res) => {

        try {

            if (!mongoConnected) {

                return res.status(503).json({

                    success: false,

                    error:
                        "MongoDB is not connected"
                });
            }

            const payments =
                await Payment.find({

                    status:
                        "SUCCESS"

                })
                    .sort({

                        paymentDate:
                            -1

                    })
                    .lean();

            const customerMap =
                new Map();

            for (
                const payment of payments
            ) {

                const phone =
                    String(
                        payment.customerPhone ||
                        ""
                    ).trim();

                const email =
                    String(
                        payment.customerEmail ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const key =
                    phone &&
                    phone !==
                        "Not Provided"

                        ? "phone:" +
                          phone

                        : email &&
                          email !==
                              "not provided"

                            ? "email:" +
                              email

                            : "payment:" +
                              payment.paymentId;

                if (
                    !customerMap.has(
                        key
                    )
                ) {

                    customerMap.set(
                        key,
                        {

                            customerName:
                                payment.customerName ||
                                "Not Provided",

                            customerEmail:
                                payment.customerEmail ||
                                "Not Provided",

                            customerPhone:
                                payment.customerPhone ||
                                "Not Provided",

                            premium:
                                payment.premium ===
                                true,

                            premiumStartDate:
                                payment.premiumStartDate ||
                                null,

                            premiumExpiry:
                                payment.premiumExpiry ||
                                null,

                            paymentId:
                                payment.paymentId,

                            amount:
                                payment.amount ||
                                0,

                            paymentDate:
                                payment.paymentDate ||
                                payment.createdAt,

                            status:
                                payment.status ||
                                "SUCCESS"
                        }
                    );
                }
            }

            const customers =
                Array.from(
                    customerMap.values()
                );

            res.json({

                success: true,

                count:
                    customers.length,

                customers
            });

        } catch (error) {

            console.error(
                "ADMIN CUSTOMERS ERROR:",
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
// ADMIN PAYMENT RECORDS
// ======================================================

app.get(
    "/api/admin/payments",
    verifyAdmin,
    async (req, res) => {

        try {

            if (!mongoConnected) {

                return res.status(503).json({

                    success: false,

                    error:
                        "MongoDB is not connected"
                });
            }

            const payments =
                await Payment.find()

                    .sort({

                        createdAt:
                            -1

                    })

                    .lean();

            res.json({

                success: true,

                count:
                    payments.length,

                payments
            });

        } catch (error) {

            console.error(
                "ADMIN PAYMENTS ERROR:",
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
// ADMIN PREMIUM SIGNALS
// ======================================================

app.get(
    "/api/admin/signals",
    verifyAdmin,
    async (req, res) => {

        try {

            if (!mongoConnected) {

                return res.status(503).json({

                    success: false,

                    error:
                        "MongoDB is not connected"
                });
            }

            const signals =
                await Signal.find()

                    .sort({

                        category:
                            1,

                        updatedAt:
                            -1

                    })

                    .lean();

            res.json({

                success: true,

                count:
                    signals.length,

                signals
            });

        } catch (error) {

            console.error(
                "GET ADMIN SIGNALS ERROR:",
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
// SAVE / UPDATE PREMIUM SIGNAL
// ======================================================

app.post(
    "/api/admin/signals",
    verifyAdmin,
    async (req, res) => {

        try {

            if (!mongoConnected) {

                return res.status(503).json({

                    success: false,

                    error:
                        "MongoDB is not connected"
                });
            }

            const {

                id,

                category,

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

            const cleanCategory =
                String(
                    category || ""
                )
                    .toLowerCase()
                    .trim();

            const cleanSymbol =
                String(
                    symbol || ""
                )
                    .toUpperCase()
                    .trim();

            const cleanType =
                String(
                    type || ""
                )
                    .toUpperCase()
                    .trim();

            const allowedCategories = [

                "stocks",

                "crypto",

                "commodity",

                "intraday"
            ];

            if (
                !allowedCategories.includes(
                    cleanCategory
                )
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid signal category"
                });
            }

            if (!cleanSymbol) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Symbol is required"
                });
            }

            if (
                !["BUY", "SELL"].includes(
                    cleanType
                )
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "BUY or SELL is required"
                });
            }

            let signal;

            if (id) {

                signal =
                    await Signal.findByIdAndUpdate(

                        id,

                        {

                            category:
                                cleanCategory,

                            symbol:
                                cleanSymbol,

                            name:
                                name ||
                                cleanSymbol,

                            type:
                                cleanType,

                            entry:
                                entry ||
                                "",

                            stopLoss:
                                stopLoss ||
                                "",

                            target1:
                                target1 ||
                                "",

                            target2:
                                target2 ||
                                "",

                            target3:
                                target3 ||
                                "",

                            risk:
                                risk ||
                                "Medium",

                            note:
                                note ||
                                "",

                            active:
                                active !==
                                false
                        },

                        {

                            new:
                                true,

                            runValidators:
                                true
                        }
                    );

            } else {

                signal =
                    await Signal.create({

                        category:
                            cleanCategory,

                        symbol:
                            cleanSymbol,

                        name:
                            name ||
                            cleanSymbol,

                        type:
                            cleanType,

                        entry:
                            entry ||
                            "",

                        stopLoss:
                            stopLoss ||
                            "",

                        target1:
                            target1 ||
                            "",

                        target2:
                            target2 ||
                            "",

                        target3:
                            target3 ||
                            "",

                        risk:
                            risk ||
                            "Medium",

                        note:
                            note ||
                            "",

                        active:
                            active !==
                            false
                    });
            }

            res.json({

                success: true,

                message:
                    "Premium signal saved successfully",

                signal
            });

        } catch (error) {

            console.error(
                "SAVE SIGNAL ERROR:",
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
// DELETE PREMIUM SIGNAL
// ======================================================

app.delete(
    "/api/admin/signals/:id",
    verifyAdmin,
    async (req, res) => {

        try {

            if (!mongoConnected) {

                return res.status(503).json({

                    success: false,

                    error:
                        "MongoDB is not connected"
                });
            }

            await Signal.findByIdAndDelete(
                req.params.id
            );

            res.json({

                success: true,

                message:
                    "Signal deleted successfully"
            });

        } catch (error) {

            console.error(
                "DELETE SIGNAL ERROR:",
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
// PUBLIC SIGNAL API
// ======================================================
// Website par active signals publicly available hain.
// Admin panel se add/update kiye gaye signals yahan milenge.
// Premium token ki requirement hata di gayi hai.
// ======================================================

app.get(
    "/api/signals",
    async (req, res) => {

        try {

            if (!mongoConnected) {

                return res.status(503).json({

                    success: false,

                    error:
                        "MongoDB is not connected"
                });
            }

            const signals =
                await Signal.find({

                    active:
                        true

                })
                    .sort({

                        category:
                            1,

                        updatedAt:
                            -1

                    })
                    .lean();

            res.json({

                success: true,

                count:
                    signals.length,

                signals

            });

        } catch (error) {

            console.error(
                "PUBLIC SIGNALS ERROR:",
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
// ADMIN PAGE
// ======================================================

app.get(
    [
        "/admin",
        "/admin.html"
    ],
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

            database:
                mongoConnected
                    ? "MongoDB Connected"
                    : "MongoDB Not Connected",

            chartEngine:
                "TradingView Lightweight Charts",

            marketData:
                "Upstox",

            cryptoData:
                "Delta Exchange",

            payment:
                "Razorpay",

            databaseEngine:
                "MongoDB",

            premiumPrice:
                "2000 INR",

            premiumDuration:
                "6 Months",

            signalCategories: [

                "Indian Stocks",

                "Crypto",

                "Commodity",

                "Intraday"
            ],

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

                "/api/signals",

                "/api/admin/login",

                "/api/admin/customers",

                "/api/admin/payments",

                "/api/admin/stats",

                "/api/admin/signals"
            ]
        });
    }
);

// ======================================================
// START SERVER
// ======================================================

async function startServer() {

    console.log("");

    console.log(
        "=========================================="
    );

    console.log(
        "MongoDB: Connecting..."
    );

    console.log(
        "=========================================="
    );

    const connected =
        await connectMongoDB();

    if (!connected) {

        console.error("");
        console.error(
            "MongoDB connection failed."
        );

        console.error(
            "Server will NOT start."
        );

        console.error(
            "Please check MONGODB_URI in .env"
        );

        process.exit(1);
    }

    app.listen(
        PORT,
        () => {

            console.log("");

            console.log(
                "=========================================="
            );

            console.log(
                "STOCKPULSE SERVER STARTED"
            );

            console.log(
                "=========================================="
            );

            console.log(
                "http://localhost:" +
                PORT
            );

            console.log(
                "MongoDB: CONNECTED"
            );

            console.log(
                "NIFTY: /api/nifty"
            );

            console.log(
                "BANKNIFTY: /api/banknifty"
            );

            console.log(
                "SENSEX: /api/sensex"
            );

            console.log(
                "NIFTY IT: /api/niftyit"
            );

            console.log(
                "Dynamic NSE Search: /api/search"
            );

            console.log(
                "Real Candles: /api/candles"
            );

            console.log(
                "CRYPTO: /api/crypto"
            );

            console.log(
                "CRYPTO CANDLES: /api/crypto/candles"
            );

            console.log(
                "RAZORPAY: ENABLED"
            );

            console.log(
                "MONGODB: ENABLED"
            );

            console.log(
                "PREMIUM SIGNALS: ENABLED"
            );

            console.log(
                "INDIAN STOCKS SIGNALS"
            );

            console.log(
                "CRYPTO SIGNALS"
            );

            console.log(
                "COMMODITY SIGNALS"
            );

            console.log(
                "INTRADAY SIGNALS"
            );

            console.log(
                "CUSTOMER RECORDS: ENABLED"
            );

            console.log(
                "PAYMENT RECORDS: ENABLED"
            );

            console.log(
                "DASHBOARD STATS: ENABLED"
            );

            console.log(
                "PREMIUM: 2000 INR / 6 MONTHS"
            );

            console.log(
                "ADMIN PANEL: ENABLED"
            );

            console.log(
                "=========================================="
            );
        }
    );
}

// ======================================================
// RUN SERVER
// ======================================================

startServer().catch(
    error => {

        console.error("");
        console.error(
            "=========================================="
        );

        console.error(
            "STOCKPULSE STARTUP FAILED"
        );

        console.error(
            "=========================================="
        );

        console.error(
            error.message
        );

        console.error(
            "=========================================="
        );

        process.exit(1);
    }
);