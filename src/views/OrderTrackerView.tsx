import {
  Anchor,
  CheckCircle2,
  Clock,
  Loader2,
  PackageSearch,
  Search,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  formatMoney,
  MILESTONE_META,
  MILESTONE_ORDER,
  SHIPPING_METHOD_LABELS,
  TRADE_MILESTONE_META,
  TRADE_MILESTONE_ORDER,
} from '../data/ports';
import { SEED_ORDERS } from '../data/seedData';
import { lookupOrderStatus } from '../services/firestoreService';
import type {
  CompanySettings,
  OrderMilestone,
  OrderStatusRecord,
  TradeOrderMilestone,
} from '../types/portal';

interface OrderTrackerViewProps {
  initialCode?: string;
  settings: CompanySettings;
}

export function OrderTrackerView({ initialCode, settings }: OrderTrackerViewProps) {
  const [codeInput, setCodeInput] = useState(initialCode || '');
  const [loading, setLoading] = useState(false);
  const [searchedCode, setSearchedCode] = useState('');
  const [record, setRecord] = useState<OrderStatusRecord | null>(null);
  const [error, setError] = useState('');

  const runLookup = async (raw: string) => {
    const normalized = raw.trim().toUpperCase();
    if (!normalized) return;
    setLoading(true);
    setError('');
    setSearchedCode(normalized);
    try {
      const result = await lookupOrderStatus(normalized);
      if (result) {
        setRecord(result);
      } else {
        // Fallback check against seeded sample orders if DB hasn't been seeded yet
        const sample = SEED_ORDERS.find((o) => o.trackingCode.toUpperCase() === normalized);
        if (sample) {
          setRecord({
            trackingCode: sample.trackingCode,
            inquiryId: sample.id,
            vehicleStockCode: sample.vehicleStockCode,
            vehicleTitle: sample.vehicleTitle,
            destinationPortName: sample.destinationPortName,
            shippingMethod: sample.shippingMethod,
            quotedCifUsd: sample.totalCifUsd,
            currency: sample.currency,
            milestone: sample.milestone,
            vesselName: sample.vesselName,
            etaDate: sample.etaDate,
            publicNote: `Vessel ${sample.vesselName} (${sample.voyageNumber}) — ETD ${sample.etdDate}, Est. ETA ${sample.etaDate} (Staff-verified estimated schedule).`,
          });
        } else {
          setRecord(null);
        }
      }
    } catch {
      setError('Unable to reach shipment tracker right now. Please try again.');
      setRecord(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      setCodeInput(initialCode);
      void runLookup(initialCode);
    }
  }, [initialCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runLookup(codeInput);
  };

  const isTradeMilestone =
    record !== null &&
    TRADE_MILESTONE_ORDER.includes(record.milestone as TradeOrderMilestone);

  const activeTradeIdx = isTradeMilestone
    ? TRADE_MILESTONE_ORDER.indexOf(record!.milestone as TradeOrderMilestone)
    : -1;

  const activeLegacyIdx =
    record && !isTradeMilestone
      ? MILESTONE_ORDER.indexOf(record.milestone as OrderMilestone)
      : -1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-20 space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-mono font-semibold text-amber-700 uppercase tracking-wider">
          Export Pipeline &amp; Vessel Schedule Status
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">
          Track Your Export Order &amp; Shipment
        </h1>
        <p className="text-sm text-slate-600 max-w-xl">
          Enter the tracking reference issued on your AUZIO TRADERS order or quick inquiry (format:{' '}
          <span className="font-mono text-slate-900">AUZ-2026-XXXXXX</span>). Vessel ETD/ETA dates
          are staff-verified carrier schedules.
        </p>
      </div>

      {/* Lookup Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter reference code (e.g. AUZ-2026-K9M4P2)"
              maxLength={32}
              className="w-full pl-10 pr-4 py-2.5 text-sm font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-amber-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading || codeInput.trim().length < 6}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Track Shipment
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Sample orders:</span>
          {SEED_ORDERS.map((o) => (
            <button
              key={o.trackingCode}
              type="button"
              onClick={() => {
                setCodeInput(o.trackingCode);
                void runLookup(o.trackingCode);
              }}
              className="px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 hover:bg-amber-50 hover:text-amber-900 rounded cursor-pointer"
            >
              {o.trackingCode} ({o.destinationCountry})
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && searchedCode && !record && !error && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <PackageSearch className="w-9 h-9 text-slate-400 mx-auto" strokeWidth={1.5} />
          <h2 className="text-base font-semibold text-slate-900">
            No shipment found for {searchedCode}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Double-check your reference code from your order confirmation or Proforma Invoice, or
            contact our Yokohama export desk at {settings.supportEmail}.
          </p>
        </div>
      )}

      {record && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {/* Summary Header */}
          <div className="px-6 py-5 bg-slate-950 text-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-amber-400">{record.trackingCode}</div>
              <h2 className="text-lg font-bold mt-0.5">{record.vehicleTitle}</h2>
              <div className="text-xs text-slate-300 font-mono mt-1">
                Stock {record.vehicleStockCode} · Destination: {record.destinationPortName}
              </div>
            </div>
            <div className="text-left sm:text-right font-mono tabular-nums">
              <div className="text-[11px] text-slate-400">Quoted CIF</div>
              <div className="text-xl font-bold">
                {formatMoney(record.quotedCifUsd, record.currency, settings.exchangeRates)}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                {SHIPPING_METHOD_LABELS[record.shippingMethod]}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {record.milestone === 'cancelled' ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-5 flex items-start gap-3 text-red-900">
                <XCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Order Cancelled</div>
                  <p className="text-xs mt-1 text-red-800">
                    {record.publicNote || MILESTONE_META.cancelled.description}
                  </p>
                </div>
              </div>
            ) : isTradeMilestone ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    14-Stage Export Trade Pipeline
                  </h3>
                  <span className="text-xs font-mono font-semibold text-amber-800">
                    Stage {activeTradeIdx + 1} of 14:{' '}
                    {TRADE_MILESTONE_META[record.milestone as TradeOrderMilestone].label}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {TRADE_MILESTONE_ORDER.map((step, index) => {
                    const isCompleted = index < activeTradeIdx;
                    const isCurrent = index === activeTradeIdx;
                    const meta = TRADE_MILESTONE_META[step];
                    return (
                      <div
                        key={step}
                        className={`p-3 rounded-lg border text-xs ${
                          isCurrent
                            ? 'bg-amber-50 border-amber-500 text-amber-950 font-semibold'
                            : isCompleted
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                              : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
                          {isCurrent && <Clock className="w-3.5 h-3.5 text-amber-700" />}
                        </div>
                        <div className="leading-snug">{meta.shortLabel}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-500">
                  Export Milestone Timeline
                </h3>
                <ol className="space-y-3">
                  {MILESTONE_ORDER.map((step, index) => {
                    const isCompleted = index < activeLegacyIdx;
                    const isCurrent = index === activeLegacyIdx;
                    const meta = MILESTONE_META[step];
                    return (
                      <li
                        key={step}
                        className={`flex items-start gap-4 p-3.5 rounded-lg border ${
                          isCurrent
                            ? 'bg-amber-50/70 border-amber-300'
                            : isCompleted
                              ? 'bg-slate-50 border-slate-200'
                              : 'bg-white border-slate-100 opacity-65'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                          ) : isCurrent ? (
                            <Clock className="w-5 h-5 text-amber-700" />
                          ) : (
                            <span className="w-5 h-5 rounded-full border-2 border-slate-300 inline-flex items-center justify-center text-[10px] font-mono text-slate-500">
                              {index + 1}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-950">
                              {meta.label}
                            </span>
                            <span className="text-xs font-mono text-slate-500">
                              {isCompleted ? 'Completed' : isCurrent ? 'Current Stage' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">{meta.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Vessel & Export Coordinator Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 mb-2">
                  <Anchor className="w-4 h-4 text-amber-700" />
                  <span>Vessel &amp; Sailing Schedule (Staff-Managed)</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Assigned Vessel:</span>
                    <span className="font-mono font-medium text-slate-900">
                      {record.vesselName || 'Pending Vessel Allocation'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Estimated Arrival (ETA):</span>
                    <span className="font-mono font-medium text-slate-900">
                      {record.etaDate || 'To Be Confirmed'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-900 mb-1.5">
                  Latest Yokohama Export Desk Update
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {record.publicNote ||
                    'Our Yokohama export coordinators will update this record as inspection and carrier booking progress.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
