import {
  AlertTriangle,
  Anchor,
  Clock,
  Compass,
  Gauge,
  Loader2,
  MapPin,
  Navigation,
  PlusCircle,
  Radio,
  RefreshCw,
  Search,
  Ship,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { VesselLeafletMap } from '../components/VesselLeafletMap';
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
  ExportOrder,
  LiveVesselTelemetry,
  RegisteredVessel,
} from '../types/portal';

const QUICK_REAL_VESSELS = [
  { label: 'IMO 9700524 · TRAVIATA (Ro-Ro)', query: '9700524' },
  { label: 'IMO 9684976 · HOEGH TARGET (Ro-Ro)', query: '9684976' },
  { label: 'IMO 9446013 · MORNING LILY (Ro-Ro)', query: '9446013' },
];

interface VesselTrackingViewProps {
  vessels: RegisteredVessel[];
  liveAisPositions: Record<string, LiveVesselTelemetry>;
  aisStatus: AisServiceStatusResponse | null;
  orders: ExportOrder[];
  canRegisterVessels?: boolean;
  onRefreshPositions: () => Promise<void>;
  onQuickRegisterVessel?: (vessel: RegisteredVessel) => Promise<void>;
  onOpenOrderTracker: (trackingCode?: string) => void;
}

export function VesselTrackingView({
  vessels,
  liveAisPositions,
  aisStatus,
  orders,
  canRegisterVessels = false,
  onRefreshPositions,
  onQuickRegisterVessel,
  onOpenOrderTracker,
}: VesselTrackingViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [vesselQueryInput, setVesselQueryInput] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [resolvedMap, setResolvedMap] = useState<Record<string, LiveVesselTelemetry>>({});
  const [candidates, setCandidates] = useState<VesselSearchCandidate[]>([]);
  const [lookupNotice, setLookupNotice] = useState<VesselLookupResponse | null>(null);
  const [savingToFleet, setSavingToFleet] = useState(false);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(vessels[0]?.id || null);
  const [refreshing, setRefreshing] = useState(false);

  // Merge registered Firestore vessels, server live AIS positions, and session-resolved vessels
  const combinedVessels = useMemo<RegisteredVessel[]>(() => {
    const mergedLiveByMmsi: Record<string, LiveVesselTelemetry> = {
      ...(liveAisPositions || {}),
      ...resolvedMap,
    };

    // Enrich registered Firestore vessels with fresher session-resolved telemetry when matching MMSI or IMO
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

    // Add resolved session vessels first (most recently searched at top of extras)
    for (const live of Object.values(resolvedMap)) {
      if ((live.mmsi && existingMmsis.has(live.mmsi)) || (live.imo && existingImos.has(live.imo))) {
        continue;
      }
      const key = live.mmsi || live.imo || live.vesselName;
      if (seenExtraKeys.has(key)) continue;
      seenExtraKeys.add(key);
      extras.push(telemetryToRegisteredVessel(live));
    }

    // Add any server-cached AIS positions not already present
    for (const [mmsi, live] of Object.entries(liveAisPositions || {})) {
      if (existingMmsis.has(mmsi) || seenExtraKeys.has(mmsi)) continue;
      seenExtraKeys.add(mmsi);
      extras.push(telemetryToRegisteredVessel(live));
    }

    return [...extras, ...enrichedRegistered];
  }, [vessels, liveAisPositions, resolvedMap]);

  const filteredVessels = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return combinedVessels;
    return combinedVessels.filter((v) => {
      const assignedOrders = orders.filter(
        (o) => o.vesselId === v.id || (o.vesselMmsi && o.vesselMmsi === v.mmsi)
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
  }, [combinedVessels, orders, searchTerm]);

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
    return orders.filter(
      (o) =>
        o.vesselId === activeVessel.id ||
        (o.vesselMmsi && o.vesselMmsi === activeVessel.mmsi) ||
        (o.vesselName && o.vesselName.toLowerCase() === activeVessel.name.toLowerCase())
    );
  }, [orders, activeVessel]);

  const executeVesselLookup = async (rawQuery: string, bypassCache = false) => {
    const cleaned = rawQuery.trim();
    if (cleaned.length < 2) {
      setLookupNotice({
        ok: false,
        query: cleaned,
        queryType: 'name',
        vessel: null,
        candidates: [],
        source: 'none',
        message: 'Enter a 7-digit IMO number, 9-digit MMSI number, or vessel name.',
      });
      return;
    }

    setLookingUp(true);
    setLookupNotice(null);
    try {
      const res = await lookupVesselByNumber(cleaned, bypassCache);
      setLookupNotice(res);
      setCandidates(res.candidates || []);

      if (res.ok && res.vessel) {
        const key = res.vessel.mmsi || res.vessel.imo || res.vessel.vesselName;
        setResolvedMap((prev) => ({
          [key]: res.vessel!,
          ...prev,
        }));
        const registeredMatch = vessels.find(
          (v) =>
            (res.vessel!.mmsi && v.mmsi === res.vessel!.mmsi) ||
            (res.vessel!.imo && v.imo === res.vessel!.imo)
        );
        const nextId = registeredMatch
          ? registeredMatch.id
          : telemetryToRegisteredVessel(res.vessel).id;
        setSelectedVesselId(nextId);
        void onRefreshPositions();
      }
    } catch (err) {
      setLookupNotice({
        ok: false,
        query: cleaned,
        queryType: 'name',
        vessel: null,
        candidates: [],
        source: 'none',
        message: err instanceof Error ? err.message : 'Unable to reach vessel tracking service.',
      });
    } finally {
      setLookingUp(false);
    }
  };

  const handleVesselLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeVesselLookup(vesselQueryInput);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshPositions();
      if (activeVessel) {
        const target = activeVessel.mmsi || activeVessel.imo || activeVessel.name;
        if (target) {
          await executeVesselLookup(target, true);
        }
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-700 font-semibold">
            <Radio className="w-3.5 h-3.5" />
            Live Global Maritime AIS Telemetry
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Global Export Vessel Tracking
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Track any active Ro-Ro car carrier or container ship by its 7-digit IMO number,
            9-digit MMSI number, or vessel name from your Bill of Lading.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Live Position
          </button>
          <button
            type="button"
            onClick={() => onOpenOrderTracker()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            Track by Order Code
          </button>
        </div>
      </div>

      {/* Live Vessel Number Lookup Bar (IMO / MMSI / Vessel Name) */}
      <div className="bg-slate-950 text-white rounded-xl p-5 border border-slate-800 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              Track Shipment by Vessel Number (IMO, MMSI, or Vessel Name)
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Enter your ship&apos;s <strong>7-digit IMO number</strong>,{' '}
              <strong>9-digit MMSI number</strong>, or <strong>vessel name</strong> from your Bill
              of Lading to plot its live AIS coordinates, speed, heading, destination, and ETA.
            </p>
          </div>
          <span
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border ${
              aisStatus?.connected
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
            }`}
          >
            {aisStatus?.connected
              ? `AISSTREAM LIVE · ${aisStatus.subscribedMmsis.length} MMSI`
              : 'LIVE GLOBAL AIS READY'}
          </span>
        </div>

        <form onSubmit={handleVesselLookupSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Ship className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              maxLength={60}
              value={vesselQueryInput}
              onChange={(e) => setVesselQueryInput(e.target.value)}
              placeholder="Enter IMO (e.g. 9700524), MMSI (e.g. 265012000), or Vessel Name (e.g. HOEGH TARGET)..."
              className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={lookingUp}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer disabled:opacity-60 shrink-0"
          >
            {lookingUp ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Locating Vessel...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Track Vessel
              </>
            )}
          </button>
        </form>

        {/* Quick-try verified live Ro-Ro car carriers */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span>Active Ro-Ro examples:</span>
          {QUICK_REAL_VESSELS.map((ex) => (
            <button
              key={ex.query}
              type="button"
              disabled={lookingUp}
              onClick={() => {
                setVesselQueryInput(ex.query);
                void executeVesselLookup(ex.query);
              }}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-mono transition-colors cursor-pointer disabled:opacity-50"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Multiple matching candidates picker */}
        {candidates.length > 1 && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="text-[11px] font-semibold text-slate-300">
              Matching vessels ({candidates.length}) — click any ship to track its live position:
            </div>
            <div className="flex flex-wrap gap-2">
              {candidates.slice(0, 8).map((c) => (
                <button
                  key={c.detailId}
                  type="button"
                  disabled={lookingUp}
                  onClick={() => {
                    const target = c.imo || c.mmsi || c.detailId;
                    setVesselQueryInput(target);
                    void executeVesselLookup(target);
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
      </div>

      {/* Main Split: Vessel Roster + Interactive Leaflet Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Roster */}
        <div className="lg:col-span-4 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter tracked vessels by name, IMO, MMSI, port..."
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
                  <strong>vessel name</strong> above to plot its real-time location immediately.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 max-h-[420px] overflow-y-auto">
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

        {/* Right: Map + Selected Vessel Telemetry Card */}
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

              {/* Outdated / Stale Position Warning */}
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

                {/* Voyage / Coordinator Fallback Update */}
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
                        key={ord.id}
                        type="button"
                        onClick={() => onOpenOrderTracker(ord.trackingCode)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg font-mono cursor-pointer"
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

      {/* Attribution & Licensing Notice */}
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
