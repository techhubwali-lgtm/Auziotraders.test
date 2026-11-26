import type { CarapisListingsResponse } from '../types/portal';

/**
 * Browser client for our server-side Carapis cache endpoints.
 * NEVER calls api.carapis.com directly — always calls our own Express backend.
 */
export async function fetchCachedDealerStock(
  signal?: AbortSignal
): Promise<CarapisListingsResponse> {
  const res = await fetch('/api/carapis/listings', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to load cached dealer stock (HTTP ${res.status})`);
  }
  return (await res.json()) as CarapisListingsResponse;
}

export async function triggerAdminCarapisSync(
  idToken: string
): Promise<{
  ok: boolean;
  skipped?: boolean;
  rateLimited?: boolean;
  pagesFetched: number;
  listingsStored: number;
  requestsUsedToday: number;
  dailyLimit: number;
  message: string;
}> {
  const res = await fetch('/api/carapis/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ force: true }),
  });
  return (await res.json()) as {
    ok: boolean;
    skipped?: boolean;
    rateLimited?: boolean;
    pagesFetched: number;
    listingsStored: number;
    requestsUsedToday: number;
    dailyLimit: number;
    message: string;
  };
}

export async function dispatchDealerStockInquiryEmail(payload: {
  carId: string;
  source: string;
  make: string;
  model: string;
  year: number;
  priceGbp: number;
  priceJpy: number;
  name: string;
  company: string;
  email: string;
  whatsapp: string;
  message: string;
  trackingCode?: string;
}): Promise<{ ok: boolean; emailDispatched: boolean; inquiryId: string }> {
  const res = await fetch('/api/carapis/inquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to send inquiry notification (HTTP ${res.status})`);
  }
  return (await res.json()) as { ok: boolean; emailDispatched: boolean; inquiryId: string };
}
