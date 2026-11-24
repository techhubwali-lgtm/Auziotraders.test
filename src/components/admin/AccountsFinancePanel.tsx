import {
  CheckCircle2,
  Download,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatMoney } from '../../data/ports';
import type {
  CurrencyCode,
  ExportOrder,
  FinanceRecord,
  FinanceRecordStatus,
  FinanceRecordType,
  UserProfile,
} from '../../types/portal';

interface AccountsFinancePanelProps {
  currency: CurrencyCode;
  fxRates: Record<string, number>;
  staffProfile: UserProfile | null;
  orders: ExportOrder[];
  financeRecords: FinanceRecord[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  onCreateRecord: (
    input: Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateStatus: (
    id: string,
    updates: { status: FinanceRecordStatus; reconciled: boolean }
  ) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
}

const CATEGORIES = [
  'Customer Vehicle Settlement',
  'Auction Vehicle Purchase',
  'Ocean Freight & Shipping',
  'Pre-Shipment Inspection',
  'Export Documentation & Customs',
  'Yard Storage & Transport',
  'Payroll & Commissions',
  'Office & Operations',
];

export function AccountsFinancePanel({
  currency,
  fxRates,
  staffProfile,
  orders,
  financeRecords,
  canCreate,
  canEdit,
  canDelete,
  canExport,
  onCreateRecord,
  onUpdateStatus,
  onDeleteRecord,
}: AccountsFinancePanelProps) {
  const fmt = (usd: number) => formatMoney(usd, currency, fxRates);

  const [subTab, setSubTab] = useState<'ledger' | 'pnl' | 'reconciliation'>('ledger');
  const [typeFilter, setTypeFilter] = useState<'ALL' | FinanceRecordType>('ALL');
  const [showForm, setShowForm] = useState(false);

  // Composer state
  const [recType, setRecType] = useState<FinanceRecordType>('invoice');
  const [refCode, setRefCode] = useState(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [linkedOrderId, setLinkedOrderId] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amountUsd, setAmountUsd] = useState(0);
  const [status, setStatus] = useState<FinanceRecordStatus>('pending');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const summary = useMemo(() => {
    const invoiced = financeRecords
      .filter((r) => r.type === 'invoice')
      .reduce((acc, r) => acc + r.amountUsd, 0);
    const paymentsReceived = financeRecords
      .filter((r) => r.type === 'payment' || (r.type === 'invoice' && (r.status === 'paid' || r.status === 'reconciled')))
      .reduce((acc, r) => acc + r.amountUsd, 0);
    const expenses = financeRecords
      .filter((r) => r.type === 'expense')
      .reduce((acc, r) => acc + r.amountUsd, 0);
    const outstanding = financeRecords
      .filter((r) => r.type === 'invoice' && (r.status === 'pending' || r.status === 'overdue'))
      .reduce((acc, r) => acc + r.amountUsd, 0);
    const reconciledTotal = financeRecords
      .filter((r) => r.reconciled)
      .reduce((acc, r) => acc + (r.type === 'expense' ? -r.amountUsd : r.amountUsd), 0);

    return {
      invoiced,
      paymentsReceived,
      expenses,
      netProfit: paymentsReceived - expenses,
      outstanding,
      reconciledTotal,
    };
  }, [financeRecords]);

  const filtered = useMemo(() => {
    return financeRecords.filter((r) => (typeFilter === 'ALL' ? true : r.type === typeFilter));
  }, [financeRecords, typeFilter]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { category: string; income: number; expense: number }>();
    for (const r of financeRecords) {
      const curr = map.get(r.category) || { category: r.category, income: 0, expense: 0 };
      if (r.type === 'expense') curr.expense += r.amountUsd;
      else if (r.status === 'paid' || r.status === 'reconciled' || r.type === 'payment') {
        curr.income += r.amountUsd;
      }
      map.set(r.category, curr);
    }
    return Array.from(map.values());
  }, [financeRecords]);

  const handleOrderLinkChange = (orderId: string) => {
    setLinkedOrderId(orderId);
    const ord = orders.find((o) => o.id === orderId);
    if (ord) {
      setCounterparty(ord.customerCompany || ord.customerName);
      if (amountUsd === 0) setAmountUsd(ord.totalCifUsd);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterparty.trim() || amountUsd <= 0) return;
    setSaving(true);
    try {
      const ord = orders.find((o) => o.id === linkedOrderId);
      await onCreateRecord({
        type: recType,
        referenceCode: refCode.trim() || `FIN-${Date.now().toString().slice(-6)}`,
        orderId: ord?.id || '',
        orderNumber: ord?.orderNumber || '',
        counterpartyName: counterparty.trim(),
        category,
        amountUsd,
        currency: 'USD',
        status,
        reconciled: status === 'reconciled',
        transactionDate: txDate,
        notes: notes.trim(),
        createdByUid: staffProfile?.uid || 'staff',
        createdByName: staffProfile?.displayName || 'Accounts Team',
      });
      setShowForm(false);
      setCounterparty('');
      setAmountUsd(0);
      setNotes('');
      setRefCode(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Type',
      'Reference',
      'Order',
      'Counterparty',
      'Category',
      'Amount_USD',
      'Status',
      'Reconciled',
      'Notes',
    ];
    const rows = filtered.map((r) => [
      r.transactionDate,
      r.type,
      r.referenceCode,
      r.orderNumber,
      `"${r.counterpartyName.replace(/"/g, '""')}"`,
      `"${r.category.replace(/"/g, '""')}"`,
      r.amountUsd,
      r.status,
      r.reconciled ? 'Yes' : 'No',
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auzio-finance-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Accounts &amp; Finance
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Track invoices, buyer payments, export expenses, profit &amp; loss, and bank
            reconciliation. Base accounting currency remains USD.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-amber-400 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{showForm ? 'Close Form' : 'Record Transaction'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Payments Collected</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {fmt(summary.paymentsReceived)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Operating Expenses</div>
          <div className="text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
            {fmt(summary.expenses)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Net Profit (P&amp;L)</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-950 dark:text-white mt-1">
            {fmt(summary.netProfit)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Outstanding Invoices</div>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {fmt(summary.outstanding)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Reconciled Bank Net</div>
          <div className="text-xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {fmt(summary.reconciledTotal)}
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showForm && canCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Log Invoice, Payment, or Expense (Base Currency: USD)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Entry Type
              </label>
              <select
                value={recType}
                onChange={(e) => setRecType(e.target.value as FinanceRecordType)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="invoice">Customer Invoice</option>
                <option value="payment">Payment Received</option>
                <option value="expense">Business Expense</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Reference Code
              </label>
              <input
                type="text"
                required
                value={refCode}
                onChange={(e) => setRefCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Link Export Order (Optional)
              </label>
              <select
                value={linkedOrderId}
                onChange={(e) => handleOrderLinkChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="">General / Unlinked</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} — {o.customerCompany || o.customerName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Customer / Vendor Name *
              </label>
              <input
                type="text"
                required
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="e.g. Mombasa Motors Ltd or USS Tokyo"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Amount (USD) *
              </label>
              <input
                type="number"
                min={1}
                required
                value={amountUsd || ''}
                onChange={(e) => setAmountUsd(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FinanceRecordStatus)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="reconciled">Reconciled</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional wire reference, TT slip number, or accounting memo..."
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs"
            />
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-bold hover:bg-slate-800 dark:hover:bg-amber-400 cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>
      )}

      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(
            [
              { id: 'ledger', label: 'Invoices, Payments & Expenses' },
              { id: 'pnl', label: 'Profit & Loss Statement' },
              { id: 'reconciliation', label: 'Bank Reconciliation' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                subTab === t.id
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {subTab === 'ledger' && (
          <div className="flex items-center gap-1.5 text-xs">
            {(['ALL', 'invoice', 'payment', 'expense'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTypeFilter(f)}
                className={`px-2.5 py-1.5 rounded-md font-semibold cursor-pointer ${
                  typeFilter === f
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {f === 'ALL' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ledger Table */}
      {subTab === 'ledger' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                No financial transactions recorded yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click &ldquo;Record Transaction&rdquo; above to log your first invoice, wire
                payment, or export expense.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date &amp; Ref</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Counterparty &amp; Category</th>
                    <th className="px-4 py-3 font-semibold text-right">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900 dark:text-white">
                          {rec.referenceCode}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {rec.transactionDate} {rec.orderNumber ? `· ${rec.orderNumber}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize font-medium text-slate-700 dark:text-slate-300">
                        {rec.type}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {rec.counterpartyName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {rec.category}
                          {rec.notes ? ` · ${rec.notes}` : ''}
                        </div>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                          rec.type === 'expense'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {rec.type === 'expense' ? '-' : '+'}
                        {fmt(rec.amountUsd)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`font-semibold capitalize ${
                            rec.status === 'paid' || rec.status === 'reconciled'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : rec.status === 'overdue'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {rec.status}
                        </span>
                        {rec.reconciled && (
                          <span className="ml-1.5 text-[11px] text-blue-600 dark:text-blue-400">
                            · Bank Verified
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        {canEdit && rec.status !== 'paid' && rec.status !== 'reconciled' && (
                          <button
                            type="button"
                            onClick={() =>
                              void onUpdateStatus(rec.id, { status: 'paid', reconciled: rec.reconciled })
                            }
                            className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                          >
                            Mark Paid
                          </button>
                        )}
                        {canEdit && !rec.reconciled && (
                          <button
                            type="button"
                            onClick={() =>
                              void onUpdateStatus(rec.id, { status: 'reconciled', reconciled: true })
                            }
                            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                          >
                            Reconcile
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void onDeleteRecord(rec.id)}
                            aria-label="Delete finance record"
                            className="text-slate-400 hover:text-rose-600 cursor-pointer inline-flex align-middle"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* P&L View */}
      {subTab === 'pnl' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Profit &amp; Loss Statement (Category Summary)
          </h3>
          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Record paid invoices, payments, and operating expenses to generate a live P&amp;L
              breakdown.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 font-semibold">Category</th>
                    <th className="py-2.5 font-semibold text-right">Realized Income</th>
                    <th className="py-2.5 font-semibold text-right">Expenses</th>
                    <th className="py-2.5 font-semibold text-right">Net Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categoryBreakdown.map((row) => (
                    <tr key={row.category}>
                      <td className="py-3 font-medium text-slate-900 dark:text-white">
                        {row.category}
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {fmt(row.income)}
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        {fmt(row.expense)}
                      </td>
                      <td className="py-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                        {fmt(row.income - row.expense)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bank Reconciliation View */}
      {subTab === 'reconciliation' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Corporate Bank Reconciliation Queue
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Match customer TT wires and supplier disbursements against SMBC Tokyo bank
                statements.
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              {financeRecords.filter((r) => r.reconciled).length} / {financeRecords.length} Reconciled
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {financeRecords.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                No transactions waiting for bank reconciliation.
              </p>
            ) : (
              financeRecords.map((rec) => (
                <div key={rec.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {rec.referenceCode} · {rec.counterpartyName}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {rec.transactionDate} · {rec.category}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                      {rec.type === 'expense' ? '-' : '+'}
                      {fmt(rec.amountUsd)}
                    </span>
                    {rec.reconciled ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        Reconciled
                      </span>
                    ) : canEdit ? (
                      <button
                        type="button"
                        onClick={() =>
                          void onUpdateStatus(rec.id, { status: 'reconciled', reconciled: true })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Verify Bank Match</span>
                      </button>
                    ) : (
                      <span className="text-slate-400">Pending Verification</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
