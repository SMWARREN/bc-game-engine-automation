#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { log, setLogFile } = require('./utils/logger');
const { dataPath } = require('./utils/paths');
const { formatNumber, formatUSD } = require('./utils/format');
const { updatePrices, getPrices } = require('./api/prices');
const { runAutomation } = require('./automation');
const { loadStats } = require('./stats/tracker');

// Setup logging
const LOG_FILE = dataPath('bc-game.log');
setLogFile(LOG_FILE);

// Validate environment
const COOKIES = process.env.BC_GAME_COOKIES;
if (!COOKIES) {
  console.error('Error: BC_GAME_COOKIES env var required');
  console.error('Get it from: DevTools → Network → Any request → Headers → Copy "Cookie" header');
  console.error('Add to .env: BC_GAME_COOKIES="your_full_cookie_string"');
  process.exit(1);
}

// Show startup message
async function showStartupMessage() {
  console.clear();
  const stats = loadStats();

  // Fetch user info and prices from API
  let userInfo = null;
  try {
    await updatePrices();
    const { apiRequest } = require('./api/client');
    const response = await apiRequest('https://bc.game/api/vault/bc-engine/user/info/', 'POST');
    userInfo = response.data;
  } catch (error) {
    log(`User info failed: ${error.message}`, 'ERROR');
    console.error('Cannot start automation without account status.');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎮 BC.Game Auto-Stake Automation');
  console.log('='.repeat(60));

  if (userInfo) {
    const prices = getPrices();
    const stakeUsdValue = (parseFloat(userInfo.stakeAmount) * parseFloat(prices.BC)).toFixed(2);

    console.log(`\n👤 Account Status:`);
    console.log(`   Current stake: ${formatNumber(userInfo.stakeAmount)} BC`);
    console.log(`   Stake value: ${formatUSD(stakeUsdValue)}`);
    console.log(`   Pending balance: ${formatUSD(userInfo.pendingBalance)}`);
    console.log(`   Earned total: ${formatUSD(userInfo.earnedTotal)}`);
  }

  console.log(`\n📊 Lifetime Stats:`);
  console.log(`   Cycles: ${stats.cycleCount}`);
  console.log(`   Claimed: ${formatUSD(stats.totalUsdClaimed)}`);
  console.log(`   BC Received: ${formatNumber(stats.totalBcReceived)}`);
  console.log(`   BC Staked: ${formatNumber(stats.totalBcStaked)} (${formatUSD(stats.totalBcUsdValue)})`);
  console.log(`   Avg Price: ${formatUSD(stats.avgBcPrice)}/BC`);
  console.log(`   Last run: ${stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never'}`);
  console.log(`\n⏱️  Running every 5 minutes...`);
  console.log('='.repeat(60) + '\n');
}

// Main
const INTERVAL_MS = 5 * 60 * 1000;

(async () => {
  await showStartupMessage();
  runAutomation();
})();

// Then schedule for every 5 minutes
setInterval(runAutomation, INTERVAL_MS);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nScheduler stopped by user');
  process.exit(0);
});
