const fs = require('fs');

let LOG_FILE = null;

function setLogFile(path) {
  LOG_FILE = path;
}

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  if (LOG_FILE) {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  }
}

module.exports = { setLogFile, log };
