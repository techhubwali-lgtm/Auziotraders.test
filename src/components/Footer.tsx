import type { AppView, CompanySettings, LoginPortalType } from '../types/portal';

interface FooterProps {
  settings: CompanySettings;
  onNavigate: (view: AppView) => void;
  onOpenLoginPortal: (portal: LoginPortalType) => void;
  onOpenWorkflowStatus: () => void;
}

export function Footer({
  settings,
  onNavigate,
  onOpenLoginPortal,
  onOpenWorkflowStatus,
}: FooterProps) {
  return (
    <footer className="no-print bg-slate-950 text-slate-300 border-t border-slate-800 mt-auto">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-slate-800">
          <div className="md:col-span-4 space-y-2.5">
            <div className="text-base font-extrabold tracking-tight text-white">
              {settings.companyName}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              {settings.officeAddress}
            </p>
            <p className="text-xs font-mono text-amber-400">
              {settings.supportEmail} · {settings.whatsappPhone}
            </p>
            <p className="text-[11px] text-slate-500">
              Official Bank TT Settlement: {settings.bankName} ({settings.swiftCode})
            </p>
          </div>

          <div className="md:col-span-3 space-y-2.5">
            <div className="text-xs font-semibold text-white uppercase tracking-wider">
              Trade Portal
            </div>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('catalog')}
                  className="hover:text-amber-400 cursor-pointer"
                >
                  Browse Export Stock
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('shipping')}
                  className="hover:text-amber-400 cursor-pointer"
                >
                  Shipping Rates &amp; 14-Country Ports
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('how_to_buy')}
                  className="hover:text-amber-400 cursor-pointer"
                >
                  How to Buy &amp; Auction Bidding FAQs
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('track')}
                  className="hover:text-amber-400 cursor-pointer"
                >
                  Track Export Order
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-2.5">
            <div className="text-xs font-semibold text-white uppercase tracking-wider">
              Account Portals
            </div>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLoginPortal('customer')}
                  className="hover:text-amber-400 cursor-pointer"
                >
                  Customer / Dealer Login
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLoginPortal('staff')}
                  className="hover:text-amber-400 cursor-pointer"
                >
                  Staff / Admin Login
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenWorkflowStatus}
                  className="hover:text-amber-400 cursor-pointer"
                >
                  Platform &amp; Workflow Status
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-2.5">
            <div className="text-xs font-semibold text-white uppercase tracking-wider">
              Japan Export Terminals
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Yokohama · Nagoya · Kobe · Osaka · Hakata. Staff-managed USS/TAA/CAA auction
              sourcing, JEVIC/QISJ inspection, and Ro-Ro/container dispatch across Africa, Oceania,
              the Caribbean, UK, and UAE.
            </p>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            © {new Date().getFullYear()} {settings.companyName} All rights reserved.
          </span>
          <span>https://auziotraders.com · Yokohama, Japan</span>
        </div>
      </div>
    </footer>
  );
}
