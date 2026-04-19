#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs = require('fs');
const { setLogFile } = require('../src/utils/logger');
const { fetchAllHistory } = require('../src/history/fetcher');
const { processDailySummary } = require('../src/history/processor');

setLogFile(path.join(__dirname, '../bc-game-dashboard.log'));

async function generateDashboard() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Generating Dashboard...');
  console.log('='.repeat(60) + '\n');

  console.log('Fetching history records...');
  const records = await fetchAllHistory();

  if (records.length === 0) {
    console.log('❌ No history records found');
    process.exit(1);
  }

  console.log(`✅ Fetched ${records.length} records\n`);

  const dailySummaries = processDailySummary(records);

  // Prepare chart data
  const dates = dailySummaries.map(d => d.date);
  const earnings = dailySummaries.map(d => parseFloat(d.earnings || 0).toFixed(4));
  const staked = dailySummaries.map(d => parseFloat(d.staked || 0).toFixed(4));
  const cumEarnings = dailySummaries.map(d => parseFloat(d.cumulativeEarnings || 0).toFixed(4));
  const cumStaked = dailySummaries.map(d => parseFloat(d.cumulativeStaked || 0).toFixed(4));
  const netDaily = dailySummaries.map(d => (parseFloat(d.earnings || 0) - parseFloat(d.staked || 0)).toFixed(4));

  const totals = {
    totalEarnings: dailySummaries.reduce((sum, d) => sum + d.earnings, 0).toFixed(4),
    totalStaked: dailySummaries.reduce((sum, d) => sum + d.staked, 0).toFixed(4),
    totalTransactions: dailySummaries.reduce((sum, d) => sum + d.transactionCount, 0),
    daysTracked: dailySummaries.length,
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BC.Game Engine Auto-Stake Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
      color: #e0e0e0;
      padding: 20px;
      min-height: 100vh;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 2px solid #0ea5e9;
      padding-bottom: 20px;
    }

    h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      color: #0ea5e9;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 40px;
    }

    .stat-card {
      background: rgba(14, 165, 233, 0.1);
      border: 1px solid #0ea5e9;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }

    .stat-label {
      font-size: 0.9em;
      color: #0ea5e9;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .stat-value {
      font-size: 1.8em;
      font-weight: bold;
      color: #10b981;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 30px;
      margin-bottom: 40px;
    }

    .chart-container {
      background: rgba(45, 45, 68, 0.8);
      border: 1px solid #0ea5e9;
      border-radius: 8px;
      padding: 20px;
      position: relative;
      height: 400px;
    }

    .chart-title {
      font-size: 1.3em;
      margin-bottom: 15px;
      color: #0ea5e9;
      font-weight: bold;
    }

    canvas {
      max-height: 350px;
    }

    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #0ea5e9;
      color: #666;
      font-size: 0.9em;
    }

    @media (max-width: 768px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }

      h1 {
        font-size: 1.8em;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎮 BC.Game Engine Auto-Stake Dashboard</h1>
      <p>Real-time earnings tracking and analysis</p>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Earnings</div>
        <div class="stat-value">${totals.totalEarnings} BCD</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Staked</div>
        <div class="stat-value">${totals.totalStaked} BCD</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Days Tracked</div>
        <div class="stat-value">${totals.daysTracked}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Transactions</div>
        <div class="stat-value">${totals.totalTransactions}</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-container">
        <div class="chart-title">📈 Daily Earnings vs Staked</div>
        <canvas id="earningsChart"></canvas>
      </div>

      <div class="chart-container">
        <div class="chart-title">📊 Cumulative Growth</div>
        <canvas id="cumulativeChart"></canvas>
      </div>

      <div class="chart-container">
        <div class="chart-title">💰 Daily Net Change</div>
        <canvas id="netChart"></canvas>
      </div>

      <div class="chart-container">
        <div class="chart-title">📉 Net Position Over Time</div>
        <canvas id="positionChart"></canvas>
      </div>
    </div>

    <div class="footer">
      <p>Last updated: ${new Date().toLocaleString()}</p>
      <p>Generated by BC.Game Engine Auto-Stake Automation</p>
    </div>
  </div>

  <script>
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#e0e0e0' }
        }
      },
      scales: {
        y: {
          ticks: { color: '#999' },
          grid: { color: '#333' }
        },
        x: {
          ticks: { color: '#999' },
          grid: { color: '#333' }
        }
      }
    };

    const dates = ${JSON.stringify(dates)};
    const earnings = ${JSON.stringify(earnings)}.map(Number);
    const staked = ${JSON.stringify(staked)}.map(Number);
    const cumEarnings = ${JSON.stringify(cumEarnings)}.map(Number);
    const cumStaked = ${JSON.stringify(cumStaked)}.map(Number);
    const netDaily = ${JSON.stringify(netDaily)}.map(Number);

    // Chart 1: Daily Earnings vs Staked
    new Chart(document.getElementById('earningsChart'), {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Earnings',
            data: earnings,
            backgroundColor: '#10b981',
            borderColor: '#059669',
            borderWidth: 1
          },
          {
            label: 'Staked',
            data: staked,
            backgroundColor: '#0ea5e9',
            borderColor: '#0284c7',
            borderWidth: 1
          }
        ]
      },
      options: { ...chartOptions, plugins: { ...chartOptions.plugins, legend: { position: 'top' } } }
    });

    // Chart 2: Cumulative Growth
    new Chart(document.getElementById('cumulativeChart'), {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Cumulative Earnings',
            data: cumEarnings,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          },
          {
            label: 'Cumulative Staked',
            data: cumStaked,
            borderColor: '#0ea5e9',
            backgroundColor: 'rgba(14, 165, 233, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: { ...chartOptions, plugins: { ...chartOptions.plugins, legend: { position: 'top' } } }
    });

    // Chart 3: Daily Net Change
    new Chart(document.getElementById('netChart'), {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [{
          label: 'Net Daily (Earnings - Staked)',
          data: netDaily,
          backgroundColor: netDaily.map(v => v >= 0 ? '#10b981' : '#ef4444'),
          borderColor: netDaily.map(v => v >= 0 ? '#059669' : '#dc2626'),
          borderWidth: 1
        }]
      },
      options: chartOptions
    });

    // Chart 4: Net Position Over Time
    let netPosition = 0;
    const netPositionData = netDaily.map(v => {
      netPosition += v;
      return netPosition;
    });

    new Chart(document.getElementById('positionChart'), {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: 'Cumulative Net Position',
          data: netPositionData,
          borderColor: netPositionData[netPositionData.length - 1] >= 0 ? '#10b981' : '#ef4444',
          backgroundColor: netPositionData[netPositionData.length - 1] >= 0
            ? 'rgba(16, 185, 129, 0.1)'
            : 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#0ea5e9',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5
        }]
      },
      options: { ...chartOptions, plugins: { ...chartOptions.plugins, legend: { position: 'top' } } }
    });
  </script>
</body>
</html>`;

  const dashboardPath = path.join(__dirname, '../bc-game-dashboard.html');
  fs.writeFileSync(dashboardPath, html);

  console.log('✅ Dashboard generated: bc-game-dashboard.html');
  console.log('\n📖 Open it in your browser:');
  console.log(`   file://${dashboardPath}\n`);
  console.log('='.repeat(60) + '\n');
}

generateDashboard().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
