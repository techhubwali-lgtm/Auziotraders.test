import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import type { DealerBodyCategory, DealerSource } from '../../src/types/portal';
import {
  extractEnglishFeatures,
  inferBodyCategory,
  parseEngineCc,
  parseJapaneseManYenToJpy,
  parseJapaneseMileageToKm,
  parseJapaneseYear,
  translateColor,
  translateDriveType,
  translateFuel,
  translateMake,
  translateModel,
  translatePrefecture,
  translateRepairHistory,
  translateShaken,
  translateTransmission,
} from './jpDictionary';
import { politeFetchHtml } from './robotsCompliance';

/**
 * Intermediate server-side extracted vehicle before public FOB pricing strips out
 * raw dealer JPY cost (raw dealer price is only persisted to staff-only dealer_price_history).
 */
export interface RawExtractedDealerVehicle {
  dedupeKey: string;
  sourceId: string;
  sourceDomain: string;
  stockId: string;
  dealerName: string;
  manufacturer: string | null;
  model: string | null;
  grade: string | null;
  modelCode: string | null;
  chassisNumber: string | null;
  manufacturingYear: number | null;
  registrationYearMonth: string | null;
  mileageKm: number | null;
  engineCapacityCc: number | null;
  fuelType: string | null;
  transmission: string | null;
  driveType: string | null;
  bodyType: DealerBodyCategory | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  doors: number | null;
  seats: number | null;
  steering: 'RHD' | 'LHD' | null;
  repairHistory: 'No Repair History' | 'Repair History Present' | null;
  shakenExpiry: string | null;
  internalOriginalPriceJpy: number | null;
  internalTotalPriceJpy: number | null;
  taxStatus: string | null;
  location: string | null;
  dealerBranch: string | null;
  description: string | null;
  features: string[];
  images: string[];
  originalListingUrl: string;
}

export interface AdapterExtractResult {
  vehicles: RawExtractedDealerVehicle[];
  errors: Array<{
    stage: 'http_fetch' | 'html_parse' | 'feed_parse' | 'validation';
    severity: 'warning' | 'error';
    message: string;
    url: string | null;
    httpStatus: number | null;
  }>;
  antiBotBlocked: boolean;
}

export interface DealerAdapter {
  key: string;
  label: string;
  verifiedParser: boolean;
  extract(
    source: DealerSource,
    options: { maxVehicles: number; shouldAbort: () => boolean }
  ): Promise<AdapterExtractResult>;
}

function makeDedupeKey(sourceId: string, stockId: string, url: string): string {
  const hash = crypto
    .createHash('sha1')
    .update(`${sourceId}:${stockId || url}`)
    .digest('hex')
    .slice(0, 16);
  return `${sourceId}_${hash}`;
}

function resolveAbsoluteUrl(href: string | undefined, base: string): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) return null;
  try {
    const u = new URL(trimmed, base);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function splitTitleIntoMakeModelGrade(rawTitle: string): {
  manufacturer: string | null;
  model: string | null;
  grade: string | null;
} {
  const clean = rawTitle.replace(/\s+/g, ' ').trim();
  const tokens = clean.split(' ');
  const manufacturer = translateMake(tokens[0] || clean);
  const rest = tokens.length > 1 ? tokens.slice(1).join(' ') : clean;
  const model = translateModel(rest);
  let grade: string | null = null;
  if (tokens.length > 2) {
    grade = tokens.slice(2).join(' ').slice(0, 80) || null;
  }
  return { manufacturer, model, grade };
}

function extractLabeledValue(fullText: string, label: string, nextLabels: string[]): string | null {
  const escaped = nextLabels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const rx = new RegExp(`${label}\\s*[:：]?\\s*(.+?)(?=\\s+(?:${escaped})|$)`);
  const m = fullText.match(rx);
  if (!m) return null;
  const val = m[1].trim();
  if (!val || /^[-－—]+$/.test(val)) return null;
  return val;
}

// =============================================================================
// 1. VERIFIED ADAPTER: FLEX (https://www.flexnet.co.jp/search/)
// Uses public Schema.org ItemList JSON-LD + structured `.useditem` HTML cards
// =============================================================================
const flexnetAdapter: DealerAdapter = {
  key: 'flexnet',
  label: 'FLEX (HTML + Schema.org ItemList)',
  verifiedParser: true,
  async extract(source, { maxVehicles, shouldAbort }) {
    const vehicles: RawExtractedDealerVehicle[] = [];
    const errors: AdapterExtractResult['errors'] = [];
    const limit = Math.max(1, Math.min(100, maxVehicles));

    const maxPages = Math.min(3, Math.ceil(limit / 40));
    for (let page = 1; page <= maxPages; page += 1) {
      if (shouldAbort() || vehicles.length >= limit) break;
      const pageUrl =
        page === 1
          ? source.inventoryUrl
          : `${source.inventoryUrl}${source.inventoryUrl.includes('?') ? '&' : '?'}page=${page}`;

      const res = await politeFetchHtml({
        url: pageUrl,
        rateLimitMs: source.rateLimitMs,
        maxRetries: 1,
      });

      if (!res.ok) {
        errors.push({
          stage: 'http_fetch',
          severity: 'error',
          message: res.error || `Failed fetching ${pageUrl}`,
          url: pageUrl,
          httpStatus: res.status || null,
        });
        return { vehicles, errors, antiBotBlocked: res.antiBotBlocked };
      }

      const $ = cheerio.load(res.html);

      // Index Schema.org ItemList JSON-LD entries by URL for verified high-res photos & descriptions
      const jsonLdByUrl = new Map<string, { name?: string; image?: string; description?: string }>();
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const parsed = JSON.parse($(el).text());
          const list =
            parsed?.['@type'] === 'ItemList' && Array.isArray(parsed.itemListElement)
              ? parsed.itemListElement
              : [];
          for (const item of list) {
            if (typeof item?.url === 'string') {
              jsonLdByUrl.set(item.url, {
                name: typeof item.name === 'string' ? item.name : undefined,
                image: typeof item.image === 'string' ? item.image : undefined,
                description: typeof item.description === 'string' ? item.description : undefined,
              });
            }
          }
        } catch {
          // Skip malformed JSON-LD block
        }
      });

      const cards = $('.useditem');
      if (cards.length === 0) {
        errors.push({
          stage: 'html_parse',
          severity: 'warning',
          message: `No .useditem cards found on ${pageUrl}`,
          url: pageUrl,
          httpStatus: res.status,
        });
        break;
      }

      cards.each((_, el) => {
        if (vehicles.length >= limit) return false;
        const card = $(el);
        const rawHref = card.find('a[href*="/detail/"]').first().attr('href');
        const listingUrl = resolveAbsoluteUrl(rawHref, source.baseUrl);
        if (!listingUrl) return;

        const stockMatch = listingUrl.match(/-(\d+)\.html/i);
        const stockId = stockMatch ? `FLEX-${stockMatch[1]}` : `FLEX-${vehicles.length + 1}`;
        const ld = jsonLdByUrl.get(listingUrl);

        const fullText = card.text().replace(/\s+/g, ' ').trim();
        const headingText =
          ld?.name ||
          card.find('h2, h3, .ttl, .car_name, a[href*="/detail/"]').first().text().replace(/\s+/g, ' ').trim();

        const { manufacturer, model, grade } = splitTitleIntoMakeModelGrade(headingText);

        const labels = [
          '年式',
          '走行',
          '排気量',
          '修復歴',
          '車検',
          '駆動',
          '色',
          'エンジン',
          'シフト',
          '型式',
          'LINEで',
          '在庫確認',
          '諸費用',
          '車両価格',
          '支払総額',
        ];

        const rawYear = extractLabeledValue(fullText, '年式', labels);
        const rawMileage = extractLabeledValue(fullText, '走行', labels);
        const rawEngine = extractLabeledValue(fullText, '排気量', labels);
        const rawRepair = extractLabeledValue(fullText, '修復歴', labels);
        const rawShaken = extractLabeledValue(fullText, '車検', labels);
        const rawDrive = extractLabeledValue(fullText, '駆動', labels);
        const rawColor = extractLabeledValue(fullText, '色', labels);
        const rawFuel = extractLabeledValue(fullText, 'エンジン', labels);
        const rawShift = extractLabeledValue(fullText, 'シフト', labels);
        const rawModelCode = extractLabeledValue(fullText, '型式', labels);
        const rawBasePrice = extractLabeledValue(fullText, '車両価格', labels);
        const rawTotalPrice = extractLabeledValue(fullText, '支払総額', labels);

        const engineCc = parseEngineCc(rawEngine);
        const basePriceJpy = parseJapaneseManYenToJpy(rawBasePrice);
        const totalPriceJpy = parseJapaneseManYenToJpy(rawTotalPrice);

        const images = new Set<string>();
        if (ld?.image) {
          const abs = resolveAbsoluteUrl(ld.image, source.baseUrl);
          if (abs) images.add(abs);
        }
        card.find('img').each((__, imgEl) => {
          const src = $(imgEl).attr('data-src') || $(imgEl).attr('src');
          const abs = resolveAbsoluteUrl(src, source.baseUrl);
          if (abs && /img\d*\.flexnet\.co\.jp\/images\//i.test(abs)) {
            images.add(abs);
          }
        });

        const taxStatus =
          rawBasePrice && /税込/.test(rawBasePrice)
            ? 'Tax Included (JP)'
            : rawTotalPrice && /税込/.test(rawTotalPrice)
              ? 'Tax Included (JP)'
              : null;

        const desc = ld?.description || null;
        const features = extractEnglishFeatures(`${headingText} ${desc || ''} ${fullText}`);
        const bodyType = inferBodyCategory(null, `${headingText} ${model || ''}`, engineCc);

        vehicles.push({
          dedupeKey: makeDedupeKey(source.id, stockId, listingUrl),
          sourceId: source.id,
          sourceDomain: source.domain,
          stockId,
          dealerName: 'FLEX Japan',
          manufacturer,
          model,
          grade,
          modelCode: rawModelCode ? rawModelCode.slice(0, 32) : null,
          chassisNumber: null, // Not publicly disclosed on listing cards
          manufacturingYear: parseJapaneseYear(rawYear),
          registrationYearMonth: null,
          mileageKm: parseJapaneseMileageToKm(rawMileage),
          engineCapacityCc: engineCc,
          fuelType: translateFuel(rawFuel),
          transmission: translateTransmission(rawShift),
          driveType: translateDriveType(rawDrive),
          bodyType,
          exteriorColor: translateColor(rawColor),
          interiorColor: null,
          doors: null,
          seats: null,
          steering: 'RHD',
          repairHistory: translateRepairHistory(rawRepair),
          shakenExpiry: translateShaken(rawShaken),
          internalOriginalPriceJpy: basePriceJpy ?? totalPriceJpy,
          internalTotalPriceJpy: totalPriceJpy,
          taxStatus,
          location: translatePrefecture(fullText) || 'Japan (FLEX Nationwide Network)',
          dealerBranch: null,
          description: desc,
          features,
          images: Array.from(images).slice(0, 8),
          originalListingUrl: listingUrl,
        });
      });
    }

    return { vehicles, errors, antiBotBlocked: false };
  },
};

// =============================================================================
// 2. VERIFIED ADAPTER: Apple Auto Network (https://www.applenet.co.jp/buy/search/)
// Uses public `.stock-card` HTML catalog
// =============================================================================
const applenetAdapter: DealerAdapter = {
  key: 'applenet',
  label: 'Apple Auto Network (HTML .stock-card)',
  verifiedParser: true,
  async extract(source, { maxVehicles, shouldAbort }) {
    const vehicles: RawExtractedDealerVehicle[] = [];
    const errors: AdapterExtractResult['errors'] = [];
    const limit = Math.max(1, Math.min(100, maxVehicles));

    const maxPages = Math.min(2, Math.ceil(limit / 50));
    for (let page = 1; page <= maxPages; page += 1) {
      if (shouldAbort() || vehicles.length >= limit) break;
      const pageUrl =
        page === 1
          ? source.inventoryUrl
          : `${source.inventoryUrl}${source.inventoryUrl.includes('?') ? '&' : '?'}page=${page}`;

      const res = await politeFetchHtml({
        url: pageUrl,
        rateLimitMs: source.rateLimitMs,
        maxRetries: 1,
      });

      if (!res.ok) {
        errors.push({
          stage: 'http_fetch',
          severity: 'error',
          message: res.error || `Failed fetching ${pageUrl}`,
          url: pageUrl,
          httpStatus: res.status || null,
        });
        return { vehicles, errors, antiBotBlocked: res.antiBotBlocked };
      }

      const $ = cheerio.load(res.html);
      const cards = $('.stock-card');
      if (cards.length === 0) {
        errors.push({
          stage: 'html_parse',
          severity: 'warning',
          message: `No .stock-card elements found on ${pageUrl}`,
          url: pageUrl,
          httpStatus: res.status,
        });
        break;
      }

      cards.each((_, el) => {
        if (vehicles.length >= limit) return false;
        const card = $(el);
        const detailLink = card.find('a[href*="detail_"]').first();
        const listingUrl = resolveAbsoluteUrl(detailLink.attr('href'), source.baseUrl);
        if (!listingUrl) return;

        const idMatch = listingUrl.match(/detail_(\d+)/i);
        const stockId = idMatch ? `APPLE-${idMatch[1]}` : `APPLE-${vehicles.length + 1}`;
        const headerText =
          card.find('.stock-card__header').text().replace(/\s+/g, ' ').trim() ||
          detailLink.text().replace(/\s+/g, ' ').trim();
        const fullText = card.text().replace(/\s+/g, ' ').trim();

        const { manufacturer, model, grade } = splitTitleIntoMakeModelGrade(headerText);

        const labels = [
          '支払総額',
          '車両本体価格',
          '年式',
          '走行距離',
          '排気量',
          '修復歴',
          '駆動方式',
          'ボディタイプ',
          '車検',
          '保証',
          '電話で在庫確認',
          '在庫確認',
          '取扱店',
        ];

        const rawTotal = extractLabeledValue(fullText, '支払総額（税込み）', labels) ||
          extractLabeledValue(fullText, '支払総額', labels);
        const rawBase = extractLabeledValue(fullText, '車両本体価格\\(税込\\)', labels) ||
          extractLabeledValue(fullText, '車両本体価格', labels);
        const rawYear = extractLabeledValue(fullText, '年式', labels);
        const rawMileage = extractLabeledValue(fullText, '走行距離', labels);
        const rawEngine = extractLabeledValue(fullText, '排気量', labels);
        const rawRepair = extractLabeledValue(fullText, '修復歴', labels);
        const rawDrive = extractLabeledValue(fullText, '駆動方式', labels);
        const rawBody = extractLabeledValue(fullText, 'ボディタイプ', labels);
        const rawShaken = extractLabeledValue(fullText, '車検', labels);
        const rawShop = extractLabeledValue(fullText, '取扱店', ['電話', '在庫確認']);

        const engineCc = parseEngineCc(rawEngine);
        const basePriceJpy = parseJapaneseManYenToJpy(rawBase);
        const totalPriceJpy = parseJapaneseManYenToJpy(rawTotal);

        const images = new Set<string>();
        card.find('img').each((__, imgEl) => {
          const src = $(imgEl).attr('data-src') || $(imgEl).attr('src');
          const abs = resolveAbsoluteUrl(src, source.baseUrl);
          if (abs && !/noimage|icon|logo|btn|banner/i.test(abs)) {
            images.add(abs);
          }
        });

        const doorsMatch = rawBody?.match(/(\d)ドア/);
        const doors = doorsMatch ? parseInt(doorsMatch[1], 10) : null;
        const bodyType = inferBodyCategory(rawBody, `${headerText} ${model || ''}`, engineCc);

        const shopBranch = rawShop
          ? rawShop.split(' ').slice(-1)[0]?.slice(0, 60) || null
          : null;

        vehicles.push({
          dedupeKey: makeDedupeKey(source.id, stockId, listingUrl),
          sourceId: source.id,
          sourceDomain: source.domain,
          stockId,
          dealerName: 'Apple Auto Network Japan',
          manufacturer,
          model,
          grade,
          modelCode: null,
          chassisNumber: null,
          manufacturingYear: parseJapaneseYear(rawYear),
          registrationYearMonth: null,
          mileageKm: parseJapaneseMileageToKm(rawMileage),
          engineCapacityCc: engineCc,
          fuelType: translateFuel(fullText),
          transmission: translateTransmission(fullText),
          driveType: translateDriveType(rawDrive),
          bodyType,
          exteriorColor: translateColor(fullText),
          interiorColor: null,
          doors,
          seats: null,
          steering: 'RHD',
          repairHistory: translateRepairHistory(rawRepair),
          shakenExpiry: translateShaken(rawShaken),
          internalOriginalPriceJpy: basePriceJpy ?? totalPriceJpy,
          internalTotalPriceJpy: totalPriceJpy,
          taxStatus: /税込/.test(fullText) ? 'Tax Included (JP)' : null,
          location: translatePrefecture(rawShop || fullText),
          dealerBranch: shopBranch,
          description: null,
          features: extractEnglishFeatures(fullText),
          images: Array.from(images).slice(0, 8),
          originalListingUrl: listingUrl,
        });
      });
    }

    return { vehicles, errors, antiBotBlocked: false };
  },
};

// =============================================================================
// 3. GENERIC COMPLIANT JSON-LD ADAPTER (for candidate sources if enabled/approved)
// Extracts ONLY real Schema.org Car / Vehicle / Product JSON-LD — never fabricates.
// =============================================================================
function createJsonLdCandidateAdapter(key: string, label: string): DealerAdapter {
  return {
    key,
    label: `${label} (Schema.org JSON-LD Adapter)`,
    verifiedParser: false,
    async extract(source, { maxVehicles, shouldAbort }) {
      const vehicles: RawExtractedDealerVehicle[] = [];
      const errors: AdapterExtractResult['errors'] = [];
      if (shouldAbort()) return { vehicles, errors, antiBotBlocked: false };

      const res = await politeFetchHtml({
        url: source.inventoryUrl,
        rateLimitMs: source.rateLimitMs,
        maxRetries: 1,
      });

      if (!res.ok) {
        errors.push({
          stage: 'http_fetch',
          severity: 'error',
          message: res.error || `Could not reach ${source.inventoryUrl}`,
          url: source.inventoryUrl,
          httpStatus: res.status || null,
        });
        return { vehicles, errors, antiBotBlocked: res.antiBotBlocked };
      }

      const $ = cheerio.load(res.html);
      const limit = Math.max(1, Math.min(100, maxVehicles));

      $('script[type="application/ld+json"]').each((_, el) => {
        if (vehicles.length >= limit) return false;
        try {
          const parsed = JSON.parse($(el).text());
          const candidates = Array.isArray(parsed)
            ? parsed
            : parsed?.['@type'] === 'ItemList' && Array.isArray(parsed.itemListElement)
              ? parsed.itemListElement.map((x: Record<string, unknown>) => x.item || x)
              : [parsed];

          for (const obj of candidates) {
            if (vehicles.length >= limit) break;
            const typeVal = String(obj?.['@type'] || '');
            if (!/Car|Vehicle|Product/i.test(typeVal)) continue;

            const listingUrl = resolveAbsoluteUrl(
              typeof obj.url === 'string' ? obj.url : source.inventoryUrl,
              source.baseUrl
            );
            if (!listingUrl) continue;

            const name = typeof obj.name === 'string' ? obj.name : '';
            const { manufacturer, model, grade } = splitTitleIntoMakeModelGrade(name);
            const sku = typeof obj.sku === 'string' ? obj.sku : `${source.id.toUpperCase()}-${vehicles.length + 1}`;
            const offer = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
            const rawPrice = offer?.price ? Number(offer.price) : null;
            const priceJpy = rawPrice && Number.isFinite(rawPrice) && rawPrice > 10000 ? Math.round(rawPrice) : null;
            const imgArr = Array.isArray(obj.image)
              ? obj.image.filter((u: unknown): u is string => typeof u === 'string')
              : typeof obj.image === 'string'
                ? [obj.image]
                : [];

            vehicles.push({
              dedupeKey: makeDedupeKey(source.id, sku, listingUrl),
              sourceId: source.id,
              sourceDomain: source.domain,
              stockId: sku,
              dealerName: source.name,
              manufacturer: translateMake(obj.brand?.name || manufacturer) || manufacturer,
              model: translateModel(obj.model || model) || model,
              grade,
              modelCode: null,
              chassisNumber: typeof obj.vehicleIdentificationNumber === 'string' ? obj.vehicleIdentificationNumber : null,
              manufacturingYear: obj.vehicleModelDate ? parseJapaneseYear(String(obj.vehicleModelDate)) : null,
              registrationYearMonth: null,
              mileageKm: obj.mileageFromOdometer?.value ? Number(obj.mileageFromOdometer.value) : null,
              engineCapacityCc: null,
              fuelType: translateFuel(obj.fuelType),
              transmission: translateTransmission(obj.vehicleTransmission),
              driveType: translateDriveType(obj.driveWheelConfiguration),
              bodyType: inferBodyCategory(obj.bodyType, name, null),
              exteriorColor: translateColor(obj.color),
              interiorColor: null,
              doors: obj.numberOfDoors ? Number(obj.numberOfDoors) : null,
              seats: obj.seatingCapacity ? Number(obj.seatingCapacity) : null,
              steering: 'RHD',
              repairHistory: null,
              shakenExpiry: null,
              internalOriginalPriceJpy: priceJpy,
              internalTotalPriceJpy: priceJpy,
              taxStatus: null,
              location: null,
              dealerBranch: null,
              description: typeof obj.description === 'string' ? obj.description.slice(0, 600) : null,
              features: [],
              images: imgArr
                .map((u: unknown) =>
                  typeof u === 'string' ? resolveAbsoluteUrl(u, source.baseUrl) : null,
                )
                .filter((u: string | null): u is string => Boolean(u))
                .slice(0, 8),
              originalListingUrl: listingUrl,
            });
          }
        } catch {
          // Ignore invalid JSON-LD block
        }
      });

      if (vehicles.length === 0) {
        errors.push({
          stage: 'html_parse',
          severity: 'warning',
          message:
            'No parseable public Schema.org Car/Vehicle listings found. Recommend using an authorized dealer CSV/XML feed.',
          url: source.inventoryUrl,
          httpStatus: res.status,
        });
      }

      return { vehicles, errors, antiBotBlocked: false };
    },
  };
}

// =============================================================================
// 4. AUTHORIZED CSV & XML FEED PARSER
// Allows approved dealers to submit official inventory CSV/XML feeds directly.
// =============================================================================
function parseCsvLines(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }
  return rows;
}

export function parseAuthorizedFeedContent(params: {
  source: DealerSource;
  format: 'csv' | 'xml';
  content: string;
  maxVehicles?: number;
}): AdapterExtractResult {
  const { source, format, content } = params;
  const limit = Math.max(1, Math.min(200, params.maxVehicles ?? 100));
  const vehicles: RawExtractedDealerVehicle[] = [];
  const errors: AdapterExtractResult['errors'] = [];

  const normalizeRecord = (rec: Record<string, string>, idx: number): RawExtractedDealerVehicle | null => {
    const get = (...keys: string[]): string | null => {
      for (const k of keys) {
        const hit = Object.entries(rec).find(([rk]) => rk.toLowerCase() === k.toLowerCase());
        if (hit && hit[1].trim()) return hit[1].trim();
      }
      return null;
    };

    const stockId = get('stock_id', 'stockid', 'id', 'sku') || `${source.id.toUpperCase()}-FEED-${idx + 1}`;
    const listingUrl =
      resolveAbsoluteUrl(get('url', 'listing_url', 'original_listing_url', 'link') || undefined, source.baseUrl) ||
      source.baseUrl;

    const rawMake = get('manufacturer', 'make', 'brand');
    const rawModel = get('model', 'car_name', 'title');
    if (!rawMake && !rawModel) {
      errors.push({
        stage: 'validation',
        severity: 'warning',
        message: `Row ${idx + 1} skipped: missing both manufacturer and model.`,
        url: listingUrl,
        httpStatus: null,
      });
      return null;
    }

    const priceRaw = get('price_jpy', 'price', 'dealer_price_jpy');
    const parsedPrice = priceRaw
      ? parseJapaneseManYenToJpy(priceRaw) ?? (Number(priceRaw.replace(/[^0-9.]/g, '')) || null)
      : null;

    const totalRaw = get('total_price_jpy', 'total_price');
    const parsedTotal = totalRaw
      ? parseJapaneseManYenToJpy(totalRaw) ?? (Number(totalRaw.replace(/[^0-9.]/g, '')) || null)
      : parsedPrice;

    const mileageRaw = get('mileage_km', 'mileage');
    const mileageKm = mileageRaw
      ? parseJapaneseMileageToKm(mileageRaw) ?? (Number(mileageRaw.replace(/[^0-9]/g, '')) || null)
      : null;

    const ccRaw = get('engine_cc', 'engine_capacity', 'displacement');
    const engineCc = ccRaw
      ? parseEngineCc(ccRaw) ?? (Number(ccRaw.replace(/[^0-9]/g, '')) || null)
      : null;

    const yearRaw = get('year', 'manufacturing_year');
    const year = yearRaw ? parseJapaneseYear(yearRaw) : null;

    const rawImgs = get('images', 'image_url', 'photo_url', 'photos') || '';
    const images = rawImgs
      .split(/[|;]/)
      .map((u) => resolveAbsoluteUrl(u.trim(), source.baseUrl))
      .filter((u): u is string => Boolean(u))
      .slice(0, 12);

    const rawFeatures = get('features', 'equipment', 'accessories') || '';
    const features = rawFeatures
      ? rawFeatures.split(/[|;]/).map((f) => f.trim()).filter(Boolean)
      : [];

    const manufacturer = translateMake(rawMake) || rawMake;
    const model = translateModel(rawModel) || rawModel;

    return {
      dedupeKey: makeDedupeKey(source.id, stockId, listingUrl),
      sourceId: source.id,
      sourceDomain: source.domain,
      stockId,
      dealerName: get('dealer_name', 'dealer') || source.name,
      manufacturer,
      model,
      grade: get('grade', 'trim'),
      modelCode: get('model_code', 'katashiki'),
      chassisNumber: get('chassis_number', 'chassis', 'vin'),
      manufacturingYear: year,
      registrationYearMonth: get('registration_year_month', 'registration_date'),
      mileageKm,
      engineCapacityCc: engineCc,
      fuelType: translateFuel(get('fuel', 'fuel_type')) || get('fuel', 'fuel_type'),
      transmission: translateTransmission(get('transmission', 'shift')) || get('transmission', 'shift'),
      driveType: translateDriveType(get('drive', 'drive_type', 'drivetrain')) || get('drive', 'drive_type'),
      bodyType: inferBodyCategory(get('body_type', 'body'), `${manufacturer || ''} ${model || ''}`, engineCc),
      exteriorColor: translateColor(get('exterior_color', 'color')) || get('exterior_color', 'color'),
      interiorColor: translateColor(get('interior_color')) || get('interior_color'),
      doors: get('doors') ? Number(get('doors')) || null : null,
      seats: get('seats') ? Number(get('seats')) || null : null,
      steering: get('steering')?.toUpperCase() === 'LHD' ? 'LHD' : 'RHD',
      repairHistory: translateRepairHistory(get('repair_history', 'accident_history')),
      shakenExpiry: translateShaken(get('shaken', 'shaken_expiry')),
      internalOriginalPriceJpy: parsedPrice && parsedPrice > 0 ? Math.round(parsedPrice) : null,
      internalTotalPriceJpy: parsedTotal && parsedTotal > 0 ? Math.round(parsedTotal) : null,
      taxStatus: get('tax_status'),
      location: translatePrefecture(get('location', 'prefecture')) || get('location', 'prefecture'),
      dealerBranch: get('dealer_branch', 'branch'),
      description: get('description', 'notes'),
      features,
      images,
      originalListingUrl: listingUrl,
    };
  };

  if (format === 'csv') {
    const rows = parseCsvLines(content);
    if (rows.length < 2) {
      errors.push({
        stage: 'feed_parse',
        severity: 'error',
        message: 'CSV feed must contain a header row and at least one vehicle row.',
        url: source.feedUrl,
        httpStatus: null,
      });
      return { vehicles, errors, antiBotBlocked: false };
    }
    const headers = rows[0];
    for (let r = 1; r < rows.length && vehicles.length < limit; r += 1) {
      const rec: Record<string, string> = {};
      headers.forEach((h, i) => {
        rec[h] = rows[r][i] || '';
      });
      const v = normalizeRecord(rec, r - 1);
      if (v) vehicles.push(v);
    }
  } else {
    const $ = cheerio.load(content, { xmlMode: true });
    const nodes = $('vehicle, car, item, listing');
    if (nodes.length === 0) {
      errors.push({
        stage: 'feed_parse',
        severity: 'error',
        message: 'XML feed did not contain <vehicle>, <car>, <item>, or <listing> nodes.',
        url: source.feedUrl,
        httpStatus: null,
      });
      return { vehicles, errors, antiBotBlocked: false };
    }
    nodes.each((idx, node) => {
      if (vehicles.length >= limit) return false;
      const rec: Record<string, string> = {};
      $(node)
        .children()
        .each((__, child) => {
          const tag = child.tagName;
          if (tag) rec[tag] = $(child).text().trim();
        });
      const v = normalizeRecord(rec, idx);
      if (v) vehicles.push(v);
    });
  }

  return { vehicles, errors, antiBotBlocked: false };
}

// =============================================================================
// Independent Adapter Registry — 1 Adapter per Candidate Dealer Website
// =============================================================================
export const DEALER_ADAPTERS: Record<string, DealerAdapter> = {
  flexnet: flexnetAdapter,
  applenet: applenetAdapter,
  gulliver: createJsonLdCandidateAdapter('gulliver', 'Gulliver'),
  nextage: createJsonLdCandidateAdapter('nextage', 'Nextage'),
  wecars: createJsonLdCandidateAdapter('wecars', 'WECARS'),
  suvland: createJsonLdCandidateAdapter('suvland', 'SUV LAND'),
  carchs: createJsonLdCandidateAdapter('carchs', 'Carchs'),
  erabbit: createJsonLdCandidateAdapter('erabbit', 'Rabbit'),
  carseven: createJsonLdCandidateAdapter('carseven', 'Car Seven'),
  kpnice: createJsonLdCandidateAdapter('kpnice', 'Kei-P-Nice'),
  kbrand: createJsonLdCandidateAdapter('kbrand', 'K-Brand'),
  toyota_ucar: createJsonLdCandidateAdapter('toyota_ucar', 'Toyota U-Car'),
  honda_ucar: createJsonLdCandidateAdapter('honda_ucar', 'Honda U-Select'),
  nissan_ucar: createJsonLdCandidateAdapter('nissan_ucar', 'Nissan U-Car'),
  suzuki_ucar: createJsonLdCandidateAdapter('suzuki_ucar', 'Suzuki U-Car'),
  mazda_ucar: createJsonLdCandidateAdapter('mazda_ucar', 'Mazda U-Car'),
  sugdas: createJsonLdCandidateAdapter('sugdas', 'Subaru SUGDAS'),
  daihatsu_ucar: createJsonLdCandidateAdapter('daihatsu_ucar', 'Daihatsu U-Catch'),
  mitsubishi_ucar: createJsonLdCandidateAdapter('mitsubishi_ucar', 'Mitsubishi U-Car'),
  lexus_cpo: createJsonLdCandidateAdapter('lexus_cpo', 'Lexus CPO'),
  carsensor: createJsonLdCandidateAdapter('carsensor', 'CarSensor'),
  goonet: createJsonLdCandidateAdapter('goonet', 'Goo-net'),
};

export function getDealerAdapter(adapterKey: string): DealerAdapter {
  return DEALER_ADAPTERS[adapterKey] || createJsonLdCandidateAdapter(adapterKey, adapterKey);
}
