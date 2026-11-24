import type {
  AuctionFeedTable,
  LiveAuctionLotDetailResponse,
  LiveAuctionMetaResponse,
  LiveAuctionSearchResponse,
  LiveAuctionStatusResponse,
  SteeringType,
} from '../types/portal';

export interface LiveAuctionQuery {
  table?: AuctionFeedTable;
  make?: string;
  model?: string;
  auction?: string;
  yearMin?: string | number;
  yearMax?: string | number;
  grade?: string;
  steering?: SteeringType;
  lot?: string;
  chassis?: string;
  page?: number;
  jpyRate?: number;
}

export async function fetchAuctionStatus(): Promise<LiveAuctionStatusResponse> {
  try {
    const res = await fetch('/api/auction/status');
    const data = (await res.json()) as LiveAuctionStatusResponse;
    return data;
  } catch (err) {
    return {
      ok: false,
      source: 'https://auc.auziotraders.com',
      mode: 'unavailable',
      reachable: false,
      ajesApiConfigured: false,
      makesCount: 0,
      totalEstimatedLots: 0,
      checkedAt: new Date().toISOString(),
      message:
        err instanceof Error
          ? `Could not reach auction proxy (${err.message}).`
          : 'Could not reach auction proxy.',
    };
  }
}

export async function fetchAuctionMeta(): Promise<LiveAuctionMetaResponse> {
  try {
    const res = await fetch('/api/auction/meta');
    const data = (await res.json()) as LiveAuctionMetaResponse;
    return data;
  } catch (err) {
    return {
      ok: false,
      source: 'https://auc.auziotraders.com',
      mode: 'unavailable',
      makes: [],
      modelsByMake: {},
      auctions: [],
      totalEstimatedLots: 0,
      syncedAt: new Date().toISOString(),
      cached: false,
      message:
        err instanceof Error
          ? `Could not load auction catalog metadata (${err.message}).`
          : 'Could not load auction catalog metadata.',
    };
  }
}

export async function searchLiveAuctions(
  query: LiveAuctionQuery,
  signal?: AbortSignal
): Promise<LiveAuctionSearchResponse> {
  const params = new URLSearchParams();
  if (query.table === 'stats') params.set('table', 'stats');
  if (query.make && query.make !== 'ALL') params.set('make', query.make);
  if (query.model && query.model !== 'ALL') params.set('model', query.model);
  if (query.auction && query.auction !== 'ALL') params.set('auction', query.auction);
  if (query.yearMin) params.set('yearMin', String(query.yearMin));
  if (query.yearMax) params.set('yearMax', String(query.yearMax));
  if (query.grade) params.set('grade', query.grade);
  if (query.steering) params.set('steering', query.steering);
  if (query.lot) params.set('lot', query.lot);
  if (query.chassis) params.set('chassis', query.chassis);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.jpyRate) params.set('jpyRate', String(query.jpyRate));

  try {
    const res = await fetch(`/api/auction/search?${params.toString()}`, { signal });
    const data = (await res.json()) as LiveAuctionSearchResponse;
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    return {
      ok: false,
      source: 'https://auc.auziotraders.com',
      mode: 'unavailable',
      table: query.table || 'main',
      totalMatches: 0,
      page: query.page || 1,
      pageSize: 20,
      totalPages: 0,
      items: [],
      syncedAt: new Date().toISOString(),
      cached: false,
      message:
        err instanceof Error
          ? `Live auction search failed (${err.message}).`
          : 'Live auction search failed.',
    };
  }
}

export async function fetchLiveLotDetail(
  lotId: string,
  options?: { table?: AuctionFeedTable; jpyRate?: number }
): Promise<LiveAuctionLotDetailResponse> {
  try {
    const cleanId = encodeURIComponent(lotId.replace(/^auc-/, ''));
    const params = new URLSearchParams();
    if (options?.table === 'stats') params.set('table', 'stats');
    if (options?.jpyRate) params.set('jpyRate', String(options.jpyRate));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/auction/lot/${cleanId}${qs}`);
    return (await res.json()) as LiveAuctionLotDetailResponse;
  } catch (err) {
    return {
      ok: false,
      lotId,
      table: options?.table || 'main',
      images: [],
      fullImages: [],
      thumbnails: [],
      sourceUrl: 'https://auc.auziotraders.com',
      message: err instanceof Error ? err.message : 'Failed to fetch lot details.',
    };
  }
}
