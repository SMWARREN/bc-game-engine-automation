const { apiRequest } = require('./client');
const { log } = require('../utils/logger');

let currentPrices = {
  BC: 0,
  lastUpdated: null,
};

async function updatePrices() {
  try {
    const response = await apiRequest('https://bc.game/api/game/support/system/conf/usdPrice', 'GET');
    if (response.code === 0 && response.data) {
      currentPrices.BC = parseFloat(response.data.BC) || 0;
      currentPrices.lastUpdated = new Date().toISOString();
      log(`Updated BC price: $${currentPrices.BC}`);
    }
  } catch (error) {
    log(`Failed to fetch prices: ${error.message}`, 'WARN');
  }
}

function getPrices() {
  return currentPrices;
}

module.exports = { updatePrices, getPrices };
