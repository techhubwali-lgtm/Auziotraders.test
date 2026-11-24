import type { LiveExchangeRateState } from '../types/portal';

/**
 * Fetches live USD-based ISO 4217 exchange rates from the Express server proxy (/api/exchange-rates).
 * Never injects hardcoded or invented exchange rates on failure.
 */
export async function fetchLiveExchangeRates(forceRefresh = false): Promise<LiveExchangeRateState> {
  try {
    const url = forceRefresh ? '/api/exchange-rates?refresh=1' : '/api/exchange-rates';
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const data = (await res.json()) as {
      ok?: boolean;
      base?: 'USD';
      rates?: Record<string, number>;
      updatedAt?: string | null;
      provider?: string;
      message?: string;
    };

    if (!data || !data.rates || typeof data.rates !== 'object') {
      return {
        ok: false,
        loading: false,
        base: 'USD',
        rates: { USD: 1 },
        updatedAt: null,
        provider: 'ExchangeRate-API',
        message: 'Live exchange rates temporarily unavailable. Showing USD base pricing.',
      };
    }

    return {
      ok: Boolean(data.ok),
      loading: false,
      base: 'USD',
      rates: { USD: 1, ...data.rates },
      updatedAt: data.updatedAt || null,
      provider: data.provider || 'ExchangeRate-API',
      message: data.message,
    };
  } catch {
    return {
      ok: false,
      loading: false,
      base: 'USD',
      rates: { USD: 1 },
      updatedAt: null,
      provider: 'ExchangeRate-API',
      message: 'Live exchange-rate feed unreachable. Displaying verified USD values.',
    };
  }
}
