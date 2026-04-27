const { apiRequest } = require('../api/client');
const { getPrices, updatePrices } = require('../api/prices');
const { log, logFile } = require('../utils/logger');

async function swapToBCD(amountUsd) {
  try {
    if (amountUsd < 0.1) {
      log(`Pending balance too small to swap: ${amountUsd} USD`, 'WARN');
      return { bcAmount: 0, bcPrice: 0 };
    }

    // Refresh only when stale; this keeps swap pricing current without hammering the price endpoint.
    const priceCheck = await updatePrices();
    const prices = getPrices();
    const currentPrice = prices.BC || 0.00788; // Fallback to default if not available
    const tokenNumber = Math.floor(parseFloat(amountUsd) / currentPrice);

    log(`Price check: BC is ${currentPrice} (${priceCheck.updated ? 'refreshed' : 'cached'})`, 'INFO');
    logFile(`Swapping with current price: $${currentPrice}/BC (token estimate: ${tokenNumber})`);

    const swapResponse = await apiRequest(
      'https://bc.game/api/bctrade/forward/api/coin/trade/buyByAmount',
      'POST',
      {
        price: currentPrice,
        slippage: 5,
        currency: 'BCD',
        amountUsd: parseFloat(amountUsd),
        tokenNumber: tokenNumber,
      }
    );

    if (swapResponse.code !== 0) {
      const errorMsg = swapResponse.msg || 'Swap API failed';
      logFile(`Swap API returned error code ${swapResponse.code}: ${errorMsg}`, 'ERROR');
      throw new Error(errorMsg);
    }

    // Extract BC amount and price from response
    const bcAmount = swapResponse.data?.dealInTokenNumber || 0;
    const bcPrice = swapResponse.data?.dealInPrice || 0;

    if (!bcAmount || !bcPrice) {
      logFile(`Swap returned incomplete data: amount=${bcAmount}, price=${bcPrice}`, 'WARN');
      throw new Error('Swap response missing amount or price data');
    }

    log(`Successfully swapped ${amountUsd} USD to ${bcAmount} BC @ $${bcPrice}/BC`, 'SUCCESS');
    logFile(`Swap completed: ${amountUsd} USD → ${bcAmount} BC @ $${bcPrice}`, 'SUCCESS');
    return { bcAmount, bcPrice };
  } catch (error) {
    logFile(`Swap attempt failed: ${error.message} (will attempt recovery by checking BC balance)`, 'ERROR');
    log(`Failed to swap to BCD: ${error.message}`, 'ERROR');
    return { bcAmount: 0, bcPrice: 0 };
  }
}

module.exports = { swapToBCD };
