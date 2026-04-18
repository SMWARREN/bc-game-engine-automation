const { updatePrices, getPrices } = require('../api/prices');
const { getPendingBalance, claimEarnings } = require('./claim');
const { swapToBCD } = require('./swap');
const { previewStake, executStake } = require('./stake');
const { saveState, loadState, clearState } = require('../state/manager');
const { updateStats } = require('../stats/tracker');
const { log, logFile } = require('../utils/logger');
const { formatNumber, formatUSD } = require('../utils/format');

async function runAutomation() {
  logFile('=== Starting BC.Game Auto-Stake ===');

  try {
    // Update prices at start of each cycle
    await updatePrices();

    let state = loadState();
    let claimedBalance, bcdAmount, preview;

    // Resume from saved state if it exists
    if (state) {
      logFile(`Resuming from saved state: step=${state.step}`);
    }

    // Step 1: Get pending balance & claim
    if (!state || state.step < 1) {
      const pendingBalance = await getPendingBalance();
      if (pendingBalance <= 0) {
        logFile('No pending balance to claim');
        return;
      }

      logFile(`Found pending balance: ${pendingBalance}`);

      claimedBalance = await claimEarnings();
      if (claimedBalance <= 0) {
        log('Claim failed or no amount, skipping swap/stake', 'WARN');
        return;
      }

      logFile(`Claimed amount: ${claimedBalance}`);
      saveState({ step: 1, claimedBalance, timestamp: Date.now() });
    } else {
      claimedBalance = state.claimedBalance;
      logFile(`Resuming with claimed amount: ${claimedBalance}`);
    }

    // Step 2: Swap to BC
    let bcPrice = 0;
    if (!state || state.step < 2) {
      const swapResult = await swapToBCD(claimedBalance);
      bcdAmount = swapResult.bcAmount;
      bcPrice = swapResult.bcPrice;

      if (bcdAmount <= 0) {
        log('Swap resulted in 0 BC, skipping stake', 'WARN');
        return;
      }

      logFile(`Swapped to ${bcdAmount} BC @ $${bcPrice}`);
      saveState({ step: 2, claimedBalance, bcdAmount, bcPrice, timestamp: Date.now() });
    } else {
      bcdAmount = state.bcdAmount;
      bcPrice = state.bcPrice || 0;
      logFile(`Resuming with BC amount: ${bcdAmount}`);
    }

    // Step 3: Preview stake
    if (!state || state.step < 3) {
      preview = await previewStake(bcdAmount);

      if (!preview) {
        logFile('Stake preview failed, saving state to retry');
        saveState({ step: 2, claimedBalance, bcdAmount, bcPrice, timestamp: Date.now() });
        return;
      }

      logFile(`Preview successful: will stake ${preview.actualStakeAmount} BC`);
      saveState({ step: 3, claimedBalance, bcdAmount, bcPrice, preview, timestamp: Date.now() });
    } else {
      preview = state.preview;
      logFile(`Resuming with preview data`);
    }

    // Step 4: Execute stake
    const stakeSuccess = await executStake(bcdAmount);

    if (stakeSuccess) {
      // Use current market price if available, fallback to swap price
      const prices = getPrices();
      const finalPrice = prices.BC || bcPrice;
      const stats = updateStats(claimedBalance, bcdAmount, preview.actualStakeAmount, finalPrice);
      const bcUsdValue = (parseFloat(preview.actualStakeAmount) * parseFloat(finalPrice)).toFixed(4);

      console.log('\n' + '='.repeat(60));
      console.log(`✅ CYCLE #${stats.cycleCount} COMPLETE`);
      console.log('='.repeat(60));
      console.log(`\n💰 This Cycle:`);
      console.log(`   Claimed:    ${formatUSD(claimedBalance)}`);
      console.log(`   Swapped to: ${formatNumber(bcdAmount)} BC @ ${formatUSD(finalPrice)}`);
      console.log(`   Staked:     ${formatUSD(bcUsdValue)} worth`);
      console.log(`\n📊 Lifetime Totals:`);
      console.log(`   USD Claimed:    ${formatUSD(stats.totalUsdClaimed)}`);
      console.log(`   BC Received:    ${formatNumber(stats.totalBcReceived)}`);
      console.log(`   BC Staked:      ${formatNumber(stats.totalBcStaked)}`);
      console.log(`   Staked Value:   ${formatUSD(stats.totalBcUsdValue)}`);
      console.log(`   Avg Price:      ${formatUSD(stats.avgBcPrice)}/BC`);
      console.log('='.repeat(60) + '\n');
      logFile(`✓ Complete cycle: ${claimedBalance} USD → ${bcdAmount} BCD → Staked $${bcUsdValue} worth of BC @ $${finalPrice}`);
      clearState();
    } else {
      logFile(`✗ Stake failed, saving state to retry`);
      saveState({ step: 3, claimedBalance, bcdAmount, bcPrice, preview, timestamp: Date.now() });
    }
  } catch (error) {
    log(`Automation error: ${error.message}`, 'ERROR');
  }
}

module.exports = { runAutomation };
