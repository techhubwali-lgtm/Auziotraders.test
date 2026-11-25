/**
 * Live Maritime Vessel Number Lookup & Real-Time AIS Resolver
 *
 * Resolves real ships globally by:
 *   - 7-digit IMO Number (e.g. 9700524)
 *   - 9-digit MMSI Number (e.g. 265012000)
 *   - Vessel Name (e.g. TRAVIATA, HOEGH TARGET, MORNING LILY)
 *
 * Resolution Strategy (100% real maritime telemetry — zero mock positions):
 *   1. Checks live AISStream WebSocket telemetry cache first for fresh (< 15 min) positions.
 *   2. Queries real-time VesselFinder AIS endpoints (details page + /api/pub/ml binary AIS position +
 *      /api/pub/click telemetry + /api/pub/vi2 port call data) to obtain exact coordinates, speed,
 *      course, destination, ETA, IMO, MMSI, call sign, vessel type, flag, and last port.
 *   3. Cross-validates high-precision binary coordinates against page coordinates before accepting.
 *   4. Registers resolved 9-digit MMSIs with AISStream in the background so continuous WebSocket
 *      updates flow automatically whenever AISStream is reachable.
 */

import { aisStreamManager, type LiveVesselTelemetry } from './aisStreamService.ts';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const VF_BASE = 'https://www.vesselfinder.com';
const REQUEST_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_CACHE_ENTRIES = 120;

export type VesselQueryType = 'imo' | 'mmsi' | 'name';

export interface VesselSearchCandidate {
  imo: string;
  mmsi: string;
  name: string;
  vesselType: string;
  flag: string;
  yearBuilt: string;
  detailId: string;
}

export interface VesselLookupResult {
  ok: boolean;
  query: string;
  queryType: VesselQueryType;
  vessel: LiveVesselTelemetry | null;
  candidates: VesselSearchCandidate[];
  source: 'aisstream' | 'global_ais' | 'none';
  message: string;
}

interface CacheEntry {
  expiresAt: number;
  result: VesselLookupResult;
}

const lookupCache = new Map<string, CacheEntry>();

function setCache(key: string, result: VesselLookupResult) {
  if (lookupCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = lookupCache.keys().next().value;
    if (oldest) lookupCache.delete(oldest);
  }
  lookupCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result });
}

function getCache(key: string): VesselLookupResult | null {
  const entry = lookupCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    lookupCache.delete(key);
    return null;
  }
  return entry.result;
}

async function fetchWithTimeout(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers,
      },
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '));
}

function mapNavStatusTextToCode(text: string): number | null {
  const lower = text.toLowerCase();
  if (!lower) return null;
  if (lower.includes('under way using engine') || lower === 'under way') return 0;
  if (lower.includes('anchor')) return 1;
  if (lower.includes('not under command')) return 2;
  if (lower.includes('restricted')) return 3;
  if (lower.includes('draught')) return 4;
  if (lower.includes('moored')) return 5;
  if (lower.includes('aground')) return 6;
  if (lower.includes('fishing')) return 7;
  if (lower.includes('sailing')) return 8;
  return null;
}

function formatUnixEtaUtc(unixSeconds: number | undefined): string {
  if (!unixSeconds || !Number.isFinite(unixSeconds) || unixSeconds <= 0) return '';
  const d = new Date(unixSeconds * 1000);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${mon} ${day}, ${hh}:${mm} UTC`;
}

export function normalizeVesselQuery(raw: string): {
  cleaned: string;
  digitsOnly: string;
  queryType: VesselQueryType;
} {
  const trimmed = String(raw || '')
    .trim()
    .replace(/^(?:imo|mmsi)\s*[:#-]?\s*/i, '')
    .trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  // Purely numeric or prefix + digits
  if (/^\d{9}$/.test(trimmed) || (/^[\d\s-]+$/.test(trimmed) && digitsOnly.length === 9)) {
    return { cleaned: digitsOnly, digitsOnly, queryType: 'mmsi' };
  }
  if (/^\d{7}$/.test(trimmed) || (/^[\d\s-]+$/.test(trimmed) && digitsOnly.length === 7)) {
    return { cleaned: digitsOnly, digitsOnly, queryType: 'imo' };
  }
  return { cleaned: trimmed, digitsOnly, queryType: 'name' };
}

interface VfDjson {
  v?: boolean;
  lrpd?: string;
  mmsi?: number | string;
  ship_lat?: number;
  ship_lon?: number;
  ship_cog?: number;
  ship_sog?: number;
  ship_type?: number;
}

interface VfClickJson {
  ss?: number;
  cu?: number;
  imo?: number;
  dest?: string;
  type?: string;
  country?: string;
  etaTS?: number;
  name?: string;
  y?: number;
  ts?: number;
}

interface VfVi2Json {
  npde?: string;
  npe?: number;
  rpdna?: string;
  rpdco?: string;
  rpdatd?: number;
}

/**
 * Fetches exact 5-decimal live AIS position from VesselFinder's binary /api/pub/ml/{mmsi}
 * packet (Int32BE lon at byte 3 / 600000, Int32BE lat at byte 7 / 600000) and cross-validates
 * against the page's approximate djson coordinates.
 */
async function fetchExactBinaryPosition(
  mmsi: string,
  approxLat: number | null,
  approxLon: number | null
): Promise<{ latitude: number; longitude: number; name?: string } | null> {
  if (!/^\d{9}$/.test(mmsi)) return null;
  try {
    const res = await fetchWithTimeout(`${VF_BASE}/api/pub/ml/${mmsi}`, {
      Referer: `${VF_BASE}/`,
      Accept: '*/*',
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 12) return null;

    const lon = buf.readInt32BE(3) / 600000;
    const lat = buf.readInt32BE(7) / 600000;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    if (lat === 0 && lon === 0) return null;

    // Cross-validate against approximate integer coordinates when available
    if (approxLat !== null && approxLon !== null) {
      const latDiff = Math.abs(lat - approxLat);
      const lonDiff = Math.min(Math.abs(lon - approxLon), 360 - Math.abs(lon - approxLon));
      if (latDiff > 2.5 || lonDiff > 2.5) {
        return null;
      }
    }

    let name: string | undefined;
    const nameLen = buf[11];
    if (nameLen > 0 && nameLen <= 40 && 12 + nameLen <= buf.length) {
      const decoded = buf.subarray(12, 12 + nameLen).toString('utf8').trim();
      if (/^[\x20-\x7E]+$/.test(decoded)) {
        name = decoded;
      }
    }

    return {
      latitude: Number(lat.toFixed(5)),
      longitude: Number(lon.toFixed(5)),
      name,
    };
  } catch {
    return null;
  }
}

async function fetchClickJson(mmsi: string): Promise<VfClickJson | null> {
  if (!/^\d{9}$/.test(mmsi)) return null;
  try {
    const res = await fetchWithTimeout(`${VF_BASE}/api/pub/click/${mmsi}`, {
      Referer: `${VF_BASE}/`,
      Accept: 'application/json',
    });
    if (!res.ok) return null;
    return (await res.json()) as VfClickJson;
  } catch {
    return null;
  }
}

async function fetchPortCallJson(mmsi: string): Promise<VfVi2Json | null> {
  if (!/^\d{9}$/.test(mmsi)) return null;
  try {
    const res = await fetchWithTimeout(`${VF_BASE}/api/pub/vi2/${mmsi}`, {
      Referer: `${VF_BASE}/`,
      Accept: 'application/json',
    });
    if (!res.ok) return null;
    return (await res.json()) as VfVi2Json;
  } catch {
    return null;
  }
}

function parseDetailHtml(html: string): {
  djson: VfDjson | null;
  imo: string;
  mmsi: string;
  vesselName: string;
  callSign: string;
  vesselType: string;
  flag: string;
  destinationName: string;
  etaText: string;
  lastPort: string;
  navStatusText: string;
  lastUpdateUtc: string;
  positionReceivedAgo: string;
} | null {
  if (!html || !html.includes('vesselfinder') || /<title>\s*Error 404/i.test(html)) {
    return null;
  }

  let djson: VfDjson | null = null;
  const djsonMatch =
    html.match(/id="djson"[^>]*data-json='([^']+)'/i) ||
    html.match(/id="djson"[^>]*data-json="([^"]+)"/i);
  if (djsonMatch) {
    try {
      djson = JSON.parse(decodeHtmlEntities(djsonMatch[1])) as VfDjson;
    } catch {
      djson = null;
    }
  }

  // Extract IMO / MMSI from table or scripts
  const imoMmsiMatch = html.match(/IMO\s*\/\s*MMSI<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
  let imo = '';
  let mmsi = djson?.mmsi ? String(djson.mmsi).trim() : '';

  if (imoMmsiMatch) {
    const parts = imoMmsiMatch[1].split('/').map((s) => s.replace(/\D/g, '').trim());
    if (parts[0] && /^\d{7}$/.test(parts[0])) imo = parts[0];
    if (parts[1] && /^\d{9}$/.test(parts[1])) mmsi = parts[1];
  }

  if (!imo) {
    const scriptImo = html.match(/var\s+vu_imo\s*=\s*(\d{7})/);
    if (scriptImo) imo = scriptImo[1];
  }
  if (!mmsi) {
    const scriptMmsi = html.match(/var\s+MMSI\s*=\s*(\d{9})/);
    if (scriptMmsi) mmsi = scriptMmsi[1];
  }

  // Extract title & h1 vessel name
  const h1Match = html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let vesselName = h1Match ? stripTags(h1Match[1]) : '';
  if (!vesselName) {
    const titleMatch = html.match(/<title>([^,<]+)/i);
    if (titleMatch) vesselName = decodeHtmlEntities(titleMatch[1]);
  }

  if (!mmsi && !imo && !vesselName) return null;

  const tableValue = (label: string): string => {
    const rx = new RegExp(`${label}<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i');
    const m = html.match(rx);
    return m ? stripTags(m[1]) : '';
  };

  const callSign = tableValue('Callsign');
  const flag = tableValue('AIS Flag') || tableValue('Flag');
  const aisType = tableValue('AIS Type');

  // Vessel type from meta description or subtitle
  const subtitleMatch = html.match(/<h2[^>]*class="[^"]*vst[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
  const vesselType = subtitleMatch
    ? stripTags(subtitleMatch[1]).split(',')[0].trim()
    : aisType || 'Cargo / Export Vessel';

  // Navigation status (prefer full data-title text)
  const navBlockMatch = html.match(/Navigation Status<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  let navStatusText = '';
  if (navBlockMatch) {
    const titleAttr = navBlockMatch[1].match(/data-title="([^"]+)"/i);
    navStatusText = titleAttr ? decodeHtmlEntities(titleAttr[1]) : stripTags(navBlockMatch[1]);
  }

  // Position Received UTC timestamp + relative text
  const lastRepMatch = html.match(/id="lastrep"[^>]*>([\s\S]*?)<\/td>/i);
  let lastUpdateUtc = '';
  let positionReceivedAgo = djson?.lrpd ? djson.lrpd.trim() : '';
  if (lastRepMatch) {
    const utcAttr = lastRepMatch[1].match(/data-title="([^"]+)"/i);
    if (utcAttr) lastUpdateUtc = decodeHtmlEntities(utcAttr[1]);
    if (!positionReceivedAgo) positionReceivedAgo = stripTags(lastRepMatch[1]);
  }

  // Destination & ETA block
  const destBlock = html.match(/<div class="vilabel">Destination<\/div>([\s\S]*?)<\/div>\s*<\/div>/i);
  let destinationName = '';
  let etaText = '';
  if (destBlock) {
    const portLink = destBlock[1].match(/<a[^>]*class="[^"]*_npNa[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
      destBlock[1].match(/<div[^>]*class="[^"]*_npNa[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (portLink) destinationName = stripTags(portLink[1]);
    const etaVal = destBlock[1].match(/<div[^>]*class="[^"]*_value[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (etaVal) {
      etaText = stripTags(etaVal[1]).replace(/^ETA:\s*/i, '').trim();
    }
  }

  // Last Port block
  const lastPortBlock = html.match(/<div class="vilabel">Last Port<\/div>([\s\S]*?)<\/div>\s*<\/div>/i);
  let lastPort = '';
  if (lastPortBlock) {
    const lpLink = lastPortBlock[1].match(/<a[^>]*class="[^"]*_npNa[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (lpLink) lastPort = stripTags(lpLink[1]);
  }

  return {
    djson,
    imo,
    mmsi,
    vesselName,
    callSign,
    vesselType,
    flag,
    destinationName,
    etaText,
    lastPort,
    navStatusText,
    lastUpdateUtc,
    positionReceivedAgo,
  };
}

async function resolveVesselByDetailId(detailId: string): Promise<LiveVesselTelemetry | null> {
  const cleanId = detailId.replace(/[^0-9A-Za-z-]/g, '');
  if (!cleanId) return null;

  const detailRes = await fetchWithTimeout(`${VF_BASE}/vessels/details/${cleanId}`, {
    Accept: 'text/html,application/xhtml+xml,*/*',
  });
  if (!detailRes.ok) return null;

  const html = await detailRes.text();
  const parsed = parseDetailHtml(html);
  if (!parsed) return null;

  const mmsi = parsed.mmsi;
  const approxLat =
    typeof parsed.djson?.ship_lat === 'number' && Number.isFinite(parsed.djson.ship_lat)
      ? parsed.djson.ship_lat
      : null;
  const approxLon =
    typeof parsed.djson?.ship_lon === 'number' && Number.isFinite(parsed.djson.ship_lon)
      ? parsed.djson.ship_lon
      : null;

  // Fetch pinpoint coordinates + click JSON + port call metadata in parallel
  const [binaryPos, clickData, vi2Data] = await Promise.all([
    fetchExactBinaryPosition(mmsi, approxLat, approxLon),
    fetchClickJson(mmsi),
    fetchPortCallJson(mmsi),
  ]);

  const latitude = binaryPos?.latitude ?? approxLat;
  const longitude = binaryPos?.longitude ?? approxLon;

  const speedKnots =
    typeof clickData?.ss === 'number' && clickData.ss >= 0 && clickData.ss <= 102.2
      ? Number(clickData.ss.toFixed(1))
      : typeof parsed.djson?.ship_sog === 'number' && parsed.djson.ship_sog >= 0
        ? Number(parsed.djson.ship_sog.toFixed(1))
        : null;

  const courseDeg =
    typeof clickData?.cu === 'number' && clickData.cu >= 0 && clickData.cu < 360
      ? Number(clickData.cu.toFixed(1))
      : typeof parsed.djson?.ship_cog === 'number' &&
          parsed.djson.ship_cog >= 0 &&
          parsed.djson.ship_cog < 360
        ? Number(parsed.djson.ship_cog.toFixed(1))
        : null;

  const imo =
    parsed.imo ||
    (clickData?.imo && clickData.imo > 1000000 ? String(clickData.imo) : '') ||
    (/^\d{7}$/.test(cleanId) ? cleanId : '');

  const vesselName =
    (clickData?.name && clickData.name !== mmsi ? clickData.name.trim() : '') ||
    binaryPos?.name ||
    parsed.vesselName ||
    (imo ? `Vessel IMO ${imo}` : `Vessel MMSI ${mmsi}`);

  // Combine human-readable destination port name + AIS code
  const aisCode = clickData?.dest?.trim() || vi2Data?.npde?.trim() || '';
  let destination = parsed.destinationName || '';
  if (destination && aisCode && !destination.toUpperCase().includes(aisCode.toUpperCase())) {
    destination = `${destination} (${aisCode})`;
  } else if (!destination && aisCode) {
    destination = aisCode;
  }

  const reportedEta =
    parsed.etaText ||
    formatUnixEtaUtc(clickData?.etaTS) ||
    formatUnixEtaUtc(vi2Data?.npe) ||
    '';

  const lastPort =
    parsed.lastPort ||
    (vi2Data?.rpdna
      ? `${vi2Data.rpdna}${vi2Data.rpdco ? `, ${vi2Data.rpdco}` : ''}`
      : '');

  let lastAisUpdateAt = '';
  if (typeof clickData?.ts === 'number' && clickData.ts > 1500000000) {
    lastAisUpdateAt = new Date(clickData.ts * 1000).toISOString();
  } else if (parsed.lastUpdateUtc) {
    const parsedTs = Date.parse(parsed.lastUpdateUtc);
    if (!Number.isNaN(parsedTs)) {
      lastAisUpdateAt = new Date(parsedTs).toISOString();
    }
  }
  if (!lastAisUpdateAt && latitude !== null && longitude !== null) {
    lastAisUpdateAt = new Date().toISOString();
  }

  return {
    mmsi: mmsi || cleanId,
    vesselName,
    imo,
    callSign: parsed.callSign || '',
    vesselType: (clickData?.type && clickData.type !== 'unknown type' ? clickData.type : '') || parsed.vesselType,
    flag: clickData?.country || parsed.flag || '',
    lastPort,
    positionReceivedAgo: parsed.positionReceivedAgo || '',
    navStatusText: parsed.navStatusText || '',
    latitude,
    longitude,
    speedKnots,
    courseDeg,
    headingDeg: courseDeg !== null ? Math.round(courseDeg) : null,
    navStatus: mapNavStatusTextToCode(parsed.navStatusText),
    destination,
    reportedEta,
    lastAisUpdateAt,
    messageType: 'PositionReport',
    dataSource: 'global_ais',
  };
}

async function searchVesselCandidates(query: string): Promise<VesselSearchCandidate[]> {
  const res = await fetchWithTimeout(
    `${VF_BASE}/vessels?name=${encodeURIComponent(query)}`,
    { Accept: 'text/html,application/xhtml+xml,*/*' }
  );
  if (!res.ok) return [];
  const html = await res.text();

  const tbodyMatch = html.match(/<tbody[\s\S]*?<\/tbody>/i);
  const scope = tbodyMatch ? tbodyMatch[0] : html;
  const rows = [...scope.matchAll(/<tr[\s\S]*?<\/tr>/gi)];

  const candidates: VesselSearchCandidate[] = [];
  const seen = new Set<string>();

  for (const rowMatch of rows) {
    const row = rowMatch[0];
    const linkMatch = row.match(/href="\/vessels\/details\/([^"?#]+)"/i);
    if (!linkMatch) continue;
    const detailId = linkMatch[1].trim();
    if (!detailId || seen.has(detailId)) continue;
    seen.add(detailId);

    const nameMatch = row.match(/<div class="slna">([\s\S]*?)<\/div>/i);
    const typeMatch = row.match(/<div class="slty">([\s\S]*?)<\/div>/i);
    const flagMatch = row.match(/flag-icon[^>]+title="([^"]+)"/i);
    const yearMatch = row.match(/<td class="v3[^"]*">([^<]*)<\/td>/i);
    // Extract MMSI from ship-photo URL if present: /ship-photo/{imo}-{mmsi}-...
    const photoMatch = row.match(/ship-photo\/(\d{7})-(\d{9})-/i);

    const name = nameMatch ? stripTags(nameMatch[1]) : detailId;
    const vesselType = typeMatch ? stripTags(typeMatch[1]) : '';
    const flag = flagMatch ? decodeHtmlEntities(flagMatch[1]) : '';
    const yearBuilt = yearMatch ? stripTags(yearMatch[1]) : '';
    const imo = photoMatch?.[1] || (/^\d{7}$/.test(detailId) ? detailId : '');
    const mmsi = photoMatch?.[2] || (/^\d{9}$/.test(detailId) ? detailId : '');

    candidates.push({
      imo,
      mmsi,
      name,
      vesselType,
      flag,
      yearBuilt,
      detailId,
    });

    if (candidates.length >= 10) break;
  }

  return candidates;
}

/**
 * Main entry point: looks up a vessel by 7-digit IMO, 9-digit MMSI, or Vessel Name.
 */
export async function lookupVesselByQuery(
  rawQuery: string,
  options?: { bypassCache?: boolean }
): Promise<VesselLookupResult> {
  const { cleaned, queryType } = normalizeVesselQuery(rawQuery);

  if (!cleaned || cleaned.length < 2) {
    return {
      ok: false,
      query: rawQuery,
      queryType,
      vessel: null,
      candidates: [],
      source: 'none',
      message: 'Enter a 7-digit IMO number, 9-digit MMSI number, or vessel name (at least 2 characters).',
    };
  }

  const cacheKey = `${queryType}:${cleaned.toLowerCase()}`;
  if (!options?.bypassCache) {
    const cached = getCache(cacheKey);
    if (cached) return cached;
  }

  // 1. Check live AISStream WebSocket telemetry first for fresh (< 15 min) positions
  const liveMap = aisStreamManager.getPositions();
  const liveList = Object.values(liveMap);
  const directAisMatch = liveList.find((v) => {
    if (queryType === 'mmsi') return v.mmsi === cleaned;
    if (queryType === 'imo') return v.imo === cleaned;
    return v.vesselName.toLowerCase() === cleaned.toLowerCase();
  });

  if (
    directAisMatch &&
    directAisMatch.dataSource === 'aisstream' &&
    directAisMatch.latitude !== null &&
    directAisMatch.longitude !== null
  ) {
    const ageMs = Date.now() - Date.parse(directAisMatch.lastAisUpdateAt || '');
    if (Number.isFinite(ageMs) && ageMs < 15 * 60 * 1000) {
      const res: VesselLookupResult = {
        ok: true,
        query: cleaned,
        queryType,
        vessel: directAisMatch,
        candidates: [],
        source: 'aisstream',
        message: `Live AISStream telemetry active for ${directAisMatch.vesselName || `MMSI ${directAisMatch.mmsi}`}.`,
      };
      setCache(cacheKey, res);
      return res;
    }
  }

  // 2. Live Global AIS Resolution (IMO, MMSI, or Vessel Name)
  try {
    let vessel: LiveVesselTelemetry | null = null;
    let candidates: VesselSearchCandidate[] = [];

    if (queryType === 'imo' || queryType === 'mmsi') {
      vessel = await resolveVesselByDetailId(cleaned);

      // If direct detail page failed, search table by number
      if (!vessel) {
        candidates = await searchVesselCandidates(cleaned);
        if (candidates.length > 0) {
          vessel = await resolveVesselByDetailId(candidates[0].detailId);
        }
      }
    } else {
      // Name search
      candidates = await searchVesselCandidates(cleaned);
      if (candidates.length > 0) {
        // Prefer exact name match, or Ro-Ro / Vehicles Carrier if multiple match
        const exact = candidates.find(
          (c) => c.name.toLowerCase() === cleaned.toLowerCase()
        );
        const vehicleCarrier = candidates.find((c) =>
          /vehicle|ro-ro|car carrier/i.test(c.vesselType)
        );
        const best = exact || vehicleCarrier || candidates[0];
        vessel = await resolveVesselByDetailId(best.detailId);
      }
    }

    if (vessel) {
      // Feed telemetry into server cache & register MMSI on AISStream in background
      if (/^\d{9}$/.test(vessel.mmsi)) {
        aisStreamManager.ingestExternalTelemetry(vessel);
        aisStreamManager.registerOnDemandMmsiBackground(vessel.mmsi);
      }

      const hasCoords = vessel.latitude !== null && vessel.longitude !== null;
      const result: VesselLookupResult = {
        ok: true,
        query: cleaned,
        queryType,
        vessel,
        candidates,
        source: 'global_ais',
        message: hasCoords
          ? `Live AIS position located for ${vessel.vesselName}${vessel.imo ? ` (IMO ${vessel.imo})` : ''}${vessel.mmsi ? ` · MMSI ${vessel.mmsi}` : ''}${vessel.positionReceivedAgo ? ` — updated ${vessel.positionReceivedAgo}` : ''}.`
          : `Vessel ${vessel.vesselName} found (IMO ${vessel.imo || '—'}, MMSI ${vessel.mmsi || '—'}), but its AIS transponder has no recent coastal coordinates reported.`,
      };
      setCache(cacheKey, result);
      return result;
    }

    return {
      ok: false,
      query: cleaned,
      queryType,
      vessel: null,
      candidates,
      source: 'none',
      message: `No active vessel found matching "${cleaned}". Check your Bill of Lading for the 7-digit IMO number, 9-digit MMSI number, or exact vessel name.`,
    };
  } catch (err) {
    return {
      ok: false,
      query: cleaned,
      queryType,
      vessel: null,
      candidates: [],
      source: 'none',
      message: `Live maritime lookup failed: ${err instanceof Error ? err.message : 'network error'}. Please try again shortly.`,
    };
  }
}
