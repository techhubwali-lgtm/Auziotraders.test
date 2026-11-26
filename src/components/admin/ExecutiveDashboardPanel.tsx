import {
  Activity,
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Calendar,
  Car,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Globe,
  LayoutGrid,
  Lock,
  Printer,
  RefreshCw,
  Ship,
  SlidersHorizontal,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { OFFICIAL_LOGO_URL } from '../../data/landingDefaults';
import { canViewCompanyProfit, hasModulePermission, ROLE_METADATA } from '../../data/permissions';
import type {
  AisServiceStatusResponse,
  ApiIntegrationConfig,
  AuditLogEntry,
  CompanySettings,
  CurrencyCode,
  CustomerTestimonial,
  ExportDocument,
  ExportOrder,
  FinanceRecord,
  HrEmployee,
  HrLeaveRequest,
  Inquiry,
  LandingPageContent,
  LiveExchangeRateState,
  Quotation,
  RegisteredVessel,
  SalesTarget,
  SourcingRequest,
  TeamTask,
  UserProfile,
  UserRole,
  Vehicle,
} from '../../types/portal';
import {
  DashboardApprovalsTasks,
  type ApprovalActionHandlers,
} from './dashboard/DashboardApprovalsTasks';
import { DashboardFinancialSales } from './dashboard/DashboardFinancialSales';
import { DashboardHealthInsights } from './dashboard/DashboardHealthInsights';
import { DashboardOperationsPanel } from './dashboard/DashboardOperationsPanel';
import {
  computeDashboardAnalytics,
  downloadDashboardCsv,
  downloadDashboardExcel,
  resolveDateRange,
  type DateRangePreset,
  type KpiMetricItem,
} from './dashboard/dashboardMetrics';

type DashboardSectionId =
  | 'kpis'
  | 'quick_actions'
  | 'approvals'
  | 'financial'
  | 'sales'
  | 'crm_pipeline'
  | 'recent_orders'
  | 'logistics'
  | 'tasks'
  | 'website'
  | 'ai_insights'
  | 'system_health'
  | 'audit_logs';

const DEFAULT_SECTION_ORDER: DashboardSectionId[] = [
  'kpis',
  'quick_actions',
  'approvals',
  'financial',
  'sales',
  'crm_pipeline',
  'recent_orders',
  'logistics',
  'tasks',
  'website',
  'ai_insights',
  'system_health',
  'audit_logs',
];

const SECTION_LABELS: Record<DashboardSectionId, string> = {
  kpis: 'Real-Time Business KPI Hub',
  quick_actions: 'Executive Quick Actions',
  approvals: 'Pending Approvals Center',
  financial: 'Financial Intelligence & Cash Flow',
  sales: 'Sales Performance Analytics',
  crm_pipeline: 'CRM Sales Pipeline & Follow-Ups',
  recent_orders: 'Recent Export Orders Table',
  logistics: 'Logistics & Global Vessel Map',
  tasks: 'Task & Reminder Management',
  website: 'Website Performance Overview',
  ai_insights: 'AI Executive Business Insights',
  system_health: 'API & System Health Monitor',
  audit_logs: 'Recent Activity & Audit Trail',
};

type DashboardViewTab =
  | 'overview'
  | 'financial'
  | 'sales_crm'
  | 'operations'
  | 'approvals_tasks'
  | 'health_ai'
  | 'all';

type KpiGroupKey = 'financial' | 'sales' | 'crm' | 'inventory' | 'logistics' | 'hr' | 'all';

interface ExecutiveDashboardPanelProps {
  role: UserRole;
  staffProfile: UserProfile | null;
  currency: CurrencyCode;
  fxRates: Record<string, number>;
  settings: CompanySettings;
  liveFx: LiveExchangeRateState;
  aisStatus: AisServiceStatusResponse | null;
  integrationConfig: ApiIntegrationConfig;
  isLiveFirestoreMode: boolean;
  vehicles: Vehicle[];
  users: UserProfile[];
  sourcingRequests: SourcingRequest[];
  quotations: Quotation[];
  orders: ExportOrder[];
  inquiries: Inquiry[];
  financeRecords: FinanceRecord[];
  hrEmployees: HrEmployee[];
  leaveRequests: HrLeaveRequest[];
  teamTasks: TeamTask[];
  salesTargets: SalesTarget[];
  vessels: RegisteredVessel[];
  documents: ExportDocument[];
  auditLogs: AuditLogEntry[];
  testimonials: CustomerTestimonial[];
  landingContent: LandingPageContent;
  approvalHandlers: ApprovalActionHandlers;
  onCreateTask: (input: Omit<TeamTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateTaskDetails: (
    id: string,
    updates: Partial<
      Pick<
        TeamTask,
        'title' | 'description' | 'department' | 'assignedToName' | 'priority' | 'status' | 'dueDate'
      >
    >
  ) => Promise<void>;
  onRefreshDashboard: () => Promise<void>;
  onRefreshFx: () => Promise<void>;
  onRefreshAis: () => Promise<void>;
  onNavigateSection: (section: string, opts?: { filter?: string; search?: string }) => void;
  onQuickAction: (actionId: string) => void;
  onGenerateDailyAiReport: () => void;
  onDownloadBackup: () => void;
}

function MiniSparkline({ data, tone }: { data: number[]; tone?: KpiMetricItem['tone'] }) {
  if (!data || data.length < 2 || data.every((v) => v === 0)) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = Math.max(1, max - min);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 64;
      const y = 20 - ((v - min) / span) * 18;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const stroke =
    tone === 'rose'
      ? '#f43f5e'
      : tone === 'amber'
      ? '#d97706'
      : tone === 'indigo'
      ? '#6366f1'
      : tone === 'sky'
      ? '#0ea5e9'
      : '#10b981';

  return (
    <svg width="64" height="22" viewBox="0 0 64 22" className="shrink-0 overflow-visible">
      <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" points={points} />
    </svg>
  );
}

export function ExecutiveDashboardPanel({
  role,
  staffProfile,
  currency: defaultCurrency,
  fxRates,
  settings,
  liveFx,
  aisStatus,
  integrationConfig,
  isLiveFirestoreMode,
  vehicles,
  users,
  sourcingRequests,
  quotations,
  orders,
  inquiries,
  financeRecords,
  hrEmployees,
  leaveRequests,
  teamTasks,
  salesTargets,
  vessels,
  documents,
  auditLogs,
  testimonials,
  landingContent,
  approvalHandlers,
  onCreateTask,
  onUpdateTaskDetails,
  onRefreshDashboard,
  onRefreshFx,
  onRefreshAis,
  onNavigateSection,
  onQuickAction,
}: ExecutiveDashboardPanelProps) {
  const canSeeProfit = canViewCompanyProfit(role, staffProfile);
  const canSeeAccounts = hasModulePermission(role, staffProfile, 'accounts', 'view');
  const canApproveAccounts = hasModulePermission(role, staffProfile, 'accounts', 'edit');
  const canSeeHr = hasModulePermission(role, staffProfile, 'hr', 'view');
  const canApproveHr = hasModulePermission(role, staffProfile, 'hr', 'approve');
  const canApproveUsers = hasModulePermission(role, staffProfile, 'users', 'edit');
  const canApproveCms = hasModulePermission(role, staffProfile, 'cms', 'edit');
  const canConvertSales = hasModulePermission(role, staffProfile, 'orders', 'create');
  const canViewAudit =
    hasModulePermission(role, staffProfile, 'settings', 'view') ||
    role === 'admin' ||
    role === 'management';
  const canManageIntegrations = hasModulePermission(role, staffProfile, 'settings', 'edit');

  // Dashboard display currency (defaults to portal currency; supports JPY/USD/GBP/PKR & all configured)
  const [dashCurrency, setDashCurrency] = useState<CurrencyCode>(defaultCurrency);
  useEffect(() => {
    setDashCurrency(defaultCurrency);
  }, [defaultCurrency]);

  const availableCurrencies = useMemo(() => {
    const priority = ['USD', 'JPY', 'GBP', 'PKR', 'EUR', 'AUD', 'CAD', 'AED', 'KES', 'ZAR', 'NZD'];
    const allKeys = Object.keys(fxRates || {});
    const set = new Set<string>([...priority.filter((c) => c === 'USD' || fxRates[c]), ...allKeys]);
    return Array.from(set);
  }, [fxRates]);

  // Date Range Filter state
  const [datePreset, setDatePreset] = useState<DateRangePreset>('this_month');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const resolvedRange = useMemo(
    () => resolveDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd]
  );

  // View Tab & KPI Group selector
  const [viewTab, setViewTab] = useState<DashboardViewTab>('overview');
  const [kpiGroup, setKpiGroup] = useState<KpiGroupKey>('financial');

  // Refreshing & Export Menus
  const [refreshing, setRefreshing] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [printReportOpen, setPrintReportOpen] = useState(false);

  // Per-User Layout Customization persisted in localStorage
  const prefKey = `auzio_superadmin_layout_${staffProfile?.uid || 'default'}`;
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<DashboardSectionId[]>(() => {
    try {
      const saved = localStorage.getItem(prefKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { order?: DashboardSectionId[] };
        if (Array.isArray(parsed.order) && parsed.order.length === DEFAULT_SECTION_ORDER.length) {
          return parsed.order;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_SECTION_ORDER;
  });
  const [hiddenSections, setHiddenSections] = useState<DashboardSectionId[]>(() => {
    try {
      const saved = localStorage.getItem(prefKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { hidden?: DashboardSectionId[] };
        if (Array.isArray(parsed.hidden)) return parsed.hidden;
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        prefKey,
        JSON.stringify({ order: sectionOrder, hidden: hiddenSections, compactMode })
      );
    } catch {
      // ignore storage quota
    }
  }, [prefKey, sectionOrder, hiddenSections, compactMode]);

  const moveSection = (id: DashboardSectionId, dir: -1 | 1) => {
    setSectionOrder((prev) => {
      const idx = prev.indexOf(id);
      const nextIdx = idx + dir;
      if (idx < 0 || nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  };

  const toggleSectionVisibility = (id: DashboardSectionId) => {
    setHiddenSections((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const resetLayout = () => {
    setSectionOrder(DEFAULT_SECTION_ORDER);
    setHiddenSections([]);
    setCompactMode(false);
  };

  // Compute all real-time analytics from live Firestore collections
  const analytics = useMemo(
    () =>
      computeDashboardAnalytics({
        range: resolvedRange,
        currency: dashCurrency,
        fxRates,
        canSeeProfit,
        canSeeAccounts,
        canSeeHr,
        vehicles,
        users,
        sourcingRequests,
        quotations,
        orders,
        inquiries,
        financeRecords,
        hrEmployees,
        leaveRequests,
        teamTasks,
        salesTargets,
        vessels,
        documents,
      }),
    [
      resolvedRange,
      dashCurrency,
      fxRates,
      canSeeProfit,
      canSeeAccounts,
      canSeeHr,
      vehicles,
      users,
      sourcingRequests,
      quotations,
      orders,
      inquiries,
      financeRecords,
      hrEmployees,
      leaveRequests,
      teamTasks,
      salesTargets,
      vessels,
      documents,
    ]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshDashboard();
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  const isSectionVisibleInView = (id: DashboardSectionId): boolean => {
    if (hiddenSections.includes(id)) return false;
    if (viewTab === 'all') return true;
    if (viewTab === 'overview') {
      return ['kpis', 'quick_actions', 'approvals', 'financial', 'recent_orders', 'ai_insights'].includes(id);
    }
    if (viewTab === 'financial') return ['kpis', 'financial'].includes(id);
    if (viewTab === 'sales_crm') return ['sales', 'crm_pipeline'].includes(id);
    if (viewTab === 'operations') return ['recent_orders', 'logistics'].includes(id);
    if (viewTab === 'approvals_tasks') return ['approvals', 'tasks', 'quick_actions'].includes(id);
    if (viewTab === 'health_ai') return ['website', 'ai_insights', 'system_health', 'audit_logs'].includes(id);
    return true;
  };

  const kpiGroups: Array<{
    key: Exclude<KpiGroupKey, 'all'>;
    label: string;
    icon: typeof DollarSign;
    items: KpiMetricItem[];
  }> = [
    { key: 'financial', label: 'Financial', icon: DollarSign, items: analytics.financialKpis },
    { key: 'sales', label: 'Sales', icon: TrendingUp, items: analytics.salesKpis },
    { key: 'crm', label: 'CRM & Customers', icon: Users, items: analytics.crmKpis },
    { key: 'inventory', label: 'Inventory & Auctions', icon: Car, items: analytics.inventoryKpis },
    { key: 'logistics', label: 'Orders & Logistics', icon: Ship, items: analytics.logisticsKpis },
    { key: 'hr', label: 'Human Resources', icon: Briefcase, items: analytics.hrKpis },
  ];

  const renderKpiCard = (item: KpiMetricItem) => {
    const isPositive = item.deltaPct !== null && item.deltaPct > 0;
    const isNegative = item.deltaPct !== null && item.deltaPct < 0;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onNavigateSection(item.targetSection, item.filterKey ? { filter: item.filterKey } : undefined)}
        className={`text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-500/70 dark:hover:border-amber-500/70 transition-colors cursor-pointer flex flex-col justify-between ${
          compactMode ? 'p-3' : 'p-4'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight">
            {item.label}
          </span>
          {item.restricted && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        </div>

        <div className="flex items-end justify-between gap-2 mt-2">
          <div className="min-w-0">
            {refreshing ? (
              <div className="h-6 w-24 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ) : (
              <div
                className={`font-bold tabular-nums tracking-tight truncate ${
                  compactMode ? 'text-lg' : 'text-xl'
                } ${
                  item.restricted
                    ? 'text-slate-400 text-sm'
                    : item.tone === 'rose'
                    ? 'text-rose-600 dark:text-rose-400'
                    : item.tone === 'emerald'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : item.tone === 'amber'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-950 dark:text-white'
                }`}
              >
                {item.formattedValue}
              </div>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              {item.deltaPct !== null ? (
                <span
                  className={`inline-flex items-center font-semibold tabular-nums ${
                    isPositive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isNegative
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500'
                  }`}
                >
                  {isPositive ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : isNegative ? (
                    <ArrowDownRight className="w-3 h-3" />
                  ) : null}
                  {isPositive ? '+' : ''}
                  {item.deltaPct}% vs {resolvedRange.prevLabel}
                </span>
              ) : (
                <span className="text-slate-400 truncate">
                  {item.deltaHint || resolvedRange.label}
                </span>
              )}
            </div>
          </div>
          <MiniSparkline data={item.sparkline} tone={item.tone} />
        </div>
      </button>
    );
  };

  const renderOrderedSection = (id: DashboardSectionId) => {
    if (!isSectionVisibleInView(id)) return null;

    if (id === 'kpis') {
      const visibleGroups =
        kpiGroup === 'all' ? kpiGroups : kpiGroups.filter((g) => g.key === kpiGroup);
      return (
        <section key={id} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {kpiGroups.map((g) => {
                const Icon = g.icon;
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setKpiGroup(g.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      kpiGroup === g.key
                        ? 'bg-slate-950 text-white dark:bg-amber-500 dark:text-slate-950'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {g.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setKpiGroup(kpiGroup === 'all' ? 'financial' : 'all')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  kpiGroup === 'all'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                {kpiGroup === 'all' ? 'Showing All 6 Groups' : 'View All 6 KPI Groups'}
              </button>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Period: {resolvedRange.label} · Comparing vs {resolvedRange.prevLabel}
            </span>
          </div>

          <div className="space-y-5">
            {visibleGroups.map((g) => (
              <div key={g.key} className="space-y-2.5">
                {kpiGroup === 'all' && (
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {g.label} Overview
                  </h4>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {g.items.map(renderKpiCard)}
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (id === 'quick_actions' || id === 'approvals' || id === 'tasks') {
      return (
        <DashboardApprovalsTasks
          key={id}
          staffProfile={staffProfile}
          currency={dashCurrency}
          fxRates={fxRates}
          canApproveAccounts={canApproveAccounts}
          canApproveHr={canApproveHr}
          canApproveUsers={canApproveUsers}
          canApproveCms={canApproveCms}
          canConvertSales={canConvertSales}
          financeRecords={financeRecords}
          leaveRequests={leaveRequests}
          users={users}
          quotations={quotations}
          sourcingRequests={sourcingRequests}
          orders={orders}
          testimonials={testimonials}
          teamTasks={teamTasks}
          hrEmployees={hrEmployees}
          showQuickActions={id === 'quick_actions'}
          showApprovals={id === 'approvals'}
          showTasks={id === 'tasks'}
          approvalHandlers={approvalHandlers}
          onCreateTask={onCreateTask}
          onUpdateTaskDetails={onUpdateTaskDetails}
          onQuickAction={onQuickAction}
          onNavigateSection={(sec) => onNavigateSection(sec)}
        />
      );
    }

    if (id === 'financial' || id === 'sales' || id === 'crm_pipeline') {
      return (
        <DashboardFinancialSales
          key={id}
          analytics={analytics}
          orders={orders}
          currency={dashCurrency}
          fxRates={fxRates}
          canSeeProfit={canSeeProfit}
          canSeeAccounts={canSeeAccounts}
          showFinancial={id === 'financial'}
          showSales={id === 'sales'}
          showCrmPipeline={id === 'crm_pipeline'}
          onNavigateSection={onNavigateSection}
        />
      );
    }

    if (id === 'recent_orders' || id === 'logistics') {
      return (
        <DashboardOperationsPanel
          key={id}
          analytics={analytics}
          orders={orders}
          vehicles={vehicles}
          users={users}
          quotations={quotations}
          financeRecords={financeRecords}
          vessels={vessels}
          aisStatus={aisStatus}
          currency={dashCurrency}
          fxRates={fxRates}
          showRecentOrders={id === 'recent_orders'}
          showLogistics={id === 'logistics'}
          onRefreshAis={onRefreshAis}
          onNavigateSection={onNavigateSection}
        />
      );
    }

    return (
      <DashboardHealthInsights
        key={id}
        analytics={analytics}
        range={resolvedRange}
        currency={dashCurrency}
        isLiveFirestoreMode={isLiveFirestoreMode}
        liveFx={liveFx}
        aisStatus={aisStatus}
        integrationConfig={integrationConfig}
        vehicles={vehicles}
        users={users}
        inquiries={inquiries}
        testimonials={testimonials}
        landingContent={landingContent}
        auditLogs={auditLogs}
        canViewAudit={canViewAudit}
        canManageIntegrations={canManageIntegrations}
        showWebsite={id === 'website'}
        showAiInsights={id === 'ai_insights'}
        showHealth={id === 'system_health'}
        showAuditLogs={id === 'audit_logs'}
        onRefreshFx={onRefreshFx}
        onRefreshAis={onRefreshAis}
        onNavigateSection={(sec) => onNavigateSection(sec)}
      />
    );
  };

  const roleMeta = ROLE_METADATA[role === 'visitor' ? 'sales' : role];

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* SUPER ADMIN COMMAND CENTER HEADER & CONTROLS */}
      {/* ===================================================================== */}
      <div className="bg-slate-950 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-400 font-semibold uppercase tracking-wider">
              <span>{roleMeta?.label || 'Super Admin'} Command Center</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300 font-mono">
                {isLiveFirestoreMode ? 'Cloud Firestore Connected' : 'Local Mode'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              Welcome back, {staffProfile?.displayName || 'Administrator'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Real-time company telemetry across Finance, Sales, CRM, Auctions, Orders, Logistics, HR & System Health.
            </p>
          </div>

          {/* Right Action Controls: Currency, Refresh, Export, Customize */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Dashboard Currency"
              value={dashCurrency}
              onChange={(e) => setDashCurrency(e.target.value)}
              className="px-2.5 py-2 text-xs font-mono font-bold rounded-lg bg-slate-900 border border-slate-700 text-white cursor-pointer"
            >
              {availableCurrencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-100 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Report
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      downloadDashboardCsv({
                        companySettings: settings,
                        adminName: staffProfile?.displayName || 'Administrator',
                        range: resolvedRange,
                        currency: dashCurrency,
                        analytics,
                      });
                      setExportMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-slate-500" />
                    Export CSV Spreadsheet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      downloadDashboardExcel({
                        companySettings: settings,
                        adminName: staffProfile?.displayName || 'Administrator',
                        range: resolvedRange,
                        currency: dashCurrency,
                        analytics,
                      });
                      setExportMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Export Excel (.xls)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportMenuOpen(false);
                      setPrintReportOpen(true);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-t border-slate-100 dark:border-slate-800"
                  >
                    <Printer className="w-4 h-4 text-amber-600" />
                    Printable / PDF Executive Report
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCustomizeOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-100 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Customize
            </button>
          </div>
        </div>

        {/* Date Range Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400 mr-1" />
            {(
              [
                ['today', 'Today'],
                ['yesterday', 'Yesterday'],
                ['this_week', 'This Week'],
                ['this_month', 'This Month'],
                ['last_month', 'Last Month'],
                ['this_quarter', 'This Quarter'],
                ['this_year', 'This Year'],
                ['custom', 'Custom Range'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDatePreset(key)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  datePreset === key
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* EXECUTIVE WORKSPACE VIEW TABS */}
      {/* ===================================================================== */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(
          [
            ['overview', 'Command Overview', LayoutGrid],
            ['financial', 'Financial Intelligence', DollarSign],
            ['sales_crm', 'Sales & CRM Pipeline', BarChart3],
            ['operations', 'Orders & Logistics Map', Ship],
            ['approvals_tasks', 'Approvals & Tasks', ClipboardCheck],
            ['health_ai', 'Website, AI & System Health', Activity],
            ['all', 'All Sections', Globe],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setViewTab(id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              viewTab === id
                ? 'bg-slate-950 text-white dark:bg-amber-500 dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ===================================================================== */}
      {/* WIDGET CUSTOMIZATION PANEL */}
      {/* ===================================================================== */}
      {customizeOpen && (
        <div className="bg-white dark:bg-slate-900 border border-amber-400/60 dark:border-amber-600/50 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-950 dark:text-white">
                Customize Dashboard Layout & Widget Order
              </h4>
              <p className="text-xs text-slate-500">
                Preferences save automatically for {staffProfile?.displayName || 'your account'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-semibold">
                <input
                  type="checkbox"
                  checked={compactMode}
                  onChange={(e) => setCompactMode(e.target.checked)}
                />
                Compact KPI Density
              </label>
              <button
                type="button"
                onClick={resetLayout}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
              >
                Reset Default
              </button>
              <button
                type="button"
                onClick={() => setCustomizeOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sectionOrder.map((secId, index) => {
              const hidden = hiddenSections.includes(secId);
              return (
                <div
                  key={secId}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <span
                    className={`font-semibold truncate ${
                      hidden ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {index + 1}. {SECTION_LABELS[secId]}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveSection(secId, -1)}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(secId, 1)}
                      disabled={index === sectionOrder.length - 1}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSectionVisibility(secId)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title={hidden ? 'Show widget' : 'Hide widget'}
                    >
                      {hidden ? (
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* RENDER ALL ACTIVE SECTIONS IN CUSTOMIZED ORDER */}
      {/* ===================================================================== */}
      <div className="space-y-6">{sectionOrder.map(renderOrderedSection)}</div>

      {/* ===================================================================== */}
      {/* PRINTABLE / SAVE-AS-PDF EXECUTIVE REPORT MODAL (iFrame-Safe) */}
      {/* ===================================================================== */}
      {printReportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs overflow-y-auto p-4 sm:p-8 flex justify-center">
          <div className="bg-white text-slate-950 rounded-2xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl h-fit">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <img src={OFFICIAL_LOGO_URL} alt="Auzio Traders" className="h-10 w-auto object-contain" />
                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    {settings.companyName || 'AUZIO TRADERS'} — Executive Dashboard Report
                  </h3>
                  <div className="text-xs text-slate-500">
                    Date Range: <strong>{resolvedRange.label}</strong> · Currency:{' '}
                    <strong>{dashCurrency}</strong> · Generated: {new Date().toLocaleString()} · By:{' '}
                    {staffProfile?.displayName || 'Super Admin'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-950 text-white rounded-lg cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPrintReportOpen(false)}
                  className="p-2 text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kpiGroups.map((g) => (
                <div key={g.key} className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-1.5">
                    {g.label} Overview
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {g.items
                      .filter((k) => !k.restricted)
                      .map((k) => (
                        <div key={k.id} className="flex items-center justify-between gap-2">
                          <span className="text-slate-600">{k.label}</span>
                          <span className="font-bold tabular-nums text-slate-950">
                            {k.formattedValue}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200 pt-3">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Verified live Firestore telemetry · Confidential management document
              </span>
              <span>{settings.officeAddress}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
