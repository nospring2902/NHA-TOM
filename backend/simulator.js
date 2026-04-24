const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const THINGSBOARD_BASE_URL = (
  process.env.THINGSBOARD_BASE_URL || 'http://127.0.0.1:9090'
).replace(/\/+$/, '');

const INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS || 5000);

// Fallback token list. You can edit directly for quick local tests.
const STATIC_ACCESS_TOKENS = ["LaQSXKgexmSdkS5fCkWj", "SHoW3rBot288omdKhea3"];

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

function buildPayload() {
  return {
    temperature: rand(25, 30),
    ph: rand(6.5, 8.5),
    dissolved_oxygen: rand(4, 7),
  };
}

async function sendTelemetry(token) {
  const payload = buildPayload();
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
