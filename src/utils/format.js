// Format number with comma separators
function formatNumber(num) {
  const numStr = String(num);
  const parts = numStr.split('.');
  const intPart = parts[0];
  const decPart = parts[1];

  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart ? `${formatted}.${decPart}` : formatted;
}

// Format currency (with $ and commas)
function formatUSD(amount) {
  return `$${formatNumber(amount)}`;
}

module.exports = { formatNumber, formatUSD };
