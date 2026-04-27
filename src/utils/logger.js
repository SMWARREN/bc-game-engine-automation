const fs = require('fs');

let LOG_FILE = null;

function setLogFile(path) {
  LOG_FILE = path;
}

function getLocalTimestamp() {
  const now = new Date();
  return now.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, '$3-$1-$2T$4:$5:$6');
}

// Log to file only (for API details, debug info)
function logFile(message, level = 'DEBUG') {
  const timestamp = getLocalTimestamp();
  const logMessage = `[${timestamp}] [${level}] ${message}`;

  if (LOG_FILE) {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  }
}

// Log to console and file (for important status/results)
function log(message, level = 'INFO') {
  const timestamp = getLocalTimestamp();
  const logMessage = `[${timestamp}] [${level}] ${message}`;

  console.log(logMessage);

  if (LOG_FILE) {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  }
}

module.exports = { setLogFile, log, logFile };
