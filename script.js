/* =========================================================
   STOCKPULSE - COMPLETE LIVE MARKET SCRIPT
   ---------------------------------------------------------
   FIXED:
   - DOM loading issue
   - Live NIFTY / BANKNIFTY / SENSEX / NIFTY IT
   - Crypto prices
   - Stock search
   - Real candlestick charts
   - IST chart time
   - Premium signals
   - Watchlist
   - Premium buttons
   - Duplicate premium API calls removed
   - Better API error handling
========================================================= */

"use strict";


/* =========================================================
   CONFIG
========================================================= */

const API_BASE =
    "https://stockpulse-production-0709.up.railway.app";

const INDIA_TIMEZONE =
    "Asia/Kolkata";


let currentAsset = {
    symbol: "NIFTY50",
    type: "index",
    name: "NIFTY 50",
    exchange: "NSE"
};

let currentTimeframe = "1D";

let chart = null;
let candleSeries = null;
let priceTimer = null;
let chartResizeHandler = null;
let searchTimeout = null;


/* =========================================================
   DOM HELPER
========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   NUMBER FORMAT
========================================================= */

function formatIndianNumber(value) {

    const num = Number(value);

    if (!Number.isFinite(num)) {
        return "--";
    }

    return num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


function formatCryptoPrice(value) {

    const num = Number(value);

    if (!Number.isFinite(num)) {
        return "--";
    }

    if (num >= 1000) {

        return num.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

    }

    if (num >= 1) {
        return num.toFixed(2);
    }

    return num.toFixed(4);
}


/* =========================================================
   FETCH JSON
========================================================= */

async function apiFetch(url, options = {}) {

    try {

        const response =
            await fetch(url, {
                ...options,
                cache: "no-store"
            });


        let data = null;


        try {

            data =
                await response.json();

        } catch {

            throw new Error(
                `Invalid server response (${response.status})`
            );

        }


        if (!response.ok) {

            throw new Error(
                data?.error ||
                data?.message ||
                `API error ${response.status}`
            );

        }


        if (
            data &&
            data.success === false
        ) {

            throw new Error(
                data.error ||
                data.message ||
                "API request failed"
            );

        }


        return data;

    } catch (error) {

        console.error(
            "API request failed:",
            url,
            error
        );

        throw error;

    }
}


/* =========================================================
   THEME
========================================================= */

function setupTheme() {

    const button =
        $("themeToggle");

    if (!button) return;


    const savedTheme =
        localStorage.getItem(
            "stockpulse-theme"
        );


    if (savedTheme === "light") {

        document.body.classList.add(
            "light-mode"
        );

        button.textContent = "☀️";

    } else {

        button.textContent = "🌙";

    }


    button.onclick = () => {

        document.body.classList.toggle(
            "light-mode"
        );


        const light =
            document.body.classList.contains(
                "light-mode"
            );


        localStorage.setItem(
            "stockpulse-theme",
            light ? "light" : "dark"
        );


        button.textContent =
            light ? "☀️" : "🌙";

    };
}


/* =========================================================
   UPDATE HERO NIFTY
========================================================= */

async function updateHeroNifty() {

    try {

        const data =
            await apiFetch(
                `${API_BASE}/api/nifty`
            );


        const heroCard =
            document.querySelector(
                ".hero-card"
            );


        if (!heroCard) return;


        const priceElement =
            heroCard.querySelector("h2");


        const price =
            data?.price ??
            data?.data?.price;


        if (
            price !== undefined &&
            price !== null
        ) {

            priceElement.textContent =
                "₹" +
                formatIndianNumber(price);

        }


        const status =
            heroCard.querySelector(
                ".market-status strong"
            );


        if (status) {

            status.textContent =
                "OPEN";

        }

    } catch (error) {

        console.error(
            "Hero NIFTY error:",
            error.message
        );

    }
}


/* =========================================================
   FIND CARD PRICE ELEMENT
========================================================= */

function getCardPriceElement(card) {

    if (!card) return null;


    return (
        card.querySelector("h2") ||
        card.querySelector(
            ".price, .market-price, .current-price"
        )
    );
}


/* =========================================================
   UPDATE INDEX
========================================================= */

async function updateIndex(
    endpoint,
    selector,
    name
) {

    try {

        const data =
            await apiFetch(
                `${API_BASE}${endpoint}`
            );


        let element =
            document.querySelector(selector);


        if (!element) {

            const symbolMap = {

                "NIFTY": "NIFTY50",
                "BANKNIFTY": "BANKNIFTY",
                "SENSEX": "SENSEX",
                "NIFTY IT": "NIFTYIT"

            };


            const symbol =
                symbolMap[name];


            if (symbol) {

                const card =
                    document.querySelector(
                        `[data-symbol="${symbol}"]`
                    );


                element =
                    getCardPriceElement(card);

            }

        }


        if (!element) {

            console.warn(
                `${name}: price element not found`
            );

            return;

        }


        const price =
            data?.price ??
            data?.data?.price;


        if (
            price !== undefined &&
            price !== null
        ) {

            element.textContent =
                formatIndianNumber(price);

        }

    } catch (error) {

        console.error(
            `${name} price error:`,
            error.message
        );

    }
}


/* =========================================================
   UPDATE ALL INDEX PRICES
========================================================= */

async function updateAllIndexPrices() {

    await Promise.allSettled([

        updateHeroNifty(),

        updateIndex(
            "/api/nifty",
            '[data-symbol="NIFTY50"] h2',
            "NIFTY"
        ),

        updateIndex(
            "/api/banknifty",
            '[data-symbol="BANKNIFTY"] h2',
            "BANKNIFTY"
        ),

        updateIndex(
            "/api/sensex",
            '[data-symbol="SENSEX"] h2',
            "SENSEX"
        ),

        updateIndex(
            "/api/niftyit",
            '[data-symbol="NIFTYIT"] h2',
            "NIFTY IT"
        )

    ]);

}


/* =========================================================
   CRYPTO LIVE PRICE
========================================================= */

async function updateCryptoPrice(symbol) {

    try {

        const data =
            await apiFetch(
                `${API_BASE}/api/crypto?symbol=${encodeURIComponent(symbol)}`
            );


        const element =
            document.querySelector(
                `[data-crypto-price="${symbol}"]`
            );


        if (!element) return;


        const price =
            data?.price ??
            data?.data?.price;


        if (
            price !== undefined &&
            price !== null
        ) {

            element.textContent =
                "$" +
                formatCryptoPrice(price);

        }

    } catch (error) {

        console.error(
            `${symbol} crypto error:`,
            error.message
        );

    }
}


async function updateAllCryptoPrices() {

    await Promise.allSettled([

        updateCryptoPrice("BTC"),
        updateCryptoPrice("ETH"),
        updateCryptoPrice("SOL"),
        updateCryptoPrice("XRP")

    ]);

}


/* =========================================================
   DASHBOARD LIVE PRICES
========================================================= */

async function updateDashboardPrices() {

    await Promise.allSettled([

        updateAllIndexPrices(),
        updateAllCryptoPrices()

    ]);

}


/* =========================================================
   SEARCH
========================================================= */

const localAssets = [

    {
        symbol: "NIFTY50",
        name: "NIFTY 50",
        type: "index",
        exchange: "NSE"
    },

    {
        symbol: "BANKNIFTY",
        name: "BANK NIFTY",
        type: "index",
        exchange: "NSE"
    },

    {
        symbol: "SENSEX",
        name: "SENSEX",
        type: "index",
        exchange: "BSE"
    },

    {
        symbol: "NIFTYIT",
        name: "NIFTY IT",
        type: "index",
        exchange: "NSE"
    },

    {
        symbol: "BTC",
        name: "Bitcoin",
        type: "crypto",
        exchange: "CRYPTO"
    },

    {
        symbol: "ETH",
        name: "Ethereum",
        type: "crypto",
        exchange: "CRYPTO"
    },

    {
        symbol: "SOL",
        name: "Solana",
        type: "crypto",
        exchange: "CRYPTO"
    },

    {
        symbol: "XRP",
        name: "Ripple",
        type: "crypto",
        exchange: "CRYPTO"
    },

    {
        symbol: "GOLD",
        name: "Gold",
        type: "commodity",
        exchange: "COMEX"
    },

    {
        symbol: "SILVER",
        name: "Silver",
        type: "commodity",
        exchange: "COMEX"
    }

];


async function searchStocks(query) {

    const searchResults =
        $("searchResults");


    if (!searchResults) return;


    query =
        String(query || "")
            .trim()
            .toUpperCase();


    if (!query) {

        searchResults.innerHTML = "";

        searchResults.classList.remove(
            "show"
        );

        return;
    }


    let results = [];


    results.push(
        ...localAssets.filter(item =>
            item.symbol.includes(query) ||
            item.name
                .toUpperCase()
                .includes(query)
        )
    );


    try {

        const data =
            await apiFetch(
                `${API_BASE}/api/search?q=${encodeURIComponent(query)}`
            );


        if (
            Array.isArray(
                data?.results
            )
        ) {

            results.push(
                ...data.results.map(s => ({

                    symbol:
                        s.symbol,

                    name:
                        s.name,

                    type:
                        "stock",

                    exchange:
                        s.exchange ||
                        "NSE",

                    instrumentKey:
                        s.instrumentKey

                }))
            );

        }

    } catch (error) {

        console.log(
            "Dynamic stock search unavailable:",
            error.message
        );

    }


    results =
        results.filter(
            (item, index, array) =>
                array.findIndex(
                    x =>
                        x.symbol ===
                        item.symbol
                ) === index
        );


    searchResults.innerHTML = "";


    if (!results.length) {

        searchResults.innerHTML = `
            <div class="search-item">
                No result found
            </div>
        `;

        searchResults.classList.add(
            "show"
        );

        return;
    }


    results
        .slice(0, 10)
        .forEach(item => {

            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "search-item";


            const icon =
                item.type === "crypto"
                    ? "₿"
                    : item.type === "index"
                        ? "📈"
                        : item.type === "commodity"
                            ? "🪙"
                            : "🏛️";


            div.innerHTML = `

                <strong>
                    ${icon}
                    ${escapeHTML(item.symbol)}
                </strong>

                <small>
                    ${escapeHTML(item.name)}
                </small>

            `;


            div.addEventListener(
                "click",
                () => {

                    openAsset({

                        symbol:
                            item.symbol,

                        name:
                            item.name,

                        type:
                            item.type === "commodity"
                                ? "index"
                                : item.type,

                        exchange:
                            item.exchange,

                        instrumentKey:
                            item.instrumentKey

                    });


                    searchResults.innerHTML = "";

                    searchResults.classList.remove(
                        "show"
                    );


                    const input =
                        $("marketSearch");


                    if (input) {
                        input.value = "";
                    }

                }
            );


            searchResults.appendChild(
                div
            );

        });


    searchResults.classList.add(
        "show"
    );

}


/* =========================================================
   SEARCH EVENTS
========================================================= */

function setupSearch() {

    const searchInput =
        $("marketSearch");

    const searchButton =
        $("marketSearchBtn");

    const searchResults =
        $("searchResults");


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            () => {

                clearTimeout(
                    searchTimeout
                );


                searchTimeout =
                    setTimeout(
                        () => {

                            searchStocks(
                                searchInput.value
                            );

                        },
                        300
                    );

            }
        );


        searchInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();


                    searchStocks(
                        searchInput.value
                    );

                }

            }
        );

    }


    if (searchButton) {

        searchButton.addEventListener(
            "click",
            () => {

                searchStocks(
                    searchInput
                        ? searchInput.value
                        : ""
                );

            }
        );

    }


    document.addEventListener(
        "click",
        event => {

            if (
                searchResults &&
                searchInput &&
                !searchResults.contains(
                    event.target
                ) &&
                event.target !==
                    searchInput
            ) {

                searchResults.classList.remove(
                    "show"
                );

            }

        }
    );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   MARKET CARDS
========================================================= */

function setupMarketCards() {

    document
        .querySelectorAll(
            ".market-card, .crypto-card"
        )
        .forEach(card => {

            card.style.cursor =
                "pointer";


            card.addEventListener(
                "click",
                event => {

                    if (
                        event.target.closest(
                            "button, a"
                        )
                    ) {

                        return;

                    }


                    const symbol =
                        card.dataset.symbol;


                    if (!symbol) return;


                    const isCrypto =
                        card.classList.contains(
                            "crypto-card"
                        );


                    const title =
                        card.querySelector(
                            "h3, h4"
                        );


                    openAsset({

                        symbol,

                        type:
                            isCrypto
                                ? "crypto"
                                : "index",

                        name:
                            title
                                ? title.textContent.trim()
                                : symbol,

                        exchange:
                            isCrypto
                                ? "CRYPTO"
                                : "NSE"

                    });

                }
            );


            card.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                            "Enter" ||
                        event.key === " "
                    ) {

                        event.preventDefault();

                        card.click();

                    }

                }
            );

        });

}


/* =========================================================
   HERO CARD
========================================================= */

function setupHeroCard() {

    const heroCard =
        document.querySelector(
            ".hero-card"
        );


    if (!heroCard) return;


    heroCard.style.cursor =
        "pointer";


    heroCard.addEventListener(
        "click",
        () => {

            openAsset({

                symbol: "NIFTY50",

                type: "index",

                name: "NIFTY 50",

                exchange: "NSE"

            });

        }
    );

}


/* =========================================================
   TIMEFRAME NORMALIZER
========================================================= */

function normalizeTimeframe(timeframe) {

    const tf =
        String(
            timeframe || "1D"
        )
        .toUpperCase()
        .trim();


    const map = {

        "1M": "1m",
        "5M": "5m",
        "15M": "15m",
        "1H": "1h",
        "4H": "4h",
        "1D": "1d",
        "1W": "1w",
        "1Y": "1d"

    };


    return map[tf] || "1d";
}


/* =========================================================
   LOAD CHART LIBRARY
========================================================= */

function loadChartLibrary() {

    return new Promise(
        (resolve, reject) => {

            if (
                window.LightweightCharts
            ) {

                resolve();

                return;

            }


            const existing =
                document.querySelector(
                    'script[data-lwc="true"]'
                );


            if (existing) {

                existing.addEventListener(
                    "load",
                    resolve,
                    { once: true }
                );


                existing.addEventListener(
                    "error",
                    reject,
                    { once: true }
                );


                return;

            }


            const script =
                document.createElement(
                    "script"
                );


            script.src =
                "https://unpkg.com/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.js";


            script.dataset.lwc =
                "true";


            script.onload =
                resolve;


            script.onerror =
                () =>
                    reject(
                        new Error(
                            "Chart library failed to load"
                        )
                    );


            document.head.appendChild(
                script
            );

        }
    );

}


/* =========================================================
   CANDLE TIME
========================================================= */

function parseCandleTime(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return null;

    }


    if (
        typeof value === "number" ||
        (
            typeof value === "string" &&
            /^[0-9]+(\.[0-9]+)?$/.test(
                value.trim()
            )
        )
    ) {

        let number =
            Number(value);


        if (!Number.isFinite(number)) {
            return null;
        }


        if (
            number >
            100000000000
        ) {

            number =
                Math.floor(
                    number / 1000
                );

        }


        return Math.floor(number);

    }


    const text =
        String(value).trim();


    if (!text) return null;


    const hasTimezone =
        /(?:Z|[+-]\d{2}:?\d{2})$/i.test(
            text
        );


    let date;


    if (hasTimezone) {

        date =
            new Date(text);

    } else {

        date =
            new Date(
                text.replace(
                    " ",
                    "T"
                ) +
                "+05:30"
            );

    }


    const timestamp =
        date.getTime();


    if (
        !Number.isFinite(
            timestamp
        )
    ) {

        return null;

    }


    return Math.floor(
        timestamp / 1000
    );

}


/* =========================================================
   FORMAT CHART TIME
========================================================= */

function formatChartTime(time) {

    let timestamp;


    if (
        typeof time === "number"
    ) {

        timestamp = time;

    } else {

        timestamp =
            parseCandleTime(time);

    }


    if (
        !Number.isFinite(
            timestamp
        )
    ) {

        return "";

    }


    return new Date(
        timestamp * 1000
    ).toLocaleString(
        "en-IN",
        {

            timeZone:
                INDIA_TIMEZONE,

            day:
                "2-digit",

            month:
                "2-digit",

            year:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit",

            hour12:
                false

        }
    );

}


/* =========================================================
   CHART TICK FORMATTER
========================================================= */

function chartTickFormatter(time) {

    let timestamp;


    if (
        typeof time === "number"
    ) {

        timestamp = time;

    } else {

        timestamp =
            parseCandleTime(time);

    }


    if (
        !Number.isFinite(
            timestamp
        )
    ) {

        return "";

    }


    const date =
        new Date(
            timestamp * 1000
        );


    if (
        [
            "1M",
            "5M",
            "15M",
            "1H",
            "4H"
        ].includes(
            currentTimeframe
        )
    ) {

        return date.toLocaleTimeString(
            "en-IN",
            {

                timeZone:
                    INDIA_TIMEZONE,

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                hour12:
                    false

            }
        );

    }


    return date.toLocaleDateString(
        "en-IN",
        {

            timeZone:
                INDIA_TIMEZONE,

            day:
                "2-digit",

            month:
                "2-digit"

        }
    );

}


/* =========================================================
   CREATE CHART
========================================================= */

async function createChart() {

    const container =
        $("tradingview-chart");


    if (!container) {

        console.warn(
            "Chart container not found"
        );

        return null;

    }


    await loadChartLibrary();


    if (chartResizeHandler) {

        window.removeEventListener(
            "resize",
            chartResizeHandler
        );

        chartResizeHandler =
            null;

    }


    if (chart) {

        try {

            chart.remove();

        } catch {}

        chart = null;
        candleSeries = null;

    }


    container.innerHTML = "";


    const width =
        container.clientWidth ||
        900;


    const height =
        Math.max(
            420,
            container.clientHeight ||
            420
        );


    chart =
        LightweightCharts.createChart(
            container,
            {

                width,

                height,

                layout: {

                    background: {
                        color:
                            "transparent"
                    },

                    textColor:
                        "#9ca3af"

                },

                grid: {

                    vertLines: {
                        color:
                            "rgba(128,128,128,0.10)"
                    },

                    horzLines: {
                        color:
                            "rgba(128,128,128,0.10)"
                    }

                },

                rightPriceScale: {

                    borderColor:
                        "rgba(128,128,128,0.20)"

                },

                timeScale: {

                    borderColor:
                        "rgba(128,128,128,0.20)",

                    timeVisible:
                        true,

                    secondsVisible:
                        false,

                    rightOffset:
                        5,

                    barSpacing:
                        8,

                    tickMarkFormatter:
                        chartTickFormatter

                },

                localization: {

                    timeFormatter:
                        formatChartTime

                },

                crosshair: {

                    mode:
                        LightweightCharts
                            .CrosshairMode
                            .Normal

                }

            }
        );


    candleSeries =
        chart.addCandlestickSeries({

            upColor:
                "#00F5A0",

            downColor:
                "#ff5d6c",

            borderUpColor:
                "#00F5A0",

            borderDownColor:
                "#ff5d6c",

            wickUpColor:
                "#00F5A0",

            wickDownColor:
                "#ff5d6c"

        });


    chartResizeHandler =
        resizeChart;


    window.addEventListener(
        "resize",
        chartResizeHandler
    );


    return chart;

}


/* =========================================================
   RESIZE CHART
========================================================= */

function resizeChart() {

    if (!chart) return;


    const container =
        $("tradingview-chart");


    if (!container) return;


    chart.resize(

        container.clientWidth ||
        900,

        Math.max(
            420,
            container.clientHeight ||
            420
        )

    );

}


/* =========================================================
   NORMALIZE CANDLE
========================================================= */

function normalizeCandle(candle) {

    if (!candle) return null;


    const rawTime =
        candle.time ??
        candle.timestamp ??
        candle.datetime ??
        candle.date;


    const timestamp =
        parseCandleTime(
            rawTime
        );


    if (
        !Number.isFinite(
            timestamp
        )
    ) {

        return null;

    }


    const open =
        Number(candle.open);

    const high =
        Number(candle.high);

    const low =
        Number(candle.low);

    const close =
        Number(candle.close);


    if (
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close)
    ) {

        return null;

    }


    return {

        time:
            timestamp,

        open,
        high,
        low,
        close

    };

}


/* =========================================================
   PREPARE CANDLES
========================================================= */

function prepareCandles(candles) {

    const map =
        new Map();


    candles.forEach(
        candle => {

            const normalized =
                normalizeCandle(
                    candle
                );


            if (!normalized) return;


            map.set(
                normalized.time,
                normalized
            );

        }
    );


    return Array.from(
        map.values()
    )
    .sort(
        (a, b) =>
            a.time -
            b.time
    );

}


/* =========================================================
   STOCK CANDLES
========================================================= */

async function loadStockCandles() {

    const symbol =
        currentAsset.symbol;


    const timeframe =
        normalizeTimeframe(
            currentTimeframe
        );


    try {

        const data =
            await apiFetch(

                `${API_BASE}/api/candles` +
                `?symbol=${encodeURIComponent(symbol)}` +
                `&timeframe=${encodeURIComponent(timeframe)}`

            );


        const candles =
            Array.isArray(
                data?.candles
            )
                ? data.candles
                : [];


        if (!candles.length) {

            throw new Error(
                "No stock candles received"
            );

        }


        if (!candleSeries) {

            await createChart();

        }


        const formatted =
            prepareCandles(
                candles
            );


        if (!formatted.length) {

            throw new Error(
                "Invalid stock candle data"
            );

        }


        candleSeries.setData(
            formatted
        );


        chart
            .timeScale()
            .fitContent();


        updateChartTitle(
            currentAsset.symbol,
            currentAsset.type
        );


        console.log(
            `📊 ${symbol} candles loaded:`,
            formatted.length
        );

    } catch (error) {

        console.error(
            "Stock candle error:",
            error.message
        );


        showChartMessage(
            "Indian market chart data unavailable"
        );

    }

}


/* =========================================================
   CRYPTO CANDLES
========================================================= */

async function loadCryptoCandles() {

    const symbol =
        currentAsset.symbol;


    const resolution =
        normalizeTimeframe(
            currentTimeframe
        );


    try {

        const data =
            await apiFetch(

                `${API_BASE}/api/crypto/candles` +
                `?symbol=${encodeURIComponent(symbol)}` +
                `&resolution=${encodeURIComponent(resolution)}`

            );


        const candles =
            Array.isArray(
                data?.candles
            )
                ? data.candles
                : [];


        if (!candles.length) {

            throw new Error(
                "No crypto candles received"
            );

        }


        if (!candleSeries) {

            await createChart();

        }


        const formatted =
            prepareCandles(
                candles
            );


        if (!formatted.length) {

            throw new Error(
                "Invalid crypto candle data"
            );

        }


        candleSeries.setData(
            formatted
        );


        chart
            .timeScale()
            .fitContent();


        updateChartTitle(
            currentAsset.symbol,
            currentAsset.type
        );


        console.log(
            `📊 ${symbol} crypto candles loaded:`,
            formatted.length
        );

    } catch (error) {

        console.error(
            "Crypto candle error:",
            error.message
        );


        showChartMessage(
            "Crypto chart data unavailable"
        );

    }

}


/* =========================================================
   CHART MESSAGE
========================================================= */

function showChartMessage(message) {

    const container =
        $("tradingview-chart");


    if (!container) return;


    container.innerHTML = `

        <div style="
            height:100%;
            min-height:420px;
            display:flex;
            align-items:center;
            justify-content:center;
            text-align:center;
            padding:30px;
            color:#9ca3af;
            font-size:14px;
        ">

            ${escapeHTML(message)}

        </div>

    `;

}


/* =========================================================
   CHART TITLE
========================================================= */

function updateChartTitle(
    symbol,
    type
) {

    const title =
        $("chartTitle");


    if (!title) return;


    title.textContent =
        `${symbol} • Real Market Chart`;

}


/* =========================================================
   GET INDEX PRICE
========================================================= */

async function getIndexPrice(symbol) {

    const endpointMap = {

        "NIFTY50":
            "/api/nifty",

        "BANKNIFTY":
            "/api/banknifty",

        "SENSEX":
            "/api/sensex",

        "NIFTYIT":
            "/api/niftyit"

    };


    const endpoint =
        endpointMap[
            String(symbol)
                .toUpperCase()
        ];


    if (!endpoint) {

        return null;

    }


    return await apiFetch(
        `${API_BASE}${endpoint}`
    );

}


/* =========================================================
   OPEN ASSET
========================================================= */

function openAsset(asset) {

    currentAsset = {

        symbol:
            String(
                asset?.symbol || ""
            )
            .toUpperCase(),

        type:
            asset?.type ||
            "stock",

        name:
            asset?.name ||
            asset?.symbol ||
            "Market",

        exchange:
            asset?.exchange ||
            (
                asset?.type === "crypto"
                    ? "CRYPTO"
                    : "NSE"
            )

    };


    if (
        [
            "NIFTY50",
            "BANKNIFTY",
            "SENSEX",
            "NIFTYIT"
        ].includes(
            currentAsset.symbol
        )
    ) {

        currentAsset.type =
            "index";

    }


    currentTimeframe =
        "1D";


    const dashboard =
        $("dashboard");

    const detail =
        $("detailView");


    if (dashboard) {

        dashboard.hidden =
            true;

    }


    if (detail) {

        detail.hidden =
            false;

    }


    hideDetailTradingLevels();

    updateDetailHeader();

    setupTimeframeButtons();


    setTimeout(
        async () => {

            try {

                await createChart();

                await loadCurrentChart();

            } catch (error) {

                console.error(
                    "Chart initialization:",
                    error.message
                );


                showChartMessage(
                    "Chart unavailable"
                );

            }

        },
        50
    );


    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

}


/* =========================================================
   HIDE TRADING LEVELS
========================================================= */

function hideDetailTradingLevels() {

    const levelsCard =
        document.querySelector(
            ".levels-card"
        );


    if (levelsCard) {

        levelsCard.style.display =
            "none";

    }


    const analysisGrid =
        document.querySelector(
            ".analysis-grid"
        );


    if (analysisGrid) {

        analysisGrid.style.gridTemplateColumns =
            "1fr";

    }

}


/* =========================================================
   LOAD CURRENT CHART
========================================================= */

async function loadCurrentChart() {

    if (
        currentAsset.type ===
        "crypto"
    ) {

        await loadCryptoCandles();

    } else {

        await loadStockCandles();

    }

}


/* =========================================================
   DETAIL HEADER
========================================================= */

function updateDetailHeader() {

    if ($("detailType")) {

        $("detailType").textContent =

            currentAsset.type === "crypto"
                ? "CRYPTO"
                : currentAsset.type === "index"
                    ? "INDEX"
                    : "STOCK";

    }


    if ($("detailSymbol")) {

        $("detailSymbol").textContent =
            currentAsset.symbol;

    }


    if ($("detailName")) {

        $("detailName").textContent =
            currentAsset.name;

    }


    if ($("detailExchange")) {

        $("detailExchange").textContent =
            `${currentAsset.symbol} • ${currentAsset.exchange}`;

    }


    if ($("chartTitle")) {

        $("chartTitle").textContent =
            `${currentAsset.symbol} • Real Market Chart`;

    }


    updateDetailPrice();

}


/* =========================================================
   DETAIL LIVE PRICE
========================================================= */

async function updateDetailPrice() {

    try {

        let data;


        if (
            currentAsset.type ===
            "crypto"
        ) {

            data =
                await apiFetch(

                    `${API_BASE}/api/crypto` +
                    `?symbol=${encodeURIComponent(
                        currentAsset.symbol
                    )}`

                );


            const price =
                data?.price ??
                data?.data?.price;


            if ($("detailPrice")) {

                $("detailPrice").textContent =
                    "$" +
                    formatCryptoPrice(price);

            }

        }


        else if (
            currentAsset.type ===
            "index"
        ) {

            data =
                await getIndexPrice(
                    currentAsset.symbol
                );


            const price =
                data?.price ??
                data?.data?.price;


            if (
                price !== undefined &&
                price !== null &&
                $("detailPrice")
            ) {

                $("detailPrice").textContent =
                    "₹" +
                    formatIndianNumber(price);

            }

        }


        else {

            data =
                await apiFetch(

                    `${API_BASE}/api/stock` +
                    `?symbol=${encodeURIComponent(
                        currentAsset.symbol
                    )}`

                );


            const price =
                data?.price ??
                data?.data?.price;


            if ($("detailPrice")) {

                $("detailPrice").textContent =
                    "₹" +
                    formatIndianNumber(price);

            }

        }


        if ($("detailChange")) {

            $("detailChange").textContent =
                "LIVE";

        }

    } catch (error) {

        console.error(
            "Detail price error:",
            error.message
        );


        if ($("detailPrice")) {

            $("detailPrice").textContent =
                "--";

        }

    }

}


/* =========================================================
   TIMEFRAME BUTTONS
========================================================= */

function setupTimeframeButtons() {

    document
        .querySelectorAll(
            ".timeframe-bar button"
        )
        .forEach(button => {

            const timeframe =
                button.dataset.timeframe;


            button.classList.toggle(
                "active",
                timeframe ===
                currentTimeframe
            );


            button.onclick =
                async () => {

                    currentTimeframe =
                        timeframe;


                    document
                        .querySelectorAll(
                            ".timeframe-bar button"
                        )
                        .forEach(btn => {

                            btn.classList.toggle(
                                "active",
                                btn === button
                            );

                        });


                    await createChart();

                    await loadCurrentChart();

                };

        });

}


/* =========================================================
   BACK BUTTON
========================================================= */

function setupBackButton() {

    const button =
        $("backDashboard");


    if (!button) return;


    button.onclick =
        () => {

            const dashboard =
                $("dashboard");

            const detail =
                $("detailView");


            if (dashboard) {

                dashboard.hidden =
                    false;

            }


            if (detail) {

                detail.hidden =
                    true;

            }


            if (chartResizeHandler) {

                window.removeEventListener(
                    "resize",
                    chartResizeHandler
                );

                chartResizeHandler =
                    null;

            }


            if (chart) {

                try {

                    chart.remove();

                } catch {}

                chart = null;
                candleSeries = null;

            }


            window.scrollTo({

                top: 0,

                behavior: "smooth"

            });

        };

}


/* =========================================================
   WATCHLIST
========================================================= */

function setupWatchlist() {

    const button =
        $("watchlistBtn");


    if (!button) return;


    button.onclick =
        () => {

            let watchlist;


            try {

                watchlist =
                    JSON.parse(
                        localStorage.getItem(
                            "stockpulse-watchlist"
                        ) || "[]"
                    );

            } catch {

                watchlist = [];

            }


            const exists =
                watchlist.some(
                    item =>
                        item.symbol ===
                        currentAsset.symbol
                );


            if (exists) {

                watchlist =
                    watchlist.filter(
                        item =>
                            item.symbol !==
                            currentAsset.symbol
                    );


                button.textContent =
                    "☆ Add to Watchlist";

            } else {

                watchlist.push({

                    symbol:
                        currentAsset.symbol,

                    name:
                        currentAsset.name,

                    type:
                        currentAsset.type

                });


                button.textContent =
                    "★ Added to Watchlist";

            }


            localStorage.setItem(

                "stockpulse-watchlist",

                JSON.stringify(
                    watchlist
                )

            );

        };

}


/* =========================================================
   SIGNAL TYPE
========================================================= */

function normalizeSignalType(signal) {

    const type =
        String(
            signal?.type || "BUY"
        )
        .toUpperCase()
        .trim();


    if (type === "SELL") {
        return "SELL";
    }


    if (type === "HOLD") {
        return "HOLD";
    }


    return "BUY";

}


/* =========================================================
   SIGNAL CARD STYLE
========================================================= */

function applySignalCardStyle(
    card,
    side
) {

    if (!card) return;


    card.classList.remove(
        "buy",
        "sell",
        "hold"
    );


    card.classList.add(
        side.toLowerCase()
    );

}


/* =========================================================
   SIGNAL BADGE
========================================================= */

function setSignalBadge(
    badge,
    side
) {

    if (!badge) return;


    badge.textContent =
        side;


    badge.classList.remove(
        "buy-badge",
        "sell-badge",
        "hold-badge"
    );


    badge.classList.add(
        `${side.toLowerCase()}-badge`
    );

}


/* =========================================================
   UPDATE STOCK SIGNAL
========================================================= */

function updateStockSignalCard(signal) {

    const card =
        $("dailySignal");


    if (!card) return;


    const side =
        normalizeSignalType(
            signal
        );


    applySignalCardStyle(
        card,
        side
    );


    setSignalBadge(
        $("signalSide"),
        side
    );


    if ($("signalStock")) {

        $("signalStock").textContent =
            signal.name ||
            signal.symbol ||
            "Stock Signal";

    }


    if ($("signalSetup")) {

        $("signalSetup").textContent =
            signal.note ||
            "Updated market setup.";

    }


    if ($("entryPrice")) {

        $("entryPrice").textContent =
            signal.entry ??
            "--";

    }


    if ($("target1Price")) {

        $("target1Price").textContent =
            signal.target1 ??
            "--";

    }


    if ($("target2Price")) {

        $("target2Price").textContent =
            signal.target2 ??
            "--";

    }


    if ($("stopPrice")) {

        $("stopPrice").textContent =
            signal.stopLoss ??
            "--";

    }


    if ($("riskText")) {

        $("riskText").textContent =
            signal.risk ||
            "Medium";

    }


    if ($("marketText")) {

        $("marketText").textContent =
            signal.exchange ||
            "NSE";

    }

}


/* =========================================================
   UPDATE CRYPTO SIGNAL
========================================================= */

function updateCryptoSignalCard(signal) {

    const card =
        $("bitcoinSignal");


    if (!card) return;


    const side =
        normalizeSignalType(
            signal
        );


    applySignalCardStyle(
        card,
        side
    );


    setSignalBadge(
        card.querySelector(
            ".signal-badge"
        ),
        side
    );


    const title =
        card.querySelector("h2");


    if (title) {

        title.textContent =
            signal.name ||
            signal.symbol ||
            "CRYPTO";

    }


    const paragraphs =
        card.querySelectorAll(
            ":scope > p"
        );


    if (paragraphs.length) {

        paragraphs[0].textContent =
            signal.note ||
            "Updated crypto market setup.";

    }


    const levelSpans =
        card.querySelectorAll(
            ".signal-levels p span"
        );


    if (levelSpans.length >= 4) {

        levelSpans[0].textContent =
            signal.entry ?? "--";

        levelSpans[1].textContent =
            signal.target1 ?? "--";

        levelSpans[2].textContent =
            signal.target2 ?? "--";

        levelSpans[3].textContent =
            signal.stopLoss ?? "--";

    }


    const infoSpans =
        card.querySelectorAll(
            ".signal-info p span"
        );


    if (infoSpans.length >= 3) {

        infoSpans[0].textContent =
            signal.risk ||
            "Medium";

        infoSpans[1].textContent =
            "Short Term";

        infoSpans[2].textContent =
            signal.exchange ||
            "CRYPTO";

    }

}


/* =========================================================
   UPDATE GOLD SIGNAL
========================================================= */

function updateGoldSignalCard(signal) {

    const card =
        $("goldSignal");


    if (!card) return;


    const side =
        normalizeSignalType(
            signal
        );


    applySignalCardStyle(
        card,
        side
    );


    setSignalBadge(
        card.querySelector(
            ".signal-badge"
        ),
        side
    );


    const title =
        card.querySelector("h2");


    if (title) {

        title.textContent =
            signal.name ||
            signal.symbol ||
            "GOLD";

    }


    const paragraphs =
        card.querySelectorAll(
            ":scope > p"
        );


    if (paragraphs.length) {

        paragraphs[0].textContent =
            signal.note ||
            "Updated gold market setup.";

    }


    const levelSpans =
        card.querySelectorAll(
            ".signal-levels p span"
        );


    if (levelSpans.length >= 4) {

        levelSpans[0].textContent =
            signal.entry ?? "--";

        levelSpans[1].textContent =
            signal.target1 ?? "--";

        levelSpans[2].textContent =
            signal.target2 ?? "--";

        levelSpans[3].textContent =
            signal.stopLoss ?? "--";

    }


    const infoSpans =
        card.querySelectorAll(
            ".signal-info p span"
        );


    if (infoSpans.length >= 3) {

        infoSpans[0].textContent =
            signal.risk ||
            "Medium";

        infoSpans[1].textContent =
            "Short Term";

        infoSpans[2].textContent =
            signal.exchange ||
            "COMMODITY";

    }

}


/* =========================================================
   PREMIUM TOKEN
========================================================= */

function getPremiumToken() {

    return localStorage.getItem(
        "stockpulsePremiumToken"
    );

}


/* =========================================================
   PREMIUM LOCK
========================================================= */

function showPremiumLock() {

    const recommendation =
        $("todayRecommendation");

    const lock =
        $("premiumLock");


    if (recommendation) {

        recommendation.style.display =
            "none";

    }


    if (lock) {

        lock.style.display =
            "block";

    }

}


/* =========================================================
   PREMIUM CONTENT
========================================================= */

function showPremiumContent() {

    const recommendation =
        $("todayRecommendation");

    const lock =
        $("premiumLock");


    if (lock) {

        lock.style.display =
            "none";

    }


    if (recommendation) {

        recommendation.style.display =
            "block";

    }

}


/* =========================================================
   RENDER TODAY SIGNALS
========================================================= */

function renderTodaySignals(signals) {

    const container =
        $("todaySignals");


    if (!container) return;


    if (
        !Array.isArray(signals) ||
        signals.length === 0
    ) {

        container.innerHTML = `

            <div style="
                padding:20px;
                color:#9ca3af;
                text-align:center;
            ">

                Today's recommendation
                will be updated soon.

            </div>

        `;

        return;

    }


    container.innerHTML =
        signals
            .map(signal => {

                const side =
                    normalizeSignalType(
                        signal
                    );


                const sideClass =
                    side === "BUY"
                        ? "buy"
                        : side === "SELL"
                            ? "sell"
                            : "hold";


                return `

                    <div
                        class="today-signal-card ${sideClass}"
                        style="
                            background:#0b1220;
                            border:1px solid #263244;
                            border-radius:15px;
                            padding:20px;
                            margin-top:15px;
                        "
                    >

                        <div style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            gap:10px;
                            margin-bottom:12px;
                        ">

                            <div>

                                <h3 style="
                                    margin:0 0 5px 0;
                                    font-size:20px;
                                ">
                                    ${escapeHTML(
                                        signal.symbol ||
                                        "MARKET"
                                    )}
                                </h3>

                                <p style="
                                    margin:0;
                                    color:#9ca3af;
                                    font-size:13px;
                                ">
                                    ${escapeHTML(
                                        signal.name ||
                                        ""
                                    )}
                                </p>

                            </div>

                            <span
                                class="signal-badge ${side.toLowerCase()}-badge"
                                style="
                                    display:inline-flex;
                                    align-items:center;
                                    justify-content:center;
                                    padding:7px 14px;
                                    border-radius:20px;
                                    font-weight:700;
                                    font-size:13px;
                                "
                            >
                                ${escapeHTML(side)}
                            </span>

                        </div>


                        ${
                            signal.note
                                ? `

                                    <p style="
                                        margin:10px 0 18px;
                                        color:#d1d5db;
                                        line-height:1.5;
                                    ">
                                        ${escapeHTML(
                                            signal.note
                                        )}
                                    </p>

                                `
                                : ""
                        }


                        <div style="
                            display:grid;
                            grid-template-columns:
                                repeat(
                                    auto-fit,
                                    minmax(120px,1fr)
                                );
                            gap:10px;
                            margin-top:10px;
                        ">


                            <div style="
                                padding:12px;
                                border:1px solid #263244;
                                border-radius:10px;
                            ">

                                <small style="
                                    display:block;
                                    color:#9ca3af;
                                    margin-bottom:5px;
                                ">
                                    Entry
                                </small>

                                <strong>
                                    ${escapeHTML(
                                        signal.entry ??
                                        "--"
                                    )}
                                </strong>

                            </div>


                            <div style="
                                padding:12px;
                                border:1px solid #263244;
                                border-radius:10px;
                            ">

                                <small style="
                                    display:block;
                                    color:#9ca3af;
                                    margin-bottom:5px;
                                ">
                                    Stop Loss
                                </small>

                                <strong>
                                    ${escapeHTML(
                                        signal.stopLoss ??
                                        "--"
                                    )}
                                </strong>

                            </div>


                            <div style="
                                padding:12px;
                                border:1px solid #263244;
                                border-radius:10px;
                            ">

                                <small style="
                                    display:block;
                                    color:#9ca3af;
                                    margin-bottom:5px;
                                ">
                                    Target 1
                                </small>

                                <strong>
                                    ${escapeHTML(
                                        signal.target1 ??
                                        "--"
                                    )}
                                </strong>

                            </div>


                            <div style="
                                padding:12px;
                                border:1px solid #263244;
                                border-radius:10px;
                            ">

                                <small style="
                                    display:block;
                                    color:#9ca3af;
                                    margin-bottom:5px;
                                ">
                                    Target 2
                                </small>

                                <strong>
                                    ${escapeHTML(
                                        signal.target2 ??
                                        "--"
                                    )}
                                </strong>

                            </div>


                            <div style="
                                padding:12px;
                                border:1px solid #263244;
                                border-radius:10px;
                            ">

                                <small style="
                                    display:block;
                                    color:#9ca3af;
                                    margin-bottom:5px;
                                ">
                                    Target 3
                                </small>

                                <strong>
                                    ${escapeHTML(
                                        signal.target3 ??
                                        "--"
                                    )}
                                </strong>

                            </div>

                        </div>


                        <div style="
                            display:flex;
                            flex-wrap:wrap;
                            gap:15px;
                            margin-top:18px;
                            padding-top:14px;
                            border-top:1px solid #263244;
                            color:#9ca3af;
                            font-size:13px;
                        ">

                            <span>
                                Risk:
                                <strong style="color:#fff;">
                                    ${escapeHTML(
                                        signal.risk ||
                                        "Medium"
                                    )}
                                </strong>
                            </span>


                            <span>
                                Exchange:
                                <strong style="color:#fff;">
                                    ${escapeHTML(
                                        signal.exchange ||
                                        "NSE"
                                    )}
                                </strong>
                            </span>


                            <span>
                                Setup:
                                <strong style="color:#fff;">
                                    ${escapeHTML(side)}
                                </strong>
                            </span>

                        </div>

                    </div>

                `;

            })
            .join("");

}


/* =========================================================
   LOAD PREMIUM SIGNALS
   ---------------------------------------------------------
   SINGLE FUNCTION
========================================================= */

async function loadSignals() {

    const token =
        getPremiumToken();


    if (!token) {

        showPremiumLock();

        return;

    }


    try {

        const response =
            await fetch(
                `${API_BASE}/api/signals`,
                {

                    method:
                        "GET",

                    cache:
                        "no-store",

                    headers: {

                        Authorization:
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"

                    }

                }
            );


        let data;


        try {

            data =
                await response.json();

        } catch {

            throw new Error(
                "Invalid server response"
            );

        }


        if (
            response.status === 401 ||
            response.status === 403 ||
            !response.ok ||
            !data.success
        ) {

            localStorage.removeItem(
                "stockpulsePremiumToken"
            );


            localStorage.removeItem(
                "stockpulsePremium"
            );


            showPremiumLock();

            return;

        }


        showPremiumContent();


        const signals =
            Array.isArray(
                data.signals
            )
                ? data.signals
                : [];


        renderTodaySignals(
            signals
        );


        let stockSignal =
            null;

        let cryptoSignal =
            null;

        let goldSignal =
            null;


        signals.forEach(
            signal => {

                if (!signal) return;


                const symbol =
                    String(
                        signal.symbol || ""
                    )
                    .toUpperCase();


                const name =
                    String(
                        signal.name || ""
                    )
                    .toUpperCase();


                const isCrypto =
                    symbol.includes("BTC") ||
                    symbol.includes("ETH") ||
                    symbol.includes("SOL") ||
                    symbol.includes("XRP") ||
                    symbol.includes("USDT") ||
                    name.includes("BITCOIN") ||
                    name.includes("ETHEREUM") ||
                    name.includes("SOLANA") ||
                    name.includes("XRP");


                const isGold =
                    symbol.includes("GOLD") ||
                    symbol.includes("XAU") ||
                    symbol.includes("GOLDM") ||
                    name.includes("GOLD") ||
                    name.includes("XAU");


                if (
                    isGold &&
                    !goldSignal
                ) {

                    goldSignal =
                        signal;

                }

                else if (
                    isCrypto &&
                    !cryptoSignal
                ) {

                    cryptoSignal =
                        signal;

                }

                else if (
                    !isCrypto &&
                    !isGold &&
                    !stockSignal
                ) {

                    stockSignal =
                        signal;

                }

            }
        );


        if (stockSignal) {

            updateStockSignalCard(
                stockSignal
            );

        }


        if (cryptoSignal) {

            updateCryptoSignalCard(
                cryptoSignal
            );

        }


        if (goldSignal) {

            updateGoldSignalCard(
                goldSignal
            );

        }


        console.log(
            "📡 Premium signals loaded:",
            signals.length
        );

    } catch (error) {

        console.error(
            "Signal load error:",
            error.message
        );

    }

}


/* =========================================================
   PREMIUM BUTTONS
========================================================= */

function setupPremiumButtons() {

    const buttons = [

        $("premiumBtn"),
        $("premiumBtnBottom")

    ];


    buttons.forEach(
        button => {

            if (!button) return;


            button.onclick =
                event => {

                    event.preventDefault();


                    window.location.href =
                        "payment.html";

                };

        }
    );

}


/* =========================================================
   ESC KEY
========================================================= */

function setupEscapeKey() {

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {

                return;

            }


            const detail =
                $("detailView");


            if (
                detail &&
                !detail.hidden
            ) {

                const back =
                    $("backDashboard");


                if (back) {

                    back.click();

                }

            }

        }
    );

}


/* =========================================================
   AUTO REFRESH
========================================================= */

function startLiveUpdates() {

    clearInterval(
        priceTimer
    );


    priceTimer =
        setInterval(
            async () => {

                try {

                    await updateDashboardPrices();


                    const detail =
                        $("detailView");


                    if (
                        detail &&
                        !detail.hidden
                    ) {

                        await updateDetailPrice();

                    }


                    /*
                       Premium signals are refreshed
                       only if a token exists.
                    */

                    if (
                        getPremiumToken()
                    ) {

                        await loadSignals();

                    }

                } catch (error) {

                    console.error(
                        "Live update error:",
                        error.message
                    );

                }

            },
            5000
        );

}


/* =========================================================
   INITIALIZE
========================================================= */

async function initStockPulse() {

    console.log(
        "🚀 StockPulse frontend starting..."
    );


    try {

        setupTheme();

        setupSearch();

        setupMarketCards();

        setupHeroCard();

        setupBackButton();

        setupWatchlist();

        setupPremiumButtons();

        setupEscapeKey();

        hideDetailTradingLevels();


        /*
           IMPORTANT:
           Dashboard prices load immediately.
        */

        await updateDashboardPrices();


        /*
           Premium only loads once.
        */

        await loadSignals();


        startLiveUpdates();


        console.log(
            "✅ StockPulse frontend ready"
        );

    } catch (error) {

        console.error(
            "❌ StockPulse initialization error:",
            error
        );


        /*
           Even if one API fails,
           website should NOT remain stuck.
        */

        startLiveUpdates();

    }

}


/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initStockPulse,
        { once: true }
    );

} else {

    initStockPulse();

}