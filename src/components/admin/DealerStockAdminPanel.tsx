import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FlaskConical,
  History,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { computePublicEstimatedFob } from '../../data/dealerPricing';
import {
  deleteDealerStockVehicle,
  importAuthorizedDealerFeed,
  registerAllCandidateDealerSources,
  saveDealerPricingRules,
  saveDealerSource,
  syncDealerSourceNow,
  testDealerSourceServer,
  toggleDealerEmergencyStop,
  toggleDealerVehicleFeatured,
  updateDealerInquiryStaff,
  updateDealerVehicleStatus,
  type ServerSourceAuditReport,
} from '../../services/dealerStockService';
import type {
  DealerImportError,
  DealerInquiry,
  DealerPriceHistoryEntry,
  DealerPricingRules,
  DealerSource,
  DealerStockVehicle,
  DealerSyncLog,
} from '../../types/portal';

interface DealerStockAdminPanelProps {
  sources: DealerSource[];
  vehicles: DealerStockVehicle[];
  pricingRules: DealerPricingRules;
  syncLogs: DealerSyncLog[];
  priceHistory: DealerPriceHistoryEntry[];
  importErrors: DealerImportError[];
  inquiries: DealerInquiry[];
  liveJpyRate?: number;
  actorEmail: string;
  canEditPricing: boolean;
  onNotify: (msg: string) => void;
}

type AdminSubTab =
  | 'sources'
  | 'inventory'
  | 'pricing'
  | 'feed_import'
  | 'logs_errors'
  | 'price_history'
  | 'inquiries';

const COMPLIANCE_BADGE: Record<
  DealerSource['complianceStatus'],
  { label: string; cls: string }
> = {
  verified_compliant: {
    label: 'Verified Compliant',
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  authorized_feed: {
    label: 'Authorized Feed',
    cls: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  pending_review: {
    label: 'Pending Review',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  prohibited: {
    label: 'Prohibited (robots/ToS)',
    cls: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  blocked: {
    label: 'Blocked (403/WAF)',
    cls: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  unreachable: {
    label: 'Unreachable',
    cls: 'bg-slate-100 text-slate-600 border-slate-300',
  },
};

export function DealerStockAdminPanel({
  sources,
  vehicles,
  pricingRules,
  syncLogs,
  priceHistory,
  importErrors,
  inquiries,
  liveJpyRate,
  actorEmail,
  canEditPricing,
  onNotify,
}: DealerStockAdminPanelProps) {
  const [subTab, setSubTab] = useState<AdminSubTab>('sources');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [initializingRegistry, setInitializingRegistry] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  // Preview modals
  const [auditReport, setAuditReport] = useState<ServerSourceAuditReport | null>(null);
  const [dryRunPreview, setDryRunPreview] = useState<{
    sourceName: string;
    vehicles: DealerStockVehicle[];
    summary: string;
  } | null>(null);
  const [editingSource, setEditingSource] = useState<DealerSource | null>(null);

  // Inventory search
  const [stockSearch, setStockSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'available' | 'unverified' | 'sold'>('all');

  // Pricing form draft
  const [rulesDraft, setRulesDraft] = useState<DealerPricingRules>(pricingRules);
  const [savingRules, setSavingRules] = useState(false);
  const [previewSampleJpy, setPreviewSampleJpy] = useState(2500000);

  // Feed import state
  const [feedSourceId, setFeedSourceId] = useState(sources[0]?.id || 'flexnet');
  const [feedFormat, setFeedFormat] = useState<'csv' | 'xml'>('csv');
  const [feedContent, setFeedContent] = useState('');
  const [importingFeed, setImportingFeed] = useState(false);

  const kpis = useMemo(() => {
    const available = vehicles.filter((v) => v.status === 'available').length;
    const sold = vehicles.filter((v) => v.status === 'sold').length;
    const unverified = vehicles.filter((v) => v.status === 'unverified').length;
    const activeSources = sources.filter((s) => s.enabled).length;
    const disabledSources = sources.length - activeSources;
    const latestSync = syncLogs[0] || null;
    const nextScheduledIso = latestSync
      ? new Date(
          new Date(latestSync.finishedAt || latestSync.startedAt).getTime() +
            (pricingRules.syncIntervalHours || 6) * 3600000
        ).toISOString()
      : null;

    return {
      totalImported: vehicles.length,
      available,
      sold,
      unverified,
      activeSources,
      disabledSources,
      latestSync,
      nextScheduledIso,
    };
  }, [vehicles, sources, syncLogs, pricingRules.syncIntervalHours]);

  const filteredStock = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (stockStatusFilter !== 'all' && v.status !== stockStatusFilter) return false;
      if (!q) return true;
      return [v.stockId, v.dealerName, v.manufacturer, v.model, v.grade, v.location]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [vehicles, stockSearch, stockStatusFilter]);

  const previewFob = useMemo(
    () =>
      computePublicEstimatedFob({
        originalDealerPriceJpy: previewSampleJpy,
        rules: rulesDraft,
        liveJpyPerUsd: liveJpyRate,
      }),
    [previewSampleJpy, rulesDraft, liveJpyRate]
  );

  const handleInitRegistry = async () => {
    setInitializingRegistry(true);
    try {
      const count = await registerAllCandidateDealerSources();
      onNotify(`Registered all ${count} Japanese dealer candidate sources in Firestore.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to initialize candidate sources.');
    } finally {
      setInitializingRegistry(false);
    }
  };

  const handleTestSource = async (src: DealerSource) => {
    setBusyId(`test:${src.id}`);
    try {
      const report = await testDealerSourceServer({
        source: src,
        pricingRules,
        liveJpyRate,
      });
      setAuditReport(report);
      onNotify(
        `Compliance audit completed for ${src.name}: ${report.complianceStatus} (${report.sampleExtractedCount} sample vehicles).`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Compliance test failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDryRun = async (src: DealerSource) => {
    setBusyId(`dry:${src.id}`);
    try {
      const { batch, log } = await syncDealerSourceNow({
        source: src,
        pricingRules,
        liveJpyRate,
        maxVehicles: Math.min(20, src.maxVehiclesPerSync || 20),
        dryRun: true,
        actorEmail,
      });
      setDryRunPreview({
        sourceName: src.name,
        vehicles: batch.vehicles,
        summary: log.summary,
      });
      onNotify(log.summary);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Dry-run failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSyncSource = async (src: DealerSource) => {
    if (pricingRules.emergencyStop) {
      onNotify('Emergency Stop is active. Resume sync before running extraction.');
      return;
    }
    setBusyId(`sync:${src.id}`);
    try {
      const { log } = await syncDealerSourceNow({
        source: src,
        pricingRules,
        liveJpyRate,
        maxVehicles: Math.min(100, src.maxVehiclesPerSync || 50),
        dryRun: false,
        actorEmail,
      });
      onNotify(`${src.name}: ${log.summary}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSyncAllActive = async () => {
    const active = sources.filter((s) => s.enabled);
    if (active.length === 0) {
      onNotify('No enabled dealer sources. Enable a verified compliant source first.');
      return;
    }
    if (pricingRules.emergencyStop) {
      onNotify('Emergency Stop is active. Disable Emergency Stop first.');
      return;
    }
    setSyncingAll(true);
    let totalFetched = 0;
    try {
      for (const src of active) {
        const { batch } = await syncDealerSourceNow({
          source: src,
          pricingRules,
          liveJpyRate,
          maxVehicles: Math.min(100, src.maxVehiclesPerSync || 50),
          dryRun: false,
          actorEmail,
        });
        totalFetched += batch.vehicles.length;
      }
      onNotify(`Synchronized ${active.length} active source(s): ${totalFetched} real dealer vehicles processed.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Batch sync encountered an error.');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleToggleEmergencyStop = async () => {
    const next = !pricingRules.emergencyStop;
    try {
      await toggleDealerEmergencyStop(next, pricingRules, actorEmail);
      setRulesDraft((prev) => ({ ...prev, emergencyStop: next }));
      onNotify(next ? 'EMERGENCY STOP ACTIVATED — all dealer syncs halted.' : 'Emergency Stop cleared — dealer syncs resumed.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not toggle Emergency Stop.');
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      await saveDealerPricingRules(rulesDraft, actorEmail);
      onNotify('Confidential dealer pricing & profit margin rules saved.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to save pricing rules.');
    } finally {
      setSavingRules(false);
    }
  };

  const handleImportFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    const src = sources.find((s) => s.id === feedSourceId);
    if (!src) {
      onNotify('Select a registered dealer source first.');
      return;
    }
    if (!feedContent.trim()) {
      onNotify('Paste or upload an authorized CSV or XML dealer inventory feed.');
      return;
    }
    setImportingFeed(true);
    try {
      const { log } = await importAuthorizedDealerFeed({
        source: src,
        format: feedFormat,
        content: feedContent,
        pricingRules,
        liveJpyRate,
        actorEmail,
      });
      onNotify(log.summary);
      setFeedContent('');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Feed import failed.');
    } finally {
      setImportingFeed(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Top Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
            <Building2 className="w-4 h-4" />
            <span>Automated Japanese Dealer Stock Integration</span>
          </div>
          <h2 className="text-lg font-extrabold text-slate-950 mt-0.5">
            Dealer Stock Sync, Compliance &amp; Margin Control
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Server-side extraction only · Respects robots.txt &amp; ToS · Separate from Live Auction Stock · Scheduled every {pricingRules.syncIntervalHours || 6}h via GitHub Actions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleEmergencyStop}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold border cursor-pointer ${
              pricingRules.emergencyStop
                ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>{pricingRules.emergencyStop ? 'EMERGENCY STOP ACTIVE (Resume)' : 'Emergency Stop'}</span>
          </button>

          {sources.length < 22 && (
            <button
              type="button"
              disabled={initializingRegistry}
              onClick={handleInitRegistry}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{initializingRegistry ? 'Registering...' : 'Register 22 Candidate Sources'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={syncingAll || pricingRules.emergencyStop || kpis.activeSources === 0}
            onClick={handleSyncAllActive}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-950 hover:bg-slate-800 disabled:opacity-45 text-white cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
            <span>{syncingAll ? 'Syncing Active Sources...' : `Sync Active (${kpis.activeSources})`}</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {[
          { label: 'Total Imported', val: kpis.totalImported, cls: 'text-slate-950' },
          { label: 'Available', val: kpis.available, cls: 'text-emerald-700' },
          { label: 'Sold', val: kpis.sold, cls: 'text-slate-600' },
          { label: 'Unverified', val: kpis.unverified, cls: 'text-amber-700' },
          { label: 'Active Sources', val: kpis.activeSources, cls: 'text-emerald-700' },
          { label: 'Disabled Sources', val: kpis.disabledSources, cls: 'text-rose-700' },
          {
            label: 'Sync Status',
            val: pricingRules.emergencyStop
              ? 'STOPPED'
              : kpis.latestSync?.status?.toUpperCase() || 'IDLE',
            cls: pricingRules.emergencyStop ? 'text-rose-700' : 'text-slate-900',
          },
          {
            label: 'Next Scheduled',
            val: kpis.nextScheduledIso
              ? new Date(kpis.nextScheduledIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Every 6h',
            cls: 'text-slate-800',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between"
          >
            <div className="text-[11px] font-semibold text-slate-500">{item.label}</div>
            <div className={`text-lg font-extrabold font-mono mt-1 ${item.cls}`}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-2">
        {(
          [
            ['sources', `Sources (${sources.length})`, Building2],
            ['inventory', `Imported Stock (${vehicles.length})`, ShieldCheck],
            ['pricing', 'Pricing & Margin Rules', DollarSign],
            ['feed_import', 'CSV / XML Feed Import', FileSpreadsheet],
            ['logs_errors', `Sync Logs (${syncLogs.length}) & Errors (${importErrors.length})`, Clock],
            ['price_history', `Price History (${priceHistory.length})`, History],
            ['inquiries', `Dealer Inquiries (${inquiries.length})`, MessageSquare],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              subTab === key
                ? 'bg-slate-950 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: SOURCES REGISTRY */}
      {subTab === 'sources' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {sources.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <Building2 className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-sm font-extrabold text-slate-950">
                No Dealer Sources Registered in Firestore Yet
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Click below to register all 22 candidate Japanese dealer sources with their live
                compliance audit baseline (FLEX &amp; Apple verified compliant; restricted/WAF domains safely disabled).
              </p>
              <button
                type="button"
                disabled={initializingRegistry}
                onClick={handleInitRegistry}
                className="px-4 py-2 rounded-lg bg-slate-950 text-white text-xs font-bold cursor-pointer"
              >
                {initializingRegistry ? 'Registering 22 Sources...' : 'Initialize 22 Candidate Japanese Sources'}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-bold">Dealer Source</th>
                    <th className="text-left px-3 py-2.5 font-bold">Compliance &amp; Recommendation</th>
                    <th className="text-left px-3 py-2.5 font-bold">Status</th>
                    <th className="text-left px-3 py-2.5 font-bold">Last Sync</th>
                    <th className="text-right px-3 py-2.5 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sources.map((src) => {
                    const badge = COMPLIANCE_BADGE[src.complianceStatus] || COMPLIANCE_BADGE.pending_review;
                    const isProhibited =
                      src.complianceStatus === 'prohibited' || src.complianceStatus === 'blocked';
                    return (
                      <tr key={src.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-3 align-top min-w-[200px]">
                          <div className="font-extrabold text-slate-950 flex items-center gap-1.5">
                            <span>{src.name}</span>
                            {src.verifiedRealExtraction && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                          </div>
                          <a
                            href={src.inventoryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-amber-700 hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            <span>{src.domain}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Mode: {src.sourceType} · Cap: {src.maxVehiclesPerSync} cars · Delay: {src.rateLimitMs}ms
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top max-w-md">
                          <span
                            className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                          <div className="text-[11px] text-slate-700 mt-1">{src.robotsSummary}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{src.recommendation}</div>
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <button
                            type="button"
                            disabled={isProhibited && src.sourceType === 'html_jsonld'}
                            onClick={() =>
                              saveDealerSource({ ...src, enabled: !src.enabled }).then(() =>
                                onNotify(`${src.name} ${!src.enabled ? 'enabled' : 'disabled'}.`)
                              )
                            }
                            title={
                              isProhibited && src.sourceType === 'html_jsonld'
                                ? 'Disabled by compliance guard. Switch to Authorized CSV/XML Feed to activate.'
                                : 'Toggle source'
                            }
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                              src.enabled
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            {src.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-[11px] text-slate-600">
                          <div>{src.lastSyncedAt ? new Date(src.lastSyncedAt).toLocaleString() : 'Never'}</div>
                          <div className="font-mono text-[10px] text-slate-500 mt-0.5">
                            Last count: {src.lastExtractedCount} ({src.lastSyncStatus})
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busyId !== null}
                              onClick={() => handleTestSource(src)}
                              className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              title="Run live robots.txt & sample compliance test"
                            >
                              <FlaskConical className="w-3 h-3" />
                              <span>{busyId === `test:${src.id}` ? 'Testing...' : 'Test'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={busyId !== null || (isProhibited && src.sourceType === 'html_jsonld')}
                              onClick={() => handleDryRun(src)}
                              className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              title="Dry-run extraction preview (zero DB writes)"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{busyId === `dry:${src.id}` ? '...' : 'Dry-Run'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={busyId !== null || !src.enabled || pricingRules.emergencyStop}
                              onClick={() => handleSyncSource(src)}
                              className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 disabled:opacity-35 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Run real extraction & sync to Firestore"
                            >
                              <Play className="w-3 h-3" />
                              <span>{busyId === `sync:${src.id}` ? 'Syncing...' : 'Sync'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSource(src)}
                              className="px-2 py-1 rounded border border-slate-200 text-slate-600 hover:text-slate-950 text-[11px] font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: IMPORTED STOCK MANAGER */}
      {subTab === 'inventory' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <input
              type="text"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              placeholder="Filter imported dealer stock by stock ID, make, model, dealer..."
              className="flex-1 min-w-[220px] px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as typeof stockStatusFilter)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="unverified">Unverified</option>
              <option value="sold">Sold</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2">Vehicle</th>
                  <th className="text-left px-3 py-2">Specs</th>
                  <th className="text-left px-3 py-2">Est. FOB (Public)</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStock.slice(0, 80).map((v) => (
                  <tr key={v.id}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {v.images[0] ? (
                          <img
                            src={v.images[0]}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-14 h-10 object-cover rounded border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-10 rounded bg-slate-100 border border-slate-200 shrink-0" />
                        )}
                        <div>
                          <div className="font-bold text-slate-950">
                            {[v.manufacturingYear, v.manufacturer, v.model].filter(Boolean).join(' ') || v.stockId}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {v.stockId} · {v.dealerName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-600">
                      {[
                        v.mileageKm !== null ? `${v.mileageKm.toLocaleString()} km` : null,
                        v.engineCapacityCc ? `${v.engineCapacityCc}cc` : null,
                        v.bodyType,
                        v.fuelType,
                        v.driveType,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-slate-950">
                      {v.estimatedFobUsd !== null ? `$${v.estimatedFobUsd.toLocaleString()}` : 'On Request'}
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={v.status}
                        onChange={(e) =>
                          updateDealerVehicleStatus(
                            v.id,
                            e.target.value as DealerStockVehicle['status']
                          ).then(() => onNotify(`Updated ${v.stockId} status.`))
                        }
                        className="px-2 py-1 text-[11px] border border-slate-300 rounded font-semibold"
                      >
                        <option value="available">Available</option>
                        <option value="unverified">Unverified</option>
                        <option value="sold">Sold</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            toggleDealerVehicleFeatured(v.id, !v.featured).then(() =>
                              onNotify(v.featured ? 'Removed from Featured' : 'Marked as Featured')
                            )
                          }
                          className={`p-1.5 rounded border cursor-pointer ${
                            v.featured
                              ? 'bg-amber-100 border-amber-300 text-amber-700'
                              : 'bg-white border-slate-200 text-slate-400 hover:text-amber-600'
                          }`}
                          title="Toggle Featured"
                        >
                          <Star className={`w-3.5 h-3.5 ${v.featured ? 'fill-amber-500' : ''}`} />
                        </button>
                        <a
                          href={v.originalListingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded border border-slate-200 text-slate-500 hover:text-slate-950"
                          title="Open original dealer URL"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            deleteDealerStockVehicle(v.id).then(() =>
                              onNotify(`Deleted ${v.stockId} from dealer_stock.`)
                            )
                          }
                          className="p-1.5 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Delete vehicle"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredStock.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No imported Japanese dealer stock records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CONFIDENTIAL PRICING & MARGIN RULES */}
      {subTab === 'pricing' && (
        <form
          onSubmit={handleSavePricing}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-5"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-950 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Confidential Dealer Pricing &amp; Profit Margin Engine</span>
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Stored strictly in staff-only <code className="font-mono">dealer_pricing_rules</code>.
                Customers only see the resulting Estimated FOB, C&amp;F, and CIF — internal profit margins are never exposed.
              </p>
            </div>
            {canEditPricing && (
              <button
                type="submit"
                disabled={savingRules}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingRules ? 'Saving...' : 'Save Pricing Rules'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Fixed Profit Margin (USD)', 'fixedMarginUsd'],
              ['Percentage Profit Margin (%)', 'percentageMarginPct'],
              ['Inland Transport Japan (JPY)', 'inlandTransportJpy'],
              ['Export Documentation (USD)', 'documentationUsd'],
              ['Export Handling Fee (USD)', 'exportHandlingUsd'],
              ['Default Pre-Export Inspection (USD)', 'inspectionDefaultUsd'],
              ['Ocean Shipping Fallback (USD)', 'oceanShippingFallbackUsd'],
              ['Marine Insurance Rate (%)', 'marineInsurancePct'],
              ['Min Marine Insurance (USD)', 'marineInsuranceMinUsd'],
              ['JPY/USD Fallback Rate', 'jpyToUsdFallbackRate'],
              ['Scheduled Sync Interval (Hours)', 'syncIntervalHours'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">{label}</label>
                <input
                  type="number"
                  step="any"
                  disabled={!canEditPricing}
                  value={Number(rulesDraft[key as keyof DealerPricingRules] ?? 0)}
                  onChange={(e) =>
                    setRulesDraft((prev) => ({
                      ...prev,
                      [key]: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                />
              </div>
            ))}
          </div>

          {/* Live Margin Simulation Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-900">Live Public FOB Preview Simulator</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600">Dealer Cost (JPY):</span>
                <input
                  type="number"
                  step={100000}
                  value={previewSampleJpy}
                  onChange={(e) => setPreviewSampleJpy(Number(e.target.value) || 0)}
                  className="w-36 px-2.5 py-1 font-mono border border-slate-300 rounded bg-white"
                />
                <span className="text-slate-500">
                  (FX: {liveJpyRate ? `${liveJpyRate.toFixed(2)} live` : `${rulesDraft.jpyToUsdFallbackRate} fallback`} JPY/USD)
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold text-slate-500">
                Customer-Visible Estimated FOB
              </div>
              <div className="text-xl font-extrabold font-mono text-amber-800">
                {previewFob.estimatedFobUsd !== null
                  ? `$${previewFob.estimatedFobUsd.toLocaleString()} USD`
                  : '—'}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: AUTHORIZED CSV / XML FEED IMPORT */}
      {subTab === 'feed_import' && (
        <form
          onSubmit={handleImportFeed}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div>
            <h3 className="text-sm font-extrabold text-slate-950">
              Authorized Dealer CSV / XML Inventory Feed Importer
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Recommended for dealerships whose websites prohibit automated HTML crawling. Upload or paste an official partner CSV or XML feed to normalize and price vehicles server-side.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Dealer Source</label>
              <select
                value={feedSourceId}
                onChange={(e) => setFeedSourceId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.domain})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Feed Format</label>
              <select
                value={feedFormat}
                onChange={(e) => setFeedFormat(e.target.value as 'csv' | 'xml')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              >
                <option value="csv">CSV (Comma-Separated Values)</option>
                <option value="xml">XML (&lt;vehicle&gt; / &lt;item&gt; nodes)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Load Local File</label>
              <input
                type="file"
                accept=".csv,.xml,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.name.toLowerCase().endsWith('.xml')) setFeedFormat('xml');
                  else setFeedFormat('csv');
                  file.text().then(setFeedContent);
                }}
                className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-slate-900 file:text-white file:text-xs file:font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Authorized Feed Content (Supported columns: stock_id, manufacturer, model, grade, year, mileage_km, engine_cc, fuel, transmission, drive, body_type, color, price_jpy, location, images, url)
            </label>
            <textarea
              rows={7}
              value={feedContent}
              onChange={(e) => setFeedContent(e.target.value)}
              placeholder="stock_id,manufacturer,model,year,mileage_km,engine_cc,fuel,transmission,drive,body_type,price_jpy,location,url"
              className="w-full p-3 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={importingFeed || !feedContent.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-45 text-white text-xs font-bold cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{importingFeed ? 'Importing Feed...' : 'Validate & Import Authorized Feed'}</span>
          </button>
        </form>
      )}

      {/* TAB 5: SYNC LOGS & ERRORS */}
      {subTab === 'logs_errors' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Recent Sync Executions ({syncLogs.length})
            </h3>
            <div className="space-y-2 max-h-[460px] overflow-y-auto">
              {syncLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-950">{log.sourceName}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.status === 'success'
                          ? 'bg-emerald-50 text-emerald-800'
                          : log.status === 'partial'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      {log.trigger} · {log.status}
                    </span>
                  </div>
                  <p className="text-slate-600">{log.summary}</p>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {new Date(log.startedAt).toLocaleString()} · {log.durationMs}ms · by {log.triggeredByEmail}
                  </div>
                </div>
              ))}
              {syncLogs.length === 0 && (
                <div className="text-xs text-slate-500 py-6 text-center">No sync logs recorded yet.</div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Import &amp; Compliance Diagnostics ({importErrors.length})</span>
            </h3>
            <div className="space-y-2 max-h-[460px] overflow-y-auto">
              {importErrors.map((err) => (
                <div key={err.id} className="p-3 rounded-lg border border-rose-200/80 bg-rose-50/40 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-950">{err.sourceName}</span>
                    <span className="text-[10px] font-mono uppercase text-rose-700">
                      {err.stage} {err.httpStatus ? `· HTTP ${err.httpStatus}` : ''}
                    </span>
                  </div>
                  <p className="text-slate-700">{err.message}</p>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {new Date(err.occurredAt).toLocaleString()}
                  </div>
                </div>
              ))}
              {importErrors.length === 0 && (
                <div className="text-xs text-slate-500 py-6 text-center">No import errors logged.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: PRICE HISTORY (STAFF-ONLY) */}
      {subTab === 'price_history' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
            Internal Dealer JPY Cost &amp; Estimated FOB Change History (Staff Only)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2">Vehicle</th>
                  <th className="text-left px-3 py-2">Change</th>
                  <th className="text-left px-3 py-2">Dealer Base (JPY)</th>
                  <th className="text-left px-3 py-2">Dealer Total (JPY)</th>
                  <th className="text-left px-3 py-2">Public Est. FOB (USD)</th>
                  <th className="text-left px-3 py-2">Recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {priceHistory.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <div className="font-bold text-slate-900">{p.vehicleTitle}</div>
                      <div className="text-[10px] font-mono text-slate-500">{p.stockId}</div>
                    </td>
                    <td className="px-3 py-2 uppercase text-[10px] font-bold">{p.changeType.replace('_', ' ')}</td>
                    <td className="px-3 py-2 font-mono">
                      {p.newDealerPriceJpy ? `¥${p.newDealerPriceJpy.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {p.newTotalPriceJpy ? `¥${p.newTotalPriceJpy.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold">
                      {p.previousEstimatedFobUsd ? `$${p.previousEstimatedFobUsd.toLocaleString()} → ` : ''}
                      {p.newEstimatedFobUsd ? `$${p.newEstimatedFobUsd.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-500">
                      {new Date(p.recordedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {priceHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No dealer price history entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: DEALER INQUIRIES */}
      {subTab === 'inquiries' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2">Inquiry / Type</th>
                  <th className="text-left px-3 py-2">Vehicle</th>
                  <th className="text-left px-3 py-2">Buyer</th>
                  <th className="text-left px-3 py-2">Est. Quote</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inquiries.map((inq) => (
                  <tr key={inq.id}>
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-bold text-slate-950">{inq.inquiryCode}</div>
                      <div className="text-[10px] uppercase font-bold text-amber-700">{inq.inquiryType}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900">{inq.vehicleTitle}</div>
                      <a
                        href={inq.originalListingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-amber-700 hover:underline inline-flex items-center gap-1"
                      >
                        <span>{inq.stockId}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{inq.buyerName}</div>
                      <div className="text-[11px] text-slate-500">{inq.buyerEmail} · {inq.buyerPhone}</div>
                      <div className="text-[11px] text-slate-500">{inq.destinationPortName}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">
                      <div>FOB: {inq.estimatedFobUsd ? `$${inq.estimatedFobUsd.toLocaleString()}` : '—'}</div>
                      <div>CIF: {inq.estimatedCifUsd ? `$${inq.estimatedCifUsd.toLocaleString()}` : '—'}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={inq.status}
                        onChange={(e) =>
                          updateDealerInquiryStaff(inq.id, {
                            status: e.target.value as DealerInquiry['status'],
                          }).then(() => onNotify(`Updated ${inq.inquiryCode} status.`))
                        }
                        className="px-2 py-1 text-[11px] border border-slate-300 rounded font-semibold"
                      >
                        <option value="new">New</option>
                        <option value="checking_dealer">Checking Dealer</option>
                        <option value="confirmed_available">Confirmed Available</option>
                        <option value="quoted">Quoted</option>
                        <option value="sold_out">Sold Out</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {inquiries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No customer dealer stock inquiries received yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compliance Audit Report Modal */}
      {auditReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-extrabold text-slate-950">
                Live Compliance &amp; Extraction Audit: {auditReport.sourceId}
              </h3>
              <button
                type="button"
                onClick={() => setAuditReport(null)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500">Compliance Verdict</div>
                <div className="font-extrabold text-slate-950 mt-0.5">{auditReport.complianceStatus}</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-500">robots.txt</div>
                <div className="font-bold text-slate-900 mt-0.5">{auditReport.robotsSummary}</div>
              </div>
            </div>
            <div className="text-xs text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <strong>Recommendation:</strong> {auditReport.recommendation}
            </div>
            {auditReport.sampleVehicles.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900">
                  Sample Real Extracted Vehicles ({auditReport.sampleVehicles.length}):
                </div>
                {auditReport.sampleVehicles.map((v) => (
                  <div key={v.id} className="p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-950">
                        {[v.manufacturingYear, v.manufacturer, v.model, v.grade].filter(Boolean).join(' ')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {v.stockId} · {v.mileageKm ? `${v.mileageKm.toLocaleString()} km` : '—'} · {v.bodyType || '—'} · Est. FOB: {v.estimatedFobUsd ? `$${v.estimatedFobUsd.toLocaleString()}` : '—'}
                      </div>
                    </div>
                    <a
                      href={v.originalListingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-700 font-semibold shrink-0 hover:underline"
                    >
                      Verify URL
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dry-Run Preview Modal */}
      {dryRunPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-950">
                  Dry-Run Extraction Preview: {dryRunPreview.sourceName}
                </h3>
                <p className="text-xs text-slate-500">{dryRunPreview.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setDryRunPreview(null)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {dryRunPreview.vehicles.map((v) => (
                <div key={v.id} className="p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {v.images[0] && (
                      <img src={v.images[0]} alt="" referrerPolicy="no-referrer" className="w-14 h-10 object-cover rounded shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-950 truncate">
                        {[v.manufacturingYear, v.manufacturer, v.model, v.grade].filter(Boolean).join(' ')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {v.stockId} · {v.mileageKm ? `${v.mileageKm.toLocaleString()} km` : '—'} · {v.engineCapacityCc ? `${v.engineCapacityCc}cc` : '—'} · {v.bodyType || '—'} · Est. FOB: {v.estimatedFobUsd ? `$${v.estimatedFobUsd.toLocaleString()}` : '—'}
                      </div>
                    </div>
                  </div>
                  <a href={v.originalListingUrl} target="_blank" rel="noopener noreferrer" className="text-amber-700 font-semibold shrink-0 hover:underline">
                    Source
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Source Modal */}
      {editingSource && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-950">Edit Dealer Source: {editingSource.name}</h3>
              <button
                type="button"
                onClick={() => setEditingSource(null)}
                className="p-1 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Source Mode</label>
                <select
                  value={editingSource.sourceType}
                  onChange={(e) =>
                    setEditingSource({
                      ...editingSource,
                      sourceType: e.target.value as DealerSource['sourceType'],
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="html_jsonld">Public HTML / Schema.org JSON-LD</option>
                  <option value="authorized_csv">Authorized Dealer CSV Feed</option>
                  <option value="authorized_xml">Authorized Dealer XML Feed</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Inventory URL</label>
                <input
                  type="url"
                  value={editingSource.inventoryUrl}
                  onChange={(e) => setEditingSource({ ...editingSource, inventoryUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Authorized Feed URL (optional)</label>
                <input
                  type="url"
                  value={editingSource.feedUrl || ''}
                  onChange={(e) => setEditingSource({ ...editingSource, feedUrl: e.target.value || null })}
                  placeholder="https://partner.example.jp/inventory.xml"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Vehicles / Sync (≤100)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={editingSource.maxVehiclesPerSync}
                    onChange={(e) =>
                      setEditingSource({
                        ...editingSource,
                        maxVehiclesPerSync: Math.min(100, Math.max(1, Number(e.target.value) || 20)),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rate Limit Delay (ms)</label>
                  <input
                    type="number"
                    min={1000}
                    max={10000}
                    value={editingSource.rateLimitMs}
                    onChange={(e) =>
                      setEditingSource({
                        ...editingSource,
                        rateLimitMs: Math.max(1000, Number(e.target.value) || 1500),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSource(null)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await saveDealerSource(editingSource);
                    onNotify(`Saved configuration for ${editingSource.name}.`);
                    setEditingSource(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-950 text-white font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
