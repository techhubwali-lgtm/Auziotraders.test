import { Building2, Info, Radio, ShieldCheck, Ship, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EN_COPY } from '../i18n/en';
import { fetchAuctionStatus } from '../services/auctionFeedService';
import type { CompanySettings, LiveAuctionStatusResponse } from '../types/portal';

interface WorkflowStatusModalProps {
  settings: CompanySettings;
  onClose: () => void;
}

export function WorkflowStatusModal({
  settings,
  onClose,
}: WorkflowStatusModalProps) {
  const [feedStatus, setFeedStatus] = useState<LiveAuctionStatusResponse | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAuctionStatus().then((res) => {
      if (active) setFeedStatus(res);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs overflow-y-auto p-4 sm:p-6 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Platform and Workflow Status"
    >
      <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-base font-semibold">{EN_COPY.transparency.title}</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {EN_COPY.transparency.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close disclosure modal"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm text-slate-700">
          <div className="border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-950 flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-600" />
                1. Japanese Auto Auctions (auziotraders.com / AJES Feed)
              </span>
              <span
                className={`text-xs font-mono font-semibold ${
                  feedStatus?.reachable ? 'text-emerald-800' : 'text-amber-800'
                }`}
              >
                {feedStatus === null
                  ? 'Checking feed...'
                  : feedStatus.reachable
                    ? feedStatus.mode === 'ajes_api'
                      ? 'Official AJES SQL API + Staff Bidding'
                      : 'Live Proxy Connected + Staff Bidding'
                    : 'Staff-Managed Workflow'}
              </span>
            </div>
            {feedStatus && (
              <p className="text-[11px] font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                {feedStatus.message}
              </p>
            )}
            <p className="text-xs text-slate-600 leading-relaxed">
              Live auction lots (<span className="font-mono text-slate-800">main</span>) and sold
              price statistics (<span className="font-mono text-slate-800">stats</span>) are queried
              live on-demand (with full inspection details loaded by lot ID, never bulk-copied).
              Actual bid placement at Japanese auction lanes (USS/TAA/CAA/HAA) is executed by
              licensed AUZIO TRADERS Yokohama staff strictly within your authorized Maximum Bid
              Ceiling.
            </p>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-950 flex items-center gap-2">
                <Ship className="w-4 h-4 text-slate-600" />
                2. Vessel Schedules & Shipment Tracking
              </span>
              <span className="text-xs font-mono font-semibold text-amber-800">
                Staff-Managed Workflow
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {EN_COPY.transparency.vesselNotice}
            </p>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-950 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-600" />
                3. Settlement & Official Proforma Invoices
              </span>
              <span className="text-xs font-mono font-semibold text-emerald-800">
                Bank TT Only (SMBC Tokyo)
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {EN_COPY.transparency.paymentNotice}
            </p>
            <p className="text-xs font-mono text-slate-700 pt-1">
              Beneficiary: {settings.accountName} · Bank: {settings.bankName} · SWIFT:{' '}
              {settings.swiftCode}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-900">
                Server-Enforced RBAC & Bid Ceiling Protection:
              </span>{' '}
              Customer data isolation, internal staff-only note/document separation, immutable
              audit logs, and Maximum Bid Ceiling enforcement are validated directly in Firebase
              Firestore Security Rules.
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
