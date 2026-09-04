/* =========================================================
   STOCKPULSE - COMPLETE FREE LIVE MARKET SCRIPT
   =========================================================
   FEATURES:
   - Live NIFTY / BANKNIFTY / SENSEX / NIFTY IT
   - Live Crypto prices
   - Indian Stock Search - NSE / BSE
   - MCX Commodity Search
   - Real candlestick charts
   - IST chart time
   - FREE Today Recommendations
   - Entry / SL / Target 1 / Target 2 / Target 3
   - Risk / Exchange / Setup
   - Watchlist
   - Railway API support
   - Automatic signal refresh
   - NO PAYMENT
   - NO PREMIUM LOCK
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
    exchange: "NSE",
    instrumentKey: "NSE_INDEX|Nifty 50",
    segment: "INDEX",
    instrumentType: "INDEX",
    expiry: ""
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
   SAFE VALUE HELPER
========================================================= */

function getSignalValue(signal, keys) {

    if (!signal || !Array.isArray(keys)) {
        return null;
    }

    for (const key of keys) {

        const value = signal[key];

        if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {
            return value;
        }
    }

    return null;
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
            price !== null &&
            priceElement
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
   LOCAL SEARCH ASSETS
   ---------------------------------------------------------
   IMPORTANT:
   Gold/Silver ko yahan static COMEX nahi rakha.
   MCX commodities backend se dynamically aayengi.
========================================================= */

const localAssets = [

    {
        symbol: "NIFTY50",
        name: "NIFTY 50",
        type: "index",
        exchange: "NSE",
        instrumentKey: "NSE_INDEX|Nifty 50",
        segment: "INDEX",
        instrumentType: "INDEX"
    },

    {
        symbol: "BANKNIFTY",
        name: "BANK NIFTY",
        type: "index",
        exchange: "NSE",
        instrumentKey: "NSE_INDEX|Nifty Bank",
        segment: "INDEX",
        instrumentType: "INDEX"
    },

    {
        symbol: "SENSEX",
        name: "SENSEX",
        type: "index",
        exchange: "BSE",
        instrumentKey: "BSE_INDEX|SENSEX",
        segment: "INDEX",
        instrumentType: "INDEX"
    },

    {
        symbol: "NIFTYIT",
        name: "NIFTY IT",
        type: "index",
        exchange: "NSE",
        instrumentKey: "NSE_INDEX|Nifty IT",
        segment: "INDEX",
        instrumentType: "INDEX"
    },

    {
        symbol: "BTC",
        name: "Bitcoin",
        type: "crypto",
        exchange: "CRYPTO",
        instrumentKey: "",
        segment: "CRYPTO",
        instrumentType: "CRYPTO"
    },

    {
        symbol: "ETH",
        name: "Ethereum",
        type: "crypto",
        exchange: "CRYPTO",
        instrumentKey: "",
        segment: "CRYPTO",
        instrumentType: "CRYPTO"
    },

    {
        symbol: "SOL",
        name: "Solana",
        type: "crypto",
        exchange: "CRYPTO",
        instrumentKey: "",
        segment: "CRYPTO",
        instrumentType: "CRYPTO"
    },

    {
        symbol: "XRP",
        name: "Ripple",
        type: "crypto",
        exchange: "CRYPTO",
        instrumentKey: "",
        segment: "CRYPTO",
        instrumentType: "CRYPTO"
    }

];


/* =========================================================
   SEARCH STOCKS / COMMODITIES
========================================================= */

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


    /* -----------------------------------------------------
       LOCAL ASSETS
    ----------------------------------------------------- */

    results.push(
        ...localAssets.filter(item =>
            item.symbol.includes(query) ||
            String(item.name || "")
                .toUpperCase()
                .includes(query)
        )
    );


    /* -----------------------------------------------------
       RAILWAY / UPSTOX SEARCH
    ----------------------------------------------------- */

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
                ...data.results.map(item => ({

                    symbol:
                        item.symbol ||
                        item.tradingSymbol ||
                        item.shortName ||
                        item.name ||
                        "",

                    name:
                        item.name ||
                        item.shortName ||
                        item.tradingSymbol ||
                        item.symbol ||
                        "",

                    type:
                        item.type ||
                        "stock",

                    exchange:
                        item.exchange ||
                        (
                            item.type === "commodity"
                                ? "MCX"
                                : "NSE"
                        ),

                    instrumentKey:
                        item.instrumentKey ||
                        item.instrument_key ||
                        "",

                    segment:
                        item.segment ||
                        "",

                    instrumentType:
                        item.instrumentType ||
                        item.instrument_type ||
                        "",

                    expiry:
                        item.expiry ||
                        "",

                    tradingSymbol:
                        item.tradingSymbol ||
                        item.trading_symbol ||
                        ""

                }))
            );

        }

    } catch (error) {

        console.log(
            "Dynamic market search unavailable:",
            error.message
        );

    }


    /* -----------------------------------------------------
       REMOVE INVALID RESULTS
    ----------------------------------------------------- */

    results =
        results.filter(item =>
            item &&
            item.symbol
        );


    /* -----------------------------------------------------
       REMOVE DUPLICATES
       Instrument key preferred.
    ----------------------------------------------------- */

    const seen =
        new Set();


    results =
        results.filter(item => {

            const key =
                item.instrumentKey ||
                `${item.symbol}-${item.exchange}-${item.expiry || ""}`;

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);

            return true;

        });


    /* -----------------------------------------------------
       SORT RESULTS
       Exact symbol first.
    ----------------------------------------------------- */

    results.sort((a, b) => {

        const aSymbol =
            String(a.symbol || "")
                .toUpperCase();

        const bSymbol =
            String(b.symbol || "")
                .toUpperCase();


        const aExact =
            aSymbol === query
                ? 0
                : 1;

        const bExact =
            bSymbol === query
                ? 0
                : 1;


        if (aExact !== bExact) {
            return aExact - bExact;
        }


        const aName =
            String(a.name || "")
                .toUpperCase();

        const bName =
            String(b.name || "")
                .toUpperCase();


        return aName.localeCompare(
            bName
        );

    });


    searchResults.innerHTML = "";


    if (!results.length) {

        searchResults.innerHTML = `
            <div class="search-item">
                <strong>🔎 No result found</strong>
                <small>Try stock name, symbol, Gold, Silver, Crude, etc.</small>
            </div>
        `;

        searchResults.classList.add(
            "show"
        );

        return;

    }


    /* -----------------------------------------------------
       DISPLAY MAX 12 RESULTS
    ----------------------------------------------------- */

    results
        .slice(0, 12)
        .forEach(item => {

            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "search-item";


            let icon = "🏛️";


            if (
                item.type === "crypto"
            ) {

                icon = "₿";

            } else if (
                item.type === "index"
            ) {

                icon = "📈";

            } else if (
                item.type === "commodity"
            ) {

                icon = "🪙";

            }


            const exchange =
                item.exchange
                    ? ` • ${escapeHTML(item.exchange)}`
                    : "";


            const expiry =
                item.expiry
                    ? ` • ${escapeHTML(item.expiry)}`
                    : "";


            div.innerHTML = `

                <strong>
                    ${icon}
                    ${escapeHTML(item.symbol)}
                </strong>

                <small>
                    ${escapeHTML(item.name)}
                    ${exchange}
                    ${expiry}
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
                            item.type,

                        exchange:
                            item.exchange,

                        instrumentKey:
                            item.instrumentKey ||
                            "",

                        segment:
                            item.segment ||
                            "",

                        instrumentType:
                            item.instrumentType ||
                            "",

                        expiry:
                            item.expiry ||
                            ""

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
                    event.key === "Enter"
                ) {

                    event.preventDefault();


                    clearTimeout(
                        searchTimeout
                    );


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


                    let instrumentKey =
                        "";


                    if (
                        symbol === "NIFTY50"
                    ) {

                        instrumentKey =
                            "NSE_INDEX|Nifty 50";

                    } else if (
                        symbol === "BANKNIFTY"
                    ) {

                        instrumentKey =
                            "NSE_INDEX|Nifty Bank";

                    } else if (
                        symbol === "SENSEX"
                    ) {

                        instrumentKey =
                            "BSE_INDEX|SENSEX";

                    } else if (
                        symbol === "NIFTYIT"
                    ) {

                        instrumentKey =
                            "NSE_INDEX|Nifty IT";

                    }


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
                                : symbol === "SENSEX"
                                    ? "BSE"
                                    : "NSE",

                        instrumentKey

                    });

                }
            );


            card.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter" ||
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

                exchange: "NSE",

                instrumentKey:
                    "NSE_INDEX|Nifty 50"

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
        window.innerWidth <= 600
            ? 10
            : 8,

    minBarSpacing:
        window.innerWidth <= 600
            ? 6
            : 3,

    tickMarkFormatter:
        chartTickFormatter,

    lockVisibleTimeRangeOnResize:
        false,

    rightBarStaysOnScroll:
        false

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


/* Mobile chart resize + date/time labels */
setTimeout(() => {

    resizeChart();

    if (chart) {

        chart.timeScale().applyOptions({

            barSpacing:
                window.innerWidth <= 600
                    ? 10
                    : 8,

            minBarSpacing:
                window.innerWidth <= 600
                    ? 6
                    : 3,

            timeVisible:
                true,

            secondsVisible:
                false,

            tickMarkFormatter:
                chartTickFormatter

        });

    }

}, 150);


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
   STOCK / INDEX / MCX CANDLES
========================================================= */

async function loadStockCandles() {

    const symbol =
        currentAsset.symbol;


    const timeframe =
        normalizeTimeframe(
            currentTimeframe
        );


    try {

        const params =
            new URLSearchParams({

                symbol:
                    symbol || "",

                instrument_key:
                    currentAsset.instrumentKey || "",

                timeframe:
                    timeframe

            });


        const data =
            await apiFetch(

                `${API_BASE}/api/candles?${params.toString()}`

            );


        const candles =
            Array.isArray(
                data?.candles
            )
                ? data.candles
                : [];


        if (!candles.length) {

            throw new Error(
                "No market candles received"
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
                "Invalid market candle data"
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
            "Market candle error:",
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

    const symbol =
        String(
            asset?.symbol || ""
        )
        .toUpperCase();


    let instrumentKey =
        asset?.instrumentKey || "";


    /* -----------------------------------------------------
       Known index fallback
    ----------------------------------------------------- */

    if (!instrumentKey) {

        const knownKeys = {

            "NIFTY50":
                "NSE_INDEX|Nifty 50",

            "BANKNIFTY":
                "NSE_INDEX|Nifty Bank",

            "SENSEX":
                "BSE_INDEX|SENSEX",

            "NIFTYIT":
                "NSE_INDEX|Nifty IT"

        };


        instrumentKey =
            knownKeys[symbol] || "";

    }


    currentAsset = {

        symbol,

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
                    : asset?.type === "commodity"
                        ? "MCX"
                        : "NSE"
            ),

        instrumentKey,

        segment:
            asset?.segment ||
            "",

        instrumentType:
            asset?.instrumentType ||
            "",

        expiry:
            asset?.expiry ||
            ""

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

        return;

    }


    /*
       STOCK
       INDEX
       MCX COMMODITY
       Sab generic candles endpoint
       se jayenge.
    */

    await loadStockCandles();

}


/* =========================================================
   DETAIL HEADER
========================================================= */

function updateDetailHeader() {

    if ($("detailType")) {

        $("detailType").textContent =

            currentAsset.type === "crypto"
                ? "CRYPTO"

                : currentAsset.type === "commodity"
                    ? "COMMODITY"

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


        /* -------------------------------------------------
           CRYPTO
        ------------------------------------------------- */

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


        /* -------------------------------------------------
           KNOWN INDEX
           Only use old endpoint if no instrument key.
        ------------------------------------------------- */

        else if (
            currentAsset.type === "index" &&
            !currentAsset.instrumentKey
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


        /* -------------------------------------------------
           GENERIC NSE / BSE / MCX / INDEX
        ------------------------------------------------- */

        else {

            if (
                currentAsset.instrumentKey
            ) {

                data =
                    await apiFetch(

                        `${API_BASE}/api/quote` +
                        `?instrument_key=${encodeURIComponent(
                            currentAsset.instrumentKey
                        )}`

                    );

            } else {

                data =
                    await apiFetch(

                        `${API_BASE}/api/stock` +
                        `?symbol=${encodeURIComponent(
                            currentAsset.symbol
                        )}`

                    );

            }


            const price =
                data?.price ??
                data?.lastPrice ??
                data?.last_price ??
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
                        (
                            item.instrumentKey &&
                            currentAsset.instrumentKey &&
                            item.instrumentKey ===
                            currentAsset.instrumentKey
                        ) ||
                        (
                            !item.instrumentKey &&
                            !currentAsset.instrumentKey &&
                            item.symbol ===
                            currentAsset.symbol
                        )
                );


            if (exists) {

                watchlist =
                    watchlist.filter(
                        item =>
                            !(
                                (
                                    item.instrumentKey &&
                                    currentAsset.instrumentKey &&
                                    item.instrumentKey ===
                                    currentAsset.instrumentKey
                                ) ||
                                (
                                    !item.instrumentKey &&
                                    !currentAsset.instrumentKey &&
                                    item.symbol ===
                                    currentAsset.symbol
                                )
                            )
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
                        currentAsset.type,

                    exchange:
                        currentAsset.exchange,

                    instrumentKey:
                        currentAsset.instrumentKey ||
                        "",

                    segment:
                        currentAsset.segment ||
                        "",

                    instrumentType:
                        currentAsset.instrumentType ||
                        "",

                    expiry:
                        currentAsset.expiry ||
                        ""

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

    const rawType =
        getSignalValue(
            signal,
            [
                "type",
                "signal",
                "action",
                "recommendation",
                "side",
                "direction"
            ]
        );


    const type =
        String(
            rawType || "BUY"
        )
        .toUpperCase()
        .trim();


    if (
        type.includes("SELL") ||
        type.includes("SHORT")
    ) {

        return "SELL";

    }


    if (
        type.includes("HOLD") ||
        type.includes("WAIT")
    ) {

        return "HOLD";

    }


    return "BUY";

}


/* =========================================================
   SIGNAL CARD STYLE
========================================================= */

function applySignalCardStyle(card, side) {

    if (!card) return;


    card.classList.remove(
        "buy",
        "sell",
        "hold"
    );


    card.classList.add(
        String(side || "BUY").toLowerCase()
    );

}


/* =========================================================
   SIGNAL BADGE
========================================================= */

function setSignalBadge(badge, side) {

    if (!badge) return;


    const safeSide =
        String(side || "BUY")
            .toUpperCase();


    badge.textContent =
        safeSide;


    badge.classList.remove(
        "buy-badge",
        "sell-badge",
        "hold-badge"
    );


    badge.classList.add(
        `${safeSide.toLowerCase()}-badge`
    );

}


/* =========================================================
   NORMALIZE SIGNAL
========================================================= */

function normalizeSignal(signal) {

    if (!signal) {
        return null;
    }


    return {

        category:
            getSignalValue(
                signal,
                [
                    "category",
                    "typeCategory",
                    "signalCategory"
                ]
            ),

        symbol:
            getSignalValue(
                signal,
                [
                    "symbol",
                    "stock",
                    "ticker",
                    "instrument",
                    "scrip"
                ]
            ),

        name:
            getSignalValue(
                signal,
                [
                    "name",
                    "stockName",
                    "companyName",
                    "title"
                ]
            ),

        type:
            normalizeSignalType(signal),

        note:
            getSignalValue(
                signal,
                [
                    "note",
                    "setup",
                    "reason",
                    "description",
                    "comment",
                    "analysis",
                    "message"
                ]
            ),

        entry:
            getSignalValue(
                signal,
                [
                    "entry",
                    "entryPrice",
                    "entry_price",
                    "buyPrice",
                    "buy_price",
                    "entryLevel"
                ]
            ),

        target1:
            getSignalValue(
                signal,
                [
                    "target1",
                    "target_1",
                    "targetOne",
                    "target",
                    "targetPrice",
                    "target_price",
                    "tp1",
                    "tp_1"
                ]
            ),

        target2:
            getSignalValue(
                signal,
                [
                    "target2",
                    "target_2",
                    "targetTwo",
                    "tp2",
                    "tp_2"
                ]
            ),

        target3:
            getSignalValue(
                signal,
                [
                    "target3",
                    "target_3",
                    "targetThree",
                    "tp3",
                    "tp_3"
                ]
            ),

        stopLoss:
            getSignalValue(
                signal,
                [
                    "stopLoss",
                    "stop_loss",
                    "stoploss",
                    "sl",
                    "stop",
                    "stopPrice",
                    "stop_price"
                ]
            ),

        risk:
            getSignalValue(
                signal,
                [
                    "risk",
                    "riskLevel",
                    "risk_level"
                ]
            ),

        exchange:
            getSignalValue(
                signal,
                [
                    "exchange",
                    "market",
                    "segment"
                ]
            )
        ,

        signalDate:
            getSignalValue(
                signal,
                [
                    "signalDate",
                    "date",
                    "updateDate",
                    "updatedDate"
                ]
            ),

        signalTime:
            getSignalValue(
                signal,
                [
                    "signalTime",
                    "time",
                    "updateTime",
                    "updatedTime"
                ]
            )
    };

}


/* =========================================================
   SIGNAL CATEGORY NORMALIZER
========================================================= */

function normalizeSignalCategory(signal) {

    if (!signal) {
        return null;
    }


    const normalized =
        normalizeSignal(signal);


    const rawCategory =
        String(
            normalized.category || ""
        )
        .toLowerCase()
        .trim();


    if (
        rawCategory === "stocks" ||
        rawCategory === "stock" ||
        rawCategory === "indian-stock" ||
        rawCategory === "indian_stock"
    ) {

        return "stock";

    }


    if (
        rawCategory === "crypto" ||
        rawCategory === "cryptocurrency"
    ) {

        return "crypto";

    }


    if (
        rawCategory === "commodity" ||
        rawCategory === "commodities" ||
        rawCategory === "gold"
    ) {

        return "commodity";

    }


    if (
        rawCategory === "intraday" ||
        rawCategory === "intra-day" ||
        rawCategory === "intra_day"
    ) {

        return "intraday";

    }


    const symbol =
        String(
            normalized.symbol || ""
        )
        .toUpperCase();


    const name =
        String(
            normalized.name || ""
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
        name.includes("RIPPLE");


    if (isCrypto) {
        return "crypto";
    }


    const isCommodity =
        symbol.includes("GOLD") ||
        symbol.includes("XAU") ||
        symbol.includes("GOLDM") ||
        symbol.includes("SILVER") ||
        symbol.includes("XAG") ||
        symbol.includes("CRUDE") ||
        symbol.includes("NATURALGAS") ||
        name.includes("GOLD") ||
        name.includes("SILVER") ||
        name.includes("CRUDE") ||
        name.includes("NATURAL GAS") ||
        name.includes("XAU") ||
        name.includes("XAG");


    if (isCommodity) {
        return "commodity";
    }


    const setupText =
        String(
            normalized.note || ""
        )
        .toLowerCase();


    if (
        setupText.includes("intraday") ||
        setupText.includes("scalp") ||
        setupText.includes("same day")
    ) {

        return "intraday";

    }


    return "stock";

}


/* =========================================================
   SIGNAL CARD CONFIG
========================================================= */

const SIGNAL_CARD_CONFIG = {

   stock: {

    card:
        "stockSignal",

    side:
        "stockSide",

    name:
        "stockName",

    setup:
        "stockSetup",

    entry:
        "stockEntry",

    target1:
        "stockTarget1",

    target2:
        "stockTarget2",

    target3:
        "stockTarget3",

    stopLoss:
        "stockSL",

    risk:
        "stockRisk",

    date:
        "stockSignalDate",

    time:
        "stockSignalTime"

},

    crypto: {

    card:
        "cryptoSignal",

    side:
        "cryptoSide",

    name:
        "cryptoName",

    setup:
        "cryptoSetup",

    entry:
        "cryptoEntry",

    target1:
        "cryptoTarget1",

    target2:
        "cryptoTarget2",

    target3:
        "cryptoTarget3",

    stopLoss:
        "cryptoSL",

    risk:
        "cryptoRisk",

    date:
        "cryptoSignalDate",

    time:
        "cryptoSignalTime"

},


   commodity: {

    card:
        "goldSignal",

    side:
        "goldSide",

    name:
        "goldName",

    setup:
        "goldSetup",

    entry:
        "goldEntry",

    target1:
        "goldTarget1",

    target2:
        "goldTarget2",

    target3:
        "goldTarget3",

    stopLoss:
        "goldSL",

    risk:
        "goldRisk",

    date:
        "goldSignalDate",

    time:
        "goldSignalTime"

},

    intraday: {

    card:
        "intradaySignal",

    side:
        "intradaySide",

    name:
        "intradayName",

    setup:
        "intradaySetup",

    entry:
        "intradayEntry",

    target1:
        "intradayTarget1",

    target2:
        "intradayTarget2",

    target3:
        "intradayTarget3",

    stopLoss:
        "intradaySL",

    risk:
        "intradayRisk",

    date:
        "intradaySignalDate",

    time:
        "intradaySignalTime"

}
};


/* =========================================================
   CLEAR SIGNAL CARD
========================================================= */

function clearSignalCard(category) {

    const config =
        SIGNAL_CARD_CONFIG[category];


    if (!config) return;


    const card =
        $(config.card);


    if (card) {

        applySignalCardStyle(
            card,
            "HOLD"
        );

    }


    if ($(config.side)) {

        setSignalBadge(
            $(config.side),
            "HOLD"
        );

    }


    if ($(config.name)) {

        $(config.name).textContent =
            category === "stock"
                ? "No Stock Signal"
                : category === "crypto"
                    ? "No Crypto Signal"
                    : category === "commodity"
                        ? "No Commodity Signal"
                        : "No Intraday Signal";

    }


    if ($(config.setup)) {

        $(config.setup).textContent =
            "Today's recommendation will be updated soon.";

    }


    if ($(config.entry)) {

        $(config.entry).textContent =
            "--";

    }


    if ($(config.target1)) {

        $(config.target1).textContent =
            "--";

    }


    if ($(config.target2)) {

        $(config.target2).textContent =
            "--";

    }


    if ($(config.target3)) {

        $(config.target3).textContent =
            "--";

    }


    if ($(config.stopLoss)) {

        $(config.stopLoss).textContent =
            "--";

    }


    if ($(config.risk)) {

        $(config.risk).textContent =
            "--";

    }
    if ($(config.date)) {

        $(config.date).textContent =
            "--";

    }

    if ($(config.time)) {

        $(config.time).textContent =
            "--";

    }
}


/* =========================================================
   UPDATE ONE FIXED SIGNAL CARD
========================================================= */

function updateSignalCard(
    category,
    signal
) {

    const config =
        SIGNAL_CARD_CONFIG[category];


    if (!config) return;


    const normalized =
        normalizeSignal(signal);


    if (!normalized) {

        clearSignalCard(category);

        return;

    }


    const card =
        $(config.card);


    const side =
        normalized.type ||
        "BUY";


    if (card) {

        applySignalCardStyle(
            card,
            side
        );

    }


    if ($(config.side)) {

        setSignalBadge(
            $(config.side),
            side
        );

    }


    if ($(config.name)) {

        $(config.name).textContent =
            normalized.name ||
            normalized.symbol ||
            "Market Signal";

    }


    if ($(config.setup)) {

        $(config.setup).textContent =
            normalized.note ||
            "Updated market setup.";

    }


    if ($(config.entry)) {

        $(config.entry).textContent =
            normalized.entry ??
            "--";

    }


    if ($(config.target1)) {

        $(config.target1).textContent =
            normalized.target1 ??
            "--";

    }


    if ($(config.target2)) {

        $(config.target2).textContent =
            normalized.target2 ??
            "--";

    }


    if ($(config.target3)) {

        $(config.target3).textContent =
            normalized.target3 ??
            "--";

    }


    if ($(config.stopLoss)) {

        $(config.stopLoss).textContent =
            normalized.stopLoss ??
            "--";

    }


    if ($(config.risk)) {

        $(config.risk).textContent =
            normalized.risk ||
            "Medium";

    }
    if ($(config.date)) {

        $(config.date).textContent =
            normalized.signalDate ||
            "--";

    }

    if ($(config.time)) {

        $(config.time).textContent =
            normalized.signalTime ||
            "--";

    }
}


/* =========================================================
   RENDER TODAY SIGNALS
========================================================= */

function renderTodaySignals(signals) {

    clearSignalCard("stock");
    clearSignalCard("crypto");
    clearSignalCard("commodity");
    clearSignalCard("intraday");


    if (
        !Array.isArray(signals) ||
        signals.length === 0
    ) {

        return;

    }


    const categorySignals = {

        stock: null,
        crypto: null,
        commodity: null,
        intraday: null

    };


    signals.forEach(
        signal => {

            if (!signal) return;


            const category =
                normalizeSignalCategory(
                    signal
                );


            if (!category) return;


            if (
                !categorySignals[category]
            ) {

                categorySignals[category] =
                    signal;

            }

        }
    );


    if (categorySignals.stock) {

        updateSignalCard(
            "stock",
            categorySignals.stock
        );

    }


    if (categorySignals.crypto) {

        updateSignalCard(
            "crypto",
            categorySignals.crypto
        );

    }


    if (categorySignals.commodity) {

        updateSignalCard(
            "commodity",
            categorySignals.commodity
        );

    }


    if (categorySignals.intraday) {

        updateSignalCard(
            "intraday",
            categorySignals.intraday
        );

    }


    console.log(
        "📊 Today signal cards updated:",
        categorySignals
    );

}


/* =========================================================
   LOAD SIGNALS - FREE
========================================================= */

async function loadSignals() {

    try {

        const response =
            await fetch(
                `${API_BASE}/api/signals`,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch {

            throw new Error(
                `Invalid server response (${response.status})`
            );

        }


        console.log(
            "📡 Signals API response:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data?.error ||
                data?.message ||
                `Signals API error ${response.status}`
            );

        }


        if (
            data &&
            data.success === false
        ) {

            throw new Error(
                data.error ||
                data.message ||
                "Signals API failed"
            );

        }


        let signals = [];


        if (
            Array.isArray(
                data?.signals
            )
        ) {

            signals =
                data.signals;

        }

        else if (
            Array.isArray(
                data?.data
            )
        ) {

            signals =
                data.data;

        }

        else if (
            Array.isArray(
                data?.recommendations
            )
        ) {

            signals =
                data.recommendations;

        }


        signals =
            signals.filter(
                signal => {

                    if (
                        signal &&
                        signal.active === false
                    ) {

                        return false;

                    }

                    return true;

                }
            );


        console.log(
            "📊 Normalized signals:",
            signals
        );


        renderTodaySignals(
            signals
        );


        console.log(
            "✅ Free signals loaded:",
            signals.length
        );


    } catch (error) {

        console.error(
            "❌ Signal load error:",
            error.message
        );


        /*
           PAYMENT/PREMIUM SYSTEM REMOVED.
           Error hone par sirf default cards dikhao.
        */

        renderTodaySignals([]);

    }

}


/* =========================================================
   OLD PREMIUM BUTTONS
   ---------------------------------------------------------
   Payment removed.
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


                    const recommendation =
                        $("todayRecommendation");


                    if (recommendation) {

                        recommendation.scrollIntoView({

                            behavior:
                                "smooth",

                            block:
                                "start"

                        });

                    }

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


                    await loadSignals();


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
        "🚀 StockPulse FREE frontend starting..."
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


        await updateDashboardPrices();


        await loadSignals();


        startLiveUpdates();


        console.log(
            "✅ StockPulse FREE frontend ready"
        );


    } catch (error) {

        console.error(
            "❌ StockPulse initialization error:",
            error
        );


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
        {
            once: true
        }
    );

} else {

    initStockPulse();

}