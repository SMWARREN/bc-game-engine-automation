const fs = require('fs');
const path = require('path');
const { logFile } = require('../utils/logger');

function processDailySummary(records) {
  const dailyData = {};

  records.forEach((record) => {
    // Parse timestamp to get date - handle multiple possible fields
    let date;
    if (record.timestamp) {
      date = new Date(record.timestamp);
    } else if (record.time) {
      date = new Date(record.time);
    } else if (record.createTime) {
      date = new Date(record.createTime);
    } else {
      logFile(`Warning: No timestamp found for record: ${JSON.stringify(record)}`, 'WARN');
      return; // Skip records without timestamps
    }

    // Validate date
    if (isNaN(date.getTime())) {
      logFile(`Warning: Invalid date for record: ${JSON.stringify(record)}`, 'WARN');
      return;
    }

    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!dailyData[dateStr]) {
      dailyData[dateStr] = {
        date: dateStr,
        earnings: 0,
        staked: 0,
        unstaked: 0,
        other: 0,
        transactionCount: 0,
        details: [],
      };
    }

    const amount = parseFloat(record.amount) || 0;
    const type = record.type?.toLowerCase() || 'other';

    if (type === 'earning') {
      dailyData[dateStr].earnings += amount;
    } else if (type === 'stake' || type.includes('stake')) {
      dailyData[dateStr].staked += amount;
    } else if (type === 'unstake' || type.includes('unstake') || type === 'withdrawal') {
      dailyData[dateStr].unstaked += amount;
    } else {
      dailyData[dateStr].other += amount;
    }

    dailyData[dateStr].transactionCount += 1;
    dailyData[dateStr].details.push({
      type: record.type,
      amount,
      currency: record.currency || 'BCD',
      sourceType: record.sourceType,
    });
  });

  // Convert to sorted array
  return Object.values(dailyData).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function generateCSV(dailySummaries) {
  let csv = 'Date,Earnings (BCD),Staked (BCD),Other (BCD),Total (BCD),Transaction Count\n';

  dailySummaries.forEach((day) => {
    const total = day.earnings + day.staked + day.other;
    csv += `${day.date},${day.earnings.toFixed(4)},${day.staked.toFixed(4)},${day.other.toFixed(4)},${total.toFixed(4)},${day.transactionCount}\n`;
  });

  return csv;
}

function exportToCSV(dailySummaries, filename = null) {
  if (!filename) {
    const now = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    filename = `bc-game-history-${now}.csv`;
  }

  const filepath = path.join(__dirname, '../../', filename);
  const csv = generateCSV(dailySummaries);

  try {
    fs.writeFileSync(filepath, csv);
    logFile(`Exported history to ${filename}`);
    console.log(`✅ History exported to ${filename}`);
    return filepath;
  } catch (error) {
    logFile(`Failed to export CSV: ${error.message}`, 'ERROR');
    console.log(`❌ Failed to export history: ${error.message}`);
    return null;
  }
}

function exportJSON(dailySummaries, filename = null) {
  if (!filename) {
    const now = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    filename = `bc-game-history-${now}.json`;
  }

  const filepath = path.join(__dirname, '../../', filename);

  try {
    fs.writeFileSync(filepath, JSON.stringify(dailySummaries, null, 2));
    logFile(`Exported history to ${filename}`);
    console.log(`✅ History exported to ${filename}`);
    return filepath;
  } catch (error) {
    logFile(`Failed to export JSON: ${error.message}`, 'ERROR');
    console.log(`❌ Failed to export history: ${error.message}`);
    return null;
  }
}

module.exports = { processDailySummary, generateCSV, exportToCSV, exportJSON };
