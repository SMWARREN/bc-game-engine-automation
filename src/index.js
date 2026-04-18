#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs = require('fs');
const { setLogFile, setQuietMode } = require('./utils/logger');
const { runAutomation } = require('./automation');
const { loadStats } = require('./stats/tracker');

// Setup logging
const LOG_FILE = path.join(__dirname, '../bc-game.log');
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

  // Fetch user info from API (suppress logs during startup)
  let userInfo = null;
  try {
    setQuietMode(true);
    const { apiRequest } = require('./api/client');
    const response = await apiRequest('https://bc.game/api/vault/bc-engine/user/info/', 'POST');
    userInfo = response.data;
    setQuietMode(false);
  } catch (error) {
    // Continue even if API fails
    setQuietMode(false);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎮 BC.Game Auto-Stake Automation');
  console.log('='.repeat(60));

  if (userInfo) {
    console.log(`\n👤 Account Status:`);
    console.log(`   Current stake: ${userInfo.stakeAmount} BC`);
    console.log(`   Pending balance: ${userInfo.pendingBalance} USD`);
    console.log(`   Earned total: ${userInfo.earnedTotal} USD`);
  }

  console.log(`\n📊 Lifetime Stats:`);
  console.log(`   Cycles: ${stats.cycleCount}`);
  console.log(`   Claimed: $${stats.totalUsdClaimed}`);
  console.log(`   BC Received: ${stats.totalBcReceived}`);
  console.log(`   BC Staked: ${stats.totalBcStaked} ($${stats.totalBcUsdValue})`);
  console.log(`   Avg Price: $${stats.avgBcPrice}/BC`);
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
