import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Gavel,
  GitCompare,
  Info,
  MapPin,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Ship,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CatalogSidebar } from '../components/CatalogSidebar';
import { DealerStockCatalog } from '../components/DealerStockCatalog';
import {
  PRICE_TIERS,
  SearchFilterBanner,
  type CatalogFilterState,
} from '../components/SearchFilterBanner';
import { VehicleImage } from '../components/VehicleImage';
import { calculateCif, formatJpyConverted, formatMoney, getPortById } from '../data/ports';
import { HERO_EXPORT_IMAGE } from '../data/seedData';
import { EN_COPY } from '../i18n/en';
import { fetchAuctionMeta, searchLiveAuctions } from '../services/auctionFeedService';
import type {
  AuctionFeedTable,
  CatalogSourceMode,
  CifBreakdown,
  CompanySettings,
  CurrencyCode,
  DealerStockVehicle,
  LiveAuctionMetaResponse,
  Vehicle,
} from '../types/portal';

interface CatalogViewProps {
  vehicles: Vehicle[];
  dealerStock?: DealerStockVehicle[];
  currency: CurrencyCode;
  selectedPortId: string;
  settings: CompanySettings;
  liveFxRates?: Record<string, number>;
  externalSourceMode?: CatalogSourceMode;
  externalFilters?: Partial<CatalogFilterState> | null;
  externalSearchNonce?: number;
  embedded?: boolean;
  compareIds: string[];
  canImportToFirestore: boolean;
  onSourceModeChange?: (mode: CatalogSourceMode) => void;
  onDealerInquirySubmitted?: (code: string) => void;
  onRegisterLiveVehicles: (items: Vehicle[]) => void;
  onImportLiveLot: (vehicle: Vehicle) => void;
  onToggleCompare: (vehicleId: string) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onOpenProforma: (params: { vehicle: Vehicle; cif: CifBreakdown }) => void;
  onStartBidRequest: (vehicle: Vehicle) => void;
  onRequestShippingQuote?: (vehicle: Vehicle) => void;
  onOpenSourcingWizard: () => void;
  onOpenWorkflowStatus: () => void;
  onNavigateShipping: () => void;
}

type SortKey = 'featured' | 'fob_asc' | 'fob_desc' | 'year_desc' | 'mileage_asc';

const INITIAL_FILTERS: CatalogFilterState = {
  searchQuery: '',
  make: 'ALL',
  model: 'ALL',
  priceRange: 'ALL',
  bodyType: 'ALL',
  steering: 'ALL',
  yearMin: '',
  yearMax: '',
  listingType: 'ALL',
  originPort: 'ALL',
  fuel: 'ALL',
  transmission: 'ALL',
  todaysOfferOnly: false,
  physicalStockOnly: false,
  highGradeOnly: false,
};

const JAPAN_ORIGIN_PORTS = ['Yokohama', 'Nagoya', 'Kobe', 'Osaka', 'Hakata'];

export function CatalogView({
  vehicles,
  dealerStock = [],
  currency,
  selectedPortId,
  settings,
  liveFxRates,
  externalSourceMode,
  externalFilters,
  externalSearchNonce,
  embedded = false,
  compareIds,
  canImportToFirestore,
  onSourceModeChange,
  onDealerInquirySubmitted,
  onRegisterLiveVehicles,
  onImportLiveLot,
  onToggleCompare,
  onSelectVehicle,
  onOpenProforma,
  onStartBidRequest,
  onRequestShippingQuote,
  onOpenSourcingWizard,
  onOpenWorkflowStatus,
  onNavigateShipping,
}: CatalogViewProps) {
  const [sourceMode, setSourceModeState] = useState<CatalogSourceMode>(
    externalSourceMode || 'curated'
  );
  const [filters, setFilters] = useState<CatalogFilterState>({
    ...INITIAL_FILTERS,
    ...(externalFilters || {}),
  });
  const [sortBy, setSortBy] = useState<SortKey>('featured');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const setSourceMode = useCallback(
    (next: CatalogSourceMode) => {
      setSourceModeState(next);
      onSourceModeChange?.(next);
    },
    [onSourceModeChange]
  );

  useEffect(() => {
    if (externalSourceMode) {
      setSourceModeState(externalSourceMode);
    }
  }, [externalSourceMode]);

  useEffect(() => {
    if (externalFilters) {
      setFilters({ ...INITIAL_FILTERS, ...externalFilters });
      setLivePage(1);
    }
  }, [externalFilters, externalSearchNonce]);

  // Live AJES / auc.auziotraders.com state
  const [liveMeta, setLiveMeta] = useState<LiveAuctionMetaResponse | null>(null);
  const [liveTable, setLiveTable] = useState<AuctionFeedTable>('main');
  const [liveAuctionHouse, setLiveAuctionHouse] = useState<string>('ALL');
  const [liveItems, setLiveItems] = useState<Vehicle[]>([]);
  const [liveTotalMatches, setLiveTotalMatches] = useState(0);
  const [livePage, setLivePage] = useState(1);
  const [liveTotalPages, setLiveTotalPages] = useState(1);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [liveSyncedAt, setLiveSyncedAt] = useState('');
  const [liveCached, setLiveCached] = useState(false);
  const [liveFeedMode, setLiveFeedMode] = useState<'ajes_api' | 'live_proxy' | 'unavailable'>('live_proxy');
  const [liveRefreshTick, setLiveRefreshTick] = useState(0);

  const activePort = useMemo(() => getPortById(selectedPortId), [selectedPortId]);
  const fmt = (usd: number) => formatMoney(usd, currency, liveFxRates || settings.exchangeRates);

  // Fetch live make/model metadata from auc.auziotraders.com once on mount
  useEffect(() => {
    let active = true;
    void fetchAuctionMeta().then((meta) => {
      if (active) setLiveMeta(meta);
    });
    return () => {
      active = false;
    };
  }, []);

  // Fetch live auction lots when in live_auctions mode
  useEffect(() => {
    if (sourceMode !== 'live_auctions') return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLiveLoading(true);
      setLiveError('');

      // Detect if searchQuery looks like a pure numeric Lot # vs Chassis code
      const qRaw = filters.searchQuery.trim();
      const lotParam = /^\d{1,6}$/.test(qRaw) ? qRaw : undefined;
      const chassisParam =
        !lotParam && /^[A-Za-z0-9-]{3,16}$/.test(qRaw) && /\d/.test(qRaw) ? qRaw : undefined;

      void searchLiveAuctions(
        {
          table: liveTable,
          make: filters.make !== 'ALL' ? filters.make : 'Toyota',
          model: filters.model !== 'ALL' ? filters.model : undefined,
          auction: liveAuctionHouse !== 'ALL' ? liveAuctionHouse : undefined,
          yearMin: filters.yearMin || undefined,
          yearMax: filters.yearMax || undefined,
          grade: filters.highGradeOnly ? '4.5' : undefined,
          steering: filters.steering !== 'ALL' ? filters.steering : undefined,
          lot: lotParam,
          chassis: chassisParam,
          page: livePage,
          jpyRate: settings.exchangeRates.JPY || 154,
        },
        controller.signal
      )
        .then((res) => {
          if (controller.signal.aborted) return;
          setLiveFeedMode(res.mode);
          if (!res.ok) {
            setLiveError(res.message || 'Unable to fetch live lots from auction feed.');
            setLiveItems([]);
            setLiveTotalMatches(0);
            setLiveTotalPages(1);
          } else {
            setLiveItems(res.items);
            setLiveTotalMatches(res.totalMatches);
            setLiveTotalPages(res.totalPages);
            setLiveSyncedAt(res.syncedAt);
            setLiveCached(res.cached);
            onRegisterLiveVehicles(res.items);
            if (res.items.length === 0 && res.message) {
              setLiveError(res.message);
            }
          }
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setLiveError('Unable to reach live auction proxy.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLiveLoading(false);
        });
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    sourceMode,
    liveTable,
    liveAuctionHouse,
    filters.make,
    filters.model,
    filters.yearMin,
    filters.yearMax,
    filters.highGradeOnly,
    filters.steering,
    filters.searchQuery,
    livePage,
    liveRefreshTick,
    settings.exchangeRates.JPY,
    onRegisterLiveVehicles,
  ]);

  const updateFilters = useCallback((patch: Partial<CatalogFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setLivePage(1);
  }, []);

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setLiveAuctionHouse('ALL');
    setSortBy('featured');
    setLivePage(1);
  };

  // Publicly browseable curated Firestore vehicles exclude archived units
  const visibleCuratedVehicles = useMemo(
    () => vehicles.filter((v) => v.status !== 'archived'),
    [vehicles]
  );

  // Active source dataset for counts & filtering
  const activeBaseVehicles =
    sourceMode === 'live_auctions' ? liveItems : visibleCuratedVehicles;

  // Live counts per make & body type for sidebar and dropdowns
  const makeCounts = useMemo(() => {
    if (sourceMode === 'live_auctions' && liveMeta?.ok) {
      const counts: Record<string, number> = {};
      for (const m of liveMeta.makes) {
        counts[m.name] = m.totalLots;
      }
      return counts;
    }
    const counts: Record<string, number> = {};
    for (const v of visibleCuratedVehicles) {
      counts[v.make] = (counts[v.make] || 0) + 1;
    }
    return counts;
  }, [sourceMode, liveMeta, visibleCuratedVehicles]);

  const bodyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of activeBaseVehicles) {
      counts[v.bodyType] = (counts[v.bodyType] || 0) + 1;
    }
    return counts;
  }, [activeBaseVehicles]);

  const availableModels = useMemo(() => {
    if (sourceMode === 'live_auctions' && liveMeta?.ok) {
      const activeMake = filters.make === 'ALL' ? 'Toyota' : filters.make;
      const list = liveMeta.modelsByMake[activeMake] || [];
      return list.slice(0, 120).map((m) => m.name);
    }
    const scoped =
      filters.make === 'ALL'
        ? visibleCuratedVehicles
        : visibleCuratedVehicles.filter(
            (v) => v.make.toLowerCase() === filters.make.toLowerCase()
          );
    return Array.from(new Set(scoped.map((v) => v.model))).sort();
  }, [sourceMode, liveMeta, visibleCuratedVehicles, filters.make]);

  const filteredVehicles = useMemo(() => {
    const q = filters.searchQuery.trim().toLowerCase();
    const minY = filters.yearMin ? Number(filters.yearMin) : 0;
    const maxY = filters.yearMax ? Number(filters.yearMax) : 0;
    const activePriceTier = PRICE_TIERS.find((t) => t.id === filters.priceRange);

    return activeBaseVehicles
      .filter((v) => {
        if (sourceMode === 'curated') {
          if (
            filters.make !== 'ALL' &&
            v.make.toLowerCase() !== filters.make.toLowerCase()
          )
            return false;
          if (filters.model !== 'ALL' && v.model !== filters.model) return false;
          if (
            filters.listingType !== 'ALL' &&
            (v.listingType || 'auzio_stock') !== filters.listingType
          )
            return false;
          if (filters.physicalStockOnly && (v.listingType || 'auzio_stock') !== 'auzio_stock')
            return false;
          if (filters.todaysOfferOnly && !v.featured) return false;
        }
        if (
          filters.bodyType !== 'ALL' &&
          v.bodyType.toLowerCase() !== filters.bodyType.toLowerCase()
        )
          return false;
        if (filters.highGradeOnly) {
          const g = v.auctionReport.exteriorGrade;
          if (g !== '4.5' && g !== '5' && g !== '6' && g !== 'S') return false;
        }
        if (filters.originPort !== 'ALL' && v.originPort !== filters.originPort) return false;
        if (filters.steering !== 'ALL' && v.steering !== filters.steering) return false;
        if (filters.fuel !== 'ALL' && v.fuelType !== filters.fuel) return false;
        if (filters.transmission !== 'ALL' && v.transmission !== filters.transmission)
          return false;
        if (minY > 0 && v.year < minY) return false;
        if (maxY > 0 && v.year > maxY) return false;
        if (activePriceTier) {
          if (activePriceTier.min !== undefined && v.fobPriceUsd < activePriceTier.min)
            return false;
          if (activePriceTier.max !== undefined && v.fobPriceUsd > activePriceTier.max)
            return false;
        }
        if (q && sourceMode === 'curated') {
          const hay =
            `${v.stockCode} ${v.make} ${v.model} ${v.trim} ${v.chassisCode} ${v.year} ${v.exteriorColor} ${v.originPort}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'fob_asc':
            return a.fobPriceUsd - b.fobPriceUsd;
          case 'fob_desc':
            return b.fobPriceUsd - a.fobPriceUsd;
          case 'year_desc':
            return b.year - a.year;
          case 'mileage_asc':
            return a.mileageKm - b.mileageKm;
          case 'featured':
          default:
            if (a.featured !== b.featured) return a.featured ? -1 : 1;
            return b.year - a.year;
        }
      });
  }, [activeBaseVehicles, sourceMode, filters, sortBy]);

  const activeChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (filters.make !== 'ALL') {
      chips.push({
        label: `Make: ${filters.make}`,
        clear: () => updateFilters({ make: 'ALL', model: 'ALL' }),
      });
    }
    if (filters.model !== 'ALL') {
      chips.push({
        label: `Model: ${filters.model}`,
        clear: () => updateFilters({ model: 'ALL' }),
      });
    }
    if (filters.priceRange !== 'ALL') {
      const t = PRICE_TIERS.find((x) => x.id === filters.priceRange);
      chips.push({
        label: `Price: ${t?.label || filters.priceRange}`,
        clear: () => updateFilters({ priceRange: 'ALL' }),
      });
    }
    if (filters.bodyType !== 'ALL') {
      chips.push({
        label: `Type: ${filters.bodyType}`,
        clear: () => updateFilters({ bodyType: 'ALL' }),
      });
    }
    if (filters.steering !== 'ALL') {
      chips.push({
        label: `Steering: ${filters.steering}`,
        clear: () => updateFilters({ steering: 'ALL' }),
      });
    }
    if (filters.yearMin || filters.yearMax) {
      chips.push({
        label: `Year: ${filters.yearMin || 'Any'} ~ ${filters.yearMax || 'Any'}`,
        clear: () => updateFilters({ yearMin: '', yearMax: '' }),
      });
    }
    if (sourceMode === 'curated' && filters.listingType !== 'ALL') {
      chips.push({
        label: EN_COPY.listingTypes[filters.listingType].shortLabel,
        clear: () => updateFilters({ listingType: 'ALL', physicalStockOnly: false }),
      });
    }
    if (filters.originPort !== 'ALL') {
      chips.push({
        label: `Port: ${filters.originPort}`,
        clear: () => updateFilters({ originPort: 'ALL' }),
      });
    }
    if (filters.todaysOfferOnly) {
      chips.push({
        label: "Today's Offer",
        clear: () => updateFilters({ todaysOfferOnly: false }),
      });
    }
    if (filters.highGradeOnly) {
      chips.push({
        label: 'Grade 4.5+',
        clear: () => updateFilters({ highGradeOnly: false }),
      });
    }
    if (filters.fuel !== 'ALL') {
      chips.push({
        label: `Fuel: ${filters.fuel}`,
        clear: () => updateFilters({ fuel: 'ALL' }),
      });
    }
    if (filters.transmission !== 'ALL') {
      chips.push({
        label: `Trans: ${filters.transmission}`,
        clear: () => updateFilters({ transmission: 'ALL' }),
      });
    }
    if (filters.searchQuery.trim()) {
      chips.push({
        label: `"${filters.searchQuery.trim()}"`,
        clear: () => updateFilters({ searchQuery: '' }),
      });
    }
    return chips;
  }, [filters, sourceMode, updateFilters]);

  const jumpToResults = () => {
    const el = document.getElementById('stock-results');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const bannerMatchCount =
    sourceMode === 'live_auctions'
      ? liveTotalMatches || filteredVehicles.length
      : filteredVehicles.length;

  return (
    <div className={embedded ? 'space-y-6' : 'space-y-6 pb-16'}>
      {/* Compact Yokohama Export Hero (hidden when embedded on unified Home page) */}
      {!embedded && (
        <section className="relative bg-slate-950 text-white overflow-hidden border-b border-slate-800">
          <div className="absolute inset-0">
            <img
              src={HERO_EXPORT_IMAGE}
              alt="AUZIO TRADERS Yokohama Ro-Ro export terminal"
              className="w-full h-full object-cover object-center opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/45" />
          </div>

          <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-9 lg:py-11">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-400 tracking-wide">
                  <span>YOKOHAMA · NAGOYA · KOBE · OSAKA</span>
                  <span className="text-slate-600">|</span>
                  <span>DIRECT JAPAN EXPORT DESK</span>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-[1.15] text-white">
                  Japanese Used Vehicles Sourced, Inspected &amp; Shipped CIF to Your Port.
                </h1>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                  Transparent landed CIF pricing to{' '}
                  <span className="text-white font-semibold">
                    {activePort.name}, {activePort.country}
                  </span>{' '}
                  ({activePort.transitDaysMin}–{activePort.transitDaysMax} days est. transit).
                  Browse AUZIO Direct Stock or search live Japanese auctions from{' '}
                  <span className="font-mono text-amber-300">auc.auziotraders.com</span>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('live_auctions');
                    setLivePage(1);
                    jumpToResults();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
                >
                  <Radio className="w-4 h-4" />
                  Browse Live Japanese Auctions
                  {liveMeta?.ok && liveMeta.totalEstimatedLots > 0
                    ? ` (${liveMeta.totalEstimatedLots.toLocaleString()})`
                    : ''}
                </button>
                <button
                  type="button"
                  onClick={onOpenSourcingWizard}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Gavel className="w-4 h-4 text-amber-400" />
                  Submit Custom Sourcing Request
                </button>
                <button
                  type="button"
                  onClick={onNavigateShipping}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Ship className="w-4 h-4 text-amber-400" />
                  14-Country Tariffs
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Storefront Container */}
      <div className={embedded ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6' : 'max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6'}>
        {/* BE FORWARD-Style Top Amber SEARCH FOR CARS Filter Banner */}
        <SearchFilterBanner
          filters={filters}
          onChange={updateFilters}
          onReset={resetFilters}
          onJumpToResults={jumpToResults}
          matchCount={bannerMatchCount}
          makeCounts={makeCounts}
          availableModels={availableModels}
          hasActiveFilters={activeChips.length > 0}
        />

        {/* Two-Column Trade Layout: Left Shop-By Sidebar + Right Inventory Directory */}
        <div id="stock-results" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Mobile Sidebar Toggle */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((p) => !p)}
              className="w-full py-2.5 px-4 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-600" />
                Shop By Make, Price, Body Type &amp; Grade
              </span>
              <span className="text-amber-700">
                {mobileSidebarOpen ? 'Hide' : 'Show'}
              </span>
            </button>
            {mobileSidebarOpen && (
              <div className="mt-3">
                <CatalogSidebar
                  filters={filters}
                  onChange={updateFilters}
                  makeCounts={makeCounts}
                  bodyCounts={bodyCounts}
                />
              </div>
            )}
          </div>

          {/* Desktop Left Sidebar (Shop By Make / Price / Type / Category) */}
          <div className="hidden lg:block lg:col-span-3 xl:col-span-3">
            <CatalogSidebar
              filters={filters}
              onChange={updateFilters}
              makeCounts={makeCounts}
              bodyCounts={bodyCounts}
            />
          </div>

          {/* Right Main Directory Column */}
          <div className="lg:col-span-9 xl:col-span-9 space-y-4">
            {/* Quick Collection Tabs + Live Auctions Tab + Shipping Origin Port Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5 shadow-2xs">
              {/* Row 1: Category Quick Tabs */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('curated');
                    updateFilters({
                      listingType: 'ALL',
                      todaysOfferOnly: false,
                      physicalStockOnly: false,
                      highGradeOnly: false,
                    });
                  }}
                  className={`px-3.5 py-2 text-xs font-bold rounded-md border transition-colors cursor-pointer ${
                    sourceMode === 'curated' &&
                    filters.listingType === 'ALL' &&
                    !filters.todaysOfferOnly &&
                    !filters.highGradeOnly
                      ? 'bg-slate-950 text-white border-slate-950'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-amber-600 hover:text-amber-800'
                  }`}
                >
                  All Curated Stock ({visibleCuratedVehicles.length})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('live_auctions');
                    setLivePage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md border transition-colors cursor-pointer ${
                    sourceMode === 'live_auctions'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  Live Japanese Auctions
                  {liveMeta?.ok && liveMeta.totalEstimatedLots > 0 && (
                    <span
                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                        sourceMode === 'live_auctions'
                          ? 'bg-slate-950/25 text-white'
                          : 'bg-amber-200/80 text-amber-950'
                      }`}
                    >
                      {liveMeta.totalEstimatedLots.toLocaleString()}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSourceMode('dealer_stock')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md border transition-colors cursor-pointer ${
                    sourceMode === 'dealer_stock'
                      ? 'bg-slate-950 text-amber-400 border-slate-950 shadow-xs'
                      : 'bg-slate-50 text-slate-900 border-slate-300 hover:border-amber-600 hover:text-amber-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Japanese Dealer Stock</span>
                  {dealerStock.filter((d) => d.status !== 'sold').length > 0 && (
                    <span
                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                        sourceMode === 'dealer_stock'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {dealerStock.filter((d) => d.status !== 'sold').length.toLocaleString()}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('curated');
                    updateFilters({
                      listingType:
                        filters.listingType === 'auzio_stock' ? 'ALL' : 'auzio_stock',
                      physicalStockOnly: filters.listingType !== 'auzio_stock',
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md border transition-colors cursor-pointer ${
                    sourceMode === 'curated' && filters.listingType === 'auzio_stock'
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-700 hover:text-emerald-800'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Auzio Direct Stock
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('curated');
                    updateFilters({
                      todaysOfferOnly: !filters.todaysOfferOnly,
                      listingType: 'ALL',
                      physicalStockOnly: false,
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md border transition-colors cursor-pointer ${
                    sourceMode === 'curated' && filters.todaysOfferOnly
                      ? 'bg-slate-900 text-amber-400 border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-amber-600 hover:text-amber-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Today&apos;s Offers
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateFilters({
                      highGradeOnly: !filters.highGradeOnly,
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-md border transition-colors cursor-pointer ${
                    filters.highGradeOnly
                      ? 'bg-slate-900 text-amber-400 border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-amber-600'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  Grade 4.5+
                </button>
              </div>

              {/* Live Auction Source Banner (shown in Live Auctions mode) */}
              {sourceMode === 'live_auctions' && (
                <div className="p-3.5 bg-slate-950 text-white rounded-lg space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 font-semibold text-amber-400">
                        <Radio className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {liveFeedMode === 'ajes_api'
                            ? 'Official AJES SQL Feed · auziotraders.com'
                            : 'Live Auction Feed · auc.auziotraders.com'}{' '}
                          ({filters.make === 'ALL' ? 'Toyota' : filters.make}
                          {filters.model !== 'ALL' ? ` ${filters.model}` : ''})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {liveTable === 'stats'
                          ? `Showing actual historical Japanese auction hammer prices converted at ¥${Number(settings.exchangeRates.JPY || 154).toFixed(2)}/USD into ${currency} CIF ${activePort.name} to help calibrate your Maximum Bid Ceiling.`
                          : `On-demand live auction query converted at ¥${Number(settings.exchangeRates.JPY || 154).toFixed(2)}/USD into ${currency} landed CIF ${activePort.name}. Click any lot to fetch its full sheet & gallery by ID.`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {liveSyncedAt && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Synced {new Date(liveSyncedAt).toLocaleTimeString()}
                          {liveCached ? ' (Cached)' : ' (Live)'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setLiveRefreshTick((t) => t + 1)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${liveLoading ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>
                  </div>

                  {/* Table Toggle (Upcoming Live Auctions vs Sold Statistics) + Auction House Filter */}
                  <div className="pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="inline-flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLiveTable('main');
                          setLivePage(1);
                        }}
                        className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                          liveTable === 'main'
                            ? 'bg-amber-600 text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Upcoming Live Auctions
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLiveTable('stats');
                          setLivePage(1);
                        }}
                        className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                          liveTable === 'stats'
                            ? 'bg-amber-600 text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Sold Price Statistics
                      </button>
                    </div>

                    {liveMeta?.auctions && liveMeta.auctions.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Auction House:</span>
                        <select
                          aria-label="Filter by Japanese auction house"
                          value={liveAuctionHouse}
                          onChange={(e) => {
                            setLiveAuctionHouse(e.target.value);
                            setLivePage(1);
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium bg-slate-900 text-white border border-slate-700 rounded-md focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="ALL">All Auction Houses ({liveMeta.auctions.length})</option>
                          {liveMeta.auctions.slice(0, 60).map((house) => (
                            <option key={house.name} value={house.name}>
                              {house.name} ({house.count.toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Row 2: View Vehicles Shipping From (Japan Dispatch Terminals) */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium inline-flex items-center gap-1 mr-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    Shipping from Japan port:
                  </span>
                  <button
                    type="button"
                    onClick={() => updateFilters({ originPort: 'ALL' })}
                    className={`px-2.5 py-1 rounded border text-[11px] font-semibold cursor-pointer ${
                      filters.originPort === 'ALL'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-amber-600'
                    }`}
                  >
                    All Ports
                  </button>
                  {JAPAN_ORIGIN_PORTS.map((port) => (
                    <button
                      key={port}
                      type="button"
                      onClick={() =>
                        updateFilters({
                          originPort: filters.originPort === port ? 'ALL' : port,
                        })
                      }
                      className={`px-2.5 py-1 rounded border text-[11px] font-semibold cursor-pointer ${
                        filters.originPort === port
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-amber-600'
                      }`}
                    >
                      {port}
                    </button>
                  ))}
                </div>

                {/* Sort Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Sort:</span>
                  <select
                    aria-label="Sort vehicles"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="px-2.5 py-1 text-xs font-medium bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:border-amber-600 cursor-pointer"
                  >
                    <option value="featured">Featured First</option>
                    <option value="fob_asc">Price: Low to High</option>
                    <option value="fob_desc">Price: High to Low</option>
                    <option value="year_desc">Year: Newest First</option>
                    <option value="mileage_asc">Mileage: Lowest First</option>
                  </select>
                </div>
              </div>

              {/* Active Filter Chips + Honest Workflow Link */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-slate-600">
                    {sourceMode === 'live_auctions' ? (
                      <>
                        <strong className="text-slate-950">
                          {liveTotalMatches.toLocaleString()}
                        </strong>{' '}
                        live lots (showing {filteredVehicles.length} on page {livePage}) · CIF to{' '}
                        <strong className="text-slate-950">{activePort.name}</strong> ({currency})
                      </>
                    ) : (
                      <>
                        <strong className="text-slate-950">{filteredVehicles.length}</strong>{' '}
                        matches · CIF to{' '}
                        <strong className="text-slate-950">{activePort.name}</strong> ({currency})
                      </>
                    )}
                  </span>
                  {activeChips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={chip.clear}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-950 border border-amber-200 rounded text-[11px] font-semibold hover:bg-amber-100 cursor-pointer"
                    >
                      <span>{chip.label}</span>
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onOpenWorkflowStatus}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-amber-700 cursor-pointer whitespace-nowrap"
                >
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  Auction &amp; Payment Disclosure
                </button>
              </div>
            </div>

            {/* Dedicated Japanese Dealer Stock Storefront (separate from Auction & Curated Stock) */}
            {sourceMode === 'dealer_stock' ? (
              <DealerStockCatalog
                vehicles={dealerStock}
                currency={currency}
                selectedPortId={selectedPortId}
                settings={settings}
                onInquirySubmitted={onDealerInquirySubmitted}
              />
            ) : (
              <>
            {/* Live Feed Error / Notice Banner */}
            {sourceMode === 'live_auctions' && liveError && !liveLoading && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">{liveError}</p>
                  <p className="text-amber-900/80">
                    You can also switch back to Curated Stock or submit a Guided Sourcing Request
                    for our Yokohama team to source your exact specification directly at USS/TAA.
                  </p>
                </div>
              </div>
            )}

            {/* Loading Skeletons (Live Auctions Mode) */}
            {sourceMode === 'live_auctions' && liveLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-pulse"
                  >
                    <div className="aspect-[4/3] bg-slate-200" />
                    <div className="p-4 space-y-3">
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-3 bg-slate-100 rounded" />
                        <div className="h-3 bg-slate-100 rounded" />
                      </div>
                      <div className="h-12 bg-slate-100 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                <div className="text-base font-bold text-slate-950">
                  No {sourceMode === 'live_auctions' ? 'live auction lots' : 'immediate yard stock'}{' '}
                  match {filters.make !== 'ALL' ? `${filters.make} ` : ''}
                  {filters.bodyType !== 'ALL' ? `${filters.bodyType} ` : ''}
                  with your current filters
                </div>
                <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                  Our Yokohama buyers source directly from 120+ Japanese auto auctions (USS, TAA,
                  CAA, HAA) daily. Submit a Guided Sourcing Request with your Maximum Bid Ceiling
                  and we will shortlist matching units with translated inspection sheets.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Filters
                  </button>
                  {sourceMode === 'curated' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSourceMode('live_auctions');
                        setLivePage(1);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5 text-amber-700" />
                      Search Live Auctions Instead
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenSourcingWizard}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 cursor-pointer"
                  >
                    Request Custom Auction Sourcing
                    {filters.make !== 'ALL' ? ` for ${filters.make}` : ''}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredVehicles.map((vehicle) => {
                    const cif = calculateCif({
                      fobUsd: vehicle.fobPriceUsd,
                      volumeM3: vehicle.volumeM3,
                      portId: selectedPortId,
                      shippingMethod: 'roro',
                      includeInsurance: true,
                    });
                    const isCompared = compareIds.includes(vehicle.id);
                    const listingKey = vehicle.listingType || 'auzio_stock';
                    const listingMeta = EN_COPY.listingTypes[listingKey];
                    const isAuction = listingKey === 'auction_listing';
                    const isLiveFeed = Boolean(vehicle.auctionSourceMeta);
                    const isSoldStat = vehicle.auctionSourceMeta?.table === 'stats';
                    const rawJpy = isSoldStat
                      ? vehicle.auctionSourceMeta?.rawFinishPriceJpy ||
                        vehicle.auctionSourceMeta?.rawAvgPriceJpy ||
                        0
                      : vehicle.auctionSourceMeta?.rawAvgPriceJpy ||
                        vehicle.auctionSourceMeta?.rawStartPriceJpy ||
                        vehicle.auctionSourceMeta?.rawFinishPriceJpy ||
                        0;

                    return (
                      <article
                        key={vehicle.id}
                        className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col hover:border-amber-500/70 hover:shadow-md transition-all"
                      >
                        {/* Photo Header */}
                        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => onSelectVehicle(vehicle)}
                            className="w-full h-full block cursor-pointer"
                          >
                            <VehicleImage
                              src={vehicle.images[0]}
                              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                              className="hover:scale-[1.02] transition-transform duration-300"
                            />
                          </button>

                          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-slate-950/85 text-white font-mono text-[11px] font-semibold rounded">
                            {isLiveFeed
                              ? `LOT #${vehicle.auctionSourceMeta?.lotNumber}`
                              : vehicle.stockCode}
                          </div>

                          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-white/95 text-slate-950 font-mono text-[11px] font-bold rounded border border-slate-200">
                            Grade {vehicle.auctionReport.exteriorGrade}/
                            {vehicle.auctionReport.interiorGrade}
                          </div>

                          {isLiveFeed && vehicle.auctionSourceMeta?.auctionDate && (
                            <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 bg-slate-950/80 text-amber-300 font-mono text-[10px] font-semibold rounded">
                              {vehicle.auctionSourceMeta.auctionHouse} ·{' '}
                              {vehicle.auctionSourceMeta.auctionDate}
                            </div>
                          )}

                          {isLiveFeed && vehicle.auctionSourceMeta?.auctionStatus && (
                            <div
                              className={`absolute bottom-2.5 right-2.5 px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded ${
                                vehicle.auctionSourceMeta.auctionStatus.toLowerCase() === 'sold'
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-slate-800/90 text-slate-200'
                              }`}
                            >
                              {vehicle.auctionSourceMeta.auctionStatus}
                            </div>
                          )}

                          {!isLiveFeed && vehicle.status !== 'available' && (
                            <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 bg-red-700 text-white text-[11px] font-semibold uppercase tracking-wide rounded">
                              {vehicle.status}
                            </div>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <div className="space-y-1.5">
                            <div
                              className={`text-[11px] font-semibold flex items-center justify-between gap-1.5 ${
                                isSoldStat
                                  ? 'text-slate-700'
                                  : isAuction
                                    ? 'text-amber-800'
                                    : listingKey === 'partner_stock'
                                      ? 'text-slate-600'
                                      : 'text-emerald-800'
                              }`}
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                {isAuction && !isSoldStat && (
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span className="truncate">
                                  {isSoldStat
                                    ? 'Historical Auction Result (Price Reference)'
                                    : isLiveFeed
                                      ? 'Live Auction Lot — Not Yet Purchased'
                                      : listingMeta.label}
                                </span>
                              </span>
                              {isLiveFeed &&
                                vehicle.auctionSourceMeta?.sourceUrl.startsWith(
                                  'https://auc.auziotraders.com/'
                                ) && (
                                  <a
                                    href={vehicle.auctionSourceMeta.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="View on auc.auziotraders.com"
                                    className="text-slate-400 hover:text-amber-700 shrink-0"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                            </div>

                            <div>
                              <button
                                type="button"
                                onClick={() => onSelectVehicle(vehicle)}
                                className="text-left text-sm font-bold text-slate-950 hover:text-amber-700 leading-snug cursor-pointer"
                              >
                                {vehicle.year} {vehicle.make} {vehicle.model}
                              </button>
                              <div className="text-xs text-slate-500 truncate">
                                {vehicle.trim}
                                {vehicle.chassisCode ? ` · ${vehicle.chassisCode}` : ''}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1.5 text-[11px] text-slate-600 font-mono tabular-nums border-t border-slate-100">
                              <span>
                                {vehicle.mileageKm > 0
                                  ? `${vehicle.mileageKm.toLocaleString()} km`
                                  : 'Sheet Verified'}
                              </span>
                              <span>{vehicle.engineCc.toLocaleString()} cc</span>
                              <span>
                                {vehicle.fuelType} · {vehicle.transmission}
                              </span>
                              <span>
                                {vehicle.drivetrain} · {vehicle.steering}
                              </span>
                            </div>
                          </div>

                          {/* Pricing Block */}
                          <div className="pt-2.5 border-t border-slate-200 space-y-1.5">
                            {isLiveFeed && rawJpy > 0 && (
                              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                                <span className="text-slate-500">
                                  {vehicle.auctionSourceMeta?.priceBasis === 'finish'
                                    ? 'Sold Hammer'
                                    : vehicle.auctionSourceMeta?.priceBasis === 'average'
                                      ? 'Auction Avg'
                                      : 'Auction Start'}
                                </span>
                                <span className="font-mono font-semibold text-amber-800 tabular-nums text-right">
                                  {formatJpyConverted(rawJpy, currency, settings.exchangeRates)}
                                  {currency !== 'JPY' && (
                                    <span className="text-[10px] font-normal text-slate-500 ml-1">
                                      (¥{rawJpy.toLocaleString()})
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="text-slate-500">
                                {isSoldStat
                                  ? 'Ref. Export FOB'
                                  : isAuction
                                    ? 'Est. FOB'
                                    : `FOB ${vehicle.originPort}`}
                              </span>
                              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                                {fmt(vehicle.fobPriceUsd)}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
                              <div className="min-w-0 pr-2">
                                <div className="text-[11px] font-semibold text-slate-900">
                                  {cif.rateAvailable ? 'Est. CIF Total' : 'Ocean Shipping'}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  to {activePort.name}
                                </div>
                              </div>
                              {cif.rateAvailable ? (
                                <div className="text-base font-bold font-mono tabular-nums text-amber-700 shrink-0">
                                  {fmt(cif.totalCifUsd)}
                                </div>
                              ) : (
                                <div className="text-xs font-bold text-slate-700 shrink-0">
                                  Custom Quote
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="space-y-2 pt-0.5">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => onSelectVehicle(vehicle)}
                                className="py-2 px-2.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                              >
                                {isLiveFeed ? 'Sheet & CIF' : 'View Specs'}
                              </button>
                              {!cif.rateAvailable ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRequestShippingQuote
                                      ? onRequestShippingQuote(vehicle)
                                      : onStartBidRequest(vehicle)
                                  }
                                  className="py-2 px-2.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  Request Quote
                                </button>
                              ) : isAuction ? (
                                <button
                                  type="button"
                                  onClick={() => onStartBidRequest(vehicle)}
                                  className="py-2 px-2.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  Bid / Quote
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onOpenProforma({ vehicle, cif })}
                                  className="inline-flex items-center justify-center gap-1 py-2 px-2.5 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Proforma P/I
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onToggleCompare(vehicle.id)}
                                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                                  isCompared
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                              >
                                <GitCompare className="w-3.5 h-3.5" />
                                {isCompared ? 'In Compare' : '+ Compare'}
                              </button>
                              {canImportToFirestore && isLiveFeed && (
                                <button
                                  type="button"
                                  onClick={() => onImportLiveLot(vehicle)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                                >
                                  <Download className="w-3 h-3 text-amber-400" />
                                  Import
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Live Auctions Pagination Bar */}
                {sourceMode === 'live_auctions' && liveTotalPages > 1 && (
                  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs">
                    <span className="font-mono text-slate-600">
                      Page <strong className="text-slate-950">{livePage}</strong> of{' '}
                      <strong className="text-slate-950">{liveTotalPages.toLocaleString()}</strong>{' '}
                      ({liveTotalMatches.toLocaleString()} live lots)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={livePage <= 1 || liveLoading}
                        onClick={() => {
                          setLivePage((p) => Math.max(1, p - 1));
                          jumpToResults();
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={livePage >= liveTotalPages || liveLoading}
                        onClick={() => {
                          setLivePage((p) => Math.min(liveTotalPages, p + 1));
                          jumpToResults();
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold text-white bg-slate-950 hover:bg-slate-800 disabled:opacity-40 rounded-lg cursor-pointer"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
