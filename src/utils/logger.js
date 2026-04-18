const fs = require('fs');

let LOG_FILE = null;
let QUIET_MODE = false;

function setLogFile(path) {
  LOG_FILE = path;
}

function setQuietMode(quiet) {
  QUIET_MODE = quiet;
}

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;

  // Only log to console if not in quiet mode
  if (!QUIET_MODE) {
    console.log(logMessage);
  }

  // Always log to file
  if (LOG_FILE) {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  }
}

module.exports = { setLogFile, setQuietMode, log };
