#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Configuration
const COOKIES = process.env.BC_GAME_COOKIES;
const LOG_FILE = path.join(__dirname, 'bc-game.log');
const STATE_FILE = path.join(__dirname, '.bc-game-state.json');
const STATS_FILE = path.join(__dirname, '.bc-game-stats.json');
const MIN_STAKE_AMOUNT = 0.1; // Minimum amount to stake

// State management
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (error) {
    log(`Failed to load state: ${error.message}`, 'WARN');
  }
  return null;
}

function clearState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  } catch (error) {
    log(`Failed to clear state: ${error.message}`, 'WARN');
  }
}

// Stats management
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
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  return stats;
}

if (!COOKIES) {
  console.error('Error: BC_GAME_COOKIES env var required');
  console.error('Get it from: DevTools → Network → Any request → Headers → Copy "Cookie" header');
  console.error('Add to .env: BC_GAME_COOKIES="your_full_cookie_string"');
  process.exit(1);
}

// Logging utility
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// API request wrapper
async function apiRequest(url, method = 'POST', body = {}) {
  try {
    const reqLog = `[${new Date().toISOString()}] ${method} ${url}`;
    if (body && Object.keys(body).length > 0) {
      fs.appendFileSync(LOG_FILE, `${reqLog}\n  Body: ${JSON.stringify(body)}\n`);
    } else {
      fs.appendFileSync(LOG_FILE, `${reqLog}\n`);
    }

    const response = await fetch(url, {
      method,
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en',
        'content-type': 'application/json',
        'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        'origin': 'https://bc.game',
        'referer': 'https://bc.game/bc',
        'Cookie': COOKIES,
      },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    const resLog = `  Response: ${JSON.stringify(data).substring(0, 200)}...`;
    fs.appendFileSync(LOG_FILE, `${resLog}\n`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    const errLog = `  Error: ${error.message}`;
    fs.appendFileSync(LOG_FILE, `${errLog}\n`);
    log(`API request failed to ${url}: ${error.message}`, 'ERROR');
    throw error;
  }
}

// Step 0: Claim pending earnings
async function claimEarnings() {
  try {
    const claimResponse = await apiRequest('https://bc.game/api/vault/bc-engine/dist/claim/', 'POST', {});

    log(`Claim response: ${JSON.stringify(claimResponse)}`);

    if (claimResponse.code === 0) {
      const claimedAmount = claimResponse.data?.claimedAmount || 0;
      log(`Successfully claimed earnings: ${claimedAmount}`, 'SUCCESS');
      return claimedAmount;
    } else {
      log(`Claim failed: ${claimResponse.msg}`, 'WARN');
      return 0;
    }
  } catch (error) {
    log(`Failed to claim earnings: ${error.message}`, 'ERROR');
    return 0;
  }
}

// Step 1: Get user info and pending balance
async function getPendingBalance() {
  try {
    const userInfo = await apiRequest('https://bc.game/api/vault/bc-engine/user/info/', 'POST');

    const pendingBalance = userInfo.data?.pendingBalance || 0;

    log(`Fetched user info. Pending balance: ${pendingBalance}`);
    return pendingBalance;
  } catch (error) {
    log(`Failed to get pending balance`, 'ERROR');
    return 0;
  }
}

// Step 2: Swap pending balance to BCD
async function swapToBCD(amountUsd) {
  try {
    if (amountUsd < 0.1) {
      log(`Pending balance too small to swap: ${amountUsd} USD`, 'WARN');
      return 0;
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

    log(`Swap response: ${JSON.stringify(swapResponse)}`);

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

// Step 3: Preview stake
async function previewStake(stakeAmount) {
  try {
    if (stakeAmount < MIN_STAKE_AMOUNT) {
      log(`Stake amount too small: ${stakeAmount}`, 'WARN');
      return null;
    }

    const previewResponse = await apiRequest(
      'https://bc.game/api/vault/bc-engine/stake/preview/',
      'POST',
      {
        stakeAmount: parseFloat(stakeAmount),
      }
    );

    log(`Stake preview response: ${JSON.stringify(previewResponse)}`);

    if (previewResponse.code === 0) {
      const preview = previewResponse.data;
      log(`Preview: Staking ${preview.actualStakeAmount} BCD → Total after: ${preview.totalStakeAfter}`, 'SUCCESS');
      return preview;
    } else {
      throw new Error(previewResponse.msg || 'Preview failed');
    }
  } catch (error) {
    log(`Failed to preview stake: ${error.message}`, 'ERROR');
    return null;
  }
}

// Step 4: Execute stake
async function stakeBCD(stakeAmount) {
  try {
    if (stakeAmount < MIN_STAKE_AMOUNT) {
      log(`Stake amount too small: ${stakeAmount}`, 'WARN');
      return false;
    }

    const stakeResponse = await apiRequest(
      'https://bc.game/api/vault/bc-engine/stake/',
      'POST',
      {
        stakeAmount: stakeAmount.toString(),
        sourceType: 'BALANCE',
      }
    );

    log(`Stake response: ${JSON.stringify(stakeResponse)}`);

    if (stakeResponse.code === 0) {
      const stake = stakeResponse.data;
      log(`Successfully staked ${stake.actualStakeAmount} BCD → Total: ${stake.totalStakeAfter}`, 'SUCCESS');
      return true;
    } else {
      throw new Error(stakeResponse.msg || 'Stake failed');
    }
  } catch (error) {
    log(`Failed to stake: ${error.message}`, 'ERROR');
    return false;
  }
}

// Main automation loop
async function runAutomation() {
  log('=== Starting BC.Game Auto-Stake ===');

  try {
    let state = loadState();
    let claimedBalance, bcdAmount, preview;

    // Resume from saved state if it exists
    if (state) {
      log(`Resuming from saved state: step=${state.step}`);
    }

    // Step 1: Get pending balance & claim
    if (!state || state.step < 1) {
      const pendingBalance = await getPendingBalance();
      if (pendingBalance <= 0) {
        log('No pending balance to claim');
        return;
      }

      log(`Found pending balance: ${pendingBalance}`);

      claimedBalance = await claimEarnings();
      if (claimedBalance <= 0) {
        log('Claim failed or no amount, skipping swap/stake');
        return;
      }

      log(`Claimed amount: ${claimedBalance}`);
      saveState({ step: 1, claimedBalance, timestamp: Date.now() });
    } else {
      claimedBalance = state.claimedBalance;
      log(`Resuming with claimed amount: ${claimedBalance}`);
    }

    // Step 2: Swap to BCD
    let bcPrice = 0;
    if (!state || state.step < 2) {
      const swapResult = await swapToBCD(claimedBalance);
      bcdAmount = swapResult.bcAmount;
      bcPrice = swapResult.bcPrice;

      if (bcdAmount <= 0) {
        log('Swap resulted in 0 BCD, skipping stake');
        return;
      }

      log(`Swapped to ${bcdAmount} BCD @ $${bcPrice}/BC`);
      saveState({ step: 2, claimedBalance, bcdAmount, bcPrice, timestamp: Date.now() });
    } else {
      bcdAmount = state.bcdAmount;
      bcPrice = state.bcPrice || 0;
      log(`Resuming with BCD amount: ${bcdAmount}`);
    }

    // Step 3: Preview stake
    if (!state || state.step < 3) {
      preview = await previewStake(bcdAmount);

      if (!preview) {
        log('Stake preview failed, saving state to retry');
        saveState({ step: 2, claimedBalance, bcdAmount, timestamp: Date.now() });
        return;
      }

      log(`Preview successful: will stake ${preview.actualStakeAmount} BCD`);
      saveState({ step: 3, claimedBalance, bcdAmount, preview, timestamp: Date.now() });
    } else {
      preview = state.preview;
      log(`Resuming with preview data`);
    }

    // Step 4: Execute stake
    const stakeSuccess = await stakeBCD(bcdAmount);

    if (stakeSuccess) {
      const stats = updateStats(claimedBalance, bcdAmount, preview.actualStakeAmount, bcPrice);
      const bcUsdValue = (parseFloat(preview.actualStakeAmount) * parseFloat(bcPrice)).toFixed(4);
      console.log(`\n✅ CYCLE #${stats.cycleCount} COMPLETE`);
      console.log(`   ${claimedBalance} USD → ${bcdAmount} BC @ $${bcPrice} → Staked`);
      console.log(`   Staked value: $${bcUsdValue}`);
      console.log(`   Totals: $${stats.totalUsdClaimed} claimed | $${stats.totalBcUsdValue} staked value | Avg price: $${stats.avgBcPrice}\n`);
      log(`✓ Complete cycle: ${claimedBalance} USD → ${bcdAmount} BCD @ $${bcPrice} → Staked ${preview.actualStakeAmount} BCD ($${bcUsdValue})`);
      clearState();
    } else {
      log(`✗ Stake failed, saving state to retry`);
      saveState({ step: 3, claimedBalance, bcdAmount, bcPrice, preview, timestamp: Date.now() });
    }
  } catch (error) {
    log(`Automation error: ${error.message}`, 'ERROR');
  }
}

// Show stats on startup
async function showStartupMessage() {
  console.clear();
  const stats = loadStats();

  // Fetch user info from API
  let userInfo = null;
  try {
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

// Run every 5 minutes
const INTERVAL_MS = 5 * 60 * 1000;

(async () => {
  await showStartupMessage();
  runAutomation();
})();

// Then schedule for every 5 minutes
setInterval(runAutomation, INTERVAL_MS);

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Scheduler stopped by user');
  process.exit(0);
});
