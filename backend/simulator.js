const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const THINGSBOARD_BASE_URL = (
  process.env.THINGSBOARD_BASE_URL || 'http://127.0.0.1:9090'
).replace(/\/+$/, '');

const INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS || 5000);
const BASE_LATITUDE = Number(process.env.SIMULATOR_BASE_LATITUDE || 9.1765);
const BASE_LONGITUDE = Number(process.env.SIMULATOR_BASE_LONGITUDE || 105.1524);
const OUTLIER_PROB = Number(process.env.SIMULATOR_OUTLIER_PROB || 0.05);

// Fallback token list. You can edit directly for quick local tests.
const STATIC_ACCESS_TOKENS = ["LaQSXKgexmSdkS5fCkWj", "SHoW3rBot288omdKhea3", "gKwHz7p2OOw239zWSXVu", "5VeI5emx9V6XPAEsI2DB"];

const STATIC_DEVICE_LOCATIONS = {
  LaQSXKgexmSdkS5fCkWj: { latitude: 9.183102, longitude: 105.161804 },
  SHoW3rBot288omdKhea3: { latitude: 9.168417, longitude: 105.146201 },
  gKwHz7p2OOw239zWSXVu: { latitude: 9.1765, longitude: 105.1524 },
};



function loadTokensFromFile() {
  const filePath = process.env.SIMULATOR_TOKENS_FILE;
  if (!filePath) {
    return [];
  }

  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    console.warn(`[simulator] Token file not found: ${absolutePath}`);
    return [];
  }

  try {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === 'string' && item.trim().length > 0);
    }

    if (parsed && Array.isArray(parsed.tokens)) {
      return parsed.tokens.filter((item) => typeof item === 'string' && item.trim().length > 0);
    }

    console.warn('[simulator] Token file format invalid. Use ["token1"] or {"tokens":[...]}');
    return [];
  } catch (error) {
    console.warn('[simulator] Failed to parse token file:', error.message);
    return [];
  }
}

function loadTokensFromEnv() {
  const envTokens = process.env.SIMULATOR_TOKENS;
  if (!envTokens) {
    return [];
  }

  return envTokens
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function uniqueTokens(tokens) {
  return Array.from(new Set(tokens));
}

function rand(min, max, precision = 2) {
  const value = min + Math.random() * (max - min);
  return Number(value.toFixed(precision));
}

function sampleWithOutlier(optMin, optMax, lowMin, lowMax, highMin, highMax, precision = 2) {
  const useOutlier = Math.random() < OUTLIER_PROB;
  if (!useOutlier) {
    return rand(optMin, optMax, precision);
  }

  const useLow = Math.random() < 0.5;
  return useLow ? rand(lowMin, lowMax, precision) : rand(highMin, highMax, precision);
}

function hashToken(token) {
  let hash = 0;

  for (let index = 0; index < token.length; index += 1) {
    hash = (hash << 5) - hash + token.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function resolveDeviceLocation(token) {
  const staticLocation = STATIC_DEVICE_LOCATIONS[token];
  if (staticLocation) {
    return staticLocation;
  }

  const seed = hashToken(token);
  const latitudeOffset = ((seed % 1400) - 700) / 10000;
  const longitudeOffset = ((Math.floor(seed / 1400) % 2000) - 1000) / 10000;

  return {
    latitude: Number((BASE_LATITUDE + latitudeOffset).toFixed(6)),
    longitude: Number((BASE_LONGITUDE + longitudeOffset).toFixed(6)),
  };
}

function buildPayload(token) {
  const location = resolveDeviceLocation(token);

  return {
    // Mostly keep values in ideal ranges, with rare outliers to trigger alerts.
    temperature: sampleWithOutlier(28, 30, 26.5, 27.5, 30.5, 32, 2),
    ph: sampleWithOutlier(7.8, 8.2, 7.2, 7.6, 8.4, 8.8, 2),
    dissolved_oxygen: sampleWithOutlier(5.5, 7.0, 4.6, 5.2, 7.2, 8.0, 2),
    salinity: sampleWithOutlier(15, 25, 10, 14, 26, 30, 1),
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

async function sendTelemetry(token) {
  const payload = buildPayload(token);
  const url = `${THINGSBOARD_BASE_URL}/api/v1/${token}/telemetry`;

  try {
    await axios.post(url, payload, {
      timeout: 8000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`[simulator] ${new Date().toISOString()} token=${token.slice(0, 6)}*** payload=${JSON.stringify(payload)}`);
  } catch (error) {
    const status = error.response?.status;
    const detail =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;

    console.error(
      `[simulator] failed token=${token.slice(0, 6)}*** status=${status || 'N/A'} detail=${detail}`,
    );
  }
}

async function run() {
  const tokens = uniqueTokens([
    ...STATIC_ACCESS_TOKENS,
    ...loadTokensFromEnv(),
    ...loadTokensFromFile(),
  ]);

  if (tokens.length === 0) {
    console.error('[simulator] No access tokens found.');
    console.error('[simulator] Provide tokens using one of these methods:');
    console.error('  1) Edit STATIC_ACCESS_TOKENS in simulator.js');
    console.error('  2) SIMULATOR_TOKENS=token1,token2');
    console.error('  3) SIMULATOR_TOKENS_FILE=./tokens.json');
    process.exit(1);
  }

  console.log(`[simulator] ThingsBoard URL: ${THINGSBOARD_BASE_URL}`);
  console.log(`[simulator] Tokens loaded: ${tokens.length}`);
  console.log(`[simulator] Sending telemetry every ${INTERVAL_MS}ms`);

  await Promise.allSettled(tokens.map((token) => sendTelemetry(token)));

  setInterval(() => {
    void Promise.allSettled(tokens.map((token) => sendTelemetry(token)));
  }, INTERVAL_MS);
}

void run();
