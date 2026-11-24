import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bot,
  Briefcase,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Ship,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '../../data/ports';
import type {
  CurrencyCode,
  ExportOrder,
  FinanceRecord,
  HrLeaveRequest,
  Inquiry,
  Quotation,
  SourcingRequest,
  TeamTask,
  UserProfile,
  Vehicle,
} from '../../types/portal';

interface ExecutiveDashboardPanelProps {
  currency: CurrencyCode;
  fxRates: Record<string, number>;
  vehicles: Vehicle[];
  users: UserProfile[];
  sourcingRequests: SourcingRequest[];
  quotations: Quotation[];
  orders: ExportOrder[];
  inquiries: Inquiry[];
  financeRecords: FinanceRecord[];
  leaveRequests: HrLeaveRequest[];
  teamTasks: TeamTask[];
  onNavigateSection: (section: string) => void;
  onGenerateDailyAiReport: () => void;
  onDownloadBackup: () => void;
}

const PIPELINE_STAGES: Array<{
  key: string;
  label: string;
  color: string;
  barColor: string;
}> = [
  { key: 'sourcing', label: 'Sourcing', color: 'text-sky-600 dark:text-sky-400', barColor: 'bg-sky-500' },
  { key: 'purchased', label: 'Purchased', color: 'text-indigo-600 dark:text-indigo-400', barColor: 'bg-indigo-500' },
  { key: 'inspection', label: 'Inspection', color: 'text-amber-600 dark:text-amber-400', barColor: 'bg-amber-500' },
  { key: 'shipping', label: 'Shipping', color: 'text-blue-600 dark:text-blue-400', barColor: 'bg-blue-600' },
  { key: 'delivered', label: 'Delivered', color: 'text-emerald-600 dark:text-emerald-400', barColor: 'bg-emerald-500' },
];

export function ExecutiveDashboardPanel({
  currency,
  fxRates,
  vehicles,
  users,
  sourcingRequests,
  quotations,
  orders,
  inquiries,
  financeRecords,
  leaveRequests,
  teamTasks,
  onNavigateSection,
  onGenerateDailyAiReport,
  onDownloadBackup,
}: ExecutiveDashboardPanelProps) {
  const fmt = (usd: number) => formatMoney(usd, currency, fxRates);

  const metrics = useMemo(() => {
    const orderRevenueUsd = orders
      .filter((o) =>
        [
          'payment_received',
          'vehicle_in_yard',
          'export_docs_ready',
          'shipment_booked',
          'shipped',
          'arrived_port',
          'completed',
        ].includes(o.milestone)
      )
      .reduce((acc, o) => acc + (o.totalCifUsd || 0), 0);

    const paidFinanceRevenueUsd = financeRecords
      .filter((r) => (r.type === 'payment' || r.type === 'invoice') && (r.status === 'paid' || r.status === 'reconciled'))
      .reduce((acc, r) => acc + (r.amountUsd || 0), 0);

    const totalRevenueUsd = Math.max(orderRevenueUsd, paidFinanceRevenueUsd);

    const totalExpensesUsd = financeRecords
      .filter((r) => r.type === 'expense')
      .reduce((acc, r) => acc + (r.amountUsd || 0), 0);

    // If explicit expenses are logged, compute net profit directly; otherwise show realized margin from orders minus FOB/freight where available
    const estimatedOrderMarginUsd = orders
      .filter((o) => o.milestone === 'completed' || o.milestone === 'shipped' || o.milestone === 'arrived_port')
      .reduce((acc, o) => acc + Math.max(0, o.totalCifUsd - o.fobUsd - o.freightUsd - o.inspectionUsd - o.insuranceUsd), 0);

    const netProfitUsd =
      totalExpensesUsd > 0 ? totalRevenueUsd - totalExpensesUsd : estimatedOrderMarginUsd;

    const vehiclesSoldCount =
      vehicles.filter((v) => v.status === 'sold').length +
      orders.filter((o) =>
        ['vehicle_purchased', 'payment_received', 'vehicle_in_yard', 'export_docs_ready', 'shipment_booked', 'shipped', 'arrived_port', 'completed'].includes(
          o.milestone
        )
      ).length;

    const activeShipmentsCount = orders.filter((o) =>
      ['vehicle_in_yard', 'export_docs_ready', 'shipment_booked', 'shipped'].includes(o.milestone)
    ).length;

    const activeCustomersCount = users.filter((u) => u.role === 'customer' || u.role === 'dealer').length;

    const pendingFinanceUsd = financeRecords
      .filter((r) => r.type === 'invoice' && (r.status === 'pending' || r.status === 'overdue'))
      .reduce((acc, r) => acc + (r.amountUsd || 0), 0);

    const pendingOrderPaymentUsd = orders
      .filter((o) => o.milestone === 'payment_pending' || o.milestone === 'vehicle_purchased')
      .reduce((acc, o) => acc + (o.totalCifUsd || 0), 0);

    const outstandingPaymentsUsd = pendingFinanceUsd + pendingOrderPaymentUsd;

    return {
      totalRevenueUsd,
      totalExpensesUsd,
      netProfitUsd,
      vehiclesSoldCount,
      activeShipmentsCount,
      activeCustomersCount,
      outstandingPaymentsUsd,
    };
  }, [orders, financeRecords, vehicles, users]);

  const pipelineCounts = useMemo(() => {
    const sourcing =
      sourcingRequests.filter((r) => r.status !== 'closed').length +
      orders.filter((o) => ['request_received', 'options_prepared', 'quotation_sent', 'customer_approved', 'bid_placed'].includes(o.milestone)).length;
    const purchased = orders.filter((o) =>
      ['vehicle_purchased', 'payment_pending', 'payment_received'].includes(o.milestone)
    ).length;
    const inspection = orders.filter((o) =>
      ['vehicle_in_yard', 'export_docs_ready'].includes(o.milestone)
    ).length;
    const shipping = orders.filter((o) =>
      ['shipment_booked', 'shipped'].includes(o.milestone)
    ).length;
    const delivered = orders.filter((o) =>
      ['arrived_port', 'completed'].includes(o.milestone)
    ).length;

    const counts: Record<string, number> = {
      sourcing,
      purchased,
      inspection,
      shipping,
      delivered,
    };
    const maxVal = Math.max(1, ...Object.values(counts));
    return { counts, maxVal };
  }, [sourcingRequests, orders]);

  // Real chart data built strictly from existing orders & finance entries
  const salesChartData = useMemo(() => {
    const byDest = new Map<string, { label: string; revenue: number; orders: number }>();
    for (const ord of orders) {
      const key = (ord.destinationCountry || ord.destinationPortName || 'Export').split(',')[0].trim().slice(0, 16);
      const curr = byDest.get(key) || { label: key, revenue: 0, orders: 0 };
      curr.revenue += ord.totalCifUsd || 0;
      curr.orders += 1;
      byDest.set(key, curr);
    }
    return Array.from(byDest.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [orders]);

  const financeFlowData = useMemo(() => {
    const byCat = new Map<string, { category: string; inflow: number; outflow: number }>();
    for (const rec of financeRecords) {
      const cat = rec.category.slice(0, 14) || 'General';
      const curr = byCat.get(cat) || { category: cat, inflow: 0, outflow: 0 };
      if (rec.type === 'expense') curr.outflow += rec.amountUsd;
      else curr.inflow += rec.amountUsd;
      byCat.set(cat, curr);
    }
    return Array.from(byCat.values()).slice(0, 6);
  }, [financeRecords]);

  const alerts = useMemo(() => {
    const list: Array<{
      id: string;
      severity: 'warning' | 'info' | 'urgent';
      title: string;
      detail: string;
      targetSection: string;
    }> = [];

    const newInquiries = inquiries.filter((i) => i.status === 'received').length;
    if (newInquiries > 0) {
      list.push({
        id: 'new-inquiries',
        severity: 'warning',
        title: `${newInquiries} New Customer Inquir${newInquiries === 1 ? 'y' : 'ies'} Awaiting Follow-up`,
        detail: 'Respond quickly to convert public stock & shipping quote leads.',
        targetSection: 'crm',
      });
    }

    const approvedQuotes = quotations.filter((q) => q.status === 'approved').length;
    if (approvedQuotes > 0) {
      list.push({
        id: 'approved-quotes',
        severity: 'info',
        title: `${approvedQuotes} Approved Quotation${approvedQuotes === 1 ? '' : 's'} Ready for Order Conversion`,
        detail: 'Customer Max Bid Ceilings are authorized and ready to open as export orders.',
        targetSection: 'sales',
      });
    }

    const overdueInvoices = financeRecords.filter((r) => r.status === 'overdue').length;
    if (overdueInvoices > 0) {
      list.push({
        id: 'overdue-inv',
        severity: 'urgent',
        title: `${overdueInvoices} Overdue Invoice${overdueInvoices === 1 ? '' : 's'} Require Collection`,
        detail: 'Review Accounts & Finance to follow up on overdue settlements.',
        targetSection: 'accounts',
      });
    }

    const pendingLeaves = leaveRequests.filter((l) => l.status === 'pending').length;
    if (pendingLeaves > 0) {
      list.push({
        id: 'pending-leaves',
        severity: 'info',
        title: `${pendingLeaves} Pending Employee Leave Request${pendingLeaves === 1 ? '' : 's'}`,
        detail: 'Review and approve or decline staff leave requests in HR.',
        targetSection: 'hr',
      });
    }

    const openUrgentTasks = teamTasks.filter(
      (t) => t.status !== 'done' && (t.priority === 'urgent' || t.priority === 'high')
    ).length;
    if (openUrgentTasks > 0) {
      list.push({
        id: 'urgent-tasks',
        severity: 'warning',
        title: `${openUrgentTasks} High-Priority Team Task${openUrgentTasks === 1 ? '' : 's'} Open`,
        detail: 'Check Reports & Tasks to keep operations on schedule.',
        targetSection: 'reports',
      });
    }

    return list;
  }, [inquiries, quotations, financeRecords, leaveRequests, teamTasks]);

  const kpiCards = [
    {
      label: 'Total Revenue',
      value: fmt(metrics.totalRevenueUsd),
      sub: `${orders.length} active export orders`,
      icon: TrendingUp,
      accent: 'text-emerald-600 dark:text-emerald-400',
      section: 'accounts',
    },
    {
      label: 'Net Profit',
      value: fmt(metrics.netProfitUsd),
      sub: metrics.totalExpensesUsd > 0 ? `After ${fmt(metrics.totalExpensesUsd)} expenses` : 'From recorded ledger & orders',
      icon: BarChart3,
      accent: 'text-blue-600 dark:text-blue-400',
      section: 'accounts',
    },
    {
      label: 'Vehicles Sold',
      value: metrics.vehiclesSoldCount.toLocaleString(),
      sub: `${vehicles.filter((v) => v.status === 'available').length} currently in stock`,
      icon: Car,
      accent: 'text-slate-900 dark:text-white',
      section: 'inventory',
    },
    {
      label: 'Active Shipments',
      value: metrics.activeShipmentsCount.toLocaleString(),
      sub: 'Yard, docs, booked & at sea',
      icon: Ship,
      accent: 'text-amber-600 dark:text-amber-400',
      section: 'logistics',
    },
    {
      label: 'Active Customers',
      value: metrics.activeCustomersCount.toLocaleString(),
      sub: `${inquiries.length} recorded inquiries`,
      icon: Users,
      accent: 'text-indigo-600 dark:text-indigo-400',
      section: 'crm',
    },
    {
      label: 'Outstanding Payments',
      value: fmt(metrics.outstandingPaymentsUsd),
      sub: 'Pending invoices & settlements',
      icon: CreditCard,
      accent: metrics.outstandingPaymentsUsd > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300',
      section: 'accounts',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Business Overview
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor your entire export business in real time from live company records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onGenerateDailyAiReport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Bot className="w-4 h-4" />
            <span>Daily Business Report</span>
          </button>
          <button
            type="button"
            onClick={onDownloadBackup}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Export Snapshot</span>
          </button>
        </div>
      </div>

      {/* 6 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => onNavigateSection(card.section)}
              className="group text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {card.label}
                </span>
                <Icon className={`w-4 h-4 ${card.accent}`} />
              </div>
              <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums text-slate-950 dark:text-white tracking-tight">
                {card.value}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">{card.sub}</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Sales Performance Chart + Order Pipeline */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Sales Performance by Market
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real CIF order value aggregated across destination markets (USD base)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('sales')}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              View Sales &rarr;
            </button>
          </div>

          {salesChartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-6">
              <BarChart3 className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No export orders recorded yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                Once customer quotations are converted into export orders, sales performance by
                destination market will plot automatically here.
              </p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="auzioRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(val: unknown) => [
                      `$${Number(val || 0).toLocaleString()} USD`,
                      'Order Value',
                    ]}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#d97706"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#auzioRevGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Order Pipeline */}
        <div className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Order Pipeline
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live stage distribution
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateSection('orders')}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                All Orders
              </button>
            </div>

            <div className="space-y-4">
              {PIPELINE_STAGES.map((stage) => {
                const count = pipelineCounts.counts[stage.key] || 0;
                const pct = Math.max(count > 0 ? 8 : 0, Math.round((count / pipelineCounts.maxVal) * 100));
                return (
                  <div key={stage.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {stage.label}
                      </span>
                      <span className={`font-mono font-bold tabular-nums ${stage.color}`}>
                        {count}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${stage.barColor} transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total active pipeline</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
              {Object.values(pipelineCounts.counts).reduce((a, b) => a + b, 0)} items
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Alerts & Cashflow Snapshot */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Operational Alerts */}
        <div className="xl:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Priority Alerts &amp; Approvals
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {alerts.length} active
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>All operational queues, approvals, and invoices are up to date.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {alerts.map((alert) => (
                <div key={alert.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {alert.severity === 'urgent' ? (
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {alert.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {alert.detail}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateSection(alert.targetSection)}
                    className="shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                  >
                    Open &rarr;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cash Flow Snapshot */}
        <div className="xl:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Accounts Cash Flow Breakdown
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inflows vs. recorded expenses by accounting category
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('accounts')}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Open Accounts &rarr;
            </button>
          </div>

          {financeFlowData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-5">
              <Briefcase className="w-7 h-7 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No ledger entries logged yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Log invoices, payments, or expenses in Accounts &amp; Finance to populate P&amp;L
                cash flow charts.
              </p>
              <button
                type="button"
                onClick={() => onNavigateSection('accounts')}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Log First Entry</span>
              </button>
            </div>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="inflow" name="Inflow (USD)" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflow" name="Expense (USD)" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
