import { formatMoney } from '../../../data/ports';
import type {
  CompanySettings,
  CurrencyCode,
  ExportDocument,
  ExportOrder,
  FinanceRecord,
  HrEmployee,
  HrLeaveRequest,
  Inquiry,
  Quotation,
  RegisteredVessel,
  SalesTarget,
  SourcingRequest,
  TeamTask,
  TradeOrderMilestone,
  UserProfile,
  Vehicle,
} from '../../../types/portal';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'custom';

export interface ResolvedDateRange {
  preset: DateRangePreset;
  label: string;
  prevLabel: string;
  startMs: number;
  endMs: number;
  prevStartMs: number;
  prevEndMs: number;
  bucketUnit: 'hour' | 'day' | 'month';
}

export interface KpiMetricItem {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  previousValue: number | null;
  deltaPct: number | null;
  deltaHint?: string;
  sparkline: number[];
  targetSection: string;
  filterKey?: string;
  tone?: 'default' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'sky';
  restricted?: boolean;
  emptyNote?: string;
}

export interface SalespersonPerformanceRow {
  staffId: string;
  staffName: string;
  staffEmail: string;
  department: string;
  assignedLeads: number;
  contactedLeads: number;
  convertedLeads: number;
  confirmedSales: number;
  revenueUsd: number;
  profitUsd: number;
  monthlyTargetUsd: number;
  achievementPct: number | null;
  pendingFollowUps: number;
}

export interface CrmPipelineStage {
  id: string;
  label: string;
  count: number;
  estimatedValueUsd: number;
  filterStatus: string;
  color: string;
}

export interface FollowUpItem {
  id: string;
  customerName: string;
  company: string;
  assignedEmployee: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledDate: string;
  isOverdue: boolean;
  source: 'inquiry' | 'sourcing' | 'task';
  reference: string;
}

export interface OrderPaymentShippingStatus {
  paymentStatus: 'Paid' | 'Deposit Paid' | 'Overdue' | 'Pending';
  orderStatus: 'Pending' | 'Confirmed' | 'In Progress' | 'Completed';
  shippingStatus: 'Not Booked' | 'Awaiting Shipment' | 'In Transit' | 'Arrived' | 'Delivered' | 'Delayed';
}

const DAY_MS = 86400000;

export function parseRecordDateMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof obj.toMillis === 'function') {
      try {
        return obj.toMillis();
      } catch {
        return 0;
      }
    }
    if (typeof obj.seconds === 'number') return obj.seconds * 1000;
    if (typeof obj._seconds === 'number') return obj._seconds * 1000;
  }
  return 0;
}

export function resolveDateRange(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
): ResolvedDateRange {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + DAY_MS - 1;

  if (preset === 'today') {
    return {
      preset,
      label: 'Today',
      prevLabel: 'Yesterday',
      startMs: startOfToday,
      endMs: endOfToday,
      prevStartMs: startOfToday - DAY_MS,
      prevEndMs: startOfToday - 1,
      bucketUnit: 'hour',
    };
  }

  if (preset === 'yesterday') {
    return {
      preset,
      label: 'Yesterday',
      prevLabel: 'Day Before',
      startMs: startOfToday - DAY_MS,
      endMs: startOfToday - 1,
      prevStartMs: startOfToday - 2 * DAY_MS,
      prevEndMs: startOfToday - DAY_MS - 1,
      bucketUnit: 'hour',
    };
  }

  if (preset === 'this_week') {
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
    const startMs = startOfToday - dayOfWeek * DAY_MS;
    const endMs = endOfToday;
    const span = Math.max(DAY_MS, endMs - startMs);
    return {
      preset,
      label: 'This Week',
      prevLabel: 'Last Week',
      startMs,
      endMs,
      prevStartMs: startMs - 7 * DAY_MS,
      prevEndMs: startMs - 7 * DAY_MS + span,
      bucketUnit: 'day',
    };
  }

  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
    return {
      preset,
      label: 'Last Month',
      prevLabel: 'Prior Month',
      startMs: start.getTime(),
      endMs: end.getTime(),
      prevStartMs: prevStart.getTime(),
      prevEndMs: prevEnd.getTime(),
      bucketUnit: 'day',
    };
  }

  if (preset === 'this_quarter') {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), qStartMonth, 1);
    const prevStart = new Date(now.getFullYear(), qStartMonth - 3, 1);
    const prevEnd = new Date(now.getFullYear(), qStartMonth, 0, 23, 59, 59, 999);
    return {
      preset,
      label: 'This Quarter',
      prevLabel: 'Last Quarter',
      startMs: start.getTime(),
      endMs: endOfToday,
      prevStartMs: prevStart.getTime(),
      prevEndMs: prevEnd.getTime(),
      bucketUnit: 'month',
    };
  }

  if (preset === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const prevStart = new Date(now.getFullYear() - 1, 0, 1);
    const prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return {
      preset,
      label: 'This Year',
      prevLabel: 'Last Year',
      startMs: start.getTime(),
      endMs: endOfToday,
      prevStartMs: prevStart.getTime(),
      prevEndMs: prevEnd.getTime(),
      bucketUnit: 'month',
    };
  }

  if (preset === 'custom' && customStart && customEnd) {
    const s = Date.parse(`${customStart}T00:00:00`);
    const e = Date.parse(`${customEnd}T23:59:59.999`);
    if (Number.isFinite(s) && Number.isFinite(e) && e >= s) {
      const span = Math.max(DAY_MS, e - s);
      return {
        preset,
        label: `${customStart} to ${customEnd}`,
        prevLabel: 'Prior Period',
        startMs: s,
        endMs: e,
        prevStartMs: s - span - 1,
        prevEndMs: s - 1,
        bucketUnit: span > 90 * DAY_MS ? 'month' : span <= 2 * DAY_MS ? 'hour' : 'day',
      };
    }
  }

  // Default: this_month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return {
    preset: 'this_month',
    label: 'This Month',
    prevLabel: 'Last Month',
    startMs: start.getTime(),
    endMs: endOfToday,
    prevStartMs: prevStart.getTime(),
    prevEndMs: prevEnd.getTime(),
    bucketUnit: 'day',
  };
}

export function isInRange(ms: number, startMs: number, endMs: number): boolean {
  if (ms <= 0) return false;
  return ms >= startMs && ms <= endMs;
}

export function calcDeltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}

export function buildSparkline(
  records: Array<{ ms: number; value: number }>,
  startMs: number,
  endMs: number,
  points = 8
): number[] {
  const valid = records.filter((r) => r.ms >= startMs && r.ms <= endMs);
  if (valid.length === 0) return [];
  const span = Math.max(1, endMs - startMs);
  const buckets = new Array<number>(points).fill(0);
  for (const r of valid) {
    const idx = Math.min(points - 1, Math.max(0, Math.floor(((r.ms - startMs) / span) * points)));
    buckets[idx] += r.value;
  }
  return buckets;
}

export function formatOrderHistoricalAmount(
  order: ExportOrder,
  displayCurrency: CurrencyCode,
  fxRates: Record<string, number>
): { primary: string; lockedNote?: string } {
  const lockedRate = order.lockedExchangeRate;
  const lockedCurr = order.lockedCurrency || order.currency;
  if (typeof lockedRate === 'number' && lockedRate > 0 && lockedCurr) {
    const lockedAmount = Math.round(order.totalCifUsd * lockedRate);
    if (lockedCurr === displayCurrency) {
      return {
        primary: formatMoney(order.totalCifUsd, lockedCurr, { ...fxRates, [lockedCurr]: lockedRate }),
        lockedNote: `Locked FX (${lockedCurr})`,
      };
    }
    return {
      primary: formatMoney(order.totalCifUsd, displayCurrency, fxRates),
      lockedNote: `Invoice locked: ${lockedCurr} ${lockedAmount.toLocaleString()}`,
    };
  }
  return {
    primary: formatMoney(order.totalCifUsd, displayCurrency, fxRates),
  };
}

export function getOrderDateMs(order: ExportOrder): number {
  const c = parseRecordDateMs(order.createdAt);
  if (c > 0) return c;
  const u = parseRecordDateMs(order.updatedAt);
  if (u > 0) return u;
  return parseRecordDateMs(order.etdDate);
}

export function getFinanceDateMs(rec: FinanceRecord): number {
  const tx = parseRecordDateMs(rec.transactionDate);
  if (tx > 0) return tx;
  return parseRecordDateMs(rec.createdAt);
}

const CONFIRMED_ORDER_MILESTONES: TradeOrderMilestone[] = [
  'customer_approved',
  'bid_placed',
  'vehicle_purchased',
  'payment_pending',
  'payment_received',
  'vehicle_in_yard',
  'export_docs_ready',
  'shipment_booked',
  'shipped',
  'arrived_port',
  'completed',
];

const PAID_MILESTONES: TradeOrderMilestone[] = [
  'payment_received',
  'vehicle_in_yard',
  'export_docs_ready',
  'shipment_booked',
  'shipped',
  'arrived_port',
  'completed',
];

export function deriveOrderStatuses(
  order: ExportOrder,
  financeRecords: FinanceRecord[],
  nowMs: number = Date.now()
): OrderPaymentShippingStatus {
  const relatedFin = financeRecords.filter(
    (f) => f.orderId === order.id || (order.orderNumber && f.orderNumber === order.orderNumber)
  );
  const hasOverdueInv = relatedFin.some((f) => f.type === 'invoice' && f.status === 'overdue');
  const paidSum = relatedFin
    .filter((f) => f.type === 'payment' && (f.status === 'paid' || f.status === 'reconciled'))
    .reduce((s, f) => s + f.amountUsd, 0);

  let paymentStatus: OrderPaymentShippingStatus['paymentStatus'] = 'Pending';
  if (hasOverdueInv) {
    paymentStatus = 'Overdue';
  } else if (
    paidSum >= order.totalCifUsd * 0.95 ||
    (order.totalCifUsd > 0 && PAID_MILESTONES.includes(order.milestone))
  ) {
    paymentStatus = 'Paid';
  } else if (paidSum > 0) {
    paymentStatus = 'Deposit Paid';
  }

  let orderStatus: OrderPaymentShippingStatus['orderStatus'] = 'Pending';
  if (order.milestone === 'completed') {
    orderStatus = 'Completed';
  } else if (
    ['vehicle_in_yard', 'export_docs_ready', 'shipment_booked', 'shipped', 'arrived_port'].includes(
      order.milestone
    )
  ) {
    orderStatus = 'In Progress';
  } else if (CONFIRMED_ORDER_MILESTONES.includes(order.milestone)) {
    orderStatus = 'Confirmed';
  }

  const etaMs = parseRecordDateMs(order.etaDate);
  const isDelayed =
    etaMs > 0 &&
    etaMs < nowMs &&
    !['arrived_port', 'completed'].includes(order.milestone);

  let shippingStatus: OrderPaymentShippingStatus['shippingStatus'] = 'Not Booked';
  if (isDelayed) {
    shippingStatus = 'Delayed';
  } else if (order.milestone === 'completed') {
    shippingStatus = 'Delivered';
  } else if (order.milestone === 'arrived_port') {
    shippingStatus = 'Arrived';
  } else if (order.milestone === 'shipped') {
    shippingStatus = 'In Transit';
  } else if (
    ['vehicle_in_yard', 'export_docs_ready', 'shipment_booked'].includes(order.milestone)
  ) {
    shippingStatus = 'Awaiting Shipment';
  }

  return { paymentStatus, orderStatus, shippingStatus };
}

export interface DashboardComputationInput {
  range: ResolvedDateRange;
  currency: CurrencyCode;
  fxRates: Record<string, number>;
  canSeeProfit: boolean;
  canSeeAccounts: boolean;
  canSeeHr: boolean;
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
}

export function computeDashboardAnalytics(input: DashboardComputationInput) {
  const {
    range,
    currency,
    fxRates,
    canSeeProfit,
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
  } = input;

  const fmt = (usd: number) => formatMoney(usd, currency, fxRates);
  const nowMs = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter helpers for selected & previous period
  // Records without timestamps (e.g., older legacy docs) are included in cumulative counts,
  // while dated records respond strictly to the selected period.
  const orderDated = orders.map((o) => ({ item: o, ms: getOrderDateMs(o) }));
  const finDated = financeRecords.map((f) => ({ item: f, ms: getFinanceDateMs(f) }));
  const inqDated = inquiries.map((i) => ({ item: i, ms: parseRecordDateMs(i.createdAt) }));
  const quoteDated = quotations.map((q) => ({ item: q, ms: parseRecordDateMs(q.createdAt) }));
  const srDated = sourcingRequests.map((s) => ({ item: s, ms: parseRecordDateMs(s.createdAt) }));
  const userDated = users.map((u) => ({ item: u, ms: parseRecordDateMs(u.createdAt) }));

  const ordersInPeriod = orderDated
    .filter((d) => isInRange(d.ms, range.startMs, range.endMs))
    .map((d) => d.item);
  const ordersPrevPeriod = orderDated
    .filter((d) => isInRange(d.ms, range.prevStartMs, range.prevEndMs))
    .map((d) => d.item);

  const finInPeriod = finDated
    .filter((d) => isInRange(d.ms, range.startMs, range.endMs))
    .map((d) => d.item);
  const finPrevPeriod = finDated
    .filter((d) => isInRange(d.ms, range.prevStartMs, range.prevEndMs))
    .map((d) => d.item);

  const inqInPeriod = inqDated
    .filter((d) => isInRange(d.ms, range.startMs, range.endMs))
    .map((d) => d.item);
  const inqPrevPeriod = inqDated
    .filter((d) => isInRange(d.ms, range.prevStartMs, range.prevEndMs))
    .map((d) => d.item);

  const quotesInPeriod = quoteDated
    .filter((d) => isInRange(d.ms, range.startMs, range.endMs))
    .map((d) => d.item);
  const quotesPrevPeriod = quoteDated
    .filter((d) => isInRange(d.ms, range.prevStartMs, range.prevEndMs))
    .map((d) => d.item);

  const srInPeriod = srDated
    .filter((d) => isInRange(d.ms, range.startMs, range.endMs))
    .map((d) => d.item);

  const customers = users.filter((u) => u.role === 'customer' || u.role === 'dealer');
  const newCustomersInPeriod = userDated.filter(
    (d) =>
      (d.item.role === 'customer' || d.item.role === 'dealer') &&
      isInRange(d.ms, range.startMs, range.endMs)
  ).length;
  const newCustomersPrevPeriod = userDated.filter(
    (d) =>
      (d.item.role === 'customer' || d.item.role === 'dealer') &&
      isInRange(d.ms, range.prevStartMs, range.prevEndMs)
  ).length;

  // =========================================================================
  // 1. FINANCIAL CALCULATIONS (Honest, Accounting-Separated)
  // =========================================================================
  const calcPeriodFinancials = (periodOrders: ExportOrder[], periodFin: FinanceRecord[]) => {
    const orderRevenue = periodOrders
      .filter((o) => CONFIRMED_ORDER_MILESTONES.includes(o.milestone))
      .reduce((s, o) => s + (o.totalCifUsd || 0), 0);
    const invoiceRevenue = periodFin
      .filter((f) => f.type === 'invoice')
      .reduce((s, f) => s + (f.amountUsd || 0), 0);
    // Recognized revenue: use invoices if recorded, else confirmed export orders (avoid double counting)
    const recognizedRevenue = Math.max(orderRevenue, invoiceRevenue);

    const verifiedPayments = periodFin
      .filter((f) => f.type === 'payment' && (f.status === 'paid' || f.status === 'reconciled'))
      .reduce((s, f) => s + (f.amountUsd || 0), 0);

    const totalExpenses = periodFin
      .filter((f) => f.type === 'expense')
      .reduce((s, f) => s + (f.amountUsd || 0), 0);

    // Direct vehicle COGS from confirmed orders' FOB/freight where available, or direct auction/shipping expenses
    const directCostExpenses = periodFin
      .filter(
        (f) =>
          f.type === 'expense' &&
          /auction|vehicle|freight|shipping|yard|inspect|port|transport|purchase/i.test(f.category)
      )
      .reduce((s, f) => s + (f.amountUsd || 0), 0);

    const grossProfit = Math.max(0, recognizedRevenue - directCostExpenses);
    const netProfit = recognizedRevenue - totalExpenses;

    return {
      recognizedRevenue,
      verifiedPayments,
      totalExpenses,
      grossProfit,
      netProfit,
    };
  };

  const currFin = calcPeriodFinancials(ordersInPeriod, finInPeriod);
  const prevFin = calcPeriodFinancials(ordersPrevPeriod, finPrevPeriod);

  // Point-in-time balance sheet metrics (across all active ledger records)
  const customerDepositsUsd = financeRecords
    .filter(
      (f) =>
        f.type === 'payment' &&
        /deposit|advance|booking/i.test(`${f.category} ${f.notes}`) &&
        (f.status === 'paid' || f.status === 'reconciled')
    )
    .reduce((s, f) => s + f.amountUsd, 0);

  const outstandingCustomerBalancesUsd = financeRecords
    .filter((f) => f.type === 'invoice' && (f.status === 'pending' || f.status === 'overdue'))
    .reduce((s, f) => s + f.amountUsd, 0);

  const outstandingSupplierPaymentsUsd = financeRecords
    .filter((f) => f.type === 'expense' && (f.status === 'pending' || f.status === 'overdue'))
    .reduce((s, f) => s + f.amountUsd, 0);

  const overdueInvoicesList = financeRecords.filter(
    (f) => f.type === 'invoice' && f.status === 'overdue'
  );
  const overdueInvoicesAmountUsd = overdueInvoicesList.reduce((s, f) => s + f.amountUsd, 0);

  const totalVerifiedInflowAllTime = financeRecords
    .filter((f) => f.type === 'payment' && (f.status === 'paid' || f.status === 'reconciled'))
    .reduce((s, f) => s + f.amountUsd, 0);
  const totalPaidExpensesAllTime = financeRecords
    .filter((f) => f.type === 'expense' && (f.status === 'paid' || f.status === 'reconciled'))
    .reduce((s, f) => s + f.amountUsd, 0);
  const availableBankCashUsd = totalVerifiedInflowAllTime - totalPaidExpensesAllTime;

  const revSpark = buildSparkline(
    [
      ...orderDated
        .filter((d) => CONFIRMED_ORDER_MILESTONES.includes(d.item.milestone))
        .map((d) => ({ ms: d.ms, value: d.item.totalCifUsd })),
    ],
    range.startMs,
    range.endMs
  );
  const paySpark = buildSparkline(
    finDated
      .filter((d) => d.item.type === 'payment' && (d.item.status === 'paid' || d.item.status === 'reconciled'))
      .map((d) => ({ ms: d.ms, value: d.item.amountUsd })),
    range.startMs,
    range.endMs
  );
  const expSpark = buildSparkline(
    finDated
      .filter((d) => d.item.type === 'expense')
      .map((d) => ({ ms: d.ms, value: d.item.amountUsd })),
    range.startMs,
    range.endMs
  );

  const financialKpis: KpiMetricItem[] = [
    {
      id: 'fin_total_revenue',
      label: 'Total Revenue',
      value: currFin.recognizedRevenue,
      formattedValue: fmt(currFin.recognizedRevenue),
      previousValue: prevFin.recognizedRevenue,
      deltaPct: calcDeltaPct(currFin.recognizedRevenue, prevFin.recognizedRevenue),
      sparkline: revSpark,
      targetSection: 'accounts',
      tone: 'emerald',
    },
    {
      id: 'fin_verified_payments',
      label: 'Verified Payments Received',
      value: currFin.verifiedPayments,
      formattedValue: fmt(currFin.verifiedPayments),
      previousValue: prevFin.verifiedPayments,
      deltaPct: calcDeltaPct(currFin.verifiedPayments, prevFin.verifiedPayments),
      sparkline: paySpark,
      targetSection: 'accounts',
      tone: 'emerald',
    },
    {
      id: 'fin_gross_profit',
      label: 'Total Gross Profit',
      value: canSeeProfit ? currFin.grossProfit : 0,
      formattedValue: canSeeProfit ? fmt(currFin.grossProfit) : 'Restricted',
      previousValue: canSeeProfit ? prevFin.grossProfit : null,
      deltaPct: canSeeProfit ? calcDeltaPct(currFin.grossProfit, prevFin.grossProfit) : null,
      sparkline: canSeeProfit ? revSpark : [],
      targetSection: 'accounts',
      tone: 'indigo',
      restricted: !canSeeProfit,
    },
    {
      id: 'fin_net_profit',
      label: 'Total Net Profit',
      value: canSeeProfit ? currFin.netProfit : 0,
      formattedValue: canSeeProfit ? fmt(currFin.netProfit) : 'Restricted',
      previousValue: canSeeProfit ? prevFin.netProfit : null,
      deltaPct: canSeeProfit ? calcDeltaPct(currFin.netProfit, prevFin.netProfit) : null,
      sparkline: canSeeProfit ? revSpark : [],
      targetSection: 'accounts',
      tone: currFin.netProfit >= 0 ? 'emerald' : 'rose',
      restricted: !canSeeProfit,
    },
    {
      id: 'fin_total_expenses',
      label: 'Total Expenses',
      value: currFin.totalExpenses,
      formattedValue: fmt(currFin.totalExpenses),
      previousValue: prevFin.totalExpenses,
      deltaPct: calcDeltaPct(currFin.totalExpenses, prevFin.totalExpenses),
      sparkline: expSpark,
      targetSection: 'accounts',
      tone: 'amber',
    },
    {
      id: 'fin_receivables',
      label: 'Outstanding Customer Balances',
      value: outstandingCustomerBalancesUsd,
      formattedValue: fmt(outstandingCustomerBalancesUsd),
      previousValue: null,
      deltaPct: null,
      deltaHint: 'Open receivables',
      sparkline: [],
      targetSection: 'accounts',
      tone: outstandingCustomerBalancesUsd > 0 ? 'amber' : 'default',
    },
    {
      id: 'fin_payables',
      label: 'Outstanding Supplier Payments',
      value: outstandingSupplierPaymentsUsd,
      formattedValue: fmt(outstandingSupplierPaymentsUsd),
      previousValue: null,
      deltaPct: null,
      deltaHint: 'Unpaid expenses',
      sparkline: [],
      targetSection: 'accounts',
      tone: outstandingSupplierPaymentsUsd > 0 ? 'amber' : 'default',
    },
    {
      id: 'fin_overdue_invoices',
      label: 'Overdue Invoices',
      value: overdueInvoicesList.length,
      formattedValue: `${overdueInvoicesList.length} (${fmt(overdueInvoicesAmountUsd)})`,
      previousValue: null,
      deltaPct: null,
      deltaHint: overdueInvoicesList.length > 0 ? 'Immediate follow-up' : 'All current',
      sparkline: [],
      targetSection: 'accounts',
      tone: overdueInvoicesList.length > 0 ? 'rose' : 'emerald',
    },
    {
      id: 'fin_bank_cash',
      label: 'Available Bank & Cash Balance',
      value: canSeeProfit ? availableBankCashUsd : 0,
      formattedValue: canSeeProfit ? fmt(availableBankCashUsd) : 'Restricted',
      previousValue: null,
      deltaPct: null,
      deltaHint: 'Net reconciled cash position',
      sparkline: [],
      targetSection: 'accounts',
      tone: availableBankCashUsd >= 0 ? 'sky' : 'rose',
      restricted: !canSeeProfit,
    },
  ];

  // =========================================================================
  // 2. SALES OVERVIEW KPIs
  // =========================================================================
  const todayStartMs = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const monthStartMs = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const confirmedSalesInPeriod = ordersInPeriod.filter((o) =>
    CONFIRMED_ORDER_MILESTONES.includes(o.milestone)
  );
  const confirmedSalesPrev = ordersPrevPeriod.filter((o) =>
    CONFIRMED_ORDER_MILESTONES.includes(o.milestone)
  );
  const salesTodayCount = orderDated.filter(
    (d) => d.ms >= todayStartMs && CONFIRMED_ORDER_MILESTONES.includes(d.item.milestone)
  ).length;
  const salesThisMonthUsd = orderDated
    .filter((d) => d.ms >= monthStartMs && CONFIRMED_ORDER_MILESTONES.includes(d.item.milestone))
    .reduce((s, d) => s + d.item.totalCifUsd, 0);

  const monthlyTargetUsd = salesTargets.reduce((s, t) => s + (t.targetRevenueUsd || 0), 0);
  const achievedTargetUsd = Math.max(
    salesThisMonthUsd,
    salesTargets.reduce((s, t) => s + (t.achievedRevenueUsd || 0), 0)
  );
  const targetAchievementPct =
    monthlyTargetUsd > 0 ? Number(((achievedTargetUsd / monthlyTargetUsd) * 100).toFixed(1)) : null;

  const pendingQuotationsCount = quotations.filter(
    (q) => q.status === 'draft' || q.status === 'sent'
  ).length;

  const totalLeadsAllPeriod = inqInPeriod.length + srInPeriod.length;
  const convertedCountInPeriod =
    confirmedSalesInPeriod.length +
    inqInPeriod.filter((i) => ['deposit_confirmed', 'vessel_booked', 'shipped'].includes(i.status)).length;
  const conversionRatePct =
    totalLeadsAllPeriod > 0
      ? Number(((convertedCountInPeriod / totalLeadsAllPeriod) * 100).toFixed(1))
      : null;

  const avgOrderValueUsd =
    confirmedSalesInPeriod.length > 0
      ? Math.round(
          confirmedSalesInPeriod.reduce((s, o) => s + o.totalCifUsd, 0) /
            confirmedSalesInPeriod.length
        )
      : 0;
  const prevAvgOrderValueUsd =
    confirmedSalesPrev.length > 0
      ? Math.round(
          confirmedSalesPrev.reduce((s, o) => s + o.totalCifUsd, 0) / confirmedSalesPrev.length
        )
      : 0;

  const salesCountSpark = buildSparkline(
    orderDated
      .filter((d) => CONFIRMED_ORDER_MILESTONES.includes(d.item.milestone))
      .map((d) => ({ ms: d.ms, value: 1 })),
    range.startMs,
    range.endMs
  );

  const salesKpis: KpiMetricItem[] = [
    {
      id: 'sales_confirmed',
      label: 'Total Confirmed Sales',
      value: confirmedSalesInPeriod.length,
      formattedValue: String(confirmedSalesInPeriod.length),
      previousValue: confirmedSalesPrev.length,
      deltaPct: calcDeltaPct(confirmedSalesInPeriod.length, confirmedSalesPrev.length),
      sparkline: salesCountSpark,
      targetSection: 'sales',
      tone: 'emerald',
    },
    {
      id: 'sales_today',
      label: 'Sales Today',
      value: salesTodayCount,
      formattedValue: String(salesTodayCount),
      previousValue: null,
      deltaPct: null,
      deltaHint: todayStr,
      sparkline: [],
      targetSection: 'orders',
      tone: 'sky',
    },
    {
      id: 'sales_this_month',
      label: 'Sales This Month',
      value: salesThisMonthUsd,
      formattedValue: fmt(salesThisMonthUsd),
      previousValue: null,
      deltaPct: null,
      deltaHint: 'Month-to-date CIF',
      sparkline: revSpark,
      targetSection: 'sales',
      tone: 'emerald',
    },
    {
      id: 'sales_monthly_target',
      label: 'Monthly Sales Target',
      value: monthlyTargetUsd,
      formattedValue: monthlyTargetUsd > 0 ? fmt(monthlyTargetUsd) : 'Not Set',
      previousValue: null,
      deltaPct: null,
      deltaHint: `${salesTargets.length} active targets`,
      sparkline: [],
      targetSection: 'sales',
      tone: 'indigo',
    },
    {
      id: 'sales_target_pct',
      label: 'Target Achievement',
      value: targetAchievementPct ?? 0,
      formattedValue: targetAchievementPct !== null ? `${targetAchievementPct}%` : '—',
      previousValue: null,
      deltaPct: null,
      deltaHint: monthlyTargetUsd > 0 ? `${fmt(achievedTargetUsd)} achieved` : 'Configure targets',
      sparkline: [],
      targetSection: 'sales',
      tone: (targetAchievementPct ?? 0) >= 80 ? 'emerald' : 'amber',
    },
    {
      id: 'sales_total_quotes',
      label: 'Total Quotations',
      value: quotesInPeriod.length,
      formattedValue: String(quotesInPeriod.length),
      previousValue: quotesPrevPeriod.length,
      deltaPct: calcDeltaPct(quotesInPeriod.length, quotesPrevPeriod.length),
      sparkline: buildSparkline(
        quoteDated.map((d) => ({ ms: d.ms, value: 1 })),
        range.startMs,
        range.endMs
      ),
      targetSection: 'sales',
      tone: 'default',
    },
    {
      id: 'sales_pending_quotes',
      label: 'Pending Quotations',
      value: pendingQuotationsCount,
      formattedValue: String(pendingQuotationsCount),
      previousValue: null,
      deltaPct: null,
      deltaHint: 'Awaiting buyer response',
      sparkline: [],
      targetSection: 'sales',
      tone: pendingQuotationsCount > 0 ? 'amber' : 'default',
    },
    {
      id: 'sales_conversion_rate',
      label: 'Sales Conversion Rate',
      value: conversionRatePct ?? 0,
      formattedValue: conversionRatePct !== null ? `${conversionRatePct}%` : '—',
      previousValue: null,
      deltaPct: null,
      deltaHint: `${convertedCountInPeriod} / ${totalLeadsAllPeriod} leads`,
      sparkline: [],
      targetSection: 'crm',
      tone: 'indigo',
    },
    {
      id: 'sales_avg_value',
      label: 'Average Sales Value',
      value: avgOrderValueUsd,
      formattedValue: avgOrderValueUsd > 0 ? fmt(avgOrderValueUsd) : '—',
      previousValue: prevAvgOrderValueUsd,
      deltaPct: calcDeltaPct(avgOrderValueUsd, prevAvgOrderValueUsd),
      sparkline: [],
      targetSection: 'orders',
      tone: 'sky',
    },
  ];

  // =========================================================================
  // 3. CRM & CUSTOMER OVERVIEW KPIs
  // =========================================================================
  const activeCustomersCount = customers.filter(
    (c) => (c.accountStatus || 'active') === 'active'
  ).length;
  const hotLeadsCount =
    inquiries.filter((i) => i.type === 'reservation' && i.status !== 'cancelled' && i.status !== 'shipped').length +
    sourcingRequests.filter((s) => s.status === 'new' || s.status === 'options_sent').length;
  const pendingFollowUpsCount =
    inquiries.filter((i) => i.status === 'received' || i.status === 'proforma_issued').length +
    teamTasks.filter((t) => t.status !== 'done' && /sales|crm/i.test(t.department)).length;
  const overdueFollowUpsCount = teamTasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr
  ).length;
  const convertedLeadsTotal =
    inquiries.filter((i) => ['deposit_confirmed', 'inspection_passed', 'vessel_booked', 'shipped'].includes(i.status)).length +
    sourcingRequests.filter((s) => s.status === 'approved').length;
  const lostLeadsTotal =
    inquiries.filter((i) => i.status === 'cancelled').length +
    quotations.filter((q) => q.status === 'declined' || q.status === 'expired').length;

  const crmKpis: KpiMetricItem[] = [
    {
      id: 'crm_total_customers',
      label: 'Total Customers',
      value: customers.length,
      formattedValue: String(customers.length),
      previousValue: null,
      deltaPct: null,
      deltaHint: `${customers.filter((c) => c.verified).length} verified`,
      sparkline: [],
      targetSection: 'crm',
      tone: 'default',
    },
    {
      id: 'crm_active_customers',
      label: 'Active Customers',
      value: activeCustomersCount,
      formattedValue: String(activeCustomersCount),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'crm',
      tone: 'emerald',
    },
    {
      id: 'crm_new_customers',
      label: 'New Customers',
      value: newCustomersInPeriod,
      formattedValue: String(newCustomersInPeriod),
      previousValue: newCustomersPrevPeriod,
      deltaPct: calcDeltaPct(newCustomersInPeriod, newCustomersPrevPeriod),
      sparkline: buildSparkline(
        userDated
          .filter((d) => d.item.role === 'customer' || d.item.role === 'dealer')
          .map((d) => ({ ms: d.ms, value: 1 })),
        range.startMs,
        range.endMs
      ),
      targetSection: 'crm',
      tone: 'sky',
    },
    {
      id: 'crm_total_leads',
      label: 'Total Leads',
      value: inquiries.length + sourcingRequests.length,
      formattedValue: String(inquiries.length + sourcingRequests.length),
      previousValue: inqPrevPeriod.length,
      deltaPct: calcDeltaPct(inqInPeriod.length, inqPrevPeriod.length),
      sparkline: buildSparkline(
        inqDated.map((d) => ({ ms: d.ms, value: 1 })),
        range.startMs,
        range.endMs
      ),
      targetSection: 'crm',
      tone: 'indigo',
    },
    {
      id: 'crm_hot_leads',
      label: 'Hot Leads',
      value: hotLeadsCount,
      formattedValue: String(hotLeadsCount),
      previousValue: null,
      deltaPct: null,
      deltaHint: 'Active reservations & sourcing',
      sparkline: [],
      targetSection: 'crm',
      tone: 'amber',
    },
    {
      id: 'crm_pending_followups',
      label: 'Pending Follow-Ups',
      value: pendingFollowUpsCount,
      formattedValue: String(pendingFollowUpsCount),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'crm',
      tone: pendingFollowUpsCount > 0 ? 'amber' : 'default',
    },
    {
      id: 'crm_overdue_followups',
      label: 'Overdue Follow-Ups',
      value: overdueFollowUpsCount,
      formattedValue: String(overdueFollowUpsCount),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'reports',
      tone: overdueFollowUpsCount > 0 ? 'rose' : 'emerald',
    },
    {
      id: 'crm_converted_leads',
      label: 'Converted Leads',
      value: convertedLeadsTotal,
      formattedValue: String(convertedLeadsTotal),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'crm',
      tone: 'emerald',
    },
    {
      id: 'crm_lost_leads',
      label: 'Lost Leads',
      value: lostLeadsTotal,
      formattedValue: String(lostLeadsTotal),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'crm',
      tone: lostLeadsTotal > 0 ? 'rose' : 'default',
    },
  ];

  // =========================================================================
  // 4. INVENTORY & AUCTIONS OVERVIEW KPIs
  // =========================================================================
  const companyOwnedVehicles = vehicles.filter((v) => v.listingType === 'auzio_stock');
  const partnerDealerVehicles = vehicles.filter(
    (v) => v.listingType === 'partner_stock' && v.status === 'available'
  );
  const auctionListings = vehicles.filter((v) => v.listingType === 'auction_listing');
  const upcomingAuctionsCount = auctionListings.filter(
    (v) => v.status === 'available' && (!v.auctionDate || v.auctionDate >= todayStr)
  ).length;
  const pendingBidRequestsCount =
    sourcingRequests.filter((s) => s.status === 'new' || s.status === 'options_sent').length +
    orders.filter((o) => o.milestone === 'customer_approved' || o.milestone === 'bid_placed').length;
  const wonAuctionsCount = orders.filter(
    (o) =>
      o.listingType === 'auction_listing' &&
      [
        'vehicle_purchased',
        'payment_pending',
        'payment_received',
        'vehicle_in_yard',
        'export_docs_ready',
        'shipment_booked',
        'shipped',
        'arrived_port',
        'completed',
      ].includes(o.milestone)
  ).length;
  const lostAuctionsCount = sourcingRequests.filter((s) => s.status === 'closed').length;

  const inventoryKpis: KpiMetricItem[] = [
    {
      id: 'inv_company_owned',
      label: 'Company-Owned Vehicles',
      value: companyOwnedVehicles.length,
      formattedValue: String(companyOwnedVehicles.length),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'inventory',
      tone: 'default',
    },
    {
      id: 'inv_available',
      label: 'Available Vehicles',
      value: vehicles.filter((v) => v.status === 'available').length,
      formattedValue: String(vehicles.filter((v) => v.status === 'available').length),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'inventory',
      tone: 'emerald',
    },
    {
      id: 'inv_reserved',
      label: 'Reserved Vehicles',
      value: vehicles.filter((v) => v.status === 'reserved').length,
      formattedValue: String(vehicles.filter((v) => v.status === 'reserved').length),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'inventory',
      tone: 'amber',
    },
    {
      id: 'inv_sold',
      label: 'Sold Vehicles',
      value: vehicles.filter((v) => v.status === 'sold').length,
      formattedValue: String(vehicles.filter((v) => v.status === 'sold').length),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'inventory',
      tone: 'indigo',
    },
    {
      id: 'inv_dealer_stock',
      label: 'External Dealer Stock',
      value: partnerDealerVehicles.length,
      formattedValue: String(partnerDealerVehicles.length),
      previousValue: null,
      deltaPct: null,
      deltaHint: partnerDealerVehicles.length === 0 ? 'Add partner stock in Inventory' : 'Partner listings live',
      sparkline: [],
      targetSection: 'inventory',
      tone: 'sky',
    },
    {
      id: 'auc_upcoming',
      label: 'Upcoming Auctions',
      value: upcomingAuctionsCount,
      formattedValue: String(upcomingAuctionsCount),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'auctions',
      tone: 'indigo',
    },
    {
      id: 'auc_pending_bids',
      label: 'Pending Bid Requests',
      value: pendingBidRequestsCount,
      formattedValue: String(pendingBidRequestsCount),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'auctions',
      tone: pendingBidRequestsCount > 0 ? 'amber' : 'default',
    },
    {
      id: 'auc_won',
      label: 'Won Auctions',
      value: wonAuctionsCount,
      formattedValue: String(wonAuctionsCount),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'auctions',
      tone: 'emerald',
    },
    {
      id: 'auc_lost',
      label: 'Closed / Lost Auctions',
      value: lostAuctionsCount,
      formattedValue: String(lostAuctionsCount),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'auctions',
      tone: 'default',
    },
  ];

  // =========================================================================
  // 5. ORDERS & LOGISTICS OVERVIEW KPIs
  // =========================================================================
  const orderDerived = orders.map((o) => ({
    order: o,
    statuses: deriveOrderStatuses(o, financeRecords, nowMs),
  }));
  const delayedShipments = orderDerived.filter((d) => d.statuses.shippingStatus === 'Delayed');
  const awaitingShipment = orderDerived.filter(
    (d) => d.statuses.shippingStatus === 'Awaiting Shipment'
  );
  const inTransitOrders = orderDerived.filter((d) => d.statuses.shippingStatus === 'In Transit');
  const arrivedOrders = orderDerived.filter((d) => d.statuses.shippingStatus === 'Arrived');
  const deliveredOrders = orderDerived.filter((d) => d.statuses.shippingStatus === 'Delivered');

  const logisticsKpis: KpiMetricItem[] = [
    {
      id: 'ord_total',
      label: 'Total Orders',
      value: orders.length,
      formattedValue: String(orders.length),
      previousValue: ordersPrevPeriod.length,
      deltaPct: calcDeltaPct(ordersInPeriod.length, ordersPrevPeriod.length),
      sparkline: salesCountSpark,
      targetSection: 'orders',
      tone: 'default',
    },
    {
      id: 'ord_pending',
      label: 'Pending Orders',
      value: orderDerived.filter((d) => d.statuses.orderStatus === 'Pending').length,
      formattedValue: String(orderDerived.filter((d) => d.statuses.orderStatus === 'Pending').length),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'orders',
      tone: 'amber',
    },
    {
      id: 'ord_confirmed',
      label: 'Confirmed Orders',
      value: orderDerived.filter((d) => d.statuses.orderStatus === 'Confirmed' || d.statuses.orderStatus === 'In Progress').length,
      formattedValue: String(
        orderDerived.filter(
          (d) => d.statuses.orderStatus === 'Confirmed' || d.statuses.orderStatus === 'In Progress'
        ).length
      ),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'orders',
      tone: 'indigo',
    },
    {
      id: 'log_awaiting',
      label: 'Awaiting Shipment',
      value: awaitingShipment.length,
      formattedValue: String(awaitingShipment.length),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'logistics',
      tone: 'amber',
    },
    {
      id: 'log_in_transit',
      label: 'Vehicles In Transit',
      value: inTransitOrders.length,
      formattedValue: String(inTransitOrders.length),
      previousValue: null,
      deltaPct: null,
      deltaHint: `${vessels.length} registered vessels`,
      sparkline: [],
      targetSection: 'logistics',
      tone: 'sky',
    },
    {
      id: 'log_arrived',
      label: 'Vehicles Arrived',
      value: arrivedOrders.length,
      formattedValue: String(arrivedOrders.length),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'logistics',
      tone: 'emerald',
    },
    {
      id: 'log_delivered',
      label: 'Delivered Vehicles',
      value: deliveredOrders.length,
      formattedValue: String(deliveredOrders.length),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'logistics',
      tone: 'emerald',
    },
    {
      id: 'log_delayed',
      label: 'Delayed Shipments',
      value: delayedShipments.length,
      formattedValue: String(delayedShipments.length),
      previousValue: null,
      deltaPct: null,
      deltaHint: delayedShipments.length > 0 ? 'Past ETA without arrival' : 'On schedule',
      sparkline: [],
      targetSection: 'logistics',
      tone: delayedShipments.length > 0 ? 'rose' : 'emerald',
    },
  ];

  // =========================================================================
  // 6. HUMAN RESOURCES OVERVIEW KPIs
  // =========================================================================
  const activeEmployees = hrEmployees.filter((e) => e.status === 'active');
  const onLeaveEmployees = hrEmployees.filter((e) => e.status === 'on_leave');
  const approvedLeavesToday = leaveRequests.filter(
    (l) => l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr
  ).length;
  const employeesOnLeaveToday = Math.max(onLeaveEmployees.length, approvedLeavesToday);
  const employeesPresentToday = Math.max(
    0,
    activeEmployees.filter((e) => e.attendanceDaysThisMonth > 0).length - approvedLeavesToday
  );
  const employeesAbsentToday = Math.max(
    0,
    activeEmployees.length - employeesPresentToday - approvedLeavesToday
  );
  const pendingLeaveCount = leaveRequests.filter((l) => l.status === 'pending').length;
  const pendingTasksCount = teamTasks.filter((t) => t.status !== 'done').length;

  const hrKpis: KpiMetricItem[] = [
    {
      id: 'hr_total',
      label: 'Total Employees',
      value: hrEmployees.length,
      formattedValue: String(hrEmployees.length),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'hr',
      tone: 'default',
    },
    {
      id: 'hr_active',
      label: 'Active Employees',
      value: activeEmployees.length,
      formattedValue: String(activeEmployees.length),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'hr',
      tone: 'emerald',
    },
    {
      id: 'hr_present',
      label: 'Present (Logged Attendance)',
      value: employeesPresentToday,
      formattedValue: String(employeesPresentToday),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'hr',
      tone: 'emerald',
    },
    {
      id: 'hr_absent',
      label: 'Absent / Unlogged',
      value: employeesAbsentToday,
      formattedValue: String(employeesAbsentToday),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'hr',
      tone: employeesAbsentToday > 0 ? 'amber' : 'default',
    },
    {
      id: 'hr_on_leave',
      label: 'Employees On Leave',
      value: employeesOnLeaveToday,
      formattedValue: String(employeesOnLeaveToday),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'hr',
      tone: 'sky',
    },
    {
      id: 'hr_pending_leaves',
      label: 'Pending Leave Requests',
      value: pendingLeaveCount,
      formattedValue: String(pendingLeaveCount),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'hr',
      tone: pendingLeaveCount > 0 ? 'amber' : 'default',
    },
    {
      id: 'hr_pending_tasks',
      label: 'Pending Assigned Tasks',
      value: pendingTasksCount,
      formattedValue: String(pendingTasksCount),
      previousValue: null,
      deltaPct: null,
      sparkline: [],
      targetSection: 'reports',
      tone: pendingTasksCount > 0 ? 'indigo' : 'default',
    },
  ];

  // =========================================================================
  // 7. FINANCIAL INTELLIGENCE CHARTS & TABLES
  // =========================================================================
  // Monthly timeline (last 6 months or active range months)
  const monthBuckets: Array<{
    key: string;
    label: string;
    revenueUsd: number;
    expensesUsd: number;
    grossProfitUsd: number;
    netProfitUsd: number;
    cashInUsd: number;
    cashOutUsd: number;
  }> = [];

  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    monthBuckets.push({
      key,
      label,
      revenueUsd: 0,
      expensesUsd: 0,
      grossProfitUsd: 0,
      netProfitUsd: 0,
      cashInUsd: 0,
      cashOutUsd: 0,
    });
  }
  const bucketMap = new Map(monthBuckets.map((b) => [b.key, b]));
  const toMonthKey = (ms: number) => {
    if (ms <= 0) return '';
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  for (const { item, ms } of orderDated) {
    const b = bucketMap.get(toMonthKey(ms));
    if (b && CONFIRMED_ORDER_MILESTONES.includes(item.milestone)) {
      b.revenueUsd += item.totalCifUsd || 0;
    }
  }
  for (const { item, ms } of finDated) {
    const b = bucketMap.get(toMonthKey(ms));
    if (!b) continue;
    if (item.type === 'expense') {
      b.expensesUsd += item.amountUsd || 0;
      if (item.status === 'paid' || item.status === 'reconciled') {
        b.cashOutUsd += item.amountUsd || 0;
      }
    } else if (item.type === 'payment' && (item.status === 'paid' || item.status === 'reconciled')) {
      b.cashInUsd += item.amountUsd || 0;
    } else if (item.type === 'invoice' && b.revenueUsd === 0) {
      b.revenueUsd += item.amountUsd || 0;
    }
  }
  for (const b of monthBuckets) {
    b.grossProfitUsd = Math.max(0, b.revenueUsd - Math.round(b.expensesUsd * 0.7));
    b.netProfitUsd = b.revenueUsd - b.expensesUsd;
  }

  // Invoice status breakdown
  const invoiceBreakdown = [
    {
      name: 'Paid',
      value: financeRecords
        .filter((f) => f.type === 'invoice' && f.status === 'paid')
        .reduce((s, f) => s + f.amountUsd, 0),
      count: financeRecords.filter((f) => f.type === 'invoice' && f.status === 'paid').length,
      color: '#10b981',
    },
    {
      name: 'Reconciled',
      value: financeRecords
        .filter((f) => f.type === 'invoice' && f.status === 'reconciled')
        .reduce((s, f) => s + f.amountUsd, 0),
      count: financeRecords.filter((f) => f.type === 'invoice' && f.status === 'reconciled').length,
      color: '#0ea5e9',
    },
    {
      name: 'Pending',
      value: financeRecords
        .filter((f) => f.type === 'invoice' && f.status === 'pending')
        .reduce((s, f) => s + f.amountUsd, 0),
      count: financeRecords.filter((f) => f.type === 'invoice' && f.status === 'pending').length,
      color: '#f59e0b',
    },
    {
      name: 'Overdue',
      value: overdueInvoicesAmountUsd,
      count: overdueInvoicesList.length,
      color: '#f43f5e',
    },
  ].filter((x) => x.value > 0 || x.count > 0);

  // Expense breakdown by category
  const expenseCatMap = new Map<string, number>();
  for (const f of financeRecords.filter((x) => x.type === 'expense')) {
    const cat = f.category || 'Uncategorized';
    expenseCatMap.set(cat, (expenseCatMap.get(cat) || 0) + f.amountUsd);
  }
  const expenseByCategory = Array.from(expenseCatMap.entries())
    .map(([category, amountUsd]) => ({ category, amountUsd }))
    .sort((a, b) => b.amountUsd - a.amountUsd);

  // Revenue by destination country
  const countryRevMap = new Map<string, { revenueUsd: number; units: number }>();
  for (const o of orders) {
    const country = o.destinationCountry || o.destinationPortName.split(',').pop()?.trim() || 'Unspecified';
    const curr = countryRevMap.get(country) || { revenueUsd: 0, units: 0 };
    curr.revenueUsd += o.totalCifUsd || 0;
    curr.units += 1;
    countryRevMap.set(country, curr);
  }
  const revenueByCountry = Array.from(countryRevMap.entries())
    .map(([country, v]) => ({ country, ...v }))
    .sort((a, b) => b.revenueUsd - a.revenueUsd);

  // Revenue by vehicle category (bodyType)
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const vehicleByStock = new Map(vehicles.map((v) => [v.stockCode, v]));
  const catRevMap = new Map<string, { revenueUsd: number; units: number }>();
  for (const o of orders) {
    const v = vehicleById.get(o.vehicleId) || vehicleByStock.get(o.vehicleStockCode);
    const body = v?.bodyType || 'Export Unit';
    const curr = catRevMap.get(body) || { revenueUsd: 0, units: 0 };
    curr.revenueUsd += o.totalCifUsd || 0;
    curr.units += 1;
    catRevMap.set(body, curr);
  }
  const revenueByCategory = Array.from(catRevMap.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenueUsd - a.revenueUsd);

  // Profit per vehicle (comparing order CIF vs recorded linked expenses or FOB cost basis)
  const profitPerVehicle = orders.slice(0, 12).map((o) => {
    const linkedExpenses = financeRecords
      .filter((f) => f.type === 'expense' && (f.orderId === o.id || f.orderNumber === o.orderNumber))
      .reduce((s, f) => s + f.amountUsd, 0);
    const costBasisUsd =
      linkedExpenses > 0
        ? linkedExpenses
        : (o.placedBidUsd > 0 ? o.placedBidUsd : o.fobUsd) + o.freightUsd + o.inspectionUsd + o.insuranceUsd;
    const estMarginUsd = o.totalCifUsd - costBasisUsd;
    return {
      orderId: o.id,
      orderNumber: o.orderNumber,
      vehicleTitle: o.vehicleTitle,
      stockCode: o.vehicleStockCode,
      revenueUsd: o.totalCifUsd,
      costUsd: costBasisUsd,
      profitUsd: estMarginUsd,
      hasActualExpenseLedger: linkedExpenses > 0,
    };
  });

  // =========================================================================
  // 8. SALESPERSON PERFORMANCE & LEADERBOARD
  // =========================================================================
  const quoteById = new Map(quotations.map((q) => [q.id, q]));
  const customerById = new Map(users.map((u) => [u.uid, u]));
  const staffMap = new Map<string, SalespersonPerformanceRow>();

  const ensureStaffRow = (name: string, email = '', department = 'Sales', staffId = '') => {
    const key = (name || 'Unassigned').trim();
    if (!staffMap.has(key)) {
      staffMap.set(key, {
        staffId: staffId || key.toLowerCase().replace(/\s+/g, '-'),
        staffName: key,
        staffEmail: email,
        department: department || 'Sales',
        assignedLeads: 0,
        contactedLeads: 0,
        convertedLeads: 0,
        confirmedSales: 0,
        revenueUsd: 0,
        profitUsd: 0,
        monthlyTargetUsd: 0,
        achievementPct: null,
        pendingFollowUps: 0,
      });
    }
    const row = staffMap.get(key)!;
    if (email && !row.staffEmail) row.staffEmail = email;
    if (department && row.department === 'Sales') row.department = department;
    return row;
  };

  for (const emp of hrEmployees) {
    if (/sales|export|business|management/i.test(emp.department)) {
      ensureStaffRow(emp.fullName, emp.email, emp.department, emp.id);
    }
  }
  for (const u of users) {
    if (u.role === 'sales' || u.role === 'sales_manager') {
      ensureStaffRow(u.displayName, u.email, u.department || 'Sales', u.uid);
    }
  }
  for (const t of salesTargets) {
    const row = ensureStaffRow(t.staffName, t.staffEmail, 'Sales');
    row.monthlyTargetUsd += t.targetRevenueUsd || 0;
  }
  for (const sr of sourcingRequests) {
    const row = ensureStaffRow(sr.assignedStaffName || 'Unassigned', '', 'Sales', sr.assignedStaffId);
    row.assignedLeads += 1;
    if (sr.status !== 'new') row.contactedLeads += 1;
    if (sr.status === 'approved') row.convertedLeads += 1;
    if (sr.status === 'new' || sr.status === 'options_sent') row.pendingFollowUps += 1;
  }
  for (const q of quotations) {
    const row = ensureStaffRow(q.preparedByName || 'Unassigned', '', 'Sales', q.preparedByStaffId);
    if (q.status === 'sent') row.pendingFollowUps += 1;
  }
  for (const o of orders) {
    const linkedQuote = o.quotationId ? quoteById.get(o.quotationId) : undefined;
    const customer = customerById.get(o.customerId);
    const repName = linkedQuote?.preparedByName || customer?.assignedRepName || 'Export Desk';
    const row = ensureStaffRow(repName, customer?.assignedRepEmail || '', 'Sales');
    if (CONFIRMED_ORDER_MILESTONES.includes(o.milestone)) {
      row.confirmedSales += 1;
      row.convertedLeads += 1;
      row.revenueUsd += o.totalCifUsd || 0;
      const linkedExp = financeRecords
        .filter((f) => f.type === 'expense' && (f.orderId === o.id || f.orderNumber === o.orderNumber))
        .reduce((s, f) => s + f.amountUsd, 0);
      row.profitUsd += linkedExp > 0 ? o.totalCifUsd - linkedExp : Math.max(0, o.totalCifUsd - (o.fobUsd + o.freightUsd));
    }
  }
  for (const t of teamTasks) {
    if (t.status !== 'done' && t.assignedToName) {
      const existing = staffMap.get(t.assignedToName.trim());
      if (existing) existing.pendingFollowUps += 1;
    }
  }

  const salespersonPerformance: SalespersonPerformanceRow[] = Array.from(staffMap.values())
    .map((r) => ({
      ...r,
      achievementPct:
        r.monthlyTargetUsd > 0
          ? Number(((r.revenueUsd / r.monthlyTargetUsd) * 100).toFixed(1))
          : null,
    }))
    .sort((a, b) => b.revenueUsd - a.revenueUsd);

  const revenueBySalesperson = salespersonPerformance
    .filter((s) => s.revenueUsd > 0)
    .map((s) => ({ name: s.staffName, revenueUsd: s.revenueUsd, sales: s.confirmedSales }));

  // Best-selling makes & models
  const makeMap = new Map<string, { units: number; revenueUsd: number }>();
  const modelMap = new Map<string, { units: number; revenueUsd: number }>();
  for (const o of orders) {
    const v = vehicleById.get(o.vehicleId) || vehicleByStock.get(o.vehicleStockCode);
    const make = v?.make || o.vehicleTitle.split(' ')[1] || o.vehicleTitle.split(' ')[0] || 'Other';
    const model = v ? `${v.make} ${v.model}` : o.vehicleTitle;
    const mk = makeMap.get(make) || { units: 0, revenueUsd: 0 };
    mk.units += 1;
    mk.revenueUsd += o.totalCifUsd || 0;
    makeMap.set(make, mk);

    const md = modelMap.get(model) || { units: 0, revenueUsd: 0 };
    md.units += 1;
    md.revenueUsd += o.totalCifUsd || 0;
    modelMap.set(model, md);
  }
  const bestMakes = Array.from(makeMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.units - a.units || b.revenueUsd - a.revenueUsd)
    .slice(0, 8);
  const bestModels = Array.from(modelMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.units - a.units || b.revenueUsd - a.revenueUsd)
    .slice(0, 8);

  // =========================================================================
  // 9. CRM 7-STAGE PIPELINE & FOLLOW-UPS
  // =========================================================================
  const crmPipeline: CrmPipelineStage[] = [
    {
      id: 'new_lead',
      label: 'New Lead',
      count:
        inquiries.filter((i) => i.status === 'received' && !i.adminNotes.trim()).length +
        sourcingRequests.filter((s) => s.status === 'new').length,
      estimatedValueUsd:
        inquiries
          .filter((i) => i.status === 'received' && !i.adminNotes.trim())
          .reduce((s, i) => s + (i.quotedCifUsd || 0), 0) +
        sourcingRequests
          .filter((s) => s.status === 'new')
          .reduce((s, r) => s + (r.maxBudgetUsd || 0) * (r.quantity || 1), 0),
      filterStatus: 'received',
      color: '#64748b',
    },
    {
      id: 'contacted',
      label: 'Contacted',
      count: inquiries.filter((i) => i.status === 'received' && i.adminNotes.trim().length > 0).length,
      estimatedValueUsd: inquiries
        .filter((i) => i.status === 'received' && i.adminNotes.trim().length > 0)
        .reduce((s, i) => s + (i.quotedCifUsd || 0), 0),
      filterStatus: 'received',
      color: '#0ea5e9',
    },
    {
      id: 'interested',
      label: 'Interested',
      count: sourcingRequests.filter((s) => s.status === 'options_sent').length,
      estimatedValueUsd: sourcingRequests
        .filter((s) => s.status === 'options_sent')
        .reduce((s, r) => s + (r.maxBudgetUsd || 0) * (r.quantity || 1), 0),
      filterStatus: 'options_sent',
      color: '#6366f1',
    },
    {
      id: 'negotiation',
      label: 'Negotiation',
      count: quotations.filter((q) => q.status === 'draft').length,
      estimatedValueUsd: quotations
        .filter((q) => q.status === 'draft')
        .reduce((s, q) => s + (q.totalCifUsd || 0), 0),
      filterStatus: 'draft',
      color: '#8b5cf6',
    },
    {
      id: 'quotation_sent',
      label: 'Quotation Sent',
      count:
        quotations.filter((q) => q.status === 'sent').length +
        inquiries.filter((i) => i.status === 'proforma_issued').length,
      estimatedValueUsd:
        quotations
          .filter((q) => q.status === 'sent')
          .reduce((s, q) => s + (q.totalCifUsd || 0), 0) +
        inquiries
          .filter((i) => i.status === 'proforma_issued')
          .reduce((s, i) => s + (i.quotedCifUsd || 0), 0),
      filterStatus: 'proforma_issued',
      color: '#f59e0b',
    },
    {
      id: 'converted',
      label: 'Converted',
      count:
        orders.filter((o) => CONFIRMED_ORDER_MILESTONES.includes(o.milestone)).length +
        inquiries.filter((i) =>
          ['deposit_confirmed', 'inspection_passed', 'vessel_booked', 'shipped'].includes(i.status)
        ).length,
      estimatedValueUsd: orders
        .filter((o) => CONFIRMED_ORDER_MILESTONES.includes(o.milestone))
        .reduce((s, o) => s + (o.totalCifUsd || 0), 0),
      filterStatus: 'deposit_confirmed',
      color: '#10b981',
    },
    {
      id: 'lost',
      label: 'Lost',
      count: lostLeadsTotal,
      estimatedValueUsd:
        inquiries
          .filter((i) => i.status === 'cancelled')
          .reduce((s, i) => s + (i.quotedCifUsd || 0), 0) +
        quotations
          .filter((q) => q.status === 'declined' || q.status === 'expired')
          .reduce((s, q) => s + (q.totalCifUsd || 0), 0),
      filterStatus: 'cancelled',
      color: '#f43f5e',
    },
  ];

  const followUps: FollowUpItem[] = [
    ...inquiries
      .filter((i) => i.status === 'received' || i.status === 'proforma_issued')
      .map((i) => {
        const createdMs = parseRecordDateMs(i.createdAt);
        const dueDate = createdMs
          ? new Date(createdMs + 2 * DAY_MS).toISOString().slice(0, 10)
          : todayStr;
        return {
          id: `inq-${i.id}`,
          customerName: i.buyerName,
          company: i.buyerCountry,
          assignedEmployee: 'Sales Desk',
          priority: (i.type === 'reservation' ? 'high' : 'medium') as FollowUpItem['priority'],
          scheduledDate: dueDate,
          isOverdue: dueDate < todayStr,
          source: 'inquiry' as const,
          reference: i.trackingCode,
        };
      }),
    ...sourcingRequests
      .filter((s) => s.status === 'new' || s.status === 'options_sent')
      .map((s) => {
        const createdMs = parseRecordDateMs(s.createdAt);
        const dueDate = createdMs
          ? new Date(createdMs + 2 * DAY_MS).toISOString().slice(0, 10)
          : todayStr;
        return {
          id: `sr-${s.id}`,
          customerName: s.customerName,
          company: s.customerCompany || s.destinationCountry,
          assignedEmployee: s.assignedStaffName || 'Unassigned',
          priority: 'high' as const,
          scheduledDate: dueDate,
          isOverdue: dueDate < todayStr,
          source: 'sourcing' as const,
          reference: s.requestCode,
        };
      }),
    ...teamTasks
      .filter((t) => t.status !== 'done' && t.dueDate)
      .map((t) => ({
        id: `tsk-${t.id}`,
        customerName: t.title,
        company: t.department,
        assignedEmployee: t.assignedToName || 'Unassigned',
        priority: t.priority,
        scheduledDate: t.dueDate,
        isOverdue: t.dueDate < todayStr,
        source: 'task' as const,
        reference: t.department,
      })),
  ].sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || a.scheduledDate.localeCompare(b.scheduledDate));

  // Destination Port statistics
  const portStatMap = new Map<string, { portName: string; country: string; shipments: number; inTransit: number; delayed: number }>();
  for (const { order, statuses } of orderDerived) {
    const key = order.destinationPortName || 'Unassigned Port';
    const curr = portStatMap.get(key) || {
      portName: key,
      country: order.destinationCountry || key.split(',').pop()?.trim() || '',
      shipments: 0,
      inTransit: 0,
      delayed: 0,
    };
    curr.shipments += 1;
    if (statuses.shippingStatus === 'In Transit') curr.inTransit += 1;
    if (statuses.shippingStatus === 'Delayed') curr.delayed += 1;
    portStatMap.set(key, curr);
  }
  const portStatistics = Array.from(portStatMap.values()).sort((a, b) => b.shipments - a.shipments);

  return {
    financialKpis,
    salesKpis,
    crmKpis,
    inventoryKpis,
    logisticsKpis,
    hrKpis,
    accountingSummary: {
      recognizedRevenueUsd: currFin.recognizedRevenue,
      customerDepositsUsd,
      verifiedPaymentsUsd: currFin.verifiedPayments,
      outstandingReceivablesUsd: outstandingCustomerBalancesUsd,
      outstandingPayablesUsd: outstandingSupplierPaymentsUsd,
      totalExpensesUsd: currFin.totalExpenses,
      grossProfitUsd: currFin.grossProfit,
      netProfitUsd: currFin.netProfit,
      availableBankCashUsd,
    },
    monthBuckets,
    invoiceBreakdown,
    expenseByCategory,
    revenueByCountry,
    revenueBySalesperson,
    revenueByCategory,
    profitPerVehicle,
    salespersonPerformance,
    bestMakes,
    bestModels,
    crmPipeline,
    followUps,
    portStatistics,
    orderDerived,
    upcomingDepartures: orders.filter(
      (o) => o.etdDate && o.etdDate >= todayStr && ['shipment_booked', 'export_docs_ready', 'vehicle_in_yard'].includes(o.milestone)
    ),
    upcomingArrivals: orders.filter(
      (o) => o.etaDate && o.etaDate >= todayStr && ['shipped', 'shipment_booked'].includes(o.milestone)
    ),
    delayedShipments,
  };
}

export type ComputedDashboardAnalytics = ReturnType<typeof computeDashboardAnalytics>;

// ============================================================================
// Executive Report Exports (CSV & Excel Spreadsheet)
// ============================================================================

function escapeCsvCell(val: string | number): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadDashboardCsv(params: {
  companySettings: CompanySettings;
  adminName: string;
  range: ResolvedDateRange;
  currency: CurrencyCode;
  analytics: ComputedDashboardAnalytics;
}) {
  const { companySettings, adminName, range, currency, analytics } = params;
  const rows: Array<Array<string | number>> = [
    [companySettings.companyName || 'AUZIO TRADERS', 'Executive Command Center Report'],
    ['Generated At', new Date().toLocaleString()],
    ['Generated By', adminName],
    ['Date Range', range.label],
    ['Display Currency', currency],
    [],
    ['Section', 'KPI Metric', 'Value', 'Change vs Previous Period'],
  ];

  const pushGroup = (section: string, list: KpiMetricItem[]) => {
    for (const k of list) {
      if (k.restricted) continue;
      rows.push([
        section,
        k.label,
        k.formattedValue,
        k.deltaPct !== null ? `${k.deltaPct > 0 ? '+' : ''}${k.deltaPct}%` : k.deltaHint || '—',
      ]);
    }
  };

  pushGroup('Financial Overview', analytics.financialKpis);
  pushGroup('Sales Overview', analytics.salesKpis);
  pushGroup('CRM & Customers', analytics.crmKpis);
  pushGroup('Inventory & Auctions', analytics.inventoryKpis);
  pushGroup('Orders & Logistics', analytics.logisticsKpis);
  pushGroup('Human Resources', analytics.hrKpis);

  rows.push([]);
  rows.push(['Salesperson Performance', 'Department', 'Leads', 'Converted', 'Confirmed Sales', 'Revenue (USD)', 'Target %']);
  for (const sp of analytics.salespersonPerformance) {
    rows.push([
      sp.staffName,
      sp.department,
      sp.assignedLeads,
      sp.convertedLeads,
      sp.confirmedSales,
      sp.revenueUsd,
      sp.achievementPct !== null ? `${sp.achievementPct}%` : '—',
    ]);
  }

  const csv = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auzio-executive-dashboard-${range.preset}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadDashboardExcel(params: {
  companySettings: CompanySettings;
  adminName: string;
  range: ResolvedDateRange;
  currency: CurrencyCode;
  analytics: ComputedDashboardAnalytics;
}) {
  const { companySettings, adminName, range, currency, analytics } = params;
  const esc = (v: string | number) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const kpiRows = [
    ['Financial Overview', analytics.financialKpis],
    ['Sales Overview', analytics.salesKpis],
    ['CRM & Customers', analytics.crmKpis],
    ['Inventory & Auctions', analytics.inventoryKpis],
    ['Orders & Logistics', analytics.logisticsKpis],
    ['Human Resources', analytics.hrKpis],
  ] as const;

  let html = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head><meta charset="utf-8" /></head>
  <body>
    <h2>${esc(companySettings.companyName || 'AUZIO TRADERS')} — Executive Dashboard Report</h2>
    <p><strong>Generated:</strong> ${esc(new Date().toLocaleString())} | <strong>By:</strong> ${esc(adminName)} | <strong>Date Range:</strong> ${esc(range.label)} | <strong>Currency:</strong> ${esc(currency)}</p>
    <table border="1" cellspacing="0" cellpadding="6">
      <tr style="background:#0f172a;color:#ffffff;font-weight:bold;">
        <th>Category</th><th>Metric</th><th>Value</th><th>Comparison</th>
      </tr>`;

  for (const [cat, items] of kpiRows) {
    for (const k of items) {
      if (k.restricted) continue;
      html += `<tr><td>${esc(cat)}</td><td>${esc(k.label)}</td><td>${esc(k.formattedValue)}</td><td>${esc(
        k.deltaPct !== null ? `${k.deltaPct > 0 ? '+' : ''}${k.deltaPct}%` : k.deltaHint || '—'
      )}</td></tr>`;
    }
  }

  html += `</table><br/><h3>Salesperson Performance</h3>
    <table border="1" cellspacing="0" cellpadding="6">
      <tr style="background:#0f172a;color:#ffffff;font-weight:bold;">
        <th>Employee</th><th>Department</th><th>Assigned Leads</th><th>Converted</th><th>Confirmed Sales</th><th>Revenue (USD)</th><th>Target %</th>
      </tr>`;
  for (const sp of analytics.salespersonPerformance) {
    html += `<tr><td>${esc(sp.staffName)}</td><td>${esc(sp.department)}</td><td>${sp.assignedLeads}</td><td>${sp.convertedLeads}</td><td>${sp.confirmedSales}</td><td>$${sp.revenueUsd.toLocaleString()}</td><td>${sp.achievementPct !== null ? `${sp.achievementPct}%` : '—'}</td></tr>`;
  }
  html += `</table></body></html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auzio-executive-dashboard-${range.preset}-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
