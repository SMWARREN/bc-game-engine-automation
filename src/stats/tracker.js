const fs = require('fs');
const { DATA_DIR, dataPath } = require('../utils/paths');

const STATS_FILE = dataPath('.bc-game-stats.json');

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }
  } catch (error) {
    console.error(`Failed to load stats: ${error.message}`);
  }
  return { totalUsdClaimed: 0, totalBcReceived: 0, totalBcStaked: 0, totalBcUsdValue: 0, cycleCount: 0, avgBcPrice: 0 };
}

function updateStats(usdClaimed, bcReceived, bcStaked, bcPrice) {
  const stats = loadStats();
  stats.totalUsdClaimed = (parseFloat(stats.totalUsdClaimed) + parseFloat(usdClaimed)).toFixed(4);
  stats.totalBcReceived = (parseFloat(stats.totalBcReceived) + parseFloat(bcReceived)).toFixed(4);
  stats.totalBcStaked = (parseFloat(stats.totalBcStaked) + parseFloat(bcStaked)).toFixed(4);

  // Calculate USD value of BC staked
  const bcUsdValue = (parseFloat(bcStaked) * parseFloat(bcPrice)).toFixed(4);
  stats.totalBcUsdValue = (parseFloat(stats.totalBcUsdValue) + parseFloat(bcUsdValue)).toFixed(4);

  // Track average BC price
  stats.avgBcPrice = bcPrice;

  stats.cycleCount = (stats.cycleCount || 0) + 1;
  stats.lastUpdated = new Date().toISOString();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  return stats;
}

module.exports = { loadStats, updateStats };
