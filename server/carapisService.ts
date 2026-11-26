import fs from 'fs';
import path from 'path';

/**
 * Server-Side Carapis Japanese Dealer Stock Service & Daily Cache.
 *
 * Security & Quota Safeguards:
 * - Reads CARAPIS_API_KEY strictly from process.env (never exposed to browser).
 * - Verified Japan source slugs via GET /apix/api/sources/:
 *     "carsensor" (Carsensor), "goonet" (Goo-net), "goonet_exchange" (Goo-net Exchange).
 * - Verified live endpoint: GET https://api.carapis.com/apix/api/vehicles/
 * - Free plan limit is 100 requests/day -> hard server ceiling at 90 requests/day.
 * - Daily sync job runs ONCE every 24h and pulls max 30 pages total
 *   (up to 10 pages per source, trying page_size=50 then falling back to 20).
 * - Immediately stops on HTTP 429 ("rate_limit_exceeded"), preserves old cache, never loops.
 * - Strips original listing URLs, source photo URLs, and original dealer contact details
 *   before storing or returning any listing to the browser.
 */

export type CarapisSourceSlug = 'carsensor' | 'goonet' | 'goonet_exchange';

export interface CarapisInspectionInfo {
  passed?: boolean | null;
  verified?: boolean | null;
  sheetUrl?: string | null;
  summary?: string | null;
  rawDetails?: Record<string, unknown> | null;
}

export interface CarapisAccidentInfo {
  hasAccident: boolean | null;
  summary?: string | null;
  details?: string | null;
}

export interface CarapisPriceHistoryEntry {
  date: string;
  priceJpy: number;
  note?: string;
}

export interface CarapisPublicListing {
  id: string;
  source: CarapisSourceSlug;
  sourceLabel: 'Carsensor' | 'Goo-net' | 'Goo-net Exchange';
  make: string;
  model: string;
  trim: string;
  year: number;
  mileageKm: number | null;
  priceJpy: number;
  priceUsdRef: number | null;
  currency: 'JPY';
  location: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  color: string;
  photos: string[];
  inspectionSheet: CarapisInspectionInfo | null;
  accidentHistory: CarapisAccidentInfo | null;
  priceHistory: CarapisPriceHistoryEntry[] | null;
  isNewVehicle: boolean;
  lastSeenAt: string | null;
  cachedAt: string;
}

export interface CarapisCacheFile {
  version: number;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  dailyBudget: {
    date: string; // YYYY-MM-DD UTC
    requestsUsed: number;
    hardLimit: number;
  };
  sourceCounts: Record<CarapisSourceSlug, number>;
  lastSyncSummary: {
    status: 'idle' | 'ok' | 'partial_rate_limited' | 'error' | 'unconfigured';
    pagesFetched: number;
    listingsStored: number;
    rateLimited: boolean;
    message: string;
    finishedAt: string | null;
  };
  listings: CarapisPublicListing[];
}

export interface CarapisInquiryPayload {
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
}

const CARAPIS_VEHICLES_ENDPOINT = 'https://api.carapis.com/apix/api/vehicles/';
const CARAPIS_SOURCES_ENDPOINT = 'https://api.carapis.com/apix/api/sources/';

const JAPAN_SOURCES: Array<{
  slug: CarapisSourceSlug;
  label: 'Carsensor' | 'Goo-net' | 'Goo-net Exchange';
}> = [
  { slug: 'carsensor', label: 'Carsensor' },
  { slug: 'goonet', label: 'Goo-net' },
  { slug: 'goonet_exchange', label: 'Goo-net Exchange' },
];

const DAILY_HARD_REQUEST_LIMIT = 90; // Safety margin below 100/day free plan cap
const MAX_PAGES_PER_SYNC = 30; // Max 30 pages total per daily sync
const MAX_PAGES_PER_SOURCE = 10; // 10 pages x 3 sources = 30 pages max
const PREFERRED_PAGE_SIZE = 50;
const FALLBACK_PAGE_SIZE = 20;
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CACHE_FILE_PATH = path.join(DATA_DIR, 'carapis-cache.json');
const INQUIRIES_LOG_PATH = path.join(DATA_DIR, 'carapis-inquiries.json');

let memoryCache: CarapisCacheFile | null = null;
let syncInProgress = false;
let schedulerStarted = false;

function getUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getApiKey(): string {
  return (process.env.CARAPIS_API_KEY || '').trim();
}

function createEmptyCache(): CarapisCacheFile {
  return {
    version: 1,
    lastSyncedAt: null,
    nextSyncAt: null,
    dailyBudget: {
      date: getUtcDateKey(),
      requestsUsed: 0,
      hardLimit: DAILY_HARD_REQUEST_LIMIT,
    },
    sourceCounts: {
      carsensor: 0,
      goonet: 0,
      goonet_exchange: 0,
    },
    lastSyncSummary: {
      status: getApiKey() ? 'idle' : 'unconfigured',
      pagesFetched: 0,
      listingsStored: 0,
      rateLimited: false,
      message: getApiKey()
        ? 'Waiting for initial daily Carapis cache sync.'
        : 'CARAPIS_API_KEY environment variable is not configured on the server.',
      finishedAt: null,
    },
    listings: [],
  };
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadCacheFromDisk(): CarapisCacheFile {
  if (memoryCache) {
    rolloverBudgetIfNewDay(memoryCache);
    return memoryCache;
  }
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as CarapisCacheFile;
      if (parsed && Array.isArray(parsed.listings)) {
        rolloverBudgetIfNewDay(parsed);
        memoryCache = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Carapis] Failed to read cache file; starting with empty cache:', (err as Error).message);
  }
  memoryCache = createEmptyCache();
  return memoryCache;
}

function saveCacheToDisk(cache: CarapisCacheFile): void {
  memoryCache = cache;
  try {
    ensureDataDir();
    const tmpPath = `${CACHE_FILE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(cache, null, 2), 'utf-8');
    fs.renameSync(tmpPath, CACHE_FILE_PATH);
  } catch (err) {
    console.error('[Carapis] Failed to persist cache to disk:', (err as Error).message);
  }
}

function rolloverBudgetIfNewDay(cache: CarapisCacheFile): void {
  const today = getUtcDateKey();
  if (!cache.dailyBudget || cache.dailyBudget.date !== today) {
    cache.dailyBudget = {
      date: today,
      requestsUsed: 0,
      hardLimit: DAILY_HARD_REQUEST_LIMIT,
    };
  } else {
    cache.dailyBudget.hardLimit = DAILY_HARD_REQUEST_LIMIT;
  }
}

function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1000) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Only keeps Carapis-hosted media URLs (never original source dealer URLs like
 * carsensor.net or goo-net.com) to guarantee original source URLs stay hidden.
 */
function extractSanitizedPhotos(raw: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const pushSafePhoto = (candidate: unknown) => {
    if (!isSafeHttpUrl(candidate)) return;
    const lower = candidate.toLowerCase();
    // Never expose direct original marketplace photo URLs if CDN proxy URL exists
    if (seen.has(candidate)) return;
    if (
      lower.includes('carsensor.net') ||
      lower.includes('goo-net.com') ||
      lower.includes('goonet-exchange.com')
    ) {
      return;
    }
    seen.add(candidate);
    urls.push(candidate);
  };

  if (Array.isArray(raw.photos)) {
    for (const entry of raw.photos) {
      if (typeof entry === 'string') {
        pushSafePhoto(entry);
      } else if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        pushSafePhoto(obj.url);
        if (!obj.url) pushSafePhoto(obj.thumb_url);
      }
    }
  }

  if (urls.length === 0 && raw.thumb && typeof raw.thumb === 'object') {
    const thumbObj = raw.thumb as Record<string, unknown>;
    pushSafePhoto(thumbObj.url);
    if (!thumbObj.url) pushSafePhoto(thumbObj.thumb_url);
  }

  return urls.slice(0, 24);
}

function formatEnumLabel(val: unknown, fallback: string): string {
  if (typeof val !== 'string' || !val.trim()) return fallback;
  const normalized = val.trim().toLowerCase();
  const map: Record<string, string> = {
    gasoline: 'Petrol',
    petrol: 'Petrol',
    hybrid: 'Hybrid',
    diesel: 'Diesel',
    electric: 'Electric',
    ev: 'Electric',
    phev: 'Plug-in Hybrid',
    cvt: 'CVT',
    auto: 'Automatic',
    automatic: 'Automatic',
    at: 'Automatic',
    manual: 'Manual',
    mt: 'Manual',
    suv: 'SUV',
    sedan: 'Sedan',
    hatchback: 'Hatchback',
    coupe: 'Coupe',
    wagon: 'Wagon',
    minivan: 'Minivan',
    van: 'Van',
    pickup: 'Pickup',
    convertible: 'Convertible',
    kei: 'Kei Car',
  };
  if (map[normalized]) return map[normalized];
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseJpyPrice(raw: Record<string, unknown>): number {
  const origCurrency = String(raw.price_original_currency || raw.currency || '').toUpperCase();
  const origPrice = Number(raw.price_original);
  if (origCurrency === 'JPY' && Number.isFinite(origPrice) && origPrice > 0) {
    return Math.round(origPrice);
  }
  const directPrice = Number(raw.price);
  if ((origCurrency === 'JPY' || !origCurrency) && Number.isFinite(directPrice) && directPrice > 50000) {
    return Math.round(directPrice);
  }
  // If only USD reference price exists, estimate JPY conservatively using 154 JPY/USD
  const usdRef = Number(raw.price_usd);
  if (Number.isFinite(usdRef) && usdRef > 0) {
    return Math.round(usdRef * 154);
  }
  return 0;
}

function sanitizeInspectionSheet(raw: Record<string, unknown>): CarapisInspectionInfo | null {
  const rawSheet = raw.inspection_sheet;
  const isVerified = typeof raw.is_verified === 'boolean' ? raw.is_verified : null;
  const inspectionPassed =
    typeof raw.inspection_passed === 'boolean' ? raw.inspection_passed : null;

  if (!rawSheet && isVerified === null && inspectionPassed === null) {
    return null;
  }

  if (typeof rawSheet === 'string' && rawSheet.trim()) {
    const trimmedSheet: string = rawSheet.trim();
    const isUrl: boolean = isSafeHttpUrl(trimmedSheet);
    return {
      passed: inspectionPassed,
      verified: isVerified,
      sheetUrl: isUrl ? trimmedSheet : null,
      summary: isUrl ? 'Inspection sheet attached' : trimmedSheet.slice(0, 400),
      rawDetails: null,
    };
  }

  if (rawSheet && typeof rawSheet === 'object' && !Array.isArray(rawSheet)) {
    const sheetObj = rawSheet as Record<string, unknown>;
    // Strip any URL/dealer contact keys that might exist inside inspection_sheet
    const cleanDetails: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sheetObj)) {
      const lower = k.toLowerCase();
      if (
        lower.includes('dealer') ||
        lower.includes('phone') ||
        lower.includes('email') ||
        lower.includes('contact') ||
        lower.includes('source_url') ||
        lower === 'url'
      ) {
        continue;
      }
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        cleanDetails[k] = v;
      }
    }
    return {
      passed: inspectionPassed,
      verified: isVerified,
      sheetUrl: isSafeHttpUrl(sheetObj.image_url) ? sheetObj.image_url : null,
      summary:
        typeof sheetObj.summary === 'string'
          ? sheetObj.summary.slice(0, 400)
          : typeof sheetObj.grade === 'string'
            ? `Inspection Grade: ${sheetObj.grade}`
            : 'Inspection details available',
      rawDetails: Object.keys(cleanDetails).length > 0 ? cleanDetails : null,
    };
  }

  return {
    passed: inspectionPassed,
    verified: isVerified,
    sheetUrl: null,
    summary: isVerified
      ? 'Verified marketplace listing'
      : inspectionPassed === true
        ? 'Inspection passed'
        : null,
    rawDetails: null,
  };
}

function sanitizeAccidentHistory(raw: Record<string, unknown>): CarapisAccidentInfo | null {
  const hasAccident =
    typeof raw.has_accident === 'boolean' ? raw.has_accident : null;
  const rawHistory = raw.accident_history;

  if (hasAccident === null && !rawHistory) {
    return null;
  }

  if (typeof rawHistory === 'string' && rawHistory.trim()) {
    return {
      hasAccident,
      summary: rawHistory.trim().slice(0, 300),
      details: rawHistory.trim().slice(0, 600),
    };
  }

  if (rawHistory && typeof rawHistory === 'object') {
    const obj = rawHistory as Record<string, unknown>;
    return {
      hasAccident:
        typeof obj.has_accident === 'boolean' ? obj.has_accident : hasAccident,
      summary:
        typeof obj.summary === 'string'
          ? obj.summary.slice(0, 300)
          : hasAccident === false
            ? 'No accident history reported'
            : hasAccident === true
              ? 'Repair / accident history noted'
              : null,
      details: typeof obj.details === 'string' ? obj.details.slice(0, 600) : null,
    };
  }

  return {
    hasAccident,
    summary:
      hasAccident === false
        ? 'No accident history reported'
        : hasAccident === true
          ? 'Repair / accident history noted'
          : null,
  };
}

function sanitizePriceHistory(raw: Record<string, unknown>): CarapisPriceHistoryEntry[] | null {
  if (!Array.isArray(raw.price_history) || raw.price_history.length === 0) {
    return null;
  }
  const entries: CarapisPriceHistoryEntry[] = [];
  for (const item of raw.price_history) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const price = Number(obj.price_jpy ?? obj.price_original ?? obj.price);
    const date = typeof obj.date === 'string' ? obj.date : typeof obj.recorded_at === 'string' ? obj.recorded_at : '';
    if (Number.isFinite(price) && price > 0 && date) {
      entries.push({
        date: date.slice(0, 32),
        priceJpy: Math.round(price),
        note: typeof obj.note === 'string' ? obj.note.slice(0, 120) : undefined,
      });
    }
  }
  return entries.length > 0 ? entries.slice(0, 20) : null;
}

/**
 * Strictly maps raw Carapis vehicle payload into a sanitized public listing.
 * Explicitly drops: url, source_url, dealer, dealer_name, dealer_phone, dealer_email,
 * dealer_address, original_url, and any contact details.
 */
function normalizeCarapisVehicle(
  raw: Record<string, unknown>,
  sourceSlug: CarapisSourceSlug,
  sourceLabel: 'Carsensor' | 'Goo-net' | 'Goo-net Exchange',
  cachedAt: string
): CarapisPublicListing | null {
  const id = String(raw.id || '').trim();
  const make = String(raw.brand_name || raw.make || '').trim();
  const model = String(raw.model_name || raw.model || '').trim();
  const year = Number(raw.year);
  const priceJpy = parseJpyPrice(raw);

  if (!id || !make || !model || !Number.isFinite(year) || year < 1970 || priceJpy <= 0) {
    return null;
  }

  const trim = typeof raw.trim === 'string' ? raw.trim.trim().slice(0, 120) : '';
  const mileageRaw = Number(raw.mileage);
  const mileageKm =
    raw.mileage !== null && raw.mileage !== undefined && Number.isFinite(mileageRaw) && mileageRaw >= 0
      ? Math.round(mileageRaw)
      : null;

  const sourceLoc =
    raw.source_location && typeof raw.source_location === 'object'
      ? (raw.source_location as Record<string, unknown>)
      : null;
  const locationRaw =
    (typeof raw.region === 'string' && raw.region.trim()) ||
    (sourceLoc && typeof sourceLoc.region_text === 'string' && sourceLoc.region_text.trim()) ||
    (typeof raw.location === 'string' && raw.location.trim()) ||
    'Japan';

  const priceUsdVal = Number(raw.price_usd);

  return {
    id,
    source: sourceSlug,
    sourceLabel,
    make: make.slice(0, 80),
    model: model.slice(0, 100),
    trim,
    year: Math.round(year),
    mileageKm,
    priceJpy,
    priceUsdRef: Number.isFinite(priceUsdVal) && priceUsdVal > 0 ? Math.round(priceUsdVal) : null,
    currency: 'JPY',
    location: locationRaw.slice(0, 120),
    fuelType: formatEnumLabel(raw.fuel_type, 'Petrol'),
    transmission: formatEnumLabel(raw.transmission, 'Automatic'),
    bodyType: formatEnumLabel(raw.body_type, 'Vehicle'),
    color: formatEnumLabel(raw.color, 'Not specified'),
    photos: extractSanitizedPhotos(raw),
    inspectionSheet: sanitizeInspectionSheet(raw),
    accidentHistory: sanitizeAccidentHistory(raw),
    priceHistory: sanitizePriceHistory(raw),
    isNewVehicle: Boolean(raw.is_new_vehicle),
    lastSeenAt: typeof raw.last_seen_at === 'string' ? raw.last_seen_at : null,
    cachedAt,
  };
}

/**
 * Verifies the live Japan source slugs from Carapis once (if budget permits).
 */
export async function verifyCarapisJapanSources(): Promise<{
  ok: boolean;
  slugs: string[];
  error?: string;
}> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, slugs: [], error: 'CARAPIS_API_KEY not configured.' };
  }
  const cache = loadCacheFromDisk();
  rolloverBudgetIfNewDay(cache);
  if (cache.dailyBudget.requestsUsed >= DAILY_HARD_REQUEST_LIMIT) {
    return {
      ok: false,
      slugs: [],
      error: `Daily Carapis safety limit reached (${cache.dailyBudget.requestsUsed}/${DAILY_HARD_REQUEST_LIMIT}).`,
    };
  }

  cache.dailyBudget.requestsUsed += 1;
  saveCacheToDisk(cache);

  const res = await fetch(CARAPIS_SOURCES_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (res.status === 429) {
    console.warn('[Carapis] HTTP 429 rate_limit_exceeded during source verification. Stopping.');
    return { ok: false, slugs: [], error: 'rate_limit_exceeded (429)' };
  }

  if (!res.ok) {
    return { ok: false, slugs: [], error: `HTTP ${res.status}` };
  }

  const data = (await res.json()) as unknown;
  const list = Array.isArray(data) ? data : [];
  const jpSlugs = list
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object' && (item as Record<string, unknown>).region === 'japan')
    )
    .map((item) => String(item.code || ''));

  return { ok: true, slugs: jpSlugs };
}

/**
 * Runs the daily Carapis cache sync job.
 * - Pulls max 30 pages total across carsensor, goonet, and goonet_exchange (10 pages each).
 * - Tries page_size=50 first; falls back to page_size=20 if the API rejects 50.
 * - Stops immediately if daily requests reach 90 OR on HTTP 429 (never retries in a loop).
 * - Keeps previous cached listings intact if a 429 or upstream error occurs.
 */
export async function syncCarapisDealerStock(options?: {
  force?: boolean;
  maxPagesPerSource?: number;
}): Promise<{
  ok: boolean;
  skipped?: boolean;
  rateLimited?: boolean;
  pagesFetched: number;
  listingsStored: number;
  requestsUsedToday: number;
  dailyLimit: number;
  message: string;
}> {
  const cache = loadCacheFromDisk();
  rolloverBudgetIfNewDay(cache);

  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      skipped: true,
      pagesFetched: 0,
      listingsStored: cache.listings.length,
      requestsUsedToday: cache.dailyBudget.requestsUsed,
      dailyLimit: DAILY_HARD_REQUEST_LIMIT,
      message:
        'CARAPIS_API_KEY is not configured on the server. Serving existing saved cache if available.',
    };
  }

  if (syncInProgress) {
    return {
      ok: true,
      skipped: true,
      pagesFetched: 0,
      listingsStored: cache.listings.length,
      requestsUsedToday: cache.dailyBudget.requestsUsed,
      dailyLimit: DAILY_HARD_REQUEST_LIMIT,
      message: 'A Carapis sync job is already running.',
    };
  }

  // Skip if cache is fresh (< 24h old) and not forced
  if (!options?.force && cache.lastSyncedAt && cache.listings.length > 0) {
    const ageMs = Date.now() - Date.parse(cache.lastSyncedAt);
    if (!Number.isNaN(ageMs) && ageMs < SYNC_INTERVAL_MS) {
      return {
        ok: true,
        skipped: true,
        pagesFetched: 0,
        listingsStored: cache.listings.length,
        requestsUsedToday: cache.dailyBudget.requestsUsed,
        dailyLimit: DAILY_HARD_REQUEST_LIMIT,
        message: 'Carapis cache is fresh (< 24h old). Serving saved cache.',
      };
    }
  }

  if (cache.dailyBudget.requestsUsed >= DAILY_HARD_REQUEST_LIMIT) {
    const msg = `Daily Carapis request safety ceiling reached (${cache.dailyBudget.requestsUsed}/${DAILY_HARD_REQUEST_LIMIT}). Preserving existing cache.`;
    console.warn(`[Carapis] ${msg}`);
    return {
      ok: false,
      skipped: true,
      rateLimited: true,
      pagesFetched: 0,
      listingsStored: cache.listings.length,
      requestsUsedToday: cache.dailyBudget.requestsUsed,
      dailyLimit: DAILY_HARD_REQUEST_LIMIT,
      message: msg,
    };
  }

  syncInProgress = true;
  const cachedAt = new Date().toISOString();
  const perSourceLimit = Math.min(
    MAX_PAGES_PER_SOURCE,
    Math.max(1, options?.maxPagesPerSource ?? MAX_PAGES_PER_SOURCE)
  );

  let totalPagesFetched = 0;
  let rateLimited = false;
  let pageSize = PREFERRED_PAGE_SIZE;
  const fetchedById = new Map<string, CarapisPublicListing>();
  const sourceCounts: Record<CarapisSourceSlug, number> = {
    carsensor: 0,
    goonet: 0,
    goonet_exchange: 0,
  };

  try {
    outerLoop: for (const src of JAPAN_SOURCES) {
      for (let page = 1; page <= perSourceLimit; page += 1) {
        if (totalPagesFetched >= MAX_PAGES_PER_SYNC) {
          break outerLoop;
        }
        if (cache.dailyBudget.requestsUsed >= DAILY_HARD_REQUEST_LIMIT) {
          console.warn(
            `[Carapis] Reached daily safety limit (${DAILY_HARD_REQUEST_LIMIT}). Stopping sync cleanly.`
          );
          break outerLoop;
        }

        const buildUrl = (ps: number) =>
          `${CARAPIS_VEHICLES_ENDPOINT}?source=${encodeURIComponent(src.slug)}&available_only=true&page=${page}&page_size=${ps}`;

        cache.dailyBudget.requestsUsed += 1;
        let res: Response;
        try {
          res = await fetch(buildUrl(pageSize), {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(15000),
          });
        } catch (netErr) {
          console.warn(
            `[Carapis] Network error fetching ${src.slug} page ${page}:`,
            (netErr as Error).message
          );
          break;
        }

        // Fallback from page_size=50 to page_size=20 if API rejects 50
        if (
          res.status === 400 &&
          pageSize === PREFERRED_PAGE_SIZE &&
          cache.dailyBudget.requestsUsed < DAILY_HARD_REQUEST_LIMIT
        ) {
          pageSize = FALLBACK_PAGE_SIZE;
          cache.dailyBudget.requestsUsed += 1;
          res = await fetch(buildUrl(pageSize), {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(15000),
          });
        }

        // Strict HTTP 429 handling: stop immediately, keep old cache, never retry in a loop
        if (res.status === 429) {
          rateLimited = true;
          console.warn(
            `[Carapis] HTTP 429 rate_limit_exceeded on ${src.slug} page ${page}. Stopping immediately and preserving existing cache.`
          );
          break outerLoop;
        }

        if (!res.ok) {
          console.warn(`[Carapis] HTTP ${res.status} on ${src.slug} page ${page}. Stopping source.`);
          break;
        }

        const payload = (await res.json()) as {
          results?: unknown[];
          has_next?: boolean;
          count?: number;
        };

        totalPagesFetched += 1;
        const rows = Array.isArray(payload.results) ? payload.results : [];
        for (const item of rows) {
          if (!item || typeof item !== 'object') continue;
          const normalized = normalizeCarapisVehicle(
            item as Record<string, unknown>,
            src.slug,
            src.label,
            cachedAt
          );
          if (normalized && !fetchedById.has(normalized.id)) {
            fetchedById.set(normalized.id, normalized);
            sourceCounts[src.slug] += 1;
          }
        }

        if (rows.length === 0 || payload.has_next === false) {
          break;
        }
      }
    }

    const newListings = Array.from(fetchedById.values());

    // Sort listings so vehicles with verified Carapis photos appear first, then newest year
    newListings.sort((a, b) => {
      const aHasPhotos = a.photos.length > 0 ? 1 : 0;
      const bHasPhotos = b.photos.length > 0 ? 1 : 0;
      if (bHasPhotos !== aHasPhotos) return bHasPhotos - aHasPhotos;
      return b.year - a.year;
    });

    if (newListings.length > 0) {
      // Only replace stored cache if we successfully fetched real listings (preserves old cache on 429/0 results)
      cache.listings = newListings;
      cache.sourceCounts = sourceCounts;
      cache.lastSyncedAt = cachedAt;
      cache.nextSyncAt = new Date(Date.now() + SYNC_INTERVAL_MS).toISOString();
      cache.lastSyncSummary = {
        status: rateLimited ? 'partial_rate_limited' : 'ok',
        pagesFetched: totalPagesFetched,
        listingsStored: newListings.length,
        rateLimited,
        message: rateLimited
          ? `Synced ${newListings.length} vehicles across ${totalPagesFetched} pages before hitting HTTP 429 rate limit.`
          : `Synced ${newListings.length} Japanese dealer vehicles across ${totalPagesFetched} pages (Carsensor: ${sourceCounts.carsensor}, Goo-net: ${sourceCounts.goonet}, Goo-net Exchange: ${sourceCounts.goonet_exchange}).`,
        finishedAt: new Date().toISOString(),
      };
      saveCacheToDisk(cache);
      return {
        ok: true,
        rateLimited,
        pagesFetched: totalPagesFetched,
        listingsStored: newListings.length,
        requestsUsedToday: cache.dailyBudget.requestsUsed,
        dailyLimit: DAILY_HARD_REQUEST_LIMIT,
        message: cache.lastSyncSummary.message,
      };
    }

    // If 429 or upstream failure happened before any items were retrieved, preserve old cache!
    cache.lastSyncSummary = {
      status: rateLimited ? 'partial_rate_limited' : 'error',
      pagesFetched: totalPagesFetched,
      listingsStored: cache.listings.length,
      rateLimited,
      message: rateLimited
        ? 'Carapis returned HTTP 429 (rate_limit_exceeded). Existing cached listings were preserved.'
        : 'Carapis sync returned 0 listings. Existing cached listings were preserved.',
      finishedAt: new Date().toISOString(),
    };
    saveCacheToDisk(cache);

    return {
      ok: false,
      rateLimited,
      pagesFetched: totalPagesFetched,
      listingsStored: cache.listings.length,
      requestsUsedToday: cache.dailyBudget.requestsUsed,
      dailyLimit: DAILY_HARD_REQUEST_LIMIT,
      message: cache.lastSyncSummary.message,
    };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Returns ONLY the cached, sanitized listings from disk/memory.
 * NEVER triggers an upstream Carapis request on browser page visits.
 */
export function getCachedCarapisListings(): {
  ok: boolean;
  configured: boolean;
  listings: CarapisPublicListing[];
  totalCached: number;
  sourceCounts: Record<CarapisSourceSlug, number>;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  requestsUsedToday: number;
  dailyLimit: number;
  syncStatus: CarapisCacheFile['lastSyncSummary'];
} {
  const cache = loadCacheFromDisk();
  return {
    ok: true,
    configured: Boolean(getApiKey()),
    listings: cache.listings,
    totalCached: cache.listings.length,
    sourceCounts: cache.sourceCounts,
    lastSyncedAt: cache.lastSyncedAt,
    nextSyncAt: cache.nextSyncAt,
    requestsUsedToday: cache.dailyBudget.requestsUsed,
    dailyLimit: cache.dailyBudget.hardLimit,
    syncStatus: cache.lastSyncSummary,
  };
}

/**
 * Starts the daily Carapis background sync scheduler (runs once on boot if cache is
 * missing or >24h old, then once every 24 hours).
 */
export function startCarapisDailyScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const cache = loadCacheFromDisk();
  const apiKey = getApiKey();

  if (apiKey) {
    const ageMs = cache.lastSyncedAt ? Date.now() - Date.parse(cache.lastSyncedAt) : Infinity;
    if (cache.listings.length === 0 || Number.isNaN(ageMs) || ageMs >= SYNC_INTERVAL_MS) {
      // Run non-blocking on startup so Express binds port 3000 immediately
      setTimeout(() => {
        void syncCarapisDealerStock({ force: false }).then((res) => {
          console.log(`[Carapis] Startup sync: ${res.message}`);
        });
      }, 2500).unref();
    }
  } else {
    console.log(
      `[Carapis] Serving ${cache.listings.length} cached Japanese dealer vehicles (CARAPIS_API_KEY not set in env).`
    );
  }

  const timer = setInterval(() => {
    void syncCarapisDealerStock({ force: false }).then((res) => {
      if (!res.skipped) {
        console.log(`[Carapis] Daily scheduled sync: ${res.message}`);
      }
    });
  }, SYNC_INTERVAL_MS);
  timer.unref();
}

/**
 * Records a Dealer Stock inquiry on the server and dispatches an email notification
 * if RESEND_API_KEY / INQUIRY_WEBHOOK_URL is configured in server environment variables.
 */
export async function recordAndNotifyCarapisInquiry(
  payload: CarapisInquiryPayload
): Promise<{ ok: boolean; emailDispatched: boolean; inquiryId: string }> {
  const inquiryId = `CAR-INQ-${Date.now().toString(36).toUpperCase()}`;
  const receivedAt = new Date().toISOString();

  const record = {
    inquiryId,
    receivedAt,
    carId: payload.carId,
    source: payload.source,
    make: payload.make,
    model: payload.model,
    year: payload.year,
    priceGbp: payload.priceGbp,
    priceJpy: payload.priceJpy,
    name: payload.name,
    company: payload.company,
    email: payload.email,
    whatsapp: payload.whatsapp,
    message: payload.message,
    trackingCode: payload.trackingCode || '',
  };

  // Persist server-side backup log in data/carapis-inquiries.json
  try {
    ensureDataDir();
    let existing: unknown[] = [];
    if (fs.existsSync(INQUIRIES_LOG_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(INQUIRIES_LOG_PATH, 'utf-8'));
      if (Array.isArray(parsed)) existing = parsed;
    }
    existing.unshift(record);
    fs.writeFileSync(INQUIRIES_LOG_PATH, JSON.stringify(existing.slice(0, 500), null, 2), 'utf-8');
  } catch (err) {
    console.error('[Carapis] Failed to write inquiry backup log:', (err as Error).message);
  }

  let emailDispatched = false;
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  const salesEmail = (process.env.SALES_INQUIRY_EMAIL || 'sales@auziotraders.com').trim();
  const fromEmail = (process.env.RESEND_FROM_EMAIL || 'Auzio Traders <inquiries@auziotraders.com>').trim();

  if (resendKey) {
    try {
      const emailBody = [
        `New Japanese Dealer Stock Inquiry (${inquiryId})`,
        ``,
        `Vehicle Details:`,
        `- Car ID: ${record.carId}`,
        `- Source: ${record.source}`,
        `- Vehicle: ${record.year} ${record.make} ${record.model}`,
        `- Quoted Landed UK Price: £${record.priceGbp.toLocaleString('en-GB')} (Original: ¥${record.priceJpy.toLocaleString('en-US')})`,
        record.trackingCode ? `- Portal Reference: ${record.trackingCode}` : '',
        ``,
        `Buyer Contact:`,
        `- Name: ${record.name}`,
        `- Company: ${record.company || 'N/A'}`,
        `- Email: ${record.email}`,
        `- WhatsApp: ${record.whatsapp || 'N/A'}`,
        ``,
        `Message:`,
        record.message || '(No additional message provided)',
      ]
        .filter(Boolean)
        .join('\n');

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [salesEmail],
          reply_to: record.email,
          subject: `[Dealer Stock Inquiry] ${record.year} ${record.make} ${record.model} (${record.source})`,
          text: emailBody,
        }),
        signal: AbortSignal.timeout(10000),
      });
      emailDispatched = emailRes.ok;
      if (!emailRes.ok) {
        console.warn('[Carapis] Resend email dispatch returned HTTP', emailRes.status);
      }
    } catch (err) {
      console.warn('[Carapis] Email dispatch error:', (err as Error).message);
    }
  } else {
    console.log(
      `[Carapis Inquiry] ${inquiryId} | ${record.year} ${record.make} ${record.model} (${record.source}, ID: ${record.carId}) | £${record.priceGbp} | From: ${record.name} <${record.email}>`
    );
  }

  return { ok: true, emailDispatched, inquiryId };
}
