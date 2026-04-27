#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { log, setLogFile } = require('./utils/logger');
const { dataPath } = require('./utils/paths');
const { formatNumber, formatUSD } = require('./utils/format');
const { getAccountStatus, printAccountStatus } = require('./account/status');
const { runAutomation } = require('./automation');
const { loadStats } = require('./stats/tracker');

// Setup logging
const LOG_FILE = dataPath('bc-game.log');
setLogFile(LOG_FILE);

// Validate environment
const fs = require('fs');
const path = require('path');
const ENV_FILE = path.join(__dirname, '../.env');

const COOKIES = process.env.BC_GAME_COOKIES;
if (!COOKIES || COOKIES.trim() === '') {
  console.error('\n' + '='.repeat(60));
  console.error('❌ ERROR: BC_GAME_COOKIES not found or empty');
  console.error('='.repeat(60));

  if (!fs.existsSync(ENV_FILE)) {
    console.error('\n⚠️  .env file not found at:', ENV_FILE);
    console.error('\nFix: Copy .env.example to .env');
    console.error('  Command: cp .env.example .env\n');
  } else {
    console.error('\n⚠️  .env file exists but BC_GAME_COOKIES is missing or empty');
    console.error('\nFix: Edit .env and add your cookie:\n');
    console.error('  BC_GAME_COOKIES=your_full_cookie_string_here\n');
  }

  console.error('How to get your cookies:');
  console.error('  1. Open https://bc.game in Chrome');
  console.error('  2. Log in to your account');
  console.error('  3. Press F12 → Console tab');
  console.error('  4. Paste and press Enter: copy(document.cookie)');
  console.error('  5. Paste result into .env after BC_GAME_COOKIES=\n');
  console.error('Alternative (Network tab method):');
  console.error('  1. Press F12 → Network tab');
  console.error('  2. Refresh the page');
  console.error('  3. Click any request → Headers');
  console.error('  4. Find "Cookie:" header and copy entire value');
  console.error('  5. Paste into .env\n');
  console.error('='.repeat(60) + '\n');
  process.exit(1);
}

// Show startup message
async function showStartupMessage() {
  console.clear();
  const stats = loadStats();

  let accountStatus = null;
  try {
    accountStatus = await getAccountStatus();
  } catch (error) {
    log(`Startup account check failed: ${error.message}`, 'ERROR');
    console.error('Cannot start automation without account status.');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎮 BC.Game Auto-Stake Automation');
  console.log('='.repeat(60));

  printAccountStatus(accountStatus);

  console.log(`\n📊 Lifetime Stats:`);
  console.log(`   Cycles: ${stats.cycleCount}`);
  console.log(`   Claimed: ${formatUSD(stats.totalUsdClaimed)}`);
  console.log(`   BC Received: ${formatNumber(stats.totalBcReceived)}`);
  console.log(`   BC Staked: ${formatNumber(stats.totalBcStaked)} (${formatUSD(stats.totalBcUsdValue)})`);
  console.log(`   Avg Price: ${formatUSD(stats.avgBcPrice)}/BC`);
  console.log(`   Last run: ${stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never'}`);

  const timezone = process.env.APP_TIMEZONE || 'America/New_York';
  console.log(`\n🕐 Timezone: ${timezone}`);
  console.log(`   (Change in .env → APP_TIMEZONE)`);

  console.log(`\n⏱️  Running first check now, then every 5 minutes...`);
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
