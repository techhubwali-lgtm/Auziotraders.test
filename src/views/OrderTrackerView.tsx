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
  PlusCircle,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Ship,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  type VesselLookupResponse,
  type VesselSearchCandidate,
} from '../services/vesselTrackingService';
import type {
  AisServiceStatusResponse,
  CompanySettings,
  ExportOrder,
  LiveVesselTelemetry,
  OrderMilestone,
  OrderStatusRecord,
  RegisteredVessel,
  TradeOrderMilestone,
} from '../types/portal';

const QUICK_REAL_VESSELS = [
  { label: 'IMO 9700524 · TRAVIATA', query: '9700524' },
  { label: 'IMO 9684976 · HOEGH TARGET', query: '9684976' },
  { label: 'IMO 9446013 · MORNING LILY', query: '9446013' },
];

interface OrderTrackerViewProps {
  initialCode?: string;
  settings: CompanySettings;
  vessels?: RegisteredVessel[];
  liveAisPositions?: Record<string, LiveVesselTelemetry>;
  aisStatus?: AisServiceStatusResponse | null;
  orders?: ExportOrder[];
  canRegisterVessels?: boolean;
  onRefreshPositions?: () => Promise<void>;
  onQuickRegisterVessel?: (vessel: RegisteredVessel) => Promise<void>;
}

export function OrderTrackerView({
  initialCode,
  settings,
  vessels = [],
  liveAisPositions = {},
  aisStatus = null,
  orders = [],
  canRegisterVessels = false,
  onRefreshPositions,
  onQuickRegisterVessel,
}: OrderTrackerViewProps) {
  const [queryInput, setQueryInput] = useState(initialCode || '');
  const [rosterFilter, setRosterFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingToFleet, setSavingToFleet] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [record, setRecord] = useState<OrderStatusRecord | null>(null);
  const [resolvedMap, setResolvedMap] = useState<Record<string, LiveVesselTelemetry>>({});
  const [candidates, setCandidates] = useState<VesselSearchCandidate[]>([]);
  const [lookupNotice, setLookupNotice] = useState<VesselLookupResponse | null>(null);
  const [error, setError] = useState('');
  const [notFoundQuery, setNotFoundQuery] = useState('');
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(vessels[0]?.id || null);
  const [resolvingOrderVessel, setResolvingOrderVessel] = useState(false);

  // Merge registered Firestore vessels, server live AIS positions, and session-resolved vessels
  const combinedVessels = useMemo<RegisteredVessel[]>(() => {
    const mergedLiveByMmsi: Record<string, LiveVesselTelemetry> = {
      ...(liveAisPositions || {}),
      ...resolvedMap,
    };

    const enrichedRegistered = vessels.map((v) => {
      const live =
        mergedLiveByMmsi[v.mmsi] ||
        Object.values(mergedLiveByMmsi).find((t) => v.imo && t.imo === v.imo);
      if (!live) return v;
      return {
        ...v,
        name: v.name || live.vesselName,
        imo: v.imo || live.imo,
        callSign: v.callSign || live.callSign,
        originPort: v.originPort || live.lastPort || '',
        latitude: live.latitude ?? v.latitude,
        longitude: live.longitude ?? v.longitude,
        speedKnots: live.speedKnots ?? v.speedKnots,
        courseDeg: live.courseDeg ?? v.courseDeg,
        headingDeg: live.headingDeg ?? v.headingDeg,
        navStatus: live.navStatus ?? v.navStatus,
        aisDestination: live.destination || v.aisDestination,
        etaReported: live.reportedEta || v.etaReported,
        lastAisUpdateAt: live.lastAisUpdateAt || v.lastAisUpdateAt,
      };
    });

    const existingMmsis = new Set(enrichedRegistered.map((v) => v.mmsi).filter(Boolean));
    const existingImos = new Set(enrichedRegistered.map((v) => v.imo).filter(Boolean));
    const extras: RegisteredVessel[] = [];
    const seenExtraKeys = new Set<string>();

    for (const live of Object.values(resolvedMap)) {
      if ((live.mmsi && existingMmsis.has(live.mmsi)) || (live.imo && existingImos.has(live.imo))) {
        continue;
      }
      const key = live.mmsi || live.imo || live.vesselName;
      if (seenExtraKeys.has(key)) continue;
      seenExtraKeys.add(key);
      extras.push(telemetryToRegisteredVessel(live));
    }

    for (const [mmsi, live] of Object.entries(liveAisPositions || {})) {
      if (existingMmsis.has(mmsi) || seenExtraKeys.has(mmsi)) continue;
      seenExtraKeys.add(mmsi);
      extras.push(telemetryToRegisteredVessel(live));
    }

    return [...extras, ...enrichedRegistered];
  }, [vessels, liveAisPositions, resolvedMap]);

  const filteredVessels = useMemo(() => {
    const q = rosterFilter.trim().toLowerCase();
    if (!q) return combinedVessels;
    return combinedVessels.filter((v) => {
      const assignedOrders = [...orders, ...SEED_ORDERS].filter(
        (o) =>
          o.vesselId === v.id ||
          (o.vesselMmsi && o.vesselMmsi === v.mmsi) ||
          (o.vesselName && o.vesselName.toLowerCase() === v.name.toLowerCase())
      );
      const matchesOrder = assignedOrders.some(
        (o) =>
          o.trackingCode.toLowerCase().includes(q) ||
          o.orderNumber.toLowerCase().includes(q) ||
          o.vehicleStockCode.toLowerCase().includes(q)
      );
      return (
        v.name.toLowerCase().includes(q) ||
        v.mmsi.includes(q) ||
        v.imo.includes(q) ||
        v.carrier.toLowerCase().includes(q) ||
        v.destinationPort.toLowerCase().includes(q) ||
        v.aisDestination.toLowerCase().includes(q) ||
        matchesOrder
      );
    });
  }, [combinedVessels, orders, rosterFilter]);

  useEffect(() => {
    if (
      (!selectedVesselId || !filteredVessels.some((v) => v.id === selectedVesselId)) &&
      filteredVessels.length > 0
    ) {
      setSelectedVesselId(filteredVessels[0].id);
    }
  }, [filteredVessels, selectedVesselId]);

  const activeVessel = useMemo(
    () => combinedVessels.find((v) => v.id === selectedVesselId) || filteredVessels[0] || null,
    [combinedVessels, filteredVessels, selectedVesselId]
  );

  const activeTelemetry = useMemo<LiveVesselTelemetry | null>(() => {
    if (!activeVessel) return null;
    return (
      resolvedMap[activeVessel.mmsi] ||
      liveAisPositions[activeVessel.mmsi] ||
      Object.values(resolvedMap).find((t) => activeVessel.imo && t.imo === activeVessel.imo) ||
      null
    );
  }, [activeVessel, resolvedMap, liveAisPositions]);

  const activeFreshness = activeVessel ? getVesselFreshness(activeVessel) : null;
  const isTemporaryLiveVessel = Boolean(activeVessel && activeVessel.id.startsWith('live-'));

  const assignedOrdersForVessel = useMemo(() => {
    if (!activeVessel) return [];
    const seen = new Set<string>();
    return [...orders, ...SEED_ORDERS].filter((o) => {
      if (seen.has(o.trackingCode)) return false;
      const matches =
        o.vesselId === activeVessel.id ||
        (o.vesselMmsi && o.vesselMmsi === activeVessel.mmsi) ||
        (o.vesselName && o.vesselName.toLowerCase() === activeVessel.name.toLowerCase());
      if (matches) {
        seen.add(o.trackingCode);
        return true;
      }
      return false;
    });
  }, [orders, activeVessel]);

  const selectVesselForTelemetry = useCallback(
    (telemetry: LiveVesselTelemetry) => {
      const key = telemetry.mmsi || telemetry.imo || telemetry.vesselName;
      setResolvedMap((prev) => ({
        [key]: telemetry,
        ...prev,
      }));
      const registeredMatch = vessels.find(
        (v) =>
          (telemetry.mmsi && v.mmsi === telemetry.mmsi) ||
          (telemetry.imo && v.imo === telemetry.imo)
      );
      const nextId = registeredMatch
        ? registeredMatch.id
        : telemetryToRegisteredVessel(telemetry).id;
      setSelectedVesselId(nextId);
    },
    [vessels]
  );

  const runVesselDirectLookup = useCallback(
    async (rawQuery: string, bypassCache = false, showNotice = true) => {
      const cleaned = rawQuery.trim();
      const res = await lookupVesselByNumber(cleaned, bypassCache);
      setCandidates(res.candidates || []);
      if (showNotice) {
        setLookupNotice(res);
      }
      if (res.ok && res.vessel) {
        selectVesselForTelemetry(res.vessel);
        setNotFoundQuery('');
        if (onRefreshPositions) {
          void onRefreshPositions();
        }
        return true;
      }
      return false;
    },
    [onRefreshPositions, selectVesselForTelemetry]
  );

  const runUnifiedLookup = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed.length < 2) {
        setError('Enter an Export Order Code (AUZ-2026-...), 7-digit IMO, 9-digit MMSI, or vessel name.');
        return;
      }

      const normalized = trimmed.toUpperCase();
      setLoading(true);
      setError('');
      setNotFoundQuery('');
      setLookupNotice(null);
      setCandidates([]);
      setSearchedQuery(trimmed);

      try {
        const looksLikeOrderCode = /^AUZ-/i.test(normalized) || /^ORD-/i.test(normalized);
        const strippedDigits = normalized
          .replace(/^(?:IMO|MMSI)\s*[:#-]?\s*/i, '')
          .replace(/\D/g, '');
        const looksLikeVesselNumber =
          /^(?:IMO|MMSI)\b/i.test(normalized) ||
          (/^\d{7}$/.test(strippedDigits) && /^[\d\s-]+$/.test(trimmed)) ||
          (/^\d{9}$/.test(strippedDigits) && /^[\d\s-]+$/.test(trimmed));

        // 1. Direct vessel number (IMO / MMSI)
        if (looksLikeVesselNumber) {
          setRecord(null);
          const ok = await runVesselDirectLookup(trimmed, false, true);
          if (!ok) setNotFoundQuery(trimmed);
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
          setNotFoundQuery('');

          // Automatically highlight or resolve the order's assigned vessel on the live map below
          const rosterMatch = combinedVessels.find(
            (v) =>
              (foundOrder!.vesselId && v.id === foundOrder!.vesselId) ||
              (foundOrder!.vesselMmsi && v.mmsi === foundOrder!.vesselMmsi) ||
              (foundOrder!.vesselName && v.name.toLowerCase() === foundOrder!.vesselName.toLowerCase())
          );

          if (rosterMatch) {
            setSelectedVesselId(rosterMatch.id);
          }

          const hasCoords =
            rosterMatch && rosterMatch.latitude !== null && rosterMatch.longitude !== null;
          const vesselTarget = (foundOrder.vesselMmsi || foundOrder.vesselName || '').trim();
          if (!hasCoords && vesselTarget.length >= 3 && !/pending|tbd/i.test(vesselTarget)) {
            setResolvingOrderVessel(true);
            void lookupVesselByNumber(vesselTarget)
              .then((res) => {
                if (res.ok && res.vessel) {
                  selectVesselForTelemetry(res.vessel);
                }
              })
              .catch(() => {
                // Non-blocking fallback
              })
              .finally(() => {
                setResolvingOrderVessel(false);
              });
          }
          return;
        }

        // 3. No order matched -> resolve as a Vessel Name / Number via live AIS
        setRecord(null);
        const ok = await runVesselDirectLookup(trimmed, false, true);
        if (!ok) {
          setNotFoundQuery(trimmed);
        }
      } catch {
        setError('Unable to reach shipment & vessel tracker right now. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [combinedVessels, orders, runVesselDirectLookup, selectVesselForTelemetry]
  );

  useEffect(() => {
    if (initialCode) {
      setQueryInput(initialCode);
      void runUnifiedLookup(initialCode);
    }
  }, [initialCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runUnifiedLookup(queryInput);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (onRefreshPositions) {
        await onRefreshPositions();
      }
      if (activeVessel) {
        const target = activeVessel.mmsi || activeVessel.imo || activeVessel.name;
        if (target) {
          await runVesselDirectLookup(target, true, true);
        }
      }
    } finally {
      setRefreshing(false);
    }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20 space-y-8">
      {/* Unified Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-700 font-semibold">
            <Radio className="w-3.5 h-3.5" />
            Export Orders &amp; Live Global Maritime AIS
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Track</h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Enter an <strong>Export Order Code</strong> (
            <span className="font-mono text-slate-900">AUZ-2026-XXXXXX</span>), a{' '}
            <strong>7-digit IMO number</strong>, a <strong>9-digit MMSI number</strong>, or a{' '}
            <strong>Vessel Name</strong> to follow your 14-stage export pipeline and live satellite
            vessel position in one place.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer disabled:opacity-60 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Live Position
        </button>
      </div>

      {/* Unified Search Bar (Order Code OR Vessel IMO / MMSI / Name) */}
      <div className="bg-slate-950 text-white rounded-xl p-5 border border-slate-800 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Track by Export Order Code or Vessel Number (IMO / MMSI / Ship Name)
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Automatically detects export orders, Bills of Lading, and active Ro-Ro or container
              ships on the live satellite map below.
            </p>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border bg-emerald-950 text-emerald-300 border-emerald-800">
            {aisStatus?.connected
              ? `AISSTREAM LIVE · ${aisStatus.subscribedMmsis.length} MMSI`
              : 'LIVE GLOBAL AIS READY'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Ship className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              maxLength={60}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Order code (AUZ-2026-...), IMO (9700524), MMSI (265012000), or Vessel Name..."
              className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || queryInput.trim().length < 2}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer disabled:opacity-60 shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Tracking...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Track
              </>
            )}
          </button>
        </form>

        {/* Quick-try buttons for both real vessels & sample orders */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span>Live Ro-Ro ships:</span>
          {QUICK_REAL_VESSELS.map((ex) => (
            <button
              key={ex.query}
              type="button"
              disabled={loading}
              onClick={() => {
                setQueryInput(ex.query);
                void runUnifiedLookup(ex.query);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 font-mono transition-colors cursor-pointer disabled:opacity-50"
            >
              <Ship className="w-3 h-3" />
              {ex.label}
            </button>
          ))}
          <span className="text-slate-700">|</span>
          <span>Orders:</span>
          {SEED_ORDERS.map((o) => (
            <button
              key={o.trackingCode}
              type="button"
              disabled={loading}
              onClick={() => {
                setQueryInput(o.trackingCode);
                void runUnifiedLookup(o.trackingCode);
              }}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-mono transition-colors cursor-pointer disabled:opacity-50"
            >
              {o.trackingCode} ({o.destinationCountry})
            </button>
          ))}
        </div>

        {/* Multiple vessel candidate matches */}
        {candidates.length > 1 && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="text-[11px] font-semibold text-slate-300">
              Matching vessels ({candidates.length}) — click any ship to plot its live position:
            </div>
            <div className="flex flex-wrap gap-2">
              {candidates.slice(0, 8).map((c) => (
                <button
                  key={c.detailId}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    const target = c.imo || c.mmsi || c.detailId;
                    setQueryInput(target);
                    void runUnifiedLookup(target);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500 text-left text-[11px] transition-colors cursor-pointer"
                >
                  <span className="font-bold text-white">{c.name}</span>
                  {c.imo && <span className="text-amber-400 font-mono ml-1.5">IMO {c.imo}</span>}
                  {c.vesselType && <span className="text-slate-400 ml-1.5">· {c.vesselType}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {lookupNotice && (
          <div
            className={`p-3 rounded-lg text-xs border ${
              lookupNotice.ok
                ? lookupNotice.vessel?.latitude !== null
                  ? 'bg-emerald-950/70 border-emerald-700 text-emerald-200'
                  : 'bg-amber-950/70 border-amber-700 text-amber-200'
                : 'bg-red-950/70 border-red-700 text-red-200'
            }`}
          >
            {lookupNotice.message}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg text-xs border bg-red-950/70 border-red-700 text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Not Found Notice (when query matched neither an order nor a vessel) */}
      {!loading && notFoundQuery && !record && !error && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
          <PackageSearch className="w-8 h-8 text-slate-400 mx-auto" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-slate-900">
            No order or active vessel found for &ldquo;{searchedQuery}&rdquo;
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Verify your <strong>7-digit IMO number</strong>, <strong>9-digit MMSI</strong>, vessel
            name, or <span className="font-mono">AUZ-2026-XXXXXX</span> export order code, or
            contact {settings.supportEmail}.
          </p>
        </div>
      )}

      {/* Matched Export Order Pipeline Card */}
      {record && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-6 py-5 bg-slate-950 text-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-amber-400">{record.trackingCode}</div>
              <h2 className="text-lg font-bold mt-0.5">{record.vehicleTitle}</h2>
              <div className="text-xs text-slate-300 font-mono mt-1">
                Stock {record.vehicleStockCode} · Destination: {record.destinationPortName}
              </div>
            </div>
            <div className="flex items-start gap-4">
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
              <button
                type="button"
                onClick={() => setRecord(null)}
                aria-label="Close order details"
                title="Close order details"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    14-Stage Export Trade Pipeline
                  </h3>
                  <span className="text-xs font-mono font-semibold text-amber-800">
                    Stage {activeTradeIdx + 1} of 14:{' '}
                    {TRADE_MILESTONE_META[record.milestone as TradeOrderMilestone].label}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {TRADE_MILESTONE_ORDER.map((step, index) => {
                    const isCompleted = index < activeTradeIdx;
                    const isCurrent = index === activeTradeIdx;
                    const meta = TRADE_MILESTONE_META[step];
                    return (
                      <div
                        key={step}
                        className={`p-2.5 rounded-lg border text-xs ${
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
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-500">
                  Export Milestone Timeline
                </h3>
                <ol className="space-y-2.5">
                  {MILESTONE_ORDER.map((step, index) => {
                    const isCompleted = index < activeLegacyIdx;
                    const isCurrent = index === activeLegacyIdx;
                    const meta = MILESTONE_META[step];
                    return (
                      <li
                        key={step}
                        className={`flex items-start gap-3.5 p-3 rounded-lg border ${
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

            {/* Assigned Vessel & Coordinator Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                    <Anchor className="w-4 h-4 text-amber-700" />
                    <span>Vessel &amp; Sailing Schedule</span>
                  </div>
                  {resolvingOrderVessel && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-700">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Locating on map...
                    </span>
                  )}
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
          </div>
        </div>
      )}

      {/* Live Satellite Vessel Tracking Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Tracked Vessels Roster */}
        <div className="lg:col-span-4 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={rosterFilter}
              onChange={(e) => setRosterFilter(e.target.value)}
              placeholder="Filter vessels by name, IMO, MMSI, port, order..."
              className="w-full pl-9 pr-3 py-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-900">
              <span className="flex items-center gap-1.5">
                <Ship className="w-4 h-4 text-amber-600" />
                Tracked Vessels ({filteredVessels.length})
              </span>
              <span className="text-[10px] font-mono text-emerald-700 font-semibold">
                {aisStatus?.connected ? 'AISSTREAM' : 'GLOBAL AIS'}
              </span>
            </div>

            {filteredVessels.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <Anchor className="w-7 h-7 text-slate-300 mx-auto" />
                <div className="font-semibold text-slate-700">No vessels tracked yet</div>
                <p>
                  Enter any ship&apos;s <strong>IMO number</strong>, <strong>MMSI</strong>, or{' '}
                  <strong>vessel name</strong> above to plot its live satellite position.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 max-h-[460px] overflow-y-auto">
                {filteredVessels.map((v) => {
                  const freshness = getVesselFreshness(v);
                  const isSelected = activeVessel?.id === v.id;
                  const dotColor =
                    freshness.status === 'live'
                      ? 'bg-emerald-500'
                      : freshness.status === 'stale'
                        ? 'bg-amber-500'
                        : freshness.status === 'outdated'
                          ? 'bg-red-500'
                          : freshness.status === 'manual_only'
                            ? 'bg-blue-500'
                            : 'bg-slate-400';

                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVesselId(v.id)}
                      className={`w-full text-left p-4 transition-colors cursor-pointer space-y-1.5 ${
                        isSelected
                          ? 'bg-slate-950 text-white'
                          : 'bg-white text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm truncate">{v.name}</span>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono shrink-0">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          {freshness.status === 'live'
                            ? 'LIVE'
                            : freshness.status === 'manual_only'
                              ? 'MANUAL'
                              : freshness.status === 'outdated'
                                ? 'OUTDATED'
                                : freshness.status === 'stale'
                                  ? 'DELAYED'
                                  : 'PENDING'}
                        </span>
                      </div>
                      <div
                        className={`text-[11px] font-mono ${
                          isSelected ? 'text-amber-400' : 'text-slate-500'
                        }`}
                      >
                        {v.imo ? `IMO ${v.imo}` : ''}
                        {v.imo && v.mmsi ? ' · ' : ''}
                        {v.mmsi ? `MMSI ${v.mmsi}` : ''}
                      </div>
                      <div className={`text-xs ${isSelected ? 'text-slate-300' : 'text-slate-600'}`}>
                        {v.originPort || 'At Sea'} &rarr;{' '}
                        {v.aisDestination || v.destinationPort || 'Destination TBD'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Google Satellite Map + Selected Vessel Telemetry */}
        <div className="lg:col-span-8 space-y-6">
          <VesselLeafletMap
            vessels={filteredVessels}
            selectedVesselId={activeVessel?.id || null}
            onSelectVessel={setSelectedVesselId}
            heightClass="h-[460px]"
          />

          {activeVessel && activeFreshness && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <div className="text-xs font-mono text-amber-700 font-semibold">
                    {activeVessel.imo ? `IMO ${activeVessel.imo}` : ''}
                    {activeVessel.imo && activeVessel.mmsi ? ' · ' : ''}
                    {activeVessel.mmsi ? `MMSI ${activeVessel.mmsi}` : ''}
                    {activeVessel.callSign ? ` · Call Sign ${activeVessel.callSign}` : ''}
                  </div>
                  <h2 className="text-xl font-bold text-slate-950 mt-0.5">{activeVessel.name}</h2>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {activeVessel.carrier ? `${activeVessel.carrier} · ` : ''}
                    {activeVessel.voyageNumber ? `Voyage ${activeVessel.voyageNumber} · ` : ''}
                    Route: {activeVessel.originPort || 'Last Port N/A'} &rarr;{' '}
                    {activeVessel.aisDestination || activeVessel.destinationPort || 'TBD'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isTemporaryLiveVessel && canRegisterVessels && onQuickRegisterVessel && (
                    <button
                      type="button"
                      disabled={savingToFleet}
                      onClick={async () => {
                        setSavingToFleet(true);
                        try {
                          await onQuickRegisterVessel(activeVessel);
                        } finally {
                          setSavingToFleet(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer disabled:opacity-60"
                    >
                      {savingToFleet ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <PlusCircle className="w-3.5 h-3.5" />
                      )}
                      Save to Fleet Roster
                    </button>
                  )}
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                      activeFreshness.status === 'live'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : activeFreshness.status === 'outdated'
                          ? 'bg-red-50 text-red-900 border-red-200'
                          : activeFreshness.status === 'stale'
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {activeFreshness.status === 'outdated' || activeFreshness.status === 'stale' ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <Radio className="w-3.5 h-3.5" />
                    )}
                    {activeFreshness.label}
                  </div>
                </div>
              </div>

              {(activeFreshness.status === 'outdated' || activeFreshness.status === 'stale') && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Delayed AIS Position Notice:</strong> The last automated AIS broadcast
                    for {activeVessel.name} was received on{' '}
                    {new Date(activeVessel.lastAisUpdateAt).toLocaleString()}. Deep-ocean vessels
                    outside coastal terrestrial AIS receivers update intermittently.
                  </div>
                </div>
              )}

              {/* Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-amber-600" />
                    Speed (SOG)
                  </div>
                  <div className="font-mono font-bold text-slate-950 text-sm mt-1">
                    {typeof activeVessel.speedKnots === 'number'
                      ? `${activeVessel.speedKnots.toFixed(1)} kn`
                      : 'N/A'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                    <Compass className="w-3 h-3 text-amber-600" />
                    Course / Heading
                  </div>
                  <div className="font-mono font-bold text-slate-950 text-sm mt-1">
                    {typeof activeVessel.courseDeg === 'number'
                      ? `${activeVessel.courseDeg.toFixed(1)}°`
                      : '—'}
                    {typeof activeVessel.headingDeg === 'number'
                      ? ` / ${activeVessel.headingDeg}°`
                      : ''}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-amber-600" />
                    AIS Destination
                  </div>
                  <div
                    className="font-mono font-bold text-slate-950 text-sm mt-1 truncate"
                    title={activeVessel.aisDestination || activeVessel.destinationPort || 'Pending'}
                  >
                    {activeVessel.aisDestination || activeVessel.destinationPort || 'Pending'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    Reported ETA
                  </div>
                  <div className="font-mono font-bold text-slate-950 text-sm mt-1">
                    {activeVessel.etaReported || activeVessel.etaManual || 'Pending'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-600" />
                    Live Coordinates &amp; Navigation Status
                  </div>
                  <div className="font-mono text-slate-900 font-semibold">
                    {typeof activeVessel.latitude === 'number' &&
                    typeof activeVessel.longitude === 'number'
                      ? `${activeVessel.latitude.toFixed(4)}°, ${activeVessel.longitude.toFixed(4)}°`
                      : typeof activeVessel.manualLatitude === 'number' &&
                          typeof activeVessel.manualLongitude === 'number'
                        ? `${activeVessel.manualLatitude.toFixed(4)}°, ${activeVessel.manualLongitude.toFixed(4)}° (Manual Fix)`
                        : 'Awaiting coordinates'}
                  </div>
                  <div className="text-slate-600">
                    {activeTelemetry?.navStatusText || formatNavigationalStatus(activeVessel.navStatus)}
                    {activeVessel.lastAisUpdateAt
                      ? ` · Last AIS: ${new Date(activeVessel.lastAisUpdateAt).toLocaleString()}`
                      : ''}
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1">
                  <div className="text-[10px] font-semibold text-blue-900 uppercase">
                    Port Call &amp; Coordinator Status
                  </div>
                  <div className="font-semibold text-slate-950">
                    {activeVessel.originPort
                      ? `Last Port: ${activeVessel.originPort}`
                      : activeVessel.manualStatus || 'Carrier schedule monitored by Operations Desk'}
                  </div>
                  <div className="text-slate-700">
                    {activeVessel.manualLocationNote ||
                      'When vessels sail outside coastal AIS range, operations coordinators post verified carrier checkpoints here.'}
                  </div>
                  {activeVessel.manualUpdatedAt && (
                    <div className="text-[10px] font-mono text-blue-800">
                      Posted: {new Date(activeVessel.manualUpdatedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {assignedOrdersForVessel.length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-900">
                    Assigned Shipments on {activeVessel.name} ({assignedOrdersForVessel.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assignedOrdersForVessel.map((ord) => (
                      <button
                        key={ord.trackingCode}
                        type="button"
                        onClick={() => {
                          setQueryInput(ord.trackingCode);
                          void runUnifiedLookup(ord.trackingCode);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-100 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-900 rounded-lg font-mono cursor-pointer transition-colors"
                      >
                        <span className="font-semibold text-amber-800">{ord.trackingCode}</span>
                        <span>· {ord.vehicleTitle}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Attribution Notice */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p>
          Vessel AIS telemetry powered by{' '}
          <a
            href="https://aisstream.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-900 font-semibold underline hover:text-amber-700"
          >
            AISStream
          </a>{' '}
          &amp; Global Maritime AIS feeds, rendered on{' '}
          <a
            href="https://mapsplatform.google.com/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-900 font-semibold underline hover:text-amber-700"
          >
            Google Maps Platform
          </a>{' '}
          Satellite imagery. AIS positions depend on coastal and satellite receiver coverage; always
          confirm official discharge schedules with your Auzio Traders export coordinator.
        </p>
      </div>
    </div>
  );
}
