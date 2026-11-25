import {
  Activity,
  AlertTriangle,
  Anchor,
  CheckCircle2,
  Coins,
  Edit3,
  ExternalLink,
  KeyRound,
  Loader2,
  MapPin,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Ship,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildDynamicCurrencyList } from '../../data/currencies';
import { auth } from '../../lib/firebase';
import {
  applyExchangeMargins,
  testExchangeRateApi,
  type ExchangeRateApiTestResult,
} from '../../services/exchangeRateService';
import {
  clearAisServerLogs,
  getVesselFreshness,
  syncAisFilters,
  testAisStreamConnection,
} from '../../services/vesselTrackingService';
import type {
  AisServiceStatusResponse,
  AisTestConnectionResponse,
  ApiIntegrationConfig,
  ExchangeRateCacheDoc,
  ExportOrder,
  LiveExchangeRateState,
  RegisteredVessel,
  UserRole,
} from '../../types/portal';
import { VesselLeafletMap } from '../VesselLeafletMap';

interface ApiIntegrationsPanelProps {
  role: UserRole;
  canEditSettings: boolean;
  canEditLogistics: boolean;
  liveFx: LiveExchangeRateState;
  fxCache: ExchangeRateCacheDoc | null;
  integrationConfig: ApiIntegrationConfig;
  vessels: RegisteredVessel[];
  aisStatus: AisServiceStatusResponse | null;
  orders: ExportOrder[];
  onRefreshFx: () => Promise<void>;
  onSaveFxMargins: (globalMarginPct: number, currencyMargins: Record<string, number>) => Promise<void>;
  onSaveIntegrationConfig: (next: ApiIntegrationConfig) => Promise<void>;
  onSaveVessel: (
    input: Omit<RegisteredVessel, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteVessel: (vesselId: string) => Promise<void>;
  onManualVesselUpdate: (params: {
    vessel: RegisteredVessel;
    manualStatus: string;
    manualLocationNote: string;
    etaManual: string;
    manualLatitude?: number | null;
    manualLongitude?: number | null;
  }) => Promise<void>;
  onAssignOrderToVessel: (order: ExportOrder, vessel: RegisteredVessel) => Promise<void>;
  onRefreshAisStatus: () => Promise<void>;
  onPersistLiveAisToFirestore: () => Promise<number>;
  onNotify: (msg: string) => void;
}

type IntegrationSubTab = 'overview' | 'exchange_rates' | 'vessels' | 'logs';

export function ApiIntegrationsPanel({
  canEditSettings,
  canEditLogistics,
  liveFx,
  fxCache,
  integrationConfig,
  vessels,
  aisStatus,
  orders,
  onRefreshFx,
  onSaveFxMargins,
  onSaveIntegrationConfig,
  onSaveVessel,
  onDeleteVessel,
  onManualVesselUpdate,
  onAssignOrderToVessel,
  onRefreshAisStatus,
  onPersistLiveAisToFirestore,
  onNotify,
}: ApiIntegrationsPanelProps) {
  const [subTab, setSubTab] = useState<IntegrationSubTab>('overview');

  // Exchange Rate Test & Margin State
  const [fxTesting, setFxTesting] = useState(false);
  const [fxSyncing, setFxSyncing] = useState(false);
  const [fxTestResult, setFxTestResult] = useState<ExchangeRateApiTestResult | null>(null);
  const [globalMarginInput, setGlobalMarginInput] = useState<number>(
    fxCache?.globalMarginPct ?? liveFx.globalMarginPct ?? 0
  );
  const [customMargins, setCustomMargins] = useState<Record<string, number>>(
    fxCache?.currencyMargins ?? liveFx.currencyMargins ?? {}
  );
  const [newMarginCurrency, setNewMarginCurrency] = useState('JPY');
  const [newMarginPct, setNewMarginPct] = useState('1.5');
  const [fxSearch, setFxSearch] = useState('');
  const [savingMargins, setSavingMargins] = useState(false);

  // AISStream Test & Sync State
  const [aisTesting, setAisTesting] = useState(false);
  const [aisSyncing, setAisSyncing] = useState(false);
  const [aisPersisting, setAisPersisting] = useState(false);
  const [aisTestResult, setAisTestResult] = useState<AisTestConnectionResponse | null>(null);

  // Vessel Registration Form State
  const [editingVesselId, setEditingVesselId] = useState<string | null>(null);
  const [vName, setVName] = useState('');
  const [vMmsi, setVMmsi] = useState('');
  const [vImo, setVImo] = useState('');
  const [vCallSign, setVCallSign] = useState('');
  const [vCarrier, setVCarrier] = useState('');
  const [vVoyage, setVVoyage] = useState('');
  const [vOrigin, setVOrigin] = useState('Yokohama, Japan');
  const [vDestination, setVDestination] = useState('Mombasa, Kenya');
  const [vEtaManual, setVEtaManual] = useState('');
  const [vTrackingEnabled, setVTrackingEnabled] = useState(true);
  const [savingVessel, setSavingVessel] = useState(false);

  // Manual Position Update Modal/Form State
  const [manualVessel, setManualVessel] = useState<RegisteredVessel | null>(null);
  const [manualStatus, setManualStatus] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualEta, setManualEta] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  // Shipment Assignment State
  const [assignOrderId, setAssignOrderId] = useState(orders[0]?.id || '');
  const [assignVesselId, setAssignVesselId] = useState(vessels[0]?.id || '');
  const [assigning, setAssigning] = useState(false);

  // Log Filter
  const [logFilter, setLogFilter] = useState<'all' | 'exchange_rate' | 'aisstream'>('all');

  const rawUsdRates = fxCache?.rates || liveFx.rawRates || liveFx.rates || { USD: 1 };
  const jpyRates = fxCache?.jpyRates || liveFx.jpyRates || { JPY: 1 };

  const previewAdjustedRates = useMemo(
    () => applyExchangeMargins(rawUsdRates, globalMarginInput, customMargins),
    [rawUsdRates, globalMarginInput, customMargins]
  );

  const allCurrencies = useMemo(() => {
    const list = buildDynamicCurrencyList(rawUsdRates);
    const q = fxSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [rawUsdRates, fxSearch]);

  const combinedLogs = useMemo(() => {
    const serverAisLogs = (aisStatus?.errorLogs || []).map((entry, idx) => ({
      id: `srv-ais-${idx}-${entry.timestamp}`,
      provider: 'aisstream' as const,
      level: entry.level,
      message: entry.message,
      timestamp: entry.timestamp,
      source: 'Backend WebSocket',
    }));
    const savedLogs = (integrationConfig.errorLogs || []).map((entry) => ({
      ...entry,
      source: 'Firestore Log',
    }));
    const merged = [...serverAisLogs, ...savedLogs].sort(
      (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
    );
    if (logFilter === 'all') return merged;
    return merged.filter((l) => l.provider === logFilter);
  }, [aisStatus?.errorLogs, integrationConfig.errorLogs, logFilter]);

  const getIdToken = async (): Promise<string> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Staff authentication token required.');
    }
    return token;
  };

  const appendConfigLog = async (
    provider: 'exchange_rate' | 'aisstream',
    level: 'error' | 'warning' | 'info',
    message: string
  ) => {
    if (!canEditSettings) return;
    const nextLogs = [
      {
        id: `log-${Date.now().toString(36)}`,
        provider,
        level,
        message,
        timestamp: new Date().toISOString(),
      },
      ...(integrationConfig.errorLogs || []),
    ].slice(0, 60);
    try {
      await onSaveIntegrationConfig({
        ...integrationConfig,
        errorLogs: nextLogs,
      });
    } catch {
      // Non-blocking log persistence
    }
  };

  const handleTestFx = async () => {
    setFxTesting(true);
    try {
      const token = await getIdToken();
      const res = await testExchangeRateApi(token);
      setFxTestResult(res);
      if (res.ok) {
        onNotify(
          `ExchangeRate-API verified (${res.supportedCount} currencies, USD/JPY ${res.sampleUsdToJpy ?? '—'})`
        );
        await appendConfigLog(
          'exchange_rate',
          'info',
          `Live test succeeded (${res.latencyMs}ms): USD & JPY endpoints OK, ${res.supportedCount} currencies.`
        );
      } else {
        onNotify(res.error || 'ExchangeRate-API test returned an error');
        await appendConfigLog('exchange_rate', 'error', res.error || 'ExchangeRate-API test failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Test failed';
      onNotify(msg);
      await appendConfigLog('exchange_rate', 'error', msg);
    } finally {
      setFxTesting(false);
    }
  };

  const handleManualFxSync = async () => {
    setFxSyncing(true);
    try {
      await onRefreshFx();
      onNotify('Live USD & JPY exchange rates synchronized and cached in Firestore.');
    } finally {
      setFxSyncing(false);
    }
  };

  const handleSaveMargins = async () => {
    setSavingMargins(true);
    try {
      await onSaveFxMargins(globalMarginInput, customMargins);
      onNotify('Currency conversion margins saved to Firestore and applied across portal.');
    } finally {
      setSavingMargins(false);
    }
  };

  const handleAddCurrencyMargin = () => {
    const code = newMarginCurrency.trim().toUpperCase();
    const num = Number(newMarginPct);
    if (!/^[A-Z]{3}$/.test(code) || !Number.isFinite(num)) return;
    setCustomMargins((prev) => ({
      ...prev,
      [code]: Math.max(-20, Math.min(25, Number(num.toFixed(2)))),
    }));
  };

  const handleTestAis = async () => {
    setAisTesting(true);
    try {
      const token = await getIdToken();
      const activeMmsis = vessels.filter((v) => v.trackingEnabled).map((v) => v.mmsi);
      const res = await testAisStreamConnection(token, activeMmsis);
      setAisTestResult(res);
      if (res.ok) {
        onNotify(res.message);
        await appendConfigLog('aisstream', 'info', `Test OK (${res.latencyMs}ms): ${res.message}`);
      } else {
        onNotify(res.message);
        await appendConfigLog('aisstream', 'warning', `Test check: ${res.message}`);
      }
      await onRefreshAisStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AISStream test failed';
      onNotify(msg);
      await appendConfigLog('aisstream', 'error', msg);
    } finally {
      setAisTesting(false);
    }
  };

  const handleSyncAisFilters = async () => {
    setAisSyncing(true);
    try {
      const token = await getIdToken();
      const activeMmsis = vessels.filter((v) => v.trackingEnabled).map((v) => v.mmsi);
      await syncAisFilters(token, {
        enabled: integrationConfig.vesselTrackingEnabled,
        mmsis: activeMmsis,
      });
      await onRefreshAisStatus();
      onNotify(
        activeMmsis.length > 0
          ? `Synced ${activeMmsis.length} vessel MMSI filter(s) with AISStream backend.`
          : 'No active vessel MMSIs registered — AISStream remains safely idle.'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to sync AISStream filters');
    } finally {
      setAisSyncing(false);
    }
  };

  const handlePersistLiveAis = async () => {
    setAisPersisting(true);
    try {
      const updatedCount = await onPersistLiveAisToFirestore();
      onNotify(
        updatedCount > 0
          ? `Saved latest AISStream telemetry for ${updatedCount} vessel(s) into Firestore.`
          : 'All Firestore vessel records are already up to date with server telemetry.'
      );
    } finally {
      setAisPersisting(false);
    }
  };

  const handleToggleIntegration = async (
    key: 'exchangeRateEnabled' | 'vesselTrackingEnabled' | 'commercialDisplayConfirmed',
    value: boolean
  ) => {
    const nextConfig: ApiIntegrationConfig = {
      ...integrationConfig,
      [key]: value,
    };
    await onSaveIntegrationConfig(nextConfig);
    if (key === 'vesselTrackingEnabled') {
      try {
        const token = await getIdToken();
        const activeMmsis = vessels.filter((v) => v.trackingEnabled).map((v) => v.mmsi);
        await syncAisFilters(token, { enabled: value, mmsis: activeMmsis });
        await onRefreshAisStatus();
      } catch {
        // Ignore if not yet configured
      }
    }
    onNotify('API integration settings updated.');
  };

  const resetVesselForm = () => {
    setEditingVesselId(null);
    setVName('');
    setVMmsi('');
    setVImo('');
    setVCallSign('');
    setVCarrier('');
    setVVoyage('');
    setVOrigin('Yokohama, Japan');
    setVDestination('Mombasa, Kenya');
    setVEtaManual('');
    setVTrackingEnabled(true);
  };

  const startEditVessel = (v: RegisteredVessel) => {
    setEditingVesselId(v.id);
    setVName(v.name);
    setVMmsi(v.mmsi);
    setVImo(v.imo);
    setVCallSign(v.callSign);
    setVCarrier(v.carrier);
    setVVoyage(v.voyageNumber);
    setVOrigin(v.originPort);
    setVDestination(v.destinationPort);
    setVEtaManual(v.etaManual);
    setVTrackingEnabled(v.trackingEnabled);
  };

  const handleSubmitVessel = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMmsi = vMmsi.replace(/\D/g, '');
    if (!/^\d{9}$/.test(cleanMmsi)) {
      onNotify('MMSI must be exactly 9 numeric digits (e.g. 371234000).');
      return;
    }
    setSavingVessel(true);
    try {
      const existing = editingVesselId ? vessels.find((v) => v.id === editingVesselId) : undefined;
      await onSaveVessel(
        {
          name: vName.trim(),
          mmsi: cleanMmsi,
          imo: vImo.replace(/\D/g, ''),
          callSign: vCallSign.trim().toUpperCase(),
          carrier: vCarrier.trim(),
          voyageNumber: vVoyage.trim(),
          originPort: vOrigin.trim(),
          destinationPort: vDestination.trim(),
          etaReported: existing?.etaReported || '',
          etaManual: vEtaManual.trim(),
          latitude: existing?.latitude ?? null,
          longitude: existing?.longitude ?? null,
          speedKnots: existing?.speedKnots ?? null,
          courseDeg: existing?.courseDeg ?? null,
          headingDeg: existing?.headingDeg ?? null,
          navStatus: existing?.navStatus ?? null,
          aisDestination: existing?.aisDestination || '',
          lastAisUpdateAt: existing?.lastAisUpdateAt || '',
          manualStatus: existing?.manualStatus || '',
          manualLocationNote: existing?.manualLocationNote || '',
          manualLatitude: existing?.manualLatitude ?? null,
          manualLongitude: existing?.manualLongitude ?? null,
          manualUpdatedAt: existing?.manualUpdatedAt || '',
          trackingEnabled: vTrackingEnabled,
        },
        editingVesselId || undefined
      );
      resetVesselForm();
      onNotify(
        editingVesselId
          ? 'Vessel updated and MMSI filter synced.'
          : 'Vessel registered for AISStream tracking.'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to save vessel');
    } finally {
      setSavingVessel(false);
    }
  };

  const openManualUpdate = (v: RegisteredVessel) => {
    setManualVessel(v);
    setManualStatus(v.manualStatus || 'In Transit — Deep Ocean');
    setManualNote(v.manualLocationNote || '');
    setManualEta(v.etaManual || '');
    setManualLat(typeof v.manualLatitude === 'number' ? String(v.manualLatitude) : '');
    setManualLon(typeof v.manualLongitude === 'number' ? String(v.manualLongitude) : '');
  };

  const handleSaveManualUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualVessel) return;
    setSavingManual(true);
    try {
      const latNum = manualLat.trim() ? Number(manualLat) : null;
      const lonNum = manualLon.trim() ? Number(manualLon) : null;
      await onManualVesselUpdate({
        vessel: manualVessel,
        manualStatus,
        manualLocationNote: manualNote,
        etaManual: manualEta,
        manualLatitude: latNum !== null && Number.isFinite(latNum) ? latNum : null,
        manualLongitude: lonNum !== null && Number.isFinite(lonNum) ? lonNum : null,
      });
      setManualVessel(null);
      onNotify(`Manual checkpoint saved for ${manualVessel.name}.`);
    } finally {
      setSavingManual(false);
    }
  };

  const handleAssignShipment = async () => {
    const order = orders.find((o) => o.id === assignOrderId);
    const vessel = vessels.find((v) => v.id === assignVesselId);
    if (!order || !vessel) {
      onNotify('Please select both an Export Order and a Registered Vessel.');
      return;
    }
    setAssigning(true);
    try {
      await onAssignOrderToVessel(order, vessel);
      onNotify(`Assigned ${order.orderNumber} (${order.vehicleTitle}) to ${vessel.name}.`);
    } finally {
      setAssigning(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      const token = await getIdToken();
      await clearAisServerLogs(token);
      if (canEditSettings) {
        await onSaveIntegrationConfig({ ...integrationConfig, errorLogs: [] });
      }
      await onRefreshAisStatus();
      onNotify('API integration logs cleared.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to clear logs');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-600" />
            API Integrations &amp; Maritime Telemetry
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage real ExchangeRate-API (USD/JPY 24h Firestore cache + margins) and AISStream
            WebSocket vessel tracking.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {(
            [
              { id: 'overview', label: 'Status & Keys' },
              { id: 'exchange_rates', label: 'Exchange Rates & Margins' },
              { id: 'vessels', label: `Vessels (${vessels.length})` },
              { id: 'logs', label: `Error Logs (${combinedLogs.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                subTab === tab.id
                  ? 'bg-slate-950 text-white dark:bg-amber-600'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SUB-TAB 1: OVERVIEW, CONNECTION STATUS, TOGGLES & TEST BUTTONS */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ExchangeRate-API Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                      ExchangeRate-API (Open Access)
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500">
                      open.er-api.com/v6/latest/USD &amp; /JPY
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg ${
                    liveFx.ok
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {liveFx.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {liveFx.ok ? (liveFx.stale ? 'Cached Fallback' : 'Connected') : 'Unavailable'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Authentication</div>
                  <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    None (Free Open API)
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Imported Currencies</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                    {Object.keys(rawUsdRates).length} ISO 4217 codes
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Last Successful Sync</div>
                  <div className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                    {fxCache?.updatedAt || liveFx.updatedAt
                      ? new Date(fxCache?.updatedAt || liveFx.updatedAt || '').toLocaleString()
                      : 'Pending'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Active Global Margin</div>
                  <div className="font-mono font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                    {(fxCache?.globalMarginPct ?? 0) >= 0 ? '+' : ''}
                    {fxCache?.globalMarginPct ?? 0}% ({Object.keys(fxCache?.currencyMargins || {}).length} overrides)
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Auto-Sync 24h Exchange Rates
                </span>
                <button
                  type="button"
                  disabled={!canEditSettings}
                  onClick={() =>
                    handleToggleIntegration(
                      'exchangeRateEnabled',
                      !integrationConfig.exchangeRateEnabled
                    )
                  }
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
                    integrationConfig.exchangeRateEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {integrationConfig.exchangeRateEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTestFx}
                  disabled={fxTesting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {fxTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Activity className="w-3.5 h-3.5" />
                  )}
                  Test Connection
                </button>
                <button
                  type="button"
                  onClick={handleManualFxSync}
                  disabled={fxSyncing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fxSyncing ? 'animate-spin' : ''}`} />
                  Sync &amp; Cache Now
                </button>
                <a
                  href="https://www.exchangerate-api.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-amber-700 underline"
                >
                  Rates By Exchange Rate API
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {fxTestResult && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    fxTestResult.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-red-50 border-red-200 text-red-950'
                  }`}
                >
                  <div className="font-bold">
                    {fxTestResult.ok ? 'Live Connection Passed' : 'Connection Test Failed'} (
                    {fxTestResult.latencyMs} ms)
                  </div>
                  <div className="mt-1 font-mono text-[11px]">
                    USD Endpoint: {fxTestResult.usdEndpointOk ? 'OK' : 'FAIL'} · JPY Endpoint:{' '}
                    {fxTestResult.jpyEndpointOk ? 'OK' : 'FAIL'} · Currencies:{' '}
                    {fxTestResult.supportedCount}
                  </div>
                  {fxTestResult.sampleUsdToJpy && (
                    <div className="mt-0.5 font-mono text-[11px]">
                      1 USD = ¥{fxTestResult.sampleUsdToJpy} JPY · 1 JPY = $
                      {fxTestResult.sampleJpyToUsd} USD
                    </div>
                  )}
                  {fxTestResult.error && <div className="mt-1 text-red-700">{fxTestResult.error}</div>}
                </div>
              )}
            </div>

            {/* AISStream Vessel Tracking Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                      AISStream Live Vessel Tracking
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500">
                      wss://stream.aisstream.io/v0/stream (ws + perMessageDeflate)
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg ${
                    aisStatus?.connected
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : aisStatus?.configured
                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {aisStatus?.connected ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  {aisStatus?.state === 'connected'
                    ? 'WebSocket Live'
                    : aisStatus?.state === 'idle_no_vessels'
                      ? 'Ready (Add MMSI)'
                      : aisStatus?.state === 'unconfigured'
                        ? 'API Key Not Set'
                        : aisStatus?.state === 'disabled'
                          ? 'Disabled'
                          : aisStatus?.state || 'Checking...'}
                </span>
              </div>

              {/* Secure Server-Side Key Status (Never Accepts/Exposes Key in Browser) */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    Backend Secret: <code className="font-mono">AISSTREAM_API_KEY</code>
                  </span>
                  <span
                    className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                      aisStatus?.configured
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {aisStatus?.configured ? 'CONFIGURED (SERVER-ONLY)' : 'MISSING IN ENV'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  For security, <code className="font-mono">AISSTREAM_API_KEY</code> is read
                  exclusively from your Node.js server environment/Secrets (see{' '}
                  <code className="font-mono">.env.example</code>) and is never sent to browsers or
                  saved in Firestore.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500 uppercase">Subscribed MMSIs</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                    {aisStatus?.subscribedMmsis.length ?? 0} active vessel(s)
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500 uppercase">Last AIS Message</div>
                  <div className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                    {aisStatus?.lastMessageAt
                      ? new Date(aisStatus.lastMessageAt).toLocaleString()
                      : 'Awaiting broadcast'}
                  </div>
                </div>
              </div>

              <div className="space-y-2 py-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Enable Live AISStream WebSocket Tracking
                  </span>
                  <button
                    type="button"
                    disabled={!canEditSettings}
                    onClick={() =>
                      handleToggleIntegration(
                        'vesselTrackingEnabled',
                        !integrationConfig.vesselTrackingEnabled
                      )
                    }
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
                      integrationConfig.vesselTrackingEnabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {integrationConfig.vesselTrackingEnabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                <label className="flex items-start gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={integrationConfig.commercialDisplayConfirmed}
                    disabled={!canEditSettings}
                    onChange={(e) =>
                      handleToggleIntegration('commercialDisplayConfirmed', e.target.checked)
                    }
                    className="mt-0.5 rounded border-slate-300 accent-amber-600"
                  />
                  <span>
                    <strong>AISStream Commercial Display Compliance:</strong> Confirm your
                    AISStream account plan permits public/commercial customer portal display before
                    enabling public tracking in production.
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTestAis}
                  disabled={aisTesting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {aisTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Radio className="w-3.5 h-3.5" />
                  )}
                  Test Connection
                </button>
                <button
                  type="button"
                  onClick={handleSyncAisFilters}
                  disabled={aisSyncing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${aisSyncing ? 'animate-spin' : ''}`} />
                  Sync MMSI Filters
                </button>
                <button
                  type="button"
                  onClick={handlePersistLiveAis}
                  disabled={aisPersisting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-950 bg-amber-100 hover:bg-amber-200 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save AIS to Firestore
                </button>
              </div>

              {aisTestResult && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    aisTestResult.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="font-bold">
                    {aisTestResult.ok ? 'AISStream Handshake Verified' : 'AISStream Check Result'} (
                    {aisTestResult.latencyMs} ms)
                  </div>
                  <p className="mt-1">{aisTestResult.message}</p>
                </div>
              )}
            </div>
          </div>

          {/* Always-On Backend Hosting Architecture Note */}
          <div className="p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 flex items-start gap-3 text-xs">
            <Server className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-white">
                Production Deployment Note — Continuous WebSocket AIS Tracking
              </div>
              <p className="text-slate-300 leading-relaxed">
                AISStream delivers live vessel positions over a persistent outbound WebSocket
                connection. On scale-to-zero serverless platforms, idle instances suspend and close
                open WebSockets. For uninterrupted 24/7 AIS tracking in production, run this Node.js
                backend on always-on hosting (such as Cloud Run with{' '}
                <code className="font-mono text-amber-300">min-instances=1</code> or a dedicated
                Node.js VPS/container).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: EXCHANGE RATE MANAGEMENT & ADJUSTABLE MARGINS */}
      {subTab === 'exchange_rates' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Currency Conversion Margins &amp; 24h Firestore Cache
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Margins automatically adjust displayed vehicle and shipping prices portal-wide
                  while confirmed Proforma Invoices and Export Orders keep their locked exchange
                  rate snapshot.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveMargins}
                disabled={!canEditSettings || savingMargins}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer disabled:opacity-50"
              >
                {savingMargins ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Margins to Firestore
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <label className="text-xs font-bold text-slate-900 dark:text-white block">
                  Global Default Margin (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={-20}
                  max={25}
                  value={globalMarginInput}
                  disabled={!canEditSettings}
                  onChange={(e) => setGlobalMarginInput(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
                <p className="text-[11px] text-slate-500">
                  Applied to all non-USD currencies unless overridden below (e.g. +1.5% FX spread).
                </p>
              </div>

              <div className="md:col-span-2 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Per-Currency Margin Overrides (%)
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    maxLength={3}
                    value={newMarginCurrency}
                    onChange={(e) => setNewMarginCurrency(e.target.value.toUpperCase())}
                    placeholder="ISO (e.g. KES)"
                    className="w-28 px-3 py-1.5 text-xs font-mono uppercase bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min={-20}
                    max={25}
                    value={newMarginPct}
                    onChange={(e) => setNewMarginPct(e.target.value)}
                    placeholder="Margin %"
                    className="w-28 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    disabled={!canEditSettings}
                    onClick={handleAddCurrencyMargin}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add / Update Override
                  </button>
                </div>

                {Object.keys(customMargins).length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No per-currency overrides configured. All currencies use the Global Default
                    Margin ({globalMarginInput}%).
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(customMargins).map(([code, pct]) => (
                      <div
                        key={code}
                        className="inline-flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                      >
                        <span className="font-bold">{code}</span>
                        <span className="text-amber-700 dark:text-amber-400">
                          {pct >= 0 ? `+${pct}%` : `${pct}%`}
                        </span>
                        {canEditSettings && (
                          <button
                            type="button"
                            onClick={() =>
                              setCustomMargins((prev) => {
                                const next = { ...prev };
                                delete next[code];
                                return next;
                              })
                            }
                            className="text-slate-400 hover:text-red-600 cursor-pointer"
                            title="Remove override"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Live Imported Currencies Table */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fxSearch}
                    onChange={(e) => setFxSearch(e.target.value)}
                    placeholder="Filter 160+ currencies by code or name..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <a
                  href="https://www.exchangerate-api.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-amber-700 underline inline-flex items-center gap-1"
                >
                  Rates By Exchange Rate API
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-[420px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Currency</th>
                      <th className="px-4 py-2.5 font-semibold">Symbol</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Raw (1 USD)</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Margin</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Portal Rate (1 USD)</th>
                      <th className="px-4 py-2.5 font-semibold text-right">JPY Base (1 JPY)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {allCurrencies.map((cur) => {
                      const raw = rawUsdRates[cur.code];
                      const adjusted = previewAdjustedRates[cur.code];
                      const jpyRate = jpyRates[cur.code];
                      const margin =
                        cur.code === 'USD'
                          ? 0
                          : customMargins[cur.code] ?? globalMarginInput;
                      return (
                        <tr key={cur.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-2.5">
                            <span className="mr-2">{cur.flag}</span>
                            <span className="font-mono font-bold text-slate-950 dark:text-white">
                              {cur.code}
                            </span>{' '}
                            <span className="text-slate-500">{cur.name}</span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                            {cur.symbol}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                            {typeof raw === 'number' ? raw.toFixed(4) : '—'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-right text-amber-700 dark:text-amber-400">
                            {cur.code === 'USD' ? '0%' : `${margin >= 0 ? '+' : ''}${margin}%`}
                          </td>
                          <td className="px-4 py-2.5 font-mono font-bold text-right text-slate-950 dark:text-white">
                            {typeof adjusted === 'number' ? adjusted.toFixed(4) : '—'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-right text-slate-600 dark:text-slate-400">
                            {typeof jpyRate === 'number' ? jpyRate.toFixed(5) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: VESSEL MANAGEMENT, SHIPMENT ASSIGNMENT & MANUAL UPDATES */}
      {subTab === 'vessels' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Register / Edit Vessel Form */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Ship className="w-4 h-4 text-amber-600" />
                  {editingVesselId ? 'Edit Registered Vessel' : 'Register Export Vessel'}
                </h3>
                {editingVesselId && (
                  <button
                    type="button"
                    onClick={resetVesselForm}
                    className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmitVessel} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Vessel Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={vName}
                      onChange={(e) => setVName(e.target.value)}
                      placeholder="e.g. MV HOEGH TRADER"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      9-Digit MMSI *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={9}
                      value={vMmsi}
                      onChange={(e) => setVMmsi(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 257999000"
                      className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      IMO Number
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={vImo}
                      onChange={(e) => setVImo(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 9420815"
                      className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Carrier Line
                    </label>
                    <input
                      type="text"
                      value={vCarrier}
                      onChange={(e) => setVCarrier(e.target.value)}
                      placeholder="NYK / MOL / Höegh"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Voyage #
                    </label>
                    <input
                      type="text"
                      value={vVoyage}
                      onChange={(e) => setVVoyage(e.target.value)}
                      placeholder="e.g. VOY-2026-114"
                      className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Origin Port
                    </label>
                    <input
                      type="text"
                      value={vOrigin}
                      onChange={(e) => setVOrigin(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Destination Port
                    </label>
                    <input
                      type="text"
                      value={vDestination}
                      onChange={(e) => setVDestination(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Call Sign
                    </label>
                    <input
                      type="text"
                      value={vCallSign}
                      onChange={(e) => setVCallSign(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3 py-2 font-mono uppercase bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Scheduled ETA
                    </label>
                    <input
                      type="date"
                      value={vEtaManual}
                      onChange={(e) => setVEtaManual(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={vTrackingEnabled}
                    onChange={(e) => setVTrackingEnabled(e.target.checked)}
                    className="accent-amber-600"
                  />
                  Include MMSI in active AISStream WebSocket filter list
                </label>

                <button
                  type="submit"
                  disabled={!canEditLogistics || savingVessel}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {savingVessel ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  {editingVesselId ? 'Update Vessel Record' : 'Register Vessel & Subscribe MMSI'}
                </button>
              </form>

              {/* Assign Customer Vehicle / Export Order to Vessel */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                  <Anchor className="w-3.5 h-3.5 text-amber-600" />
                  Assign Customer Order / Vehicle to Vessel
                </h4>
                <div className="space-y-2 text-xs">
                  <select
                    value={assignOrderId}
                    onChange={(e) => setAssignOrderId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">Select Export Order...</option>
                    {orders.map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        {ord.orderNumber} — {ord.vehicleTitle} ({ord.customerName})
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignVesselId}
                    onChange={(e) => setAssignVesselId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">Select Registered Vessel...</option>
                    {vessels.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} (MMSI {v.mmsi}) &rarr; {v.destinationPort}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!canEditLogistics || assigning || !assignOrderId || !assignVesselId}
                    onClick={handleAssignShipment}
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {assigning ? 'Assigning...' : 'Assign Order to Selected Vessel'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Registered Vessels Roster + Map Preview */}
            <div className="lg:col-span-7 space-y-4">
              <VesselLeafletMap vessels={vessels} heightClass="h-[310px]" />

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                  <span>Registered Vessels Roster ({vessels.length})</span>
                  <button
                    type="button"
                    onClick={handlePersistLiveAis}
                    disabled={aisPersisting}
                    className="text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                  >
                    {aisPersisting ? 'Saving...' : 'Sync Live Positions to DB'}
                  </button>
                </div>

                {vessels.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No vessels registered yet. Use the form on the left to add your first vessel
                    with its real 9-digit MMSI.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {vessels.map((v) => {
                      const freshness = getVesselFreshness(v);
                      const assignedCount = orders.filter(
                        (o) => o.vesselId === v.id || o.vesselMmsi === v.mmsi
                      ).length;
                      return (
                        <div key={v.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-950 dark:text-white text-sm">
                                {v.name}
                              </span>
                              <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                                MMSI {v.mmsi}
                              </span>
                              {v.imo && (
                                <span className="font-mono text-[11px] text-slate-500">
                                  IMO {v.imo}
                                </span>
                              )}
                            </div>
                            <div className="text-slate-600 dark:text-slate-400">
                              {v.originPort || 'Japan'} &rarr; {v.aisDestination || v.destinationPort || 'TBD'} ·{' '}
                              <strong>{assignedCount}</strong> assigned shipment(s)
                            </div>
                            <div className="text-[11px] text-slate-500 flex flex-wrap gap-3">
                              <span>Signal: {freshness.label}</span>
                              {typeof v.latitude === 'number' && typeof v.longitude === 'number' && (
                                <span className="font-mono">
                                  Pos: {v.latitude.toFixed(3)}, {v.longitude.toFixed(3)}
                                </span>
                              )}
                              {typeof v.speedKnots === 'number' && (
                                <span className="font-mono">{v.speedKnots} kn</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={!canEditLogistics}
                              onClick={() => openManualUpdate(v)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 rounded-lg cursor-pointer"
                            >
                              <MapPin className="w-3 h-3" />
                              Manual Update
                            </button>
                            <button
                              type="button"
                              disabled={!canEditLogistics}
                              onClick={() => startEditVessel(v)}
                              className="p-1.5 text-slate-600 hover:text-slate-950 bg-slate-100 rounded-lg cursor-pointer"
                              title="Edit vessel"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!canEditLogistics}
                              onClick={() => onDeleteVessel(v.id)}
                              className="p-1.5 text-red-600 hover:text-red-800 bg-red-50 rounded-lg cursor-pointer"
                              title="Delete vessel"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Manual Position Fallback Modal */}
          {manualVessel && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                      Manual Shipment &amp; Position Fallback — {manualVessel.name}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Use when deep-ocean AIS coverage is temporarily unavailable or outdated.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualVessel(null)}
                    className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer"
                  >
                    &times;
                  </button>
                </div>

                <form onSubmit={handleSaveManualUpdate} className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold block mb-1">Current Shipment Status</label>
                    <input
                      type="text"
                      required
                      value={manualStatus}
                      onChange={(e) => setManualStatus(e.target.value)}
                      placeholder="e.g. Departed Singapore Transshipment Hub"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">
                      Coordinator Location / Carrier Note
                    </label>
                    <textarea
                      rows={3}
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      placeholder="Carrier confirmed vessel crossed Malacca Strait; on schedule for Mombasa berth."
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold block mb-1">Manual ETA</label>
                      <input
                        type="date"
                        value={manualEta}
                        onChange={(e) => setManualEta(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Manual Lat (Opt)</label>
                      <input
                        type="number"
                        step="0.0001"
                        min={-90}
                        max={90}
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        placeholder="e.g. 1.2644"
                        className="w-full px-3 py-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Manual Lon (Opt)</label>
                      <input
                        type="number"
                        step="0.0001"
                        min={-180}
                        max={180}
                        value={manualLon}
                        onChange={(e) => setManualLon(e.target.value)}
                        placeholder="e.g. 103.8220"
                        className="w-full px-3 py-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setManualVessel(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingManual}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      {savingManual ? 'Saving...' : 'Save Manual Update'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: INTEGRATION ERROR & EVENT LOGS */}
      {subTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-bold text-slate-950 dark:text-white">
                API Integration Diagnostics &amp; Error Logs
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value as typeof logFilter)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="all">All Providers</option>
                <option value="exchange_rate">ExchangeRate-API</option>
                <option value="aisstream">AISStream</option>
              </select>
              <button
                type="button"
                onClick={handleClearLogs}
                className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer"
              >
                Clear Logs
              </button>
            </div>
          </div>

          {combinedLogs.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 space-y-1">
              <ShieldCheck className="w-7 h-7 text-emerald-500 mx-auto" />
              <div className="font-semibold text-slate-700">No integration errors recorded</div>
              <p>Connection test results, WebSocket reconnects, and sync events appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[480px] overflow-y-auto">
              {combinedLogs.map((entry) => (
                <div key={entry.id} className="px-5 py-3 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded ${
                          entry.level === 'error'
                            ? 'bg-red-100 text-red-800'
                            : entry.level === 'warning'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {entry.level}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase">
                        {entry.provider}
                      </span>
                      <span className="text-[10px] text-slate-400">({entry.source})</span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200">{entry.message}</p>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 shrink-0">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
