#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const { setLogFile } = require('../src/utils/logger');
const { fetchAllHistory } = require('../src/history/fetcher');
const { processDailySummary, exportToCSV, exportJSON } = require('../src/history/processor');
const { exportToExcel } = require('../src/history/excel-exporter');

// Setup logging
const LOG_FILE = path.join(__dirname, '../bc-game-history.log');
setLogFile(LOG_FILE);

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 BC.Game History Exporter');
  console.log('='.repeat(60) + '\n');

  console.log('Fetching all history records...');
  const records = await fetchAllHistory();

  if (records.length === 0) {
    console.log('\n❌ No history records found');
    process.exit(1);
  }

  console.log(`\n✅ Fetched ${records.length} records`);
  console.log('\nProcessing daily summaries...');

  const dailySummaries = processDailySummary(records);

  console.log(`✅ Generated summaries for ${dailySummaries.length} days\n`);

  // Show summary
  const totalEarnings = dailySummaries.reduce((sum, day) => sum + day.earnings, 0);
  const totalStaked = dailySummaries.reduce((sum, day) => sum + day.staked, 0);
  const totalTransactions = dailySummaries.reduce((sum, day) => sum + day.transactionCount, 0);

  console.log('📈 Summary:');
  console.log(`   Total Earnings: ${totalEarnings.toFixed(4)} BCD`);
  console.log(`   Total Staked: ${totalStaked.toFixed(4)} BCD`);
  console.log(`   Total Transactions: ${totalTransactions}`);
  console.log(`   Date Range: ${dailySummaries[0].date} to ${dailySummaries[dailySummaries.length - 1].date}\n`);

  console.log('Exporting to files...\n');

  const csvPath = exportToCSV(dailySummaries);
  const jsonPath = exportJSON(dailySummaries);
  const excelPath = await exportToExcel(dailySummaries, records);

  if (csvPath && jsonPath && excelPath) {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Export Complete!');
    console.log('='.repeat(60));
    console.log('Generated files:');
    console.log('  • bc-game-analysis-YYYY-MM-DD.xlsx - Excel with charts');
    console.log('  • bc-game-history-YYYY-MM-DD.csv - Simple CSV');
    console.log('  • bc-game-history-YYYY-MM-DD.json - Full transaction data\n');
    process.exit(0);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('❌ Export Failed');
    console.log('='.repeat(60) + '\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
