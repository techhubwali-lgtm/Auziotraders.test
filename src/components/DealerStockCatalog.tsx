import {
  Building2,
  GitCompare,
  Heart,
  ImageOff,
  MapPin,
  MessageCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  computeDealerCustomerEstimate,
  DEALER_BODY_CATEGORIES,
} from '../data/dealerPricing';
import { formatMoney, getPortById } from '../data/ports';
import type {
  CompanySettings,
  CurrencyCode,
  DealerBodyCategory,
  DealerStockVehicle,
} from '../types/portal';
import { DealerVehicleModal } from './DealerVehicleModal';

interface DealerStockCatalogProps {
  vehicles: DealerStockVehicle[];
  currency: CurrencyCode;
  selectedPortId: string;
  settings: CompanySettings;
  onInquirySubmitted?: (code: string) => void;
}

const FAVORITES_STORAGE_KEY = 'auzio_dealer_favorites_v1';

interface DealerFilters {
  query: string;
  manufacturer: string;
  model: string;
  yearMin: string;
  yearMax: string;
  priceMaxUsd: string;
  mileageMaxKm: string;
  fuelType: string;
  transmission: string;
  engineRange: string;
  bodyType: string;
  driveType: string;
  location: string;
  repairHistory: string;
  featuredOnly: boolean;
  favoritesOnly: boolean;
  statusFilter: 'available' | 'all';
  sortBy: 'latest' | 'price_asc' | 'price_desc' | 'year_desc' | 'mileage_asc';
}

const INITIAL_FILTERS: DealerFilters = {
  query: '',
  manufacturer: 'ALL',
  model: 'ALL',
  yearMin: '',
  yearMax: '',
  priceMaxUsd: '',
  mileageMaxKm: '',
  fuelType: 'ALL',
  transmission: 'ALL',
  engineRange: 'ALL',
  bodyType: 'ALL',
  driveType: 'ALL',
  location: 'ALL',
  repairHistory: 'ALL',
  featuredOnly: false,
  favoritesOnly: false,
  statusFilter: 'available',
  sortBy: 'latest',
};

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function DealerStockCatalog({
  vehicles,
  currency,
  selectedPortId,
  settings,
  onInquirySubmitted,
}: DealerStockCatalogProps) {
  const [filters, setFilters] = useState<DealerFilters>(INITIAL_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites());
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<DealerStockVehicle | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 18;

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Ignore storage quota errors
    }
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const updateFilter = (patch: Partial<DealerFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  // Distinct dropdown options built strictly from real synced records
  const filterOptions = useMemo(() => {
    const makes = new Set<string>();
    const models = new Set<string>();
    const fuels = new Set<string>();
    const transmissions = new Set<string>();
    const drives = new Set<string>();
    const locations = new Set<string>();

    for (const v of vehicles) {
      if (v.manufacturer) makes.add(v.manufacturer);
      if (
        v.model &&
        (filters.manufacturer === 'ALL' || v.manufacturer === filters.manufacturer)
      ) {
        models.add(v.model);
      }
      if (v.fuelType) fuels.add(v.fuelType);
      if (v.transmission) transmissions.add(v.transmission);
      if (v.driveType) drives.add(v.driveType);
      if (v.location) locations.add(v.location);
    }

    return {
      makes: Array.from(makes).sort(),
      models: Array.from(models).sort(),
      fuels: Array.from(fuels).sort(),
      transmissions: Array.from(transmissions).sort(),
      drives: Array.from(drives).sort(),
      locations: Array.from(locations).sort(),
    };
  }, [vehicles, filters.manufacturer]);

  const filteredVehicles = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const yMin = filters.yearMin ? Number(filters.yearMin) : null;
    const yMax = filters.yearMax ? Number(filters.yearMax) : null;
    const pMax = filters.priceMaxUsd ? Number(filters.priceMaxUsd) : null;
    const mMax = filters.mileageMaxKm ? Number(filters.mileageMaxKm) : null;

    const list = vehicles.filter((v) => {
      if (filters.statusFilter === 'available' && v.status === 'sold') return false;
      if (filters.featuredOnly && !v.featured) return false;
      if (filters.favoritesOnly && !favorites.includes(v.id)) return false;
      if (filters.manufacturer !== 'ALL' && v.manufacturer !== filters.manufacturer) return false;
      if (filters.model !== 'ALL' && v.model !== filters.model) return false;
      if (filters.fuelType !== 'ALL' && v.fuelType !== filters.fuelType) return false;
      if (filters.transmission !== 'ALL' && v.transmission !== filters.transmission) return false;
      if (filters.driveType !== 'ALL' && v.driveType !== filters.driveType) return false;
      if (filters.bodyType !== 'ALL' && v.bodyType !== filters.bodyType) return false;
      if (filters.location !== 'ALL' && v.location !== filters.location) return false;
      if (filters.repairHistory !== 'ALL' && v.repairHistory !== filters.repairHistory) return false;

      if (yMin && (v.manufacturingYear === null || v.manufacturingYear < yMin)) return false;
      if (yMax && (v.manufacturingYear === null || v.manufacturingYear > yMax)) return false;
      if (pMax && (v.estimatedFobUsd === null || v.estimatedFobUsd > pMax)) return false;
      if (mMax && (v.mileageKm === null || v.mileageKm > mMax)) return false;

      if (filters.engineRange !== 'ALL') {
        const cc = v.engineCapacityCc;
        if (cc === null) return false;
        if (filters.engineRange === 'kei' && cc > 660) return false;
        if (filters.engineRange === 'compact' && (cc <= 660 || cc > 1500)) return false;
        if (filters.engineRange === 'mid' && (cc <= 1500 || cc > 2500)) return false;
        if (filters.engineRange === 'large' && cc <= 2500) return false;
      }

      if (q) {
        const hay = [
          v.stockId,
          v.dealerName,
          v.manufacturer,
          v.model,
          v.grade,
          v.modelCode,
          v.location,
          v.exteriorColor,
          v.bodyType,
          ...(v.features || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (filters.sortBy === 'price_asc') {
        return (a.estimatedFobUsd ?? 9999999) - (b.estimatedFobUsd ?? 9999999);
      }
      if (filters.sortBy === 'price_desc') {
        return (b.estimatedFobUsd ?? -1) - (a.estimatedFobUsd ?? -1);
      }
      if (filters.sortBy === 'year_desc') {
        return (b.manufacturingYear ?? 0) - (a.manufacturingYear ?? 0);
      }
      if (filters.sortBy === 'mileage_asc') {
        return (a.mileageKm ?? 9999999) - (b.mileageKm ?? 9999999);
      }
      return (b.syncedAt || '').localeCompare(a.syncedAt || '');
    });
    return sorted;
  }, [vehicles, filters, favorites]);

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / pageSize));
  const pagedVehicles = filteredVehicles.slice((page - 1) * pageSize, page * pageSize);

  const compareVehicles = useMemo(
    () => vehicles.filter((v) => compareIds.includes(v.id)),
    [vehicles, compareIds]
  );

  const activePort = getPortById(selectedPortId);
  const cleanWhatsapp = (settings.whatsappPhone || '+81455508924').replace(/[^0-9]/g, '');

  const bodyCounts = useMemo(() => {
    const map: Partial<Record<DealerBodyCategory, number>> = {};
    for (const v of vehicles) {
      if (v.bodyType && v.status !== 'sold') {
        map[v.bodyType] = (map[v.bodyType] || 0) + 1;
      }
    }
    return map;
  }, [vehicles]);

  return (
    <div className="space-y-4">
      {/* Dealer Stock Context Header Banner */}
      <div className="p-4 rounded-xl bg-slate-950 text-white border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Building2 className="w-3.5 h-3.5" />
              <span>Verified Japanese Dealer Stock · Direct Export</span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Real-time synchronized inventory from approved Japanese dealerships. Displayed FOB, C&amp;F,
              and CIF prices to <strong className="text-white">{activePort.name}</strong> are{' '}
              <strong className="text-amber-300">indicative estimates</strong> pending dealer confirmation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => updateFilter({ featuredOnly: !filters.featuredOnly })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border cursor-pointer ${
                filters.featuredOnly
                  ? 'bg-amber-500 text-slate-950 border-amber-500'
                  : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-amber-400'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Featured</span>
            </button>
            <button
              type="button"
              onClick={() => updateFilter({ favoritesOnly: !filters.favoritesOnly })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border cursor-pointer ${
                filters.favoritesOnly
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-rose-400'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Favorites ({favorites.length})</span>
            </button>
            {compareIds.length > 0 && (
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Compare ({compareIds.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* All 13 Japanese Dealer Vehicle Body Type Quick Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={() => updateFilter({ bodyType: 'ALL' })}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
              filters.bodyType === 'ALL'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            All Categories
          </button>
          {DEALER_BODY_CATEGORIES.map((cat) => {
            const count = bodyCounts[cat] || 0;
            return (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  updateFilter({ bodyType: filters.bodyType === cat ? 'ALL' : cat })
                }
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  filters.bodyType === cat
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
                {count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* 12-Filter Advanced Dealer Search Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.query}
              onChange={(e) => updateFilter({ query: e.target.value })}
              placeholder="Search stock ID, manufacturer, model, grade, model code, features..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filters.sortBy}
              onChange={(e) =>
                updateFilter({ sortBy: e.target.value as DealerFilters['sortBy'] })
              }
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-700"
            >
              <option value="latest">Latest Arrivals</option>
              <option value="price_asc">Est. Price: Low to High</option>
              <option value="price_desc">Est. Price: High to Low</option>
              <option value="year_desc">Newest Year</option>
              <option value="mileage_asc">Lowest Mileage</option>
            </select>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Hide Filters' : 'All 12 Filters'}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilters(INITIAL_FILTERS)}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
              title="Reset filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
            {/* 1. Manufacturer */}
            <select
              value={filters.manufacturer}
              onChange={(e) => updateFilter({ manufacturer: e.target.value, model: 'ALL' })}
              className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">Manufacturer: All</option>
              {filterOptions.makes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {/* 2. Model */}
            <select
              value={filters.model}
              onChange={(e) => updateFilter({ model: e.target.value })}
              className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">Model: All</option>
              {filterOptions.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {/* 3. Year Min / Max */}
            <div className="grid grid-cols-2 gap-1">
              <input
                type="number"
                placeholder="Yr Min"
                value={filters.yearMin}
                onChange={(e) => updateFilter({ yearMin: e.target.value })}
                className="w-full px-2 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Yr Max"
                value={filters.yearMax}
                onChange={(e) => updateFilter({ yearMax: e.target.value })}
                className="w-full px-2 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>

            {/* 4. Max Est. FOB USD */}
            <select
              value={filters.priceMaxUsd}
              onChange={(e) => updateFilter({ priceMaxUsd: e.target.value })}
              className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="">Max Est. Price (USD)</option>
              <option value="10000">Up to $10,000</option>
              <option value="20000">Up to $20,000</option>
              <option value="30000">Up to $30,000</option>
              <option value="45000">Up to $45,000</option>
              <option value="70000">Up to $70,000</option>
            </select>

            {/* 5. Max Mileage */}
            <select
              value={filters.mileageMaxKm}
              onChange={(e) => updateFilter({ mileageMaxKm: e.target.value })}
              className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="">Max Mileage</option>
              <option value="30000">Under 30,000 km</option>
              <option value="60000">Under 60,000 km</option>
              <option value="100000">Under 100,000 km</option>
              <option value="150000">Under 150,000 km</option>
            </select>

            {/* 6. Fuel */}
            <select
              value={filters.fuelType}
              onChange={(e) => updateFilter({ fuelType: e.target.value })}
              className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">Fuel: All</option>
              {filterOptions.fuels.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {/* 7. Transmission */}
            <select
              value={filters.transmission}
              onChange={(e) => updateFilter({ transmission: e.target.value })}
              className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">Transmission: All</option>
              {filterOptions.transmissions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* 8. Engine Capacity */}
            <select
              value={filters.engineRange}
              onChange={(e) => updateFilter({ engineRange: e.target.value })}
              className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">Engine: All cc</option>
              <option value="kei">Kei (≤ 660 cc)</option>
              <option value="compact">661 – 1,500 cc</option>
              <option value="mid">1,501 – 2,500 cc</option>
              <option value="large">Over 2,500 cc</option>
            </select>

            {/* 9. Body Type */}
            <select
              value={filters.bodyType}
              onChange={(e) => updateFilter({ bodyType: e.target.value })}
              className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">Body Type: All (13)</option>
              {DEALER_BODY_CATEGORIES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {/* 10. Drive Type */}
            <select
              value={filters.driveType}
              onChange={(e) => updateFilter({ driveType: e.target.value })}
              className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">Drive: All</option>
              {filterOptions.drives.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* 11. Location (Japanese Prefecture) */}
            <select
              value={filters.location}
              onChange={(e) => updateFilter({ location: e.target.value })}
              className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">Location: All Japan</option>
              {filterOptions.locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            {/* 12. Condition / Repair History */}
            <select
              value={filters.repairHistory}
              onChange={(e) => updateFilter({ repairHistory: e.target.value })}
              className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">Condition: All</option>
              <option value="No Repair History">No Repair History</option>
              <option value="Repair History Present">Repair History Present</option>
            </select>
          </div>
        )}
      </div>

      {/* Result Count Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 px-1">
        <div>
          Showing <strong className="text-slate-950">{pagedVehicles.length}</strong> of{' '}
          <strong className="text-slate-950">{filteredVehicles.length}</strong> verified Japanese dealer
          vehicles
        </div>
        <div className="text-[11px] text-slate-500">
          All FOB / C&amp;F / CIF values shown in <strong>{currency}</strong> are indicative estimates
        </div>
      </div>

      {/* Empty State — Honest, Zero Fake Vehicles */}
      {filteredVehicles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-950">
            {vehicles.length === 0
              ? 'No Japanese Dealer Stock Synchronized Yet'
              : 'No Dealer Vehicles Match Your Current Filters'}
          </h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            {vehicles.length === 0
              ? 'Japanese Dealer Stock only displays real vehicles synchronized from compliance-verified Japanese dealer sources or authorized CSV/XML feeds. Administrators can run the first sync from the Admin Console → JP Dealer Stock Sync module.'
              : 'Try broadening your manufacturer, year, mileage, or body category filters.'}
          </p>
          {vehicles.length > 0 && (
            <button
              type="button"
              onClick={() => setFilters(INITIAL_FILTERS)}
              className="px-4 py-2 rounded-lg bg-slate-950 text-white text-xs font-bold cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Vehicle Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pagedVehicles.map((v) => {
              const title =
                [v.manufacturingYear, v.manufacturer, v.model].filter(Boolean).join(' ') ||
                v.stockId;
              const est = computeDealerCustomerEstimate({
                estimatedFobUsd: v.estimatedFobUsd,
                volumeM3: v.volumeM3 || 15,
                portId: selectedPortId,
              });
              const isFav = favorites.includes(v.id);
              const isCmp = compareIds.includes(v.id);
              const waMsg = encodeURIComponent(
                `Hello Auzio Traders, please confirm availability & quote for Japanese Dealer Stock #${v.stockId} (${title}).`
              );

              return (
                <article
                  key={v.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col hover:border-amber-500/80 hover:shadow-md transition-all"
                >
                  {/* Photo */}
                  <div
                    onClick={() => setSelectedVehicle(v)}
                    className="relative aspect-[16/10] bg-slate-900 overflow-hidden cursor-pointer group"
                  >
                    {v.images && v.images.length > 0 ? (
                      <img
                        src={v.images[0]}
                        alt={title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <ImageOff className="w-7 h-7 mb-1 opacity-60" />
                        <span className="text-[11px]">No Dealer Photo</span>
                      </div>
                    )}

                    {/* Top Left Manufacturer & Stock Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      {v.manufacturer && (
                        <span className="px-2 py-0.5 rounded bg-slate-950/85 text-white text-[10px] font-bold uppercase tracking-wider">
                          {v.manufacturer}
                        </span>
                      )}
                      {v.featured && (
                        <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase">
                          Featured
                        </span>
                      )}
                    </div>

                    {/* Top Right Favorite & Compare */}
                    <div
                      className="absolute top-2.5 right-2.5 flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFavorite(v.id)}
                        aria-label="Toggle favorite"
                        className={`p-1.5 rounded-full backdrop-blur-xs cursor-pointer ${
                          isFav
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-950/60 text-white hover:bg-rose-600'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCompare(v.id)}
                        aria-label="Toggle compare"
                        className={`p-1.5 rounded-full backdrop-blur-xs cursor-pointer ${
                          isCmp
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-950/60 text-white hover:bg-amber-500 hover:text-slate-950'
                        }`}
                      >
                        <GitCompare className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Bottom Status Strip */}
                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-slate-950/80 text-slate-200 font-mono">
                        {v.stockId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          v.status === 'available'
                            ? 'bg-emerald-600/90 text-white'
                            : v.status === 'unverified'
                              ? 'bg-amber-500/95 text-slate-950'
                              : 'bg-slate-700/90 text-white'
                        }`}
                      >
                        {v.status === 'available'
                          ? 'Dealer Stock'
                          : v.status === 'unverified'
                            ? 'Pending Check'
                            : 'Sold'}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectedVehicle(v)}
                        className="text-left w-full cursor-pointer group"
                      >
                        <h3 className="text-sm font-extrabold text-slate-950 group-hover:text-amber-700 line-clamp-1">
                          {title}
                        </h3>
                        {v.grade && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{v.grade}</p>
                        )}
                      </button>

                      {/* Key Specs */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600 mt-2.5">
                        <div>
                          Mileage:{' '}
                          <strong className="text-slate-900">
                            {v.mileageKm !== null ? `${v.mileageKm.toLocaleString()} km` : '—'}
                          </strong>
                        </div>
                        <div>
                          Engine:{' '}
                          <strong className="text-slate-900">
                            {v.engineCapacityCc !== null ? `${v.engineCapacityCc} cc` : '—'}
                          </strong>
                        </div>
                        <div>
                          Fuel / Trans:{' '}
                          <strong className="text-slate-900">
                            {[v.fuelType, v.transmission].filter(Boolean).join(' / ') || '—'}
                          </strong>
                        </div>
                        <div>
                          Drive / Body:{' '}
                          <strong className="text-slate-900">
                            {[v.driveType, v.bodyType].filter(Boolean).join(' · ') || '—'}
                          </strong>
                        </div>
                      </div>

                      {v.location && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-2">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {v.location} · {v.dealerName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Transparent Estimated FOB & CIF Pricing Box */}
                    <div className="pt-2.5 border-t border-slate-100 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 rounded-lg p-2 border border-slate-200/70">
                          <div className="text-[10px] font-semibold uppercase text-slate-500">
                            Est. FOB
                          </div>
                          <div className="text-xs font-mono font-extrabold text-slate-950 mt-0.5">
                            {est.estimatedFobUsd !== null
                              ? formatMoney(est.estimatedFobUsd, currency, settings.exchangeRates)
                              : 'On Request'}
                          </div>
                        </div>
                        <div className="bg-amber-50/70 rounded-lg p-2 border border-amber-200/70">
                          <div className="text-[10px] font-semibold uppercase text-amber-800 truncate">
                            Est. CIF ({activePort.name})
                          </div>
                          <div className="text-xs font-mono font-extrabold text-amber-900 mt-0.5">
                            {est.estimatedCifUsd !== null
                              ? formatMoney(est.estimatedCifUsd, currency, settings.exchangeRates)
                              : 'On Request'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedVehicle(v)}
                          className="flex-1 py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                        >
                          Details &amp; Quote
                        </button>
                        <a
                          href={`https://wa.me/${cleanWhatsapp}?text=${waMsg}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="WhatsApp inquiry"
                          className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                          title="Inquire via WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-bold rounded-md border border-slate-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs font-mono text-slate-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-bold rounded-md border border-slate-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedVehicle && (
        <DealerVehicleModal
          vehicle={selectedVehicle}
          currency={currency}
          defaultPortId={selectedPortId}
          settings={settings}
          isFavorite={favorites.includes(selectedVehicle.id)}
          onToggleFavorite={toggleFavorite}
          onClose={() => setSelectedVehicle(null)}
          onInquirySubmitted={onInquirySubmitted}
        />
      )}

      {/* Side-by-Side Comparison Modal */}
      {compareOpen && compareVehicles.length > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[88vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-slate-950">
                Side-by-Side Dealer Vehicle Comparison ({compareVehicles.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCompareIds([]);
                    setCompareOpen(false);
                  }}
                  className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setCompareOpen(false)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-4 text-slate-500 font-semibold w-36">
                      Specification
                    </th>
                    {compareVehicles.map((v) => (
                      <th key={v.id} className="text-left py-2 px-3 min-w-[180px]">
                        <div className="font-extrabold text-slate-950">
                          {[v.manufacturingYear, v.manufacturer, v.model].filter(Boolean).join(' ')}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">{v.stockId}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(
                    [
                      [
                        'Est. FOB',
                        (v: DealerStockVehicle) =>
                          v.estimatedFobUsd !== null
                            ? formatMoney(v.estimatedFobUsd, currency, settings.exchangeRates)
                            : 'On Request',
                      ],
                      [
                        `Est. CIF (${activePort.name})`,
                        (v: DealerStockVehicle) => {
                          const c = computeDealerCustomerEstimate({
                            estimatedFobUsd: v.estimatedFobUsd,
                            volumeM3: v.volumeM3 || 15,
                            portId: selectedPortId,
                          });
                          return c.estimatedCifUsd !== null
                            ? formatMoney(c.estimatedCifUsd, currency, settings.exchangeRates)
                            : 'On Request';
                        },
                      ],
                      ['Dealer', (v: DealerStockVehicle) => v.dealerName],
                      ['Year', (v: DealerStockVehicle) => (v.manufacturingYear ? String(v.manufacturingYear) : '—')],
                      ['Mileage', (v: DealerStockVehicle) => (v.mileageKm !== null ? `${v.mileageKm.toLocaleString()} km` : '—')],
                      ['Engine', (v: DealerStockVehicle) => (v.engineCapacityCc !== null ? `${v.engineCapacityCc} cc` : '—')],
                      ['Fuel', (v: DealerStockVehicle) => v.fuelType || '—'],
                      ['Transmission', (v: DealerStockVehicle) => v.transmission || '—'],
                      ['Drive', (v: DealerStockVehicle) => v.driveType || '—'],
                      ['Body Type', (v: DealerStockVehicle) => v.bodyType || '—'],
                      ['Repair History', (v: DealerStockVehicle) => v.repairHistory || '—'],
                      ['Location', (v: DealerStockVehicle) => v.location || '—'],
                    ] as Array<[string, (v: DealerStockVehicle) => string]>
                  ).map(([label, getter]) => (
                    <tr key={label}>
                      <td className="py-2 pr-4 font-semibold text-slate-600">{label}</td>
                      {compareVehicles.map((v) => (
                        <td key={v.id} className="py-2 px-3 font-medium text-slate-900">
                          {getter(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
