const path = require('path');

const APP_ROOT = path.join(__dirname, '../..');
const DATA_DIR = process.env.BC_GAME_DATA_DIR
  ? path.resolve(process.env.BC_GAME_DATA_DIR)
  : APP_ROOT;

function dataPath(...parts) {
  return path.join(DATA_DIR, ...parts);
}

module.exports = { APP_ROOT, DATA_DIR, dataPath };
