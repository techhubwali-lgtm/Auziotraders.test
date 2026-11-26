import {
  AlertTriangle,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck2,
  Fuel,
  Gauge,
  ImageOff,
  Lock,
  LogIn,
  MapPin,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  TrendingDown,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  calculateDealerGbpPrice,
  formatGbpAmount,
  formatJpyAmount,
} from '../config/dealerPricingConfig';
import { getPortById } from '../data/ports';
import {
  dispatchDealerStockInquiryEmail,
  fetchCachedDealerStock,
} from '../services/carapisClient';
import { submitBuyerInquiry } from '../services/firestoreService';
import type {
  CarapisListingsResponse,
  CarapisPublicListing,
  CompanySettings,
  UserProfile,
} from '../types/portal';

interface CarapisDealerStockProps {
  settings: CompanySettings;
  liveFxRates?: Record<string, number>;
  jpyFxRates?: Record<string, number>;
  selectedPortId: string;
  canViewDealerPrices: boolean;
  userProfile?: UserProfile | null;
  onOpenLogin: (mode?: 'login' | 'signup') => void;
  onInquirySubmitted?: (trackingCode: string) => void;
  onCountLoaded?: (count: number) => void;
}

interface FilterState {
  make: string;
  model: string;
  yearMin: string;
  yearMax: string;
  maxMileageKm: string;
  maxPriceGbp: string;
  source: 'ALL' | 'carsensor' | 'goonet' | 'goonet_exchange';
}

const INITIAL_FILTERS: FilterState = {
  make: 'ALL',
  model: 'ALL',
  yearMin: '',
  yearMax: '',
  maxMileageKm: '',
  maxPriceGbp: '',
  source: 'ALL',
};

const PAGE_SIZE = 18;

export function CarapisDealerStock({
  settings,
  liveFxRates,
  jpyFxRates,
  selectedPortId,
  canViewDealerPrices,
  userProfile,
  onOpenLogin,
  onInquirySubmitted,
  onCountLoaded,
}: CarapisDealerStockProps) {
  const [data, setData] = useState<CarapisListingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);

  const [detailCar, setDetailCar] = useState<CarapisPublicListing | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const [inquiryCar, setInquiryCar] = useState<CarapisPublicListing | null>(null);
  const [inqName, setInqName] = useState(userProfile?.displayName || '');
  const [inqCompany, setInqCompany] = useState(userProfile?.companyName || '');
  const [inqEmail, setInqEmail] = useState(userProfile?.email || '');
  const [inqWhatsapp, setInqWhatsapp] = useState(userProfile?.phone || '');
  const [inqMessage, setInqMessage] = useState('');
  const [inqSubmitting, setInqSubmitting] = useState(false);
  const [inqError, setInqError] = useState('');
  const [inqSuccess, setInqSuccess] = useState<{
    trackingCode: string;
    carTitle: string;
    emailDispatched: boolean;
  } | null>(null);

  const effectiveUsdRates = liveFxRates || settings.exchangeRates;
  const activePort = useMemo(() => getPortById(selectedPortId), [selectedPortId]);

  useEffect(() => {
    if (userProfile) {
      setInqName((prev) => prev || userProfile.displayName || '');
      setInqCompany((prev) => prev || userProfile.companyName || '');
      setInqEmail((prev) => prev || userProfile.email || '');
      setInqWhatsapp((prev) => prev || userProfile.phone || '');
    }
  }, [userProfile]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void fetchCachedDealerStock(controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setData(res);
        onCountLoaded?.(res.totalCached);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('Unable to load cached Japanese dealer stock from server.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [onCountLoaded]);

  const listings = useMemo(() => data?.listings || [], [data]);

  // Pre-compute final GBP price for every cached listing using single editable config + live FX
  const pricedListings = useMemo(() => {
    return listings.map((car) => ({
      car,
      pricing: calculateDealerGbpPrice(car.priceJpy, effectiveUsdRates, jpyFxRates),
    }));
  }, [listings, effectiveUsdRates, jpyFxRates]);

  // Dynamic Make & Model dropdown options extracted strictly from cached listings
  const makeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of listings) {
      counts.set(item.make, (counts.get(item.make) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [listings]);

  const modelOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of listings) {
      if (filters.make !== 'ALL' && item.make !== filters.make) continue;
      counts.set(item.model, (counts.get(item.model) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [listings, filters.make]);

  // Filter strictly in-memory against cached listings (zero API requests)
  const filteredListings = useMemo(() => {
    const yMin = filters.yearMin ? Number(filters.yearMin) : null;
    const yMax = filters.yearMax ? Number(filters.yearMax) : null;
    const maxKm = filters.maxMileageKm ? Number(filters.maxMileageKm) : null;
    const maxGbp = filters.maxPriceGbp ? Number(filters.maxPriceGbp) : null;

    return pricedListings.filter(({ car, pricing }) => {
      if (filters.source !== 'ALL' && car.source !== filters.source) return false;
      if (filters.make !== 'ALL' && car.make !== filters.make) return false;
      if (filters.model !== 'ALL' && car.model !== filters.model) return false;
      if (yMin && Number.isFinite(yMin) && car.year < yMin) return false;
      if (yMax && Number.isFinite(yMax) && car.year > yMax) return false;
      if (maxKm && Number.isFinite(maxKm) && car.mileageKm !== null && car.mileageKm > maxKm) {
        return false;
      }
      if (maxGbp && Number.isFinite(maxGbp) && pricing.rateAvailable && pricing.finalGbp > maxGbp) {
        return false;
      }
      return true;
    });
  }, [pricedListings, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredListings.slice(start, start + PAGE_SIZE);
  }, [filteredListings, safePage]);

  const updateFilter = (patch: Partial<FilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (patch.make && patch.make !== prev.make) {
        next.model = 'ALL';
      }
      return next;
    });
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const openDetail = (car: CarapisPublicListing) => {
    setDetailCar(car);
    setActivePhotoIdx(0);
  };

  const openInquiry = (car: CarapisPublicListing) => {
    setInquiryCar(car);
    setInqError('');
    setInqSuccess(null);
    setInqMessage(
      `Hello Auzio Traders team, please confirm current availability and UK landed pricing for the ${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ''} (Ref: ${car.id.slice(0, 8).toUpperCase()}).`
    );
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryCar) return;

    const cleanName = inqName.trim();
    const cleanCompany = inqCompany.trim();
    const cleanEmail = inqEmail.trim();
    const cleanWhatsapp = inqWhatsapp.trim();
    const cleanMessage = inqMessage.trim();

    if (!cleanName || !cleanEmail || !cleanEmail.includes('@')) {
      setInqError('Please enter your name and a valid email address.');
      return;
    }

    setInqSubmitting(true);
    setInqError('');

    const pricing = calculateDealerGbpPrice(inquiryCar.priceJpy, effectiveUsdRates, jpyFxRates);
    const carTitle = `${inquiryCar.year} ${inquiryCar.make} ${inquiryCar.model}${inquiryCar.trim ? ` ${inquiryCar.trim}` : ''}`;
    const usdRate = effectiveUsdRates.JPY || 154;
    const estFobUsd = Math.round(inquiryCar.priceJpy / usdRate);
    const estTotalUsd = Math.round(pricing.finalJpy / usdRate);

    const formattedDetails = [
      `[Dealer Stock Inquiry — ${inquiryCar.sourceLabel}]`,
      `Car ID: ${inquiryCar.id}`,
      `Source: ${inquiryCar.source} (${inquiryCar.sourceLabel})`,
      `Vehicle: ${carTitle}`,
      `Company: ${cleanCompany || 'N/A'}`,
      `WhatsApp: ${cleanWhatsapp || 'N/A'}`,
      `Quoted Landed UK Price: ${pricing.rateAvailable ? formatGbpAmount(pricing.finalGbp) : 'TBC'} (Original: ${formatJpyAmount(inquiryCar.priceJpy)})`,
      `Buyer Message: ${cleanMessage}`,
    ].join('\n');

    let trackingCode = '';
    try {
      const firestoreRes = await submitBuyerInquiry({
        type: 'inquiry',
        vehicleId: 'GENERAL',
        isVehiclePersisted: false,
        vehicleStockCode: `JP-${inquiryCar.source.slice(0, 3).toUpperCase()}-${inquiryCar.id.slice(0, 6).toUpperCase()}`,
        vehicleTitle: carTitle.slice(0, 120),
        buyerName: cleanName,
        buyerEmail: cleanEmail,
        buyerPhone: cleanWhatsapp || 'Not provided',
        buyerCountry: userProfile?.country || 'United Kingdom',
        destinationPortId: activePort.id,
        destinationPortName: `${activePort.name}, ${activePort.country}`,
        shippingMethod: 'roro',
        includeInsurance: true,
        fobPriceUsd: estFobUsd,
        freightUsd: Math.round(pricing.shippingUkJpy / usdRate),
        inspectionUsd: 0,
        insuranceUsd: 0,
        quotedCifUsd: estTotalUsd,
        currency: 'GBP',
        message: formattedDetails.slice(0, 1000),
      });
      trackingCode = firestoreRes.trackingCode;
    } catch (err) {
      console.error('[CarapisDealerStock] Firestore inquiry save failed:', err);
      setInqError('Could not save your inquiry to the database. Please try again.');
      setInqSubmitting(false);
      return;
    }

    let emailDispatched = false;
    try {
      const emailRes = await dispatchDealerStockInquiryEmail({
        carId: inquiryCar.id,
        source: inquiryCar.sourceLabel,
        make: inquiryCar.make,
        model: inquiryCar.model,
        year: inquiryCar.year,
        priceGbp: pricing.finalGbp,
        priceJpy: inquiryCar.priceJpy,
        name: cleanName,
        company: cleanCompany,
        email: cleanEmail,
        whatsapp: cleanWhatsapp,
        message: cleanMessage,
        trackingCode,
      });
      emailDispatched = emailRes.emailDispatched;
    } catch {
      // Firestore record already succeeded; keep smooth UX
    }

    setInqSuccess({
      trackingCode,
      carTitle,
      emailDispatched,
    });
    onInquirySubmitted?.(trackingCode);
    setInqSubmitting(false);
  };

  const detailPricing = detailCar
    ? calculateDealerGbpPrice(detailCar.priceJpy, effectiveUsdRates, jpyFxRates)
    : null;

  return (
    <div className="space-y-5">
      {/* Section Header — Strictly titled "Cars We Can Source From Japan" */}
      <div className="bg-slate-950 text-white rounded-xl p-5 border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
              <Building2 className="w-3.5 h-3.5" />
              <span>Japanese Dealer Marketplace Feed · Carsensor &amp; Goo-net</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">
              Cars We Can Source From Japan
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Browse verified Japanese dealer vehicles sourced on your behalf by Auzio Traders.
              All UK landed quotes include our sourcing fee, Japan-to-UK shipping, and margin.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0 text-xs">
            <div className="font-mono text-amber-300 font-semibold">
              {filteredListings.length.toLocaleString()} of {listings.length.toLocaleString()} cached cars
            </div>
            {data?.lastSyncedAt && (
              <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" />
                <span>
                  Daily cache updated {new Date(data.lastSyncedAt).toLocaleDateString()}{' '}
                  {new Date(data.lastSyncedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
            {!canViewDealerPrices && (
              <button
                type="button"
                onClick={() => onOpenLogin('login')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer mt-1"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log in to see dealer prices</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Client-Side Filter Bar (Filters strictly from saved cache — 0 API calls) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: 'All Sources', count: listings.length },
                { id: 'carsensor', label: 'Carsensor', count: data?.sourceCounts?.carsensor || 0 },
                { id: 'goonet', label: 'Goo-net', count: data?.sourceCounts?.goonet || 0 },
                {
                  id: 'goonet_exchange',
                  label: 'Goo-net Exchange',
                  count: data?.sourceCounts?.goonet_exchange || 0,
                },
              ] as const
            ).map((src) => (
              <button
                key={src.id}
                type="button"
                onClick={() => updateFilter({ source: src.id })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  filters.source === src.id
                    ? 'bg-slate-950 text-amber-400 border-slate-950'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-amber-500'
                }`}
              >
                {src.label}{' '}
                <span className="font-mono text-[11px] opacity-80">
                  ({src.count.toLocaleString()})
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-amber-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
          {/* Make */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Make</label>
            <select
              aria-label="Filter dealer stock by make"
              value={filters.make}
              onChange={(e) => updateFilter({ make: e.target.value })}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
            >
              <option value="ALL">All Makes ({makeOptions.length})</option>
              {makeOptions.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.count})
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Model</label>
            <select
              aria-label="Filter dealer stock by model"
              value={filters.model}
              onChange={(e) => updateFilter({ model: e.target.value })}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
            >
              <option value="ALL">All Models ({modelOptions.length})</option>
              {modelOptions.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.count})
                </option>
              ))}
            </select>
          </div>

          {/* Year Min */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Year From</label>
            <input
              type="number"
              min={1985}
              max={2027}
              placeholder="e.g. 2016"
              value={filters.yearMin}
              onChange={(e) => updateFilter({ yearMin: e.target.value })}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
            />
          </div>

          {/* Year Max */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Year To</label>
            <input
              type="number"
              min={1985}
              max={2027}
              placeholder="e.g. 2026"
              value={filters.yearMax}
              onChange={(e) => updateFilter({ yearMax: e.target.value })}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
            />
          </div>

          {/* Max Mileage (km) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Max Mileage (km)
            </label>
            <input
              type="number"
              min={0}
              step={10000}
              placeholder="e.g. 80000"
              value={filters.maxMileageKm}
              onChange={(e) => updateFilter({ maxMileageKm: e.target.value })}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
            />
          </div>

          {/* Max Price (GBP) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Max Price (GBP £)
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              placeholder="e.g. 18000"
              value={filters.maxPriceGbp}
              onChange={(e) => updateFilter({ maxPriceGbp: e.target.value })}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-pulse"
            >
              <div className="aspect-[4/3] bg-slate-200" />
              <div className="p-4 space-y-3">
                <div className="h-3 bg-slate-200 rounded w-1/3" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-10 bg-slate-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{error}</p>
            <p className="text-amber-900/80 mt-0.5">
              Dealer Stock is served from our daily server cache. Please retry shortly or contact
              our Yokohama export desk.
            </p>
          </div>
        </div>
      )}

      {/* Empty Cache / No Filter Match */}
      {!loading && !error && filteredListings.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <Car className="w-10 h-10 text-slate-400 mx-auto" />
          <div className="text-base font-bold text-slate-950">
            {listings.length === 0
              ? 'No cached Japanese dealer vehicles available yet'
              : 'No dealer vehicles match your current filters'}
          </div>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
            {listings.length === 0
              ? data?.syncStatus?.message ||
                'Add CARAPIS_API_KEY in server environment secrets so the daily cache job can populate Carsensor and Goo-net listings.'
              : 'Try broadening your make, year range, mileage, or GBP price filter to view more cached vehicles.'}
          </p>
          {listings.length > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-950 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      )}

      {/* Vehicle Grid */}
      {!loading && !error && pageItems.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pageItems.map(({ car, pricing }) => {
              const coverPhoto = car.photos[0] || '';
              return (
                <article
                  key={car.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col hover:border-amber-500/70 hover:shadow-md transition-all"
                >
                  {/* First Photo */}
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => openDetail(car)}
                      className="w-full h-full block cursor-pointer"
                    >
                      {coverPhoto ? (
                        <img
                          src={coverPhoto}
                          alt={`${car.year} ${car.make} ${car.model}`}
                          loading="lazy"
                          className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 gap-1.5">
                          <ImageOff className="w-7 h-7" />
                          <span className="text-[11px] font-medium">Photos on request</span>
                        </div>
                      )}
                    </button>

                    {/* Source Label */}
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 bg-slate-950/90 text-amber-400 text-[11px] font-bold rounded">
                      {car.sourceLabel}
                    </div>

                    {car.photos.length > 1 && (
                      <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 bg-slate-950/80 text-white font-mono text-[10px] font-semibold rounded">
                        {car.photos.length} photos
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div>
                        <button
                          type="button"
                          onClick={() => openDetail(car)}
                          className="text-left text-sm font-bold text-slate-950 hover:text-amber-700 leading-snug cursor-pointer"
                        >
                          {car.make} {car.model}
                          {car.trim ? ` ${car.trim}` : ''}
                        </button>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">{car.location}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2 text-[11px] text-slate-700 font-mono border-t border-slate-100">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {car.year}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Gauge className="w-3 h-3 text-slate-400" />
                          {car.mileageKm !== null
                            ? `${car.mileageKm.toLocaleString()} km`
                            : 'Mileage TBC'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Fuel className="w-3 h-3 text-slate-400" />
                          {car.fuelType}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Settings2 className="w-3 h-3 text-slate-400" />
                          {car.transmission}
                        </span>
                      </div>
                    </div>

                    {/* One Final Price Block (Gated by Dealer Login) */}
                    <div className="pt-2.5 border-t border-slate-200 space-y-2">
                      {canViewDealerPrices ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Estimated UK Landed Price
                          </div>
                          <div className="text-xl font-extrabold font-mono tabular-nums text-slate-950 mt-0.5">
                            {pricing.rateAvailable
                              ? formatGbpAmount(pricing.finalGbp)
                              : 'FX Loading...'}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                            Original Japan price: {formatJpyAmount(car.priceJpy)}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Price and availability to be confirmed.
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center space-y-2">
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Dealer Price Hidden</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenLogin('login')}
                            className="w-full py-1.5 px-3 rounded-md bg-slate-950 hover:bg-slate-800 text-amber-400 text-xs font-bold transition-colors cursor-pointer"
                          >
                            Log in to see price
                          </button>
                          <div className="text-[10px] text-slate-500">
                            Price and availability to be confirmed.
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => openDetail(car)}
                          className="py-2 px-2.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={() => openInquiry(car)}
                          className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Inquiry</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs">
              <span className="font-mono text-slate-600">
                Page <strong className="text-slate-950">{safePage}</strong> of{' '}
                <strong className="text-slate-950">{totalPages}</strong> (
                {filteredListings.length.toLocaleString()} vehicles)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

      {/* ===================================================================
          CAR DETAIL MODAL (All Photos, Specs, Inspection/Accident/Price History)
          Strictly omits original source URL & original dealer contacts
      =================================================================== */}
      {detailCar && detailPricing && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setDetailCar(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-slate-950 text-white px-5 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  {detailCar.sourceLabel} · Cars We Can Source From Japan
                </div>
                <h4 className="text-lg font-extrabold truncate">
                  {detailCar.year} {detailCar.make} {detailCar.model}
                  {detailCar.trim ? ` ${detailCar.trim}` : ''}
                </h4>
              </div>
              <button
                type="button"
                aria-label="Close vehicle detail"
                onClick={() => setDetailCar(null)}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Photo Gallery */}
              <div className="space-y-3">
                <div className="relative aspect-[16/10] bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  {detailCar.photos.length > 0 ? (
                    <>
                      <img
                        src={detailCar.photos[activePhotoIdx] || detailCar.photos[0]}
                        alt={`${detailCar.year} ${detailCar.make} ${detailCar.model}`}
                        className="w-full h-full object-contain bg-slate-950"
                      />
                      {detailCar.photos.length > 1 && (
                        <>
                          <button
                            type="button"
                            aria-label="Previous photo"
                            onClick={() =>
                              setActivePhotoIdx((idx) =>
                                idx === 0 ? detailCar.photos.length - 1 : idx - 1
                              )
                            }
                            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/80 text-white hover:bg-slate-900 cursor-pointer"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Next photo"
                            onClick={() =>
                              setActivePhotoIdx((idx) => (idx + 1) % detailCar.photos.length)
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/80 text-white hover:bg-slate-900 cursor-pointer"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                          <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-slate-950/80 text-white font-mono text-xs">
                            {activePhotoIdx + 1} / {detailCar.photos.length}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <ImageOff className="w-10 h-10" />
                      <span className="text-xs font-medium">
                        Additional dealer photos available upon inquiry
                      </span>
                    </div>
                  )}
                </div>

                {detailCar.photos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {detailCar.photos.map((photo, idx) => (
                      <button
                        key={photo}
                        type="button"
                        onClick={() => setActivePhotoIdx(idx)}
                        className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 cursor-pointer ${
                          idx === activePhotoIdx
                            ? 'border-amber-600'
                            : 'border-slate-200 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={photo}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Price + Primary Inquiry CTA */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="md:col-span-7">
                  {canViewDealerPrices ? (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Estimated All-In UK Landed Price
                      </div>
                      <div className="text-3xl font-extrabold font-mono tabular-nums text-slate-950 mt-0.5">
                        {detailPricing.rateAvailable
                          ? formatGbpAmount(detailPricing.finalGbp)
                          : 'FX Loading...'}
                      </div>
                      <div className="text-xs font-mono text-slate-600 mt-0.5">
                        Original Japan vehicle price: {formatJpyAmount(detailCar.priceJpy)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Price and availability to be confirmed.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                        <Lock className="w-4 h-4 text-amber-600" />
                        <span>Dealer Login Required to View Full Pricing</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Sign in to your verified dealer account to unlock landed GBP quotes and live
                        Japanese auction lots.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setDetailCar(null);
                          onOpenLogin('login');
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-amber-400 text-xs font-bold cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Log in to see price</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="md:col-span-5 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailCar;
                      setDetailCar(null);
                      openInquiry(target);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send Inquiry About This Car</span>
                  </button>
                  <p className="text-[11px] text-slate-500 text-center">
                    Auzio Traders handles inspection, purchase, deregistration &amp; UK export.
                  </p>
                </div>
              </div>

              {/* Specifications Grid */}
              <div>
                <h5 className="text-sm font-bold text-slate-950 mb-3">Vehicle Specifications</h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  {[
                    ['Make', detailCar.make],
                    ['Model', detailCar.model],
                    ['Trim / Grade', detailCar.trim || 'Standard'],
                    ['Year', String(detailCar.year)],
                    [
                      'Mileage',
                      detailCar.mileageKm !== null
                        ? `${detailCar.mileageKm.toLocaleString()} km`
                        : 'To be confirmed',
                    ],
                    ['Fuel Type', detailCar.fuelType],
                    ['Transmission', detailCar.transmission],
                    ['Body Type', detailCar.bodyType],
                    ['Exterior Color', detailCar.color],
                    ['Japan Location', detailCar.location],
                    ['Marketplace Source', detailCar.sourceLabel],
                    ['Reference ID', detailCar.id.slice(0, 12).toUpperCase()],
                  ].map(([label, val]) => (
                    <div
                      key={label}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {label}
                      </div>
                      <div className="font-bold text-slate-900 mt-0.5 truncate">{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional Inspection Sheet, Accident History & Price History */}
              {(detailCar.inspectionSheet ||
                detailCar.accidentHistory ||
                detailCar.priceHistory) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {detailCar.inspectionSheet && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-950">
                        <FileCheck2 className="w-4 h-4 text-emerald-700" />
                        <span>Inspection Information</span>
                      </div>
                      {detailCar.inspectionSheet.summary && (
                        <p className="text-xs text-slate-700">{detailCar.inspectionSheet.summary}</p>
                      )}
                      {detailCar.inspectionSheet.verified !== null &&
                        detailCar.inspectionSheet.verified !== undefined && (
                          <div className="text-xs text-emerald-800 font-semibold">
                            Marketplace Verified: {detailCar.inspectionSheet.verified ? 'Yes' : 'No'}
                          </div>
                        )}
                      {detailCar.inspectionSheet.rawDetails && (
                        <dl className="grid grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-slate-200">
                          {Object.entries(detailCar.inspectionSheet.rawDetails).map(([k, v]) => (
                            <div key={k}>
                              <dt className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}</dt>
                              <dd className="font-semibold text-slate-900">{String(v)}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  )}

                  {detailCar.accidentHistory && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-950">
                        <ShieldCheck
                          className={`w-4 h-4 ${
                            detailCar.accidentHistory.hasAccident === true
                              ? 'text-amber-600'
                              : 'text-emerald-700'
                          }`}
                        />
                        <span>Accident &amp; Repair History</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800">
                        {detailCar.accidentHistory.summary ||
                          (detailCar.accidentHistory.hasAccident === false
                            ? 'No accident history reported'
                            : detailCar.accidentHistory.hasAccident === true
                              ? 'Repair history noted'
                              : 'Not specified')}
                      </p>
                      {detailCar.accidentHistory.details && (
                        <p className="text-xs text-slate-600">{detailCar.accidentHistory.details}</p>
                      )}
                    </div>
                  )}

                  {detailCar.priceHistory && detailCar.priceHistory.length > 0 && (
                    <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-950">
                        <TrendingDown className="w-4 h-4 text-amber-600" />
                        <span>Recorded Price History</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {detailCar.priceHistory.map((entry, idx) => (
                          <div
                            key={`${entry.date}-${idx}`}
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-2"
                          >
                            <div className="text-[10px] text-slate-500">{entry.date}</div>
                            <div className="font-mono font-bold text-slate-950">
                              {formatJpyAmount(entry.priceJpy)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          SEND INQUIRY MODAL (Name, Company, Email, WhatsApp, Message)
          Saves to Firestore inquiries + dispatches server email notification
      =================================================================== */}
      {inquiryCar && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setInquiryCar(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-950 text-white px-5 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Sourcing Inquiry · {inquiryCar.sourceLabel}
                </div>
                <h4 className="text-base font-extrabold truncate">
                  {inquiryCar.year} {inquiryCar.make} {inquiryCar.model}
                </h4>
              </div>
              <button
                type="button"
                aria-label="Close inquiry modal"
                onClick={() => setInquiryCar(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inqSuccess ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h5 className="text-lg font-extrabold text-slate-950">Inquiry Sent Successfully</h5>
                  <p className="text-xs text-slate-600">
                    Your inquiry for <strong>{inqSuccess.carTitle}</strong> has been saved to our
                    Yokohama sourcing desk.
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs">
                  Tracking Reference:{' '}
                  <strong className="text-slate-950">{inqSuccess.trackingCode}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setInquiryCar(null)}
                  className="px-5 py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  Back to Dealer Stock
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => void handleInquirySubmit(e)} className="p-5 space-y-3.5">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-950">
                      {inquiryCar.year} {inquiryCar.make} {inquiryCar.model}
                      {inquiryCar.trim ? ` ${inquiryCar.trim}` : ''}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Source: {inquiryCar.sourceLabel} · ID: {inquiryCar.id.slice(0, 8).toUpperCase()}
                    </div>
                  </div>
                  {canViewDealerPrices && (
                    <div className="text-right shrink-0">
                      <div className="font-mono font-extrabold text-slate-950">
                        {formatGbpAmount(
                          calculateDealerGbpPrice(inquiryCar.priceJpy, effectiveUsdRates, jpyFxRates)
                            .finalGbp
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {formatJpyAmount(inquiryCar.priceJpy)}
                      </div>
                    </div>
                  )}
                </div>

                {inqError && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                    {inqError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={inqName}
                      onChange={(e) => setInqName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company / Dealership
                    </label>
                    <input
                      type="text"
                      value={inqCompany}
                      onChange={(e) => setInqCompany(e.target.value)}
                      placeholder="Company name"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={inqEmail}
                      onChange={(e) => setInqEmail(e.target.value)}
                      placeholder="dealer@company.co.uk"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      value={inqWhatsapp}
                      onChange={(e) => setInqWhatsapp(e.target.value)}
                      placeholder="+44 7700 900000"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Message
                  </label>
                  <textarea
                    rows={3}
                    value={inqMessage}
                    onChange={(e) => setInqMessage(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setInquiryCar(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inqSubmitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 rounded-lg cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{inqSubmitting ? 'Sending...' : 'Send Inquiry'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
