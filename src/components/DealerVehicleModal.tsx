import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  ImageOff,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  Ship,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { computeDealerCustomerEstimate } from '../data/dealerPricing';
import { formatMoney, GLOBAL_PORTS } from '../data/ports';
import { submitDealerInquiry } from '../services/dealerStockService';
import type {
  CompanySettings,
  CurrencyCode,
  DealerStockVehicle,
  ShippingMethod,
} from '../types/portal';

interface DealerVehicleModalProps {
  vehicle: DealerStockVehicle;
  currency: CurrencyCode;
  defaultPortId: string;
  settings: CompanySettings;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  onInquirySubmitted?: (code: string) => void;
}

export function DealerVehicleModal({
  vehicle,
  currency,
  defaultPortId,
  settings,
  isFavorite,
  onToggleFavorite,
  onClose,
  onInquirySubmitted,
}: DealerVehicleModalProps) {
  const [imgIndex, setImgIndex] = useState(0);
  const [portId, setPortId] = useState(defaultPortId || 'mombasa-ke');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('roro');
  const [inquiryMode, setInquiryMode] = useState<'none' | 'quotation' | 'availability'>('none');

  // Inquiry form state
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerCountry, setBuyerCountry] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const title =
    [vehicle.manufacturingYear, vehicle.manufacturer, vehicle.model, vehicle.grade]
      .filter(Boolean)
      .join(' ') || vehicle.stockId;

  const estimate = useMemo(
    () =>
      computeDealerCustomerEstimate({
        estimatedFobUsd: vehicle.estimatedFobUsd,
        volumeM3: vehicle.volumeM3 || 15,
        portId,
        shippingMethod,
      }),
    [vehicle.estimatedFobUsd, vehicle.volumeM3, portId, shippingMethod]
  );

  const images = vehicle.images || [];
  const activeImg = images[imgIndex] || null;

  const cleanWhatsapp = (settings.whatsappPhone || '+81455508924').replace(/[^0-9]/g, '');
  const whatsappText = encodeURIComponent(
    `Hello Auzio Traders, I am interested in Japanese Dealer Stock #${vehicle.stockId} (${title}). ` +
      `Destination: ${estimate.port.name}, ${estimate.port.country}. ` +
      `Estimated FOB: ${
        estimate.estimatedFobUsd !== null
          ? formatMoney(estimate.estimatedFobUsd, currency, settings.exchangeRates)
          : 'Request Quote'
      }. Please confirm availability and final quotation.`
  );

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !buyerEmail.trim()) {
      setSubmitError('Please enter your name and email address.');
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    try {
      const saved = await submitDealerInquiry({
        inquiryType: inquiryMode === 'availability' ? 'availability' : 'quotation',
        vehicleId: vehicle.id,
        sourceId: vehicle.sourceId,
        stockId: vehicle.stockId,
        vehicleTitle: title.slice(0, 175),
        originalListingUrl: vehicle.originalListingUrl,
        buyerName: buyerName.trim(),
        buyerEmail: buyerEmail.trim(),
        buyerPhone: buyerPhone.trim(),
        buyerCountry: buyerCountry.trim() || estimate.port.country,
        destinationPortId: estimate.port.id,
        destinationPortName: `${estimate.port.name}, ${estimate.port.country}`,
        shippingMethod,
        currency,
        estimatedFobUsd: estimate.estimatedFobUsd,
        estimatedCnfUsd: estimate.estimatedCnfUsd,
        estimatedCifUsd: estimate.estimatedCifUsd,
        message: message.trim(),
      });
      setSubmittedCode(saved.inquiryCode);
      onInquirySubmitted?.(saved.inquiryCode);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit request right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const specRows: Array<[string, string | null]> = [
    ['Stock ID', vehicle.stockId],
    ['Dealer Source', vehicle.dealerName],
    ['Manufacturer', vehicle.manufacturer],
    ['Model', vehicle.model],
    ['Grade / Trim', vehicle.grade],
    ['Model Code', vehicle.modelCode],
    ['Chassis Number', vehicle.chassisNumber],
    ['Manufacturing Year', vehicle.manufacturingYear ? String(vehicle.manufacturingYear) : null],
    ['Registration Date', vehicle.registrationYearMonth],
    ['Mileage', vehicle.mileageKm !== null ? `${vehicle.mileageKm.toLocaleString()} km` : null],
    [
      'Engine Capacity',
      vehicle.engineCapacityCc !== null ? `${vehicle.engineCapacityCc.toLocaleString()} cc` : null,
    ],
    ['Fuel Type', vehicle.fuelType],
    ['Transmission', vehicle.transmission],
    ['Drive Type', vehicle.driveType],
    ['Body Type', vehicle.bodyType],
    ['Exterior Color', vehicle.exteriorColor],
    ['Interior Color', vehicle.interiorColor],
    ['Doors / Seats', vehicle.doors || vehicle.seats ? `${vehicle.doors ?? '—'} doors / ${vehicle.seats ?? '—'} seats` : null],
    ['Steering', vehicle.steering],
    ['Repair History', vehicle.repairHistory],
    ['Shaken Inspection', vehicle.shakenExpiry],
    ['Tax Status (JP)', vehicle.taxStatus],
    ['Location', vehicle.location],
    ['Dealer Branch', vehicle.dealerBranch],
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                {vehicle.stockId}
              </span>
              <span
                className={`font-semibold px-2 py-0.5 rounded border ${
                  vehicle.status === 'available'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : vehicle.status === 'unverified'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                }`}
              >
                {vehicle.status === 'available'
                  ? 'Available (Subject to Dealer Confirmation)'
                  : vehicle.status === 'unverified'
                    ? 'Availability Pending Verification'
                    : 'Sold'}
              </span>
              <span className="text-slate-500">{vehicle.dealerName}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 mt-1 truncate">
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleFavorite(vehicle.id)}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                isFavorite
                  ? 'bg-rose-50 border-rose-300 text-rose-600'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-rose-600'
              }`}
              title={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close vehicle details"
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Gallery + Specs + Features */}
          <div className="lg:col-span-7 space-y-5">
            {/* Image Gallery */}
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              <div className="relative aspect-[16/10] bg-slate-900 flex items-center justify-center">
                {activeImg ? (
                  <img
                    src={activeImg}
                    alt={title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center text-slate-400 p-6">
                    <ImageOff className="w-10 h-10 mx-auto mb-2 opacity-60" />
                    <p className="text-xs font-medium">No authorized dealer photo provided</p>
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setImgIndex((i) => (i - 1 + images.length) % images.length)}
                      aria-label="Previous photo"
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/70 text-white hover:bg-slate-950 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImgIndex((i) => (i + 1) % images.length)}
                      aria-label="Next photo"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/70 text-white hover:bg-slate-950 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-3 right-3 bg-slate-950/75 text-white text-xs font-mono px-2.5 py-1 rounded">
                      {imgIndex + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="p-2 bg-slate-50 border-t border-slate-200 flex gap-2 overflow-x-auto">
                  {images.map((url, idx) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setImgIndex(idx)}
                      className={`w-16 h-12 rounded-md overflow-hidden border-2 shrink-0 cursor-pointer ${
                        idx === imgIndex ? 'border-amber-600' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dealer Description */}
            {vehicle.description && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Dealer Listing Notes
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">{vehicle.description}</p>
              </div>
            )}

            {/* Normalized Specifications Grid */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Vehicle Specifications (Extracted from Original Listing)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {specRows.map(([label, val]) => (
                  <div
                    key={label}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white"
                  >
                    <div className="text-[11px] font-medium text-slate-500">{label}</div>
                    <div className={`text-xs font-bold mt-0.5 ${val ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                      {val || 'Not provided'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Features & Equipment */}
            {vehicle.features && vehicle.features.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Equipment &amp; Accessories
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {vehicle.features.map((feat) => (
                    <span
                      key={feat}
                      className="text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-md"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
              <span>Last verified: {new Date(vehicle.syncedAt).toLocaleString()}</span>
              <a
                href={vehicle.originalListingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-800"
              >
                <span>Original Dealer Listing</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Right Column: Estimated FOB / C&F / CIF Calculator & Inquiry Actions */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-950">
                  <Ship className="w-4 h-4 text-amber-600" />
                  <span>Estimated Export Cost Breakdown</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                  Estimated
                </span>
              </div>

              {/* Port & Shipping Selectors */}
              <div className="grid grid-cols-1 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Destination Port
                  </label>
                  <select
                    value={portId}
                    onChange={(e) => setPortId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                  >
                    {GLOBAL_PORTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}, {p.country} ({p.region})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Shipping Method
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ['roro', 'Ro-Ro'],
                        ['container_20ft', '20ft Box'],
                        ['container_40ft', '40ft Box'],
                      ] as const
                    ).map(([m, label]) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setShippingMethod(m)}
                        className={`py-1.5 px-2 text-xs font-bold rounded-md border cursor-pointer ${
                          shippingMethod === m
                            ? 'bg-slate-950 text-white border-slate-950'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Separate Estimated FOB, Estimated C&F, Estimated CIF */}
              <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 text-xs">
                <div className="px-3.5 py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">Estimated FOB (Japan Port)</div>
                    <div className="text-[11px] text-slate-500">Includes inland &amp; export handling estimate</div>
                  </div>
                  <div className="font-mono font-extrabold text-sm text-slate-950">
                    {estimate.estimatedFobUsd !== null
                      ? formatMoney(estimate.estimatedFobUsd, currency, settings.exchangeRates)
                      : 'Request Quote'}
                  </div>
                </div>

                <div className="px-3.5 py-2 flex items-center justify-between text-slate-600">
                  <span>Est. Ocean Freight ({estimate.port.name})</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {estimate.rateAvailable
                      ? formatMoney(estimate.estimatedFreightUsd, currency, settings.exchangeRates)
                      : 'Quote'}
                  </span>
                </div>

                <div className="px-3.5 py-2 flex items-center justify-between text-slate-600">
                  <span>Est. Pre-Export Inspection ({estimate.inspectionLabel})</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {estimate.rateAvailable
                      ? formatMoney(estimate.estimatedInspectionUsd, currency, settings.exchangeRates)
                      : 'Quote'}
                  </span>
                </div>

                <div className="px-3.5 py-2.5 flex items-center justify-between bg-slate-50">
                  <div>
                    <div className="font-bold text-slate-900">Estimated C&amp;F</div>
                    <div className="text-[11px] text-slate-500">Cost &amp; Freight (excluding marine insurance)</div>
                  </div>
                  <div className="font-mono font-extrabold text-sm text-slate-950">
                    {estimate.estimatedCnfUsd !== null
                      ? formatMoney(estimate.estimatedCnfUsd, currency, settings.exchangeRates)
                      : 'Request Quote'}
                  </div>
                </div>

                <div className="px-3.5 py-2 flex items-center justify-between text-slate-600">
                  <span>Est. Marine Insurance</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {estimate.estimatedCnfUsd !== null
                      ? formatMoney(estimate.estimatedInsuranceUsd, currency, settings.exchangeRates)
                      : '—'}
                  </span>
                </div>

                <div className="px-3.5 py-3 flex items-center justify-between bg-amber-50/70">
                  <div>
                    <div className="font-extrabold text-slate-950">Estimated CIF Total</div>
                    <div className="text-[11px] text-slate-600">
                      Transit: {estimate.transitDaysRange} · Indicative estimate only
                    </div>
                  </div>
                  <div className="font-mono font-extrabold text-base text-amber-800">
                    {estimate.estimatedCifUsd !== null
                      ? formatMoney(estimate.estimatedCifUsd, currency, settings.exchangeRates)
                      : 'Request Quote'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-[11px] text-slate-500 leading-snug">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  All prices shown are <strong>indicative estimates</strong> based on current Japanese dealer
                  listings and FX rates. Final confirmed invoice requires live dealer availability confirmation.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedCode(null);
                    setInquiryMode('quotation');
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Request Formal Export Quotation</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedCode(null);
                    setInquiryMode('availability');
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Request Dealer Availability Confirmation</span>
                </button>
                <a
                  href={`https://wa.me/${cleanWhatsapp}?text=${whatsappText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Inquiry (Instant Desk)</span>
                </a>
              </div>
            </div>

            {/* Inline Request Quotation / Availability Form */}
            {inquiryMode !== 'none' && (
              <div className="rounded-xl border border-amber-300 bg-white p-4 space-y-3 shadow-xs">
                {submittedCode ? (
                  <div className="space-y-2 text-center py-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <div className="text-sm font-extrabold text-slate-950">
                      Request Submitted ({submittedCode})
                    </div>
                    <p className="text-xs text-slate-600">
                      Our Yokohama sourcing desk is confirming live availability with {vehicle.dealerName} and will send your confirmed FOB/CIF quotation shortly.
                    </p>
                    <button
                      type="button"
                      onClick={() => setInquiryMode('none')}
                      className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
                    >
                      Close Form
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitInquiry} className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-950 uppercase tracking-wider">
                        {inquiryMode === 'availability'
                          ? 'Confirm Live Dealer Availability'
                          : 'Request Formal Quotation'}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setInquiryMode('none')}
                        className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    {submitError && (
                      <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2.5 py-1.5">
                        {submitError}
                      </div>
                    )}
                    <input
                      type="text"
                      required
                      placeholder="Your Full Name *"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="email"
                        required
                        placeholder="Email Address *"
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                      <input
                        type="tel"
                        placeholder="Phone / WhatsApp"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder={`Country (default: ${estimate.port.country})`}
                      value={buyerCountry}
                      onChange={(e) => setBuyerCountry(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                    <textarea
                      rows={2}
                      placeholder="Questions, inspection requirements, or target budget..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                    >
                      {submitting ? 'Submitting Request...' : 'Submit to Auzio Japan Desk'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {vehicle.location && (
              <div className="flex items-center gap-2 text-xs text-slate-600 px-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  Located in <strong>{vehicle.location}</strong>
                  {vehicle.dealerBranch ? ` · ${vehicle.dealerBranch}` : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
