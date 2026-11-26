import {
  ArrowUpDown,
  BarChart3,
  Clock,
  DollarSign,
  ExternalLink,
  Maximize2,
  Minimize2,
  Search,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '../../../data/ports';
import type { CurrencyCode, ExportOrder } from '../../../types/portal';
import {
  getOrderDateMs,
  type ComputedDashboardAnalytics,
  type SalespersonPerformanceRow,
} from './dashboardMetrics';

interface DashboardFinancialSalesProps {
  analytics: ComputedDashboardAnalytics;
  orders: ExportOrder[];
  currency: CurrencyCode;
  fxRates: Record<string, number>;
  canSeeProfit: boolean;
  canSeeAccounts: boolean;
  showFinancial: boolean;
  showSales: boolean;
  showCrmPipeline: boolean;
  onNavigateSection: (section: string, opts?: { filter?: string; search?: string }) => void;
}

const CHART_COLORS = ['#0f172a', '#d97706', '#0ea5e9', '#10b981', '#6366f1', '#f43f5e', '#8b5cf6'];

export function DashboardFinancialSales({
  analytics,
  orders,
  currency,
  fxRates,
  canSeeProfit,
  canSeeAccounts,
  showFinancial,
  showSales,
  showCrmPipeline,
  onNavigateSection,
}: DashboardFinancialSalesProps) {
  const fmt = (usd: number) => formatMoney(usd, currency, fxRates);
  const [salesGranularity, setSalesGranularity] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [finFullscreen, setFinFullscreen] = useState(false);

  // Salesperson table state
  const [spSearch, setSpSearch] = useState('');
  const [spDeptFilter, setSpDeptFilter] = useState('ALL');
  const [spSortKey, setSpSortKey] = useState<keyof SalespersonPerformanceRow>('revenueUsd');
  const [spSortDir, setSpSortDir] = useState<'asc' | 'desc'>('desc');

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const s of analytics.salespersonPerformance) {
      if (s.department) set.add(s.department);
    }
    return ['ALL', ...Array.from(set)];
  }, [analytics.salespersonPerformance]);

  const filteredSalespeople = useMemo(() => {
    const q = spSearch.trim().toLowerCase();
    return analytics.salespersonPerformance
      .filter((s) => {
        if (spDeptFilter !== 'ALL' && s.department !== spDeptFilter) return false;
        if (
          q &&
          !`${s.staffName} ${s.staffEmail} ${s.department}`.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const av = a[spSortKey] ?? -1;
        const bv = b[spSortKey] ?? -1;
        if (typeof av === 'number' && typeof bv === 'number') {
          return spSortDir === 'desc' ? bv - av : av - bv;
        }
        return spSortDir === 'desc'
          ? String(bv).localeCompare(String(av))
          : String(av).localeCompare(String(bv));
      });
  }, [analytics.salespersonPerformance, spSearch, spDeptFilter, spSortKey, spSortDir]);

  const toggleSort = (key: keyof SalespersonPerformanceRow) => {
    if (spSortKey === key) {
      setSpSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSpSortKey(key);
      setSpSortDir('desc');
    }
  };

  // Multi-granularity sales chart derived strictly from real orders
  const salesChartData = useMemo(() => {
    const map = new Map<string, { label: string; revenueUsd: number; units: number }>();
    const now = new Date();

    if (salesGranularity === 'daily') {
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        map.set(key, {
          label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenueUsd: 0,
          units: 0,
        });
      }
      for (const o of orders) {
        const ms = getOrderDateMs(o);
        if (!ms) continue;
        const key = new Date(ms).toISOString().slice(0, 10);
        const entry = map.get(key);
        if (entry) {
          entry.revenueUsd += o.totalCifUsd || 0;
          entry.units += 1;
        }
      }
    } else if (salesGranularity === 'weekly') {
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 7 * 86400000);
        const key = `W${8 - i}`;
        map.set(key, {
          label: `Wk of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          revenueUsd: 0,
          units: 0,
        });
      }
      const weekEntries = Array.from(map.values());
      for (const o of orders) {
        const ms = getOrderDateMs(o);
        if (!ms) continue;
        const diffWeeks = Math.floor((now.getTime() - ms) / (7 * 86400000));
        if (diffWeeks >= 0 && diffWeeks < 8) {
          const entry = weekEntries[7 - diffWeeks];
          if (entry) {
            entry.revenueUsd += o.totalCifUsd || 0;
            entry.units += 1;
          }
        }
      }
    } else if (salesGranularity === 'yearly') {
      const thisYear = now.getFullYear();
      for (let y = thisYear - 3; y <= thisYear; y++) {
        map.set(String(y), { label: String(y), revenueUsd: 0, units: 0 });
      }
      for (const o of orders) {
        const ms = getOrderDateMs(o);
        if (!ms) continue;
        const y = String(new Date(ms).getFullYear());
        const entry = map.get(y);
        if (entry) {
          entry.revenueUsd += o.totalCifUsd || 0;
          entry.units += 1;
        }
      }
    } else {
      return analytics.monthBuckets.map((b) => ({
        label: b.label,
        revenueUsd: b.revenueUsd,
        units: orders.filter((o) => {
          const ms = getOrderDateMs(o);
          if (!ms) return false;
          const d = new Date(ms);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === b.key;
        }).length,
      }));
    }

    return Array.from(map.values());
  }, [orders, salesGranularity, analytics.monthBuckets]);

  const rateMultiplier = fxRates[currency] || 1;
  const convertForChart = (usd: number) => Math.round(usd * rateMultiplier);

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* FINANCIAL INTELLIGENCE SECTION */}
      {/* ===================================================================== */}
      {showFinancial && canSeeAccounts && (
        <section
          className={
            finFullscreen
              ? 'fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-6 space-y-6'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                  Financial Intelligence & Cash Flow
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live accounting view in {currency} · Historical invoices preserve locked exchange rates
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateSection('accounts')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                Open Accounts Ledger <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setFinFullscreen((f) => !f)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                title={finFullscreen ? 'Exit full screen' : 'Expand analytics'}
              >
                {finFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {finFullscreen ? 'Close' : 'Expand'}
              </button>
            </div>
          </div>

          {/* Accounting Distinction Strip: Recognized vs Deposits vs Verified Payments vs Outstanding */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Recognized Revenue
              </div>
              <div className="text-lg font-bold text-slate-950 dark:text-white tabular-nums mt-1">
                {fmt(analytics.accountingSummary.recognizedRevenueUsd)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Confirmed orders & issued invoices
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Customer Deposits
              </div>
              <div className="text-lg font-bold text-sky-700 dark:text-sky-400 tabular-nums mt-1">
                {fmt(analytics.accountingSummary.customerDepositsUsd)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Advance booking & auction deposits
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Verified Payments
              </div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                {fmt(analytics.accountingSummary.verifiedPaymentsUsd)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Bank-reconciled & paid receipts
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Outstanding Balances
              </div>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
                {fmt(analytics.accountingSummary.outstandingReceivablesUsd)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Payables: {fmt(analytics.accountingSummary.outstandingPayablesUsd)}
              </div>
            </div>
          </div>

          {/* Primary Financial Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Revenue vs Expenses & Profit Trend */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Revenue vs. Expenses & Profit Trend (6 Months)
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">{currency}</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={analytics.monthBuckets.map((b) => ({
                      label: b.label,
                      Revenue: convertForChart(b.revenueUsd),
                      Expenses: convertForChart(b.expensesUsd),
                      ...(canSeeProfit ? { NetProfit: convertForChart(b.netProfitUsd) } : {}),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: unknown) => `${currency} ${Number(val || 0).toLocaleString()}`}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Revenue" fill="#0f172a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#d97706" radius={[4, 4, 0, 0]} />
                    {canSeeProfit && (
                      <Line
                        type="monotone"
                        dataKey="NetProfit"
                        name="Net Profit"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Cash Flow Chart */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Monthly Cash Flow (Verified Inflow vs Paid Outflow)
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">{currency}</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={analytics.monthBuckets.map((b) => ({
                      label: b.label,
                      CashIn: convertForChart(b.cashInUsd),
                      CashOut: convertForChart(b.cashOutUsd),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: unknown) => `${currency} ${Number(val || 0).toLocaleString()}`}
                      contentStyle={{ borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area
                      type="monotone"
                      dataKey="CashIn"
                      name="Verified Inflow"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="CashOut"
                      name="Paid Expenses"
                      stroke="#f43f5e"
                      fill="#f43f5e"
                      fillOpacity={0.14}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Secondary Financial Breakdowns: Invoices, Expenses by Category, Revenue by Country & Vehicle Category */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Invoice Payment Breakdown */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                Invoice Payment Breakdown
              </h4>
              {analytics.invoiceBreakdown.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                  No invoice records logged yet.
                </div>
              ) : (
                <div className="h-48 flex items-center gap-3">
                  <div className="w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.invoiceBreakdown}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={36}
                          outerRadius={66}
                          paddingAngle={2}
                        >
                          {analytics.invoiceBreakdown.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: unknown) => fmt(Number(val || 0))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-2 text-xs">
                    {analytics.invoiceBreakdown.map((item) => (
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                          {item.name} ({item.count})
                        </span>
                        <span className="font-semibold tabular-nums text-slate-950 dark:text-white">
                          {fmt(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Expense Breakdown by Category */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                Expense Breakdown by Category
              </h4>
              {analytics.expenseByCategory.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                  No expenses logged yet.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {analytics.expenseByCategory.slice(0, 7).map((item, idx) => {
                    const max = analytics.expenseByCategory[0]?.amountUsd || 1;
                    const pct = Math.round((item.amountUsd / max) * 100);
                    return (
                      <div key={item.category} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-700 dark:text-slate-300 truncate">{item.category}</span>
                          <span className="font-semibold tabular-nums text-slate-950 dark:text-white">
                            {fmt(item.amountUsd)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Revenue by Vehicle Category & Country */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                Revenue by Vehicle Category & Market
              </h4>
              {analytics.revenueByCategory.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                  No order revenue categorized yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
                  {analytics.revenueByCategory.slice(0, 5).map((c) => (
                    <div
                      key={c.category}
                      className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {c.category} · <span className="text-slate-500">{c.units} units</span>
                      </span>
                      <span className="font-bold tabular-nums text-slate-950 dark:text-white">
                        {fmt(c.revenueUsd)}
                      </span>
                    </div>
                  ))}
                  {analytics.revenueByCountry.slice(0, 3).map((co) => (
                    <div
                      key={co.country}
                      className="flex items-center justify-between py-1 text-[11px] text-slate-500 dark:text-slate-400"
                    >
                      <span>Market: {co.country} ({co.units})</span>
                      <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                        {fmt(co.revenueUsd)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Profit Per Vehicle Table (Authorized Only) */}
          {canSeeProfit && analytics.profitPerVehicle.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                Unit Economics — Profit Per Exported Vehicle
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Vehicle</th>
                      <th className="px-3 py-2 text-right">CIF Revenue</th>
                      <th className="px-3 py-2 text-right">Cost Basis</th>
                      <th className="px-3 py-2 text-right">Unit Margin</th>
                      <th className="px-3 py-2">Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {analytics.profitPerVehicle.slice(0, 6).map((p) => (
                      <tr key={p.orderId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-mono font-semibold text-slate-900 dark:text-white">
                          {p.orderNumber}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300 truncate max-w-[220px]">
                          {p.vehicleTitle}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {fmt(p.revenueUsd)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                          {fmt(p.costUsd)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums font-bold ${
                            p.profitUsd >= 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {fmt(p.profitUsd)}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-500">
                          {p.hasActualExpenseLedger ? 'Linked Ledger' : 'Order Cost Breakdown'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* SALES PERFORMANCE ANALYTICS */}
      {/* ===================================================================== */}
      {showSales && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                  Sales Performance Analytics & Team Leaderboard
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live export orders, quotas, top markets, best-selling makes/models & salesperson scorecard
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 text-xs">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSalesGranularity(g)}
                  className={`px-2.5 py-1 rounded-md font-semibold capitalize cursor-pointer ${
                    salesGranularity === g
                      ? 'bg-slate-950 text-white dark:bg-amber-500 dark:text-slate-950'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Sales Volume & Revenue Chart */}
            <div className="xl:col-span-2 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {salesGranularity} Sales Revenue & Units Sold
                </h4>
                <span className="text-[11px] font-mono text-slate-500">{currency}</span>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salesChartData.map((d) => ({
                      label: d.label,
                      Revenue: convertForChart(d.revenueUsd),
                      Units: d.units,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.35} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: unknown, name: unknown) =>
                        name === 'Revenue'
                          ? `${currency} ${Number(val || 0).toLocaleString()}`
                          : `${val} units`
                      }
                    />
                    <Bar dataKey="Revenue" fill="#0f172a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Best Markets, Makes & Models */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Top Destination Markets
                </h4>
                {analytics.revenueByCountry.length === 0 ? (
                  <p className="text-xs text-slate-500">No export orders recorded yet.</p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {analytics.revenueByCountry.slice(0, 4).map((c) => (
                      <div key={c.country} className="flex items-center justify-between">
                        <span className="text-slate-700 dark:text-slate-300 truncate">{c.country}</span>
                        <span className="font-mono font-semibold text-slate-950 dark:text-white">
                          {c.units} · {fmt(c.revenueUsd)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Best-Selling Manufacturers & Models
                </h4>
                {analytics.bestMakes.length === 0 ? (
                  <p className="text-xs text-slate-500">No vehicle sales yet.</p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {analytics.bestModels.slice(0, 4).map((m) => (
                      <div key={m.name} className="flex items-center justify-between">
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[165px]">{m.name}</span>
                        <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {m.units} sold
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Salesperson Performance Table */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-slate-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Salesperson Performance Scorecard
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={spSearch}
                    onChange={(e) => setSpSearch(e.target.value)}
                    placeholder="Filter employee..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <select
                  value={spDeptFilter}
                  onChange={(e) => setSpDeptFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d === 'ALL' ? 'All Departments' : d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <tr>
                    {[
                      ['staffName', 'Employee'],
                      ['department', 'Dept'],
                      ['assignedLeads', 'Assigned'],
                      ['contactedLeads', 'Contacted'],
                      ['convertedLeads', 'Converted'],
                      ['confirmedSales', 'Sales'],
                      ['revenueUsd', 'Revenue'],
                      ...(canSeeProfit ? [['profitUsd', 'Profit']] : []),
                      ['monthlyTargetUsd', 'Target'],
                      ['achievementPct', 'Achieved %'],
                      ['pendingFollowUps', 'Follow-Ups'],
                    ].map(([key, label]) => (
                      <th key={key} className="px-3 py-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort(key as keyof SalespersonPerformanceRow)}
                          className="inline-flex items-center gap-1 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                        >
                          {label}
                          <ArrowUpDown className="w-3 h-3 opacity-60" />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSalespeople.length === 0 ? (
                    <tr>
                      <td colSpan={canSeeProfit ? 11 : 10} className="px-4 py-6 text-center text-slate-500">
                        No salesperson records match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSalespeople.map((row) => (
                      <tr
                        key={row.staffId}
                        onClick={() => onNavigateSection('sales', { search: row.staffName })}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                      >
                        <td className="px-3 py-2.5 font-semibold text-slate-950 dark:text-white whitespace-nowrap">
                          {row.staffName}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{row.department}</td>
                        <td className="px-3 py-2.5 tabular-nums">{row.assignedLeads}</td>
                        <td className="px-3 py-2.5 tabular-nums">{row.contactedLeads}</td>
                        <td className="px-3 py-2.5 tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                          {row.convertedLeads}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-bold">{row.confirmedSales}</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold text-slate-950 dark:text-white">
                          {fmt(row.revenueUsd)}
                        </td>
                        {canSeeProfit && (
                          <td className="px-3 py-2.5 tabular-nums text-emerald-700 dark:text-emerald-400">
                            {fmt(row.profitUsd)}
                          </td>
                        )}
                        <td className="px-3 py-2.5 tabular-nums text-slate-600 dark:text-slate-400">
                          {row.monthlyTargetUsd > 0 ? fmt(row.monthlyTargetUsd) : '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-bold">
                          {row.achievementPct !== null ? (
                            <span
                              className={
                                row.achievementPct >= 100
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : row.achievementPct >= 60
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {row.achievementPct}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {row.pendingFollowUps > 0 ? (
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              {row.pendingFollowUps}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* CRM SALES PIPELINE & FOLLOW-UPS */}
      {/* ===================================================================== */}
      {showCrmPipeline && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                  CRM Sales Pipeline & Follow-Up Queue
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click any pipeline stage to open CRM & Leads filtered to that stage
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('crm')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
            >
              Open CRM Module <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 7-Stage Pipeline Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2.5">
            {analytics.crmPipeline.map((stage) => (
              <button
                key={stage.id}
                type="button"
                onClick={() => onNavigateSection('crm', { filter: stage.filterStatus })}
                className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/70 dark:hover:border-amber-500/70 bg-slate-50/50 dark:bg-slate-950/40 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 truncate">
                    {stage.label}
                  </span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                </div>
                <div className="text-2xl font-bold text-slate-950 dark:text-white tabular-nums mt-2">
                  {stage.count}
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {stage.estimatedValueUsd > 0 ? fmt(stage.estimatedValueUsd) : 'No value est.'}
                </div>
              </button>
            ))}
          </div>

          {/* Upcoming & Overdue Follow-Ups */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Upcoming & Overdue Follow-Ups ({analytics.followUps.length})
                </h4>
              </div>
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                {analytics.followUps.filter((f) => f.isOverdue).length} overdue
              </span>
            </div>

            {analytics.followUps.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 text-center">
                No pending or overdue follow-ups in the CRM queue.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Customer / Action</th>
                      <th className="px-3 py-2">Assigned Employee</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2">Scheduled Date</th>
                      <th className="px-3 py-2 text-right">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {analytics.followUps.slice(0, 8).map((f) => (
                      <tr
                        key={f.id}
                        onClick={() => onNavigateSection(f.source === 'task' ? 'reports' : 'crm')}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                      >
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-950 dark:text-white">{f.customerName}</div>
                          <div className="text-[11px] text-slate-500">{f.company}</div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {f.assignedEmployee}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`text-[11px] font-bold uppercase ${
                              f.priority === 'urgent' || f.priority === 'high'
                                ? 'text-rose-600 dark:text-rose-400'
                                : f.priority === 'medium'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {f.priority}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono">
                          <span
                            className={
                              f.isOverdue
                                ? 'text-rose-600 dark:text-rose-400 font-bold'
                                : 'text-slate-700 dark:text-slate-300'
                            }
                          >
                            {f.scheduledDate} {f.isOverdue ? '· OVERDUE' : ''}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-500">{f.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
