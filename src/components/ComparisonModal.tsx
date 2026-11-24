import { FileText, Trash2, X } from 'lucide-react';
import { calculateCif, formatMoney } from '../data/ports';
import { EN_COPY } from '../i18n/en';
import type {
  CifBreakdown,
  CompanySettings,
  CurrencyCode,
  Vehicle,
} from '../types/portal';
import { VehicleImage } from './VehicleImage';

interface ComparisonModalProps {
  vehicles: Vehicle[];
  currency: CurrencyCode;
  portId: string;
  settings: CompanySettings;
  onRemove: (vehicleId: string) => void;
  onClearAll: () => void;
  onViewVehicle: (vehicle: Vehicle) => void;
  onOpenProforma: (params: { vehicle: Vehicle; cif: CifBreakdown }) => void;
  onClose: () => void;
}

export function ComparisonModal({
  vehicles,
  currency,
  portId,
  settings,
  onRemove,
  onClearAll,
  onViewVehicle,
  onOpenProforma,
  onClose,
}: ComparisonModalProps) {
  const fmt = (usd: number) => formatMoney(usd, currency, settings.exchangeRates);

  const items = vehicles.map((v) => ({
    vehicle: v,
    cif: calculateCif({
      fobUsd: v.fobPriceUsd,
      volumeM3: v.volumeM3,
      portId,
      shippingMethod: 'roro',
      includeInsurance: true,
    }),
  }));

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs overflow-y-auto p-4 sm:p-6 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Vehicle Comparison Matrix"
    >
      <div className="w-full max-w-[1160px] bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden my-4">
        <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">
              Side-by-Side Vehicle Comparison ({vehicles.length}/4)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Live landed CIF calculated for {items[0]?.cif.port.name}, {items[0]?.cif.port.country} ({currency})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearAll}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close comparison"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto p-6">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 align-top">
                <th className="py-3 pr-4 w-40 text-slate-500 font-semibold">Specification</th>
                {items.map(({ vehicle }) => (
                  <th key={vehicle.id} className="px-3 pb-4 min-w-[210px] font-normal">
                    <div className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100 mb-2.5">
                      <VehicleImage src={vehicle.images[0]} alt={vehicle.model} />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {vehicle.stockCode}
                        </div>
                        <div className="text-sm font-bold text-slate-950">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </div>
                        <div className="text-[11px] text-slate-500">{vehicle.trim}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(vehicle.id)}
                        aria-label={`Remove ${vehicle.stockCode}`}
                        className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 pr-4 font-medium text-slate-500">Listing Status</td>
                {items.map(({ vehicle }) => (
                  <td key={vehicle.id} className="px-3 py-2.5 font-semibold text-slate-900">
                    {EN_COPY.listingTypes[vehicle.listingType || 'auzio_stock'].shortLabel}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50/70">
                <td className="py-2.5 pr-4 font-medium text-slate-500">FOB Price</td>
                {items.map(({ vehicle }) => (
                  <td
                    key={vehicle.id}
                    className="px-3 py-2.5 font-mono font-semibold text-slate-950 tabular-nums"
                  >
                    {fmt(vehicle.fobPriceUsd)}
                  </td>
                ))}
              </tr>
              <tr className="bg-amber-50/50">
                <td className="py-2.5 pr-4 font-semibold text-slate-900">Est. Landed CIF</td>
                {items.map(({ vehicle, cif }) => (
                  <td
                    key={vehicle.id}
                    className="px-3 py-2.5 font-mono text-sm font-bold text-amber-900 tabular-nums"
                  >
                    {fmt(cif.totalCifUsd)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-slate-500">Auction Grade</td>
                {items.map(({ vehicle }) => (
                  <td key={vehicle.id} className="px-3 py-2.5 font-mono text-slate-900">
                    Ext {vehicle.auctionReport.exteriorGrade} / Int {vehicle.auctionReport.interiorGrade}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-slate-500">Mileage</td>
                {items.map(({ vehicle }) => (
                  <td key={vehicle.id} className="px-3 py-2.5 font-mono tabular-nums text-slate-900">
                    {vehicle.mileageKm.toLocaleString()} km
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-slate-500">Engine / Fuel</td>
                {items.map(({ vehicle }) => (
                  <td key={vehicle.id} className="px-3 py-2.5 font-mono tabular-nums text-slate-900">
                    {vehicle.engineCc.toLocaleString()} cc · {vehicle.fuelType}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-slate-500">Drivetrain / Steer</td>
                {items.map(({ vehicle }) => (
                  <td key={vehicle.id} className="px-3 py-2.5 text-slate-900">
                    {vehicle.transmission} · {vehicle.drivetrain} · {vehicle.steering}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-medium text-slate-500">Origin / Volume</td>
                {items.map(({ vehicle }) => (
                  <td key={vehicle.id} className="px-3 py-2.5 font-mono tabular-nums text-slate-900">
                    {vehicle.originPort} · {vehicle.volumeM3} m³
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-slate-500">Actions</td>
                {items.map(({ vehicle, cif }) => (
                  <td key={vehicle.id} className="px-3 py-3 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onViewVehicle(vehicle);
                      }}
                      className="w-full py-1.5 px-3 text-xs font-semibold text-white bg-slate-950 rounded-md hover:bg-slate-800 cursor-pointer"
                    >
                      View Full Specs
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenProforma({ vehicle, cif });
                      }}
                      className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-3 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Proforma P/I
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
