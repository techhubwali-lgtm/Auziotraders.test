import type {
  AuctionFeedTable,
  BodyType,
  DrivetrainType,
  FuelType,
  LiveAuctionHouseOption,
  LiveAuctionLotDetailResponse,
  LiveAuctionMakeOption,
  LiveAuctionMetaResponse,
  LiveAuctionModelOption,
  LiveAuctionSearchResponse,
  LiveAuctionStatusResponse,
  OriginPort,
  SteeringType,
  TransmissionType,
  Vehicle,
} from '../src/types/portal.ts';

// Strictly allowlisted upstream origins — NEVER constructed from user input
const AJES_API_BASE = 'http://78.46.90.228/api/';
const AUC_BASE_ORIGIN = 'https://auc.auziotraders.com';
const ALLOWED_IMAGE_PREFIX = 'https://8.ajes.com/imgs/';
const SAFE_IMG_TOKEN_REGEX = /^[a-zA-Z0-9_-]{8,160}$/;
const SAFE_LOT_ID_REGEX = /^[a-zA-Z0-9_-]{4,48}$/;
const ALLOWED_GRADES = new Set(['S', '6', '5', '4.5', '4', '3.5', '3', 'R', 'RA']);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: string;
}

// Per AJES Official Rules:
// - DO cache metadata (makes, models, auctions, counters) -> 10 min
// - DO cache individual opened lots by ID -> 10 min
// - DO NOT bulk-load all lots; always run live on-demand SQL for searches
const META_TTL_MS = 10 * 60 * 1000;
const LOT_TTL_MS = 10 * 60 * 1000;
const PROXY_SEARCH_TTL_MS = 45 * 1000; // Fallback proxy only
const MAX_CACHE_ENTRIES = 250;

interface ParsedMetaInternal {
  source: string;
  mode: 'ajes_api' | 'live_proxy';
  makes: LiveAuctionMakeOption[];
  makeNameToId: Map<string, string>;
  makeNameToRawSql: Map<string, string>;
  modelsByMake: Record<string, LiveAuctionModelOption[]>;
  auctions: LiveAuctionHouseOption[];
  totalEstimatedLots: number;
  cookies: string;
  fetchedAt: string;
}

let ajesMetaCache: CacheEntry<ParsedMetaInternal> | null = null;
let proxyMetaCache: CacheEntry<ParsedMetaInternal> | null = null;
const proxySearchCache = new Map<string, CacheEntry<LiveAuctionSearchResponse>>();
const lotDetailCache = new Map<string, CacheEntry<LiveAuctionLotDetailResponse>>();

function getAjesApiCode(): string {
  const raw = (process.env.AJES_API_CODE || '').trim().replace(/^['"]|['"]$/g, '');
  if (!raw) return '';

  // If a full AJES API URL was pasted into the secret, safely extract only its `code` param
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const extracted = (parsed.searchParams.get('code') || '').trim();
      if (/^[A-Za-z0-9_-]{6,64}$/.test(extracted)) {
        return extracted;
      }
    } catch {
      return '';
    }
    return '';
  }

  return /^[A-Za-z0-9_-]{6,64}$/.test(raw) ? raw : '';
}

function hasRawAjesSecretConfigured(): boolean {
  return Boolean((process.env.AJES_API_CODE || '').trim());
}

function pruneMapCache<T>(map: Map<string, CacheEntry<T>>) {
  const now = Date.now();
  for (const [k, entry] of map.entries()) {
    if (entry.expiresAt <= now) {
      map.delete(k);
    }
  }
  while (map.size > MAX_CACHE_ENTRIES) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
    else break;
  }
}

function decodeWin1251(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('windows-1251').decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function toTitleCase(input: string): string {
  const clean = stripHtmlTags(input);
  if (!clean) return '';
  const upperWords = new Set([
    'BMW',
    'GMC',
    'SUV',
    'GT',
    'GR',
    'RS',
    'AMG',
    'CR-V',
    'HR-V',
    'RAV4',
    'RX',
    'NX',
    'LX',
    'GX',
    'UX',
    'CX-5',
    'CX-8',
    'CX-3',
    'UD',
    'VW',
    'MINI',
  ]);
  return clean
    .split(/\s+/)
    .map((word) => {
      const up = word.toUpperCase();
      if (upperWords.has(up)) return up;
      if (word.length <= 2 && /^[A-Z0-9-]+$/i.test(word)) return up;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// -----------------------------------------------------------------------------
// AJES 3-Size Image URL Helpers
// - BIG (no suffix): Zoom view & auction inspection sheet
// - MEDIUM (&w=320): Catalog cards & default gallery (use as much as possible)
// - SMALL (&h=50):   Compact preview thumbnails
// -----------------------------------------------------------------------------

function extractSafeBaseImageUrl(rawUrlOrToken: string): string | null {
  const trimmed = rawUrlOrToken.trim().replace(/\\\//g, '/');
  if (!trimmed) return null;

  // Strip any existing &h=50 or &w=320 size modifier
  const withoutSize = trimmed.replace(/&(?:h=50|w=320)$/i, '');

  if (withoutSize.startsWith(ALLOWED_IMAGE_PREFIX)) {
    const token = withoutSize.slice(ALLOWED_IMAGE_PREFIX.length);
    if (!SAFE_IMG_TOKEN_REGEX.test(token)) return null;
    return `${ALLOWED_IMAGE_PREFIX}${token}`;
  }

  if (SAFE_IMG_TOKEN_REGEX.test(withoutSize)) {
    return `${ALLOWED_IMAGE_PREFIX}${withoutSize}`;
  }

  return null;
}

function toMediumImg(baseUrl: string): string {
  return `${baseUrl}&w=320`;
}

function toSmallImg(baseUrl: string): string {
  return `${baseUrl}&h=50`;
}

function toBigImg(baseUrl: string): string {
  return baseUrl;
}

function parseAjesImagesField(rawImages: string | undefined, isFullDetailById: boolean): {
  mediumImages: string[];
  fullImages: string[];
  thumbnailImages: string[];
  auctionSheetUrl?: string;
} {
  if (!rawImages) {
    return { mediumImages: [], fullImages: [], thumbnailImages: [] };
  }

  const rawParts = rawImages.split('#').map((s) => s.trim()).filter(Boolean);
  const uniqueBaseUrls: string[] = [];
  for (const part of rawParts) {
    const base = extractSafeBaseImageUrl(part);
    if (base && !uniqueBaseUrls.includes(base)) {
      uniqueBaseUrls.push(base);
    }
  }

  if (uniqueBaseUrls.length === 0) {
    return { mediumImages: [], fullImages: [], thumbnailImages: [] };
  }

  // Verified AJES convention:
  // In `select * from main where id='...'`, index 0 is the auction inspection sheet
  // (when >= 2 unique images exist), and indices 1..N are the vehicle photos.
  // In list queries (`select * from main ... limit`), IMAGES contains car preview photos.
  let auctionSheetUrl: string | undefined;
  let photoBases: string[];

  if (isFullDetailById && uniqueBaseUrls.length >= 2) {
    auctionSheetUrl = toBigImg(uniqueBaseUrls[0]);
    photoBases = uniqueBaseUrls.slice(1, 9);
  } else {
    photoBases = uniqueBaseUrls.slice(0, 8);
  }

  return {
    mediumImages: photoBases.map(toMediumImg),
    fullImages: photoBases.map(toBigImg),
    thumbnailImages: photoBases.map(toSmallImg),
    auctionSheetUrl,
  };
}

// -----------------------------------------------------------------------------
// Strict SQL Value Sanitization (NO raw user SQL ever reaches AJES API)
// -----------------------------------------------------------------------------

function sanitizeSqlAlphaNum(val: string, maxLen: number): string {
  return val
    .trim()
    .replace(/[^A-Za-z0-9 .-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function sanitizeSqlCode(val: string, maxLen: number): string {
  return val
    .trim()
    .replace(/[^A-Za-z0-9-]/g, '')
    .slice(0, maxLen);
}

function sanitizeClientIp(ip?: string): string {
  const cleaned = (ip || '').trim().replace(/^::ffff:/i, '');
  if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(cleaned)) {
    return cleaned;
  }
  return '203.0.113.1';
}

// -----------------------------------------------------------------------------
// Vehicle Attribute Normalization Helpers (shared by AJES API & Proxy fallback)
// -----------------------------------------------------------------------------

function inferBodyType(makeModel: string, trim: string): BodyType {
  const hay = `${makeModel} ${trim}`.toUpperCase();
  if (
    /PRADO|LAND CRUISER|HARRIER|RAV4|X-TRAIL|FORESTER|OUTLANDER|PAJERO|CR-V|VEZEL|CX-5|CX-8|CX-3|JIMNY|C-HR|RUSH|RX|NX|LX|GX|DEFENDER|DISCOVERY|RANGE ROVER|WRANGLER|X3|X5|Q5|Q7|GLE|GLC|G-CLASS|MACAN|CAYENNE|JUKE|KICKS|TAFT|RAIZE|ROCKY|YARIS CROSS|COROLLA CROSS|WR-V|ZR-V/.test(
      hay
    )
  ) {
    return 'SUV';
  }
  if (/HILUX|TRITON|NAVARA|RANGER|D-MAX|TUNDRA|TACOMA|PICKUP|TRUCK|CANTER|ELF|DUTRO|DYNA|HIJET TRUCK|CARRY|ACTY/.test(hay)) {
    return 'Pickup';
  }
  if (
    /HIACE|ALPHARD|VELLFIRE|NOAH|VOXY|SERENA|STEPWGN|ELGRAND|ESTIMA|DELICA|CARAVAN|EVERY|N-BOX|TANTO|SPACIA|SIENTA|FREED|ODYSSEY|PROBOX|SUCCEED|NV200|NV350|TOWNACE|TOWN ACE|LITEACE/.test(
      hay
    )
  ) {
    return 'Van';
  }
  if (/86|BRZ|GT-R|GTR|SUPRA|FAIRLADY|ROADSTER|MX-5|RX-7|RX-8|SILVIA|SKYLINE COUPE|911|CAYMAN|BOXSTER|COUPE|LC500|RC/.test(hay)) {
    return 'Coupe';
  }
  if (/FIELDER|TOURING|WAGON|LEVORG|OUTBACK|LEGACY|ATENZA WAGON|PROBOX|WINGROAD|ESTATE|AVANT/.test(hay)) {
    return 'Wagon';
  }
  if (
    /FIT|VITZ|YARIS|AQUA|DEMIO|SWIFT|NOTE|MARCH|PASSO|MIRAGE|ALTO|WAGON R|HUSTLER|N-ONE|N-WGN|MIRA|MOVE|GOLF|POLO|A-CLASS|1 SERIES|MINI|PRIUS|LEAF|IMPREZA SPORT/.test(
      hay
    )
  ) {
    return 'Hatchback';
  }
  return 'Sedan';
}

function estimateVolumeM3(bodyType: BodyType, makeModel: string): number {
  const hay = makeModel.toUpperCase();
  if (/LAND CRUISER|LX|ALPHARD|VELLFIRE|HIACE|CARAVAN|ELGRAND|HILUX|NAVARA|TRITON|PAJERO/.test(hay)) {
    return 16.8;
  }
  switch (bodyType) {
    case 'SUV':
      return 15.2;
    case 'Pickup':
      return 16.5;
    case 'Van':
      return 15.8;
    case 'Wagon':
      return 13.4;
    case 'Sedan':
      return 13.0;
    case 'Coupe':
      return 12.2;
    case 'Hatchback':
    default:
      return 11.4;
  }
}

function inferFuelType(makeModel: string, trim: string, engineCc: number): FuelType {
  const hay = `${makeModel} ${trim}`.toUpperCase();
  if (/LEAF|BZ4X|ARIYA|MODEL 3|MODEL Y|MODEL S|I-MIEV|SAKURA|EV\b|ELECTRIC/.test(hay) || engineCc <= 100) {
    return 'Electric';
  }
  if (/PRIUS|AQUA|HYBRID|E-POWER|E:HEV|PHEV|PLUG-IN|PHV|SAI|HS250|CT200|UX250|RX450|NX300H|ES300H/.test(hay)) {
    return 'Hybrid';
  }
  if (/DIESEL|GDJ|KDJ|GUN125|KDH|GDH|XD\b|CDI|TDI|BLUEHDI|CLEAN DIESEL|2\.8D|3\.0D|2\.4D/.test(hay)) {
    return 'Diesel';
  }
  return 'Petrol';
}

function normalizeTransmission(raw: string): TransmissionType {
  const up = raw.toUpperCase().trim();
  if (/MT|F5|F6|5M|6M|M5|M6|MANUAL/.test(up)) return 'Manual';
  if (/CVT|CA\b|ECVT/.test(up)) return 'CVT';
  return 'Automatic';
}

function normalizeDrivetrain(raw: string): DrivetrainType {
  const up = raw.toUpperCase().trim();
  if (/4WD|4X4/.test(up)) return '4WD';
  if (/AWD|FULLTIME/.test(up)) return 'AWD';
  return '2WD';
}

function normalizeOriginPort(auctionHouse: string): OriginPort {
  const up = auctionHouse.toUpperCase();
  if (/NAGOYA|CHUBU|SHIZUOKA|GIFU/.test(up)) return 'Nagoya';
  if (/KOBE|HYOGO|HAA/.test(up)) return 'Kobe';
  if (/OSAKA|KINKI|KANSAI|MIRIVE OSAKA/.test(up)) return 'Osaka';
  if (/KYUSHU|FUKUOKA|HAKATA|KUMAMOTO/.test(up)) return 'Hakata';
  return 'Yokohama';
}

function normalizeGrade(raw: string): string {
  const cleaned = stripHtmlTags(raw).toUpperCase();
  if (!cleaned || cleaned === '-' || cleaned === '***') return '4';
  if (ALLOWED_GRADES.has(cleaned)) return cleaned;
  const m = cleaned.match(/^(S|6|5|4\.5|4|3\.5|3|R|RA)/);
  return m ? m[1] : '4';
}

function computeAvgFromCommaThousands(rawP: string): number {
  if (!rawP) return 0;
  const vals = rawP
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 20 && n < 100000);
  if (vals.length === 0) return 0;
  const meanThousands = vals.reduce((acc, n) => acc + n, 0) / vals.length;
  return Math.round(meanThousands * 1000);
}

function parseEquipmentFeatures(equipRaw: string, powerHp: string, auctionHouse: string, lotNumber: string): string[] {
  const features: string[] = [];
  if (equipRaw) {
    equipRaw.split(/[\s,/]+/).forEach((code) => {
      const c = code.toUpperCase();
      if (c === 'AAC' || c === 'AC') features.push('Auto Climate Air Conditioning');
      else if (c === 'PS') features.push('Power Steering');
      else if (c === 'PW') features.push('Power Windows');
      else if (c === 'AW') features.push('Factory Alloy Wheels');
      else if (c === 'SR') features.push('Sunroof / Moonroof');
      else if (c === 'NAVI' || c === 'NV') features.push('Navigation & Monitor');
      else if (c === 'ABS') features.push('ABS Braking System');
      else if (c === 'AB') features.push('Dual Airbags');
      else if (c === 'LEATHER' || c === 'LS') features.push('Leather Interior');
    });
  }
  const hpNum = Number.parseInt(powerHp, 10);
  if (Number.isFinite(hpNum) && hpNum > 0) {
    features.push(`Engine Output: ${hpNum} HP`);
  }
  features.push(`Auction Feed: ${auctionHouse} (Lot #${lotNumber})`);
  return Array.from(new Set(features)).slice(0, 12);
}

// =============================================================================
// PART 1: OFFICIAL AJES SQL/JSON API ENGINE (http://78.46.90.228/api/)
// =============================================================================

interface AjesSqlRow {
  ID?: string;
  LOT?: string;
  AUCTION_TYPE?: string;
  AUCTION_DATE?: string;
  AUCTION?: string;
  MARKA_ID?: string;
  MODEL_ID?: string;
  MARKA_NAME?: string;
  MODEL_NAME?: string;
  YEAR?: string;
  TOWN?: string;
  ENG_V?: string;
  PW?: string;
  KUZOV?: string;
  GRADE?: string;
  COLOR?: string;
  KPP?: string;
  KPP_TYPE?: string;
  PRIV?: string;
  MILEAGE?: string;
  EQUIP?: string;
  RATE?: string;
  START?: string;
  FINISH?: string;
  STATUS?: string;
  TIME?: string;
  AVG_PRICE?: string;
  AVG_STRING?: string;
  LHDRIVE?: string;
  IMAGES?: string;
  SERIAL?: string;
  INFO?: string;
  // Aggregate unnamed columns returned by AJES SQL JSON
  TAG0?: string;
  TAG1?: string;
  TAG2?: string;
  TAG3?: string;
}

/**
 * Executes a single server-side SQL query against the strictly allowlisted AJES API.
 * NEVER logs the URL or `code` secret.
 */
async function queryAjesSql(sql: string, clientIp: string): Promise<AjesSqlRow[]> {
  const apiCode = getAjesApiCode();
  if (!apiCode) {
    throw new Error('AJES_API_CODE is not configured');
  }

  const safeIp = sanitizeClientIp(clientIp);
  const url = `${AJES_API_BASE}?json&ip=${encodeURIComponent(safeIp)}&code=${encodeURIComponent(apiCode)}&sql=${encodeURIComponent(sql)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json, text/plain, */*',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`AJES API returned HTTP ${res.status}`);
  }

  const rawBuf = await res.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(rawBuf).trim();
  if (!text) return [];

  // Guard against HTML/error strings returned by AJES (e.g., invalid code or IP warning)
  if (!text.startsWith('[')) {
    text = decodeWin1251(rawBuf).trim();
  }
  if (!text.startsWith('[')) {
    const cleanNotice = stripHtmlTags(text).slice(0, 140);
    throw new Error(cleanNotice || 'Unexpected response from AJES API');
  }

  const parsed = JSON.parse(text) as unknown;
  return Array.isArray(parsed) ? (parsed as AjesSqlRow[]) : [];
}

function normalizeAjesRowToVehicle(
  row: AjesSqlRow,
  table: AuctionFeedTable,
  jpyPerUsd: number,
  isFullDetailById: boolean
): Vehicle | null {
  const lotId = (row.ID || '').trim();
  if (!lotId || !SAFE_LOT_ID_REGEX.test(lotId)) return null;

  const rawMake = stripHtmlTags(row.MARKA_NAME || '').trim();
  const rawModel = stripHtmlTags(row.MODEL_NAME || '').trim();
  if (!rawMake) return null;

  const make =
    rawMake.toUpperCase() === 'MERCEDES BENZ'
      ? 'Mercedes-Benz'
      : toTitleCase(rawMake).slice(0, 40);
  const model = toTitleCase(rawModel || 'Export Model').slice(0, 60);
  const fullName = `${rawMake} ${rawModel}`.trim();
  const trim = stripHtmlTags(row.GRADE || '').slice(0, 60);

  const yearParsed = Number.parseInt(row.YEAR || '', 10);
  const year =
    Number.isFinite(yearParsed) && yearParsed >= 1985 && yearParsed <= 2027 ? yearParsed : 2020;

  const engineParsed = Number.parseInt(row.ENG_V || '', 10);
  const engineCc =
    Number.isFinite(engineParsed) && engineParsed >= 500 && engineParsed <= 10000
      ? engineParsed
      : 2000;

  const mileageParsed = Number.parseInt((row.MILEAGE || '').replace(/[^0-9]/g, ''), 10);
  const mileageKm =
    Number.isFinite(mileageParsed) && mileageParsed >= 0 && mileageParsed <= 999999
      ? mileageParsed
      : 0;

  const chassisRaw = stripHtmlTags(row.KUZOV || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  const lotNumber = stripHtmlTags(row.LOT || '0000').slice(0, 30) || '0000';
  const chassisCode = (
    chassisRaw.length >= 3 ? chassisRaw : `JP-${lotNumber.replace(/[^A-Z0-9]/gi, '')}`
  ).slice(0, 40);
  const stockCodeClean = `AUC-${lotNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase() || lotId.slice(0, 6).toUpperCase()}`.slice(
    0,
    32
  );

  const auctionHouse =
    stripHtmlTags(row.AUCTION || 'Japanese Auto Auction').slice(0, 60) || 'Japanese Auto Auction';
  const auctionDateFull = stripHtmlTags(row.AUCTION_DATE || '').trim();
  const auctionDateRaw = auctionDateFull.slice(0, 10);
  const auctionTimeRaw =
    auctionDateFull.length >= 16
      ? auctionDateFull.slice(11, 16)
      : stripHtmlTags(row.TIME || '').slice(0, 12);
  const auctionDateDisplay = [auctionDateRaw, auctionHouse].filter(Boolean).join(' · ').slice(0, 36);
  const auctionStatus = stripHtmlTags(row.STATUS || '').slice(0, 30);

  const startJpy = Number.parseInt(row.START || '0', 10) || 0;
  const finishJpy = Number.parseInt(row.FINISH || '0', 10) || 0;
  const avgJpyDirect = Number.parseInt(row.AVG_PRICE || '0', 10) || 0;
  const avgJpySeries = computeAvgFromCommaThousands(row.AVG_STRING || '');
  const avgJpy = avgJpyDirect > 0 ? avgJpyDirect : avgJpySeries;

  let priceBasis: 'start' | 'average' | 'finish' | 'estimated' = 'estimated';
  let chosenJpy = 0;

  if (table === 'stats' && finishJpy > 0) {
    chosenJpy = finishJpy;
    priceBasis = 'finish';
  } else if (avgJpy > 0) {
    chosenJpy = avgJpy;
    priceBasis = 'average';
  } else if (startJpy > 0) {
    chosenJpy = startJpy;
    priceBasis = 'start';
  } else if (finishJpy > 0) {
    chosenJpy = finishJpy;
    priceBasis = 'finish';
  }

  const safeRate =
    Number.isFinite(jpyPerUsd) && jpyPerUsd >= 50 && jpyPerUsd <= 500 ? jpyPerUsd : 154;
  let fobPriceUsd = 0;
  if (chosenJpy > 0) {
    fobPriceUsd = Math.round(chosenJpy / safeRate + 850);
  } else {
    const ageFactor = Math.max(0, year - 2012) * 900;
    fobPriceUsd = Math.round(6500 + ageFactor + (engineCc > 2400 ? 4500 : 0));
  }
  fobPriceUsd = Math.max(500, Math.min(500000, fobPriceUsd));

  const bodyType = inferBodyType(fullName, trim);
  const volumeM3 = estimateVolumeM3(bodyType, fullName);
  const fuelType = inferFuelType(fullName, trim, engineCc);
  const transmission = normalizeTransmission(row.KPP || '');
  const drivetrain = normalizeDrivetrain(row.PRIV || '');
  const steering: SteeringType = row.LHDRIVE === '1' ? 'LHD' : 'RHD';
  const exteriorColor = toTitleCase(row.COLOR || 'Metallic') || 'Metallic';
  const exteriorGrade = normalizeGrade(row.RATE || '');
  const originPort = normalizeOriginPort(auctionHouse);

  const infoRaw = stripHtmlTags(row.INFO || '').slice(0, 320);
  const intRateMatch = infoRaw.match(/Rate\s+int\s*:\s*([A-E])/i);
  const interiorGrade = intRateMatch
    ? intRateMatch[1].toUpperCase()
    : exteriorGrade === '5' || exteriorGrade === '6' || exteriorGrade === 'S'
      ? 'A'
      : 'B';

  const imgSet = parseAjesImagesField(row.IMAGES, isFullDetailById);
  const images =
    imgSet.mediumImages.length > 0
      ? imgSet.mediumImages
      : ['/src/assets/images/car_landcruiser_prado_1795453395370.jpg'];

  const equipRaw = stripHtmlTags(row.EQUIP || '');
  const powerHp = stripHtmlTags(row.PW || '');
  const features = parseEquipmentFeatures(equipRaw, powerHp, auctionHouse, lotNumber);

  const linkPrefix = table === 'stats' ? 'st' : 'aj';
  const sourceUrl = `${AUC_BASE_ORIGIN}/${linkPrefix}-${lotId}.htm`;
  const todayIso = new Date().toISOString().slice(0, 10);

  const isSoldStat =
    table === 'stats' || auctionStatus.toLowerCase() === 'sold';

  return {
    id: `auc-${lotId}`,
    stockCode: stockCodeClean,
    listingType: 'auction_listing',
    auctionDate: auctionDateDisplay,
    make,
    model,
    trim: trim || `${engineCc}cc ${transmission}`,
    year,
    chassisCode,
    mileageKm,
    engineCc,
    fuelType,
    transmission,
    drivetrain,
    steering,
    exteriorColor: exteriorColor.slice(0, 40),
    bodyType,
    originPort,
    volumeM3,
    fobPriceUsd,
    status: isSoldStat && auctionStatus.toLowerCase() === 'sold' ? 'sold' : 'available',
    featured: exteriorGrade === '6' || exteriorGrade === '5' || exteriorGrade === '4.5' || exteriorGrade === 'S',
    images,
    features,
    auctionReport: {
      exteriorGrade,
      interiorGrade,
      auctionHouse,
      lotNumber,
      inspectionDate: auctionDateRaw || todayIso,
      inspectorNotes:
        (infoRaw ? `${infoRaw}. ` : '') +
        (table === 'stats'
          ? `Historical Japanese auction result from ${auctionHouse} (Lot #${lotNumber}, ${auctionDateRaw || 'recent'}, Status: ${auctionStatus || 'Recorded'}). Use this benchmark to calibrate your Maximum Bid Ceiling.`
          : `Live Japanese auction lot queried on-demand via official AUZIO AJES feed (${auctionHouse}, Lot #${lotNumber}${auctionDateRaw ? ` on ${auctionDateRaw}` : ''}). Full Japanese auction sheet translation & yard check performed by AUZIO TRADERS Yokohama staff prior to bidding.`),
      mechanicalStatus: {
        engine: infoRaw
          ? `Inspector remark: ${infoRaw}`
          : 'Pending AUZIO pre-bid translation & yard check',
        transmission: `${row.KPP ? `${row.KPP} ` : ''}${transmission} — auction house spec`,
        suspension: 'Subject to official Japanese auction sheet',
        airConditioning: equipRaw.toUpperCase().includes('AC')
          ? 'Factory A/C listed on auction sheet'
          : 'Verify on inspection sheet',
        frame:
          exteriorGrade === 'R' || exteriorGrade === 'RA'
            ? 'Grade R/RA — repair history noted on sheet'
            : 'Clean auction grade reported',
      },
      panelMarks: {},
    },
    auctionSourceMeta: {
      provider: 'ajes_api',
      table,
      externalLotId: lotId,
      lotNumber,
      auctionHouse,
      auctionDate: auctionDateRaw,
      auctionTime: auctionTimeRaw,
      auctionStatus,
      rawStartPriceJpy: startJpy,
      rawAvgPriceJpy: avgJpy,
      rawFinishPriceJpy: finishJpy,
      priceBasis,
      powerHp,
      equipmentRaw: equipRaw,
      inspectorRawInfo: infoRaw || undefined,
      auctionSheetUrl: imgSet.auctionSheetUrl,
      fullImageUrls: imgSet.fullImages.length > 0 ? imgSet.fullImages : undefined,
      thumbnailUrls: imgSet.thumbnailImages.length > 0 ? imgSet.thumbnailImages : undefined,
      sourceUrl,
    },
  };
}

/**
 * Fetches & caches metadata lists (makes, models, auction houses, lot counts)
 * from official AJES SQL API — strictly following AJES Rule #2.1 & #2.2.
 */
async function getOrFetchAjesMeta(clientIp: string): Promise<ParsedMetaInternal> {
  if (ajesMetaCache && ajesMetaCache.expiresAt > Date.now()) {
    return ajesMetaCache.value;
  }

  const [countRows, makeRows, modelRows, auctionRows] = await Promise.all([
    queryAjesSql('select count(*) from main', clientIp),
    queryAjesSql('select marka_id, marka_name, count(*) from main group by marka_id', clientIp),
    queryAjesSql(
      'select marka_id, model_name, count(*) from main group by model_id limit 3000',
      clientIp
    ),
    queryAjesSql('select auction, count(*) from main group by auction', clientIp),
  ]);

  const totalFromCount = Number.parseInt(countRows[0]?.TAG0 || '0', 10) || 0;

  const makeIdToDisplay = new Map<string, string>();
  const makeNameToId = new Map<string, string>();
  const makeNameToRawSql = new Map<string, string>();
  const lotTotalsByMakeId = new Map<string, number>();

  for (const row of makeRows) {
    const id = (row.MARKA_ID || '').trim();
    const rawName = (row.MARKA_NAME || '').trim();
    const count = Number.parseInt(row.TAG2 || '0', 10) || 0;
    if (!id || !rawName || count <= 0) continue;

    const displayName =
      rawName.toUpperCase() === 'MERCEDES BENZ' ? 'Mercedes-Benz' : toTitleCase(rawName);
    makeIdToDisplay.set(id, displayName);
    makeNameToId.set(displayName.toLowerCase(), id);
    makeNameToId.set(rawName.toLowerCase(), id);
    makeNameToRawSql.set(displayName.toLowerCase(), rawName);
    makeNameToRawSql.set(rawName.toLowerCase(), rawName);
    lotTotalsByMakeId.set(id, count);
  }

  const modelsByMake: Record<string, LiveAuctionModelOption[]> = {};
  for (const row of modelRows) {
    const makeId = (row.MARKA_ID || '').trim();
    const rawModel = (row.MODEL_NAME || '').trim();
    const count = Number.parseInt(row.TAG2 || '0', 10) || 0;
    if (!makeId || !rawModel || count <= 0) continue;

    const displayMake = makeIdToDisplay.get(makeId);
    if (!displayMake) continue;
    if (!modelsByMake[displayMake]) modelsByMake[displayMake] = [];
    modelsByMake[displayMake].push({
      makeId,
      name: rawModel,
      count,
    });
  }

  const makes: LiveAuctionMakeOption[] = [];
  let sumMakeLots = 0;
  for (const [id, displayName] of makeIdToDisplay.entries()) {
    const models = modelsByMake[displayName] || [];
    models.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const totalLots = lotTotalsByMakeId.get(id) || 0;
    sumMakeLots += totalLots;
    makes.push({
      id,
      name: displayName,
      modelCount: models.length,
      totalLots,
    });
  }
  makes.sort((a, b) => b.totalLots - a.totalLots || a.name.localeCompare(b.name));

  const auctions: LiveAuctionHouseOption[] = [];
  for (const row of auctionRows) {
    const name = stripHtmlTags(row.AUCTION || '').trim();
    const count = Number.parseInt(row.TAG1 || '0', 10) || 0;
    if (name && count > 0) {
      auctions.push({ name, count });
    }
  }
  auctions.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const parsed: ParsedMetaInternal = {
    source: 'AJES Official API (auziotraders.com)',
    mode: 'ajes_api',
    makes,
    makeNameToId,
    makeNameToRawSql,
    modelsByMake,
    auctions,
    totalEstimatedLots: totalFromCount || sumMakeLots,
    cookies: '',
    fetchedAt: new Date().toISOString(),
  };

  ajesMetaCache = {
    value: parsed,
    expiresAt: Date.now() + META_TTL_MS,
    createdAt: parsed.fetchedAt,
  };

  return parsed;
}

// =============================================================================
// PART 2: FALLBACK LIVE PROXY ENGINE (https://auc.auziotraders.com/)
// Used automatically whenever AJES_API_CODE is not set in server Secrets
// =============================================================================

function extractSingleQuotedProperty(source: string, keyName: string): string | null {
  const marker = `'${keyName}'`;
  const keyIdx = source.indexOf(marker);
  if (keyIdx === -1) return null;
  const colonIdx = source.indexOf(':', keyIdx + marker.length);
  if (colonIdx === -1) return null;
  let i = colonIdx + 1;
  while (i < source.length && /\s/.test(source[i])) i++;
  if (source[i] !== "'") return null;
  i++;

  let out = '';
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\' && i + 1 < source.length) {
      const next = source[i + 1];
      if (next === "'" || next === '"' || next === '\\') out += next;
      else if (next === 'n') out += '\n';
      else if (next === 'r') out += '\r';
      else if (next === 't') out += '\t';
      else out += next;
      i += 2;
      continue;
    }
    if (ch === "'") return out;
    out += ch;
    i++;
  }
  return null;
}

function jsObjectLiteralToStrictJson(input: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  let quoteChar = '"';

  while (i < input.length) {
    const ch = input[i];
    if (inString) {
      if (ch === '\\' && i + 1 < input.length) {
        const next = input[i + 1];
        if (
          next === '"' ||
          next === '\\' ||
          next === '/' ||
          next === 'b' ||
          next === 'f' ||
          next === 'n' ||
          next === 'r' ||
          next === 't' ||
          next === 'u'
        ) {
          out += ch + next;
        } else {
          out += next;
        }
        i += 2;
        continue;
      }
      if (ch === quoteChar) {
        inString = false;
        out += '"';
        i++;
        continue;
      }
      if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else out += ch;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quoteChar = ch;
      out += '"';
      i++;
      continue;
    }

    if (/[a-zA-Z_$]/.test(ch)) {
      let end = i + 1;
      while (end < input.length && /[a-zA-Z0-9_$]/.test(input[end])) end++;
      let ws = end;
      while (ws < input.length && /\s/.test(input[ws])) ws++;
      const ident = input.slice(i, end);
      if (input[ws] === ':') {
        out += `"${ident}"`;
        i = end;
        continue;
      }
      out += ident;
      i = end;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

interface RawAucLot {
  a?: string;
  b?: string;
  c?: string;
  d?: string;
  e?: string;
  f?: string;
  g?: string;
  h?: string;
  i?: string;
  j?: string;
  k?: string;
  l?: string;
  m?: string;
  n?: string;
  o?: string;
  p?: string;
  q?: string;
  r?: string;
  s?: string;
  t?: string;
  w?: string;
  x?: string;
  y?: string;
  z?: string;
  j1?: string;
  k1?: string;
}

interface RawAucPayload {
  navi?: {
    rows?: string;
    page?: string;
    limit_step?: string;
  };
  body?: RawAucLot[];
}

function parseTplPoiskPayload(rawResponseText: string): RawAucPayload | null {
  const tplStr = extractSingleQuotedProperty(rawResponseText, 'tpl_poisk');
  if (!tplStr) return null;
  const startBrace = tplStr.indexOf('{');
  const endBrace = tplStr.lastIndexOf('}');
  if (startBrace === -1 || endBrace <= startBrace) return null;
  const strictJson = jsObjectLiteralToStrictJson(tplStr.slice(startBrace, endBrace + 1));
  try {
    return JSON.parse(strictJson) as RawAucPayload;
  } catch {
    return null;
  }
}

function normalizeProxyLotToVehicle(
  raw: RawAucLot,
  table: AuctionFeedTable,
  jpyPerUsd: number
): Vehicle | null {
  const lotId = (raw.a || '').trim();
  const k1Num = Number.parseInt(raw.k1 || '0', 10);
  if (!lotId || !SAFE_LOT_ID_REGEX.test(lotId) || k1Num < 0) return null;

  const fullName = stripHtmlTags(raw.b || '').trim();
  if (!fullName) return null;

  const parts = fullName.split(/\s+/);
  let rawMake = parts[0] || 'Toyota';
  let rawModel = parts.slice(1).join(' ') || rawMake;
  const upperFull = fullName.toUpperCase();
  for (const multiMake of [
    'LAND ROVER',
    'MERCEDES BENZ',
    'MERCEDES-BENZ',
    'ASTON MARTIN',
    'BMW ALPINA',
    'UD TRUCKS',
    'ALFA ROMEO',
    'ROLLS ROYCE',
  ]) {
    if (upperFull.startsWith(multiMake + ' ')) {
      rawMake = multiMake === 'MERCEDES BENZ' ? 'Mercedes-Benz' : multiMake;
      rawModel = fullName.slice(multiMake.length).trim();
      break;
    }
  }

  const make = toTitleCase(rawMake).slice(0, 40);
  const model = toTitleCase(rawModel).slice(0, 60) || 'Export Model';
  const trim = stripHtmlTags(raw.l || '').slice(0, 60);
  const yearParsed = Number.parseInt(raw.g || '', 10);
  const year =
    Number.isFinite(yearParsed) && yearParsed >= 1985 && yearParsed <= 2027 ? yearParsed : 2020;

  const engineParsed = Number.parseInt(raw.h || '', 10);
  const engineCc =
    Number.isFinite(engineParsed) && engineParsed >= 500 && engineParsed <= 10000
      ? engineParsed
      : 2000;

  const mileageParsed = Number.parseInt((raw.q || '').replace(/[^0-9]/g, ''), 10);
  const mileageKm =
    Number.isFinite(mileageParsed) && mileageParsed >= 0 && mileageParsed <= 999999
      ? mileageParsed
      : 0;

  const chassisRaw = stripHtmlTags(raw.j || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  const lotNumber = stripHtmlTags(raw.c || '0000').slice(0, 30) || '0000';
  const chassisCode = (
    chassisRaw.length >= 3 ? chassisRaw : `JP-${lotNumber.replace(/[^A-Z0-9]/gi, '')}`
  ).slice(0, 40);
  const stockCodeClean = `AUC-${lotNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase() || lotId.slice(0, 6).toUpperCase()}`.slice(
    0,
    32
  );

  const auctionHouse =
    stripHtmlTags(raw.d || 'Japanese Auto Auction').slice(0, 60) || 'Japanese Auto Auction';
  const auctionDateRaw = stripHtmlTags(raw.e || '').slice(0, 20);
  const auctionTimeRaw = stripHtmlTags(raw.f || '').slice(0, 12);
  const auctionDateDisplay = [auctionDateRaw, auctionHouse].filter(Boolean).join(' · ').slice(0, 36);

  const startJpy = Number.parseInt(raw.s || '0', 10) || 0;
  const finishJpy = Number.parseInt(raw.t || '0', 10) || 0;
  const avgJpyDirect = Number.parseInt(raw.o || '0', 10) || 0;
  const avgJpySeries = computeAvgFromCommaThousands(raw.p || '');
  const avgJpy = avgJpyDirect > 0 ? avgJpyDirect : avgJpySeries;

  let priceBasis: 'start' | 'average' | 'finish' | 'estimated' = 'estimated';
  let chosenJpy = 0;
  if (table === 'stats' && finishJpy > 0) {
    chosenJpy = finishJpy;
    priceBasis = 'finish';
  } else if (avgJpy > 0) {
    chosenJpy = avgJpy;
    priceBasis = 'average';
  } else if (startJpy > 0) {
    chosenJpy = startJpy;
    priceBasis = 'start';
  } else if (finishJpy > 0) {
    chosenJpy = finishJpy;
    priceBasis = 'finish';
  }

  const safeRate =
    Number.isFinite(jpyPerUsd) && jpyPerUsd >= 50 && jpyPerUsd <= 500 ? jpyPerUsd : 154;
  let fobPriceUsd = 0;
  if (chosenJpy > 0) {
    fobPriceUsd = Math.round(chosenJpy / safeRate + 850);
  } else {
    const ageFactor = Math.max(0, year - 2012) * 900;
    fobPriceUsd = Math.round(6500 + ageFactor + (engineCc > 2400 ? 4500 : 0));
  }
  fobPriceUsd = Math.max(500, Math.min(500000, fobPriceUsd));

  const bodyType = inferBodyType(fullName, trim);
  const volumeM3 = estimateVolumeM3(bodyType, fullName);
  const fuelType = inferFuelType(fullName, trim, engineCc);
  const transmission = normalizeTransmission(raw.k || '');
  const drivetrain = normalizeDrivetrain(raw.n || '');
  const exteriorColor = toTitleCase(raw.w || 'Metallic') || 'Metallic';
  const exteriorGrade = normalizeGrade(raw.r || '');
  const originPort = normalizeOriginPort(auctionHouse);

  // Use MEDIUM (&w=320) images on cards, SMALL (&h=50) thumbnails, BIG on Zoom
  const rawBaseUrls: string[] = [];
  for (const tok of [raw.x, raw.y, raw.z]) {
    if (!tok) continue;
    const base = extractSafeBaseImageUrl(tok);
    if (base && !rawBaseUrls.includes(base)) rawBaseUrls.push(base);
  }

  const mediumImages =
    rawBaseUrls.length > 0
      ? rawBaseUrls.map(toMediumImg)
      : ['/src/assets/images/car_landcruiser_prado_1795453395370.jpg'];

  const equipRaw = stripHtmlTags(raw.m || '');
  const powerHp = stripHtmlTags(raw.i || '');
  const features = parseEquipmentFeatures(equipRaw, powerHp, auctionHouse, lotNumber);

  const linkPrefix = raw.j1 === 'aj' || raw.j1 === 'st' ? raw.j1 : table === 'stats' ? 'st' : 'aj';
  const sourceUrl = `${AUC_BASE_ORIGIN}/${linkPrefix}-${lotId}.htm`;
  const todayIso = new Date().toISOString().slice(0, 10);

  return {
    id: `auc-${lotId}`,
    stockCode: stockCodeClean,
    listingType: 'auction_listing',
    auctionDate: auctionDateDisplay,
    make,
    model,
    trim: trim || `${engineCc}cc ${transmission}`,
    year,
    chassisCode,
    mileageKm,
    engineCc,
    fuelType,
    transmission,
    drivetrain,
    steering: 'RHD',
    exteriorColor: exteriorColor.slice(0, 40),
    bodyType,
    originPort,
    volumeM3,
    fobPriceUsd,
    status: 'available',
    featured: exteriorGrade === '5' || exteriorGrade === '4.5' || exteriorGrade === 'S',
    images: mediumImages,
    features,
    auctionReport: {
      exteriorGrade,
      interiorGrade: exteriorGrade === '5' || exteriorGrade === 'S' ? 'A' : 'B',
      auctionHouse,
      lotNumber,
      inspectionDate: todayIso,
      inspectorNotes:
        `Live Japanese auction lot streamed from auc.auziotraders.com (${auctionHouse}, Lot #${lotNumber}${auctionDateRaw ? ` on ${auctionDateRaw}` : ''}). ` +
        `Full Japanese auction sheet translation & physical pre-bid yard check performed by AUZIO TRADERS Yokohama staff upon Maximum Bid Ceiling request.`,
      mechanicalStatus: {
        engine: 'Pending AUZIO pre-bid translation & yard check',
        transmission: `${raw.k ? `${raw.k} ` : ''}${transmission} — auction house spec`,
        suspension: 'Subject to official Japanese auction sheet',
        airConditioning: equipRaw.includes('AC')
          ? 'Factory A/C listed on auction sheet'
          : 'Verify on inspection sheet',
        frame:
          exteriorGrade === 'R' || exteriorGrade === 'RA'
            ? 'Grade R/RA — repair history noted'
            : 'Clean auction grade reported',
      },
      panelMarks: {},
    },
    auctionSourceMeta: {
      provider: 'auc.auziotraders.com',
      table,
      externalLotId: lotId,
      lotNumber,
      auctionHouse,
      auctionDate: auctionDateRaw,
      auctionTime: auctionTimeRaw,
      rawStartPriceJpy: startJpy,
      rawAvgPriceJpy: avgJpy,
      rawFinishPriceJpy: finishJpy,
      priceBasis,
      powerHp,
      equipmentRaw: equipRaw,
      fullImageUrls: rawBaseUrls.length > 0 ? rawBaseUrls.map(toBigImg) : undefined,
      thumbnailUrls: rawBaseUrls.length > 0 ? rawBaseUrls.map(toSmallImg) : undefined,
      sourceUrl,
    },
  };
}

async function getOrFetchProxyMeta(): Promise<ParsedMetaInternal> {
  if (proxyMetaCache && proxyMetaCache.expiresAt > Date.now()) {
    return proxyMetaCache.value;
  }

  const res = await fetch(`${AUC_BASE_ORIGIN}/`, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`Upstream auc.auziotraders.com returned HTTP ${res.status}`);
  }

  const rawCookies =
    typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const cookies = rawCookies.map((c) => c.split(';')[0]).filter(Boolean).join('; ');
  const html = decodeWin1251(await res.arrayBuffer());

  const manufMatch = html.match(/id=manuf_str[^>]*>([^<]+)</i);
  const modelMatch = html.match(/id=model_str[^>]*>([^<]+)</i);

  const makeIdToName = new Map<string, string>();
  const makeNameToId = new Map<string, string>();
  const makeNameToRawSql = new Map<string, string>();

  if (manufMatch?.[1]) {
    for (const pair of manufMatch[1].split(';')) {
      const colonIdx = pair.indexOf(':');
      if (colonIdx === -1) continue;
      const id = pair.slice(0, colonIdx).trim();
      const rawName = pair.slice(colonIdx + 1).trim();
      if (!id || id === '0' || !rawName || rawName.toLowerCase() === 'any') continue;
      const displayName = rawName === 'MERCEDES BENZ' ? 'Mercedes-Benz' : toTitleCase(rawName);
      makeIdToName.set(id, displayName);
      makeNameToId.set(displayName.toLowerCase(), id);
      makeNameToId.set(rawName.toLowerCase(), id);
      makeNameToRawSql.set(displayName.toLowerCase(), rawName);
      makeNameToRawSql.set(rawName.toLowerCase(), rawName);
    }
  }

  const modelsByMake: Record<string, LiveAuctionModelOption[]> = {};
  const lotTotalsByMakeId = new Map<string, number>();
  let totalEstimatedLots = 0;

  if (modelMatch?.[1]) {
    for (const pair of modelMatch[1].split(';')) {
      const colonIdx = pair.indexOf(':');
      if (colonIdx === -1) continue;
      const makeId = pair.slice(0, colonIdx).trim();
      const rest = pair.slice(colonIdx + 1).trim();
      if (!makeId || makeId === '0' || !rest || rest.toLowerCase() === 'any') continue;

      const countMatch = rest.match(/^(.+?)\s*\((\d+)\)\s*$/);
      const modelName = (countMatch ? countMatch[1] : rest).trim();
      const count = countMatch ? Number.parseInt(countMatch[2], 10) : 1;

      const makeName = makeIdToName.get(makeId);
      if (!makeName) continue;

      if (!modelsByMake[makeName]) modelsByMake[makeName] = [];
      modelsByMake[makeName].push({
        makeId,
        name: modelName,
        count: Number.isFinite(count) ? count : 1,
      });

      lotTotalsByMakeId.set(makeId, (lotTotalsByMakeId.get(makeId) || 0) + count);
      totalEstimatedLots += count;
    }
  }

  const makes: LiveAuctionMakeOption[] = [];
  for (const [id, name] of makeIdToName.entries()) {
    const models = modelsByMake[name] || [];
    models.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    makes.push({
      id,
      name,
      modelCount: models.length,
      totalLots: lotTotalsByMakeId.get(id) || 0,
    });
  }
  makes.sort((a, b) => b.totalLots - a.totalLots || a.name.localeCompare(b.name));

  const parsed: ParsedMetaInternal = {
    source: AUC_BASE_ORIGIN,
    mode: 'live_proxy',
    makes,
    makeNameToId,
    makeNameToRawSql,
    modelsByMake,
    auctions: [],
    totalEstimatedLots,
    cookies,
    fetchedAt: new Date().toISOString(),
  };

  proxyMetaCache = {
    value: parsed,
    expiresAt: Date.now() + META_TTL_MS,
    createdAt: parsed.fetchedAt,
  };

  return parsed;
}

// =============================================================================
// PART 3: PUBLIC EXPORTED ROUTE HANDLERS
// =============================================================================

export async function getAuctionMeta(clientIp = '203.0.113.1'): Promise<LiveAuctionMetaResponse> {
  const ajesConfigured = Boolean(getAjesApiCode());

  if (ajesConfigured) {
    const wasCached = Boolean(ajesMetaCache && ajesMetaCache.expiresAt > Date.now());
    try {
      const meta = await getOrFetchAjesMeta(clientIp);
      return {
        ok: true,
        source: meta.source,
        mode: 'ajes_api',
        makes: meta.makes,
        modelsByMake: meta.modelsByMake,
        auctions: meta.auctions,
        totalEstimatedLots: meta.totalEstimatedLots,
        syncedAt: meta.fetchedAt,
        cached: wasCached,
      };
    } catch {
      // Gracefully fall back to live proxy if AJES API temporarily fails
    }
  }

  const wasCached = Boolean(proxyMetaCache && proxyMetaCache.expiresAt > Date.now());
  try {
    const meta = await getOrFetchProxyMeta();
    return {
      ok: true,
      source: meta.source,
      mode: 'live_proxy',
      makes: meta.makes,
      modelsByMake: meta.modelsByMake,
      auctions: meta.auctions,
      totalEstimatedLots: meta.totalEstimatedLots,
      syncedAt: meta.fetchedAt,
      cached: wasCached,
    };
  } catch (err) {
    return {
      ok: false,
      source: AUC_BASE_ORIGIN,
      mode: 'unavailable',
      makes: [],
      modelsByMake: {},
      auctions: [],
      totalEstimatedLots: 0,
      syncedAt: new Date().toISOString(),
      cached: false,
      message:
        err instanceof Error
          ? `Unable to reach auction feed right now (${err.message}).`
          : 'Unable to reach auction feed right now.',
    };
  }
}

export async function getAuctionStatus(
  clientIp = '203.0.113.1'
): Promise<LiveAuctionStatusResponse> {
  const ajesCode = getAjesApiCode();
  const rawSecretPresent = hasRawAjesSecretConfigured();
  let ajesWarning = '';

  if (ajesCode) {
    try {
      const meta = await getOrFetchAjesMeta(clientIp);
      return {
        ok: true,
        source: meta.source,
        mode: 'ajes_api',
        reachable: true,
        ajesApiConfigured: true,
        makesCount: meta.makes.length,
        totalEstimatedLots: meta.totalEstimatedLots,
        checkedAt: new Date().toISOString(),
        message: `Connected via Official AJES SQL/JSON API (live on-demand queries for main + stats · ${meta.totalEstimatedLots.toLocaleString()} active lots across ${meta.makes.length} makes & ${meta.auctions.length} auction houses).`,
      };
    } catch (err) {
      ajesWarning =
        err instanceof Error
          ? `AJES_API_CODE returned an access error (${err.message}); automatically using auc.auziotraders.com live proxy.`
          : 'AJES API temporarily unreachable; automatically using auc.auziotraders.com live proxy.';
    }
  } else if (rawSecretPresent) {
    ajesWarning =
      'AJES_API_CODE secret appears to contain a URL instead of the short API password; automatically using auc.auziotraders.com live proxy.';
  }

  try {
    const meta = await getOrFetchProxyMeta();
    return {
      ok: true,
      source: AUC_BASE_ORIGIN,
      mode: 'live_proxy',
      reachable: true,
      ajesApiConfigured: false,
      makesCount: meta.makes.length,
      totalEstimatedLots: meta.totalEstimatedLots,
      checkedAt: new Date().toISOString(),
      message: ajesWarning
        ? `${ajesWarning} (${meta.totalEstimatedLots.toLocaleString()} live lots across ${meta.makes.length} makes).`
        : `Live server proxy connected to auc.auziotraders.com (${meta.totalEstimatedLots.toLocaleString()} live lots across ${meta.makes.length} makes). Set AJES_API_CODE in Server Secrets to enable direct SQL/JSON main + stats queries.`,
    };
  } catch (err) {
    return {
      ok: false,
      source: AUC_BASE_ORIGIN,
      mode: 'unavailable',
      reachable: false,
      ajesApiConfigured: Boolean(ajesCode),
      makesCount: 0,
      totalEstimatedLots: 0,
      checkedAt: new Date().toISOString(),
      message:
        err instanceof Error
          ? `Feed temporarily unreachable: ${err.message}`
          : 'Feed temporarily unreachable.',
    };
  }
}

export interface AuctionSearchParams {
  table?: AuctionFeedTable;
  make?: string;
  model?: string;
  auction?: string;
  yearMin?: number;
  yearMax?: number;
  grade?: string;
  steering?: SteeringType;
  lot?: string;
  chassis?: string;
  page?: number;
  jpyRate?: number;
  clientIp?: string;
}

export async function searchLiveAuctions(
  params: AuctionSearchParams
): Promise<LiveAuctionSearchResponse> {
  const table: AuctionFeedTable = params.table === 'stats' ? 'stats' : 'main';
  const page = Math.max(1, Math.min(100, Math.round(params.page || 1)));
  const pageSize = 20;
  const jpyRate =
    typeof params.jpyRate === 'number' &&
    Number.isFinite(params.jpyRate) &&
    params.jpyRate >= 50 &&
    params.jpyRate <= 500
      ? params.jpyRate
      : 154;
  const clientIp = sanitizeClientIp(params.clientIp);

  const makeClean = sanitizeSqlAlphaNum(params.make || '', 40);
  const modelClean = sanitizeSqlAlphaNum(params.model || '', 60);
  const auctionClean = sanitizeSqlAlphaNum(params.auction || '', 60);
  const lotClean = sanitizeSqlCode(params.lot || '', 20);
  const chassisClean = sanitizeSqlCode(params.chassis || '', 24).toUpperCase();
  const gradeRaw = (params.grade || '').trim().toUpperCase();
  const gradeClean = ALLOWED_GRADES.has(gradeRaw) ? gradeRaw : '';
  const steeringClean: SteeringType | undefined =
    params.steering === 'LHD' || params.steering === 'RHD' ? params.steering : undefined;
  const yearMin =
    params.yearMin && params.yearMin >= 1985 && params.yearMin <= 2027
      ? Math.round(params.yearMin)
      : 0;
  const yearMax =
    params.yearMax && params.yearMax >= 1985 && params.yearMax <= 2027
      ? Math.round(params.yearMax)
      : 0;

  // ---------------------------------------------------------------------------
  // PRIMARY PATH: Official AJES SQL/JSON API (live on-demand SQL — NO bulk load)
  // ---------------------------------------------------------------------------
  if (getAjesApiCode()) {
    try {
      const conditions: string[] = [];

      if (makeClean && makeClean.toUpperCase() !== 'ALL') {
        const sqlMake =
          makeClean.toUpperCase() === 'MERCEDES-BENZ'
            ? 'MERCEDES BENZ'
            : makeClean.toUpperCase();
        conditions.push(`marka_name='${sqlMake}'`);
      } else if (!lotClean && !chassisClean && !auctionClean) {
        // Default targeted query when user first opens Live Auctions tab
        conditions.push(`marka_name='TOYOTA'`);
      }

      if (modelClean && modelClean.toUpperCase() !== 'ALL' && modelClean.toLowerCase() !== 'any') {
        const cleanedModel = modelClean.replace(/\s*\(\d+\)\s*$/, '').toUpperCase();
        if (cleanedModel) {
          conditions.push(`model_name='${cleanedModel}'`);
        }
      }

      if (auctionClean && auctionClean.toUpperCase() !== 'ALL') {
        conditions.push(`auction='${auctionClean}'`);
      }

      if (lotClean) {
        conditions.push(`lot='${lotClean}'`);
      }

      if (chassisClean) {
        conditions.push(`kuzov like '${chassisClean}%'`);
      }

      if (yearMin > 0) {
        conditions.push(`year>=${yearMin}`);
      }
      if (yearMax > 0) {
        conditions.push(`year<=${yearMax}`);
      }

      if (gradeClean === '4.5') {
        conditions.push(`rate in ('4.5','5','6','S')`);
      } else if (gradeClean) {
        conditions.push(`rate='${gradeClean}'`);
      }

      if (steeringClean === 'LHD') {
        conditions.push(`lhdrive=1`);
      } else if (steeringClean === 'RHD') {
        conditions.push(`lhdrive=0`);
      }

      if (table === 'stats') {
        // Focus sold statistics on rows with actual recorded auction hammer prices
        conditions.push(`finish>0`);
      }

      const whereClause = conditions.length > 0 ? ` where ${conditions.join(' and ')}` : '';
      const orderClause =
        table === 'stats' ? ' order by auction_date desc' : ' order by year desc, lot asc';
      const offset = (page - 1) * pageSize;

      const [countRows, dataRows] = await Promise.all([
        queryAjesSql(`select count(*) from ${table}${whereClause}`, clientIp),
        queryAjesSql(
          `select * from ${table}${whereClause}${orderClause} limit ${offset},${pageSize}`,
          clientIp
        ),
      ]);

      const totalMatches = Number.parseInt(countRows[0]?.TAG0 || '0', 10) || dataRows.length;
      const totalPages = Math.max(1, Math.ceil(totalMatches / pageSize));

      const items: Vehicle[] = [];
      for (const row of dataRows) {
        const normalized = normalizeAjesRowToVehicle(row, table, jpyRate, false);
        if (normalized) items.push(normalized);
      }

      return {
        ok: true,
        source: 'AJES Official API (auziotraders.com)',
        mode: 'ajes_api',
        table,
        totalMatches,
        page,
        pageSize,
        totalPages,
        items,
        syncedAt: new Date().toISOString(),
        cached: false,
        message:
          items.length === 0
            ? table === 'stats'
              ? 'No historical sold auction records match these filters.'
              : 'No active Japanese auction lots match these filters right now.'
            : undefined,
      };
    } catch {
      // Automatically fall back to auc.auziotraders.com live proxy if AJES API rejects code or fails
    }
  }

  // ---------------------------------------------------------------------------
  // FALLBACK PATH: Live Server Proxy to https://auc.auziotraders.com/
  // ---------------------------------------------------------------------------
  const cacheKey = JSON.stringify({
    table,
    makeClean: makeClean.toLowerCase(),
    modelClean: modelClean.toUpperCase(),
    yearMin,
    yearMax,
    gradeClean,
    lotClean,
    chassisClean,
    page,
    jpyRate: Math.round(jpyRate),
  });

  pruneMapCache(proxySearchCache);
  const existingCache = proxySearchCache.get(cacheKey);
  if (existingCache && existingCache.expiresAt > Date.now()) {
    return { ...existingCache.value, cached: true };
  }

  try {
    const meta = await getOrFetchProxyMeta();

    let vendorId = '';
    if (makeClean && makeClean.toUpperCase() !== 'ALL') {
      vendorId = meta.makeNameToId.get(makeClean.toLowerCase()) || '';
      if (!vendorId) {
        const found = meta.makes.find(
          (m) => m.name.toLowerCase() === makeClean.toLowerCase() || m.id === makeClean
        );
        vendorId = found?.id || '';
      }
    } else if (!lotClean && !chassisClean) {
      vendorId = '1'; // Toyota default showcase
    }

    let upstreamModel = '';
    if (modelClean && modelClean.toUpperCase() !== 'ALL' && modelClean.toLowerCase() !== 'any') {
      upstreamModel = modelClean.replace(/\s*\(\d+\)\s*$/, '').toUpperCase();
    }

    const ts = `${Date.now()}0`;
    const formBody = new URLSearchParams({
      url_loader: 'aj_neo?file=loader',
      page: String(page),
      sort_ord: 'year#desc',
      url_luboy: 'Any',
      url_lubaya: 'Any',
      lose_time_here_buT_not_buy_servlce_for_100_usd_monthly_here_http_avto_jp:
        'http://avto.jp/specification.html',
      tpl: '',
      edit_post: '',
      is_stat: table === 'stats' ? '1' : '0',
      vendor: vendorId,
      model: upstreamModel,
      bid: lotClean,
      kuzov: chassisClean,
      rate: gradeClean,
      status: '',
      kpp_add: '',
      colour: '',
      auct_name: auctionClean,
      list_size: '50',
      year: yearMin ? String(yearMin) : '',
      year2: yearMax ? String(yearMax) : '',
    });

    const loaderRes = await fetch(
      `${AUC_BASE_ORIGIN}/aj_neo?file=loader&ajx=${encodeURIComponent(ts)}-xml`,
      {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: `${AUC_BASE_ORIGIN}/`,
          Origin: AUC_BASE_ORIGIN,
          ...(meta.cookies ? { Cookie: meta.cookies } : {}),
        },
        body: formBody.toString(),
        signal: AbortSignal.timeout(12000),
      }
    );

    if (!loaderRes.ok) {
      throw new Error(`auc.auziotraders.com loader returned HTTP ${loaderRes.status}`);
    }

    const rawText = decodeWin1251(await loaderRes.arrayBuffer());
    const parsed = parseTplPoiskPayload(rawText);

    if (!parsed) {
      return {
        ok: false,
        source: AUC_BASE_ORIGIN,
        mode: 'unavailable',
        table,
        totalMatches: 0,
        page,
        pageSize,
        totalPages: 0,
        items: [],
        syncedAt: new Date().toISOString(),
        cached: false,
        message:
          table === 'stats'
            ? 'Historical sold statistics require AJES_API_CODE configured in Server Secrets.'
            : 'Upstream auction feed returned a session refresh notice. Please retry or configure AJES_API_CODE in Server Secrets.',
      };
    }

    const totalMatches = Number.parseInt(parsed.navi?.rows || '0', 10) || 0;
    const respPageSize = Number.parseInt(parsed.navi?.limit_step || '20', 10) || 20;
    const totalPages = Math.max(1, Math.ceil(totalMatches / respPageSize));

    const items: Vehicle[] = [];
    for (const rawLot of parsed.body || []) {
      const normalized = normalizeProxyLotToVehicle(rawLot, table, jpyRate);
      if (normalized) items.push(normalized);
    }

    const response: LiveAuctionSearchResponse = {
      ok: true,
      source: AUC_BASE_ORIGIN,
      mode: 'live_proxy',
      table,
      totalMatches,
      page,
      pageSize: respPageSize,
      totalPages,
      items,
      syncedAt: new Date().toISOString(),
      cached: false,
      message:
        items.length === 0
          ? 'No active auction lots match these filters right now.'
          : undefined,
    };

    proxySearchCache.set(cacheKey, {
      value: response,
      expiresAt: Date.now() + PROXY_SEARCH_TTL_MS,
      createdAt: response.syncedAt,
    });

    return response;
  } catch (err) {
    return {
      ok: false,
      source: AUC_BASE_ORIGIN,
      mode: 'unavailable',
      table,
      totalMatches: 0,
      page,
      pageSize,
      totalPages: 0,
      items: [],
      syncedAt: new Date().toISOString(),
      cached: false,
      message:
        err instanceof Error
          ? `Live auction proxy error: ${err.message}`
          : 'Live auction feed is temporarily unavailable.',
    };
  }
}

/**
 * Fetches FULL LOT INFO BY ID (`select * from main|stats where id='<id>'`)
 * per AJES Official Rule: "select * from main limit 20 does not return ALL INFO;
 * when user opens lot, request by ID — and you CAN cache this lot."
 */
export async function fetchLiveLotDetail(
  lotIdRaw: string,
  options?: { table?: AuctionFeedTable; jpyRate?: number; clientIp?: string }
): Promise<LiveAuctionLotDetailResponse> {
  const lotId = lotIdRaw.replace(/^auc-/, '').trim();
  const requestedTable: AuctionFeedTable = options?.table === 'stats' ? 'stats' : 'main';
  const jpyRate =
    typeof options?.jpyRate === 'number' &&
    Number.isFinite(options.jpyRate) &&
    options.jpyRate >= 50 &&
    options.jpyRate <= 500
      ? options.jpyRate
      : 154;
  const clientIp = sanitizeClientIp(options?.clientIp);

  if (!SAFE_LOT_ID_REGEX.test(lotId)) {
    return {
      ok: false,
      lotId: '',
      table: requestedTable,
      images: [],
      fullImages: [],
      thumbnails: [],
      sourceUrl: AUC_BASE_ORIGIN,
      message: 'Invalid auction lot identifier.',
    };
  }

  const cacheKey = `${requestedTable}:${lotId}`;
  pruneMapCache(lotDetailCache);
  const cached = lotDetailCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.value, cached: true };
  }

  // ---------------------------------------------------------------------------
  // PRIMARY PATH: Official AJES SQL/JSON API `select * from <table> where id='...'`
  // ---------------------------------------------------------------------------
  if (getAjesApiCode()) {
    try {
      let activeTable: AuctionFeedTable = requestedTable;
      let rows = await queryAjesSql(`select * from ${activeTable} where id='${lotId}'`, clientIp);
      if (rows.length === 0) {
        // Fallback check on the alternate table (e.g. a main lot that moved into stats)
        const altTable: AuctionFeedTable = activeTable === 'main' ? 'stats' : 'main';
        const altRows = await queryAjesSql(
          `select * from ${altTable} where id='${lotId}'`,
          clientIp
        );
        if (altRows.length > 0) {
          rows = altRows;
          activeTable = altTable;
        }
      }

      if (rows.length === 0) {
        return {
          ok: false,
          lotId,
          table: requestedTable,
          mode: 'ajes_api',
          images: [],
          fullImages: [],
          thumbnails: [],
          sourceUrl: `${AUC_BASE_ORIGIN}/${requestedTable === 'stats' ? 'st' : 'aj'}-${lotId}.htm`,
          message: 'Auction lot not found or has already expired from the feed.',
        };
      }

      const vehicle = normalizeAjesRowToVehicle(rows[0], activeTable, jpyRate, true);
      if (!vehicle) {
        return {
          ok: false,
          lotId,
          table: activeTable,
          mode: 'ajes_api',
          images: [],
          fullImages: [],
          thumbnails: [],
          sourceUrl: `${AUC_BASE_ORIGIN}/${activeTable === 'stats' ? 'st' : 'aj'}-${lotId}.htm`,
          message: 'Could not parse lot specification.',
        };
      }

      const detail: LiveAuctionLotDetailResponse = {
        ok: true,
        lotId,
        table: activeTable,
        mode: 'ajes_api',
        images: vehicle.images,
        fullImages: vehicle.auctionSourceMeta?.fullImageUrls || vehicle.images,
        thumbnails: vehicle.auctionSourceMeta?.thumbnailUrls || vehicle.images,
        auctionSheetUrl: vehicle.auctionSourceMeta?.auctionSheetUrl,
        vehicle,
        sourceUrl: vehicle.auctionSourceMeta?.sourceUrl || AUC_BASE_ORIGIN,
        cached: false,
      };

      lotDetailCache.set(cacheKey, {
        value: detail,
        expiresAt: Date.now() + LOT_TTL_MS,
        createdAt: new Date().toISOString(),
      });

      return detail;
    } catch {
      // Automatically fall back to auc.auziotraders.com HTML lot page if AJES API rejects code or fails
    }
  }

  // ---------------------------------------------------------------------------
  // FALLBACK PATH: Live HTML Lot Page on https://auc.auziotraders.com/
  // ---------------------------------------------------------------------------
  const sourceUrl = `${AUC_BASE_ORIGIN}/${requestedTable === 'stats' ? 'st' : 'aj'}-${lotId}.htm`;
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: `${AUC_BASE_ORIGIN}/`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return {
        ok: false,
        lotId,
        table: requestedTable,
        mode: 'live_proxy',
        images: [],
        fullImages: [],
        thumbnails: [],
        sourceUrl,
        message: `Lot detail returned HTTP ${res.status}.`,
      };
    }

    const html = decodeWin1251(await res.arrayBuffer());
    const matches = html.match(/https:\/\/8\.ajes\.com\/imgs\/([a-zA-Z0-9_-]{8,160})/g) || [];
    const uniqueBaseUrls = Array.from(new Set(matches))
      .map((u) => extractSafeBaseImageUrl(u))
      .filter((u): u is string => Boolean(u));

    // On auc.auziotraders.com HTML pages, the last image (3rd+) is the auction sheet
    const auctionSheetUrl =
      uniqueBaseUrls.length >= 3 ? toBigImg(uniqueBaseUrls[uniqueBaseUrls.length - 1]) : undefined;
    const photoBases =
      uniqueBaseUrls.length >= 3 ? uniqueBaseUrls.slice(0, -1).slice(0, 6) : uniqueBaseUrls.slice(0, 6);

    const detail: LiveAuctionLotDetailResponse = {
      ok: true,
      lotId,
      table: requestedTable,
      mode: 'live_proxy',
      images: photoBases.map(toMediumImg),
      fullImages: photoBases.map(toBigImg),
      thumbnails: photoBases.map(toSmallImg),
      auctionSheetUrl,
      sourceUrl,
      cached: false,
    };

    lotDetailCache.set(cacheKey, {
      value: detail,
      expiresAt: Date.now() + LOT_TTL_MS,
      createdAt: new Date().toISOString(),
    });

    return detail;
  } catch (err) {
    return {
      ok: false,
      lotId,
      table: requestedTable,
      mode: 'unavailable',
      images: [],
      fullImages: [],
      thumbnails: [],
      sourceUrl,
      message: err instanceof Error ? err.message : 'Unable to fetch lot detail.',
    };
  }
}
