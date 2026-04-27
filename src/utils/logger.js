const fs = require('fs');

let LOG_FILE = null;

function setLogFile(path) {
  LOG_FILE = path;
}

function getLocalTimestamp() {
  const now = new Date();
  return now.toLocaleString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
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
