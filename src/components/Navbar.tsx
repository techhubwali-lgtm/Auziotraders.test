import {
  Building2,
  GitCompare,
  Info,
  Lock,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { ALL_CURRENCIES, GLOBAL_PORTS } from '../data/ports';
import { EN_COPY } from '../i18n/en';
import type {
  AppView,
  CurrencyCode,
  LoginPortalType,
  UserRole,
} from '../types/portal';

interface NavbarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  currency: CurrencyCode;
  onCurrencyChange: (c: CurrencyCode) => void;
  selectedPortId: string;
  onPortChange: (portId: string) => void;
  compareCount: number;
  onOpenCompare: () => void;
  onOpenWorkflowStatus: () => void;
  effectiveRole: UserRole;
  activeUserLabel: string;
  isSignedInFirebase: boolean;
  onOpenLoginPortal: (portal: LoginPortalType) => void;
  onDemoRoleSwitch: (role: UserRole, customerId?: string) => void;
  onSignOut: () => void;
}

export function Navbar({
  activeView,
  onNavigate,
  currency,
  onCurrencyChange,
  selectedPortId,
  onPortChange,
  compareCount,
  onOpenCompare,
  onOpenWorkflowStatus,
  effectiveRole,
  activeUserLabel,
  isSignedInFirebase,
  onOpenLoginPortal,
  onDemoRoleSwitch,
  onSignOut,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const isStaff =
    effectiveRole === 'sales' ||
    effectiveRole === 'operations' ||
    effectiveRole === 'admin';
  const isCustomer = effectiveRole === 'customer';

  const navLinks: { id: AppView; label: string }[] = [
    { id: 'catalog', label: EN_COPY.nav.browseStock },
    { id: 'shipping', label: EN_COPY.nav.shippingRates },
    { id: 'how_to_buy', label: EN_COPY.nav.howToBuy },
    { id: 'track', label: EN_COPY.nav.trackOrder },
  ];

  if (isCustomer) {
    navLinks.push({ id: 'customer_portal', label: EN_COPY.nav.dealerPortal });
  }
  if (isStaff) {
    navLinks.push({ id: 'staff_console', label: EN_COPY.nav.staffConsole });
  }

  const handleNav = (view: AppView) => {
    onNavigate(view);
    setMobileOpen(false);
  };

  return (
    <header className="no-print sticky top-0 z-40">
      {/* Trade Utility Top Bar: Currency, Port, Transparency Disclosure, Role Switcher, Dual Login Entry Points */}
      <div className="bg-slate-950 text-slate-200 border-b border-slate-800">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 hidden sm:inline">Currency:</span>
              <select
                aria-label="Display currency"
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
                className="bg-slate-900 text-white border border-slate-700 rounded px-2 py-1 font-mono text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {ALL_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 hidden sm:inline">CIF Port:</span>
              <select
                aria-label="Destination discharge port"
                value={selectedPortId}
                onChange={(e) => onPortChange(e.target.value)}
                className="bg-slate-900 text-white border border-slate-700 rounded px-2 py-1 text-xs max-w-[190px] sm:max-w-[240px] focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {GLOBAL_PORTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.country} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onOpenWorkflowStatus}
              className="hidden lg:inline-flex items-center gap-1 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Info className="w-3.5 h-3.5 text-amber-500" />
              Platform & Workflow Status
            </button>
          </div>

          {/* Right side: Quick-Demo Switcher + Dual Login Portals */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Test Role:</span>
              <select
                aria-label="Quick demo role switcher"
                value={effectiveRole}
                onChange={(e) => {
                  const next = e.target.value as UserRole;
                  onDemoRoleSwitch(next, next === 'customer' ? 'cust-kenya-01' : undefined);
                }}
                className="bg-slate-900 text-amber-300 border border-slate-700 rounded px-2 py-1 text-[11px] font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="visitor">Visitor (Public)</option>
                <option value="customer">Customer / Dealer (Kenya)</option>
                <option value="sales">Sales Staff</option>
                <option value="operations">Operations Staff</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <span className="text-slate-700">|</span>

            <button
              type="button"
              onClick={() => onOpenLoginPortal('customer')}
              className="inline-flex items-center gap-1.5 text-slate-200 hover:text-amber-400 font-medium whitespace-nowrap cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
              Customer / Dealer Login
            </button>

            <span className="text-slate-700">·</span>

            <button
              type="button"
              onClick={() => onOpenLoginPortal('staff')}
              className="inline-flex items-center gap-1.5 text-slate-200 hover:text-amber-400 font-medium whitespace-nowrap cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Staff / Admin Login
            </button>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNav('catalog')}
            className="text-lg font-extrabold tracking-tight text-slate-950 whitespace-nowrap shrink-0 cursor-pointer hover:text-amber-700 transition-colors"
          >
            {EN_COPY.brandName}
          </button>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden lg:flex items-center gap-7 text-sm font-medium"
          >
            {navLinks.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`relative py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-slate-950 font-semibold'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute left-0 right-0 -bottom-[19px] h-0.5 bg-amber-600" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Active Workspace / Dual Auth CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            {compareCount > 0 && (
              <button
                type="button"
                onClick={onOpenCompare}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer whitespace-nowrap"
              >
                <GitCompare className="w-3.5 h-3.5 text-amber-700" />
                Compare ({compareCount})
              </button>
            )}

            {effectiveRole !== 'visitor' ? (
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleNav(isStaff ? 'staff_console' : 'customer_portal')
                  }
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                >
                  {activeUserLabel}
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  title={isSignedInFirebase ? 'Sign Out' : 'Exit Role Preview'}
                  className="p-2 text-slate-600 hover:text-red-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenLoginPortal('customer')}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Dealer Portal Login
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLoginPortal('staff')}
                  className="px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Staff Login
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((p) => !p)}
              aria-label="Toggle menu"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer with BOTH distinct login entry points */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3 shadow-lg">
          <div className="space-y-1">
            {navLinks.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                  activeView === item.id
                    ? 'bg-slate-100 text-slate-950 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="text-[11px] font-semibold text-slate-500 px-1">
              Account Access Portals
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenLoginPortal('customer');
              }}
              className="w-full py-2.5 px-3 text-xs font-semibold text-white bg-amber-600 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              Customer / Dealer Login & Registration
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenLoginPortal('staff');
              }}
              className="w-full py-2.5 px-3 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              Management / Staff / Admin Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenWorkflowStatus();
              }}
              className="w-full py-2 px-3 text-xs font-medium text-slate-600 hover:text-slate-950 text-center cursor-pointer"
            >
              Platform & Workflow Status
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
