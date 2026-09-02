require("dotenv").config();
// ============================================================
// STOCKPULSE - COMPLETE SERVER
// MongoDB + Admin Signals + Upstox + Delta Exchange
// FREE WEBSITE - NO PAYMENT / RAZORPAY
// ============================================================

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

const PORT =
    process.env.PORT || 3000;

const MONGODB_URI =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD ||
    "stockpulse-admin";

const UPSTOX_ACCESS_TOKEN =
    process.env.UPSTOX_ACCESS_TOKEN ||
    "";

const DELTA_API_URL =
    "https://api.india.delta.exchange";


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());

app.use(
    express.json({
        limit: "1mb"
    })
);

// Serve frontend HTML/CSS/JS files
app.use(express.static(__dirname));


// ============================================================
// MONGODB
// ============================================================

const signalSchema =
    new mongoose.Schema(
        {
            category:{
                type:String,
                required:true,
                index:true
            },

            symbol:{
                type:String,
                required:true
            },

            name:{
                type:String,
                default:""
            },

            side:{
                type:String,
                default:"BUY"
            },

            entry:{
                type:String,
                default:""
            },

            stopLoss:{
                type:String,
                default:""
            },

            target1:{
                type:String,
                default:""
            },

            target2:{
                type:String,
                default:""
            },

            target3:{
                type:String,
                default:""
            },

            risk:{
                type:String,
                default:"Medium"
            },

            exchange:{
                type:String,
                default:"NSE"
            },

            setup:{
                type:String,
                default:""
            },

            active:{
                type:Boolean,
                default:true
            }
        },
        {
            timestamps:true
        }
    );


const Signal =
    mongoose.model(
        "Signal",
        signalSchema
    );


// ============================================================
// CATEGORY NORMALIZATION
// ============================================================

function normalizeCategory(value){

    const v =
        String(value || "")
        .trim()
        .toLowerCase();

    if(
        v === "stock" ||
        v === "stocks"
    ){
        return "stocks";
    }

    if(
        v === "crypto"
    ){
        return "crypto";
    }

    if(
        v === "gold" ||
        v === "goldg" ||
        v === "gold g" ||
        v === "gold/g" ||
        v === "commodity"
    ){
        return "commodity";
    }

    if(
        v === "intraday"
    ){
        return "intraday";
    }

    return v;
}


// ============================================================
// SYMBOL NORMALIZATION
// ============================================================

function normalizeSymbol(
    symbol,
    category
){

    let value =
        String(symbol || "")
        .trim()
        .toUpperCase();

    if(category === "commodity"){

        if(
            value === "GOLD" ||
            value === "GOLDG" ||
            value === "GOLD G" ||
            value === "GOLD/G"
        ){

            return "GOLDG";
        }
    }

    return value;
}


// ============================================================
// SIGNAL OUTPUT
// ============================================================

function signalOutput(signal){

    return {

        _id:
            signal._id,

        id:
            signal._id,

        category:
            signal.category,

        symbol:
            signal.symbol,

        name:
            signal.name,

        side:
            signal.side,

        type:
            signal.side,

        advice:
            signal.side,

        entry:
            signal.entry,

        target:
            signal.target1,

        target1:
            signal.target1,

        target2:
            signal.target2,

        target3:
            signal.target3,

        stopLoss:
            signal.stopLoss,

        sl:
            signal.stopLoss,

        stop:
            signal.stopLoss,

        risk:
            signal.risk,

        exchange:
            signal.exchange,

        setup:
            signal.setup,

        note:
            signal.setup,

        active:
            signal.active,

        createdAt:
            signal.createdAt,

        updatedAt:
            signal.updatedAt
    };
}


// ============================================================
// ADMIN AUTH
// ============================================================

function requireAdmin(
    req,
    res,
    next
){

    const password =
        req.headers[
            "x-admin-password"
        ];

    if(
        !password ||
        password !== ADMIN_PASSWORD
    ){

        return res.status(401).json({
            success:false,
            error:"Unauthorized"
        });
    }

    next();
}


// ============================================================
// ADMIN LOGIN
// ============================================================

app.post(
    "/api/admin/login",
    (req,res)=>{

        const password =
            req.body?.password || "";

        if(
            password !==
            ADMIN_PASSWORD
        ){

            return res.status(401).json({
                success:false,
                error:"Invalid admin password"
            });
        }

        res.json({
            success:true,
            message:"Admin login successful"
        });
    }
);


// ============================================================
// ADMIN STATUS
// ============================================================

app.get(
    "/api/admin/status",
    requireAdmin,
    async(req,res)=>{

        res.json({
            success:true,
            mongo:
                mongoose.connection.readyState === 1,
            message:
                "Admin authenticated"
        });
    }
);


// ============================================================
// GET ADMIN SIGNALS
// ============================================================

app.get(
    "/api/admin/signals",
    requireAdmin,
    async(req,res)=>{

        try{

            const signals =
                await Signal.find({})
                .sort({
                    updatedAt:-1
                })
                .lean();

            res.json({
                success:true,
                signals:
                    signals.map(
                        signalOutput
                    )
            });

        }catch(error){

            console.error(
                "ADMIN SIGNAL GET ERROR:",
                error
            );

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// CREATE / UPDATE SIGNAL
// ============================================================

app.post(
    "/api/admin/signals",
    requireAdmin,
    async(req,res)=>{

        try{

            const body =
                req.body || {};

            const category =
                normalizeCategory(
                    body.category ||
                    body.type
                );

            if(!category){

                return res.status(400).json({
                    success:false,
                    error:
                        "Category is required"
                });
            }


            const symbol =
                normalizeSymbol(
                    body.symbol ||
                    body.name,
                    category
                );


            if(!symbol){

                return res.status(400).json({
                    success:false,
                    error:
                        "Symbol is required"
                });
            }


            const name =
                String(
                    body.name ||
                    symbol
                ).trim();


            const side =
                String(
                    body.side ||
                    body.type ||
                    "BUY"
                )
                .trim()
                .toUpperCase();


            const update = {

                category,

                symbol,

                name,

                side,

                entry:
                    String(
                        body.entry || ""
                    ).trim(),

                stopLoss:
                    String(
                        body.stopLoss ||
                        body.sl ||
                        body.stop ||
                        ""
                    ).trim(),

                target1:
                    String(
                        body.target1 ||
                        body.target ||
                        ""
                    ).trim(),

                target2:
                    String(
                        body.target2 || ""
                    ).trim(),

                target3:
                    String(
                        body.target3 || ""
                    ).trim(),

                risk:
                    String(
                        body.risk ||
                        "Medium"
                    ).trim(),

                exchange:
                    String(
                        body.exchange ||
                        (
                            category ===
                            "commodity"
                                ? "MCX"
                                : category ===
                                  "crypto"
                                    ? "Crypto"
                                    : "NSE"
                        )
                    ).trim(),

                setup:
                    String(
                        body.setup ||
                        body.note ||
                        ""
                    ).trim(),

                active:
                    body.active !== false
            };


            let signal;


            // ------------------------------------------------
            // UPDATE BY ID
            // ------------------------------------------------

            if(
                body.id &&
                mongoose.Types.ObjectId.isValid(
                    body.id
                )
            ){

                signal =
                    await Signal.findByIdAndUpdate(
                        body.id,
                        update,
                        {
                            new:true,
                            runValidators:true
                        }
                    );
            }


            // ------------------------------------------------
            // UPDATE EXISTING CATEGORY + SYMBOL
            // ------------------------------------------------

            if(!signal){

                signal =
                    await Signal.findOneAndUpdate(
                        {
                            category,
                            symbol
                        },
                        update,
                        {
                            new:true,
                            upsert:true,
                            runValidators:true,
                            setDefaultsOnInsert:true
                        }
                    );
            }


            res.json({

                success:true,

                message:
                    "Signal saved successfully",

                signal:
                    signalOutput(signal)
            });

        }catch(error){

            console.error(
                "ADMIN SIGNAL SAVE ERROR:",
                error
            );

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// UPDATE SIGNAL BY ID
// ============================================================

app.put(
    "/api/admin/signals/:id",
    requireAdmin,
    async(req,res)=>{

        try{

            const id =
                req.params.id;

            if(
                !mongoose.Types.ObjectId
                .isValid(id)
            ){

                return res.status(400).json({
                    success:false,
                    error:
                        "Invalid signal ID"
                });
            }


            const body =
                req.body || {};


            const category =
                normalizeCategory(
                    body.category
                );


            const update = {};


            if(category)
                update.category =
                    category;


            if(
                body.symbol ||
                body.name
            ){

                update.symbol =
                    normalizeSymbol(
                        body.symbol ||
                        body.name,
                        category
                    );
            }


            if(body.name)
                update.name =
                    String(
                        body.name
                    ).trim();


            if(
                body.side ||
                body.type
            ){

                update.side =
                    String(
                        body.side ||
                        body.type
                    )
                    .trim()
                    .toUpperCase();
            }


            if(body.entry !== undefined)
                update.entry =
                    String(
                        body.entry
                    ).trim();


            if(
                body.stopLoss !== undefined ||
                body.sl !== undefined
            ){

                update.stopLoss =
                    String(
                        body.stopLoss ??
                        body.sl ??
                        ""
                    ).trim();
            }


            if(
                body.target1 !== undefined ||
                body.target !== undefined
            ){

                update.target1 =
                    String(
                        body.target1 ??
                        body.target ??
                        ""
                    ).trim();
            }


            if(body.target2 !== undefined)
                update.target2 =
                    String(
                        body.target2
                    ).trim();


            if(body.target3 !== undefined)
                update.target3 =
                    String(
                        body.target3
                    ).trim();


            if(body.setup !== undefined)
                update.setup =
                    String(
                        body.setup
                    ).trim();


            if(body.note !== undefined)
                update.setup =
                    String(
                        body.note
                    ).trim();


            if(body.risk !== undefined)
                update.risk =
                    String(
                        body.risk
                    ).trim();


            if(body.exchange !== undefined)
                update.exchange =
                    String(
                        body.exchange
                    ).trim();


            if(body.active !== undefined)
                update.active =
                    Boolean(
                        body.active
                    );


            const signal =
                await Signal.findByIdAndUpdate(
                    id,
                    update,
                    {
                        new:true,
                        runValidators:true
                    }
                );


            if(!signal){

                return res.status(404).json({
                    success:false,
                    error:
                        "Signal not found"
                });
            }


            res.json({
                success:true,
                signal:
                    signalOutput(signal)
            });

        }catch(error){

            console.error(
                "SIGNAL UPDATE ERROR:",
                error
            );

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// DELETE SIGNAL BY ID
// ============================================================

app.delete(
    "/api/admin/signals/:id",
    requireAdmin,
    async(req,res)=>{

        try{

            const id =
                req.params.id;


            if(
                !mongoose.Types.ObjectId
                .isValid(id)
            ){

                return res.status(400).json({
                    success:false,
                    error:
                        "Invalid signal ID"
                });
            }


            const deleted =
                await Signal.findByIdAndDelete(
                    id
                );


            if(!deleted){

                return res.status(404).json({
                    success:false,
                    error:
                        "Signal not found"
                });
            }


            res.json({

                success:true,

                message:
                    "Signal deleted successfully",

                id
            });

        }catch(error){

            console.error(
                "DELETE SIGNAL ERROR:",
                error
            );

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// DELETE BY CATEGORY + SYMBOL
// ============================================================

app.delete(
    "/api/admin/signals",
    requireAdmin,
    async(req,res)=>{

        try{

            const category =
                normalizeCategory(
                    req.query.category
                );

            const symbol =
                normalizeSymbol(
                    req.query.symbol,
                    category
                );


            if(!category || !symbol){

                return res.status(400).json({
                    success:false,
                    error:
                        "Category and symbol required"
                });
            }


            const result =
                await Signal.deleteMany({
                    category,
                    symbol
                });


            res.json({

                success:true,

                message:
                    "Signal deleted successfully",

                deletedCount:
                    result.deletedCount
            });

        }catch(error){

            console.error(
                "DELETE SIGNAL ERROR:",
                error
            );

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// PUBLIC SIGNALS
// ============================================================

app.get(
    "/api/signals",
    async(req,res)=>{

        try{

            const signals =
                await Signal.find({
                    active:true
                })
                .sort({
                    updatedAt:-1
                })
                .lean();

            res.json({
                success:true,
                signals:
                    signals.map(
                        signalOutput
                    )
            });

        }catch(error){

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// PUBLIC CATEGORY SIGNALS
// ============================================================

app.get(
    "/api/signals/:category",
    async(req,res)=>{

        try{

            const category =
                normalizeCategory(
                    req.params.category
                );


            const signals =
                await Signal.find({
                    category,
                    active:true
                })
                .sort({
                    updatedAt:-1
                })
                .lean();


            res.json({

                success:true,

                category,

                signals:
                    signals.map(
                        signalOutput
                    )
            });

        }catch(error){

            console.error(
                "PUBLIC SIGNAL ERROR:",
                error
            );

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// RECOMMENDATIONS
// ============================================================

app.get(
    "/api/recommendations",
    async(req,res)=>{

        try{

            const signals =
                await Signal.find({
                    active:true
                })
                .sort({
                    updatedAt:-1
                })
                .lean();


            const result = {

                stocks:null,

                crypto:null,

                gold:null,

                commodity:null,

                intraday:null
            };


            for(
                const signal of signals
            ){

                const output =
                    signalOutput(signal);


                if(
                    signal.category ===
                    "stocks" &&
                    !result.stocks
                ){

                    result.stocks =
                        output;
                }


                if(
                    signal.category ===
                    "crypto" &&
                    !result.crypto
                ){

                    result.crypto =
                        output;
                }


                if(
                    signal.category ===
                    "commodity" &&
                    !result.commodity
                ){

                    result.commodity =
                        output;

                    result.gold =
                        output;
                }


                if(
                    signal.category ===
                    "intraday" &&
                    !result.intraday
                ){

                    result.intraday =
                        output;
                }
            }


            res.json({

                success:true,

                recommendations:
                    result,

                stocks:
                    result.stocks,

                crypto:
                    result.crypto,

                gold:
                    result.gold,

                commodity:
                    result.commodity,

                intraday:
                    result.intraday
            });

        }catch(error){

            console.error(
                "RECOMMENDATION ERROR:",
                error
            );

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// UPSTOX HELPER
// ============================================================

async function getUpstoxData(
    instrumentKey
){

    if(!UPSTOX_ACCESS_TOKEN){

        throw new Error(
            "UPSTOX_ACCESS_TOKEN is missing"
        );
    }


    const url =
        "https://api.upstox.com/v2/market-quote/ltp" +
        "?instrument_key=" +
        encodeURIComponent(
            instrumentKey
        );


    const response =
        await fetch(
            url,
            {
                headers:{
                    Accept:
                        "application/json",

                    Authorization:
                        `Bearer ${UPSTOX_ACCESS_TOKEN}`
                }
            }
        );


    const data =
        await response.json();


    if(!response.ok){

        throw new Error(
            data.errors?.[0]?.message ||
            "Upstox API failed"
        );
    }


    return data;
}


// ============================================================
// NIFTY
// ============================================================

app.get(
    "/api/nifty",
    async(req,res)=>{

        try{

            const data =
                await getUpstoxData(
                    "NSE_INDEX|Nifty 50"
                );


            const item =
                data.data?.[
                    "NSE_INDEX:Nifty 50"
                ];


            if(!item)
                throw new Error(
                    "NIFTY data not found"
                );


            res.json({
                success:true,
                name:"NIFTY 50",
                price:
                    Number(
                        item.last_price
                    )
            });

        }catch(error){

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// BANK NIFTY
// ============================================================

app.get(
    "/api/banknifty",
    async(req,res)=>{

        try{

            const data =
                await getUpstoxData(
                    "NSE_INDEX|Nifty Bank"
                );


            const item =
                data.data?.[
                    "NSE_INDEX:Nifty Bank"
                ];


            if(!item)
                throw new Error(
                    "BANK NIFTY data not found"
                );


            res.json({
                success:true,
                name:"BANK NIFTY",
                price:
                    Number(
                        item.last_price
                    )
            });

        }catch(error){

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// NIFTY IT
// ============================================================

app.get(
    "/api/niftyit",
    async(req,res)=>{

        try{

            const data =
                await getUpstoxData(
                    "NSE_INDEX|Nifty IT"
                );


            const item =
                data.data?.[
                    "NSE_INDEX:Nifty IT"
                ];


            if(!item)
                throw new Error(
                    "NIFTY IT data not found"
                );


            res.json({
                success:true,
                name:"NIFTY IT",
                price:
                    Number(
                        item.last_price
                    )
            });

        }catch(error){

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// SENSEX
// ============================================================

app.get(
    "/api/sensex",
    async(req,res)=>{

        try{

            const data =
                await getUpstoxData(
                    "BSE_INDEX|SENSEX"
                );


            const item =
                data.data?.[
                    "BSE_INDEX:SENSEX"
                ];


            if(!item)
                throw new Error(
                    "SENSEX data not found"
                );


            res.json({
                success:true,
                name:"SENSEX",
                price:
                    Number(
                        item.last_price
                    )
            });

        }catch(error){

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// STOCK PRICE
// ============================================================

app.get(
    "/api/stock",
    async(req,res)=>{

        try{

            const symbol =
                String(
                    req.query.symbol || ""
                )
                .toUpperCase()
                .trim();


            const stockKeys = {

                RELIANCE:
                    "NSE_EQ|INE002A01018",

                TCS:
                    "NSE_EQ|INE467B01029",

                ITC:
                    "NSE_EQ|INE154A01025"
            };


            const key =
                stockKeys[symbol];


            if(!key){

                return res.status(404).json({
                    success:false,
                    error:
                        `Stock ${symbol} not configured`
                });
            }


            const data =
                await getUpstoxData(
                    key
                );


            const item =
                Object.values(
                    data.data || {}
                )[0];


            res.json({

                success:true,

                symbol,

                price:
                    Number(
                        item.last_price
                    )
            });

        }catch(error){

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// DELTA TICKER
// ============================================================

async function getDeltaTicker(
    symbol
){

    const response =
        await fetch(
            `${DELTA_API_URL}/v2/tickers/${encodeURIComponent(symbol)}`
        );


    const data =
        await response.json();


    if(
        !response.ok ||
        !data.success
    ){

        throw new Error(
            data.error?.message ||
            data.error ||
            "Delta API failed"
        );
    }


    return data.result;
}


// ============================================================
// CRYPTO PRICE
// ============================================================

app.get(
    "/api/crypto",
    async(req,res)=>{

        try{

            const symbol =
                String(
                    req.query.symbol || ""
                )
                .toUpperCase()
                .trim();


            const symbols = {

                BTC:"BTCUSD",

                ETH:"ETHUSD",

                SOL:"SOLUSD",

                XRP:"XRPUSD"
            };


            const deltaSymbol =
                symbols[symbol];


            if(!deltaSymbol){

                return res.status(404).json({
                    success:false,
                    error:
                        `Crypto ${symbol} not configured`
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


            res.json({

                success:true,

                symbol,

                deltaSymbol,

                price:
                    Number(price)
            });

        }catch(error){

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// UPSTOX CANDLES
// ============================================================

app.get(
    "/api/candles",
    async(req,res)=>{

        try{

            const symbol =
                String(
                    req.query.symbol || ""
                )
                .toUpperCase()
                .trim();


            const timeframe =
                String(
                    req.query.timeframe ||
                    "1m"
                )
                .toLowerCase()
                .trim();


            const keys = {

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


            const key =
                keys[symbol];


            if(!key){

                return res.status(404).json({
                    success:false,
                    error:
                        `${symbol} not configured`
                });
            }


            const map = {

                "1m":["minutes","1"],

                "2m":["minutes","2"],

                "3m":["minutes","3"],

                "5m":["minutes","5"],

                "10m":["minutes","10"],

                "15m":["minutes","15"],

                "30m":["minutes","30"],

                "1h":["hours","1"],

                "2h":["hours","2"],

                "4h":["hours","4"]
            };


            const config =
                map[timeframe];


            if(!config){

                return res.status(400).json({
                    success:false,
                    error:
                        "Invalid timeframe"
                });
            }


            const url =
                "https://api.upstox.com/v3/historical-candle/intraday/" +
                encodeURIComponent(key) +
                "/" +
                config[0] +
                "/" +
                config[1];


            const response =
                await fetch(
                    url,
                    {
                        headers:{
                            Accept:
                                "application/json",

                            Authorization:
                                `Bearer ${UPSTOX_ACCESS_TOKEN}`
                        }
                    }
                );


            const data =
                await response.json();


            if(!response.ok){

                return res.status(
                    response.status
                ).json({

                    success:false,

                    error:
                        data.errors?.[0]?.message ||
                        "Upstox candle API failed"
                });
            }


            const raw =
                data.data?.candles || [];


            const candles =
                raw.map(c => {

                    if(
                        !Array.isArray(c) ||
                        c.length < 5
                    ){
                        return null;
                    }


                    return {

                        time:c[0],

                        open:Number(c[1]),

                        high:Number(c[2]),

                        low:Number(c[3]),

                        close:Number(c[4]),

                        volume:Number(c[5] || 0)
                    };

                })
                .filter(Boolean)
                .reverse();


            res.json({

                success:true,

                symbol,

                timeframe,

                count:
                    candles.length,

                candles
            });

        }catch(error){

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// DELTA CRYPTO CANDLES
// ============================================================

app.get(
    "/api/crypto/candles",
    async(req,res)=>{

        try{

            const symbol =
                String(
                    req.query.symbol ||
                    "BTC"
                )
                .toUpperCase()
                .trim();


            const resolution =
                String(
                    req.query.resolution ||
                    "1m"
                )
                .trim();


            const symbols = {

                BTC:"BTCUSD",

                ETH:"ETHUSD",

                SOL:"SOLUSD",

                XRP:"XRPUSD"
            };


            const deltaSymbol =
                symbols[symbol];


            if(!deltaSymbol){

                return res.status(404).json({
                    success:false,
                    error:
                        "Crypto not configured"
                });
            }


            const secondsMap = {

                "1m":60,

                "3m":180,

                "5m":300,

                "15m":900,

                "30m":1800,

                "1h":3600,

                "2h":7200,

                "4h":14400,

                "6h":21600,

                "1d":86400,

                "1w":604800
            };


            const seconds =
                secondsMap[resolution];


            if(!seconds){

                return res.status(400).json({
                    success:false,
                    error:
                        "Invalid resolution"
                });
            }


            const end =
                Math.floor(
                    Date.now()/1000
                );


            const start =
                end -
                seconds * 200;


            const url =
                `${DELTA_API_URL}/v2/history/candles` +
                `?resolution=${encodeURIComponent(resolution)}` +
                `&symbol=${encodeURIComponent(deltaSymbol)}` +
                `&start=${start}` +
                `&end=${end}`;


            const response =
                await fetch(url);


            const data =
                await response.json();


            if(!response.ok){

                return res.status(
                    response.status
                ).json({

                    success:false,

                    error:
                        data.error?.message ||
                        data.error ||
                        "Delta candle API failed"
                });
            }


            const raw =
                Array.isArray(
                    data.result
                )
                    ? data.result
                    : [];


            const candles =
                raw
                .map(c => {

                    if(
                        !Array.isArray(c) ||
                        c.length < 5
                    ){
                        return null;
                    }


                    return {

                        time:Number(c[0]),

                        open:Number(c[1]),

                        high:Number(c[2]),

                        low:Number(c[3]),

                        close:Number(c[4]),

                        volume:Number(c[5] || 0)
                    };

                })
                .filter(c =>
                    c &&
                    Number.isFinite(c.time) &&
                    Number.isFinite(c.open) &&
                    Number.isFinite(c.high) &&
                    Number.isFinite(c.low) &&
                    Number.isFinite(c.close)
                )
                .sort(
                    (a,b) =>
                        a.time-b.time
                );


            res.json({

                success:true,

                symbol,

                deltaSymbol,

                resolution,

                count:
                    candles.length,

                candles
            });

        }catch(error){

            res.status(500).json({
                success:false,
                error:error.message
            });
        }
    }
);


// ============================================================
// OLD CRYPTO CANDLE COMPATIBILITY ROUTE
// ============================================================

app.get(
    "/api/crypto-candles",
    async(req,res)=>{

        req.url =
            req.url.replace(
                "/api/crypto-candles",
                "/api/crypto/candles"
            );

        return app._router.handle(
            req,
            res,
            () => {}
        );
    }
);


// ============================================================
// HEALTH
// ============================================================

app.get(
    "/api/health",
    (req,res)=>{

        res.json({

            success:true,

            server:"running",

            mongodb:
                mongoose.connection.readyState === 1,

            uptime:
                process.uptime()
        });
    }
);


// ============================================================
// ROOT
// ============================================================

app.get(
    "/",
    (req,res)=>{

        res.json({

            success:true,

            message:
                "StockPulse API Server is running",

            mongodb:
                mongoose.connection.readyState === 1,

            endpoints:[

                "/api/nifty",

                "/api/banknifty",

                "/api/niftyit",

                "/api/sensex",

                "/api/stock?symbol=TCS",

                "/api/crypto?symbol=BTC",

                "/api/signals",

                "/api/signals/commodity",

                "/api/signals/gold",

                "/api/recommendations",

                "/api/health"
            ]
        });
    }
);


// ============================================================
// 404
// ============================================================

app.use(
    (req,res)=>{

        res.status(404).json({

            success:false,

            error:
                "API route not found",

            path:req.originalUrl
        });
    }
);


// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
    (error,req,res,next)=>{

        console.error(
            "SERVER ERROR:",
            error
        );

        res.status(500).json({

            success:false,

            error:
                error.message ||
                "Internal server error"
        });
    }
);


// ============================================================
// MONGODB CONNECT + START
// ============================================================

async function startServer(){

    if(!MONGODB_URI){

        console.error(
            "❌ MONGODB_URI / MONGO_URI missing"
        );

        process.exit(1);
    }


    try{

        console.log(
            "MongoDB: CONNECTING..."
        );


        await mongoose.connect(
            MONGODB_URI,
            {
                serverSelectionTimeoutMS:
                    10000
            }
        );


        console.log(
            "MongoDB CONNECTED SUCCESSFULLY ✅"
        );


        // ----------------------------------------------------
        // CLEAN OLD GOLD DUPLICATES
        // ----------------------------------------------------

        const goldSignals =
            await Signal.find({
                $or:[
                    {
                        category:"gold"
                    },
                    {
                        category:"commodity",
                        symbol:{
                            $in:[
                                "GOLD",
                                "GOLD G",
                                "GOLD/G",
                                "GOLDG"
                            ]
                        }
                    }
                ]
            })
            .sort({
                updatedAt:-1
            });


        if(goldSignals.length > 0){

            const keep =
                goldSignals[0];


            await Signal.updateOne(
                {
                    _id:
                        keep._id
                },
                {
                    $set:{
                        category:
                            "commodity",

                        symbol:
                            "GOLDG"
                    }
                }
            );


            if(
                goldSignals.length > 1
            ){

                await Signal.deleteMany({
                    _id:{
                        $in:
                            goldSignals
                            .slice(1)
                            .map(
                                x => x._id
                            )
                    }
                });

                console.log(
                    "Old GOLD duplicates cleaned ✅"
                );
            }
        }


        app.listen(
            PORT,
            ()=>{
                console.log("");
                console.log(
                    "======================================"
                );
                console.log(
                    "🚀 STOCKPULSE SERVER STARTED"
                );
                console.log(
                    "======================================"
                );
                console.log(
                    `🌐 Port: ${PORT}`
                );
                console.log(
                    "📊 MongoDB: CONNECTED"
                );
                console.log(
                    "🪙 Commodity: GOLDG"
                );
                console.log(
                    "🎯 Targets: T1 / T2 / T3"
                );
                console.log(
                    "🗑️ Delete API: READY"
                );
                console.log(
                    "======================================"
                );
                console.log("");
            }
        );


    }catch(error){

        console.error("");
        console.error(
            "❌ MONGODB CONNECTION FAILED"
        );
        console.error(
            error.message
        );
        console.error("");

        process.exit(1);
    }
}


startServer();