const { apiRequest } = require('../api/client');
const { getPrices } = require('../api/prices');
const { log, logFile } = require('../utils/logger');

async function swapToBCD(amountUsd) {
  try {
    if (amountUsd < 0.1) {
      log(`Pending balance too small to swap: ${amountUsd} USD`, 'WARN');
      return { bcAmount: 0, bcPrice: 0 };
    }

    // Get current BC price
    const prices = getPrices();
    const currentPrice = prices.BC || 0.00788; // Fallback to default if not available
    const tokenNumber = Math.floor(parseFloat(amountUsd) / currentPrice);

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
      throw new Error(swapResponse.msg || 'Swap failed');
    }

    // Extract BC amount and price from response
    const bcAmount = swapResponse.data?.dealInTokenNumber || 0;
    const bcPrice = swapResponse.data?.dealInPrice || 0;
    log(`Successfully swapped ${amountUsd} USD to ${bcAmount} BC @ $${bcPrice}/BC`, 'SUCCESS');
    return { bcAmount, bcPrice };
  } catch (error) {
    log(`Failed to swap to BCD: ${error.message}`, 'ERROR');
    return { bcAmount: 0, bcPrice: 0 };
  }
}

module.exports = { swapToBCD };
