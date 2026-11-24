/**
 * Live International Exchange Rate Proxy for AUZIO TRADERS.
 *
 * Fetches real-time USD-based ISO 4217 rates from Open Exchange Rates (open.er-api.com),
 * caches them server-side for 60 minutes, and never fabricates or hardcodes fallback rates.
 * If the upstream FX service is unreachable, returns { ok: false, rates: { USD: 1 }, updatedAt: null }
 * so the frontend gracefully keeps original USD pricing with a transparent status indicator.
 */

export interface LiveExchangeRateResponse {
  ok: boolean;
  base: 'USD';
  rates: Record<string, number>;
  updatedAt: string | null;
  nextUpdateAt: string | null;
  provider: string;
  cached: boolean;
  message?: string;
}

const FX_API_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface FxCacheEntry {
  data: LiveExchangeRateResponse;
  expiresAt: number;
}

let fxCache: FxCacheEntry | null = null;

export async function getLiveExchangeRates(forceRefresh = false): Promise<LiveExchangeRateResponse> {
  const now = Date.now();
  if (!forceRefresh && fxCache && fxCache.expiresAt > now) {
    return {
      ...fxCache.data,
      cached: true,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(FX_API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AuzioTradersExportPortal/2.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`FX API HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      result?: string;
      base_code?: string;
      time_last_update_utc?: string;
      time_last_update_unix?: number;
      time_next_update_utc?: string;
      rates?: Record<string, unknown>;
    };

    if (payload.result !== 'success' || !payload.rates || typeof payload.rates !== 'object') {
      throw new Error('Unexpected exchange-rate API response format.');
    }

    const sanitizedRates: Record<string, number> = { USD: 1 };
    for (const [code, rawVal] of Object.entries(payload.rates)) {
      if (/^[A-Z]{3}$/.test(code) && typeof rawVal === 'number' && Number.isFinite(rawVal) && rawVal > 0) {
        sanitizedRates[code] = rawVal;
      }
    }

    const updatedAt = payload.time_last_update_unix
      ? new Date(payload.time_last_update_unix * 1000).toISOString()
      : payload.time_last_update_utc || new Date().toISOString();

    const result: LiveExchangeRateResponse = {
      ok: true,
      base: 'USD',
      rates: sanitizedRates,
      updatedAt,
      nextUpdateAt: payload.time_next_update_utc || null,
      provider: 'ExchangeRate-API (Open Access)',
      cached: false,
    };

    fxCache = {
      data: result,
      expiresAt: now + CACHE_TTL_MS,
    };

    return result;
  } catch (err) {
    // If we have a previously fetched live rate snapshot within 12 hours, return it clearly flagged;
    // otherwise return strictly { ok: false, rates: { USD: 1 } } with zero invented rates.
    if (fxCache && now - (fxCache.expiresAt - CACHE_TTL_MS) < 12 * 60 * 60 * 1000) {
      return {
        ...fxCache.data,
        cached: true,
        message: 'Showing last verified live FX snapshot while exchange-rate feed reconnects.',
      };
    }

    return {
      ok: false,
      base: 'USD',
      rates: { USD: 1 },
      updatedAt: null,
      nextUpdateAt: null,
      provider: 'ExchangeRate-API (Open Access)',
      cached: false,
      message:
        err instanceof Error
          ? `Live exchange rates temporarily unavailable (${err.message}). Displaying base USD prices.`
          : 'Live exchange rates temporarily unavailable. Displaying base USD prices.',
    };
  }
}
