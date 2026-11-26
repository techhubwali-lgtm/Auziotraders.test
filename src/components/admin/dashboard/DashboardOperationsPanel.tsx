import {
  AlertTriangle,
  Anchor,
  ArrowUpDown,
  Car,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Globe,
  Package,
  RefreshCw,
  Search,
  Ship,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { getVesselFreshness } from '../../../services/vesselTrackingService';
import type {
  AisServiceStatusResponse,
  CurrencyCode,
  ExportOrder,
  FinanceRecord,
  Quotation,
  RegisteredVessel,
  UserProfile,
  Vehicle,
} from '../../../types/portal';
import { VesselLeafletMap } from '../../VesselLeafletMap';
import {
  formatOrderHistoricalAmount,
  getOrderDateMs,
  type ComputedDashboardAnalytics,
} from './dashboardMetrics';

interface DashboardOperationsPanelProps {
  analytics: ComputedDashboardAnalytics;
  orders: ExportOrder[];
  vehicles: Vehicle[];
  users: UserProfile[];
  quotations: Quotation[];
  financeRecords: FinanceRecord[];
  vessels: RegisteredVessel[];
  aisStatus: AisServiceStatusResponse | null;
  currency: CurrencyCode;
  fxRates: Record<string, number>;
  showRecentOrders: boolean;
  showLogistics: boolean;
  onRefreshAis: () => Promise<void>;
  onNavigateSection: (section: string, opts?: { filter?: string; search?: string }) => void;
}

const PAGE_SIZE = 8;

export function DashboardOperationsPanel({
  analytics,
  orders,
  vehicles,
  users,
  quotations,
  vessels,
  aisStatus,
  currency,
  fxRates,
  showRecentOrders,
  showLogistics,
  onRefreshAis,
  onNavigateSection,
}: DashboardOperationsPanelProps) {
  // Recent Orders table state
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [shippingFilter, setShippingFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'orderNumber'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [inspectOrder, setInspectOrder] = useState<ExportOrder | null>(null);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [refreshingAis, setRefreshingAis] = useState(false);

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const vehicleByStock = useMemo(() => new Map(vehicles.map((v) => [v.stockCode, v])), [vehicles]);
  const quoteById = useMemo(() => new Map(quotations.map((q) => [q.id, q])), [quotations]);
  const userById = useMemo(() => new Map(users.map((u) => [u.uid, u])), [users]);

  const enrichedOrders = useMemo(() => {
    return analytics.orderDerived.map(({ order, statuses }) => {
      const vehicle = vehicleById.get(order.vehicleId) || vehicleByStock.get(order.vehicleStockCode);
      const quote = order.quotationId ? quoteById.get(order.quotationId) : undefined;
      const customer = userById.get(order.customerId);
      const salesperson = quote?.preparedByName || customer?.assignedRepName || 'Export Desk';
      const dateMs = getOrderDateMs(order);
      return {
        order,
        statuses,
        vehicle,
        salesperson,
        chassisCode: vehicle?.chassisCode || order.vehicleStockCode || '—',
        thumbnail: vehicle?.images?.[0] || '',
        dateMs,
        dateLabel: dateMs ? new Date(dateMs).toISOString().slice(0, 10) : '—',
      };
    });
  }, [analytics.orderDerived, vehicleById, vehicleByStock, quoteById, userById]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedOrders
      .filter((row) => {
        if (paymentFilter !== 'ALL' && row.statuses.paymentStatus !== paymentFilter) return false;
        if (orderStatusFilter !== 'ALL' && row.statuses.orderStatus !== orderStatusFilter) return false;
        if (shippingFilter !== 'ALL' && row.statuses.shippingStatus !== shippingFilter) return false;
        if (q) {
          const hay =
            `${row.order.orderNumber} ${row.order.trackingCode} ${row.order.customerName} ${row.order.customerCompany} ${row.order.vehicleTitle} ${row.chassisCode} ${row.salesperson} ${row.order.destinationCountry} ${row.order.destinationPortName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'amount') {
          return sortDir === 'desc'
            ? b.order.totalCifUsd - a.order.totalCifUsd
            : a.order.totalCifUsd - b.order.totalCifUsd;
        }
        if (sortBy === 'orderNumber') {
          return sortDir === 'desc'
            ? b.order.orderNumber.localeCompare(a.order.orderNumber)
            : a.order.orderNumber.localeCompare(b.order.orderNumber);
        }
        return sortDir === 'desc' ? b.dateMs - a.dateMs : a.dateMs - b.dateMs;
      });
  }, [enrichedOrders, search, paymentFilter, orderStatusFilter, shippingFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = filteredOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (col: 'date' | 'amount' | 'orderNumber') => {
    if (sortBy === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const handleRefreshAis = async () => {
    setRefreshingAis(true);
    try {
      await onRefreshAis();
    } finally {
      setRefreshingAis(false);
    }
  };

  const statusTone = (status: string) => {
    if (['Paid', 'Completed', 'Delivered', 'Arrived'].includes(status)) {
      return 'text-emerald-700 dark:text-emerald-400';
    }
    if (['Overdue', 'Delayed'].includes(status)) {
      return 'text-rose-600 dark:text-rose-400';
    }
    if (['In Transit', 'Confirmed', 'Deposit Paid', 'In Progress'].includes(status)) {
      return 'text-sky-700 dark:text-sky-400';
    }
    return 'text-amber-600 dark:text-amber-400';
  };

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* RECENT ORDERS TABLE */}
      {/* ===================================================================== */}
      {showRecentOrders && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                  Recent Export Orders ({filteredOrders.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Payment, Order, and Shipping statuses tracked independently · Historical FX locked on confirmed invoices
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('orders')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 hover:opacity-90 rounded-lg cursor-pointer"
            >
              View All Orders ({orders.length}) <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search order ID, customer, vehicle, chassis, country..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="ALL">Payment: All</option>
              <option value="Paid">Paid</option>
              <option value="Deposit Paid">Deposit Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
            </select>

            <select
              value={orderStatusFilter}
              onChange={(e) => {
                setOrderStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="ALL">Order: All</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>

            <select
              value={shippingFilter}
              onChange={(e) => {
                setShippingFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="ALL">Shipping: All</option>
              <option value="Not Booked">Not Booked</option>
              <option value="Awaiting Shipment">Awaiting Shipment</option>
              <option value="In Transit">In Transit</option>
              <option value="Arrived">Arrived</option>
              <option value="Delivered">Delivered</option>
              <option value="Delayed">Delayed</option>
            </select>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort('orderNumber')}
                      className="inline-flex items-center gap-1 cursor-pointer"
                    >
                      Order ID <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Vehicle & Chassis</th>
                  <th className="px-3 py-2.5">Salesperson</th>
                  <th className="px-3 py-2.5">Destination</th>
                  <th className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('amount')}
                      className="inline-flex items-center gap-1 cursor-pointer"
                    >
                      Amount <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5">Payment</th>
                  <th className="px-3 py-2.5">Order</th>
                  <th className="px-3 py-2.5">Shipping</th>
                  <th className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort('date')}
                      className="inline-flex items-center gap-1 cursor-pointer"
                    >
                      Date <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pagedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                      No orders found matching your filters.
                    </td>
                  </tr>
                ) : (
                  pagedOrders.map((row) => {
                    const amt = formatOrderHistoricalAmount(row.order, currency, fxRates);
                    return (
                      <tr key={row.order.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-950 dark:text-white whitespace-nowrap">
                          {row.order.orderNumber}
                          <div className="text-[10px] font-normal text-slate-500">{row.order.trackingCode}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {row.order.customerName}
                          </div>
                          {row.order.customerCompany && (
                            <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                              {row.order.customerCompany}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {row.thumbnail ? (
                              <img
                                src={row.thumbnail}
                                alt={row.order.vehicleTitle}
                                className="w-10 h-8 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                <Car className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                                {row.order.vehicleTitle}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500">{row.chassisCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {row.salesperson}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <div>{row.order.destinationCountry || '—'}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                            {row.order.destinationPortName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="font-bold tabular-nums text-slate-950 dark:text-white">
                            {amt.primary}
                          </div>
                          {amt.lockedNote && (
                            <div className="text-[10px] text-slate-500 font-mono">{amt.lockedNote}</div>
                          )}
                        </td>
                        <td className={`px-3 py-2.5 font-semibold whitespace-nowrap ${statusTone(row.statuses.paymentStatus)}`}>
                          {row.statuses.paymentStatus}
                        </td>
                        <td className={`px-3 py-2.5 font-semibold whitespace-nowrap ${statusTone(row.statuses.orderStatus)}`}>
                          {row.statuses.orderStatus}
                        </td>
                        <td className={`px-3 py-2.5 font-semibold whitespace-nowrap ${statusTone(row.statuses.shippingStatus)}`}>
                          {row.statuses.shippingStatus}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                          {row.dateLabel}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectOrder(row.order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredOrders.length)} of{' '}
                {filteredOrders.length} orders
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono font-semibold text-slate-900 dark:text-white">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* LOGISTICS & GLOBAL BUSINESS OVERVIEW */}
      {/* ===================================================================== */}
      {showLogistics && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                  Logistics & Global Export Operations
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real AIS vessel telemetry & destination port throughput · Last AIS sync:{' '}
                <span className="font-mono">
                  {aisStatus?.lastSyncAt ? new Date(aisStatus.lastSyncAt).toLocaleString() : 'Not synced yet'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleRefreshAis()}
                disabled={refreshingAis}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingAis ? 'animate-spin' : ''}`} />
                Sync AIS
              </button>
              <button
                type="button"
                onClick={() => onNavigateSection('logistics')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                Open Logistics <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Satellite Vessel Map + Country & Port Export Stats */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
              <VesselLeafletMap
                vessels={vessels}
                selectedVesselId={selectedVesselId}
                onSelectVessel={(id) => setSelectedVesselId(id)}
                heightClass="h-[340px]"
              />
            </div>

            <div className="space-y-4">
              {/* Quick Logistics Counters */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Upcoming ETD</div>
                  <div className="text-xl font-bold text-slate-950 dark:text-white tabular-nums mt-0.5">
                    {analytics.upcomingDepartures.length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Upcoming ETA</div>
                  <div className="text-xl font-bold text-sky-700 dark:text-sky-400 tabular-nums mt-0.5">
                    {analytics.upcomingArrivals.length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Active Vessels</div>
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                    {vessels.length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Delayed Units</div>
                  <div
                    className={`text-xl font-bold tabular-nums mt-0.5 ${
                      analytics.delayedShipments.length > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {analytics.delayedShipments.length}
                  </div>
                </div>
              </div>

              {/* Destination Port Statistics */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2.5">
                  <Anchor className="w-3.5 h-3.5 text-amber-600" />
                  Destination Port Volume
                </div>
                {analytics.portStatistics.length === 0 ? (
                  <p className="text-xs text-slate-500">No active destination ports yet.</p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto text-xs">
                    {analytics.portStatistics.slice(0, 6).map((p) => (
                      <div
                        key={p.portName}
                        className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">{p.portName}</div>
                          <div className="text-[10px] text-slate-500">
                            {p.inTransit} in transit{p.delayed > 0 ? ` · ${p.delayed} delayed` : ''}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-slate-950 dark:text-white shrink-0">
                          {p.shipments}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active Vessel & Shipment Telemetry Schedule */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Ship className="w-4 h-4 text-slate-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Registered Vessels & Active Shipment Schedule
                </h4>
              </div>
              <span className="text-[11px] text-slate-500">
                Only verified AIS or coordinator-logged positions displayed
              </span>
            </div>

            {vessels.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 text-center">
                No vessels registered in Firestore yet. Register vessels in Logistics or API Integrations.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Vessel / MMSI</th>
                      <th className="px-3 py-2">Departure Port</th>
                      <th className="px-3 py-2">Destination Port</th>
                      <th className="px-3 py-2">ETD / ETA</th>
                      <th className="px-3 py-2">Latest Tracking Position</th>
                      <th className="px-3 py-2">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {vessels.slice(0, 8).map((v) => {
                      const freshness = getVesselFreshness(v);
                      const linkedOrders = orders.filter(
                        (o) =>
                          o.vesselId === v.id ||
                          o.vesselMmsi === v.mmsi ||
                          (o.vesselName && o.vesselName.toLowerCase() === v.name.toLowerCase())
                      );
                      const etd = linkedOrders.find((o) => o.etdDate)?.etdDate || '—';
                      const eta = v.etaManual || v.etaReported || linkedOrders.find((o) => o.etaDate)?.etaDate || '—';
                      return (
                        <tr
                          key={v.id}
                          onClick={() => setSelectedVesselId(v.id)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                        >
                          <td className="px-3 py-2.5">
                            <div className="font-bold text-slate-950 dark:text-white">{v.name}</div>
                            <div className="text-[10px] font-mono text-slate-500">
                              MMSI {v.mmsi} {v.voyageNumber ? `· Voy ${v.voyageNumber}` : ''}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                            {v.originPort || 'Japan Export Port'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                            {v.destinationPort || v.aisDestination || '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px]">
                            <div>ETD: {etd}</div>
                            <div className="text-slate-500">ETA: {eta}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            {typeof v.latitude === 'number' && typeof v.longitude === 'number' ? (
                              <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200">
                                {v.latitude.toFixed(3)}, {v.longitude.toFixed(3)}
                                {v.speedKnots !== null ? ` · ${v.speedKnots} kn` : ''}
                              </div>
                            ) : v.manualLocationNote ? (
                              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                                Coordinator note: {v.manualLocationNote}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">No live AIS fix received</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[11px]">
                            <div
                              className={`font-semibold ${
                                freshness.status === 'live'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : freshness.status === 'stale'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {freshness.label}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {v.lastAisUpdateAt
                                ? new Date(v.lastAisUpdateAt).toLocaleString()
                                : v.manualUpdatedAt
                                ? new Date(v.manualUpdatedAt).toLocaleString()
                                : 'Awaiting feed'}
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
        </section>
      )}

      {/* Order Quick-Inspect Modal */}
      {inspectOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">
                  {inspectOrder.orderNumber} · {inspectOrder.trackingCode}
                </div>
                <h4 className="text-base font-bold text-slate-950 dark:text-white mt-0.5">
                  {inspectOrder.vehicleTitle}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setInspectOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="text-slate-500">Customer</div>
                <div className="font-semibold text-slate-950 dark:text-white mt-0.5">
                  {inspectOrder.customerName}
                </div>
                <div className="text-slate-500">{inspectOrder.customerCompany}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="text-slate-500">Destination</div>
                <div className="font-semibold text-slate-950 dark:text-white mt-0.5">
                  {inspectOrder.destinationPortName}
                </div>
                <div className="text-slate-500 uppercase">{inspectOrder.shippingMethod}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="text-slate-500">Order CIF Value</div>
                <div className="font-bold text-slate-950 dark:text-white tabular-nums mt-0.5">
                  {formatOrderHistoricalAmount(inspectOrder, currency, fxRates).primary}
                </div>
                {inspectOrder.lockedExchangeRate && (
                  <div className="text-[10px] text-slate-500 font-mono">
                    Locked Rate: {inspectOrder.lockedExchangeRate} ({inspectOrder.lockedCurrency})
                  </div>
                )}
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="text-slate-500">Vessel & Schedule</div>
                <div className="font-semibold text-slate-950 dark:text-white mt-0.5">
                  {inspectOrder.vesselName || 'Not assigned'}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  ETD {inspectOrder.etdDate || '—'} · ETA {inspectOrder.etaDate || '—'}
                </div>
              </div>
            </div>
            {inspectOrder.etaDate &&
              new Date(inspectOrder.etaDate).getTime() < Date.now() &&
              !['arrived_port', 'completed'].includes(inspectOrder.milestone) && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Shipment ETA has passed without arrival confirmation. Review in Logistics.
                </div>
              )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInspectOrder(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const num = inspectOrder.orderNumber;
                  setInspectOrder(null);
                  onNavigateSection('orders', { search: num });
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
              >
                Manage in Orders Module
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
