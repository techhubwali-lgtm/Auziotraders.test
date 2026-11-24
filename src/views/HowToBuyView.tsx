import {
  Building2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Gavel,
  Landmark,
  ShieldCheck,
  Ship,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import { EN_COPY } from '../i18n/en';
import type { CompanySettings, LoginPortalType } from '../types/portal';

interface HowToBuyViewProps {
  settings: CompanySettings;
  onOpenLoginPortal: (portal: LoginPortalType) => void;
  onNavigateCatalog: () => void;
}

const BUYING_STEPS = [
  {
    step: '01',
    icon: UserPlus,
    title: 'Register Your Dealer / Importer Account',
    detail:
      'Create a verified Customer / Dealer account with your consignee company name, discharge port, and billing address. Once registered, your dedicated Yokohama export coordinator is assigned.',
  },
  {
    step: '02',
    icon: Gavel,
    title: 'Select Stock or Submit a Guided Auction Sourcing Request',
    detail:
      'Choose immediately available AUZIO Physical Stock or submit a custom Sourcing Request for USS, TAA, CAA, or HAA Japanese auto auctions. Our team shortlists matching units and translates the original Japanese auction inspection sheets into English.',
  },
  {
    step: '03',
    icon: ShieldCheck,
    title: 'Approve Itemized Quotation & Maximum Bid Ceiling',
    detail:
      'Review our transparent breakdown separating fixed charges (Export Docs, JEVIC/QISJ Inspection) from variable estimates (Auction Hammer Price, Ocean Freight). For auction bids, you explicitly authorize a strict Maximum Bid Ceiling—our system blocks any staff bid above your ceiling.',
  },
  {
    step: '04',
    icon: Landmark,
    title: 'Remit Official Bank TT Payment (SMBC Tokyo)',
    detail:
      'Upon securing your vehicle, we issue a signed AUZIO TRADERS Proforma Invoice (valid 14 days) with our Sumitomo Mitsui Banking Corporation (SMBC) Tokyo SWIFT details. We settle exclusively via verifiable Bank Telegraphic Transfer (TT)—never unverified card gateways.',
  },
  {
    step: '05',
    icon: Ship,
    title: 'Pre-Export Inspection & Carrier Vessel Booking',
    detail:
      'Your vehicle moves to our Yokohama, Nagoya, Kobe, or Osaka export yard for mandatory destination compliance (QISJ, JEVIC, DAFF Biosecurity, or EAA) and Ro-Ro / Container vessel loading. Track all 14 milestones in your portal.',
  },
  {
    step: '06',
    icon: FileCheck2,
    title: 'DHL Dispatch of Original Bill of Lading & Port Clearance',
    detail:
      'Once the vessel sails, digital copies of the Bill of Lading (B/L), Export Certificate, English Translation, and Inspection Certificate are published to your Document Vault while originals are couriered via DHL Express.',
  },
];

const FAQS = [
  {
    q: 'Are auction listings on the portal already owned by AUZIO TRADERS?',
    a: 'No. We clearly separate "Auzio Physical Stock" (owned in our Japanese export yards), "Supplier / Partner Stock" (verified Japanese dealer partners), and "Auction Listing — Not Yet Purchased" (upcoming USS/TAA/CAA lots subject to live auction outcome and your Maximum Bid Ceiling approval).',
  },
  {
    q: 'How does the Maximum Bid Ceiling protection work?',
    a: 'When you approve an auction quotation, your authorized USD ceiling is recorded with a timestamp and your user ID in our immutable audit log. Both our Staff Console and our Firestore database security rules strictly reject any bid attempt exceeding your approved ceiling.',
  },
  {
    q: 'Can I pay by credit card or online checkout?',
    a: 'No. High-value international vehicle exports require formal customs and banking compliance. All AUZIO TRADERS invoices are settled exclusively via Bank Telegraphic Transfer (TT) to our corporate SMBC Tokyo account listed on your official Proforma Invoice.',
  },
  {
    q: 'Are vessel schedules (ETD/ETA) real-time satellite feeds?',
    a: 'No. Ro-Ro and container carrier schedules (Vessel Name, Voyage #, B/L #, ETD/ETA) are manually entered and verified by our Yokohama Operations Desk upon carrier booking confirmation, and marked as Estimated until final gate-in and sailing.',
  },
  {
    q: 'Which pre-export inspections do you arrange?',
    a: 'We arrange QISJ (Kenya), JEVIC (Zambia, Uganda, New Zealand, South Africa, Zimbabwe), EAA/TBS (Tanzania), DAFF Biosecurity & Heat Wash (Australia), and Export Deregistration Translations (UK & Caribbean) directly at our Japan export yards.',
  },
];

export function HowToBuyView({
  settings,
  onOpenLoginPortal,
  onNavigateCatalog,
}: HowToBuyViewProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Header */}
      <div className="space-y-3 border-b border-slate-200 pb-8">
        <div className="text-xs font-mono font-semibold text-amber-700 uppercase tracking-wider">
          International Export Procedure
        </div>
        <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">
          How to Source, Bid &amp; Import with {EN_COPY.brandName}
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
          A transparent 6-step trade workflow from Yokohama to 14 global destination markets—with
          enforced bid ceiling governance, official SMBC Tokyo Bank TT settlement, and 14-stage
          shipment visibility.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => onOpenLoginPortal('customer')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 cursor-pointer"
          >
            <Building2 className="w-4 h-4" />
            Register / Open Dealer Portal
          </button>
          <button
            type="button"
            onClick={onNavigateCatalog}
            className="px-5 py-2.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Browse Live Stock Catalogue
          </button>
        </div>
      </div>

      {/* 6-Step Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {BUYING_STEPS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.step}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 flex flex-col"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-slate-950 text-amber-400 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-mono text-2xl font-extrabold text-slate-200">
                  {item.step}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-950">{item.title}</h2>
              <p className="text-xs text-slate-600 leading-relaxed flex-1">{item.detail}</p>
            </div>
          );
        })}
      </div>

      {/* Official Banking & Honest Workflow Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-950 text-white rounded-xl p-6 space-y-3">
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
          <p className="text-[11px] text-amber-300 pt-2">
            Always verify the beneficiary name matches {settings.accountName} and quote your exact
            Proforma Invoice number on every Bank TT transfer slip.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-3">
          <div className="text-xs font-mono font-semibold text-amber-900 uppercase tracking-wider">
            Honest Workflow Notice
          </div>
          <h3 className="text-lg font-bold text-slate-950">Staff-Managed Trade Operations</h3>
          <ul className="space-y-2 text-xs text-slate-700 leading-relaxed list-disc pl-4">
            <li>{EN_COPY.transparency.auctionNotice}</li>
            <li>{EN_COPY.transparency.vesselNotice}</li>
            <li>{EN_COPY.transparency.paymentNotice}</li>
          </ul>
        </div>
      </div>

      {/* Buyer FAQ Accordion */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950">Frequently Asked Buyer Questions</h2>
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={faq.q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 cursor-pointer"
                >
                  <span className="text-sm font-semibold text-slate-950">{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-xs text-slate-600 leading-relaxed">{faq.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
