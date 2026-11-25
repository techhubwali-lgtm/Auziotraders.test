import {
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  Menu,
  Phone,
  RefreshCw,
  UserPlus,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildDynamicCurrencyList } from '../data/currencies';
import { OFFICIAL_LOGO_URL } from '../data/landingDefaults';
import { isStaffRole } from '../data/permissions';
import { WORLD_COUNTRIES, getWorldCountryByCode } from '../data/worldCountriesPorts';
import type {
  AppView,
  CurrencyCode,
  LandingPageContent,
  LiveExchangeRateState,
  UserProfile,
  UserRole,
} from '../types/portal';
import { SearchableSelect, type SearchableOption } from './SearchableSelect';

interface NavbarProps {
  activeView: AppView;
  currency: CurrencyCode;
  selectedCountryCode: string;
  selectedPortId: string;
  liveFx: LiveExchangeRateState;
  landingContent: LandingPageContent;
  isAuthenticated: boolean;
  userRole: UserRole;
  userProfile: UserProfile | null;
  onNavigateView: (
    view: AppView,
    opts?: { sourceMode?: 'curated' | 'live_auctions'; anchor?: string }
  ) => void;
  onCurrencyChange: (code: CurrencyCode) => void;
  onCountryChange: (countryCode: string) => void;
  onPortChange: (portId: string) => void;
  onRefreshFx: () => void;
  onOpenLogin: (mode?: 'login' | 'signup') => void;
  onSignOut: () => void;
}

function formatFxTimestamp(iso: string | null): string {
  if (!iso) return 'Unavailable (USD base)';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

export function Navbar({
  activeView,
  currency,
  selectedCountryCode,
  selectedPortId,
  liveFx,
  landingContent,
  isAuthenticated,
  userRole,
  userProfile,
  onNavigateView,
  onCurrencyChange,
  onCountryChange,
  onPortChange,
  onRefreshFx,
  onOpenLogin,
  onSignOut,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const selectedCountry = useMemo(
    () => getWorldCountryByCode(selectedCountryCode),
    [selectedCountryCode]
  );

  const currencyOptions = useMemo<SearchableOption[]>(() => {
    const dynamicCurrencies = buildDynamicCurrencyList(liveFx.rates);
    return dynamicCurrencies.map((c) => {
      const rate = liveFx.rates[c.code];
      const hasRate = c.code === 'USD' || (typeof rate === 'number' && rate > 0);
      return {
        value: c.code,
        label: `${c.flag} ${c.code} (${c.symbol})`,
        sublabel: hasRate
          ? `${c.name}${c.code !== 'USD' && rate ? ` · 1 USD = ${rate.toFixed(rate >= 100 ? 1 : 2)} ${c.code}` : ''}`
          : `${c.name} · Live FX unavailable (shows USD)`,
        badge: c.popular ? 'Popular' : undefined,
        badgeTone: 'neutral',
        searchText: `${c.code} ${c.name} ${c.symbol}`,
      };
    });
  }, [liveFx.rates]);

  const countryOptions = useMemo<SearchableOption[]>(() => {
    return WORLD_COUNTRIES.map((c) => ({
      value: c.code,
      label: c.name,
      sublabel: `${c.region} · ${c.ports.length} port${c.ports.length === 1 ? '' : 's'}`,
      badge: c.supportedShipping ? 'Instant CIF' : 'Custom Quote',
      badgeTone: c.supportedShipping ? 'verified' : 'neutral',
      searchText: `${c.name} ${c.code} ${c.region}`,
    }));
  }, []);

  const portOptions = useMemo<SearchableOption[]>(() => {
    return selectedCountry.ports.map((p) => ({
      value: p.id,
      label: `${p.name}`,
      sublabel: `UN/LOCODE: ${p.unLocode}${p.corridorNote ? ` · ${p.corridorNote}` : ''}`,
      badge: p.rateAvailable ? 'Published Tariff' : 'Quote Required',
      badgeTone: p.rateAvailable ? 'verified' : 'neutral',
      searchText: `${p.name} ${p.unLocode} ${p.countryName}`,
    }));
  }, [selectedCountry]);

  const isStaffUser = isAuthenticated && isStaffRole(userRole);

  const dashboardView: AppView = isStaffUser ? 'staff_console' : 'customer_portal';

  const fxFooterNote = liveFx.ok
    ? `Updated: ${formatFxTimestamp(liveFx.updatedAt)} · Rates By Exchange Rate API (exchangerate-api.com)${liveFx.stale ? ' · Saved cache' : ''}`
    : liveFx.error || liveFx.message || 'Live FX unavailable — showing saved USD prices.';

  const navLinks: Array<{
    id: string;
    label: string;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      id: 'home',
      label: 'Home',
      active: activeView === 'home' || activeView === 'catalog',
      onClick: () => onNavigateView('home'),
    },
    {
      id: 'guide-services-about',
      label: 'Services & How to Buy',
      active: activeView === 'how_to_buy',
      onClick: () => onNavigateView('how_to_buy'),
    },
    {
      id: 'vessel-tracking',
      label: 'Vessel Tracking',
      active: activeView === 'vessel_tracking',
      onClick: () => onNavigateView('vessel_tracking'),
    },
    {
      id: 'track',
      label: 'Track Order',
      active: activeView === 'track',
      onClick: () => onNavigateView('track'),
    },
    {
      id: 'contact',
      label: 'Contact Us',
      active: false,
      onClick: () => onNavigateView('home', { anchor: 'contact' }),
    },
  ];

  return (
    <header className="sticky top-0 z-50 no-print shadow-xs">
      {/* Top Utility Bar: Currency, Country, Port & Verified Contact */}
      <div className="bg-slate-950 text-slate-200 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Contact Information */}
          <div className="hidden md:flex items-center gap-4 text-slate-300">
            <a
              href={`tel:${landingContent.contactPhone.replace(/\s+/g, '')}`}
              className="inline-flex items-center gap-1.5 hover:text-amber-400 transition-colors whitespace-nowrap"
            >
              <Phone className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-mono text-[11px]">{landingContent.contactPhone}</span>
            </a>
            <a
              href={`mailto:${landingContent.contactEmail}`}
              className="inline-flex items-center gap-1.5 hover:text-amber-400 transition-colors whitespace-nowrap"
            >
              <Mail className="w-3.5 h-3.5 text-amber-500" />
              <span>{landingContent.contactEmail}</span>
            </a>
          </div>

          {/* Global Currency, Country & Destination Port Selectors */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-1.5 flex-wrap">
              <SearchableSelect
                ariaLabel="Select global currency"
                value={currency}
                options={currencyOptions}
                onChange={onCurrencyChange}
                searchPlaceholder="Search currency, code, symbol..."
                variant="dark"
                align="right"
                compact
                footerNote={fxFooterNote}
              />

              <SearchableSelect
                ariaLabel="Select destination country"
                value={selectedCountryCode}
                options={countryOptions}
                onChange={onCountryChange}
                searchPlaceholder="Search all countries..."
                variant="dark"
                align="right"
                triggerPrefix="To:"
                compact
              />

              <SearchableSelect
                ariaLabel="Select destination shipping port"
                value={selectedPortId}
                options={portOptions}
                onChange={onPortChange}
                searchPlaceholder="Search UN/LOCODE or port..."
                variant="dark"
                align="right"
                triggerPrefix="Port:"
                compact
              />

              <button
                type="button"
                onClick={onRefreshFx}
                title={
                  liveFx.ok
                    ? `Live FX updated ${formatFxTimestamp(liveFx.updatedAt)}. Click to refresh.`
                    : 'Refresh live exchange rates'
                }
                aria-label="Refresh live exchange rates"
                className="p-1.5 rounded-md border border-slate-700 bg-slate-900 text-slate-300 hover:text-amber-400 hover:border-slate-500 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${liveFx.loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Official Brand Logo */}
          <button
            type="button"
            onClick={() => onNavigateView('home')}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer group focus:outline-none"
          >
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Auzio Traders official logo"
              className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-xs bg-white transition-transform group-hover:scale-[1.03]"
            />
            <div className="text-left leading-tight">
              <div className="text-sm sm:text-base font-extrabold tracking-tight text-slate-950">
                AUZIO <span className="text-amber-600">TRADERS</span>
              </div>
              <div className="text-[10px] font-medium text-slate-500 tracking-wide uppercase">
                Japan Auto Export
              </div>
            </div>
          </button>

          {/* Desktop Primary Navigation (5 Clean Consolidated Links) */}
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-1">
            {navLinks.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  item.active
                    ? 'text-amber-600 bg-amber-50'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Single Universal Login CTA (or authenticated Dashboard + Sign Out) */}
          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateView(dashboardView)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    activeView === dashboardView
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-950 hover:bg-slate-800 text-white'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>{userProfile?.displayName?.split(' ')[0] || 'Dashboard'}</span>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Sign out"
                  aria-label="Sign out"
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenLogin('login')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-950 hover:bg-slate-100 border border-slate-200 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-slate-600" />
                  <span>Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLogin('signup')}
                  className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 whitespace-nowrap shrink-0 transition-colors shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up</span>
                </button>
              </div>
            )}

            {/* Mobile & Tablet Hamburger Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile / Tablet Responsive Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {navLinks.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.onClick();
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  item.active
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                {item.label}
              </button>
            ))}

            {!isAuthenticated && (
              <div className="pt-3 mt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenLogin('login');
                    setMobileMenuOpen(false);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 font-semibold text-sm cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenLogin('signup');
                    setMobileMenuOpen(false);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up</span>
                </button>
              </div>
            )}

            <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 px-2">
              <a
                href={`tel:${landingContent.contactPhone.replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-1.5 hover:text-amber-600"
              >
                <Phone className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-mono">{landingContent.contactPhone}</span>
              </a>
              <a
                href={`mailto:${landingContent.contactEmail}`}
                className="inline-flex items-center gap-1.5 hover:text-amber-600"
              >
                <Mail className="w-3.5 h-3.5 text-amber-600" />
                <span>{landingContent.contactEmail}</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
