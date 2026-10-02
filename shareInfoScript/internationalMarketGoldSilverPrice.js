/**
 * Fetches the live Gold price (XAU) in USD per Ounce.
 * @customfunction
 */
function GET_GOLD_PRICE() {
  try {
    const url = "https://api.gold-api.com/price/XAU"; // A developer-friendly endpoint
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    return data.price;
  } catch (e) {
    return "Error: " + e.message;
  }
}