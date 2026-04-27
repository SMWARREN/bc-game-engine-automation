const { apiRequest } = require('../api/client');
const { getPrices, updatePrices } = require('../api/prices');
const { formatNumber, formatUSD } = require('../utils/format');

function findLastStake(historyRecords) {
  return historyRecords.find((record) => record.type === 'STAKE') || null;
}

async function getAccountStatus() {
  await updatePrices();

  const userResponse = await apiRequest('https://bc.game/api/vault/bc-engine/user/info/', 'POST');
  const userInfo = userResponse.data;

  const previewResponse = await apiRequest(
    'https://bc.game/api/vault/bc-engine/stake/preview/',
    'POST',
    { stakeAmount: 0.1 }
  );
  if (previewResponse.code !== 0) {
    throw new Error(`Stake preview failed: ${previewResponse.msg || 'Unknown error'}`);
  }

  const historyResponse = await apiRequest(
    'https://bc.game/api/vault/bc-engine/history/',
    'POST',
    { type: 'ALL', pageNo: 1, pageSize: 20 }
  );
  if (historyResponse.code !== 0) {
    throw new Error(`History fetch failed: ${historyResponse.msg || 'Unknown error'}`);
  }

  return {
    userInfo,
    availableBcBalance: previewResponse.data?.currentBalance || '0',
    lastStake: findLastStake(historyResponse.data?.list || []),
    prices: getPrices(),
  };
}

function printAccountStatus(status, title = 'Account Status') {
  const stakeUsdValue = (parseFloat(status.userInfo.stakeAmount) * parseFloat(status.prices.BC)).toFixed(2);

  console.log(`\n👤 ${title}:`);
  console.log(`   Current stake: ${formatNumber(status.userInfo.stakeAmount)} BC`);
  console.log(`   Stake value: ${formatUSD(stakeUsdValue)}`);
  console.log(`   Pending balance: ${formatUSD(status.userInfo.pendingBalance)}`);
  console.log(`   Earned total: ${formatUSD(status.userInfo.earnedTotal)}`);
  console.log(`   Available balance: ${formatNumber(status.availableBcBalance)} BC`);
  console.log(`   Last stake: ${status.lastStake ? `${formatNumber(status.lastStake.amount)} ${status.lastStake.currency} (${new Date(status.lastStake.createTime).toLocaleString()})` : 'None found'}`);
}

module.exports = { getAccountStatus, printAccountStatus };
