import {
  computePublicEstimatedFob,
  DEFAULT_DEALER_PRICING_RULES,
  estimateVehicleVolumeM3,
} from '../../src/data/dealerPricing';
import type {
  DealerImportError,
  DealerPricingRules,
  DealerSource,
  DealerStockVehicle,
} from '../../src/types/portal';
import {
  getDealerAdapter,
  parseAuthorizedFeedContent,
  type RawExtractedDealerVehicle,
} from './adapters';
import { checkRobotsAllowance, politeFetchHtml } from './robotsCompliance';
import { validateSafeExternalUrl } from './sourceRegistry';

let emergencyStopActive = false;

export function setEmergencyStop(active: boolean): boolean {
  emergencyStopActive = Boolean(active);
  return emergencyStopActive;
}

export function isEmergencyStopActive(): boolean {
  return emergencyStopActive;
}

export interface SourceAuditReport {
  sourceId: string;
  auditedAt: string;
  urlValid: boolean;
  robotsAllowed: boolean;
  robotsStatus: number;
  robotsSummary: string;
  httpStatus: number | null;
  antiBotDetected: boolean;
  complianceStatus: DealerSource['complianceStatus'];
  recommendation: string;
  sampleExtractedCount: number;
  sampleVehicles: DealerStockVehicle[];
  verifiedRealExtraction: boolean;
  errors: Array<Omit<DealerImportError, 'id' | 'createdAt'>>;
}

export interface ServerExtractedPriceRecord {
  vehicleId: string;
  dedupeKey: string;
  sourceId: string;
  stockId: string;
  vehicleTitle: string;
  originalDealerPriceJpy: number | null;
  totalDealerPriceJpy: number | null;
  estimatedFobUsd: number | null;
}

export interface DealerExtractionBatchResult {
  ok: boolean;
  aborted: boolean;
  sourceId: string;
  sourceName: string;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  sourceFailedToLoad: boolean;
  complianceAllowed: boolean;
  complianceReason: string;
  vehicles: DealerStockVehicle[];
  priceRecords: ServerExtractedPriceRecord[];
  duplicateSkippedCount: number;
  errors: Array<Omit<DealerImportError, 'id' | 'createdAt'>>;
}

function toPublicDealerVehicle(
  raw: RawExtractedDealerVehicle,
  pricingRules: DealerPricingRules,
  liveJpyRate?: number,
  nowIso?: string
): { vehicle: DealerStockVehicle; priceRecord: ServerExtractedPriceRecord } {
  const ts = nowIso || new Date().toISOString();
  const { estimatedFobUsd, estimatedFobJpy } = computePublicEstimatedFob({
    originalDealerPriceJpy: raw.internalOriginalPriceJpy,
    rules: pricingRules,
    liveJpyPerUsd: liveJpyRate,
  });

  const vehicle: DealerStockVehicle = {
    id: raw.dedupeKey,
    dedupeKey: raw.dedupeKey,
    sourceId: raw.sourceId,
    sourceDomain: raw.sourceDomain,
    stockId: raw.stockId,
    dealerName: raw.dealerName,
    manufacturer: raw.manufacturer,
    model: raw.model,
    grade: raw.grade,
    modelCode: raw.modelCode,
    chassisNumber: raw.chassisNumber,
    manufacturingYear: raw.manufacturingYear,
    registrationYearMonth: raw.registrationYearMonth,
    mileageKm: raw.mileageKm,
    engineCapacityCc: raw.engineCapacityCc,
    fuelType: raw.fuelType,
    transmission: raw.transmission,
    driveType: raw.driveType,
    bodyType: raw.bodyType,
    exteriorColor: raw.exteriorColor,
    interiorColor: raw.interiorColor,
    doors: raw.doors,
    seats: raw.seats,
    steering: raw.steering,
    repairHistory: raw.repairHistory,
    shakenExpiry: raw.shakenExpiry,
    estimatedFobUsd,
    estimatedFobJpy,
    taxStatus: raw.taxStatus,
    location: raw.location,
    dealerBranch: raw.dealerBranch,
    description: raw.description,
    features: raw.features,
    images: raw.images,
    originalListingUrl: raw.originalListingUrl,
    status: 'available',
    featured: false,
    volumeM3: estimateVehicleVolumeM3(raw.bodyType),
    lastSeenAt: ts,
    syncedAt: ts,
    isPriceEstimate: true,
  };

  const title = [raw.manufacturingYear, raw.manufacturer, raw.model, raw.grade]
    .filter(Boolean)
    .join(' ') || raw.stockId;

  return {
    vehicle,
    priceRecord: {
      vehicleId: vehicle.id,
      dedupeKey: vehicle.dedupeKey,
      sourceId: vehicle.sourceId,
      stockId: vehicle.stockId,
      vehicleTitle: title,
      originalDealerPriceJpy: raw.internalOriginalPriceJpy,
      totalDealerPriceJpy: raw.internalTotalPriceJpy,
      estimatedFobUsd,
    },
  };
}

export async function auditDealerSource(
  source: DealerSource,
  pricingRules: DealerPricingRules = DEFAULT_DEALER_PRICING_RULES,
  liveJpyRate?: number
): Promise<SourceAuditReport> {
  const auditedAt = new Date().toISOString();
  const errors: Array<Omit<DealerImportError, 'id' | 'createdAt'>> = [];

  const urlCheck = validateSafeExternalUrl(source.inventoryUrl, true);
  if (!urlCheck.ok) {
    errors.push({
      sourceId: source.id,
      sourceName: source.name,
      stage: 'validation',
      severity: 'error',
      message: urlCheck.reason,
      url: source.inventoryUrl,
      httpStatus: null,
      occurredAt: auditedAt,
    });
    return {
      sourceId: source.id,
      auditedAt,
      urlValid: false,
      robotsAllowed: false,
      robotsStatus: 0,
      robotsSummary: urlCheck.reason,
      httpStatus: null,
      antiBotDetected: false,
      complianceStatus: 'prohibited',
      recommendation: 'Use an allowlisted Japanese dealer domain or an authorized CSV/XML feed.',
      sampleExtractedCount: 0,
      sampleVehicles: [],
      verifiedRealExtraction: false,
      errors,
    };
  }

  // Respect aggregator ToS explicitly
  if (source.id === 'carsensor' || source.id === 'goonet') {
    return {
      sourceId: source.id,
      auditedAt,
      urlValid: true,
      robotsAllowed: false,
      robotsStatus: 200,
      robotsSummary: 'Aggregator Terms of Service prohibit unauthorized commercial scraping.',
      httpStatus: 200,
      antiBotDetected: false,
      complianceStatus: 'prohibited',
      recommendation: 'Keep disabled. Use official Web API or direct dealer XML/CSV inventory feeds.',
      sampleExtractedCount: 0,
      sampleVehicles: [],
      verifiedRealExtraction: false,
      errors,
    };
  }

  const robots = await checkRobotsAllowance(source.inventoryUrl);
  if (!robots.allowed) {
    errors.push({
      sourceId: source.id,
      sourceName: source.name,
      stage: 'robots_check',
      severity: 'warning',
      message: robots.summary,
      url: source.inventoryUrl,
      httpStatus: robots.robotsStatus || null,
      occurredAt: auditedAt,
    });
    return {
      sourceId: source.id,
      auditedAt,
      urlValid: true,
      robotsAllowed: false,
      robotsStatus: robots.robotsStatus,
      robotsSummary: robots.summary,
      httpStatus: robots.robotsStatus || null,
      antiBotDetected: robots.robotsStatus === 403,
      complianceStatus: robots.robotsStatus === 403 ? 'blocked' : 'prohibited',
      recommendation: 'Keep disabled to honor robots.txt. Request an authorized dealer CSV/XML feed.',
      sampleExtractedCount: 0,
      sampleVehicles: [],
      verifiedRealExtraction: false,
      errors,
    };
  }

  // Run dry-run sample extraction (max 5 vehicles) to verify real HTML / JSON-LD accessibility
  const adapter = getDealerAdapter(source.adapterKey);
  const extracted = await adapter.extract(
    {
      ...source,
      rateLimitMs: Math.max(source.rateLimitMs || 1500, robots.crawlDelayMs || 1500),
    },
    { maxVehicles: 5, shouldAbort: () => emergencyStopActive }
  );

  for (const e of extracted.errors) {
    errors.push({
      sourceId: source.id,
      sourceName: source.name,
      stage: e.stage,
      severity: e.severity,
      message: e.message,
      url: e.url,
      httpStatus: e.httpStatus,
      occurredAt: auditedAt,
    });
  }

  const sampleVehicles = extracted.vehicles.map(
    (raw) => toPublicDealerVehicle(raw, pricingRules, liveJpyRate, auditedAt).vehicle
  );

  let complianceStatus: DealerSource['complianceStatus'] = 'pending_review';
  let recommendation = 'Verify Terms of Service or request an authorized CSV/XML feed.';

  if (extracted.antiBotBlocked) {
    complianceStatus = 'blocked';
    recommendation = 'Anti-bot / WAF detected. Never bypass — keep disabled and request an authorized dealer feed.';
  } else if (extracted.errors.some((e) => e.stage === 'http_fetch' && e.httpStatus === null)) {
    complianceStatus = 'unreachable';
    recommendation = 'Host unreachable from server network. Use an authorized dealer CSV/XML feed.';
  } else if (sampleVehicles.length > 0 && adapter.verifiedParser) {
    complianceStatus = 'verified_compliant';
    recommendation = `Verified real extraction (${sampleVehicles.length} sample listings parsed cleanly under robots.txt).`;
  } else if (sampleVehicles.length > 0) {
    complianceStatus = 'pending_review';
    recommendation = 'Structured data detected — review dealer Terms of Service before activating.';
  }

  return {
    sourceId: source.id,
    auditedAt,
    urlValid: true,
    robotsAllowed: robots.allowed,
    robotsStatus: robots.robotsStatus,
    robotsSummary: robots.summary,
    httpStatus: extracted.errors[0]?.httpStatus ?? 200,
    antiBotDetected: extracted.antiBotBlocked,
    complianceStatus,
    recommendation,
    sampleExtractedCount: sampleVehicles.length,
    sampleVehicles,
    verifiedRealExtraction: sampleVehicles.length > 0,
    errors,
  };
}

export async function runDealerSourceExtraction(params: {
  source: DealerSource;
  maxVehicles?: number;
  dryRun?: boolean;
  pricingRules?: DealerPricingRules;
  liveJpyRate?: number;
}): Promise<DealerExtractionBatchResult> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const { source } = params;
  const dryRun = Boolean(params.dryRun);
  const pricingRules = params.pricingRules || DEFAULT_DEALER_PRICING_RULES;
  const maxVehicles = Math.max(1, Math.min(100, params.maxVehicles ?? source.maxVehiclesPerSync ?? 50));
  const errors: Array<Omit<DealerImportError, 'id' | 'createdAt'>> = [];

  if (emergencyStopActive || pricingRules.emergencyStop) {
    return {
      ok: false,
      aborted: true,
      sourceId: source.id,
      sourceName: source.name,
      dryRun,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      sourceFailedToLoad: true,
      complianceAllowed: false,
      complianceReason: 'Emergency Stop is currently active. Sync aborted safely.',
      vehicles: [],
      priceRecords: [],
      duplicateSkippedCount: 0,
      errors: [],
    };
  }

  // Handle authorized CSV / XML feed URL if configured
  if (source.sourceType === 'authorized_csv' || source.sourceType === 'authorized_xml') {
    if (!source.feedUrl) {
      return {
        ok: false,
        aborted: false,
        sourceId: source.id,
        sourceName: source.name,
        dryRun,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
        sourceFailedToLoad: true,
        complianceAllowed: false,
        complianceReason: 'Authorized feed URL is not configured.',
        vehicles: [],
        priceRecords: [],
        duplicateSkippedCount: 0,
        errors,
      };
    }

    const res = await politeFetchHtml({
      url: source.feedUrl,
      rateLimitMs: source.rateLimitMs,
      requireAllowlist: false,
    });
    if (!res.ok) {
      errors.push({
        sourceId: source.id,
        sourceName: source.name,
        stage: 'http_fetch',
        severity: 'error',
        message: res.error || 'Failed to download authorized feed',
        url: source.feedUrl,
        httpStatus: res.status || null,
        occurredAt: new Date().toISOString(),
      });
      return {
        ok: false,
        aborted: false,
        sourceId: source.id,
        sourceName: source.name,
        dryRun,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
        sourceFailedToLoad: true,
        complianceAllowed: true,
        complianceReason: 'Authorized feed failed to load — existing listings preserved as unverified.',
        vehicles: [],
        priceRecords: [],
        duplicateSkippedCount: 0,
        errors,
      };
    }

    const parsed = parseAuthorizedFeedContent({
      source,
      format: source.sourceType === 'authorized_csv' ? 'csv' : 'xml',
      content: res.html,
      maxVehicles,
    });
    return finalizeExtractionBatch({
      source,
      rawVehicles: parsed.vehicles,
      rawErrors: parsed.errors,
      pricingRules,
      liveJpyRate: params.liveJpyRate,
      dryRun,
      startedAt,
      startMs,
      complianceReason: 'Authorized dealer feed parsed cleanly.',
    });
  }

  // Block known ToS-prohibited aggregators from HTML scraping
  if (source.id === 'carsensor' || source.id === 'goonet') {
    return {
      ok: false,
      aborted: false,
      sourceId: source.id,
      sourceName: source.name,
      dryRun,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      sourceFailedToLoad: true,
      complianceAllowed: false,
      complianceReason:
        'Aggregator Terms of Service prohibit automated scraping. Use official API or direct dealer XML/CSV feed.',
      vehicles: [],
      priceRecords: [],
      duplicateSkippedCount: 0,
      errors,
    };
  }

  // Mandatory robots.txt compliance check before any HTML extraction
  const robots = await checkRobotsAllowance(source.inventoryUrl);
  if (!robots.allowed) {
    errors.push({
      sourceId: source.id,
      sourceName: source.name,
      stage: 'robots_check',
      severity: 'warning',
      message: robots.summary,
      url: source.inventoryUrl,
      httpStatus: robots.robotsStatus || null,
      occurredAt: new Date().toISOString(),
    });
    return {
      ok: false,
      aborted: false,
      sourceId: source.id,
      sourceName: source.name,
      dryRun,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      sourceFailedToLoad: true,
      complianceAllowed: false,
      complianceReason: robots.summary,
      vehicles: [],
      priceRecords: [],
      duplicateSkippedCount: 0,
      errors,
    };
  }

  const adapter = getDealerAdapter(source.adapterKey);
  const extracted = await adapter.extract(
    {
      ...source,
      rateLimitMs: Math.max(source.rateLimitMs || 1500, robots.crawlDelayMs || 1500),
    },
    { maxVehicles, shouldAbort: () => emergencyStopActive }
  );

  if (extracted.antiBotBlocked) {
    for (const e of extracted.errors) {
      errors.push({
        sourceId: source.id,
        sourceName: source.name,
        stage: e.stage,
        severity: 'error',
        message: e.message,
        url: e.url,
        httpStatus: e.httpStatus,
        occurredAt: new Date().toISOString(),
      });
    }
    return {
      ok: false,
      aborted: false,
      sourceId: source.id,
      sourceName: source.name,
      dryRun,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      sourceFailedToLoad: true,
      complianceAllowed: false,
      complianceReason: 'Anti-bot / access restriction encountered. Source disabled; never bypassed.',
      vehicles: [],
      priceRecords: [],
      duplicateSkippedCount: 0,
      errors,
    };
  }

  return finalizeExtractionBatch({
    source,
    rawVehicles: extracted.vehicles,
    rawErrors: extracted.errors,
    pricingRules,
    liveJpyRate: params.liveJpyRate,
    dryRun,
    startedAt,
    startMs,
    complianceReason: robots.summary,
  });
}

export function runManualFeedImport(params: {
  source: DealerSource;
  format: 'csv' | 'xml';
  content: string;
  pricingRules?: DealerPricingRules;
  liveJpyRate?: number;
  maxVehicles?: number;
}): DealerExtractionBatchResult {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const parsed = parseAuthorizedFeedContent({
    source: params.source,
    format: params.format,
    content: params.content,
    maxVehicles: params.maxVehicles ?? 100,
  });

  return finalizeExtractionBatch({
    source: params.source,
    rawVehicles: parsed.vehicles,
    rawErrors: parsed.errors,
    pricingRules: params.pricingRules || DEFAULT_DEALER_PRICING_RULES,
    liveJpyRate: params.liveJpyRate,
    dryRun: false,
    startedAt,
    startMs,
    complianceReason: `Authorized ${params.format.toUpperCase()} feed imported cleanly.`,
  });
}

function finalizeExtractionBatch(params: {
  source: DealerSource;
  rawVehicles: RawExtractedDealerVehicle[];
  rawErrors: Array<{
    stage: 'http_fetch' | 'html_parse' | 'feed_parse' | 'validation';
    severity: 'warning' | 'error';
    message: string;
    url: string | null;
    httpStatus: number | null;
  }>;
  pricingRules: DealerPricingRules;
  liveJpyRate?: number;
  dryRun: boolean;
  startedAt: string;
  startMs: number;
  complianceReason: string;
}): DealerExtractionBatchResult {
  const nowIso = new Date().toISOString();
  const seenKeys = new Set<string>();
  const vehicles: DealerStockVehicle[] = [];
  const priceRecords: ServerExtractedPriceRecord[] = [];
  let duplicateSkippedCount = 0;

  for (const raw of params.rawVehicles) {
    if (seenKeys.has(raw.dedupeKey)) {
      duplicateSkippedCount += 1;
      continue;
    }
    seenKeys.add(raw.dedupeKey);
    const converted = toPublicDealerVehicle(raw, params.pricingRules, params.liveJpyRate, nowIso);
    vehicles.push(converted.vehicle);
    priceRecords.push(converted.priceRecord);
  }

  const errors: Array<Omit<DealerImportError, 'id' | 'createdAt'>> = params.rawErrors.map((e) => ({
    sourceId: params.source.id,
    sourceName: params.source.name,
    stage: e.stage,
    severity: e.severity,
    message: e.message,
    url: e.url,
    httpStatus: e.httpStatus,
    occurredAt: nowIso,
  }));

  const sourceFailedToLoad =
    vehicles.length === 0 && errors.some((e) => e.stage === 'http_fetch' || e.severity === 'error');

  return {
    ok: !sourceFailedToLoad,
    aborted: emergencyStopActive,
    sourceId: params.source.id,
    sourceName: params.source.name,
    dryRun: params.dryRun,
    startedAt: params.startedAt,
    finishedAt: nowIso,
    durationMs: Date.now() - params.startMs,
    sourceFailedToLoad,
    complianceAllowed: true,
    complianceReason: params.complianceReason,
    vehicles,
    priceRecords,
    duplicateSkippedCount,
    errors,
  };
}
