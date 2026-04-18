const { apiRequest } = require('../api/client');
const { log } = require('../utils/logger');

const MIN_STAKE_AMOUNT = 0.1;

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

async function executStake(stakeAmount) {
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

module.exports = { previewStake, executStake };
