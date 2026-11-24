import { Check, Info, Search, Ship } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  calculateCif,
  formatMoney,
  GLOBAL_PORTS,
  SHIPPING_REGIONS,
} from '../data/ports';
import type {
  CompanySettings,
  CurrencyCode,
  ShippingMethod,
  ShippingRegion,
} from '../types/portal';

interface ShippingRatesViewProps {
  currency: CurrencyCode;
  selectedPortId: string;
  settings: CompanySettings;
  onSelectPort: (portId: string) => void;
  onOpenWorkflowStatus: () => void;
}

export function ShippingRatesView({
  currency,
  selectedPortId,
  settings,
  onSelectPort,
  onOpenWorkflowStatus,
}: ShippingRatesViewProps) {
  const [regionFilter, setRegionFilter] = useState<'ALL' | ShippingRegion>('ALL');
  const [search, setSearch] = useState('');
  const [sampleFobUsd, setSampleFobUsd] = useState(18500);
  const [sampleVolumeM3, setSampleVolumeM3] = useState(15.5);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('roro');
  const [includeInsurance, setIncludeInsurance] = useState(true);

  const fmt = (usd: number) => formatMoney(usd, currency, settings.exchangeRates);

  const filteredPorts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return GLOBAL_PORTS.filter((p) => {
      if (regionFilter !== 'ALL' && p.region !== regionFilter) return false;
      if (q) {
        const hay = `${p.country} ${p.name} ${p.region} ${p.inspectionName} ${p.corridorNote || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [regionFilter, search]);

  const activeEstimate = useMemo(
    () =>
      calculateCif({
        fobUsd: sampleFobUsd,
        volumeM3: sampleVolumeM3,
        portId: selectedPortId,
        shippingMethod,
        includeInsurance,
      }),
    [sampleFobUsd, sampleVolumeM3, selectedPortId, shippingMethod, includeInsurance]
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1.5">
          <div className="text-xs font-mono font-semibold text-amber-700 uppercase tracking-wider">
            Global Maritime Freight &amp; Inspection Directory
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Shipping Rates &amp; Discharge Ports (14 Countries)
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Compare Ro-Ro per-m³ rates, dedicated 20ft/40ft container tariffs, mandatory JEVIC/QISJ
            pre-export inspection fees, and estimated transit windows from Yokohama, Nagoya, Kobe,
            and Osaka.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenWorkflowStatus}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer self-start md:self-auto"
        >
          <Info className="w-4 h-4 text-amber-600" />
          Carrier Schedule Disclaimer
        </button>
      </div>

      {/* Interactive Landed CIF Simulator for Active Port */}
      <div className="bg-slate-950 text-white rounded-xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <Ship className="w-4 h-4" />
            <span>ACTIVE PORT CIF SIMULATOR — {activeEstimate.port.name.toUpperCase()}, {activeEstimate.port.country.toUpperCase()}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Sample FOB (USD)</label>
              <input
                type="number"
                min={1000}
                max={250000}
                step={500}
                value={sampleFobUsd}
                onChange={(e) => setSampleFobUsd(Math.max(1000, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Vehicle Volume (m³)
              </label>
              <input
                type="number"
                min={8}
                max={32}
                step={0.5}
                value={sampleVolumeM3}
                onChange={(e) => setSampleVolumeM3(Math.max(8, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Freight Method</label>
              <select
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white"
              >
                <option value="roro">Ro-Ro Vessel</option>
                <option value="container_20ft">20ft Container</option>
                <option value="container_40ft">40ft Container</option>
              </select>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeInsurance}
              onChange={(e) => setIncludeInsurance(e.target.checked)}
              className="accent-amber-500"
            />
            Include All-Risk Marine Transit Insurance (1.5% of FOB + Freight)
          </label>
        </div>

        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2.5 text-xs">
          <div className="flex justify-between text-slate-300">
            <span>Vehicle FOB</span>
            <span className="font-mono tabular-nums">{fmt(activeEstimate.fobUsd)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Ocean Freight ({shippingMethod.replace('_', ' ')})</span>
            <span className="font-mono tabular-nums">{fmt(activeEstimate.freightUsd)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="truncate pr-2">{activeEstimate.inspectionLabel}</span>
            <span className="font-mono tabular-nums shrink-0">{fmt(activeEstimate.inspectionUsd)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Marine Insurance</span>
            <span className="font-mono tabular-nums">
              {includeInsurance ? fmt(activeEstimate.insuranceUsd) : 'Declined'}
            </span>
          </div>
          <div className="pt-2.5 border-t border-slate-700 flex items-baseline justify-between">
            <div>
              <div className="text-xs font-bold text-white">Estimated Landed CIF</div>
              <div className="text-[11px] font-mono text-slate-400">
                Est. Transit: {activeEstimate.transitDaysRange}
              </div>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-400">
              {fmt(activeEstimate.totalCifUsd)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRegionFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              regionFilter === 'ALL'
                ? 'bg-slate-950 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Regions ({GLOBAL_PORTS.length})
          </button>
          {SHIPPING_REGIONS.map((region) => (
            <button
              key={region}
              type="button"
              onClick={() => setRegionFilter(region)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                regionFilter === region
                  ? 'bg-slate-950 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {region}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by country, port, inspection..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
          />
        </div>
      </div>

      {/* Searchable Ports & Tariffs Directory */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3.5 px-4">Country &amp; Discharge Port</th>
                <th className="py-3.5 px-4">Region</th>
                <th className="py-3.5 px-4 text-right">Ro-Ro / m³</th>
                <th className="py-3.5 px-4 text-right">20ft Container</th>
                <th className="py-3.5 px-4 text-right">40ft Container</th>
                <th className="py-3.5 px-4">Pre-Export Inspection</th>
                <th className="py-3.5 px-4">Est. Transit</th>
                <th className="py-3.5 px-4 text-right">Portal CIF Port</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPorts.map((port) => {
                const isSelected = port.id === selectedPortId;
                return (
                  <tr
                    key={port.id}
                    className={isSelected ? 'bg-amber-50/60' : 'hover:bg-slate-50'}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-950">
                        {port.country} — {port.name}
                      </div>
                      {port.corridorNote && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {port.corridorNote}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {port.region}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-950 tabular-nums whitespace-nowrap">
                      {fmt(port.roroRatePerM3Usd)}/m³
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-800 tabular-nums whitespace-nowrap">
                      {fmt(port.container20ftUsd)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-800 tabular-nums whitespace-nowrap">
                      {fmt(port.container40ftUsd)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 font-medium">{port.inspectionName}</div>
                      <div className="font-mono text-[11px] text-slate-600 tabular-nums">
                        {fmt(port.inspectionFeeUsd)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {port.transitDaysMin}–{port.transitDaysMax} days
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-emerald-900 bg-emerald-100 rounded-lg">
                          <Check className="w-3.5 h-3.5" />
                          Active Port
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectPort(port.id)}
                          className="px-3 py-1.5 text-[11px] font-semibold text-slate-900 bg-white border border-slate-300 hover:border-amber-600 hover:text-amber-800 rounded-lg cursor-pointer transition-colors"
                        >
                          Set as My Port
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        * Tariff estimates are updated weekly by our Yokohama Operations Desk and are subject to
        carrier bunker adjustment factors (BAF) and final booking confirmation on your official
        Proforma Invoice.
      </p>
    </div>
  );
}
