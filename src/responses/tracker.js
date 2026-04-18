const fs = require('fs');
const path = require('path');

const RESPONSES_DIR = path.join(__dirname, '../../api-responses');
const RESPONSES_INDEX = path.join(RESPONSES_DIR, 'index.json');

function ensureResponsesDir() {
  if (!fs.existsSync(RESPONSES_DIR)) {
    fs.mkdirSync(RESPONSES_DIR, { recursive: true });
  }
}

function saveResponse(url, method, body, response) {
  try {
    ensureResponsesDir();

    // Extract endpoint name from URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    const endpoint = pathParts[pathParts.length - 1] || 'unknown';
    const endpointDir = path.join(RESPONSES_DIR, endpoint);

    if (!fs.existsSync(endpointDir)) {
      fs.mkdirSync(endpointDir, { recursive: true });
    }

    // Save response with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}.json`;
    const filepath = path.join(endpointDir, filename);

    const record = {
      timestamp: new Date().toISOString(),
      endpoint: endpoint,
      method: method,
      url: url,
      body: body,
      response: response,
    };

    fs.writeFileSync(filepath, JSON.stringify(record, null, 2));
    updateResponsesIndex(endpoint, url, timestamp);
  } catch (error) {
    console.error(`Failed to save response: ${error.message}`);
  }
}

function updateResponsesIndex(endpoint, url, timestamp) {
  try {
    let index = {};
    if (fs.existsSync(RESPONSES_INDEX)) {
      index = JSON.parse(fs.readFileSync(RESPONSES_INDEX, 'utf8'));
    }

    if (!index[endpoint]) {
      index[endpoint] = {
        url: url,
        responses: [],
      };
    }

    index[endpoint].responses.push({
      timestamp: timestamp,
      file: `${timestamp}.json`,
    });

    // Keep only last 10 responses per endpoint
    if (index[endpoint].responses.length > 10) {
      index[endpoint].responses = index[endpoint].responses.slice(-10);
    }

    fs.writeFileSync(RESPONSES_INDEX, JSON.stringify(index, null, 2));
  } catch (error) {
    console.error(`Failed to update index: ${error.message}`);
  }
}

module.exports = { saveResponse };
