const API_KEY = "X-API-Key: YOUR_KEY";

const url = "https://api.dalalai.com/v1/predictions?format=json";

fetch(url, {
  headers: {
    "X-API-Key": API_KEY
  }
})
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(error => {
    console.error("API Error:", error.message);
  });