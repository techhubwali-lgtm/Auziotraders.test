import type {
  ExchangeRateCacheDoc,
  LiveExchangeRateState,
} from '../types/portal';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface ExchangeRateApiTestResult {
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

export async function fetchLiveExchangeRates(force = false): Promise<LiveExchangeRateState> {
  try {
    const url = force ? '/api/exchange-rates?refresh=1' : '/api/exchange-rates';
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = (await res.json()) as {
      ok?: boolean;
      base?: 'USD';
      rates?: Record<string, number>;
      jpyRates?: Record<string, number>;
      supportedCount?: number;
      updatedAt?: string | null;
      nextUpdateAt?: string | null;
      jpyUpdatedAt?: string | null;
      provider?: string;
      attributionUrl?: string;
      attributionText?: string;
      stale?: boolean;
      error?: string;
    };

    if (!res.ok || !data.ok || !data.rates) {
      return {
        ok: false,
        loading: false,
        base: 'USD',
        rates: { USD: 1 },
        rawRates: { USD: 1 },
        jpyRates: { JPY: 1 },
        supportedCount: 1,
        updatedAt: data.updatedAt ?? null,
        nextUpdateAt: data.nextUpdateAt ?? null,
        jpyUpdatedAt: data.jpyUpdatedAt ?? null,
        provider: data.provider || 'ExchangeRate-API (open.er-api.com)',
        attributionUrl: data.attributionUrl || 'https://www.exchangerate-api.com',
        attributionText: data.attributionText || 'Rates By Exchange Rate API',
        source: 'unavailable',
        stale: Boolean(data.stale),
        error: data.error || 'ExchangeRate-API temporarily unavailable.',
      };
    }

    const rawRates = { USD: 1, ...data.rates };
    const jpyRates = { JPY: 1, ...(data.jpyRates || {}) };

    return {
      ok: true,
      loading: false,
      base: 'USD',
      rates: rawRates,
      rawRates,
      jpyRates,
      supportedCount: data.supportedCount || Object.keys(rawRates).length,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      nextUpdateAt: data.nextUpdateAt ?? null,
      jpyUpdatedAt: data.jpyUpdatedAt ?? null,
      provider: data.provider || 'ExchangeRate-API (open.er-api.com)',
      attributionUrl: data.attributionUrl || 'https://www.exchangerate-api.com',
      attributionText: data.attributionText || 'Rates By Exchange Rate API',
      source: 'live_api',
      stale: Boolean(data.stale),
      error: data.error,
    };
  } catch (err) {
    return {
      ok: false,
      loading: false,
      base: 'USD',
      rates: { USD: 1 },
      rawRates: { USD: 1 },
      jpyRates: { JPY: 1 },
      supportedCount: 1,
      updatedAt: null,
      nextUpdateAt: null,
      jpyUpdatedAt: null,
      provider: 'ExchangeRate-API (open.er-api.com)',
      attributionUrl: 'https://www.exchangerate-api.com',
      attributionText: 'Rates By Exchange Rate API',
      source: 'unavailable',
      stale: false,
      error: err instanceof Error ? err.message : 'Network error loading exchange rates.',
    };
  }
}

export async function testExchangeRateApi(idToken: string): Promise<ExchangeRateApiTestResult> {
  const res = await fetch('/api/exchange-rates/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });
  const data = (await res.json()) as ExchangeRateApiTestResult;
  return data;
}

/**
 * Applies admin-configured global and per-currency percentage margins to raw USD-base FX rates.
 * USD itself always remains 1.00. Positive margin increases the local currency quote per $1 USD
 * to protect export FX spreads; negative values are also clamped safely within [-20%, +25%].
 */
export function applyExchangeMargins(
  rawRates: Record<string, number>,
  globalMarginPct = 0,
  currencyMargins: Record<string, number> = {}
): Record<string, number> {
  const result: Record<string, number> = { USD: 1 };
  const safeGlobal = Number.isFinite(globalMarginPct)
    ? Math.max(-20, Math.min(25, globalMarginPct))
    : 0;

  for (const [code, raw] of Object.entries(rawRates)) {
    const upper = code.toUpperCase();
    if (upper === 'USD') {
      result.USD = 1;
      continue;
    }
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) continue;

    const override = currencyMargins[upper];
    const effectiveMargin =
      typeof override === 'number' && Number.isFinite(override)
        ? Math.max(-20, Math.min(25, override))
        : safeGlobal;

    const adjusted = raw * (1 + effectiveMargin / 100);
    result[upper] = Number(adjusted.toFixed(6));
  }
  return result;
}

export function isFirestoreFxCacheStale(cache: ExchangeRateCacheDoc | null): boolean {
  if (!cache || !cache.updatedAt) return true;
  const ts = Date.parse(cache.updatedAt);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts >= CACHE_TTL_MS;
}
