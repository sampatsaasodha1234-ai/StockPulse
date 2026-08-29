const https = require("https");

// Yahan apna Upstox Analytics Access Token paste karo
const ACCESS_TOKEN = "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiI3QUJQNlQiLCJqdGkiOiI2YTg5MWZmNjg2YjRlNTc1YWY2MzY5OTciLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6dHJ1ZSwiaXNFeHRlbmRlZCI6dHJ1ZSwiaWF0IjoxNzg3MzcxNTEwLCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE4MTg5NzIwMDB9.M4BEZAY396h1SZiyjLryifnoYGLXoePVgsB6N17B8Tk";

// NIFTY 50 ka instrument key
const instrumentKey = "NSE_INDEX|Nifty 50";

const url =
  `https://api.upstox.com/v3/market-quote/ltp?instrument_key=${encodeURIComponent(instrumentKey)}`;

const options = {
  headers: {
    "Accept": "application/json",
    "Authorization": `Bearer ${ACCESS_TOKEN}`
  }
};

https.get(url, options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("Status:", res.statusCode);
    console.log("Response:");
    console.log(data);
  });

}).on("error", (error) => {
  console.error("Error:", error.message);
});