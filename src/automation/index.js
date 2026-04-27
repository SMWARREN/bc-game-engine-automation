const { updatePrices, getPrices } = require('../api/prices');
const { getAccountStatus, printAccountStatus } = require('../account/status');
const { getPendingBalance, claimEarnings } = require('./claim');
const { swapToBCD } = require('./swap');
const { getAvailableBcBalance, previewStake, executStake } = require('./stake');
const { saveState, loadState, clearState } = require('../state/manager');
const { updateStats } = require('../stats/tracker');
const { log, logFile } = require('../utils/logger');
const { formatNumber, formatUSD } = require('../utils/format');

async function runAutomation() {
  logFile('=== Starting BC.Game Auto-Stake ===');
  log('Automation check started. Still running in the background.', 'INFO');

  try {
    // Update prices at start of each cycle
    await updatePrices();

    let state = loadState();
    let claimedBalance, bcdAmount, preview;
    let preSwapBcBalance = null;

    // Resume from saved state if it exists
    if (state) {
      logFile(`Resuming from saved state: step=${state.step}`);
    }

    // Step 1: Get pending balance & claim
    if (!state || state.step < 1) {
      const pendingBalance = await getPendingBalance();
      if (pendingBalance <= 0) {
        log('No pending balance to claim. Still running; next check in 5 minutes.', 'INFO');
        return;
      }

      logFile(`Found pending balance: ${pendingBalance}`);

      claimedBalance = await claimEarnings();
      if (claimedBalance <= 0) {
        log('Claim failed or no amount, skipping swap/stake', 'WARN');
        return;
      }

      logFile(`Claimed amount: ${claimedBalance}`);
      preSwapBcBalance = await getAvailableBcBalance();
      if (preSwapBcBalance !== null) {
        logFile(`BC balance before swap: ${preSwapBcBalance}`);
      }
      saveState({ step: 1, claimedBalance, preSwapBcBalance, timestamp: Date.now() });
    } else {
      claimedBalance = state.claimedBalance;
      preSwapBcBalance = state.preSwapBcBalance ?? null;
      logFile(`Resuming with claimed amount: ${claimedBalance}`);
    }

    // Step 2: Swap to BC
    let bcPrice = 0;
    if (!state || state.step < 2) {
      const swapResult = await swapToBCD(claimedBalance);
      bcdAmount = swapResult.bcAmount;
      bcPrice = swapResult.bcPrice;

      if (bcdAmount <= 0) {
        logFile(`Swap returned 0 BC, attempting recovery...`);
        if (preSwapBcBalance !== null) {
          try {
            const currentBcBalance = await getAvailableBcBalance();
            logFile(`BC balance check: before=${preSwapBcBalance}, now=${currentBcBalance}`);
            if (currentBcBalance !== null) {
              const recoveredBcAmount = currentBcBalance - parseFloat(preSwapBcBalance);
              logFile(`Balance delta: ${recoveredBcAmount} BC`);
              if (recoveredBcAmount >= 0.1) {
                bcdAmount = recoveredBcAmount.toFixed(7);
                const prices = getPrices();
                bcPrice = prices.BC || (parseFloat(claimedBalance) / recoveredBcAmount);
                log(`✅ Recovered completed swap from BC balance change: ${bcdAmount} BC`, 'WARN');
                logFile(`✓ Recovered swap: BC balance ${preSwapBcBalance} → ${currentBcBalance}, recovered ${bcdAmount} BC`);
                saveState({ step: 2, claimedBalance, bcdAmount, bcPrice, preSwapBcBalance, timestamp: Date.now() });
              }
            }
          } catch (error) {
            logFile(`Recovery failed: ${error.message}`, 'ERROR');
          }
        }

        if (bcdAmount <= 0) {
          log('❌ Swap did not complete, keeping claimed amount saved to retry next cycle', 'WARN');
          logFile(`Swap incomplete after recovery. Will retry in next cycle.`);
          return;
        }
      }

      if (bcdAmount > 0) {
        logFile(`Swapped to ${bcdAmount} BC @ $${bcPrice}`);
        saveState({ step: 2, claimedBalance, bcdAmount, bcPrice, preSwapBcBalance, timestamp: Date.now() });
      } else {
        log('Swap did not complete, keeping claimed amount saved to retry next cycle', 'WARN');
        return;
      }
    } else {
      bcdAmount = state.bcdAmount;
      bcPrice = state.bcPrice || 0;
      preSwapBcBalance = state.preSwapBcBalance ?? null;
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

      try {
        const accountStatus = await getAccountStatus();
        printAccountStatus(accountStatus, 'Updated Account Status');
        console.log('');
      } catch (error) {
        log(`Failed to refresh account status after cycle: ${error.message}`, 'WARN');
      }
    } else {
      logFile(`✗ Stake failed, saving state to retry`);
      saveState({ step: 3, claimedBalance, bcdAmount, bcPrice, preview, timestamp: Date.now() });
    }
  } catch (error) {
    log(`Automation error: ${error.message}`, 'ERROR');
  }
}

module.exports = { runAutomation };
