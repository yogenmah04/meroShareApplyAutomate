/**
 * Internal helper for total cost calculation.
 */
function _calculateTotalCost(price, qty, rate) {
  const amount = price * qty;
  const fees = _calculateNepseFees(amount, rate);
  return amount + fees.broker + fees.sebon + fees.dp;
}

/**
 * Internal helper to calculate NEPSE fees.
 */
function _calculateNepseFees(amount, brokerRate) {
  return {
    broker: amount * (brokerRate / 100),
    sebon: amount * 0.00015,
    dp: 25
  };
}

/**
 * Calculates total cost to BUY on NEPSE.
 * @customfunction
 */
function NEPSE_BUY_TOTAL(buyPrice, quantity, brokerRate = 0.3) {
  if (!buyPrice || !quantity) return 0;
  return _calculateTotalCost(buyPrice, quantity, brokerRate);
}

/**
 * Calculates NET PROCEEDS from SELLING on NEPSE.
 * @customfunction
 */
function NEPSE_SELL_NET(sellPrice, quantity, brokerRate = 0.3, buyPrice = 0) {
  if (!sellPrice || !quantity) return 0;

  const totalSellAmount = sellPrice * quantity;
  const fees = _calculateNepseFees(totalSellAmount, brokerRate);
  
  let cgt = 0;
  if (buyPrice > 0) {
    const totalCost = _calculateTotalCost(buyPrice, quantity, brokerRate);
    const netBeforeTax = totalSellAmount - (fees.broker + fees.sebon + fees.dp);
    const gain = netBeforeTax - totalCost;
    if (gain > 0) cgt = gain * 0.075; // 7.5% for individuals
  }

  return totalSellAmount - (fees.broker + fees.sebon + fees.dp + cgt);
}

/**
 * Calculates NET PROFIT or LOSS.
 * @customfunction
 */
function NEPSE_NET_PROFIT(buyPrice, sellPrice, quantity, brokerRate = 0.3) {
  if (!buyPrice || !sellPrice || !quantity) return 0;
  const cost = _calculateTotalCost(buyPrice, quantity, brokerRate);
  const proceeds = NEPSE_SELL_NET(sellPrice, quantity, brokerRate, buyPrice);
  return proceeds - cost;
}






// /**
//  * Internal helper to calculate NEPSE fees (Broker, SEBON, DP).
//  * Not exported as a @customfunction.
//  */
// function _calculateNepseFees(amount, brokerRate) {
//   return {
//     broker: amount * (brokerRate / 100),
//     sebon: amount * 0.00015,
//     dp: 25
//   };
// }

// /**
//  * Calculates total cost to BUY on NEPSE.
//  * @customfunction
//  */
// function NEPSE_BUY_TOTAL(buyPrice, quantity, brokerRate = 0.3) {
//   if (!buyPrice || !quantity) return 0;
  
//   const totalBuyAmount = buyPrice * quantity;
//   const fees = _calculateNepseFees(totalBuyAmount, brokerRate);
  
//   return totalBuyAmount + fees.broker + fees.sebon + fees.dp;
// }

// /**
//  * Calculates NET PROCEEDS from SELLING on NEPSE.
//  * @customfunction
//  */
// function NEPSE_SELL_NET(sellPrice, quantity, brokerRate = 0.3, buyPrice = 0) {
//   if (!sellPrice || !quantity) return 0;

//   const totalSellAmount = sellPrice * quantity;
//   const fees = _calculateNepseFees(totalSellAmount, brokerRate);
  
//   let cgt = 0;
//   if (buyPrice > 0) {
//     const totalCost = NEPSE_BUY_TOTAL(buyPrice, quantity, brokerRate);
//     const netBeforeTax = totalSellAmount - (fees.broker + fees.sebon + fees.dp);
//     const gain = netBeforeTax - totalCost;
//     if (gain > 0) cgt = gain * 0.075; // 7.5% for individuals
//   }

//   return totalSellAmount - (fees.broker + fees.sebon + fees.dp + cgt);
// }

// /**
//  * Calculates NET PROFIT or LOSS.
//  * @customfunction
//  */
// function NEPSE_NET_PROFIT(buyPrice, sellPrice, quantity, brokerRate = 0.3) {
//   const cost = NEPSE_BUY_TOTAL(buyPrice, quantity, brokerRate);
//   const proceeds = NEPSE_SELL_NET(sellPrice, quantity, brokerRate, buyPrice);
//   return proceeds - cost;
// }