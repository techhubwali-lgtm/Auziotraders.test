import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  Gavel,
  Landmark,
  ShieldCheck,
  Ship,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import { LANDING_MEDIA, PROCESS_STEPS } from '../data/landingDefaults';
import { EN_COPY } from '../i18n/en';
import type { AppView, CompanySettings, LandingPageContent } from '../types/portal';

interface HowToBuyViewProps {
  settings: CompanySettings;
  landingContent: LandingPageContent;
  onOpenLogin: () => void;
  onOpenSourcingWizard: () => void;
  onNavigateView: (
    view: AppView,
    opts?: { sourceMode?: 'curated' | 'live_auctions'; anchor?: string }
  ) => void;
}

const BUYING_STEPS = [
  {
    step: '01',
    icon: UserPlus,
    title: 'Register Your Buyer or Dealer Account',
    detail:
      'Create a verified Customer or Dealer account with your consignee details, destination country, and preferred discharge port. Your Yokohama export coordinator is assigned automatically.',
  },
  {
    step: '02',
    icon: Gavel,
    title: 'Select Stock or Submit an Auction Sourcing Request',
    detail:
      'Browse available Japanese stock or live Japanese auto auctions (USS, TAA, CAA, HAA). Our team shortlists matching units and translates original Japanese inspection sheets into English.',
  },
  {
    step: '03',
    icon: ShieldCheck,
    title: 'Approve Itemized Quotation & Maximum Bid Ceiling',
    detail:
      'Review our transparent cost breakdown separating fixed charges (Export Docs, JEVIC/QISJ Inspection) from variable estimates (Auction Hammer Price, Ocean Freight) and authorize a strict Maximum Bid Ceiling.',
  },
  {
    step: '04',
    icon: Landmark,
    title: 'Remit Official Bank TT Payment (SMBC Tokyo)',
    detail:
      'Once your vehicle is secured, we issue an official Proforma Invoice with Sumitomo Mitsui Banking Corporation (SMBC) Tokyo SWIFT wire details for secure Bank Telegraphic Transfer settlement.',
  },
  {
    step: '05',
    icon: Ship,
    title: 'Pre-Export Inspection & Vessel Booking',
    detail:
      'Your vehicle enters our Yokohama, Nagoya, Kobe, or Osaka export yard for mandatory destination compliance (QISJ, JEVIC, DAFF Biosecurity, or EAA) and scheduled Ro-Ro or container loading.',
  },
  {
    step: '06',
    icon: FileCheck2,
    title: 'DHL Dispatch of Original Bill of Lading & Clearance',
    detail:
      'Upon vessel departure, digital copies of your Bill of Lading, Export Certificate, English Translation, and Inspection Certificate are uploaded to your portal while originals ship via DHL Express.',
  },
];

export function HowToBuyView({
  settings,
  landingContent,
  onOpenLogin,
  onOpenSourcingWizard,
  onNavigateView,
}: HowToBuyViewProps) {
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [openFaqId, setOpenFaqId] = useState<string | null>(landingContent.faqs[0]?.id || null);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleServiceAction = (
    target: LandingPageContent['services'][number]['ctaTarget']
  ) => {
    if (target === 'catalog') {
      onNavigateView('home', { sourceMode: 'curated', anchor: 'vehicle-catalog' });
    } else if (target === 'live_auctions') {
      onNavigateView('home', { sourceMode: 'live_auctions', anchor: 'vehicle-catalog' });
    } else if (target === 'sourcing') {
      onOpenSourcingWizard();
    } else if (target === 'shipping') {
      onNavigateView('home', { anchor: 'shipping-network' });
    } else if (target === 'how_to_buy') {
      scrollToSection('how-to-buy');
    } else {
      onNavigateView('home', { anchor: 'contact' });
    }
  };

  return (
    <div className="bg-slate-50 text-slate-900">
      {/* Unified Header Banner + In-Page Jump Navigation */}
      <section className="bg-slate-950 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-6">
          <div className="max-w-3xl space-y-3">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">
              Our Services · How to Buy · About Auzio Traders
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Everything You Need to Source, Inspect &amp; Import Vehicles from Japan
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Explore our end-to-end Japanese vehicle export services, step-by-step international
              purchasing procedure, corporate banking details, and company background—all in one
              place.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => scrollToSection('services')}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 font-semibold text-white cursor-pointer"
              >
                Our Services
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('how-to-buy')}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 font-semibold text-white cursor-pointer"
              >
                How to Buy
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('about')}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 font-semibold text-white cursor-pointer"
              >
                About Us
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('faq')}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 font-semibold text-white cursor-pointer"
              >
                FAQ
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
              >
                <Building2 className="w-4 h-4" />
                <span>Sign In / Register Buyer Account</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onNavigateView('home', { sourceMode: 'curated', anchor: 'vehicle-catalog' })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold cursor-pointer"
              >
                <span>Browse Stock &amp; Live Auctions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 1: OUR SERVICES (8 Core Automotive Export Services)
      ====================================================================== */}
      <section id="services" className="py-14 sm:py-18 bg-white border-b border-slate-200 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
              End-to-End Automotive Trade
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight mt-1">
              Our Services
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Comprehensive vehicle sourcing, live Japanese auction bidding, pre-shipment
              inspections, and global ocean freight tailored for individual buyers and dealerships.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {landingContent.services.map((svc, idx) => {
              const showPhoto = idx < 4;
              const imgSrc = LANDING_MEDIA[svc.imageKey] || LANDING_MEDIA.yard;
              return (
                <div
                  key={svc.id}
                  className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all"
                >
                  <div>
                    {showPhoto ? (
                      <div className="aspect-[16/10] bg-slate-200 overflow-hidden">
                        <img
                          src={imgSrc}
                          alt={svc.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="px-5 pt-5">
                        <div className="w-10 h-10 rounded-lg bg-slate-950 text-amber-400 flex items-center justify-center">
                          {idx === 4 && <ShieldCheck className="w-5 h-5" />}
                          {idx === 5 && <Ship className="w-5 h-5" />}
                          {idx === 6 && <FileCheck2 className="w-5 h-5" />}
                          {idx >= 7 && <Building2 className="w-5 h-5" />}
                        </div>
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="text-base font-bold text-slate-950">{svc.title}</h3>
                      <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                        {svc.description}
                      </p>
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <button
                      type="button"
                      onClick={() => handleServiceAction(svc.ctaTarget)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-600 cursor-pointer"
                    >
                      <span>{svc.ctaLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: HOW TO BUY (5-Step Process + 6-Step Detailed Guide + Bank TT)
      ====================================================================== */}
      <section id="how-to-buy" className="py-14 sm:py-18 bg-slate-50 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
              International Export Procedure
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight mt-1">
              How to Buy — Step-by-Step Process
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              A transparent workflow from Japanese vehicle selection and written Max Bid Ceiling
              authorization to SMBC Tokyo Bank TT settlement and vessel arrival.
            </p>
          </div>

          {/* Interactive 5-Step Overview Strip */}
          <div className="bg-slate-950 text-white rounded-2xl p-6 sm:p-8">
            <div className="relative">
              <div
                className="hidden lg:block absolute top-7 left-10 right-10 h-0.5 bg-slate-800"
                aria-hidden="true"
              >
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${(activeStepIdx / (PROCESS_STEPS.length - 1)) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
                {PROCESS_STEPS.map((item, idx) => {
                  const isActive = idx === activeStepIdx;
                  const isDone = idx < activeStepIdx;
                  return (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => setActiveStepIdx(idx)}
                      onMouseEnter={() => setActiveStepIdx(idx)}
                      className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 border-amber-500 shadow-lg shadow-amber-500/10'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg font-mono text-xs font-extrabold flex items-center justify-center mb-3 transition-colors ${
                          isActive
                            ? 'bg-amber-500 text-slate-950'
                            : isDone
                              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.step}
                      </div>
                      <h3 className="text-sm font-bold text-white">{item.title}</h3>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Detailed 6-Stage Trade Execution Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BUYING_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 flex flex-col shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-slate-950 text-amber-400 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-2xl font-extrabold text-slate-200">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-950">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed flex-1">
                    {item.detail}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Official Banking & Honest Workflow Reference */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-950 text-white rounded-2xl p-6 space-y-3">
              <div className="text-xs font-mono text-amber-400 uppercase tracking-wider">
                Official Remittance Bank (Bank TT Only)
              </div>
              <h3 className="text-lg font-bold">{settings.bankName}</h3>
              <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                <div>Branch: {settings.bankBranch}</div>
                <div>Beneficiary: {settings.accountName}</div>
                <div>Account No.: {settings.accountNumber}</div>
                <div>SWIFT / BIC: {settings.swiftCode}</div>
                <div>Bank Address: {settings.bankAddress}</div>
              </div>
              <p className="text-xs text-amber-300 pt-2">
                Always verify the beneficiary name matches {settings.accountName} and quote your
                exact Proforma Invoice number on every Bank TT transfer slip.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-3">
              <div className="text-xs font-mono font-semibold text-amber-900 uppercase tracking-wider">
                Transparent Operations Commitment
              </div>
              <h3 className="text-lg font-bold text-slate-950">Staff-Managed Trade Governance</h3>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 leading-relaxed list-disc pl-4">
                <li>{EN_COPY.transparency.auctionNotice}</li>
                <li>{EN_COPY.transparency.vesselNotice}</li>
                <li>{EN_COPY.transparency.paymentNotice}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: ABOUT AUZIO TRADERS
      ====================================================================== */}
      <section id="about" className="py-14 sm:py-18 bg-white border-y border-slate-200 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-6">
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-md">
                <img
                  src={landingContent.aboutImageUrl || LANDING_MEDIA.inspection}
                  alt="Auzio Traders specialist performing pre-shipment Japanese vehicle inspection in Yokohama"
                  loading="lazy"
                  className="w-full h-full object-cover aspect-[4/3]"
                />
              </div>
            </div>

            <div className="lg:col-span-6 space-y-5">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
                About Auzio Traders
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
                {landingContent.aboutHeadline}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {landingContent.aboutIntro}
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">
                {landingContent.aboutMission}
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">
                {landingContent.aboutTransparency}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-slate-800">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Licensed Yokohama Export Operations</span>
                </div>
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Written Max Bid Ceiling Protection</span>
                </div>
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>SMBC Corporate Bank TT Settlement</span>
                </div>
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>JEVIC, QISJ, EAA, MPI &amp; DAFF Support</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 4: FREQUENTLY ASKED QUESTIONS
      ====================================================================== */}
      <section id="faq" className="py-14 sm:py-18 bg-slate-50 scroll-mt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600">
              Export Clarity
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight mt-1">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Direct answers on purchasing, Bank TT payments, FOB vs. CIF pricing, inspections,
              and live Japanese car auctions.
            </p>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden bg-white">
            {landingContent.faqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="text-sm sm:text-base font-bold text-slate-950">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180 text-amber-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
