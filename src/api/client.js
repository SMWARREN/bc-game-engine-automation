const fs = require('fs');
const { log, logFile } = require('../utils/logger');
const { saveResponse } = require('../responses/tracker');

const COOKIES = process.env.BC_GAME_COOKIES;

async function apiRequest(url, method = 'POST', body = null) {
  try {
    const timestamp = new Date().toISOString();
    // API logs go to file only
    logFile(`[${timestamp}] ${method} ${url}`);

    if (body && Object.keys(body).length > 0) {
      logFile(`  Body: ${JSON.stringify(body)}`);
    }

    const fetchOptions = {
      method,
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en',
        'content-type': 'application/json',
        'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        'origin': 'https://bc.game',
        'referer': 'https://bc.game/bc',
        'Cookie': COOKIES,
      },
    };

    if (method === 'POST' && body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch (error) {
      const preview = responseText.slice(0, 500);
      logFile(`  Non-JSON response (${response.status} ${response.statusText}):\n${preview}`, 'ERROR');
      saveResponse(url, method, body, {
        error: 'NON_JSON_RESPONSE',
        status: response.status,
        statusText: response.statusText,
        body: preview,
      });
      throw new Error(`Non-JSON response from API (${response.status} ${response.statusText}): ${preview}`);
    }

    logFile(`  Response:\n${JSON.stringify(data, null, 2)}`);
    saveResponse(url, method, body, data);

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;

      if (response.status === 401 || response.status === 403) {
        errorMsg = `Authentication failed (HTTP ${response.status}). Your cookies may be expired or invalid.`;
        logFile(errorMsg, 'ERROR');
        logFile('How to fix: Get fresh cookies from bc.game and update .env', 'ERROR');
      }

      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    logFile(`API request failed to ${url}: ${error.message}`, 'ERROR');
    throw error;
  }
}

module.exports = { apiRequest };
