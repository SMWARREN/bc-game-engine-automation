const { apiRequest } = require('../api/client');
const { log } = require('../utils/logger');

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

async function claimEarnings() {
  try {
    const claimResponse = await apiRequest('https://bc.game/api/vault/bc-engine/dist/claim/', 'POST', {});

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

module.exports = { getPendingBalance, claimEarnings };
