// ======================================================
// STOCKPULSE - SERVER
// FREE VERSION
// Upstox + Delta Exchange
// MongoDB REMOVED
// Razorpay REMOVED
// Premium REMOVED
// Live Prices + Real Candles
// Dynamic NSE Search
// Admin Signals
// ======================================================

"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT) || 8080;
// ======================================================
// STATIC WEBSITE FILES
// ======================================================

app.use(express.static(__dirname));

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());

// ======================================================
// ENV
// ======================================================

const UPSTOX_ACCESS_TOKEN =
    process.env.UPSTOX_ACCESS_TOKEN || "";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "";

// ======================================================
// CONFIG
// ======================================================

console.log("");
console.log("==========================================");
console.log("       STOCKPULSE CONFIGURATION");
console.log("==========================================");

console.log(
    "UPSTOX:",
    UPSTOX_ACCESS_TOKEN
        ? "Configured"
        : "NOT CONFIGURED"
);

console.log(
    "ADMIN PASSWORD:",
    ADMIN_PASSWORD
        ? "Configured"
        : "NOT CONFIGURED"
);

console.log("MONGODB: REMOVED");
console.log("RAZORPAY: REMOVED");
console.log("PREMIUM: REMOVED");

console.log("==========================================");

// ======================================================
// UPSTOX
// ======================================================

const UPSTOX_API =
    "https://api.upstox.com";

function upstoxHeaders() {

    return {
        Accept: "application/json",
        "Content-Type": "application/json",
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

        data = await response.json();

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

// ======================================================
// UPSTOX LTP
// ======================================================

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
            Number(index.last_price);

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
            error: error.message
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
        STATIC_INSTRUMENTS[query]
            .startsWith("NSE_EQ|")
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
        UPSTOX_API +
        "/v2/instruments/search" +
        "?query=" +
        encodeURIComponent(query) +
        "&exchanges=NSE" +
        "&segments=EQ" +
        "&page_number=1" +
        "&records=30";

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
        results.find(
            item =>
                String(
                    item.trading_symbol || ""
                )
                    .toUpperCase() === query &&
                String(
                    item.segment || ""
                )
                    .toUpperCase() === "NSE_EQ"
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
                await upstoxFetch(url);

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
                Number(stock.last_price);

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

                exchange:
                    instrument.exchange ||
                    "NSE",

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
    }
);

// ======================================================
// DELTA EXCHANGE
// ======================================================

const DELTA_API_URL =
    "https://api.india.delta.exchange";

async function getDeltaTicker(symbol) {

    const url =
        DELTA_API_URL +
        "/v2/tickers/" +
        encodeURIComponent(symbol);

    const response =
        await fetch(
            url,
            {
                method: "GET",

                headers: {
                    Accept: "application/json",
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

    BTC: "BTCUSD",
    ETH: "ETHUSD",
    SOL: "SOLUSD",
    XRP: "XRPUSD"
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
                CRYPTO_SYMBOLS[symbol];

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
                price: Number(price)
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
    }
);

// ======================================================
// TIMEFRAME CONFIG
// ======================================================

function getTimeframeConfig(timeframe) {

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

function getISTDate(daysAgo = 0) {

    const now = new Date();

    now.setUTCDate(
        now.getUTCDate() -
        daysAgo
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
        getTimeframeConfig(
            timeframe
        );

    if (!config) {

        throw new Error(
            "Invalid timeframe"
        );
    }

    if (
        ["minutes", "hours"]
            .includes(config.unit)
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

    return await upstoxFetch(url);
}

// ======================================================
// FORMAT UPSTOX CANDLES
// ======================================================

function formatUpstoxCandles(
    rawCandles
) {

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
            const open = Number(candle[1]);
            const high = Number(candle[2]);
            const low = Number(candle[3]);
            const close = Number(candle[4]);
            const volume = Number(candle[5] || 0);

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
        .sort(
            (a, b) =>
                new Date(a.time).getTime() -
                new Date(b.time).getTime()
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
                STATIC_INSTRUMENTS[symbol];

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
                error: error.message
            });
        }
    }
);

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

        const time = Number(candle[0]);
        const open = Number(candle[1]);
        const high = Number(candle[2]);
        const low = Number(candle[3]);
        const close = Number(candle[4]);
        const volume = Number(candle[5] || 0);

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

        const time =
            Number(
                candle.time ??
                candle.timestamp ??
                candle.ts
            );

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
                CRYPTO_SYMBOLS[symbol];

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
                DELTA_API_URL +
                "/v2/history/candles" +
                "?resolution=" +
                encodeURIComponent(resolution) +
                "&symbol=" +
                encodeURIComponent(deltaSymbol) +
                "&start=" +
                start +
                "&end=" +
                end;

            const response =
                await fetch(
                    url,
                    {
                        method: "GET",

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
                    .map(
                        normalizeDeltaCandle
                    )
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
    }
);

// ======================================================
// ADMIN AUTH
// ======================================================

function verifyAdmin(
    req,
    res,
    next
) {

    const headerPassword =
        String(
            req.headers["x-admin-password"] ||
            ""
        ).trim();

    const authorization =
        String(
            req.headers.authorization ||
            ""
        ).trim();

    let password =
        headerPassword;

    if (
        !password &&
        authorization
            .toLowerCase()
            .startsWith("bearer ")
    ) {

        password =
            authorization
                .slice(7)
                .trim();
    }

    if (!ADMIN_PASSWORD) {

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
                "Unauthorized admin access"
        });
    }

    next();
}

// ======================================================
// HEALTH
// ======================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            status: "OK",

            server:
                "StockPulse",

            database:
                "MongoDB disabled",

            payments:
                "Disabled",

            premium:
                "Disabled",

            signals:
                "Enabled",

            signalCount:
                signals.length,

            timestamp:
                new Date().toISOString()
        });
    }
);

// ======================================================
// ADMIN LOGIN
// ======================================================

app.post(
    "/api/admin/login",
    (req, res) => {

        try {

            const password =
                String(
                    req.body?.password ||
                    ""
                ).trim();

            if (!ADMIN_PASSWORD) {

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

app.get(
    "/api/admin/status",
    verifyAdmin,
    (req, res) => {

        res.json({

            success: true,

            authenticated: true,

            mongoConnected: false,

            message:
                "Admin authentication successful"
        });
    }
);

// ======================================================
// SIGNAL STORAGE
// ======================================================
//
// Temporary memory storage.
// MongoDB intentionally disabled.
//
// Railway restart/redeploy = signals reset.
// ======================================================

let signals = [];

// ======================================================
// CATEGORY NORMALIZER
// ======================================================

function normalizeCategory(category) {

    const value =
        String(
            category || ""
        )
            .toLowerCase()
            .trim();

    const map = {

        stock: "stocks",
        stocks: "stocks",

        crypto: "crypto",

        gold: "commodity",
        commodity: "commodity",

        intraday: "intraday"
    };

    return map[value] || "";
}

// ======================================================
// CLEAN SIGNAL
// ======================================================

function cleanSignal(body) {

    const category =
        normalizeCategory(
            body.category
        );

    const symbol =
        String(
            body.symbol ||
            body.name ||
            ""
        )
            .trim()
            .toUpperCase();

    const name =
        String(
            body.name ||
            symbol
        )
            .trim()
            .toUpperCase();

    const type =
        String(
            body.type ||
            "BUY"
        )
            .trim()
            .toUpperCase();

    const exchange =
        String(
            body.exchange ||
            (
                category === "crypto"
                    ? "CRYPTO"
                    : category === "commodity"
                        ? "MCX"
                        : "NSE"
            )
        )
            .trim()
            .toUpperCase();

    const entry =
        body.entry === undefined ||
        body.entry === null
            ? ""
            : String(body.entry).trim();

    const stopLoss =
        body.stopLoss === undefined ||
        body.stopLoss === null
            ? ""
            : String(body.stopLoss).trim();

    const target1 =
        body.target1 === undefined ||
        body.target1 === null
            ? ""
            : String(body.target1).trim();

    const target2 =
        body.target2 === undefined ||
        body.target2 === null
            ? ""
            : String(body.target2).trim();

    const target3 =
        body.target3 === undefined ||
        body.target3 === null
            ? ""
            : String(body.target3).trim();

    const risk =
        String(
            body.risk ||
            "Medium"
        ).trim();

    const note =
        String(
            body.note ||
            body.setup ||
            ""
        ).trim();

    const active =
        body.active !== false;

    return {

        id:
            body.id ||
            crypto.randomUUID(),

        category,

        symbol,

        name,

        type,

        exchange,

        entry,

        stopLoss,

        target1,

        target2,

        target3,

        risk,

        note,

        setup:
            note,

        active,

        updatedAt:
            new Date().toISOString()
    };
}

// ======================================================
// GET ADMIN SIGNALS
// ======================================================

app.get(
    "/api/admin/signals",
    verifyAdmin,
    (req, res) => {

        res.json({

            success: true,

            count:
                signals.length,

            signals
        });
    }
);

// ======================================================
// SAVE / UPDATE SIGNAL
// ======================================================

app.post(
    "/api/admin/signals",
    verifyAdmin,
    (req, res) => {

        try {

            const signal =
                cleanSignal(
                    req.body || {}
                );

            if (!signal.category) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid signal category"
                });
            }

            if (!signal.symbol) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Symbol is required"
                });
            }

            if (
                !["BUY", "SELL"]
                    .includes(signal.type)
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "BUY or SELL is required"
                });
            }

            if (!signal.entry) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Entry is required"
                });
            }

            if (!signal.stopLoss) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Stop Loss is required"
                });
            }

            if (!signal.target1) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Target 1 is required"
                });
            }

            if (!signal.target2) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Target 2 is required"
                });
            }

            if (!signal.target3) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Target 3 is required"
                });
            }

            const existingIndex =
                signals.findIndex(
                    item =>
                        item.id === signal.id
                );

            if (existingIndex >= 0) {

                signals[existingIndex] =
                    signal;

            } else {

                signals.push(signal);
            }

            console.log(
                "SIGNAL SAVED:",
                JSON.stringify(signal)
            );

            res.json({

                success: true,

                message:
                    "Signal saved successfully",

                signal,

                signals
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
// DELETE SIGNAL
// ======================================================

app.delete(
    "/api/admin/signals/:id",
    verifyAdmin,
    (req, res) => {

        try {

            const id =
                String(
                    req.params.id || ""
                ).trim();

            const oldLength =
                signals.length;

            signals =
                signals.filter(
                    item =>
                        item.id !== id
                );

            if (
                signals.length === oldLength
            ) {

                return res.status(404).json({

                    success: false,

                    error:
                        "Signal not found"
                });
            }

            console.log(
                "SIGNAL DELETED:",
                id
            );

            res.json({

                success: true,

                message:
                    "Signal deleted successfully",

                count:
                    signals.length
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

app.get(
    "/api/signals",
    (req, res) => {

        try {

            const activeSignals =
                signals.filter(
                    signal =>
                        signal.active === true
                );

            res.setHeader(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, proxy-revalidate"
            );

            res.setHeader(
                "Pragma",
                "no-cache"
            );

            res.setHeader(
                "Expires",
                "0"
            );

            res.json({

                success: true,

                count:
                    activeSignals.length,

                signals:
                    activeSignals
            });

        } catch (error) {

            console.error(
                "PUBLIC SIGNAL ERROR:",
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
// ADMIN STATS
// ======================================================

app.get(
    "/api/admin/stats",
    verifyAdmin,
    (req, res) => {

        res.json({

            success: true,

            stats: {

                totalCustomers: 0,
                totalPayments: 0,
                successfulPayments: 0,
                totalRevenue: 0,
                activePremium: 0,

                totalSignals:
                    signals.length,

                activeSignals:
                    signals.filter(
                        signal =>
                            signal.active
                    ).length
            },

            message:
                "MongoDB and payment system are disabled."
        });
    }
);

// ======================================================
// ADMIN CUSTOMERS
// ======================================================

app.get(
    "/api/admin/customers",
    verifyAdmin,
    (req, res) => {

        res.json({

            success: true,

            count: 0,

            customers: [],

            message:
                "Customer database is disabled."
        });
    }
);

// ======================================================
// ADMIN PAYMENTS
// ======================================================

app.get(
    "/api/admin/payments",
    verifyAdmin,
    (req, res) => {

        res.json({

            success: true,

            count: 0,

            payments: [],

            message:
                "Payment system is disabled."
        });
    }
);

// ======================================================
// ROOT
// ======================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "StockPulse API Server is running",

            version:
                "Free",

            database:
                "MongoDB Disabled",

            payment:
                "Disabled",

            premium:
                "Disabled",

            signalsStorage:
                "Temporary Memory",

            signalCount:
                signals.length,

            endpoints: [

                "/api/health",

                "/api/nifty",

                "/api/banknifty",

                "/api/sensex",

                "/api/niftyit",

                "/api/stock?symbol=RELIANCE",

                "/api/search?q=RELIANCE",

                "/api/candles?symbol=NIFTY50&timeframe=1m",

                "/api/crypto?symbol=BTC",

                "/api/crypto/candles?symbol=BTC&resolution=1m",

                "/api/signals",

                "/api/admin/login",

                "/api/admin/signals",

                "/api/admin/stats"
            ]
        });
    }
);

// ======================================================
// START SERVER
// ======================================================

function startServer() {

    console.log("");
    console.log("==========================================");
    console.log("       STOCKPULSE SERVER STARTING");
    console.log("==========================================");

    console.log(
        "Port:",
        PORT
    );

    console.log(
        "Upstox:",
        UPSTOX_ACCESS_TOKEN
            ? "READY"
            : "NOT CONFIGURED"
    );

    console.log(
        "Admin:",
        ADMIN_PASSWORD
            ? "READY"
            : "NOT CONFIGURED"
    );

    console.log(
        "MongoDB: DISABLED"
    );

    console.log(
        "Razorpay: DISABLED"
    );

    console.log(
        "Premium: DISABLED"
    );

    console.log(
        "Signals: ENABLED"
    );

    console.log("==========================================");

    app.listen(
        PORT,
        "0.0.0.0",
        () => {

            console.log("");
            console.log(
                "STOCKPULSE SERVER STARTED"
            );

            console.log(
                "Listening on port:",
                PORT
            );

            console.log(
                "Health: /api/health"
            );

            console.log(
                "Signals: /api/signals"
            );

            console.log(
                "Admin Signals: /api/admin/signals"
            );

            console.log(
                "=========================================="
            );
        }
    );
}

startServer();