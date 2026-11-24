import {
  Bot,
  Calculator,
  CheckCircle2,
  Download,
  FilePlus2,
  Mail,
  Phone,
  Plus,
  Search,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatMoney, getPortById, GLOBAL_PORTS } from '../../data/ports';
import type {
  CurrencyCode,
  ExportOrder,
  Inquiry,
  OrderMilestone,
  Quotation,
  SalesTarget,
  SourcingRequest,
  UserProfile,
  Vehicle,
} from '../../types/portal';

interface CrmSalesPanelProps {
  mode: 'crm' | 'sales';
  currency: CurrencyCode;
  fxRates: Record<string, number>;
  users: UserProfile[];
  inquiries: Inquiry[];
  sourcingRequests: SourcingRequest[];
  quotations: Quotation[];
  orders: ExportOrder[];
  vehicles: Vehicle[];
  salesTargets: SalesTarget[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  onUpdateInquiry: (
    inquiryId: string,
    updates: { status: OrderMilestone; adminNotes: string }
  ) => Promise<void>;
  onCreateQuotation: (input: {
    sourcingRequestId: string;
    vehicleId: string;
    vehicleTitle: string;
    stockCode: string;
    customerId: string;
    customerName: string;
    customerCompany: string;
    destinationPortId: string;
    destinationPortName: string;
    currency: CurrencyCode;
    fobVehicleUsd: number;
    auctionFeeUsd: number;
    exportDocsUsd: number;
    jevicInspectionUsd: number;
    seaFreightUsd: number;
    marineInsuranceUsd: number;
    authorizedMaxBidUsd: number;
    notes: string;
  }) => Promise<void>;
  onConvertQuoteToOrder: (quotation: Quotation) => Promise<void>;
  onSaveSalesTarget: (
    input: Omit<SalesTarget, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteSalesTarget: (id: string) => Promise<void>;
  onOpenAiFollowup: (prompt: string) => void;
}

const INQUIRY_STATUSES: Array<{ value: OrderMilestone; label: string }> = [
  { value: 'received', label: 'New Lead' },
  { value: 'proforma_issued', label: 'Proforma Sent' },
  { value: 'deposit_confirmed', label: 'Deposit Confirmed' },
  { value: 'inspection_passed', label: 'Inspection Passed' },
  { value: 'vessel_booked', label: 'Vessel Booked' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'cancelled', label: 'Closed / Lost' },
];

export function CrmSalesPanel({
  mode,
  currency,
  fxRates,
  users,
  inquiries,
  sourcingRequests,
  quotations,
  orders,
  vehicles,
  salesTargets,
  canCreate,
  canEdit,
  canDelete,
  canExport,
  onUpdateInquiry,
  onCreateQuotation,
  onConvertQuoteToOrder,
  onSaveSalesTarget,
  onDeleteSalesTarget,
  onOpenAiFollowup,
}: CrmSalesPanelProps) {
  const fmt = (usd: number) => formatMoney(usd, currency, fxRates);

  // CRM State
  const [crmSubTab, setCrmSubTab] = useState<'leads' | 'customers'>('leads');
  const [crmSearch, setCrmSearch] = useState('');
  const [editingInquiryId, setEditingInquiryId] = useState<string | null>(null);
  const [inqStatusDraft, setInqStatusDraft] = useState<OrderMilestone>('received');
  const [inqNotesDraft, setInqNotesDraft] = useState('');
  const [savingInq, setSavingInq] = useState(false);

  // Sales State
  const [salesSubTab, setSalesSubTab] = useState<'quotations' | 'targets' | 'commission'>(
    'quotations'
  );
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetStaffName, setTargetStaffName] = useState('');
  const [targetStaffEmail, setTargetStaffEmail] = useState('');
  const [targetPeriod, setTargetPeriod] = useState(
    `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`
  );
  const [targetRevenueUsd, setTargetRevenueUsd] = useState(120000);
  const [achievedRevenueUsd, setAchievedRevenueUsd] = useState(0);
  const [targetUnits, setTargetUnits] = useState(10);
  const [soldUnits, setSoldUnits] = useState(0);
  const [targetCommPct, setTargetCommPct] = useState(2.5);
  const [targetNotes, setTargetNotes] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);

  // Commission Calculator State
  const [calcDealCifUsd, setCalcDealCifUsd] = useState(24500);
  const [calcMarginUsd, setCalcMarginUsd] = useState(2200);
  const [calcBasis, setCalcBasis] = useState<'cif' | 'margin'>('margin');
  const [calcRatePct, setCalcRatePct] = useState(12);
  const [calcDealsCount, setCalcDealsCount] = useState(4);
  const [calcBonusUsd, setCalcBonusUsd] = useState(300);

  // Quotation Builder State
  const customerUsers = useMemo(
    () => users.filter((u) => u.role === 'customer' || u.role === 'dealer'),
    [users]
  );
  const [qCustomerId, setQCustomerId] = useState(customerUsers[0]?.uid || '');
  const [qSourcingId, setQSourcingId] = useState('');
  const [qVehicleId, setQVehicleId] = useState(vehicles[0]?.id || '');
  const [qTitle, setQTitle] = useState(
    vehicles[0] ? `${vehicles[0].year} ${vehicles[0].make} ${vehicles[0].model}` : ''
  );
  const [qStockCode, setQStockCode] = useState(vehicles[0]?.stockCode || '');
  const [qPortId, setQPortId] = useState('mombasa-ke');
  const [qFob, setQFob] = useState(vehicles[0]?.fobPriceUsd || 18500);
  const [qAuctionFee, setQAuctionFee] = useState(550);
  const [qExportDocs, setQExportDocs] = useState(250);
  const [qJevic, setQJevic] = useState(285);
  const [qFreight, setQFreight] = useState(1450);
  const [qInsurance, setQInsurance] = useState(310);
  const [qMaxBid, setQMaxBid] = useState(19000);
  const [qNotes, setQNotes] = useState(
    'Fixed fees: Export Docs & Inspection. Variable estimates: Auction Hammer (capped by Max Bid Ceiling) & Sea Freight.'
  );
  const [savingQuote, setSavingQuote] = useState(false);

  const filteredCustomers = useMemo(() => {
    const q = crmSearch.trim().toLowerCase();
    if (!q) return customerUsers;
    return customerUsers.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
    );
  }, [customerUsers, crmSearch]);

  const filteredInquiries = useMemo(() => {
    const q = crmSearch.trim().toLowerCase();
    if (!q) return inquiries;
    return inquiries.filter(
      (i) =>
        i.buyerName.toLowerCase().includes(q) ||
        i.buyerEmail.toLowerCase().includes(q) ||
        i.buyerCountry.toLowerCase().includes(q) ||
        i.vehicleTitle.toLowerCase().includes(q) ||
        i.trackingCode.toLowerCase().includes(q)
    );
  }, [inquiries, crmSearch]);

  const exportSalesCsv = () => {
    const rows = [
      ['Quote Number', 'Customer', 'Vehicle', 'Port', 'Total CIF (USD)', 'Max Bid (USD)', 'Status'],
      ...quotations.map((q) => [
        q.quoteNumber,
        q.customerCompany || q.customerName,
        q.vehicleTitle,
        q.destinationPortName,
        String(q.totalCifUsd),
        String(q.authorizedMaxBidUsd),
        q.status,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auzio-sales-quotations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const singleDealCommissionUsd =
    ((calcBasis === 'cif' ? calcDealCifUsd : calcMarginUsd) * calcRatePct) / 100;
  const projectedMonthlyCommissionUsd = singleDealCommissionUsd * calcDealsCount + calcBonusUsd;

  // =========================================================================
  // CRM & LEADS MODE
  // =========================================================================
  if (mode === 'crm') {
    const dealerCount = customerUsers.filter((u) => u.role === 'dealer').length;
    const verifiedCount = customerUsers.filter((u) => u.verified).length;
    const newLeadsCount = inquiries.filter((i) => i.status === 'received').length;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
              CRM &amp; Customer Management
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Manage buyer inquiries, registered dealers, follow-up notes, and account assignments.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCrmSubTab('leads')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                crmSubTab === 'leads'
                  ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              Leads &amp; Inquiries ({inquiries.length})
            </button>
            <button
              type="button"
              onClick={() => setCrmSubTab('customers')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                crmSubTab === 'customers'
                  ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              Customers &amp; Dealers ({customerUsers.length})
            </button>
          </div>
        </div>

        {/* CRM Summary Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Buyer Accounts
            </div>
            <div className="text-2xl font-bold text-slate-950 dark:text-white mt-1 font-mono">
              {customerUsers.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {dealerCount} dealer partners · {verifiedCount} verified
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              New Unworked Leads
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {newLeadsCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Of {inquiries.length} total public inquiries
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Active Sourcing Requests
            </div>
            <div className="text-2xl font-bold text-slate-950 dark:text-white mt-1 font-mono">
              {sourcingRequests.filter((r) => r.status !== 'closed').length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {sourcingRequests.filter((r) => r.status === 'new').length} awaiting auction options
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Active Export Orders
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {orders.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {fmt(orders.reduce((s, o) => s + (o.totalCifUsd || 0), 0))} total CIF value
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={crmSearch}
            onChange={(e) => setCrmSearch(e.target.value)}
            placeholder={
              crmSubTab === 'leads'
                ? 'Filter inquiries by buyer, country, stock code...'
                : 'Filter customers by name, company, country, email...'
            }
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          />
        </div>

        {crmSubTab === 'leads' ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {filteredInquiries.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No buyer inquiries match your filter. Incoming public quote requests and 48-hour
                vehicle holds appear here in real time.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredInquiries.map((inq) => {
                  const isEditing = editingInquiryId === inq.id;
                  return (
                    <div key={inq.id} className="p-5 space-y-3">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                              {inq.trackingCode}
                            </span>
                            <span className="px-2 py-0.5 text-[11px] font-semibold uppercase rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {inq.type}
                            </span>
                            <span className="px-2 py-0.5 text-[11px] font-semibold uppercase rounded bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300">
                              {INQUIRY_STATUSES.find((s) => s.value === inq.status)?.label ||
                                inq.status}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-950 dark:text-white">
                            {inq.buyerName} — {inq.vehicleTitle}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              {inq.buyerEmail}
                            </span>
                            {inq.buyerPhone && (
                              <span className="inline-flex items-center gap-1 font-mono">
                                <Phone className="w-3.5 h-3.5" />
                                {inq.buyerPhone}
                              </span>
                            )}
                            <span>
                              Destination: {inq.destinationPortName} ({inq.buyerCountry})
                            </span>
                            {inq.quotedCifUsd > 0 && (
                              <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">
                                Quoted CIF: {fmt(inq.quotedCifUsd)}
                              </span>
                            )}
                          </div>
                          {inq.message && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 rounded-lg p-2.5 mt-2">
                              Buyer Message: &ldquo;{inq.message}&rdquo;
                            </p>
                          )}
                          {inq.adminNotes && !isEditing && (
                            <p className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg p-2.5">
                              Follow-up Notes: {inq.adminNotes}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenAiFollowup(
                                `Draft a professional, concise follow-up email and WhatsApp message to ${inq.buyerName} (${inq.buyerCountry}) regarding their inquiry ${inq.trackingCode} for ${inq.vehicleTitle} shipping to ${inq.destinationPortName}. Quoted CIF: $${inq.quotedCifUsd.toLocaleString()} USD. Buyer notes: "${inq.message || 'Interested in export quotation'}".`
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 cursor-pointer"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            AI Follow-up
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingInquiryId(null);
                                } else {
                                  setEditingInquiryId(inq.id);
                                  setInqStatusDraft(inq.status);
                                  setInqNotesDraft(inq.adminNotes || '');
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                            >
                              {isEditing ? 'Cancel' : 'Update Follow-up'}
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            setSavingInq(true);
                            try {
                              await onUpdateInquiry(inq.id, {
                                status: inqStatusDraft,
                                adminNotes: inqNotesDraft,
                              });
                              setEditingInquiryId(null);
                            } finally {
                              setSavingInq(false);
                            }
                          }}
                          className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Pipeline Stage
                              </label>
                              <select
                                value={inqStatusDraft}
                                onChange={(e) =>
                                  setInqStatusDraft(e.target.value as OrderMilestone)
                                }
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                              >
                                {INQUIRY_STATUSES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Follow-up &amp; Call Log Notes
                              </label>
                              <input
                                type="text"
                                value={inqNotesDraft}
                                onChange={(e) => setInqNotesDraft(e.target.value)}
                                placeholder="e.g., Called via WhatsApp, sent proforma invoice, awaiting deposit..."
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>
                          <button
                            type="submit"
                            disabled={savingInq}
                            className="px-4 py-2 text-xs font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 rounded-lg cursor-pointer disabled:opacity-60"
                          >
                            {savingInq ? 'Saving...' : 'Save CRM Update'}
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
            {filteredCustomers.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No registered customers or dealers found.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Customer / Company</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Country &amp; Port</th>
                    <th className="px-4 py-3">Assigned Rep</th>
                    <th className="px-4 py-3 text-right">Orders / Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredCustomers.map((c) => {
                    const custOrders = orders.filter((o) => o.customerId === c.uid);
                    const totalSpend = custOrders.reduce((s, o) => s + (o.totalCifUsd || 0), 0);
                    return (
                      <tr
                        key={c.uid}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-950 dark:text-white flex items-center gap-1.5">
                            <span>{c.companyName || c.displayName}</span>
                            {c.verified && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {c.displayName} · {c.email}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold uppercase rounded ${
                              c.role === 'dealer'
                                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {c.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                          <div>{c.country || 'Not set'}</div>
                          <div className="text-slate-400">
                            {c.defaultPortId ? getPortById(c.defaultPortId).name : '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                          {c.assignedRepName || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs">
                          <div className="font-bold text-slate-950 dark:text-white">
                            {fmt(totalSpend)}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">
                            {custOrders.length} order{custOrders.length === 1 ? '' : 's'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // SALES DEPARTMENT MODE
  // =========================================================================
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
            Sales Department
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Issue itemized CIF quotations, track team revenue targets, and calculate sales
            commissions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSalesSubTab('quotations')}
            className={`px-3.5 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
              salesSubTab === 'quotations'
                ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Quotations ({quotations.length})
          </button>
          <button
            type="button"
            onClick={() => setSalesSubTab('targets')}
            className={`px-3.5 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
              salesSubTab === 'targets'
                ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Targets &amp; Performance ({salesTargets.length})
          </button>
          <button
            type="button"
            onClick={() => setSalesSubTab('commission')}
            className={`px-3.5 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
              salesSubTab === 'commission'
                ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Commission Calculator
          </button>
          {canExport && (
            <button
              type="button"
              onClick={exportSalesCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* SUBTAB 1: QUOTATIONS */}
      {salesSubTab === 'quotations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Issued Quotations */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-950 dark:text-white">
              Issued Quotations ({quotations.length})
            </h3>
            {quotations.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                No quotations issued yet. Create one using the CIF builder.
              </p>
            ) : (
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {quotations.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5 bg-slate-50/50 dark:bg-slate-800/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                          {q.quoteNumber} · {q.customerCompany}
                        </div>
                        <div className="font-bold text-sm text-slate-950 dark:text-white mt-0.5">
                          {q.vehicleTitle}
                        </div>
                        <div className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          CIF {fmt(q.totalCifUsd)} · Ceiling {fmt(q.authorizedMaxBidUsd)}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold uppercase rounded ${
                          q.status === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : q.status === 'declined'
                              ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300'
                        }`}
                      >
                        {q.status}
                      </span>
                    </div>
                    {q.status === 'approved' && canEdit && (
                      <button
                        type="button"
                        onClick={() => void onConvertQuoteToOrder(q)}
                        className="w-full py-2 text-xs font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        Convert Approved Quote → Export Order
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Itemized CIF Quotation Builder */}
          {canCreate ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingQuote(true);
                try {
                  const cust =
                    users.find((u) => u.uid === qCustomerId) || customerUsers[0] || null;
                  const port = getPortById(qPortId);
                  await onCreateQuotation({
                    sourcingRequestId: qSourcingId,
                    vehicleId: qVehicleId,
                    vehicleTitle: qTitle,
                    stockCode: qStockCode,
                    customerId: cust?.uid || qCustomerId || 'cust-pending',
                    customerName: cust?.displayName || 'Registered Buyer',
                    customerCompany: cust?.companyName || 'Overseas Buyer',
                    destinationPortId: port.id,
                    destinationPortName: `${port.name}, ${port.country}`,
                    currency,
                    fobVehicleUsd: Number(qFob),
                    auctionFeeUsd: Number(qAuctionFee),
                    exportDocsUsd: Number(qExportDocs),
                    jevicInspectionUsd: Number(qJevic),
                    seaFreightUsd: Number(qFreight),
                    marineInsuranceUsd: Number(qInsurance),
                    authorizedMaxBidUsd: Number(qMaxBid),
                    notes: qNotes,
                  });
                } finally {
                  setSavingQuote(false);
                }
              }}
              className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <FilePlus2 className="w-4 h-4 text-amber-600" />
                  Issue Itemized CIF Quotation
                </h3>
                {sourcingRequests.length > 0 && (
                  <select
                    value={qSourcingId}
                    onChange={(e) => {
                      const req = sourcingRequests.find((r) => r.id === e.target.value);
                      setQSourcingId(e.target.value);
                      if (req) {
                        setQCustomerId(req.customerId);
                        setQTitle(`${req.yearMax} ${req.make} ${req.model}`);
                        setQPortId(req.destinationPortId);
                        setQFob(Math.round(req.maxBudgetUsd * 0.85));
                        setQMaxBid(Math.round(req.maxBudgetUsd * 0.88));
                      }
                    }}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                  >
                    <option value="">Prefill from Sourcing Request...</option>
                    {sourcingRequests.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.requestCode} — {r.make} {r.model}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Customer / Dealer
                  </label>
                  <select
                    value={qCustomerId}
                    onChange={(e) => setQCustomerId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {customerUsers.map((c) => (
                      <option key={c.uid} value={c.uid}>
                        {c.companyName || c.displayName} ({c.displayName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Destination Port
                  </label>
                  <select
                    value={qPortId}
                    onChange={(e) => setQPortId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {GLOBAL_PORTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.country} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vehicle Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={qTitle}
                    onChange={(e) => setQTitle(e.target.value)}
                    placeholder="e.g. 2022 Toyota Land Cruiser Prado TX-L"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Stock / Lot Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={qStockCode}
                    onChange={(e) => setQStockCode(e.target.value.toUpperCase())}
                    placeholder="AUZ-2026-001"
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {[
                  { label: 'Vehicle FOB (USD)', val: qFob, set: setQFob },
                  { label: 'Auction Fee (USD)', val: qAuctionFee, set: setQAuctionFee },
                  { label: 'Export Docs (USD)', val: qExportDocs, set: setQExportDocs },
                  { label: 'Inspection (USD)', val: qJevic, set: setQJevic },
                  { label: 'Sea Freight (USD)', val: qFreight, set: setQFreight },
                  { label: 'Insurance (USD)', val: qInsurance, set: setQInsurance },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {f.label}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={f.val}
                      onChange={(e) => f.set(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                ))}
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-bold text-amber-950 dark:text-amber-300 mb-1">
                    Authorized Max Bid Ceiling (USD) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={qMaxBid}
                    onChange={(e) => setQMaxBid(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-white dark:bg-slate-950 border border-amber-400 dark:border-amber-700 rounded-lg text-slate-950 dark:text-white"
                  />
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Calculated Total CIF
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-slate-950 dark:text-white">
                    {fmt(qFob + qAuctionFee + qExportDocs + qJevic + qFreight + qInsurance)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quotation Terms &amp; Notes
                </label>
                <textarea
                  rows={2}
                  value={qNotes}
                  onChange={(e) => setQNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={savingQuote}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer disabled:opacity-60"
              >
                {savingQuote ? 'Issuing...' : 'Issue Quotation to Buyer Portal'}
              </button>
            </form>
          ) : (
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              You have view-only access to Sales Quotations. Request Sales Create permission from
              an administrator to issue new quotes.
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: SALES TARGETS & TEAM PERFORMANCE */}
      {salesSubTab === 'targets' && (
        <div className="space-y-5">
          {canCreate && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowTargetForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {showTargetForm ? 'Close Form' : 'Assign Sales Target'}
              </button>
            </div>
          )}

          {showTargetForm && canCreate && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingTarget(true);
                try {
                  await onSaveSalesTarget({
                    staffName: targetStaffName,
                    staffEmail: targetStaffEmail,
                    period: targetPeriod,
                    targetRevenueUsd,
                    achievedRevenueUsd,
                    targetUnits,
                    soldUnits,
                    commissionRatePct: targetCommPct,
                    notes: targetNotes,
                  });
                  setShowTargetForm(false);
                  setTargetStaffName('');
                  setTargetStaffEmail('');
                  setTargetNotes('');
                } finally {
                  setSavingTarget(false);
                }
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-600" />
                New Sales Target Plan
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sales Executive Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={targetStaffName}
                    onChange={(e) => setTargetStaffName(e.target.value)}
                    placeholder="e.g. Kenji Takahashi"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Staff Email
                  </label>
                  <input
                    type="email"
                    value={targetStaffEmail}
                    onChange={(e) => setTargetStaffEmail(e.target.value)}
                    placeholder="sales@auziotraders.com"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Period (Month / Quarter) *
                  </label>
                  <input
                    type="text"
                    required
                    value={targetPeriod}
                    onChange={(e) => setTargetPeriod(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Revenue Target (USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={targetRevenueUsd}
                    onChange={(e) => setTargetRevenueUsd(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Achieved Revenue (USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={achievedRevenueUsd}
                    onChange={(e) => setAchievedRevenueUsd(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Units Target / Sold
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      value={targetUnits}
                      onChange={(e) => setTargetUnits(Number(e.target.value))}
                      placeholder="Target"
                      className="px-2.5 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <input
                      type="number"
                      min={0}
                      value={soldUnits}
                      onChange={(e) => setSoldUnits(Number(e.target.value))}
                      placeholder="Sold"
                      className="px-2.5 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={35}
                    value={targetCommPct}
                    onChange={(e) => setTargetCommPct(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={targetNotes}
                    onChange={(e) => setTargetNotes(e.target.value)}
                    placeholder="Market focus or bonus tier criteria..."
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingTarget}
                className="px-5 py-2 text-sm font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 rounded-lg cursor-pointer"
              >
                {savingTarget ? 'Saving...' : 'Save Sales Target'}
              </button>
            </form>
          )}

          {salesTargets.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No sales targets configured yet
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Assign quarterly or monthly revenue and unit goals to track real team performance
                and earned commissions.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {salesTargets.map((t) => {
                const pct =
                  t.targetRevenueUsd > 0
                    ? Math.min(100, Math.round((t.achievedRevenueUsd / t.targetRevenueUsd) * 100))
                    : 0;
                const earnedCommission = Math.round(
                  (t.achievedRevenueUsd * (t.commissionRatePct || 0)) / 100
                );
                return (
                  <div
                    key={t.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {t.period}
                        </div>
                        <div className="text-base font-bold text-slate-950 dark:text-white">
                          {t.staffName}
                        </div>
                        {t.staffEmail && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {t.staffEmail}
                          </div>
                        )}
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void onDeleteSalesTarget(t.id)}
                          aria-label={`Delete target for ${t.staffName}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-600 dark:text-slate-400">
                          Revenue Attainment
                        </span>
                        <span className="font-mono font-bold text-slate-950 dark:text-white">
                          {fmt(t.achievedRevenueUsd)} / {fmt(t.targetRevenueUsd)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">Units Sold</div>
                        <div className="font-mono font-bold text-slate-950 dark:text-white">
                          {t.soldUnits} / {t.targetUnits}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">Comm. Rate</div>
                        <div className="font-mono font-bold text-slate-950 dark:text-white">
                          {t.commissionRatePct}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-500 dark:text-slate-400">Est. Payout</div>
                        <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {fmt(earnedCommission)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: SALES COMMISSION CALCULATOR */}
      {salesSubTab === 'commission' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Calculator className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-bold text-slate-950 dark:text-white">
                Sales Commission Calculator
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Calculation Basis
                </label>
                <select
                  value={calcBasis}
                  onChange={(e) => setCalcBasis(e.target.value as 'cif' | 'margin')}
                  className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="margin">Percentage of Net Deal Margin</option>
                  <option value="cif">Percentage of Total CIF Value</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  step="0.25"
                  min={0}
                  max={50}
                  value={calcRatePct}
                  onChange={(e) => setCalcRatePct(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Average Deal CIF Value (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={calcDealCifUsd}
                  onChange={(e) => setCalcDealCifUsd(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Average Net Margin per Vehicle (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={calcMarginUsd}
                  onChange={(e) => setCalcMarginUsd(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Closed Vehicles in Period
                </label>
                <input
                  type="number"
                  min={1}
                  value={calcDealsCount}
                  onChange={(e) => setCalcDealsCount(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Volume Milestone Bonus (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={calcBonusUsd}
                  onChange={(e) => setCalcBonusUsd(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-950 text-white rounded-xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="text-xs font-mono uppercase tracking-wider text-amber-400">
                Projected Payout Breakdown
              </div>
              <div>
                <div className="text-xs text-slate-400">Commission per Vehicle</div>
                <div className="text-2xl font-extrabold font-mono text-white mt-0.5">
                  {fmt(Math.round(singleDealCommissionUsd))}
                </div>
              </div>
              <div className="border-t border-slate-800 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {calcDealsCount} closed vehicle{calcDealsCount === 1 ? '' : 's'}
                  </span>
                  <span className="font-mono font-semibold">
                    {fmt(Math.round(singleDealCommissionUsd * calcDealsCount))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Volume Bonus</span>
                  <span className="font-mono font-semibold">{fmt(calcBonusUsd)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">Total Estimated Commission Payout</div>
              <div className="text-3xl font-extrabold font-mono text-emerald-400 mt-1">
                {fmt(Math.round(projectedMonthlyCommissionUsd))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
