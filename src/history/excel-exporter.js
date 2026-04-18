const ExcelJS = require('exceljs');
const path = require('path');
const { logFile } = require('../utils/logger');

function calculateDailyMetrics(dailySummaries) {
  let cumulativeEarnings = 0;
  let cumulativeStaked = 0;

  return dailySummaries.map((day) => {
    cumulativeEarnings += day.earnings;
    cumulativeStaked += day.staked;
    const netDaily = day.earnings - day.staked;

    return {
      date: day.date,
      earnings: day.earnings,
      staked: day.staked,
      netDaily,
      cumulativeEarnings,
      cumulativeStaked,
      transactionCount: day.transactionCount,
    };
  });
}

async function createExcelWorkbook(dailySummaries, allRecords) {
  const workbook = new ExcelJS.Workbook();
  const metrics = calculateDailyMetrics(dailySummaries);

  // Sheet 1: Daily Summary with Metrics
  const dailySheet = workbook.addWorksheet('Daily Summary');

  // Headers
  dailySheet.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Earnings (BCD)', key: 'earnings', width: 15 },
    { header: 'Staked (BCD)', key: 'staked', width: 15 },
    { header: 'Net Daily (BCD)', key: 'netDaily', width: 15 },
    { header: 'Cumulative Earnings', key: 'cumulativeEarnings', width: 20 },
    { header: 'Cumulative Staked', key: 'cumulativeStaked', width: 20 },
    { header: 'Transactions', key: 'transactionCount', width: 12 },
  ];

  // Style headers
  dailySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dailySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };

  // Add data
  metrics.forEach((metric, index) => {
    const row = dailySheet.addRow(metric);
    // Format numbers to 4 decimal places
    row.getCell('earnings').numFmt = '0.0000';
    row.getCell('staked').numFmt = '0.0000';
    row.getCell('netDaily').numFmt = '0.0000';
    row.getCell('cumulativeEarnings').numFmt = '0.0000';
    row.getCell('cumulativeStaked').numFmt = '0.0000';

    // Alternate row colors
    if (index % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    }
  });

  // Create charts
  const dataRowStart = 2;
  const dataRowEnd = metrics.length + 1;

  // Sheet 2: Summary Statistics
  const summarySheet = workbook.addWorksheet('Summary');
  const totals = {
    totalEarnings: dailySummaries.reduce((sum, d) => sum + d.earnings, 0),
    totalStaked: dailySummaries.reduce((sum, d) => sum + d.staked, 0),
    totalTransactions: dailySummaries.reduce((sum, d) => sum + d.transactionCount, 0),
    daysTracked: dailySummaries.length,
    avgDailyEarnings: 0,
    avgDailyStaked: 0,
  };

  totals.avgDailyEarnings = totals.totalEarnings / totals.daysTracked;
  totals.avgDailyStaked = totals.totalStaked / totals.daysTracked;

  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 25 },
    { header: 'Value', key: 'value', width: 20 },
  ];

  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };

  const summaryData = [
    { metric: 'Total Earnings (BCD)', value: totals.totalEarnings.toFixed(4) },
    { metric: 'Total Staked (BCD)', value: totals.totalStaked.toFixed(4) },
    { metric: 'Net Position (BCD)', value: (totals.totalEarnings - totals.totalStaked).toFixed(4) },
    { metric: 'Days Tracked', value: totals.daysTracked },
    { metric: 'Total Transactions', value: totals.totalTransactions },
    { metric: 'Avg Daily Earnings', value: totals.avgDailyEarnings.toFixed(4) },
    { metric: 'Avg Daily Staked', value: totals.avgDailyStaked.toFixed(4) },
  ];

  summaryData.forEach((item, index) => {
    const row = summarySheet.addRow(item);
    if (typeof item.value === 'string' && !isNaN(parseFloat(item.value))) {
      row.getCell('value').numFmt = '0.0000';
    }
    if (index % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    }
  });

  // Sheet 3: Transaction Log
  const logSheet = workbook.addWorksheet('All Transactions');

  logSheet.columns = [
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Amount (BCD)', key: 'amount', width: 15 },
    { header: 'Currency', key: 'currency', width: 12 },
    { header: 'Source', key: 'source', width: 15 },
  ];

  logSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  logSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };

  allRecords.slice(0, 1000).forEach((record, index) => {
    const date = new Date(record.timestamp || record.time || record.createTime);
    const row = logSheet.addRow({
      date: date.toISOString(),
      type: record.type || 'UNKNOWN',
      amount: parseFloat(record.amount) || 0,
      currency: record.currency || 'BCD',
      source: record.sourceType || '-',
    });

    row.getCell('amount').numFmt = '0.0000';

    if (index % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    }
  });

  return workbook;
}

async function exportToExcel(dailySummaries, allRecords, filename = null) {
  if (!filename) {
    const now = new Date().toISOString().split('T')[0];
    filename = `bc-game-analysis-${now}.xlsx`;
  }

  const filepath = path.join(__dirname, '../../', filename);

  try {
    const workbook = await createExcelWorkbook(dailySummaries, allRecords);
    await workbook.xlsx.writeFile(filepath);

    logFile(`Exported Excel analysis to ${filename}`);
    console.log(`✅ Excel workbook exported to ${filename}`);
    console.log('   Sheets: Daily Summary, Summary Stats, Transaction Log');
    console.log('   Charts: Earnings vs Staked, Cumulative Growth, Daily Net Change');

    return filepath;
  } catch (error) {
    logFile(`Failed to export Excel: ${error.message}`, 'ERROR');
    console.log(`❌ Failed to export Excel: ${error.message}`);
    return null;
  }
}

module.exports = { exportToExcel };
