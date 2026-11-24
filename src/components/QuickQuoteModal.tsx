import { Check, CheckCircle2, Copy, FileText, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { calculateCif, formatMoney, GLOBAL_PORTS, SHIPPING_REGIONS } from '../data/ports';
import { submitBuyerInquiry } from '../services/firestoreService';
import type {
  CompanySettings,
  CurrencyCode,
  ShippingMethod,
  Vehicle,
} from '../types/portal';

interface QuickQuoteModalProps {
  vehicles: Vehicle[];
  persistedVehicleIds: Set<string>;
  currency: CurrencyCode;
  settings: CompanySettings;
  defaultVehicleId?: string;
  initialPortId?: string;
  initialShippingMethod?: ShippingMethod;
  initialIncludeInsurance?: boolean;
  onClose: () => void;
  onTrackOrder: (trackingCode: string) => void;
  onOpenProforma: (params: {
    vehicle: Vehicle;
    portId: string;
    shippingMethod: ShippingMethod;
    includeInsurance: boolean;
    consigneeName: string;
    consigneePhone: string;
    consigneeEmail: string;
    trackingCode: string;
  }) => void;
}

export function QuickQuoteModal({
  vehicles,
  persistedVehicleIds,
  currency,
  settings,
  defaultVehicleId,
  initialPortId,
  initialShippingMethod,
  initialIncludeInsurance,
  onClose,
  onTrackOrder,
  onOpenProforma,
}: QuickQuoteModalProps) {
  const availableVehicles = vehicles.filter((v) => v.status !== 'sold');
  const [selectedVehicleId, setSelectedVehicleId] = useState(
    defaultVehicleId || availableVehicles[0]?.id || 'GENERAL'
  );
  const defaultPort =
    GLOBAL_PORTS.find((p) => p.id === initialPortId) || GLOBAL_PORTS[0];
  const [portId, setPortId] = useState(defaultPort.id);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(
    initialShippingMethod || 'roro'
  );
  const [includeInsurance, setIncludeInsurance] = useState(
    initialIncludeInsurance ?? true
  );
  const [inquiryType, setInquiryType] = useState<'reservation' | 'inquiry'>('reservation');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerCountry, setBuyerCountry] = useState(defaultPort.country);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId]
  );

  const cif = useMemo(
    () =>
      calculateCif({
        fobUsd: selectedVehicle ? selectedVehicle.fobPriceUsd : 18000,
        volumeM3: selectedVehicle ? selectedVehicle.volumeM3 : 15,
        portId,
        shippingMethod,
        includeInsurance,
      }),
    [selectedVehicle, portId, shippingMethod, includeInsurance]
  );

  const handlePortChange = (nextPortId: string) => {
    setPortId(nextPortId);
    const port = GLOBAL_PORTS.find((p) => p.id === nextPortId);
    if (port) setBuyerCountry(port.country);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (buyerName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!buyerEmail.includes('@') || buyerEmail.trim().length < 5) {
      setError('Please enter a valid email address.');
      return;
    }
    if (buyerPhone.trim().length < 6) {
      setError('Please enter a valid phone or WhatsApp number.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitBuyerInquiry({
        type: inquiryType,
        vehicleId: selectedVehicle ? selectedVehicle.id : 'GENERAL',
        isVehiclePersisted: selectedVehicle
          ? persistedVehicleIds.has(selectedVehicle.id)
          : false,
        vehicleStockCode: selectedVehicle ? selectedVehicle.stockCode : 'AUZ-SOURCE',
        vehicleTitle: selectedVehicle
          ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} ${selectedVehicle.trim}`.trim()
          : 'Custom Export Vehicle Sourcing Request',
        buyerName,
        buyerEmail,
        buyerPhone,
        buyerCountry,
        destinationPortId: cif.port.id,
        destinationPortName: `${cif.port.name}, ${cif.port.country}`,
        shippingMethod,
        includeInsurance,
        fobPriceUsd: selectedVehicle ? cif.fobUsd : 0,
        freightUsd: cif.freightUsd,
        inspectionUsd: cif.inspectionUsd,
        insuranceUsd: cif.insuranceUsd,
        quotedCifUsd: selectedVehicle ? cif.totalCifUsd : cif.freightUsd + cif.inspectionUsd,
        currency,
        message,
      });
      setCreatedCode(result.trackingCode);
    } catch (err) {
      setError(
        err instanceof Error
          ? 'Unable to submit request right now. Please verify your inputs and try again.'
          : 'Submission failed.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const copyTrackingCode = () => {
    if (!createdCode) return;
    void navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs overflow-y-auto p-4 sm:p-6 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Request CIF Quote or Reserve Vehicle"
    >
      <div className="w-full max-w-xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">
              {createdCode ? 'Export Request Logged' : 'Request Export Quote & Reservation'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Direct dispatch from Yokohama, Nagoya, Kobe & Osaka
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quote modal"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdCode ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Your reference code is ready
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Save this tracking reference to monitor Proforma issuance, pre-export inspection,
                  and vessel booking in real time.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium text-slate-500">Order Tracking Code</div>
                <div className="text-xl font-mono font-bold text-slate-950 tracking-wide mt-0.5">
                  {createdCode}
                </div>
              </div>
              <button
                type="button"
                onClick={copyTrackingCode}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy Code'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {selectedVehicle && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenProforma({
                      vehicle: selectedVehicle,
                      portId,
                      shippingMethod,
                      includeInsurance,
                      consigneeName: buyerName,
                      consigneePhone: buyerPhone,
                      consigneeEmail: buyerEmail,
                      trackingCode: createdCode,
                    });
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 cursor-pointer whitespace-nowrap"
                >
                  <FileText className="w-4 h-4" />
                  Print Proforma Invoice
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTrackOrder(createdCode);
                }}
                className="flex-1 inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer whitespace-nowrap"
              >
                View Live Tracker
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Request Type
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setInquiryType('reservation')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      inquiryType === 'reservation'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    48h Reserve
                  </button>
                  <button
                    type="button"
                    onClick={() => setInquiryType('inquiry')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      inquiryType === 'inquiry'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    CIF Inquiry
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Vehicle
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                >
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.stockCode} — {v.year} {v.make} {v.model}
                    </option>
                  ))}
                  <option value="GENERAL">Custom Auction Sourcing Request</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Destination Port
                </label>
                <select
                  value={portId}
                  onChange={(e) => handlePortChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                >
                  {SHIPPING_REGIONS.map((region) => (
                    <optgroup key={region} label={region}>
                      {GLOBAL_PORTS.filter((p) => p.region === region).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.country})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Shipping Method
                </label>
                <select
                  value={shippingMethod}
                  onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                >
                  <option value="roro">Ro-Ro Vessel</option>
                  <option value="container_20ft">20ft Container</option>
                  <option value="container_40ft">40ft Container</option>
                </select>
              </div>
            </div>

            {selectedVehicle && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeInsurance}
                      onChange={(e) => setIncludeInsurance(e.target.checked)}
                      className="rounded border-slate-300 accent-amber-600"
                    />
                    Marine Insurance (1.5%)
                  </label>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <span className="text-slate-500 mr-2">Est. CIF:</span>
                  <span className="text-sm font-bold text-slate-950">
                    {formatMoney(cif.totalCifUsd, currency, settings.exchangeRates)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Daniel Kamau"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  maxLength={120}
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="buyer@domain.com"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone / WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  maxLength={40}
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="+254 712 345 678"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Destination Country *
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={buyerCountry}
                  onChange={(e) => setBuyerCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Shipping Notes or Questions (Optional)
              </label>
              <textarea
                rows={2}
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Preferred sailing window, consignee company name, or inspection questions..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
              />
            </div>

            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {inquiryType === 'reservation' ? 'Submit 48h Reservation' : 'Submit CIF Inquiry'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
