const fs = require('fs');
const { log } = require('../utils/logger');
const { DATA_DIR, dataPath } = require('../utils/paths');

const STATE_FILE = dataPath('.bc-game-state.json');

function saveState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
