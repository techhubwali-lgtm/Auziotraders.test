import {
  AlertTriangle,
  Anchor,
  CheckCircle2,
  Clock,
  Compass,
  Gauge,
  Loader2,
  MapPin,
  Navigation,
  PackageSearch,
  Radio,
  RefreshCw,
  Search,
  Ship,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { VesselLeafletMap } from '../components/VesselLeafletMap';
import {
  formatMoney,
  MILESTONE_META,
  MILESTONE_ORDER,
  SHIPPING_METHOD_LABELS,
  TRADE_MILESTONE_META,
  TRADE_MILESTONE_ORDER,
} from '../data/ports';
import { SEED_ORDERS } from '../data/seedData';
import { lookupOrderStatus } from '../services/firestoreService';
import {
  formatNavigationalStatus,
  getVesselFreshness,
  lookupVesselByNumber,
  telemetryToRegisteredVessel,
  type VesselSearchCandidate,
} from '../services/vesselTrackingService';
import type {
  CompanySettings,
  ExportOrder,
  LiveVesselTelemetry,
  OrderMilestone,
  OrderStatusRecord,
  RegisteredVessel,
  TradeOrderMilestone,
} from '../types/portal';

const SAMPLE_LIVE_VESSELS = [
  { label: 'IMO 9700524 (TRAVIATA)', query: '9700524' },
  { label: 'IMO 9684976 (HOEGH TARGET)', query: '9684976' },
];

interface OrderTrackerViewProps {
  initialCode?: string;
  settings: CompanySettings;
  vessels?: RegisteredVessel[];
  orders?: ExportOrder[];
  onOpenVesselTracking?: () => void;
}

export function OrderTrackerView({
  initialCode,
  settings,
  vessels = [],
  orders = [],
  onOpenVesselTracking,
}: OrderTrackerViewProps) {
  const [codeInput, setCodeInput] = useState(initialCode || '');
  const [loading, setLoading] = useState(false);
  const [searchedCode, setSearchedCode] = useState('');
  const [record, setRecord] = useState<OrderStatusRecord | null>(null);
  const [directVessel, setDirectVessel] = useState<RegisteredVessel | null>(null);
  const [directTelemetry, setDirectTelemetry] = useState<LiveVesselTelemetry | null>(null);
  const [vesselCandidates, setVesselCandidates] = useState<VesselSearchCandidate[]>([]);
  const [orderVesselFallback, setOrderVesselFallback] = useState<RegisteredVessel | null>(null);
  const [resolvingOrderVessel, setResolvingOrderVessel] = useState(false);
  const [error, setError] = useState('');

  const runVesselDirectLookup = async (rawQuery: string, bypassCache = false) => {
    const cleaned = rawQuery.trim();
    const res = await lookupVesselByNumber(cleaned, bypassCache);
    setVesselCandidates(res.candidates || []);
    if (res.ok && res.vessel) {
      setDirectTelemetry(res.vessel);
      setDirectVessel(telemetryToRegisteredVessel(res.vessel));
      return true;
    }
    setDirectTelemetry(null);
    setDirectVessel(null);
    return false;
  };

  const runLookup = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const normalized = trimmed.toUpperCase();

    setLoading(true);
    setError('');
    setSearchedCode(trimmed);
    setRecord(null);
    setDirectVessel(null);
    setDirectTelemetry(null);
    setVesselCandidates([]);
    setOrderVesselFallback(null);

    try {
      const looksLikeOrderCode = /^AUZ-/i.test(normalized) || /^ORD-/i.test(normalized);
      const strippedDigits = normalized.replace(/^(?:IMO|MMSI)\s*[:#-]?\s*/i, '').replace(/\D/g, '');
      const looksLikeVesselNumber =
        /^(?:IMO|MMSI)\b/i.test(normalized) ||
        (/^\d{7}$/.test(strippedDigits) && /^[\d\s-]+$/.test(trimmed)) ||
        (/^\d{9}$/.test(strippedDigits) && /^[\d\s-]+$/.test(trimmed));

      // 1. If it clearly looks like a vessel IMO/MMSI number, resolve live vessel immediately
      if (looksLikeVesselNumber) {
        await runVesselDirectLookup(trimmed);
        return;
      }

      // 2. Check Export Orders (Firestore public tracker, live orders, and sample orders)
      let foundOrder: OrderStatusRecord | null = null;
      if (looksLikeOrderCode || normalized.length >= 6) {
        try {
          foundOrder = await lookupOrderStatus(normalized);
        } catch {
          foundOrder = null;
        }
      }

      if (!foundOrder) {
        const localMatch = [...orders, ...SEED_ORDERS].find(
          (o) =>
            o.trackingCode.toUpperCase() === normalized ||
            o.orderNumber.toUpperCase() === normalized ||
            (o.blNumber && o.blNumber.toUpperCase() === normalized)
        );
        if (localMatch) {
          foundOrder = {
            trackingCode: localMatch.trackingCode,
            inquiryId: localMatch.id,
            vehicleStockCode: localMatch.vehicleStockCode,
            vehicleTitle: localMatch.vehicleTitle,
            destinationPortName: localMatch.destinationPortName,
            shippingMethod: localMatch.shippingMethod,
            quotedCifUsd: localMatch.totalCifUsd,
            currency: localMatch.currency,
            milestone: localMatch.milestone,
            vesselName: localMatch.vesselName,
            vesselId: localMatch.vesselId,
            vesselMmsi: localMatch.vesselMmsi,
            etaDate: localMatch.etaDate,
            publicNote: `Vessel ${localMatch.vesselName || 'TBD'}${localMatch.voyageNumber ? ` (${localMatch.voyageNumber})` : ''} — ETD ${localMatch.etdDate || 'TBD'}, Est. ETA ${localMatch.etaDate || 'TBD'}.`,
          };
        }
      }

      if (foundOrder) {
        setRecord(foundOrder);
        return;
      }

      // 3. No order code matched -> automatically resolve as a Vessel Number or Vessel Name!
      await runVesselDirectLookup(trimmed);
    } catch {
      setError('Unable to reach shipment & vessel tracker right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      setCodeInput(initialCode);
      void runLookup(initialCode);
    }
  }, [initialCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runLookup(codeInput);
  };

  const isTradeMilestone =
    record !== null &&
    TRADE_MILESTONE_ORDER.includes(record.milestone as TradeOrderMilestone);

  const activeTradeIdx = isTradeMilestone
    ? TRADE_MILESTONE_ORDER.indexOf(record!.milestone as TradeOrderMilestone)
    : -1;

  const activeLegacyIdx =
    record && !isTradeMilestone
      ? MILESTONE_ORDER.indexOf(record.milestone as OrderMilestone)
      : -1;

  const rosterMatchedVessel = useMemo(() => {
    if (!record || vessels.length === 0) return null;
    return (
      vessels.find(
        (v) =>
          (record.vesselId && v.id === record.vesselId) ||
          (record.vesselMmsi && v.mmsi === record.vesselMmsi) ||
          (record.vesselName && v.name.toLowerCase() === record.vesselName.toLowerCase())
      ) || null
    );
  }, [record, vessels]);

  // If an order has an assigned vessel name/MMSI not yet plotted with coordinates, auto-resolve live AIS
  useEffect(() => {
    if (!record) return;
    const hasCoords =
      rosterMatchedVessel &&
      rosterMatchedVessel.latitude !== null &&
      rosterMatchedVessel.longitude !== null;
    if (hasCoords) {
      setOrderVesselFallback(null);
      return;
    }
    const queryTarget = (record.vesselMmsi || record.vesselName || '').trim();
    if (!queryTarget || queryTarget.length < 3 || /pending|tbd/i.test(queryTarget)) {
      return;
    }

    let cancelled = false;
    setResolvingOrderVessel(true);
    void lookupVesselByNumber(queryTarget)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.vessel) {
          setOrderVesselFallback(telemetryToRegisteredVessel(res.vessel));
        }
      })
      .catch(() => {
        // Non-blocking fallback
      })
      .finally(() => {
        if (!cancelled) setResolvingOrderVessel(false);
      });

    return () => {
      cancelled = true;
    };
  }, [record, rosterMatchedVessel]);

  const matchedVessel = useMemo(() => {
    if (
      rosterMatchedVessel &&
      rosterMatchedVessel.latitude !== null &&
      rosterMatchedVessel.longitude !== null
    ) {
      return rosterMatchedVessel;
    }
    if (orderVesselFallback) {
      return rosterMatchedVessel
        ? {
            ...rosterMatchedVessel,
            imo: rosterMatchedVessel.imo || orderVesselFallback.imo,
            mmsi: rosterMatchedVessel.mmsi || orderVesselFallback.mmsi,
            callSign: rosterMatchedVessel.callSign || orderVesselFallback.callSign,
            latitude: orderVesselFallback.latitude,
            longitude: orderVesselFallback.longitude,
            speedKnots: orderVesselFallback.speedKnots,
            courseDeg: orderVesselFallback.courseDeg,
            headingDeg: orderVesselFallback.headingDeg,
            aisDestination: orderVesselFallback.aisDestination || rosterMatchedVessel.aisDestination,
            etaReported: orderVesselFallback.etaReported || rosterMatchedVessel.etaReported,
            lastAisUpdateAt: orderVesselFallback.lastAisUpdateAt || rosterMatchedVessel.lastAisUpdateAt,
          }
        : orderVesselFallback;
    }
    return rosterMatchedVessel;
  }, [rosterMatchedVessel, orderVesselFallback]);

  const linkedOrdersForDirectVessel = useMemo(() => {
    if (!directVessel) return [];
    const allOrders = [...orders, ...SEED_ORDERS];
    const seen = new Set<string>();
    return allOrders.filter((o) => {
      if (seen.has(o.trackingCode)) return false;
      const matches =
        (directVessel.mmsi && o.vesselMmsi === directVessel.mmsi) ||
        (o.vesselName && o.vesselName.toLowerCase() === directVessel.name.toLowerCase());
      if (matches) {
        seen.add(o.trackingCode);
        return true;
      }
      return false;
    });
  }, [directVessel, orders]);

  const recordRates = useMemo(() => {
    if (
      record &&
      record.lockedCurrency &&
      record.lockedCurrency !== 'USD' &&
      typeof record.lockedExchangeRate === 'number' &&
      record.lockedExchangeRate > 0
    ) {
      return {
        ...settings.exchangeRates,
        [record.lockedCurrency]: record.lockedExchangeRate,
      };
    }
    return settings.exchangeRates;
  }, [record, settings.exchangeRates]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-20 space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-mono font-semibold text-amber-700 uppercase tracking-wider">
          Export Pipeline &amp; Live Vessel Number Tracking
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">
          Track Your Export Order &amp; Vessel Shipment
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          Enter an <strong>Export Order Reference</strong> (
          <span className="font-mono text-slate-900">AUZ-2026-XXXXXX</span>), a{' '}
          <strong>7-digit IMO vessel number</strong>, a <strong>9-digit MMSI number</strong>, or a{' '}
          <strong>Vessel Name</strong> to view live AIS coordinates, speed, destination, and ETA.
        </p>
      </div>

      {/* Lookup Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Order code (AUZ-2026-...) or Vessel IMO / MMSI / Name (e.g. 9700524, 265012000)"
              maxLength={60}
              className="w-full pl-10 pr-4 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-amber-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading || codeInput.trim().length < 2}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Track Shipment
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Try live vessels:</span>
          {SAMPLE_LIVE_VESSELS.map((v) => (
            <button
              key={v.query}
              type="button"
              disabled={loading}
              onClick={() => {
                setCodeInput(v.query);
                void runLookup(v.query);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 font-mono text-[11px] font-semibold text-amber-950 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded cursor-pointer"
            >
              <Ship className="w-3 h-3 text-amber-700" />
              {v.label}
            </button>
          ))}
          <span className="text-slate-300">|</span>
          <span>Orders:</span>
          {SEED_ORDERS.map((o) => (
            <button
              key={o.trackingCode}
              type="button"
              disabled={loading}
              onClick={() => {
                setCodeInput(o.trackingCode);
                void runLookup(o.trackingCode);
              }}
              className="px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 hover:bg-amber-50 hover:text-amber-900 rounded cursor-pointer"
            >
              {o.trackingCode} ({o.destinationCountry})
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && searchedCode && !record && !directVessel && !error && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <PackageSearch className="w-9 h-9 text-slate-400 mx-auto" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-slate-900">
            No order or active vessel found for &ldquo;{searchedCode}&rdquo;
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Check your Bill of Lading for the <strong>7-digit IMO number</strong>,{' '}
            <strong>9-digit MMSI number</strong>, vessel name, or{' '}
            <span className="font-mono">AUZ-2026-XXXXXX</span> order code, or contact{' '}
            {settings.supportEmail}.
          </p>
        </div>
      )}

      {/* Direct Live Vessel Number Result Card */}
      {directVessel && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-6 py-5 bg-slate-950 text-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-400">
                <Radio className="w-3.5 h-3.5" />
                {directVessel.imo ? `IMO ${directVessel.imo}` : ''}
                {directVessel.imo && directVessel.mmsi ? ' · ' : ''}
                {directVessel.mmsi ? `MMSI ${directVessel.mmsi}` : ''}
                {directVessel.callSign ? ` · Call Sign ${directVessel.callSign}` : ''}
              </div>
              <h2 className="text-xl font-bold mt-0.5">{directVessel.name}</h2>
              <div className="text-xs text-slate-300 mt-1">
                {directVessel.carrier}
                {directVessel.originPort ? ` · Last Port: ${directVessel.originPort}` : ''}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const freshness = getVesselFreshness(directVessel);
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                      freshness.status === 'live'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : freshness.status === 'outdated' || freshness.status === 'stale'
                          ? 'bg-amber-950 text-amber-300 border-amber-700'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    {freshness.label}
                  </span>
                );
              })()}
              <button
                type="button"
                disabled={loading}
                onClick={() => void runVesselDirectLookup(directVessel.mmsi || directVessel.imo || directVessel.name, true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Multiple candidate matches selector */}
            {vesselCandidates.length > 1 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  Other vessels matching &ldquo;{searchedCode}&rdquo;:
                </div>
                <div className="flex flex-wrap gap-2">
                  {vesselCandidates.slice(0, 8).map((c) => (
                    <button
                      key={c.detailId}
                      type="button"
                      onClick={() => {
                        const target = c.imo || c.mmsi || c.detailId;
                        setCodeInput(target);
                        void runLookup(target);
                      }}
                      className="px-2.5 py-1 text-xs rounded-md bg-white hover:bg-amber-50 border border-slate-300 hover:border-amber-500 text-slate-900 cursor-pointer"
                    >
                      <span className="font-semibold">{c.name}</span>
                      {c.imo && <span className="font-mono text-amber-800 ml-1">IMO {c.imo}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <VesselLeafletMap
              vessels={[directVessel]}
              selectedVesselId={directVessel.id}
              heightClass="h-[380px]"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-amber-600" />
                  Speed (SOG)
                </div>
                <div className="font-mono font-bold text-slate-950 text-sm mt-1">
                  {typeof directVessel.speedKnots === 'number'
                    ? `${directVessel.speedKnots.toFixed(1)} kn`
                    : 'N/A'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Compass className="w-3 h-3 text-amber-600" />
                  Course / Heading
                </div>
                <div className="font-mono font-bold text-slate-950 text-sm mt-1">
                  {typeof directVessel.courseDeg === 'number'
                    ? `${directVessel.courseDeg.toFixed(1)}°`
                    : '—'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-amber-600" />
                  Destination Port
                </div>
                <div
                  className="font-mono font-bold text-slate-950 text-sm mt-1 truncate"
                  title={directVessel.aisDestination || 'Pending'}
                >
                  {directVessel.aisDestination || 'Pending'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  Reported ETA
                </div>
                <div className="font-mono font-bold text-slate-950 text-sm mt-1">
                  {directVessel.etaReported || 'Pending'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-600" />
                  Live Coordinates &amp; Navigation Status
                </div>
                <div className="font-mono font-semibold text-slate-950">
                  {typeof directVessel.latitude === 'number' &&
                  typeof directVessel.longitude === 'number'
                    ? `${directVessel.latitude.toFixed(4)}°, ${directVessel.longitude.toFixed(4)}°`
                    : 'No recent coordinates reported'}
                </div>
                <div className="text-slate-600">
                  {directTelemetry?.navStatusText || formatNavigationalStatus(directVessel.navStatus)}
                  {directVessel.lastAisUpdateAt
                    ? ` · Last AIS: ${new Date(directVessel.lastAisUpdateAt).toLocaleString()}`
                    : ''}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Anchor className="w-3 h-3 text-amber-600" />
                  Voyage &amp; Port Details
                </div>
                <div className="font-semibold text-slate-950">
                  {directVessel.originPort
                    ? `Last Port: ${directVessel.originPort}`
                    : 'Active Ocean Voyage'}
                </div>
                <div className="text-slate-600">
                  {directTelemetry?.positionReceivedAgo
                    ? `AIS signal received ${directTelemetry.positionReceivedAgo}`
                    : 'Live maritime transponder tracking active'}
                </div>
              </div>
            </div>

            {linkedOrdersForDirectVessel.length > 0 && (
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-900">
                  Matched Auzio Export Orders on {directVessel.name}:
                </div>
                <div className="flex flex-wrap gap-2">
                  {linkedOrdersForDirectVessel.map((ord) => (
                    <button
                      key={ord.trackingCode}
                      type="button"
                      onClick={() => {
                        setCodeInput(ord.trackingCode);
                        void runLookup(ord.trackingCode);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 rounded-lg font-mono cursor-pointer"
                    >
                      <span className="font-bold">{ord.trackingCode}</span>
                      <span>· {ord.vehicleTitle}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {onOpenVesselTracking && (
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>Need to monitor multiple fleet vessels on one map?</span>
                <button
                  type="button"
                  onClick={onOpenVesselTracking}
                  className="font-semibold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                >
                  Open Full Vessel Tracking Map
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Order Pipeline Card */}
      {record && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {/* Summary Header */}
          <div className="px-6 py-5 bg-slate-950 text-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-amber-400">{record.trackingCode}</div>
              <h2 className="text-lg font-bold mt-0.5">{record.vehicleTitle}</h2>
              <div className="text-xs text-slate-300 font-mono mt-1">
                Stock {record.vehicleStockCode} · Destination: {record.destinationPortName}
              </div>
            </div>
            <div className="text-left sm:text-right font-mono tabular-nums">
              <div className="text-[11px] text-slate-400">
                {record.lockedExchangeRate ? 'Confirmed CIF (Locked FX)' : 'Quoted CIF'}
              </div>
              <div className="text-xl font-bold">
                {formatMoney(
                  record.quotedCifUsd,
                  record.lockedCurrency || record.currency,
                  recordRates
                )}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                {SHIPPING_METHOD_LABELS[record.shippingMethod]}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {record.milestone === 'cancelled' ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-5 flex items-start gap-3 text-red-900">
                <XCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Order Cancelled</div>
                  <p className="text-xs mt-1 text-red-800">
                    {record.publicNote || MILESTONE_META.cancelled.description}
                  </p>
                </div>
              </div>
            ) : isTradeMilestone ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    14-Stage Export Trade Pipeline
                  </h3>
                  <span className="text-xs font-mono font-semibold text-amber-800">
                    Stage {activeTradeIdx + 1} of 14:{' '}
                    {TRADE_MILESTONE_META[record.milestone as TradeOrderMilestone].label}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {TRADE_MILESTONE_ORDER.map((step, index) => {
                    const isCompleted = index < activeTradeIdx;
                    const isCurrent = index === activeTradeIdx;
                    const meta = TRADE_MILESTONE_META[step];
                    return (
                      <div
                        key={step}
                        className={`p-3 rounded-lg border text-xs ${
                          isCurrent
                            ? 'bg-amber-50 border-amber-500 text-amber-950 font-semibold'
                            : isCompleted
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                              : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
                          {isCurrent && <Clock className="w-3.5 h-3.5 text-amber-700" />}
                        </div>
                        <div className="leading-snug">{meta.shortLabel}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-500">
                  Export Milestone Timeline
                </h3>
                <ol className="space-y-3">
                  {MILESTONE_ORDER.map((step, index) => {
                    const isCompleted = index < activeLegacyIdx;
                    const isCurrent = index === activeLegacyIdx;
                    const meta = MILESTONE_META[step];
                    return (
                      <li
                        key={step}
                        className={`flex items-start gap-4 p-3.5 rounded-lg border ${
                          isCurrent
                            ? 'bg-amber-50/70 border-amber-300'
                            : isCompleted
                              ? 'bg-slate-50 border-slate-200'
                              : 'bg-white border-slate-100 opacity-65'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                          ) : isCurrent ? (
                            <Clock className="w-5 h-5 text-amber-700" />
                          ) : (
                            <span className="w-5 h-5 rounded-full border-2 border-slate-300 inline-flex items-center justify-center text-[10px] font-mono text-slate-500">
                              {index + 1}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-950">
                              {meta.label}
                            </span>
                            <span className="text-xs font-mono text-slate-500">
                              {isCompleted ? 'Completed' : isCurrent ? 'Current Stage' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">{meta.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Vessel & Export Coordinator Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 mb-2">
                  <Anchor className="w-4 h-4 text-amber-700" />
                  <span>Vessel &amp; Sailing Schedule (Staff-Managed)</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Assigned Vessel:</span>
                    <span className="font-mono font-medium text-slate-900">
                      {record.vesselName || 'Pending Vessel Allocation'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Estimated Arrival (ETA):</span>
                    <span className="font-mono font-medium text-slate-900">
                      {record.etaDate || 'To Be Confirmed'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-900 mb-1.5">
                  Latest Yokohama Export Desk Update
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {record.publicNote ||
                    'Our Yokohama export coordinators will update this record as inspection and carrier booking progress.'}
                </p>
              </div>
            </div>

            {/* Live Vessel Position Map (Auto-resolved from Fleet or Live Maritime AIS) */}
            {resolvingOrderVessel && !matchedVessel ? (
              <div className="pt-4 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                Locating live AIS position for {record.vesselName || record.vesselMmsi}...
              </div>
            ) : matchedVessel ? (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-950 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-600" />
                    Live AIS Vessel Tracking — {matchedVessel.name}
                    {matchedVessel.imo ? ` (IMO ${matchedVessel.imo})` : ''}
                    {matchedVessel.mmsi ? ` · MMSI ${matchedVessel.mmsi}` : ''}
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const freshness = getVesselFreshness(matchedVessel);
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-md ${
                            freshness.status === 'live'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : freshness.status === 'outdated' || freshness.status === 'stale'
                                ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {(freshness.status === 'outdated' || freshness.status === 'stale') && (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {freshness.label}
                        </span>
                      );
                    })()}
                    {onOpenVesselTracking && (
                      <button
                        type="button"
                        onClick={onOpenVesselTracking}
                        className="text-xs font-semibold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                      >
                        Full Vessel Map
                      </button>
                    )}
                  </div>
                </div>

                <VesselLeafletMap
                  vessels={[matchedVessel]}
                  selectedVesselId={matchedVessel.id}
                  heightClass="h-[320px]"
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 uppercase">Speed / Course</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {typeof matchedVessel.speedKnots === 'number'
                        ? `${matchedVessel.speedKnots.toFixed(1)} kn`
                        : 'N/A'}{' '}
                      ·{' '}
                      {typeof matchedVessel.courseDeg === 'number'
                        ? `${matchedVessel.courseDeg.toFixed(0)}°`
                        : '—'}
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 uppercase">IMO Number</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {matchedVessel.imo || '—'}
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 uppercase">AIS Destination</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5 truncate">
                      {matchedVessel.aisDestination || matchedVessel.destinationPort || 'Pending'}
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 uppercase">Reported ETA</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {matchedVessel.etaReported || matchedVessel.etaManual || record.etaDate || 'TBD'}
                    </div>
                  </div>
                </div>

                {matchedVessel.manualLocationNote && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-950">
                    <strong>Status Update:</strong> {matchedVessel.manualLocationNote}
                  </div>
                )}
              </div>
            ) : (
              onOpenVesselTracking && (
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Ship className="w-4 h-4 text-amber-600" />
                    Want to explore all active export vessels sailing from Japan?
                  </span>
                  <button
                    type="button"
                    onClick={onOpenVesselTracking}
                    className="font-semibold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                  >
                    Open Live Vessel Tracking Map
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
