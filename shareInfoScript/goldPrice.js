function getGoldRates() {
  try {
    var url = 'https://gahanaonline.com/gold-rate-history/';
    var options = {
      'headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var content = response.getContentText();
    
    var pattern = /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi;
    
    var match;
    var firstNumber = null;
    
    while ((match = pattern.exec(content)) !== null) {
      var price = match[1].replace(/<[^>]*>/g, '').trim();
      console.log(price); // e.g., "2,37,200/-"
      
      // Extract digits only
      var numeric = price.replace(/[^\d]/g, '');
      
      if (numeric) {
        firstNumber = Number(numeric);
        break; // ✅ stop after first valid number
      }
    }
    
    console.log(firstNumber);
    return firstNumber; // ✅ return single number, not array
    
  } catch (error) {
    console.error(error);
    return "Error: " + error.toString();
  }
}

function getSilverRate() {
  const url = "https://www.sharesansar.com/bullion";
  const html = UrlFetchApp.fetch(url).getContentText();

  // Match silver price — (e.g., Rs. 3,010/-)
   const match = html.match(/Silver[\s\S]*?Rs\.?\s*([\d,]+)/i);
  console.log(match)
  if (match && match[1]) {
    return Number(match[1].replace(/,/g, ""));
  }
  return "Silver rate not found";
}
