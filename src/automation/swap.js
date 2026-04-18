const { apiRequest } = require('../api/client');
const { log } = require('../utils/logger');

async function swapToBCD(amountUsd) {
  try {
    if (amountUsd < 0.1) {
      log(`Pending balance too small to swap: ${amountUsd} USD`, 'WARN');
      return { bcAmount: 0, bcPrice: 0 };
    }

    const swapResponse = await apiRequest(
      'https://bc.game/api/bctrade/forward/api/coin/trade/buyByAmount',
      'POST',
      {
        price: 0.00788,
        slippage: 5,
        currency: 'BCD',
        amountUsd: parseFloat(amountUsd),
        tokenNumber: Math.floor(parseFloat(amountUsd) / 0.00788),
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
