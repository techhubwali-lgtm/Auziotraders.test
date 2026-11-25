/**
 * Live Global Currency Exchange Rates Service (Server-Side)
 * Provider: ExchangeRate-API Open Access (https://www.exchangerate-api.com/docs/free)
 * Endpoints:
 *   - https://open.er-api.com/v6/latest/USD
 *   - https://open.er-api.com/v6/latest/JPY
 *
 * - Connects strictly to the real ExchangeRate-API endpoints (zero fake fallback rates).
 * - Automatically imports every ISO 4217 currency returned by the API.
 * - Caches live snapshots for 24 hours in server memory (paired with 24h Firestore cache on client).
 * - Preserves last live snapshot if the upstream API becomes temporarily unavailable.
 */

export interface ExchangeRateSnapshot {
  ok: boolean;
  base: 'USD';
  rates: Record<string, number>;
  jpyRates: Record<string, number>;
  supportedCount: number;
  updatedAt: string | null;
  nextUpdateAt: string | null;
  jpyUpdatedAt: string | null;
  provider: string;
  attributionUrl: string;
  attributionText: string;
  cached: boolean;
  stale: boolean;
  error?: string;
}

export interface ExchangeRateTestResult {
  ok: boolean;
  testedAt: string;
  latencyMs: number;
  usdEndpointOk: boolean;
  jpyEndpointOk: boolean;
  supportedCount: number;
  sampleUsdToJpy: number | null;
  sampleJpyToUsd: number | null;
  providerUpdatedAt: string | null;
  providerNextUpdateAt: string | null;
  error?: string;
}

interface ErApiPayload {
  result?: string;
  base_code?: string;
  time_last_update_utc?: string;
  time_last_update_unix?: number;
  time_next_update_utc?: string;
  time_next_update_unix?: number;
  rates?: Record<string, number>;
  'error-type'?: string;
}

const USD_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
const JPY_ENDPOINT = 'https://open.er-api.com/v6/latest/JPY';
const ATTRIBUTION_URL = 'https://www.exchangerate-api.com';
const ATTRIBUTION_TEXT = 'Rates By Exchange Rate API';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cachedSnapshot: ExchangeRateSnapshot | null = null;
let cachedAtMs = 0;

function sanitizeRatesMap(
  raw: Record<string, number> | undefined,
  baseCode: string
): Record<string, number> {
  const cleaned: Record<string, number> = { [baseCode]: 1 };
  if (!raw || typeof raw !== 'object') return cleaned;
  for (const [code, val] of Object.entries(raw)) {
    const upper = code.toUpperCase();
    if (/^[A-Z]{3}$/.test(upper) && typeof val === 'number' && Number.isFinite(val) && val > 0) {
      cleaned[upper] = val;
    }
  }
  return cleaned;
}

function parseProviderDate(utcString?: string, unixSec?: number): string | null {
  if (typeof unixSec === 'number' && Number.isFinite(unixSec) && unixSec > 0) {
    return new Date(unixSec * 1000).toISOString();
  }
  if (utcString) {
    const parsed = Date.parse(utcString);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

async function fetchErApiEndpoint(url: string): Promise<ErApiPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AuzioTraders-ExportPortal/2.0',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${url}`);
    }
    const json = (await res.json()) as ErApiPayload;
    if (json.result !== 'success' || !json.rates || typeof json.rates !== 'object') {
      throw new Error(json['error-type'] || `Invalid payload returned by ${url}`);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getLiveExchangeRates(forceRefresh = false): Promise<ExchangeRateSnapshot> {
  const now = Date.now();
  if (!forceRefresh && cachedSnapshot && now - cachedAtMs < CACHE_TTL_MS) {
    return { ...cachedSnapshot, cached: true, stale: false };
  }

  try {
    const [usdResult, jpyResult] = await Promise.allSettled([
      fetchErApiEndpoint(USD_ENDPOINT),
      fetchErApiEndpoint(JPY_ENDPOINT),
    ]);

    if (usdResult.status !== 'fulfilled') {
      throw usdResult.reason instanceof Error
        ? usdResult.reason
        : new Error('USD exchange rate endpoint failed.');
    }

    const usdJson = usdResult.value;
    const usdRates = sanitizeRatesMap(usdJson.rates, 'USD');

    let jpyRates: Record<string, number> = { JPY: 1 };
    let jpyUpdatedAt: string | null = null;
    if (jpyResult.status === 'fulfilled') {
      jpyRates = sanitizeRatesMap(jpyResult.value.rates, 'JPY');
      jpyUpdatedAt =
        parseProviderDate(
          jpyResult.value.time_last_update_utc,
          jpyResult.value.time_last_update_unix
        ) || new Date().toISOString();
    } else if (cachedSnapshot?.jpyRates && Object.keys(cachedSnapshot.jpyRates).length > 1) {
      jpyRates = cachedSnapshot.jpyRates;
      jpyUpdatedAt = cachedSnapshot.jpyUpdatedAt;
    }

    const updatedAt =
      parseProviderDate(usdJson.time_last_update_utc, usdJson.time_last_update_unix) ||
      new Date().toISOString();
    const nextUpdateAt =
      parseProviderDate(usdJson.time_next_update_utc, usdJson.time_next_update_unix) ||
      new Date(now + CACHE_TTL_MS).toISOString();

    const snapshot: ExchangeRateSnapshot = {
      ok: true,
      base: 'USD',
      rates: usdRates,
      jpyRates,
      supportedCount: Object.keys(usdRates).length,
      updatedAt,
      nextUpdateAt,
      jpyUpdatedAt,
      provider: 'ExchangeRate-API (open.er-api.com)',
      attributionUrl: ATTRIBUTION_URL,
      attributionText: ATTRIBUTION_TEXT,
      cached: false,
      stale: false,
      error:
        jpyResult.status === 'rejected'
          ? `JPY base endpoint warning: ${jpyResult.reason instanceof Error ? jpyResult.reason.message : 'unavailable'}`
          : undefined,
    };

    cachedSnapshot = snapshot;
    cachedAtMs = now;
    return snapshot;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to reach ExchangeRate-API';
    if (cachedSnapshot) {
      return {
        ...cachedSnapshot,
        cached: true,
        stale: true,
        error: `Using last saved rates — upstream temporarily unavailable (${message})`,
      };
    }

    return {
      ok: false,
      base: 'USD',
      rates: { USD: 1 },
      jpyRates: { JPY: 1 },
      supportedCount: 1,
      updatedAt: null,
      nextUpdateAt: null,
      jpyUpdatedAt: null,
      provider: 'ExchangeRate-API (open.er-api.com)',
      attributionUrl: ATTRIBUTION_URL,
      attributionText: ATTRIBUTION_TEXT,
      cached: false,
      stale: false,
      error: message,
    };
  }
}

export async function testExchangeRateConnection(): Promise<ExchangeRateTestResult> {
  const started = Date.now();
  const testedAt = new Date().toISOString();
  const [usdRes, jpyRes] = await Promise.allSettled([
    fetchErApiEndpoint(USD_ENDPOINT),
    fetchErApiEndpoint(JPY_ENDPOINT),
  ]);
  const latencyMs = Date.now() - started;

  const usdOk = usdRes.status === 'fulfilled';
  const jpyOk = jpyRes.status === 'fulfilled';

  if (!usdOk && !jpyOk) {
    const errMsg =
      usdRes.status === 'rejected' && usdRes.reason instanceof Error
        ? usdRes.reason.message
        : 'Both USD and JPY endpoints failed.';
    return {
      ok: false,
      testedAt,
      latencyMs,
      usdEndpointOk: false,
      jpyEndpointOk: false,
      supportedCount: 0,
      sampleUsdToJpy: null,
      sampleJpyToUsd: null,
      providerUpdatedAt: null,
      providerNextUpdateAt: null,
      error: errMsg,
    };
  }

  const usdJson = usdOk ? usdRes.value : null;
  const jpyJson = jpyOk ? jpyRes.value : null;
  const usdRates = usdJson ? sanitizeRatesMap(usdJson.rates, 'USD') : { USD: 1 };
  const jpyRates = jpyJson ? sanitizeRatesMap(jpyJson.rates, 'JPY') : { JPY: 1 };

  // Also refresh cache when both succeed
  if (usdOk && usdJson) {
    const updatedAt =
      parseProviderDate(usdJson.time_last_update_utc, usdJson.time_last_update_unix) || testedAt;
    const nextUpdateAt =
      parseProviderDate(usdJson.time_next_update_utc, usdJson.time_next_update_unix) ||
      new Date(Date.now() + CACHE_TTL_MS).toISOString();
    cachedSnapshot = {
      ok: true,
      base: 'USD',
      rates: usdRates,
      jpyRates,
      supportedCount: Object.keys(usdRates).length,
      updatedAt,
      nextUpdateAt,
      jpyUpdatedAt: jpyJson
        ? parseProviderDate(jpyJson.time_last_update_utc, jpyJson.time_last_update_unix) || testedAt
        : null,
      provider: 'ExchangeRate-API (open.er-api.com)',
      attributionUrl: ATTRIBUTION_URL,
      attributionText: ATTRIBUTION_TEXT,
      cached: false,
      stale: false,
    };
    cachedAtMs = Date.now();
  }

  return {
    ok: usdOk && jpyOk,
    testedAt,
    latencyMs,
    usdEndpointOk: usdOk,
    jpyEndpointOk: jpyOk,
    supportedCount: Object.keys(usdRates).length,
    sampleUsdToJpy: typeof usdRates.JPY === 'number' ? usdRates.JPY : null,
    sampleJpyToUsd: typeof jpyRates.USD === 'number' ? jpyRates.USD : null,
    providerUpdatedAt: usdJson
      ? parseProviderDate(usdJson.time_last_update_utc, usdJson.time_last_update_unix)
      : null,
    providerNextUpdateAt: usdJson
      ? parseProviderDate(usdJson.time_next_update_utc, usdJson.time_next_update_unix)
      : null,
    error: !usdOk
      ? `USD endpoint failed: ${usdRes.status === 'rejected' && usdRes.reason instanceof Error ? usdRes.reason.message : 'error'}`
      : !jpyOk
        ? `JPY endpoint failed: ${jpyRes.status === 'rejected' && jpyRes.reason instanceof Error ? jpyRes.reason.message : 'error'}`
        : undefined,
  };
}
