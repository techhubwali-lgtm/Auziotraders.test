import { getPortById } from './ports';
import type {
  DealerBodyCategory,
  DealerPricingRules,
  ShippingMethod,
  ShippingPort,
} from '../types/portal';

export const DEFAULT_DEALER_PRICING_RULES: DealerPricingRules = {
  id: 'default',
  fixedMarginUsd: 650,
  percentageMarginPct: 7.5,
  inlandTransportJpy: 45000,
  documentationUsd: 180,
  exportHandlingUsd: 350,
  inspectionDefaultUsd: 220,
  oceanShippingFallbackUsd: 1350,
  marineInsurancePct: 1.5,
  marineInsuranceMinUsd: 120,
  jpyToUsdFallbackRate: 152,
  emergencyStop: false,
  syncIntervalHours: 6,
};

export const DEALER_BODY_CATEGORIES: DealerBodyCategory[] = [
  'SUV',
  'Sedan',
  'Hatchback',
  'Wagon',
  'Minivan',
  'MPV',
  'Coupe',
  'Convertible',
  'Kei Car',
  'Van',
  'Pickup',
  'Truck',
  'Bus',
];

export function estimateVehicleVolumeM3(bodyType: DealerBodyCategory | null): number {
  switch (bodyType) {
    case 'Kei Car':
      return 10.5;
    case 'Hatchback':
    case 'Coupe':
    case 'Convertible':
      return 12.5;
    case 'Sedan':
    case 'Wagon':
      return 14.0;
    case 'SUV':
      return 16.5;
    case 'Minivan':
    case 'MPV':
      return 17.5;
    case 'Van':
    case 'Pickup':
      return 18.5;
    case 'Truck':
      return 22.0;
    case 'Bus':
      return 34.0;
    default:
      return 15.0;
  }
}

/**
 * Server-side & admin pricing formula: converts internal original Japanese dealer JPY price
 * into a public Estimated FOB USD figure with Auzio export handling, inland transport,
 * documentation, and configured internal profit margin folded in.
 * Customers ONLY receive the resulting estimatedFobUsd — never the internal margin breakdown.
 */
export function computePublicEstimatedFob(params: {
  originalDealerPriceJpy: number | null;
  rules: DealerPricingRules;
  liveJpyPerUsd?: number;
}): { estimatedFobUsd: number | null; estimatedFobJpy: number | null } {
  const { originalDealerPriceJpy, rules, liveJpyPerUsd } = params;
  if (
    originalDealerPriceJpy === null ||
    !Number.isFinite(originalDealerPriceJpy) ||
    originalDealerPriceJpy <= 0
  ) {
    return { estimatedFobUsd: null, estimatedFobJpy: null };
  }

  const jpyRate =
    liveJpyPerUsd && Number.isFinite(liveJpyPerUsd) && liveJpyPerUsd > 50
      ? liveJpyPerUsd
      : rules.jpyToUsdFallbackRate || 152;

  const baseVehicleUsd = originalDealerPriceJpy / jpyRate;
  const inlandUsd = (rules.inlandTransportJpy || 0) / jpyRate;
  const percentMarginUsd = baseVehicleUsd * ((rules.percentageMarginPct || 0) / 100);
  const rawFobUsd =
    baseVehicleUsd +
    inlandUsd +
    (rules.fixedMarginUsd || 0) +
    percentMarginUsd +
    (rules.documentationUsd || 0) +
    (rules.exportHandlingUsd || 0);

  const estimatedFobUsd = Math.round(rawFobUsd / 10) * 10;
  const estimatedFobJpy = Math.round(estimatedFobUsd * jpyRate);

  return { estimatedFobUsd, estimatedFobJpy };
}

export interface DealerCustomerCostEstimate {
  port: ShippingPort;
  shippingMethod: ShippingMethod;
  rateAvailable: boolean;
  estimatedFobUsd: number | null;
  estimatedFreightUsd: number;
  estimatedInspectionUsd: number;
  inspectionLabel: string;
  estimatedInsuranceUsd: number;
  estimatedCnfUsd: number | null;
  estimatedCifUsd: number | null;
  transitDaysRange: string;
  isEstimate: true;
}

/**
 * Customer-facing Estimated FOB, Estimated C&F, and Estimated CIF calculator.
 * Never exposes internal dealer cost or profit margins.
 */
export function computeDealerCustomerEstimate(params: {
  estimatedFobUsd: number | null;
  volumeM3: number;
  portId: string;
  shippingMethod?: ShippingMethod;
  insurancePct?: number;
  insuranceMinUsd?: number;
}): DealerCustomerCostEstimate {
  const port = getPortById(params.portId);
  const method = params.shippingMethod || 'roro';
  const rateAvailable = port.rateAvailable !== false;

  let estimatedFreightUsd = 0;
  if (rateAvailable) {
    if (method === 'roro') {
      estimatedFreightUsd = Math.round(params.volumeM3 * port.roroRatePerM3Usd);
    } else if (method === 'container_20ft') {
      estimatedFreightUsd = port.container20ftUsd;
    } else {
      estimatedFreightUsd = port.container40ftUsd;
    }
  }

  const estimatedInspectionUsd = rateAvailable ? port.inspectionFeeUsd : 0;
  const estimatedFobUsd = params.estimatedFobUsd;

  const estimatedCnfUsd =
    estimatedFobUsd !== null && rateAvailable
      ? Math.round(estimatedFobUsd + estimatedFreightUsd + estimatedInspectionUsd)
      : null;

  const pct = params.insurancePct ?? 1.5;
  const minIns = params.insuranceMinUsd ?? 120;
  const estimatedInsuranceUsd =
    estimatedCnfUsd !== null
      ? Math.max(minIns, Math.round(estimatedCnfUsd * (pct / 100)))
      : 0;

  const estimatedCifUsd =
    estimatedCnfUsd !== null ? Math.round(estimatedCnfUsd + estimatedInsuranceUsd) : null;

  return {
    port,
    shippingMethod: method,
    rateAvailable,
    estimatedFobUsd,
    estimatedFreightUsd,
    estimatedInspectionUsd,
    inspectionLabel: port.inspectionName,
    estimatedInsuranceUsd,
    estimatedCnfUsd,
    estimatedCifUsd,
    transitDaysRange: rateAvailable
      ? `${port.transitDaysMin}–${port.transitDaysMax} days`
      : 'Quote on request',
    isEstimate: true,
  };
}
