import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import type { ListingType } from '../types/portal';

export interface CatalogFilterState {
  searchQuery: string;
  make: string;
  model: string;
  priceRange: string;
  bodyType: string;
  steering: 'ALL' | 'RHD' | 'LHD';
  yearMin: string;
  yearMax: string;
  listingType: 'ALL' | ListingType;
  originPort: string;
  fuel: string;
  transmission: string;
  todaysOfferOnly: boolean;
  physicalStockOnly: boolean;
  highGradeOnly: boolean;
}

export const EXPORT_MAKES = [
  'Toyota',
  'Nissan',
  'Honda',
  'Mazda',
  'Mitsubishi',
  'Subaru',
  'Suzuki',
  'Isuzu',
  'Daihatsu',
  'Hino',
  'UD Trucks',
  'Lexus',
  'Mercedes-Benz',
  'BMW',
  'Land Rover',
  'Volkswagen',
  'Audi',
  'Jeep',
];

export const EXPORT_BODY_TYPES = [
  'SUV',
  'Pickup',
  'Sedan',
  'Hatchback',
  'Van',
  'Mini Van',
  'Wagon',
  'Coupe',
  'Truck',
  'Bus',
  'Mini Bus',
  'Mini Vehicle',
  'Convertible',
  'Tractor',
  'Forklift',
  'Machinery',
];

export const PRICE_TIERS: { id: string; label: string; min?: number; max?: number }[] = [
  { id: 'under_12000', label: 'Under $12,000', max: 12000 },
  { id: '12000_18000', label: '$12,000 - $18,000', min: 12000, max: 18000 },
  { id: '18000_25000', label: '$18,000 - $25,000', min: 18000, max: 25000 },
  { id: '25000_32000', label: '$25,000 - $32,000', min: 25000, max: 32000 },
  { id: '32000_40000', label: '$32,000 - $40,000', min: 32000, max: 40000 },
  { id: 'over_40000', label: 'Over $40,000', min: 40000 },
];

const YEAR_OPTIONS = [
  2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2012, 2010,
];

interface SearchFilterBannerProps {
  filters: CatalogFilterState;
  onChange: (patch: Partial<CatalogFilterState>) => void;
  onReset: () => void;
  onJumpToResults: () => void;
  matchCount: number;
  makeCounts: Record<string, number>;
  availableModels: string[];
  hasActiveFilters: boolean;
}

export function SearchFilterBanner({
  filters,
  onChange,
  onReset,
  onJumpToResults,
  matchCount,
  makeCounts,
  availableModels,
  hasActiveFilters,
}: SearchFilterBannerProps) {
  const [showMoreSpecs, setShowMoreSpecs] = useState(false);
  const [showDealTip, setShowDealTip] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden shadow-md border border-amber-700/30">
      {/* Signature Amber Export Search Header */}
      <div className="bg-amber-600 text-white">
        {/* Top Row: SEARCH FOR CARS Tab + Quick Deals Checkboxes */}
        <div className="px-4 sm:px-6 pt-3 pb-2.5 border-b border-amber-400/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 pb-1 border-b-2 border-white">
            <Search className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs sm:text-sm font-extrabold tracking-wide uppercase">
              Search For Cars
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs relative">
            <span className="font-bold text-amber-50">Deals</span>

            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.todaysOfferOnly}
                onChange={(e) => onChange({ todaysOfferOnly: e.target.checked })}
                className="w-3.5 h-3.5 rounded accent-slate-950 cursor-pointer"
              />
              <span className="px-2 py-0.5 bg-slate-950 text-amber-300 font-extrabold italic tracking-tight rounded text-[11px]">
                TODAY&apos;S OFFER!!
              </span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.physicalStockOnly}
                onChange={(e) =>
                  onChange({
                    physicalStockOnly: e.target.checked,
                    listingType: e.target.checked ? 'auzio_stock' : 'ALL',
                  })
                }
                className="w-3.5 h-3.5 rounded accent-slate-950 cursor-pointer"
              />
              <span className="px-2 py-0.5 bg-white text-slate-950 font-bold rounded text-[11px]">
                auzio <span className="text-amber-700">direct stock</span>
              </span>
            </label>

            <button
              type="button"
              onClick={() => setShowDealTip((p) => !p)}
              aria-label="Explain deal filters"
              className="text-amber-100 hover:text-white cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {showDealTip && (
              <div className="absolute right-0 top-8 z-30 w-72 bg-slate-950 text-slate-200 border border-slate-700 rounded-lg p-3 text-[11px] shadow-xl leading-relaxed">
                <p>
                  <strong className="text-amber-400">TODAY&apos;S OFFER:</strong> Featured export
                  units with priority Yokohama dispatch.
                </p>
                <p className="mt-1.5">
                  <strong className="text-white">Auzio Direct Stock:</strong> Vehicles physically
                  owned in our Japanese export yards (excludes unpurchased auction lots).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main 2-Row x 3-Column Filter Grid + SEARCH Action Column */}
        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-3">
            {/* Row 1, Col 1: Make */}
            <div className="flex items-center gap-2.5">
              <label
                htmlFor="filter-make"
                className="w-16 shrink-0 text-xs font-bold text-white"
              >
                Make
              </label>
              <select
                id="filter-make"
                value={filters.make}
                onChange={(e) => onChange({ make: e.target.value, model: 'ALL' })}
                className="flex-1 min-w-0 px-2.5 py-2 text-xs font-medium text-slate-950 bg-white border border-amber-800/30 rounded focus:outline-none focus:ring-2 focus:ring-slate-950 cursor-pointer"
              >
                <option value="ALL">Select</option>
                {EXPORT_MAKES.map((make) => (
                  <option key={make} value={make}>
                    {make.toUpperCase()} ({makeCounts[make] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Row 1, Col 2: Model */}
            <div className="flex items-center gap-2.5">
              <label
                htmlFor="filter-model"
                className="w-16 shrink-0 text-xs font-bold text-white"
              >
                Model
              </label>
              <select
                id="filter-model"
                value={filters.model}
                onChange={(e) => onChange({ model: e.target.value })}
                className="flex-1 min-w-0 px-2.5 py-2 text-xs font-medium text-slate-950 bg-white border border-amber-800/30 rounded focus:outline-none focus:ring-2 focus:ring-slate-950 cursor-pointer"
              >
                <option value="ALL">Select</option>
                {availableModels.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 1, Col 3: Price */}
            <div className="flex items-center gap-2.5">
              <label
                htmlFor="filter-price"
                className="w-16 shrink-0 text-xs font-bold text-white"
              >
                Price
              </label>
              <select
                id="filter-price"
                value={filters.priceRange}
                onChange={(e) => onChange({ priceRange: e.target.value })}
                className="flex-1 min-w-0 px-2.5 py-2 text-xs font-medium text-slate-950 bg-white border border-amber-800/30 rounded focus:outline-none focus:ring-2 focus:ring-slate-950 cursor-pointer"
              >
                <option value="ALL">Select</option>
                {PRICE_TIERS.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.label} (FOB)
                  </option>
                ))}
              </select>
            </div>

            {/* Row 2, Col 1: Type */}
            <div className="flex items-center gap-2.5">
              <label
                htmlFor="filter-type"
                className="w-16 shrink-0 text-xs font-bold text-white"
              >
                Type
              </label>
              <select
                id="filter-type"
                value={filters.bodyType}
                onChange={(e) => onChange({ bodyType: e.target.value })}
                className="flex-1 min-w-0 px-2.5 py-2 text-xs font-medium text-slate-950 bg-white border border-amber-800/30 rounded focus:outline-none focus:ring-2 focus:ring-slate-950 cursor-pointer"
              >
                <option value="ALL">Select</option>
                {EXPORT_BODY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 2, Col 2: Steering */}
            <div className="flex items-center gap-2.5">
              <label
                htmlFor="filter-steering"
                className="w-16 shrink-0 text-xs font-bold text-white"
              >
                Steering
              </label>
              <select
                id="filter-steering"
                value={filters.steering}
                onChange={(e) =>
                  onChange({ steering: e.target.value as 'ALL' | 'RHD' | 'LHD' })
                }
                className="flex-1 min-w-0 px-2.5 py-2 text-xs font-medium text-slate-950 bg-white border border-amber-800/30 rounded focus:outline-none focus:ring-2 focus:ring-slate-950 cursor-pointer"
              >
                <option value="ALL">Select</option>
                <option value="RHD">Right Hand Drive (RHD)</option>
                <option value="LHD">Left Hand Drive (LHD)</option>
              </select>
            </div>

            {/* Row 2, Col 3: Year ~ Year */}
            <div className="flex items-center gap-2.5">
              <span className="w-16 shrink-0 text-xs font-bold text-white">Year</span>
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <select
                  aria-label="Minimum year"
                  value={filters.yearMin}
                  onChange={(e) => onChange({ yearMin: e.target.value })}
                  className="flex-1 min-w-0 px-2 py-2 text-xs font-medium text-slate-950 bg-white border border-amber-800/30 rounded focus:outline-none cursor-pointer"
                >
                  <option value="">Select</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
                <span className="font-bold text-white">~</span>
                <select
                  aria-label="Maximum year"
                  value={filters.yearMax}
                  onChange={(e) => onChange({ yearMax: e.target.value })}
                  className="flex-1 min-w-0 px-2 py-2 text-xs font-medium text-slate-950 bg-white border border-amber-800/30 rounded focus:outline-none cursor-pointer"
                >
                  <option value="">Select</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Right Column: High-Contrast SEARCH Button & Live Match Count */}
          <div className="lg:col-span-3 flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-2.5 lg:border-l lg:border-amber-500/60 lg:pl-5">
            <button
              type="button"
              onClick={onJumpToResults}
              className="flex-1 lg:w-full py-3 px-6 text-sm font-extrabold tracking-wider uppercase text-white bg-slate-950 hover:bg-slate-800 rounded shadow-sm transition-colors cursor-pointer"
            >
              SEARCH
            </button>
            <div className="text-center shrink-0">
              <span className="text-lg font-extrabold font-mono tabular-nums text-slate-950">
                {matchCount.toLocaleString()}
              </span>{' '}
              <span className="text-xs font-semibold text-slate-950">items match</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Sub-Bar: Keyword Search + Expandable Spec Filters + Reset */}
      <div className="bg-white px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[220px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => onChange({ searchQuery: e.target.value })}
              placeholder="Keyword, Stock ID (AUZ-JP-1041), Chassis Code..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:bg-white focus:border-amber-600"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowMoreSpecs((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
            <span>Fuel / Transmission / Source</span>
            {showMoreSpecs ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-950 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All Filters
          </button>
        )}
      </div>

      {showMoreSpecs && (
        <div className="bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Fuel Type
            </label>
            <select
              value={filters.fuel}
              onChange={(e) => onChange({ fuel: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="ALL">All Fuel Types</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Diesel">Diesel</option>
              <option value="Petrol">Petrol</option>
              <option value="Electric">Electric</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Transmission
            </label>
            <select
              value={filters.transmission}
              onChange={(e) => onChange({ transmission: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="ALL">All Transmissions</option>
              <option value="Automatic">Automatic</option>
              <option value="CVT">CVT</option>
              <option value="Manual">Manual</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Stock Source
            </label>
            <select
              value={filters.listingType}
              onChange={(e) =>
                onChange({
                  listingType: e.target.value as 'ALL' | ListingType,
                  physicalStockOnly: e.target.value === 'auzio_stock',
                })
              }
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="ALL">All Sources</option>
              <option value="auzio_stock">Auzio Physical Stock</option>
              <option value="auction_listing">Auction Listing — Not Yet Purchased</option>
              <option value="partner_stock">Supplier / Partner Stock</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
