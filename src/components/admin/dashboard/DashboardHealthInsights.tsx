import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe,
  HardDrive,
  History,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { auth } from '../../../lib/firebase';
import type {
  AisServiceStatusResponse,
  ApiIntegrationConfig,
  AuditLogEntry,
  CurrencyCode,
  CustomerTestimonial,
  Inquiry,
  LandingPageContent,
  LiveExchangeRateState,
  UserProfile,
  Vehicle,
} from '../../../types/portal';
import {
  parseRecordDateMs,
  type ComputedDashboardAnalytics,
  type ResolvedDateRange,
} from './dashboardMetrics';

interface DashboardHealthInsightsProps {
  analytics: ComputedDashboardAnalytics;
  range: ResolvedDateRange;
  currency: CurrencyCode;
  isLiveFirestoreMode: boolean;
  liveFx: LiveExchangeRateState;
  aisStatus: AisServiceStatusResponse | null;
  integrationConfig: ApiIntegrationConfig;
  vehicles: Vehicle[];
  users: UserProfile[];
  inquiries: Inquiry[];
  testimonials: CustomerTestimonial[];
  landingContent: LandingPageContent;
  auditLogs: AuditLogEntry[];
  canViewAudit: boolean;
  canManageIntegrations: boolean;
  showWebsite: boolean;
  showHealth: boolean;
  showAiInsights: boolean;
  showAuditLogs: boolean;
  onRefreshFx: () => Promise<void>;
  onRefreshAis: () => Promise<void>;
  onNavigateSection: (section: string) => void;
}

interface ServiceCheckState {
  status: 'healthy' | 'degraded' | 'offline' | 'unconfigured' | 'checking';
  detail: string;
  checkedAt?: string;
}

export function DashboardHealthInsights({
  analytics,
  range,
  currency,
  isLiveFirestoreMode,
  liveFx,
  aisStatus,
  integrationConfig,
  vehicles,
  users,
  inquiries,
  testimonials,
  landingContent,
  auditLogs,
  canViewAudit,
  canManageIntegrations,
  showWebsite,
  showHealth,
  showAiInsights,
  showAuditLogs,
  onRefreshFx,
  onRefreshAis,
  onNavigateSection,
}: DashboardHealthInsightsProps) {
  // Audit log filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModule, setAuditModule] = useState('ALL');

  // Health testing state
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [auctionHealth, setAuctionHealth] = useState<ServiceCheckState>({
    status: 'healthy',
    detail: 'Live proxy available — click Test Connection to probe',
  });
  const [aisTestMsg, setAisTestMsg] = useState<string>('');
  const [showErrorLogs, setShowErrorLogs] = useState(false);

  // AI Business Insights state (read-only)
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiBriefing, setAiBriefing] = useState<string>('');
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string>('');

  // Website metrics derived strictly from real Firestore collections
  const websiteStats = useMemo(() => {
    const customers = users.filter((u) => u.role === 'customer' || u.role === 'dealer');
    const publishedVehicles = vehicles.filter((v) => v.status === 'available');
    const dealerStock = publishedVehicles.filter((v) => v.listingType === 'partner_stock');
    const auctionPublished = publishedVehicles.filter((v) => v.listingType === 'auction_listing');
    const convertedInq = inquiries.filter((i) =>
      ['deposit_confirmed', 'inspection_passed', 'vessel_booked', 'shipped'].includes(i.status)
    ).length;
    const convRate =
      inquiries.length > 0 ? Number(((convertedInq / inquiries.length) * 100).toFixed(1)) : null;
    const pendingTestimonials = testimonials.filter((t) => !t.approved).length;
    return {
      registeredCustomers: customers.length,
      totalInquiries: inquiries.length,
      publishedVehicles: publishedVehicles.length,
      dealerStockCount: dealerStock.length,
      auctionPublishedCount: auctionPublished.length,
      inquiryConversionPct: convRate,
      pendingTestimonials,
      approvedTestimonials: testimonials.filter((t) => t.approved).length,
      promoBannerEnabled: landingContent.promoBannerEnabled,
    };
  }, [users, vehicles, inquiries, testimonials, landingContent]);

  const auditTargets = useMemo(() => {
    const set = new Set<string>();
    for (const a of auditLogs) {
      if (a.targetType) set.add(a.targetType);
    }
    return ['ALL', ...Array.from(set)];
  }, [auditLogs]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs
      .filter((a) => {
        if (auditModule !== 'ALL' && a.targetType !== auditModule) return false;
        if (q) {
          const hay = `${a.id} ${a.actorEmail} ${a.actorRole} ${a.action} ${a.targetType} ${a.targetId} ${a.summary}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .slice(0, 25);
  }, [auditLogs, auditSearch, auditModule]);

  const testAuctionConnection = async () => {
    setTestingKey('auction');
    try {
      const resp = await fetch('/api/auction/status');
      const data = await resp.json();
      setAuctionHealth({
        status: data.ok && data.reachable ? 'healthy' : 'degraded',
        detail: data.message || `${data.makesCount || 0} makes · ${data.totalEstimatedLots || 0} lots`,
        checkedAt: new Date().toLocaleTimeString(),
      });
    } catch {
      setAuctionHealth({
        status: 'offline',
        detail: 'Unable to reach /api/auction/status',
        checkedAt: new Date().toLocaleTimeString(),
      });
    } finally {
      setTestingKey(null);
    }
  };

  const testFxConnection = async () => {
    setTestingKey('fx');
    try {
      await onRefreshFx();
    } finally {
      setTestingKey(null);
    }
  };

  const testAisConnection = async () => {
    setTestingKey('ais');
    try {
      await onRefreshAis();
      const token = await auth.currentUser?.getIdToken().catch(() => '');
      const resp = await fetch('/api/ais/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      setAisTestMsg(data.message || (data.ok ? 'AIS handshake verified' : data.error || 'Check AIS key'));
    } catch {
      setAisTestMsg('AIS test request failed.');
    } finally {
      setTestingKey(null);
    }
  };

  const generateExecutiveAiInsights = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => '');
      const snapshotSummary = {
        dateRange: range.label,
        currency,
        recognizedRevenueUsd: analytics.accountingSummary.recognizedRevenueUsd,
        verifiedPaymentsUsd: analytics.accountingSummary.verifiedPaymentsUsd,
        totalExpensesUsd: analytics.accountingSummary.totalExpensesUsd,
        outstandingReceivablesUsd: analytics.accountingSummary.outstandingReceivablesUsd,
        outstandingPayablesUsd: analytics.accountingSummary.outstandingPayablesUsd,
        delayedShipmentsCount: analytics.delayedShipments.length,
        overdueFollowUps: analytics.followUps.filter((f) => f.isOverdue).length,
        topMarkets: analytics.revenueByCountry.slice(0, 4),
        topSalespeople: analytics.salespersonPerformance.slice(0, 4).map((s) => ({
          name: s.staffName,
          sales: s.confirmedSales,
          revenueUsd: s.revenueUsd,
        })),
        crmPipeline: analytics.crmPipeline.map((p) => ({ stage: p.label, count: p.count })),
      };

      const resp = await fetch('/api/admin/ai-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          task: 'daily_report',
          prompt:
            'Provide a concise Super Admin executive briefing structured into exactly 3 sections: (1) VERIFIED FACTS from the provided metrics, (2) OPERATIONAL RISKS & OVERDUE ALERTS, and (3) RECOMMENDED MANAGEMENT ACTIONS. Clearly distinguish facts from recommendations and never invent numbers not present in the snapshot.',
          contextSummary: JSON.stringify(snapshotSummary),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.text) {
        throw new Error(data.error || 'AI service unavailable.');
      }
      setAiBriefing(data.text);
      setAiGeneratedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate AI executive insights.');
    } finally {
      setAiLoading(false);
    }
  };

  const serviceRows = [
    {
      key: 'auth',
      name: 'Firebase Authentication',
      icon: ShieldCheck,
      status: auth.currentUser ? 'healthy' : 'degraded',
      detail: auth.currentUser
        ? `Signed in (${auth.currentUser.emailVerified ? 'Verified session' : 'Unverified email'})`
        : 'Local / guest session active',
      lastSync: 'Live session',
      actionLabel: null,
      onAction: undefined,
    },
    {
      key: 'firestore',
      name: 'Cloud Firestore Database',
      icon: Database,
      status: isLiveFirestoreMode ? 'healthy' : 'offline',
      detail: isLiveFirestoreMode
        ? `Real-time listeners active · ${vehicles.length} vehicles · ${users.length} profiles`
        : 'Not connected to live cloud mode',
      lastSync: 'Real-time stream',
      actionLabel: null,
      onAction: undefined,
    },
    {
      key: 'storage',
      name: 'Firebase Storage / Document Vault',
      icon: HardDrive,
      status: isLiveFirestoreMode ? 'healthy' : 'unconfigured',
      detail: 'External document URLs & Firestore vault metadata active',
      lastSync: 'On-demand',
      actionLabel: null,
      onAction: undefined,
    },
    {
      key: 'fx',
      name: 'ExchangeRate-API (open.er-api.com)',
      icon: Globe,
      status: liveFx.ok ? (liveFx.stale ? 'degraded' : 'healthy') : 'offline',
      detail: liveFx.ok
        ? `${liveFx.supportedCount || Object.keys(liveFx.rates || {}).length} currencies · Source: ${liveFx.source || 'live_api'}`
        : liveFx.error || 'Exchange rate sync unavailable',
      lastSync: liveFx.updatedAt ? new Date(liveFx.updatedAt).toLocaleString() : 'Never',
      actionLabel: 'Retry Sync',
      onAction: testFxConnection,
    },
    {
      key: 'ais',
      name: 'Vessel Tracking (AISStream & Global AIS)',
      icon: Wifi,
      status:
        aisStatus?.connected
          ? 'healthy'
          : aisStatus?.configured
          ? 'degraded'
          : 'unconfigured',
      detail:
        aisTestMsg ||
        (aisStatus
          ? `State: ${aisStatus.state} · ${aisStatus.trackedVesselCount} tracked vessels`
          : 'Awaiting AIS status probe'),
      lastSync: aisStatus?.lastSyncAt ? new Date(aisStatus.lastSyncAt).toLocaleString() : 'Not synced',
      actionLabel: 'Test Connection',
      onAction: testAisConnection,
    },
    {
      key: 'auction',
      name: 'Live Japanese Auction Feed',
      icon: Activity,
      status: auctionHealth.status,
      detail: auctionHealth.detail,
      lastSync: auctionHealth.checkedAt || 'Ready',
      actionLabel: 'Test Connection',
      onAction: testAuctionConnection,
    },
    {
      key: 'dealer_stock',
      name: 'External Dealer Stock Integration',
      icon: HardDrive,
      status: websiteStats.dealerStockCount > 0 ? 'healthy' : 'unconfigured',
      detail:
        websiteStats.dealerStockCount > 0
          ? `${websiteStats.dealerStockCount} partner dealer units active`
          : 'No partner dealer feed records synced yet',
      lastSync: 'Managed in Inventory',
      actionLabel: null,
      onAction: undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* WEBSITE PERFORMANCE OVERVIEW */}
      {/* ===================================================================== */}
      {showWebsite && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                  Website Performance & Public Storefront
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live inventory visibility, buyer inquiries, testimonials & CMS quick controls
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateSection('cms')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 rounded-lg cursor-pointer"
              >
                Manage Website CMS <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateSection('inventory')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
              >
                Featured Vehicles
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[10px] font-bold uppercase text-slate-500">Registered Buyers</div>
              <div className="text-xl font-bold text-slate-950 dark:text-white tabular-nums mt-1">
                {websiteStats.registeredCustomers}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[10px] font-bold uppercase text-slate-500">Website Inquiries</div>
              <div className="text-xl font-bold text-slate-950 dark:text-white tabular-nums mt-1">
                {websiteStats.totalInquiries}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[10px] font-bold uppercase text-slate-500">Published Vehicles</div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                {websiteStats.publishedVehicles}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[10px] font-bold uppercase text-slate-500">Auction Listings</div>
              <div className="text-xl font-bold text-indigo-700 dark:text-indigo-400 tabular-nums mt-1">
                {websiteStats.auctionPublishedCount}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[10px] font-bold uppercase text-slate-500">Inquiry Conversion</div>
              <div className="text-xl font-bold text-slate-950 dark:text-white tabular-nums mt-1">
                {websiteStats.inquiryConversionPct !== null ? `${websiteStats.inquiryConversionPct}%` : '—'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[10px] font-bold uppercase text-slate-500">Pending Reviews</div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
                {websiteStats.pendingTestimonials}
              </div>
            </div>
          </div>

          {/* Honest Configuration-Required Notice for Web Traffic Analytics */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 dark:text-white">
                Website Visitors & Most-Viewed Vehicles (Configuration Required):
              </strong>{' '}
              Google Analytics / GA4 Measurement ID is not configured yet, so visitor pageview telemetry is not shown (no synthetic counts are generated). Promo Banner is currently{' '}
              <strong>{websiteStats.promoBannerEnabled ? 'ACTIVE' : 'OFF'}</strong> · Approved Testimonials:{' '}
              <strong>{websiteStats.approvedTestimonials}</strong>.
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* AI BUSINESS INSIGHTS (READ-ONLY) & API SYSTEM HEALTH */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {showAiInsights && (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                      AI Executive Business Insights
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Read-only analysis of live authorized records · Never alters database records
                  </p>
                </div>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void generateExecutiveAiInsights()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 hover:opacity-90 disabled:opacity-50 rounded-lg cursor-pointer shrink-0"
                >
                  <Bot className={`w-3.5 h-3.5 ${aiLoading ? 'animate-pulse' : ''}`} />
                  {aiLoading ? 'Analyzing...' : aiBriefing ? 'Refresh Briefing' : 'Generate Briefing'}
                </button>
              </div>

              {/* Live Deterministic Facts Strip (Always Visible) */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Verified Database Facts ({range.label})
                </div>
                <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                  <li>
                    • Overdue follow-ups requiring action:{' '}
                    <strong>{analytics.followUps.filter((f) => f.isOverdue).length}</strong> · Delayed shipments:{' '}
                    <strong>{analytics.delayedShipments.length}</strong>
                  </li>
                  <li>
                    • Open customer receivables:{' '}
                    <strong>${analytics.accountingSummary.outstandingReceivablesUsd.toLocaleString()}</strong> · Supplier payables:{' '}
                    <strong>${analytics.accountingSummary.outstandingPayablesUsd.toLocaleString()}</strong>
                  </li>
                  <li>
                    • Leading export market:{' '}
                    <strong>{analytics.revenueByCountry[0]?.country || 'No orders yet'}</strong>
                    {analytics.revenueByCountry[0] ? ` (${analytics.revenueByCountry[0].units} units)` : ''}
                  </li>
                </ul>
              </div>

              {aiError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {aiError}
                </div>
              )}

              {aiBriefing ? (
                <div className="p-3.5 rounded-xl border border-amber-200/70 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1.5">
                    AI Recommendations & Synthesis · Generated {aiGeneratedAt}
                  </div>
                  {aiBriefing}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 text-center">
                  Click <strong>Generate Briefing</strong> to run an authorized Gemini executive summary covering sales performance, overdue risks, and recommended management actions.
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onNavigateSection('ai')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Open Full AI Operations Assistant <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </section>
        )}

        {/* API & SYSTEM HEALTH MONITOR */}
        {showHealth && (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                    API & System Health Monitor
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Real service diagnostics · Private credentials stay strictly server-side
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowErrorLogs((s) => !s)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  {showErrorLogs ? 'Hide Logs' : `View Logs (${(integrationConfig.errorLogs || []).length})`}
                </button>
                {canManageIntegrations && (
                  <button
                    type="button"
                    onClick={() => onNavigateSection('integrations')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg cursor-pointer"
                  >
                    Integrations <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {serviceRows.map((svc) => {
                const Icon = svc.icon;
                const isHealthy = svc.status === 'healthy';
                const isDegraded = svc.status === 'degraded' || svc.status === 'unconfigured';
                return (
                  <div
                    key={svc.key}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isHealthy
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isDegraded
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-950 dark:text-white flex items-center gap-1.5">
                          {svc.name}
                          {isHealthy ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{svc.detail}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline text-[10px] font-mono text-slate-400">
                        {svc.lastSync}
                      </span>
                      {svc.actionLabel && svc.onAction && (
                        <button
                          type="button"
                          disabled={testingKey === svc.key}
                          onClick={() => void svc.onAction?.()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${testingKey === svc.key ? 'animate-spin' : ''}`} />
                          {svc.actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {showErrorLogs && (
              <div className="p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] max-h-40 overflow-y-auto space-y-1">
                {(integrationConfig.errorLogs || []).length === 0 ? (
                  <div className="text-slate-400">No recent API integration error logs recorded.</div>
                ) : (
                  (integrationConfig.errorLogs || []).slice(0, 15).map((log) => (
                    <div key={log.id} className="flex gap-2">
                      <span className="text-slate-500 shrink-0">{log.timestamp.slice(0, 19)}</span>
                      <span className="text-amber-400 uppercase shrink-0">[{log.provider}]</span>
                      <span className="truncate">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ===================================================================== */}
      {/* RECENT ACTIVITY & IMMUTABLE AUDIT LOGS */}
      {/* ===================================================================== */}
      {showAuditLogs && canViewAudit && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                  Recent Activity & Immutable Audit Trail ({auditLogs.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Append-only security ledger enforced by Firestore rules · No records can be modified or deleted
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search user, action, ID..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <select
                value={auditModule}
                onChange={(e) => setAuditModule(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {auditTargets.map((t) => (
                  <option key={t} value={t}>
                    {t === 'ALL' ? 'All Modules' : t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Actor / Role</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Module / Target</th>
                  <th className="px-3 py-2">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No audit events match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => {
                    const ms = parseRecordDateMs(log.createdAt);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {ms ? new Date(ms).toLocaleString() : 'Logged'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-white">{log.actorEmail}</div>
                          <div className="text-[10px] uppercase font-mono text-slate-500">{log.actorRole}</div>
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {log.targetType} · {log.targetId.slice(0, 16)}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-md truncate">
                          {log.summary}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
