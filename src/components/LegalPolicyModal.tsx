import { Shield, Ship, FileText, X } from 'lucide-react';

export type LegalPolicyType = 'privacy' | 'terms' | 'shipping';

interface LegalPolicyModalProps {
  policy: LegalPolicyType;
  contactEmail: string;
  contactAddress: string;
  onClose: () => void;
}

export function LegalPolicyModal({
  policy,
  contactEmail,
  contactAddress,
  onClose,
}: LegalPolicyModalProps) {
  const titles: Record<LegalPolicyType, { title: string; subtitle: string }> = {
    privacy: {
      title: 'Privacy Policy',
      subtitle: 'How Auzio Traders handles buyer, dealer, and export documentation data.',
    },
    terms: {
      title: 'Terms and Conditions',
      subtitle: 'Commercial export terms, auction bidding limits, and bank wire settlement rules.',
    },
    shipping: {
      title: 'International Shipping Policy',
      subtitle: 'Ro-Ro & container booking, pre-shipment inspections, and Bill of Lading dispatch.',
    },
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
        <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {policy === 'privacy' && <Shield className="w-5 h-5 text-amber-400" />}
            {policy === 'terms' && <FileText className="w-5 h-5 text-amber-400" />}
            {policy === 'shipping' && <Ship className="w-5 h-5 text-amber-400" />}
            <div>
              <h2 className="text-base font-bold">{titles[policy].title}</h2>
              <p className="text-xs text-slate-300">{titles[policy].subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close policy dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4 text-sm text-slate-600 leading-relaxed">
          {policy === 'privacy' && (
            <>
              <p>
                Auzio Traders collects only the information necessary to source vehicles, issue
                Proforma Invoices, execute customs export filings in Japan, arrange pre-shipment
                inspections, and dispatch original shipping documents (including Bills of Lading) to
                your designated consignee address.
              </p>
              <h3 className="text-slate-950 font-bold text-sm">1. Data We Collect</h3>
              <p>
                Contact details (name, email, phone/WhatsApp), company/consignee details, preferred
                destination country and port, vehicle sourcing specifications, and order history.
              </p>
              <h3 className="text-slate-950 font-bold text-sm">2. How Data Is Protected</h3>
              <p>
                Customer quotations, order messages, and export documents are stored with strict
                role-based access controls so private trade records are visible only to the account
                owner and authorized Auzio Traders staff. We never sell buyer records to third
                parties.
              </p>
              <h3 className="text-slate-950 font-bold text-sm">3. Privacy Inquiries</h3>
              <p>
                For data access or deletion requests, contact our export compliance desk at{' '}
                <strong className="text-slate-900">{contactEmail}</strong> or write to{' '}
                {contactAddress}.
              </p>
            </>
          )}

          {policy === 'terms' && (
            <>
              <p>
                All vehicle exports arranged by Auzio Traders are governed by the written commercial
                terms stated on your issued Proforma Invoice and approved Quotation.
              </p>
              <h3 className="text-slate-950 font-bold text-sm">1. Live Auction Max Bid Ceiling</h3>
              <p>
                When participating in Japanese auto auctions through Auzio Traders, you authorize an
                explicit written Max Bid Ceiling. Our Yokohama buyers will never place a bid above
                your approved ceiling.
              </p>
              <h3 className="text-slate-950 font-bold text-sm">2. Currency &amp; Bank Wire Settlement</h3>
              <p>
                Currency conversions displayed on the website use live market exchange rates for
                buyer convenience. Official invoices and Bank Telegraphic Transfers (TT) are settled
                in the invoice currency (USD) to our verified Sumitomo Mitsui Banking Corporation
                (SMBC) corporate bank account in Japan.
              </p>
              <h3 className="text-slate-950 font-bold text-sm">3. Destination Import Compliance</h3>
              <p>
                Buyers are responsible for confirming age limits, steering regulations (RHD/LHD),
                and local customs duties in their destination country prior to purchasing. Our team
                assists with mandatory pre-export inspections such as QISJ, JEVIC, EAA, MPI, and
                DAFF.
              </p>
            </>
          )}

          {policy === 'shipping' && (
            <>
              <p>
                Auzio Traders exports vehicles via Roll-on/Roll-off (Ro-Ro) car carriers and
                dedicated 20ft or 40ft containers departing from Yokohama, Nagoya, Kobe, Osaka, and
                Hakata ports in Japan.
              </p>
              <h3 className="text-slate-950 font-bold text-sm">1. Published vs. Custom Shipping Quotes</h3>
              <p>
                Verified destination corridors display real-time FOB-to-CIF estimates including
                published freight and mandatory inspection fees. For global ports outside our
                standard tariff sheet, our logistics desk provides an exact written shipping quote
                within one business day.
              </p>
              <h3 className="text-slate-950 font-bold text-sm">2. Vessel Schedules &amp; Transit Times</h3>
              <p>
                Estimated Time of Departure (ETD) and Estimated Time of Arrival (ETA) are provided
                by ocean carriers and remain subject to maritime weather and port congestion.
              </p>
              <h3 className="text-slate-950 font-bold text-sm">3. Export Documentation Dispatch</h3>
              <p>
                Upon vessel departure and full invoice settlement, original Bills of Lading, Export
                Certificates, English Translations, and Inspection Certificates are dispatched via
                tracked international courier (DHL Express) and uploaded to your buyer portal.
              </p>
            </>
          )}
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
