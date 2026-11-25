import {
  Anchor,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileCheck2,
  Gavel,
  Globe2,
  Headphones,
  LayoutDashboard,
  LogIn,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Radar,
  Send,
  ShieldCheck,
  Ship,
  Star,
  UserPlus,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { InteractiveWorldMap } from '../components/InteractiveWorldMap';
import { SearchableSelect, type SearchableOption } from '../components/SearchableSelect';
import { LANDING_MEDIA, WHY_CHOOSE_ITEMS } from '../data/landingDefaults';
import { formatMoney, getPortById } from '../data/ports';
import { WORLD_COUNTRIES, getWorldCountryByCode } from '../data/worldCountriesPorts';
import type {
  AppView,
  CatalogSourceMode,
  CifBreakdown,
  CompanySettings,
  CurrencyCode,
  CustomerTestimonial,
  DealerStockVehicle,
  LandingPageContent,
  LiveExchangeRateState,
  UserProfile,
  Vehicle,
} from '../types/portal';
import { CatalogView } from './CatalogView';

interface LandingViewProps {
  vehicles: Vehicle[];
  dealerStock: DealerStockVehicle[];
  currency: CurrencyCode;
  liveFx: LiveExchangeRateState;
  settings: CompanySettings;
  selectedCountryCode: string;
  selectedPortId: string;
  catalogSourceMode: CatalogSourceMode;
  landingContent: LandingPageContent;
  testimonials: CustomerTestimonial[];
  compareIds: string[];
  canImportToFirestore: boolean;
  isAuthenticated: boolean;
  userProfile: UserProfile | null;
  onOpenLogin: (mode?: 'login' | 'signup') => void;
  onOpenDashboard: () => void;
  onCountryChange: (countryCode: string) => void;
  onPortChange: (portId: string) => void;
  onSourceModeChange: (mode: CatalogSourceMode) => void;
  onDealerInquirySubmitted?: (code: string) => void;
  onNavigateView: (
    view: AppView,
    opts?: { sourceMode?: CatalogSourceMode; anchor?: string }
  ) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onOpenProforma: (params: { vehicle: Vehicle; cif: CifBreakdown }) => void;
  onStartBidRequest: (vehicle: Vehicle) => void;
  onRequestShippingQuote: (vehicle: Vehicle) => void;
  onOpenSourcingWizard: () => void;
  onOpenWorkflowStatus: () => void;
  onToggleCompare: (vehicleId: string) => void;
  onImportLiveLot: (vehicle: Vehicle) => void;
  onRegisterLiveVehicles: (items: Vehicle[]) => void;
  onSubmitGeneralInquiry: (input: {
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string;
    buyerCountry: string;
    destinationPortId: string;
    destinationPortName: string;
    subject: string;
    message: string;
  }) => Promise<string>;
}

const WHY_ICONS = [Gavel, ShieldCheck, FileCheck2, Ship, Headphones, Radar];

const JAPAN_EXPORT_PORTS = [
  { name: 'Yokohama', code: 'JPYOK', note: 'Headquarters & main East/Southern Africa & Oceania Ro-Ro hub' },
  { name: 'Nagoya', code: 'JPNGO', note: 'Major Toyota & commercial fleet loading terminal' },
  { name: 'Kobe', code: 'JPUKB', note: 'Kansai auction corridor & container consolidation' },
  { name: 'Osaka', code: 'JPOSA', note: 'Scheduled Asia, Middle East & Caribbean sailings' },
  { name: 'Hakata', code: 'JPHKT', note: 'Kyushu rapid export dispatch terminal' },
];

function AnimatedCounter({
  target,
  suffix,
  displayText,
  active,
}: {
  target: number | null;
  suffix: string;
  displayText?: string;
  active: boolean;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (target === null) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!active || prefersReduced) {
      setCurrent(target);
      return;
    }

    let frameId = 0;
    const duration = 1200;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, active]);

  if (target === null) {
    return <span>{displayText || 'Direct'}</span>;
  }
  return (
    <span className="tabular-nums">
      {current.toLocaleString('en-US')}
      {suffix}
    </span>
  );
}

export function LandingView({
  vehicles,
  dealerStock,
  currency,
  liveFx,
  settings,
  selectedCountryCode,
  selectedPortId,
  catalogSourceMode,
  landingContent,
  testimonials,
  compareIds,
  canImportToFirestore,
  isAuthenticated,
  userProfile,
  onOpenLogin,
  onOpenDashboard,
  onCountryChange,
  onPortChange,
  onSourceModeChange,
  onDealerInquirySubmitted,
  onNavigateView,
  onSelectVehicle,
  onOpenProforma,
  onStartBidRequest,
  onRequestShippingQuote,
  onOpenSourcingWizard,
  onOpenWorkflowStatus,
  onToggleCompare,
  onImportLiveLot,
  onRegisterLiveVehicles,
  onSubmitGeneralInquiry,
}: LandingViewProps) {
  // Animated stats intersection observer
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    const el = statsRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setStatsVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStatsVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Testimonials carousel index
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  // Contact / Shipping Quote form
  const activeCountry = useMemo(
    () => getWorldCountryByCode(selectedCountryCode),
    [selectedCountryCode]
  );
  const activePort = useMemo(() => getPortById(selectedPortId), [selectedPortId]);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactSubject, setContactSubject] = useState('Vehicle / Shipping Quote Request');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactTrackingCode, setContactTrackingCode] = useState('');
  const [contactError, setContactError] = useState('');

  const fmt = (usd: number) => formatMoney(usd, currency, liveFx.rates);

  const countryOptions = useMemo<SearchableOption[]>(
    () =>
      WORLD_COUNTRIES.map((c) => ({
        value: c.code,
        label: c.name,
        sublabel: `${c.region} · ${c.ports.length} UN/LOCODE port${c.ports.length === 1 ? '' : 's'}`,
        badge: c.supportedShipping ? 'Published Tariff' : 'Custom Quote',
        badgeTone: c.supportedShipping ? 'verified' : 'neutral',
        searchText: `${c.name} ${c.code} ${c.region}`,
      })),
    []
  );

  const portOptions = useMemo<SearchableOption[]>(
    () =>
      activeCountry.ports.map((p) => ({
        value: p.id,
        label: `${p.name} (${p.unLocode})`,
        sublabel: p.corridorNote || `${p.countryName} · UN/LOCODE ${p.unLocode}`,
        badge: p.rateAvailable ? 'Instant CIF' : 'Quote Required',
        badgeTone: p.rateAvailable ? 'verified' : 'neutral',
        searchText: `${p.name} ${p.unLocode} ${p.countryName}`,
      })),
    [activeCountry]
  );

  const jumpToCatalog = (mode: 'curated' | 'live_auctions') => {
    onSourceModeChange(mode);
    const el = document.getElementById('vehicle-catalog');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToContactWithSubject = (subject: string, prefillMsg?: string) => {
    setContactSubject(subject);
    if (prefillMsg) setContactMessage(prefillMsg);
    const el = document.getElementById('contact');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) return;
    setContactSubmitting(true);
    setContactError('');
    try {
      const code = await onSubmitGeneralInquiry({
        buyerName: contactName.trim(),
        buyerEmail: contactEmail.trim(),
        buyerPhone: contactPhone.trim(),
        buyerCountry: activeCountry.name,
        destinationPortId: activePort.id,
        destinationPortName: `${activePort.name}, ${activePort.country}${activePort.unLocode ? ` (${activePort.unLocode})` : ''}`,
        subject: contactSubject,
        message: contactMessage.trim(),
      });
      setContactTrackingCode(code);
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactMessage('');
    } catch {
      setContactError(
        'We could not submit your inquiry right now. Please try again or reach us directly on WhatsApp.'
      );
    } finally {
      setContactSubmitting(false);
    }
  };

  const approvedTestimonials = useMemo(
    () => testimonials.filter((t) => t.approved),
    [testimonials]
  );

  return (
    <div className="bg-slate-50 text-slate-900">
      {/* Optional Admin CMS Promotional Banner */}
      {landingContent.promoBannerEnabled && landingContent.promoBannerText && (
        <div className="bg-amber-500 text-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-center">
            <span>{landingContent.promoBannerText}</span>
            {landingContent.promoBannerCtaLabel && (
              <button
                type="button"
                onClick={() => jumpToCatalog('live_auctions')}
                className="underline font-bold hover:text-slate-800 cursor-pointer"
              >
                {landingContent.promoBannerCtaLabel} &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 1: HERO SECTION (Full-Bleed Cinematic Export Showcase)
      ====================================================================== */}
      <section className="relative bg-slate-950 text-white overflow-hidden">
        {/* Full-Bleed Automotive & Yokohama Port Backdrop */}
        <div className="absolute inset-0">
          <img
            src={landingContent.heroImageUrl || LANDING_MEDIA.yard}
            alt="Japanese used vehicles staged at Yokohama export port beside international Ro-Ro car carrier ship"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center auzio-hero-zoom"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-slate-950/45" />
        </div>

        {/* Main Hero Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12 sm:pt-20 sm:pb-16 lg:pt-24 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end">
            {/* Left Column: Commanding Editorial Copy & Focused Actions */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-3 text-xs sm:text-sm font-semibold tracking-wide text-amber-400">
                <span className="w-8 h-px bg-amber-400 shrink-0" aria-hidden="true" />
                <span>{landingContent.heroSecondaryHeadline}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-[3.35rem] font-extrabold tracking-tight leading-[1.06] text-white [text-wrap:balance] max-w-2xl">
                {landingContent.heroHeadline}
              </h1>

              <p className="text-base sm:text-lg text-slate-200/95 leading-relaxed max-w-xl">
                {landingContent.heroDescription}
              </p>

              {/* Focused CTA Hierarchy: 1 Primary + 1 Secondary + 1 Quiet Action Link */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => jumpToCatalog('curated')}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-amber-500/20 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Browse Available Stock</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => jumpToCatalog('live_auctions')}
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg bg-white/10 hover:bg-white/18 backdrop-blur-md border border-white/20 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Gavel className="w-4 h-4 text-amber-400" />
                  <span>Explore Live Auctions</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenSourcingWizard}
                  className="inline-flex items-center gap-1.5 px-2 py-2 text-sm font-semibold text-slate-200 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Request a Vehicle</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Column: Sleek Translucent Export Corridor & Account Access Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-slate-950/75 backdrop-blur-md border border-white/15 p-6 shadow-2xl space-y-5">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <div className="text-xs font-medium text-slate-400">Active Export Corridor</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      Japan &rarr; {activePort.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById('shipping-network')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Change Port
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-xs">
                  <div>
                    <dt className="text-slate-400">Departure Hubs</dt>
                    <dd className="font-semibold text-white mt-1">Yokohama · Nagoya · Kobe</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Destination Country</dt>
                    <dd className="font-semibold text-white mt-1 truncate">{activeCountry.name}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Pricing Basis</dt>
                    <dd className="font-semibold text-amber-400 mt-1 tabular-nums">
                      FOB &amp; Live CIF ({currency})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Pre-Export Checks</dt>
                    <dd className="font-semibold text-white mt-1">JEVIC · QISJ · Auction Sheet</dd>
                  </div>
                </dl>

                {/* Account Login & Sign Up / Active Dashboard Access */}
                <div className="pt-4 border-t border-white/10">
                  {isAuthenticated ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Signed in as</span>
                        <span className="font-semibold text-white truncate max-w-[60%]">
                          {userProfile?.displayName || 'Member'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenDashboard}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Open My Dashboard</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs text-slate-300">
                        Buyer, Dealer, or Team Portal Access
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => onOpenLogin('login')}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/18 border border-white/15 text-white font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <LogIn className="w-3.5 h-3.5 text-amber-400" />
                          <span>Login</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenLogin('signup')}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Sign Up</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clean Architectural Bottom Trust Bar */}
        <div className="relative border-t border-white/10 bg-slate-950/65 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-slate-300">
              <span>Licensed Japanese Vehicle Exporter</span>
              <span className="hidden sm:inline text-slate-600" aria-hidden="true">
                ·
              </span>
              <span>Direct USS, TAA, HAA &amp; JU Auction Access</span>
              <span className="hidden sm:inline text-slate-600" aria-hidden="true">
                ·
              </span>
              <span>Transparent FOB &amp; CIF Invoices</span>
              <span className="hidden sm:inline text-slate-600" aria-hidden="true">
                ·
              </span>
              <span>Worldwide Ro-Ro &amp; Container Logistics</span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: ANIMATED COMPANY STATISTICS STRIP
      ====================================================================== */}
      <section ref={statsRef} className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {landingContent.stats.map((stat) => (
              <div
                key={stat.id}
                className="flex flex-col justify-between p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200/80"
              >
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 font-mono">
                  <AnimatedCounter
                    target={stat.value}
                    suffix={stat.suffix}
                    displayText={stat.displayText}
                    active={statsVisible}
                  />
                </div>
                <div className="mt-1.5">
                  <div className="text-sm font-bold text-slate-900">{stat.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{stat.sublabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: UNIFIED BROWSE STOCK & LIVE JAPANESE AUCTIONS STOREFRONT
      ====================================================================== */}
      <section
        id="vehicle-catalog"
        className="py-10 sm:py-14 bg-slate-50 border-b border-slate-200 scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
                Direct Yokohama Stock &amp; Real-Time Auction Lanes
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight mt-1">
                Browse Stock &amp; Live Japanese Auctions
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Switch seamlessly between inspected Auzio export stock and live Japanese dealer
                auctions with real-time CIF estimates to{' '}
                <strong className="text-slate-900">
                  {activePort.name}, {activePort.country}
                </strong>
                .
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSourceModeChange('curated')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  catalogSourceMode === 'curated'
                    ? 'bg-slate-950 text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:border-slate-900'
                }`}
              >
                Available Stock
              </button>
              <button
                type="button"
                onClick={() => onSourceModeChange('live_auctions')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  catalogSourceMode === 'live_auctions'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-white border border-slate-300 text-slate-700 hover:border-amber-500'
                }`}
              >
                <Gavel className="w-3.5 h-3.5" />
                <span>Live Auctions</span>
              </button>
              <button
                type="button"
                onClick={() => onSourceModeChange('dealer_stock')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  catalogSourceMode === 'dealer_stock'
                    ? 'bg-slate-950 text-amber-400'
                    : 'bg-white border border-slate-300 text-slate-700 hover:border-amber-500'
                }`}
              >
                <span>Japanese Dealer Stock</span>
              </button>
            </div>
          </div>
        </div>

        <CatalogView
          embedded
          vehicles={vehicles}
          dealerStock={dealerStock}
          currency={currency}
          selectedPortId={selectedPortId}
          settings={settings}
          liveFxRates={liveFx.rates}
          externalSourceMode={catalogSourceMode}
          compareIds={compareIds}
          canImportToFirestore={canImportToFirestore}
          onSourceModeChange={onSourceModeChange}
          onDealerInquirySubmitted={onDealerInquirySubmitted}
          onRegisterLiveVehicles={onRegisterLiveVehicles}
          onImportLiveLot={onImportLiveLot}
          onToggleCompare={onToggleCompare}
          onSelectVehicle={onSelectVehicle}
          onOpenProforma={onOpenProforma}
          onStartBidRequest={onStartBidRequest}
          onRequestShippingQuote={onRequestShippingQuote}
          onOpenSourcingWizard={onOpenSourcingWizard}
          onOpenWorkflowStatus={onOpenWorkflowStatus}
          onNavigateShipping={() => {
            document.getElementById('shipping-network')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </section>

      {/* =====================================================================
          SECTION 4: WHY CHOOSE AUZIO TRADERS? (6 Trust Cards + Services Link)
      ====================================================================== */}
      <section className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div className="max-w-2xl">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
                Trusted Japanese Vehicle Exporter
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight mt-1">
                Why Choose Auzio Traders?
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-2">
                Every purchase is backed by verifiable Japanese inspection records, transparent
                commercial terms, and licensed Yokohama export logistics.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigateView('how_to_buy', { anchor: 'services' })}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <span>Our Services &amp; How to Buy</span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateView('how_to_buy', { anchor: 'about' })}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:border-slate-900 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                <span>About Auzio Traders</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_CHOOSE_ITEMS.map((item, idx) => {
              const Icon = WHY_ICONS[idx % WHY_ICONS.length];
              return (
                <div
                  key={item.id}
                  className="bg-slate-50 rounded-2xl border border-slate-200 p-6 hover:bg-white hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-950">{item.title}</h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 5: GLOBAL SHIPPING NETWORK
      ====================================================================== */}
      <section id="shipping-network" className="py-16 sm:py-20 bg-slate-50 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
                Worldwide Maritime Logistics
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight mt-1">
                Global Shipping Network
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-2">
                Select any country and UN/LOCODE shipping port below to view verified Ro-Ro and
                container rates from Japan or request a custom freight quote.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateView('shipping')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 hover:text-amber-600 cursor-pointer self-start lg:self-end"
            >
              <span>Open Full Port &amp; CIF Calculator</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <InteractiveWorldMap
            selectedPortId={selectedPortId}
            onSelectDestination={(cCode, pId) => {
              onCountryChange(cCode);
              onPortChange(pId);
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Destination Country & Port Rate Lookup Card */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                <Globe2 className="w-4 h-4 text-amber-600" />
                <span>Check Destination Port Availability &amp; Rates</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Destination Country / Territory
                  </label>
                  <SearchableSelect
                    ariaLabel="Shipping network country selector"
                    value={selectedCountryCode}
                    options={countryOptions}
                    onChange={onCountryChange}
                    searchPlaceholder="Search all 195+ countries..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Destination Port (UN/LOCODE)
                  </label>
                  <SearchableSelect
                    ariaLabel="Shipping network port selector"
                    value={selectedPortId}
                    options={portOptions}
                    onChange={onPortChange}
                    searchPlaceholder="Filter port name or UN/LOCODE..."
                  />
                </div>
              </div>

              {activePort.rateAvailable !== false && activePort.roroRatePerM3Usd > 0 ? (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-950">
                        {activePort.name}, {activePort.country}
                        {activePort.unLocode && (
                          <span className="ml-2 font-mono text-xs text-slate-500">
                            [{activePort.unLocode}]
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">{activePort.corridorNote}</div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700">
                      Supported Destination
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 text-xs">
                    <div>
                      <div className="text-slate-500">Ro-Ro Tariff</div>
                      <div className="font-mono font-bold text-slate-950 mt-0.5 tabular-nums">
                        {fmt(activePort.roroRatePerM3Usd)} / m³
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">20ft Container</div>
                      <div className="font-mono font-bold text-slate-950 mt-0.5 tabular-nums">
                        {fmt(activePort.container20ftUsd)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Inspection</div>
                      <div className="font-mono font-bold text-slate-950 mt-0.5 tabular-nums">
                        {fmt(activePort.inspectionFeeUsd)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Est. Sea Transit</div>
                      <div className="font-mono font-bold text-slate-950 mt-0.5">
                        {activePort.transitDaysMin}–{activePort.transitDaysMax} days
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-slate-950">
                      Custom Shipping Quote Required — {activePort.name}, {activePort.country}
                      {activePort.unLocode ? ` (${activePort.unLocode})` : ''}
                    </div>
                    <p className="text-xs text-slate-700 mt-1">
                      Published online Ro-Ro/container rates are not yet listed for this destination
                      port. Request an exact carrier tariff from our Yokohama logistics desk.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      scrollToContactWithSubject(
                        `Shipping Quote: ${activePort.name}, ${activePort.country} (${activePort.unLocode || ''})`,
                        `Hello Auzio Traders logistics team, please provide an exact ocean freight quotation (Ro-Ro and Container) from Japan to ${activePort.name}, ${activePort.country} (UN/LOCODE: ${activePort.unLocode || 'N/A'}).`
                      )
                    }
                    className="shrink-0 px-4 py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                  >
                    Request Shipping Quote
                  </button>
                </div>
              )}
            </div>

            {/* Japanese Departure Ports */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-950 mb-4">
                <Anchor className="w-4 h-4 text-amber-600" />
                <span>Japanese Departure Ports</span>
              </div>
              <div className="divide-y divide-slate-100">
                {JAPAN_EXPORT_PORTS.map((jp) => (
                  <div key={jp.code} className="py-2.5 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-950">{jp.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{jp.note}</div>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-slate-600 shrink-0">
                      {jp.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 6: CUSTOMER TESTIMONIALS (Firestore-Backed, Zero Fake Data)
      ====================================================================== */}
      <section
        id="testimonials"
        className="py-16 sm:py-20 bg-white border-y border-slate-200 scroll-mt-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
                Verified Buyer Feedback
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight mt-1">
                Customer Testimonials
              </h2>
              <p className="text-sm text-slate-600 mt-1.5">
                Authentic delivery reviews from verified Auzio Traders international vehicle buyers.
              </p>
            </div>

            {approvedTestimonials.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setTestimonialIdx((prev) =>
                      prev === 0 ? approvedTestimonials.length - 1 : prev - 1
                    )
                  }
                  aria-label="Previous testimonial"
                  className="w-9 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTestimonialIdx((prev) => (prev + 1) % approvedTestimonials.length)
                  }
                  aria-label="Next testimonial"
                  className="w-9 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {approvedTestimonials.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 sm:p-10 text-center max-w-3xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950">
                Verified Customer Reviews — Published Directly from Real Deliveries
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Auzio Traders only publishes genuine, verified customer reviews. Once approved by
                our export management team, buyer testimonials—complete with country, vehicle
                purchased, and star rating—appear automatically here.
              </p>
              <button
                type="button"
                onClick={() =>
                  scrollToContactWithSubject(
                    'Verified Customer Review Submission',
                    'Hello Auzio Traders team, I recently imported a vehicle through Auzio Traders and would like to submit my verified review.'
                  )
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                <span>Share Your Delivery Experience</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {approvedTestimonials
                .slice(testimonialIdx, testimonialIdx + 3)
                .concat(
                  approvedTestimonials.length > 3 &&
                    testimonialIdx + 3 > approvedTestimonials.length
                    ? approvedTestimonials.slice(
                        0,
                        (testimonialIdx + 3) % approvedTestimonials.length
                      )
                    : []
                )
                .slice(0, Math.min(3, approvedTestimonials.length))
                .map((rev) => (
                  <div
                    key={rev.id}
                    className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${i < rev.rating ? 'fill-amber-500' : 'text-slate-200'}`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        &ldquo;{rev.reviewText}&rdquo;
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-200/80 flex items-center gap-3">
                      {rev.photoUrl ? (
                        <img
                          src={rev.photoUrl}
                          alt={rev.customerName}
                          loading="lazy"
                          className="w-10 h-10 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-950 text-amber-400 font-bold text-sm flex items-center justify-center">
                          {rev.customerName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                          <span className="truncate">{rev.customerName}</span>
                          {rev.verified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {rev.country} · {rev.vehiclePurchased}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          SECTION 7: CONTACT US & SHIPPING QUOTE DESK
      ====================================================================== */}
      <section id="contact" className="py-16 sm:py-20 bg-slate-50 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left: Verified Contact Channels */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  Direct Yokohama Export Desk
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight mt-1">
                  Contact Auzio Traders
                </h2>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Need a custom shipping quotation, dealer volume pricing, or auction sheet
                  translation? Reach our Japan export specialists directly.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-950">Headquarters &amp; Export Yard</div>
                    <div className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                      {landingContent.contactAddress}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-950">Telephone</div>
                    <a
                      href={`tel:${landingContent.contactPhone.replace(/\s+/g, '')}`}
                      className="text-slate-600 hover:text-amber-600 font-mono text-xs"
                    >
                      {landingContent.contactPhone}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-950">WhatsApp Direct</div>
                    <a
                      href={`https://wa.me/${landingContent.contactWhatsapp.replace(/[^\d]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:underline font-mono text-xs"
                    >
                      {landingContent.contactWhatsapp}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-950">Export Sales Email</div>
                    <a
                      href={`mailto:${landingContent.contactEmail}`}
                      className="text-slate-600 hover:text-amber-600 text-xs"
                    >
                      {landingContent.contactEmail}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Real Validated Inquiry Form */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                <h3 className="text-lg font-bold text-slate-950">
                  Send an Export or Shipping Quote Inquiry
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Destination pre-filled:{' '}
                  <strong>
                    {activePort.name}, {activeCountry.name}
                  </strong>
                  . Every inquiry generates an official Auzio Traders tracking reference.
                </p>

                {contactTrackingCode && (
                  <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Inquiry Received — Reference:{' '}
                      <span className="font-mono">{contactTrackingCode}</span>
                    </div>
                    <p>
                      Our Yokohama export desk has logged your inquiry and will respond shortly. You
                      can check status anytime via Track Order.
                    </p>
                  </div>
                )}

                {contactError && (
                  <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                    {contactError}
                  </div>
                )}

                <form onSubmit={handleContactSubmit} className="mt-5 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Your name or dealership"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        WhatsApp / Phone Number
                      </label>
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+254 / +61 / +44 ..."
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Inquiry Topic
                      </label>
                      <input
                        type="text"
                        value={contactSubject}
                        onChange={(e) => setContactSubject(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Message &amp; Vehicle Requirements *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Tell us the vehicle make/model, target year, budget, or destination port shipping quote you need..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={contactSubmitting}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-4 h-4 text-amber-400" />
                    <span>{contactSubmitting ? 'Submitting Inquiry...' : 'Submit Inquiry'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 8: FINAL CALL-TO-ACTION BANNER
      ====================================================================== */}
      <section className="relative bg-slate-950 text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${LANDING_MEDIA.shipping})` }}
          aria-hidden="true"
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
            <Compass className="w-4 h-4" />
            <span>Global Vehicle Export From Japan</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Your Next Vehicle Is Waiting in Japan.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Explore verified Japanese used vehicles, access live car auctions, and experience a
            reliable international vehicle export service with Auzio Traders.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => jumpToCatalog('curated')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
            >
              <span>Explore Vehicles</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollToContactWithSubject('Speak With Export Team')}
              className="px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm transition-colors cursor-pointer"
            >
              Contact Our Team
            </button>
            <button
              type="button"
              onClick={() => onNavigateView('how_to_buy')}
              className="px-6 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white font-semibold text-sm transition-colors cursor-pointer"
            >
              Services &amp; How to Buy
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
