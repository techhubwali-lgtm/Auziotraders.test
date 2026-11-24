import { getCurrencyDescriptor } from './currencies';
import { getWorldPortOptionById } from './worldCountriesPorts';
import type {
  CifBreakdown,
  CurrencyCode,
  ExchangeRates,
  OrderMilestone,
  ShippingMethod,
  ShippingPort,
  ShippingRegion,
  TradeOrderMilestone,
} from '../types/portal';

export const SHIPPING_REGIONS: ShippingRegion[] = [
  'East & Central Africa',
  'Southern Africa',
  'Oceania',
  'Caribbean',
  'UK & Middle East',
];

export const ALL_CURRENCIES: CurrencyCode[] = [
  'USD',
  'JPY',
  'EUR',
  'AUD',
  'GBP',
  'KES',
  'ZAR',
  'NZD',
  'CAD',
];

export const GLOBAL_PORTS: ShippingPort[] = [
  // East & Central Africa (Kenya, Tanzania, Uganda, Zambia, DR Congo)
  {
    id: 'mombasa-ke',
    unLocode: 'KEMBA',
    name: 'Mombasa',
    country: 'Kenya',
    countryCode: 'KE',
    region: 'East & Central Africa',
    corridorNote: 'Direct Ro-Ro discharge for Kenya importers',
    rateAvailable: true,
    roroRatePerM3Usd: 96,
    container20ftUsd: 2650,
    container40ftUsd: 4200,
    inspectionName: 'QISJ Pre-Export Inspection',
    inspectionFeeUsd: 285,
    transitDaysMin: 24,
    transitDaysMax: 30,
  },
  {
    id: 'dar-es-salaam-tz',
    unLocode: 'TZDAR',
    name: 'Dar es Salaam',
    country: 'Tanzania',
    countryCode: 'TZ',
    region: 'East & Central Africa',
    corridorNote: 'Direct Ro-Ro discharge for Tanzania importers',
    rateAvailable: true,
    roroRatePerM3Usd: 98,
    container20ftUsd: 2700,
    container40ftUsd: 4300,
    inspectionName: 'EAA / TBS Roadworthiness',
    inspectionFeeUsd: 275,
    transitDaysMin: 25,
    transitDaysMax: 32,
  },
  {
    id: 'kampala-mombasa-ug',
    unLocode: 'KEMBA',
    name: 'Mombasa (Uganda Transit)',
    country: 'Uganda',
    countryCode: 'UG',
    region: 'East & Central Africa',
    corridorNote: 'Sea discharge at Mombasa + bonded road transit to Kampala',
    rateAvailable: true,
    roroRatePerM3Usd: 102,
    container20ftUsd: 2850,
    container40ftUsd: 4450,
    inspectionName: 'JEVIC / UNBS Pre-Export Inspection',
    inspectionFeeUsd: 290,
    transitDaysMin: 28,
    transitDaysMax: 35,
  },
  {
    id: 'lusaka-dar-zm',
    unLocode: 'TZDAR',
    name: 'Dar es Salaam (Zambia Transit)',
    country: 'Zambia',
    countryCode: 'ZM',
    region: 'East & Central Africa',
    corridorNote: 'Sea discharge at Dar es Salaam + Nakonde corridor to Lusaka',
    rateAvailable: true,
    roroRatePerM3Usd: 104,
    container20ftUsd: 2900,
    container40ftUsd: 4550,
    inspectionName: 'JEVIC Zambia Roadworthiness',
    inspectionFeeUsd: 295,
    transitDaysMin: 29,
    transitDaysMax: 37,
  },
  {
    id: 'matadi-drc',
    unLocode: 'CDMAT',
    name: 'Dar es Salaam / Matadi',
    country: 'DR Congo',
    countryCode: 'CD',
    region: 'East & Central Africa',
    corridorNote: 'East corridor via Dar es Salaam (Lubumbashi) or West via Matadi',
    rateAvailable: true,
    roroRatePerM3Usd: 124,
    container20ftUsd: 3350,
    container40ftUsd: 5250,
    inspectionName: 'OCC / BIVAC Pre-Shipment Verification',
    inspectionFeeUsd: 310,
    transitDaysMin: 34,
    transitDaysMax: 44,
  },

  // Southern Africa (South Africa, Zimbabwe, Mozambique)
  {
    id: 'durban-za',
    unLocode: 'ZADUR',
    name: 'Durban',
    country: 'South Africa',
    countryCode: 'ZA',
    region: 'Southern Africa',
    corridorNote: 'Primary Southern Africa Ro-Ro hub',
    rateAvailable: true,
    roroRatePerM3Usd: 105,
    container20ftUsd: 2800,
    container40ftUsd: 4450,
    inspectionName: 'JEVIC Pre-Shipment Certificate',
    inspectionFeeUsd: 260,
    transitDaysMin: 26,
    transitDaysMax: 34,
  },
  {
    id: 'durban-harare-zw',
    unLocode: 'ZADUR',
    name: 'Durban / Beira (Zimbabwe Transit)',
    country: 'Zimbabwe',
    countryCode: 'ZW',
    region: 'Southern Africa',
    corridorNote: 'Bonded transit via Durban or Beira to Harare / Beitbridge',
    rateAvailable: true,
    roroRatePerM3Usd: 112,
    container20ftUsd: 3000,
    container40ftUsd: 4700,
    inspectionName: 'JEVIC / EAA Roadworthiness Check',
    inspectionFeeUsd: 285,
    transitDaysMin: 30,
    transitDaysMax: 38,
  },
  {
    id: 'maputo-mz',
    unLocode: 'MZMPM',
    name: 'Maputo',
    country: 'Mozambique',
    countryCode: 'MZ',
    region: 'Southern Africa',
    corridorNote: 'Direct Ro-Ro service for Mozambique & Southern corridor',
    rateAvailable: true,
    roroRatePerM3Usd: 108,
    container20ftUsd: 2900,
    container40ftUsd: 4600,
    inspectionName: 'Intertek Pre-Shipment Inspection',
    inspectionFeeUsd: 295,
    transitDaysMin: 28,
    transitDaysMax: 36,
  },

  // Oceania (Australia, New Zealand)
  {
    id: 'sydney-au',
    unLocode: 'AUPKL',
    name: 'Port Kembla / Sydney',
    country: 'Australia',
    countryCode: 'AU',
    region: 'Oceania',
    corridorNote: 'Weekly Yokohama–Australia Ro-Ro liner',
    rateAvailable: true,
    roroRatePerM3Usd: 88,
    container20ftUsd: 2450,
    container40ftUsd: 3950,
    inspectionName: 'DAFF Biosecurity & Heat Wash',
    inspectionFeeUsd: 310,
    transitDaysMin: 14,
    transitDaysMax: 19,
  },
  {
    id: 'brisbane-au',
    unLocode: 'AUBNE',
    name: 'Brisbane',
    country: 'Australia',
    countryCode: 'AU',
    region: 'Oceania',
    corridorNote: 'Fastest East Coast Australia transit',
    rateAvailable: true,
    roroRatePerM3Usd: 84,
    container20ftUsd: 2350,
    container40ftUsd: 3800,
    inspectionName: 'DAFF Biosecurity & Heat Wash',
    inspectionFeeUsd: 310,
    transitDaysMin: 12,
    transitDaysMax: 17,
  },
  {
    id: 'auckland-nz',
    unLocode: 'NZAKL',
    name: 'Auckland',
    country: 'New Zealand',
    countryCode: 'NZ',
    region: 'Oceania',
    corridorNote: 'MPI & JEVIC certified Japan–NZ route',
    rateAvailable: true,
    roroRatePerM3Usd: 90,
    container20ftUsd: 2500,
    container40ftUsd: 4000,
    inspectionName: 'MPI Biosecurity & JEVIC Odometer',
    inspectionFeeUsd: 340,
    transitDaysMin: 14,
    transitDaysMax: 18,
  },

  // Caribbean (Jamaica, Bahamas)
  {
    id: 'kingston-jm',
    unLocode: 'JMKIN',
    name: 'Kingston',
    country: 'Jamaica',
    countryCode: 'JM',
    region: 'Caribbean',
    corridorNote: 'Panama Canal direct Ro-Ro liner',
    rateAvailable: true,
    roroRatePerM3Usd: 138,
    container20ftUsd: 3650,
    container40ftUsd: 5600,
    inspectionName: 'Autoterminal Pre-Shipment Inspection',
    inspectionFeeUsd: 290,
    transitDaysMin: 30,
    transitDaysMax: 38,
  },
  {
    id: 'nassau-bs',
    unLocode: 'BSNAS',
    name: 'Nassau',
    country: 'Bahamas',
    countryCode: 'BS',
    region: 'Caribbean',
    corridorNote: 'Regular Caribbean Ro-Ro transshipment',
    rateAvailable: true,
    roroRatePerM3Usd: 146,
    container20ftUsd: 3900,
    container40ftUsd: 5950,
    inspectionName: 'Export Compliance & Radiation Check',
    inspectionFeeUsd: 210,
    transitDaysMin: 32,
    transitDaysMax: 40,
  },

  // UK & Middle East (United Kingdom, UAE)
  {
    id: 'southampton-uk',
    unLocode: 'GBSOU',
    name: 'Southampton',
    country: 'United Kingdom',
    countryCode: 'GB',
    region: 'UK & Middle East',
    corridorNote: 'Direct UK Ro-Ro terminal with export translation',
    rateAvailable: true,
    roroRatePerM3Usd: 122,
    container20ftUsd: 3250,
    container40ftUsd: 5100,
    inspectionName: 'Export Deregistration & Translation',
    inspectionFeeUsd: 195,
    transitDaysMin: 36,
    transitDaysMax: 44,
  },
  {
    id: 'jebel-ali-ae',
    unLocode: 'AEJEA',
    name: 'Jebel Ali (Dubai)',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    region: 'UK & Middle East',
    corridorNote: 'High-frequency Gulf Ro-Ro & container hub',
    rateAvailable: true,
    roroRatePerM3Usd: 86,
    container20ftUsd: 2250,
    container40ftUsd: 3650,
    inspectionName: 'Export Certificate & Radiation Check',
    inspectionFeeUsd: 165,
    transitDaysMin: 18,
    transitDaysMax: 24,
  },
];

// Accounting reference rates persisted in Firestore companySettings (used only for staff admin invoice form defaults;
// public currency display uses live /api/exchange-rates and gracefully falls back to USD when unavailable).
export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  JPY: 152.5,
  EUR: 0.92,
  AUD: 1.54,
  GBP: 0.79,
  KES: 129.0,
  ZAR: 18.2,
  NZD: 1.68,
  CAD: 1.38,
};

export const CURRENCY_META: Record<
  string,
  { symbol: string; label: string; name: string }
> = {
  USD: { symbol: '$', label: 'USD', name: 'US Dollar' },
  JPY: { symbol: '¥', label: 'JPY', name: 'Japanese Yen' },
  EUR: { symbol: '€', label: 'EUR', name: 'Euro' },
  AUD: { symbol: 'A$', label: 'AUD', name: 'Australian Dollar' },
  GBP: { symbol: '£', label: 'GBP', name: 'British Pound' },
  KES: { symbol: 'KSh ', label: 'KES', name: 'Kenyan Shilling' },
  ZAR: { symbol: 'R', label: 'ZAR', name: 'South African Rand' },
  NZD: { symbol: 'NZ$', label: 'NZD', name: 'New Zealand Dollar' },
  CAD: { symbol: 'C$', label: 'CAD', name: 'Canadian Dollar' },
};

export function hasLiveRateForCurrency(
  currency: CurrencyCode,
  liveRates?: Record<string, number>
): boolean {
  const code = (currency || 'USD').toUpperCase();
  if (code === 'USD') return true;
  if (!liveRates) return false;
  const r = liveRates[code];
  return typeof r === 'number' && Number.isFinite(r) && r > 0;
}

export function convertUsd(
  amountUsd: number,
  currency: CurrencyCode,
  rates?: Record<string, number>
): number {
  const code = (currency || 'USD').toUpperCase();
  if (code === 'USD') return amountUsd;
  const rate = rates?.[code];
  if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
    return amountUsd * rate;
  }
  // Never fabricate exchange rates if rate isn't available; keep USD value intact
  return amountUsd;
}

export function formatMoney(
  amountUsd: number,
  currency: CurrencyCode,
  rates?: Record<string, number>
): string {
  const code = (currency || 'USD').toUpperCase();
  if (code === 'USD') {
    return `$${Math.round(amountUsd).toLocaleString('en-US')}`;
  }

  const rate = rates?.[code];
  if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
    const converted = Math.round(amountUsd * rate);
    const descriptor = getCurrencyDescriptor(code);
    const spacer = descriptor.symbol.length > 2 || /[A-Za-z]$/.test(descriptor.symbol) ? ' ' : '';
    return `${descriptor.symbol}${spacer}${converted.toLocaleString('en-US')}`;
  }

  // Graceful fallback when live exchange rate for the selected currency is unavailable
  return `$${Math.round(amountUsd).toLocaleString('en-US')} USD`;
}

export function isVerifiedShippingPort(portId: string): boolean {
  return GLOBAL_PORTS.some((p) => p.id === portId);
}

export function getPortById(portId: string): ShippingPort {
  const verified = GLOBAL_PORTS.find((p) => p.id === portId);
  if (verified) return verified;

  const worldPort = getWorldPortOptionById(portId);
  if (worldPort.verifiedPortId) {
    const linked = GLOBAL_PORTS.find((p) => p.id === worldPort.verifiedPortId);
    if (linked) return linked;
  }

  // Return an unrated ShippingPort object — NEVER invent shipping rates for unsupported routes
  return {
    id: worldPort.id,
    unLocode: worldPort.unLocode,
    name: worldPort.name,
    country: worldPort.countryName,
    countryCode: worldPort.countryCode,
    region: worldPort.region,
    corridorNote: 'Custom shipping quotation required from Yokohama export desk',
    rateAvailable: false,
    roroRatePerM3Usd: 0,
    container20ftUsd: 0,
    container40ftUsd: 0,
    inspectionName: 'Destination Inspection (Quoted on Request)',
    inspectionFeeUsd: 0,
    transitDaysMin: 0,
    transitDaysMax: 0,
  };
}

export function calculateCif(params: {
  fobUsd: number;
  volumeM3: number;
  portId: string;
  shippingMethod: ShippingMethod;
  includeInsurance: boolean;
}): CifBreakdown {
  const port = getPortById(params.portId);
  const rateAvailable = port.rateAvailable !== false && port.roroRatePerM3Usd > 0;

  if (!rateAvailable) {
    return {
      fobUsd: Math.round(params.fobUsd),
      freightUsd: 0,
      inspectionUsd: 0,
      inspectionLabel: 'Custom Quote Required',
      insuranceUsd: 0,
      totalCifUsd: Math.round(params.fobUsd),
      transitDaysRange: 'Quote on Request',
      port,
      shippingMethod: params.shippingMethod,
      includeInsurance: params.includeInsurance,
      rateAvailable: false,
    };
  }

  let freightUsd = 0;
  if (params.shippingMethod === 'roro') {
    freightUsd = Math.round(params.volumeM3 * port.roroRatePerM3Usd);
  } else if (params.shippingMethod === 'container_20ft') {
    freightUsd = port.container20ftUsd;
  } else {
    freightUsd = port.container40ftUsd;
  }

  const inspectionUsd = port.inspectionFeeUsd;
  const insuranceUsd = params.includeInsurance
    ? Math.max(95, Math.round((params.fobUsd + freightUsd) * 0.015))
    : 0;

  const totalCifUsd = Math.round(
    params.fobUsd + freightUsd + inspectionUsd + insuranceUsd
  );

  return {
    fobUsd: Math.round(params.fobUsd),
    freightUsd,
    inspectionUsd,
    inspectionLabel: port.inspectionName,
    insuranceUsd,
    totalCifUsd,
    transitDaysRange: `${port.transitDaysMin}–${port.transitDaysMax} days`,
    port,
    shippingMethod: params.shippingMethod,
    includeInsurance: params.includeInsurance,
    rateAvailable: true,
  };
}

export const SHIPPING_METHOD_LABELS: Record<ShippingMethod, string> = {
  roro: 'Ro-Ro Vessel (Roll-on/Roll-off)',
  container_20ft: '20ft Dedicated Container',
  container_40ft: '40ft High-Cube Container',
};

// Full 14-stage trade order milestone timeline
export const TRADE_MILESTONE_ORDER: TradeOrderMilestone[] = [
  'request_received',
  'options_prepared',
  'quotation_sent',
  'customer_approved',
  'bid_placed',
  'vehicle_purchased',
  'payment_pending',
  'payment_received',
  'vehicle_in_yard',
  'export_docs_ready',
  'shipment_booked',
  'shipped',
  'arrived_port',
  'completed',
];

export const TRADE_MILESTONE_META: Record<
  TradeOrderMilestone,
  { label: string; shortLabel: string; description: string }
> = {
  request_received: {
    label: 'Request Received',
    shortLabel: 'Received',
    description: 'Sourcing request or unit inquiry logged by Yokohama desk.',
  },
  options_prepared: {
    label: 'Options Prepared',
    shortLabel: 'Options',
    description: 'Sales team shortlisted auction/stock units with translated sheets.',
  },
  quotation_sent: {
    label: 'Quotation Sent',
    shortLabel: 'Quoted',
    description: 'Itemized CIF quotation and maximum bid ceiling sent to customer.',
  },
  customer_approved: {
    label: 'Customer Approved',
    shortLabel: 'Approved',
    description: 'Customer authorized maximum bid ceiling and commercial terms.',
  },
  bid_placed: {
    label: 'Auction Bid Placed',
    shortLabel: 'Bid Placed',
    description: 'Bid executed within customer-authorized ceiling at Japanese auction.',
  },
  vehicle_purchased: {
    label: 'Vehicle Purchased',
    shortLabel: 'Purchased',
    description: 'Unit secured and allocated to buyer account.',
  },
  payment_pending: {
    label: 'TT Payment Pending',
    shortLabel: 'TT Pending',
    description: 'Official Proforma Invoice issued; awaiting SMBC Tokyo TT remittance.',
  },
  payment_received: {
    label: 'TT Payment Confirmed',
    shortLabel: 'Paid',
    description: 'Bank Telegraphic Transfer verified by AUZIO TRADERS finance desk.',
  },
  vehicle_in_yard: {
    label: 'In Yokohama Export Yard',
    shortLabel: 'In Yard',
    description: 'Vehicle arrived at export compound for pre-shipment inspection.',
  },
  export_docs_ready: {
    label: 'Export Docs Ready',
    shortLabel: 'Docs Ready',
    description: 'Export Certificate, English Translation, and JEVIC/QISJ completed.',
  },
  shipment_booked: {
    label: 'Vessel Booked',
    shortLabel: 'Booked',
    description: 'Space confirmed on Ro-Ro/container vessel with ETD/ETA issued.',
  },
  shipped: {
    label: 'Shipped (On Water)',
    shortLabel: 'Shipped',
    description: 'Vessel departed Japan; original Bill of Lading dispatched via DHL.',
  },
  arrived_port: {
    label: 'Arrived Discharge Port',
    shortLabel: 'Arrived',
    description: 'Vessel arrived at destination discharge port for customs clearance.',
  },
  completed: {
    label: 'Order Completed',
    shortLabel: 'Completed',
    description: 'Vehicle cleared and delivered; trade file archived.',
  },
};

export const MILESTONE_ORDER: OrderMilestone[] = [
  'received',
  'proforma_issued',
  'deposit_confirmed',
  'inspection_passed',
  'vessel_booked',
  'shipped',
];

export const MILESTONE_META: Record<
  OrderMilestone,
  { label: string; shortLabel: string; description: string }
> = {
  received: {
    label: 'Inquiry Received',
    shortLabel: 'Received',
    description: 'Inquiry logged and assigned to an AUZIO TRADERS coordinator.',
  },
  proforma_issued: {
    label: 'Proforma Issued',
    shortLabel: 'Proforma',
    description: 'Official Proforma Invoice issued with SMBC Tokyo TT instructions.',
  },
  deposit_confirmed: {
    label: 'Payment Confirmed',
    shortLabel: 'Paid',
    description: 'Bank TT remittance cleared and vehicle allocation locked.',
  },
  inspection_passed: {
    label: 'Pre-Export Inspection',
    shortLabel: 'Inspected',
    description: 'Mandatory JEVIC / QISJ / Biosecurity inspection completed.',
  },
  vessel_booked: {
    label: 'Vessel Booked',
    shortLabel: 'Booked',
    description: 'Carrier space confirmed with ETD/ETA schedule issued.',
  },
  shipped: {
    label: 'Shipped (B/L Issued)',
    shortLabel: 'Shipped',
    description: 'Vessel departed Japan; original Bill of Lading dispatched.',
  },
  cancelled: {
    label: 'Cancelled',
    shortLabel: 'Cancelled',
    description: 'Inquiry closed or unit released back to open stock.',
  },
};

export const AUCTION_MARK_LEGEND: Record<string, string> = {
  A1: 'Small hairline scratch (< 10 cm)',
  A2: 'Noticeable scratch',
  U1: 'Minor dimple dent (barely visible)',
  U2: 'Medium panel dent',
  W1: 'Minor repaint / wave repair',
  W2: 'Noticeable panel repaint (clean finish)',
  XX: 'Panel replaced with OEM part',
  S1: 'Light surface rust',
};
