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

  // Prepare chart data - BCD values
  const dates = dailySummaries.map(d => d.date);
  const earnings = dailySummaries.map(d => parseFloat(d.earnings || 0));
  const staked = dailySummaries.map(d => parseFloat(d.staked || 0));
  const unstaked = dailySummaries.map(d => parseFloat(d.unstaked || 0));

  // Prepare USD values
  const earningsUSD = dailySummaries.map(d => parseFloat(d.earningsUSD || 0));
  const stakedUSD = dailySummaries.map(d => parseFloat(d.stakedUSD || 0));
  const unstakedUSD = dailySummaries.map(d => parseFloat(d.unstakedUSD || 0));

  // Calculate cumulative values (BCD)
  let cumEarnings = 0;
  let cumStaked = 0;
  let cumUnstaked = 0;
  const cumulativeEarnings = earnings.map(e => { cumEarnings += e; return cumEarnings; });
  const cumulativeStaked = staked.map(s => { cumStaked += s; return cumStaked; });
  const cumulativeUnstaked = unstaked.map(u => { cumUnstaked += u; return cumUnstaked; });

  // Calculate cumulative USD
  let cumEarningsUSD = 0;
  let cumStakedUSD = 0;
  let cumUnstakedUSD = 0;
  const cumulativeEarningsUSD = earningsUSD.map(e => { cumEarningsUSD += e; return cumEarningsUSD; });
  const cumulativeStakedUSD = stakedUSD.map(s => { cumStakedUSD += s; return cumStakedUSD; });
  const cumulativeUnstakedUSD = unstakedUSD.map(u => { cumUnstakedUSD += u; return cumUnstakedUSD; });

  const netPosition = earnings.map((e, i) => e - staked[i] + unstaked[i]);
  const netPositionUSD = earningsUSD.map((e, i) => e - stakedUSD[i] + unstakedUSD[i]);

  const totals = {
    totalEarnings: earnings.reduce((a, b) => a + b, 0).toFixed(4),
    totalStaked: staked.reduce((a, b) => a + b, 0).toFixed(4),
    totalUnstaked: unstaked.reduce((a, b) => a + b, 0).toFixed(4),
    totalEarningsUSD: earningsUSD.reduce((a, b) => a + b, 0).toFixed(2),
    totalStakedUSD: stakedUSD.reduce((a, b) => a + b, 0).toFixed(2),
    totalUnstakedUSD: unstakedUSD.reduce((a, b) => a + b, 0).toFixed(2),
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
      color: #e0e0e0;
      padding: 20px;
      min-height: 100vh;
    }

    .container {
      max-width: 1600px;
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
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin-bottom: 40px;
    }

    .stat-card {
      background: rgba(14, 165, 233, 0.1);
      border: 1px solid #0ea5e9;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }

    .stat-label {
      font-size: 0.85em;
      color: #0ea5e9;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .stat-value {
      font-size: 1.6em;
      font-weight: bold;
      color: #10b981;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(550px, 1fr));
      gap: 25px;
      margin-bottom: 40px;
    }

    .chart-container {
      background: rgba(45, 45, 68, 0.8);
      border: 1px solid #0ea5e9;
      border-radius: 8px;
      padding: 20px;
      position: relative;
      min-height: 450px;
      display: flex;
      flex-direction: column;
    }

    .chart-container canvas {
      flex: 1;
    }

    .chart-title {
      font-size: 1.2em;
      margin-bottom: 15px;
      color: #0ea5e9;
      font-weight: bold;
    }

    canvas {
      max-height: 350px;
    }

    .daily-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .daily-card {
      background: rgba(45, 45, 68, 0.8);
      border: 1px solid #0ea5e9;
      border-radius: 8px;
      padding: 15px;
    }

    .daily-date {
      font-size: 1.1em;
      font-weight: bold;
      color: #0ea5e9;
      margin-bottom: 10px;
    }

    .daily-stat {
      display: flex;
      justify-content: space-between;
      margin: 8px 0;
      padding: 5px 0;
      border-bottom: 1px solid rgba(14, 165, 233, 0.3);
    }

    .daily-stat-label {
      color: #999;
    }

    .daily-stat-value {
      font-weight: bold;
      color: #10b981;
    }

    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #0ea5e9;
      color: #666;
      font-size: 0.9em;
    }

    @media (max-width: 768px) {
      .charts-grid, .daily-grid {
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
      <p>Real-time earnings, staking, and withdrawal tracking</p>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Earnings USD</div>
        <div class="stat-value">$${totals.totalEarningsUSD}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Staked USD</div>
        <div class="stat-value">$${totals.totalStakedUSD}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Unstaked USD</div>
        <div class="stat-value">$${totals.totalUnstakedUSD}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Days Tracked</div>
        <div class="stat-value">${totals.daysTracked}</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-container">
        <div class="chart-title">💵 Daily USD: Earnings, Staked, Unstaked</div>
        <canvas id="dailyUSDChart"></canvas>
      </div>

      <div class="chart-container">
        <div class="chart-title">📈 Cumulative USD Growth Over Time</div>
        <canvas id="cumulativeUSDChart"></canvas>
      </div>

      <div class="chart-container">
        <div class="chart-title">📊 Daily BCD: Earnings, Staked, Unstaked</div>
        <canvas id="dailyChart"></canvas>
      </div>

      <div class="chart-container">
        <div class="chart-title">📈 Cumulative BCD Growth Over Time</div>
        <canvas id="cumulativeChart"></canvas>
      </div>

      <div class="chart-container">
        <div class="chart-title">💰 Daily BCD Net Cash Flow</div>
        <canvas id="netChart"></canvas>
      </div>

      <div class="chart-container">
        <div class="chart-title">💵 Daily USD Net Cash Flow</div>
        <canvas id="netUSDChart"></canvas>
      </div>

      <div class="chart-container">
        <div class="chart-title">📉 USD Net Position Trajectory</div>
        <canvas id="positionUSDChart"></canvas>
      </div>

      <div class="chart-container">
        <div class="chart-title">📉 BCD Net Position Trajectory</div>
        <canvas id="positionChart"></canvas>
      </div>
    </div>

    <h2 style="color: #0ea5e9; margin: 40px 0 20px 0;">📅 Daily Breakdown</h2>
    <div class="daily-grid" id="dailyGrid"></div>

    <div class="footer">
      <p>Last updated: ${new Date().toLocaleString()}</p>
      <p>Generated by BC.Game Engine Auto-Stake Automation</p>
    </div>
  </div>

  <script>
    // Generate daily breakdown cards
    const dailySummaries = ${JSON.stringify(dailySummaries)};
    const dailyGrid = document.getElementById('dailyGrid');
    dailySummaries.forEach(day => {
      const net = day.earnings - day.staked + day.unstaked;
      const card = document.createElement('div');
      card.className = 'daily-card';
      card.innerHTML = \`
        <div class="daily-date">\${day.date}</div>
        <div class="daily-stat">
          <span class="daily-stat-label">Earned:</span>
          <span class="daily-stat-value">\${day.earnings.toFixed(4)} BCD</span>
        </div>
        <div class="daily-stat">
          <span class="daily-stat-label">Staked:</span>
          <span class="daily-stat-value">\${day.staked.toFixed(4)} BCD</span>
        </div>
        <div class="daily-stat">
          <span class="daily-stat-label">Unstaked:</span>
          <span class="daily-stat-value">\${day.unstaked.toFixed(4)} BCD</span>
        </div>
        <div class="daily-stat" style="margin-top: 10px; border-top: 2px solid #0ea5e9;">
          <span class="daily-stat-label">Net:</span>
          <span class="daily-stat-value" style="color: \${net >= 0 ? '#10b981' : '#ef4444'}">\${net.toFixed(4)} BCD</span>
        </div>
        <div class="daily-stat">
          <span class="daily-stat-label">Transactions:</span>
          <span class="daily-stat-value">\${day.transactionCount}</span>
        </div>
      \`;
      dailyGrid.appendChild(card);
    });

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
    const earnings = ${JSON.stringify(earnings)};
    const staked = ${JSON.stringify(staked)};
    const unstaked = ${JSON.stringify(unstaked)};
    const earningsUSD = ${JSON.stringify(earningsUSD)};
    const stakedUSD = ${JSON.stringify(stakedUSD)};
    const unstakedUSD = ${JSON.stringify(unstakedUSD)};
    const cumulativeEarnings = ${JSON.stringify(cumulativeEarnings)};
    const cumulativeStaked = ${JSON.stringify(cumulativeStaked)};
    const cumulativeUnstaked = ${JSON.stringify(cumulativeUnstaked)};
    const cumulativeEarningsUSD = ${JSON.stringify(cumulativeEarningsUSD)};
    const cumulativeStakedUSD = ${JSON.stringify(cumulativeStakedUSD)};
    const cumulativeUnstakedUSD = ${JSON.stringify(cumulativeUnstakedUSD)};
    const netPosition = ${JSON.stringify(netPosition)};
    const netPositionUSD = ${JSON.stringify(netPositionUSD)};

    // Chart 0: Daily USD Earnings, Staked, Unstaked
    new Chart(document.getElementById('dailyUSDChart'), {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          {
            label: '💵 Earnings USD',
            data: earningsUSD,
            backgroundColor: '#10b981',
            borderColor: '#059669',
            borderWidth: 1
          },
          {
            label: '📥 Staked USD',
            data: stakedUSD,
            backgroundColor: '#0ea5e9',
            borderColor: '#0284c7',
            borderWidth: 1
          },
          {
            label: '📤 Unstaked USD',
            data: unstakedUSD,
            backgroundColor: '#f59e0b',
            borderColor: '#d97706',
            borderWidth: 1
          }
        ]
      },
      options: { ...chartOptions, plugins: { ...chartOptions.plugins, legend: { position: 'top' } } }
    });

    // Chart 0.5: Cumulative USD
    new Chart(document.getElementById('cumulativeUSDChart'), {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Total Earned USD',
            data: cumulativeEarningsUSD,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          },
          {
            label: 'Total Staked USD',
            data: cumulativeStakedUSD,
            borderColor: '#0ea5e9',
            backgroundColor: 'rgba(14, 165, 233, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          },
          {
            label: 'Total Unstaked USD',
            data: cumulativeUnstakedUSD,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: { ...chartOptions, plugins: { ...chartOptions.plugins, legend: { position: 'top' } } }
    });

    // Chart 1: Daily Earnings, Staked, Unstaked (BCD)
    new Chart(document.getElementById('dailyChart'), {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          {
            label: '💵 Earnings',
            data: earnings,
            backgroundColor: '#10b981',
            borderColor: '#059669',
            borderWidth: 1
          },
          {
            label: '📥 Staked',
            data: staked,
            backgroundColor: '#0ea5e9',
            borderColor: '#0284c7',
            borderWidth: 1
          },
          {
            label: '📤 Unstaked',
            data: unstaked,
            backgroundColor: '#f59e0b',
            borderColor: '#d97706',
            borderWidth: 1
          }
        ]
      },
      options: { ...chartOptions, plugins: { ...chartOptions.plugins, legend: { position: 'top' } } }
    });

    // Chart 2: Cumulative
    new Chart(document.getElementById('cumulativeChart'), {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Total Earned',
            data: cumulativeEarnings,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          },
          {
            label: 'Total Staked',
            data: cumulativeStaked,
            borderColor: '#0ea5e9',
            backgroundColor: 'rgba(14, 165, 233, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          },
          {
            label: 'Total Unstaked',
            data: cumulativeUnstaked,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: { ...chartOptions, plugins: { ...chartOptions.plugins, legend: { position: 'top' } } }
    });

    // Chart 3: Daily Net Cash Flow (USD)
    new Chart(document.getElementById('netUSDChart'), {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [{
          label: 'Net Daily USD (Earned - Staked + Unstaked)',
          data: netPositionUSD,
          backgroundColor: netPositionUSD.map(v => v >= 0 ? '#10b981' : '#ef4444'),
          borderColor: netPositionUSD.map(v => v >= 0 ? '#059669' : '#dc2626'),
          borderWidth: 1
        }]
      },
      options: chartOptions
    });

    // Chart 3b: Daily Net Cash Flow (BCD)
    new Chart(document.getElementById('netChart'), {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [{
          label: 'Net Daily BCD (Earned - Staked + Unstaked)',
          data: netPosition,
          backgroundColor: netPosition.map(v => v >= 0 ? '#10b981' : '#ef4444'),
          borderColor: netPosition.map(v => v >= 0 ? '#059669' : '#dc2626'),
          borderWidth: 1
        }]
      },
      options: chartOptions
    });

    // Chart 4: Net Position (USD)
    const netPositionCumulativeUSD = netPositionUSD.reduce((acc, val) => {
      acc.push((acc.length > 0 ? acc[acc.length - 1] : 0) + val);
      return acc;
    }, []);

    new Chart(document.getElementById('positionUSDChart'), {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: 'Cumulative Net Position USD',
          data: netPositionCumulativeUSD,
          borderColor: netPositionCumulativeUSD[netPositionCumulativeUSD.length - 1] >= 0 ? '#10b981' : '#ef4444',
          backgroundColor: netPositionCumulativeUSD[netPositionCumulativeUSD.length - 1] >= 0
            ? 'rgba(16, 185, 129, 0.1)'
            : 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5
        }]
      },
      options: { ...chartOptions, plugins: { ...chartOptions.plugins, legend: { position: 'top' } } }
    });

    // Chart 4b: Net Position (BCD)
    const netPositionCumulativeBCD = netPosition.reduce((acc, val) => {
      acc.push((acc.length > 0 ? acc[acc.length - 1] : 0) + val);
      return acc;
    }, []);

    new Chart(document.getElementById('positionChart'), {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: 'Cumulative Net Position BCD',
          data: netPositionCumulativeBCD,
          borderColor: netPositionCumulativeBCD[netPositionCumulativeBCD.length - 1] >= 0 ? '#10b981' : '#ef4444',
          backgroundColor: netPositionCumulativeBCD[netPositionCumulativeBCD.length - 1] >= 0
            ? 'rgba(16, 185, 129, 0.1)'
            : 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#10b981',
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
