const fs = require('fs');
const { log, logFile } = require('../utils/logger');
const { saveResponse } = require('../responses/tracker');

const COOKIES = process.env.BC_GAME_COOKIES;
const DEFAULT_BROWSER_PROFILE = 'chrome-macos';
const BROWSER_PROFILES = {
  'chrome-macos': {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    secChUaMobile: '?0',
    secChUaPlatform: '"macOS"',
  },
  'chrome-windows': {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    secChUaMobile: '?0',
    secChUaPlatform: '"Windows"',
  },
  'firefox-windows': {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0',
    accept: 'application/json, text/plain, /',
    secGpc: '1',
    secChUa: '',
    secChUaMobile: '',
    secChUaPlatform: '',
  },
};

let loggedBrowserProfile = false;

function getEnvValue(name, fallback) {
  if (Object.prototype.hasOwnProperty.call(process.env, name)) {
    return process.env[name].trim();
  }

  return fallback;
}

function addOptionalHeader(headers, name, value) {
  if (value) {
    headers[name] = value;
  }
}

function getCookieValue(name) {
  if (!COOKIES) {
    return '';
  }

  const match = COOKIES.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : '';
}

function getBrowserProfile() {
  const requestedProfile = process.env.BC_GAME_BROWSER_PROFILE || DEFAULT_BROWSER_PROFILE;
  const profile = BROWSER_PROFILES[requestedProfile];

  if (!profile) {
    logFile(`Unknown BC_GAME_BROWSER_PROFILE "${requestedProfile}", using ${DEFAULT_BROWSER_PROFILE}`, 'WARN');
    return { name: DEFAULT_BROWSER_PROFILE, ...BROWSER_PROFILES[DEFAULT_BROWSER_PROFILE] };
  }

  return { name: requestedProfile, ...profile };
}

function buildHeaders() {
  const profile = getBrowserProfile();
  const userAgent = getEnvValue('BC_GAME_USER_AGENT', profile.userAgent);
  const headers = {
    'accept': getEnvValue('BC_GAME_ACCEPT', profile.accept || 'application/json, text/plain, */*'),
    'accept-language': getEnvValue('BC_GAME_ACCEPT_LANGUAGE', 'en'),
    'content-type': 'application/json',
    'sec-fetch-dest': getEnvValue('BC_GAME_SEC_FETCH_DEST', 'empty'),
    'sec-fetch-mode': getEnvValue('BC_GAME_SEC_FETCH_MODE', 'cors'),
    'sec-fetch-site': getEnvValue('BC_GAME_SEC_FETCH_SITE', 'same-origin'),
    'user-agent': userAgent,
    'origin': getEnvValue('BC_GAME_ORIGIN', 'https://bc.game'),
    'referer': getEnvValue('BC_GAME_REFERER', 'https://bc.game/bc'),
    'Cookie': COOKIES,
  };

  addOptionalHeader(headers, 'sec-ch-ua', getEnvValue('BC_GAME_SEC_CH_UA', profile.secChUa));
  addOptionalHeader(headers, 'sec-ch-ua-mobile', getEnvValue('BC_GAME_SEC_CH_UA_MOBILE', profile.secChUaMobile));
  addOptionalHeader(headers, 'sec-ch-ua-platform', getEnvValue('BC_GAME_SEC_CH_UA_PLATFORM', profile.secChUaPlatform));
  addOptionalHeader(headers, 'sec-gpc', getEnvValue('BC_GAME_SEC_GPC', profile.secGpc || ''));
  addOptionalHeader(headers, 'smid', getEnvValue('BC_GAME_SMID', getCookieValue('smidV2') || getCookieValue('smid')));

  if (!loggedBrowserProfile) {
    log(`Using browser header profile: ${profile.name}`, 'INFO');
    logFile(`Using User-Agent: ${userAgent}`);
    loggedBrowserProfile = true;
  }

  return headers;
}

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
      headers: buildHeaders(),
      credentials: 'include',
      mode: 'cors',
      referrer: getEnvValue('BC_GAME_REFERER', 'https://bc.game/bc'),
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

    // Check for API error codes
    if (data && data.code !== 0 && data.code !== undefined) {
      const apiError = data.msg || `API error code ${data.code}`;
      logFile(`API returned error: code=${data.code}, msg=${apiError}, full_response=${JSON.stringify(data)}`, 'ERROR');
    }

    return data;
  } catch (error) {
    logFile(`API request failed to ${url}: ${error.message}`, 'ERROR');
    throw error;
  }
}

module.exports = { apiRequest };
