import { Building2, Printer, X } from 'lucide-react';
import { useState } from 'react';
import { formatMoney, SHIPPING_METHOD_LABELS } from '../data/ports';
import type { CompanySettings, ProformaDraft } from '../types/portal';

interface ProformaInvoiceModalProps {
  draft: ProformaDraft;
  settings: CompanySettings;
  onClose: () => void;
}

export function ProformaInvoiceModal({
  draft,
  settings,
  onClose,
}: ProformaInvoiceModalProps) {
  const [consigneeName, setConsigneeName] = useState(
    draft.consigneeName || 'Authorized Importer / Buyer Name'
  );
  const [consigneeAddress, setConsigneeAddress] = useState(
    draft.consigneeAddress || `${draft.cif.port.name}, ${draft.cif.port.country}`
  );
  const [consigneePhone, setConsigneePhone] = useState(draft.consigneePhone || '');
  const [consigneeEmail, setConsigneeEmail] = useState(draft.consigneeEmail || '');

  const rates = settings.exchangeRates;
  const fmt = (usd: number) => formatMoney(usd, draft.currency, rates);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs overflow-y-auto p-4 sm:p-6 flex items-start justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Proforma Invoice"
    >
      <div className="w-full max-w-[920px] bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden my-4 print-only-container">
        {/* Interactive Toolbar (hidden when printing) */}
        <div className="no-print px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Proforma Invoice Preview</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Customize consignee details below, then print or save as PDF for bank wire transfer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Proforma Invoice"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Editable Consignee Fields (hidden when printing) */}
        <div className="no-print px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Consignee / Buyer Name
            </label>
            <input
              type="text"
              value={consigneeName}
              onChange={(e) => setConsigneeName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-amber-600"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Consignee Address / City
            </label>
            <input
              type="text"
              value={consigneeAddress}
              onChange={(e) => setConsigneeAddress(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-amber-600"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Phone / WhatsApp
            </label>
            <input
              type="text"
              value={consigneePhone}
              onChange={(e) => setConsigneePhone(e.target.value)}
              placeholder="+254 700 000 000"
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-amber-600"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={consigneeEmail}
              onChange={(e) => setConsigneeEmail(e.target.value)}
              placeholder="buyer@company.com"
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-amber-600"
            />
          </div>
        </div>

        {/* Printable A4 Commercial Invoice Body */}
        <div className="p-8 sm:p-10 space-y-8 text-slate-900 bg-white">
          {/* Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-900">
            <div>
              <div className="text-2xl font-bold tracking-tight text-slate-950">
                {settings.companyName}
              </div>
              <p className="text-xs text-slate-600 mt-1">{settings.tagline}</p>
              <p className="text-xs text-slate-600 mt-2 max-w-md leading-relaxed">
                {settings.officeAddress}
              </p>
              <p className="text-xs font-mono text-slate-700 mt-1">
                {settings.supportEmail} · Tel/WhatsApp: {settings.whatsappPhone}
              </p>
            </div>

            <div className="sm:text-right">
              <div className="text-xl font-bold tracking-tight text-slate-950">
                PROFORMA INVOICE
              </div>
              <div className="mt-2 space-y-1 text-xs font-mono tabular-nums">
                <div>
                  <span className="text-slate-500">Invoice No.: </span>
                  <span className="font-semibold text-slate-950">{draft.invoiceNumber}</span>
                </div>
                {draft.trackingCode && (
                  <div>
                    <span className="text-slate-500">Order Ref.: </span>
                    <span className="font-semibold text-amber-700">{draft.trackingCode}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Issue Date: </span>
                  <span>{draft.issueDate}</span>
                </div>
                <div>
                  <span className="text-slate-500">Valid Until: </span>
                  <span>{draft.validUntilDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Consignee & Shipment Routing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="text-[11px] font-semibold text-slate-500 mb-2">
                CONSIGNEE / BUYER DETAILS
              </div>
              <div className="text-sm font-semibold text-slate-950">{consigneeName}</div>
              <div className="text-xs text-slate-700 mt-1">{consigneeAddress}</div>
              {(consigneePhone || consigneeEmail) && (
                <div className="text-xs font-mono text-slate-600 mt-2">
                  {[consigneePhone, consigneeEmail].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <div className="text-[11px] font-semibold text-slate-500 mb-2">
                SHIPPING & INCOTERMS ROUTING
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                <span className="text-slate-500">Port of Loading:</span>
                <span className="font-medium text-slate-900">
                  {draft.vehicle.originPort}, Japan
                </span>
                <span className="text-slate-500">Port of Discharge:</span>
                <span className="font-medium text-slate-900">
                  {draft.cif.port.name}, {draft.cif.port.country}
                </span>
                <span className="text-slate-500">Freight Method:</span>
                <span className="font-medium text-slate-900">
                  {SHIPPING_METHOD_LABELS[draft.cif.shippingMethod]}
                </span>
                <span className="text-slate-500">Trade Term:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {draft.cif.includeInsurance ? 'CIF' : 'C&F'} ({draft.currency})
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Particulars */}
          <div>
            <div className="text-xs font-semibold text-slate-900 mb-2">
              1. Vehicle Specification
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-4 py-2.5 bg-slate-50 text-slate-600 w-1/4">Stock Code</td>
                    <td className="px-4 py-2.5 font-mono font-semibold">{draft.vehicle.stockCode}</td>
                    <td className="px-4 py-2.5 bg-slate-50 text-slate-600 w-1/4">Chassis / VIN</td>
                    <td className="px-4 py-2.5 font-mono font-semibold">{draft.vehicle.chassisCode}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 bg-slate-50 text-slate-600">Make & Model</td>
                    <td className="px-4 py-2.5 font-semibold">
                      {draft.vehicle.year} {draft.vehicle.make} {draft.vehicle.model}{' '}
                      {draft.vehicle.trim}
                    </td>
                    <td className="px-4 py-2.5 bg-slate-50 text-slate-600">Auction Grade</td>
                    <td className="px-4 py-2.5 font-mono">
                      Ext {draft.vehicle.auctionReport.exteriorGrade} / Int{' '}
                      {draft.vehicle.auctionReport.interiorGrade}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 bg-slate-50 text-slate-600">Engine / Fuel</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">
                      {draft.vehicle.engineCc.toLocaleString()} cc · {draft.vehicle.fuelType}
                    </td>
                    <td className="px-4 py-2.5 bg-slate-50 text-slate-600">Mileage</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">
                      {draft.vehicle.mileageKm.toLocaleString()} km
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 bg-slate-50 text-slate-600">Drive / Steering</td>
                    <td className="px-4 py-2.5">
                      {draft.vehicle.transmission} · {draft.vehicle.drivetrain} · {draft.vehicle.steering}
                    </td>
                    <td className="px-4 py-2.5 bg-slate-50 text-slate-600">Color / Volume</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">
                      {draft.vehicle.exteriorColor} · {draft.vehicle.volumeM3} m³
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Itemized CIF Valuation */}
          <div>
            <div className="text-xs font-semibold text-slate-900 mb-2">
              2. Itemized Cost Breakdown
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white text-left">
                    <th className="px-4 py-2.5 font-medium">Description</th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Amount ({draft.currency})
                    </th>
                    {draft.currency !== 'USD' && (
                      <th className="px-4 py-2.5 font-medium text-right">USD Reference</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                  <tr>
                    <td className="px-4 py-3 font-sans text-slate-800">
                      FOB Vehicle Value ({draft.vehicle.originPort} Port Release & Export Deregistration)
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(draft.cif.fobUsd)}</td>
                    {draft.currency !== 'USD' && (
                      <td className="px-4 py-3 text-right text-slate-500">
                        ${draft.cif.fobUsd.toLocaleString()}
                      </td>
                    )}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-sans text-slate-800">
                      Ocean Freight to {draft.cif.port.name} ({SHIPPING_METHOD_LABELS[draft.cif.shippingMethod]})
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(draft.cif.freightUsd)}</td>
                    {draft.currency !== 'USD' && (
                      <td className="px-4 py-3 text-right text-slate-500">
                        ${draft.cif.freightUsd.toLocaleString()}
                      </td>
                    )}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-sans text-slate-800">
                      {draft.cif.inspectionLabel}
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(draft.cif.inspectionUsd)}</td>
                    {draft.currency !== 'USD' && (
                      <td className="px-4 py-3 text-right text-slate-500">
                        ${draft.cif.inspectionUsd.toLocaleString()}
                      </td>
                    )}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-sans text-slate-800">
                      All-Risk Marine Transit Insurance (1.5%)
                    </td>
                    <td className="px-4 py-3 text-right">
                      {draft.cif.includeInsurance ? fmt(draft.cif.insuranceUsd) : 'Declined'}
                    </td>
                    {draft.currency !== 'USD' && (
                      <td className="px-4 py-3 text-right text-slate-500">
                        {draft.cif.includeInsurance
                          ? `$${draft.cif.insuranceUsd.toLocaleString()}`
                          : '—'}
                      </td>
                    )}
                  </tr>
                  <tr className="bg-slate-50 text-sm">
                    <td className="px-4 py-3.5 font-sans font-bold text-slate-950">
                      TOTAL {draft.cif.includeInsurance ? 'CIF' : 'C&F'} PAYABLE
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-950">
                      {fmt(draft.cif.totalCifUsd)}
                    </td>
                    {draft.currency !== 'USD' && (
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-700">
                        ${draft.cif.totalCifUsd.toLocaleString()}
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Official International Bank Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-950 mb-3">
              <Building2 className="w-4 h-4 text-slate-700" />
              <span>3. Official International Wire Transfer (TT) Bank Details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
              <div className="flex justify-between gap-2 border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">Beneficiary Name</span>
                <span className="font-mono font-semibold text-slate-950 text-right">
                  {settings.accountName}
                </span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">SWIFT / BIC Code</span>
                <span className="font-mono font-bold text-slate-950 text-right">
                  {settings.swiftCode}
                </span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">Bank Name</span>
                <span className="font-medium text-slate-900 text-right">{settings.bankName}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">Account Number</span>
                <span className="font-mono font-bold text-slate-950 text-right">
                  {settings.accountNumber}
                </span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">Branch</span>
                <span className="text-slate-900 text-right">{settings.bankBranch}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">Remittance Reference</span>
                <span className="font-mono font-semibold text-amber-800 text-right">
                  {draft.trackingCode || draft.invoiceNumber}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
              Bank Address: {settings.bankAddress}. Remitter bears all intermediary bank wire charges.
              Please email your TT remittance slip citing reference{' '}
              <span className="font-mono font-semibold">
                {draft.trackingCode || draft.invoiceNumber}
              </span>{' '}
              to {settings.supportEmail} within {settings.invoiceValidityDays} business days to lock vessel allocation.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-end justify-between text-[11px] text-slate-500">
            <div>
              Issued electronically by {settings.companyName} Export Desk. Estimated ocean transit:{' '}
              {draft.cif.transitDaysRange}.
            </div>
            <div className="font-mono text-slate-700 font-medium">
              Authorized Export Desk
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
