const { apiRequest } = require('./client');
const { log, logFile } = require('../utils/logger');

let currentPrices = {
  BC: 0,
  lastUpdated: null,
  lastUpdatedMs: 0,
};

const DEFAULT_PRICE_MAX_AGE_MS = 5 * 60 * 1000;

async function updatePrices(options = {}) {
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_PRICE_MAX_AGE_MS;
  const force = options.force || currentPrices.BC <= 0 || !currentPrices.lastUpdatedMs;
  const ageMs = Date.now() - currentPrices.lastUpdatedMs;

  if (!force && ageMs < maxAgeMs) {
    logFile(`Using cached BC price: $${currentPrices.BC} (${Math.round(ageMs / 1000)}s old)`);
    return { ...currentPrices, updated: false };
  }

  let updated = false;

  try {
    const response = await apiRequest('https://bc.game/api/game/support/system/conf/usdPrice', 'GET');
    if (response.code === 0 && response.data) {
      currentPrices.BC = parseFloat(response.data.BC) || 0;
      currentPrices.lastUpdated = new Date().toISOString();
      currentPrices.lastUpdatedMs = Date.now();
      updated = true;
      logFile(`Updated BC price: $${currentPrices.BC}`);
    } else {
      logFile(`Failed to fetch prices: invalid response from price API`, 'WARN');
    }
  } catch (error) {
    logFile(`Failed to fetch prices: ${error.message}`, 'WARN');
  }

  return { ...currentPrices, updated };
}

function getPrices() {
  return currentPrices;
}

module.exports = { updatePrices, getPrices };
