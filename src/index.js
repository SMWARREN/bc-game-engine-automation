#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs = require('fs');
const { setLogFile } = require('./utils/logger');
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

  // Fetch user info from API
  let userInfo = null;
  try {
    const { apiRequest } = require('./api/client');
    const response = await apiRequest('https://bc.game/api/vault/bc-engine/user/info/', 'POST');
    userInfo = response.data;
  } catch (error) {
    // Continue even if API fails
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎮 BC.Game Auto-Stake Automation');
  console.log('='.repeat(60));

  if (userInfo) {
    console.log(`👤 Account Status:`);
    console.log(`   Current stake: ${userInfo.stakeAmount} BC`);
    console.log(`   Pending balance: ${userInfo.pendingBalance} USD`);
    console.log(`   Earned total: ${userInfo.earnedTotal} USD`);
  }

  console.log(`\n📊 Lifetime Stats:`);
  console.log(`   Cycles completed: ${stats.cycleCount}`);
  console.log(`   USD claimed: $${stats.totalUsdClaimed}`);
  console.log(`   BC received: ${stats.totalBcReceived}`);
  console.log(`   BC staked: ${stats.totalBcStaked}`);
  console.log(`   Last run: ${stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never'}`);
  console.log('='.repeat(60));
  console.log('⏱️  Running every 5 minutes...\n');
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
