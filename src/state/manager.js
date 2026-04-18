const fs = require('fs');
const path = require('path');
const { log } = require('../utils/logger');

const STATE_FILE = path.join(__dirname, '../../.bc-game-state.json');

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (error) {
    log(`Failed to load state: ${error.message}`, 'WARN');
  }
  return null;
}

function clearState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  } catch (error) {
    log(`Failed to clear state: ${error.message}`, 'WARN');
  }
}

module.exports = { saveState, loadState, clearState };
