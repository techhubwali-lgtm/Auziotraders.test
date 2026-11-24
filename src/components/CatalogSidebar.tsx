import {
  Award,
  Car,
  Check,
  DollarSign,
  Gavel,
  Leaf,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import {
  EXPORT_MAKES,
  PRICE_TIERS,
  type CatalogFilterState,
} from './SearchFilterBanner';

interface CatalogSidebarProps {
  filters: CatalogFilterState;
  onChange: (patch: Partial<CatalogFilterState>) => void;
  makeCounts: Record<string, number>;
  bodyCounts: Record<string, number>;
}

const SIDEBAR_BODY_TYPES = [
  'SUV',
  'Pickup',
  'Van',
  'Sedan',
  'Hatchback',
  'Coupe',
  'Wagon',
  'Truck',
  'Mini Van',
  'Bus',
];

function BodyTypeSilhouette({ type }: { type: string }) {
  // Crisp minimal side-profile SVG icons matching export directory style
  if (type === 'SUV' || type === 'Mini Van') {
    return (
      <svg viewBox="0 0 36 18" className="w-7 h-3.5 shrink-0 fill-current">
        <path d="M4 13h2a2.5 2.5 0 0 0 5 0h13a2.5 2.5 0 0 0 5 0h3v-4l-2-1.5L26 4H10L6 8H3v5h1zm6.5-7.5h6V8h-8l2-2.5zm8 0h6.5L27.5 8h-9V5.5z" />
      </svg>
    );
  }
  if (type === 'Pickup' || type === 'Truck') {
    return (
      <svg viewBox="0 0 36 18" className="w-7 h-3.5 shrink-0 fill-current">
        <path d="M3 13h3a2.5 2.5 0 0 0 5 0h14a2.5 2.5 0 0 0 5 0h3V8.5h-9V4H11L7 8.5H3V13zm9-7.5h10v3H9.5L12 5.5z" />
      </svg>
    );
  }
  if (type === 'Van' || type === 'Bus') {
    return (
      <svg viewBox="0 0 36 18" className="w-7 h-3.5 shrink-0 fill-current">
        <path d="M3 13h3a2.5 2.5 0 0 0 5 0h14a2.5 2.5 0 0 0 5 0h3V4.5A1.5 1.5 0 0 0 31.5 3h-23L4 8v5h-1zm5-8h5v3H6.5L8 5zm7 0h7v3h-7V5zm9 0h7v3h-7V5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 36 18" className="w-7 h-3.5 shrink-0 fill-current">
      <path d="M3 13h3a2.5 2.5 0 0 0 5 0h14a2.5 2.5 0 0 0 5 0h3v-3l-3-1.5-5-3.5H12L7 8.5 3 9.5V13zm10-6.5h10l3.5 2.5h-17L13 6.5z" />
    </svg>
  );
}

function MakeMonogram({ make }: { make: string }) {
  const letters = make
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="w-6 h-6 rounded-full border border-slate-300 bg-slate-50 text-[10px] font-extrabold text-slate-800 inline-flex items-center justify-center shrink-0">
      {letters}
    </span>
  );
}

export function CatalogSidebar({
  filters,
  onChange,
  makeCounts,
  bodyCounts,
}: CatalogSidebarProps) {
  return (
    <aside className="space-y-4">
      {/* 1. Shop By Make */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="px-3.5 py-2.5 bg-amber-600 text-white text-xs font-extrabold tracking-wide flex items-center justify-between">
          <span>Shop By Make</span>
          {filters.make !== 'ALL' && (
            <button
              type="button"
              onClick={() => onChange({ make: 'ALL', model: 'ALL' })}
              className="text-[10px] underline text-amber-100 hover:text-white cursor-pointer"
            >
              All
            </button>
          )}
        </div>
        <ul className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
          {EXPORT_MAKES.map((make) => {
            const count = makeCounts[make] || 0;
            const isActive = filters.make === make;
            return (
              <li key={make}>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      make: isActive ? 'ALL' : make,
                      model: 'ALL',
                    })
                  }
                  className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-amber-50 text-amber-950 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <MakeMonogram make={make} />
                    <span className="truncate uppercase tracking-tight">{make}</span>
                  </span>
                  <span
                    className={`font-mono text-[11px] shrink-0 ${
                      count > 0 ? 'text-slate-900 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    ({count})
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 2. Shop By Price */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="px-3.5 py-2.5 bg-amber-600 text-white text-xs font-extrabold tracking-wide flex items-center justify-between">
          <span>Shop By Price (FOB)</span>
          {filters.priceRange !== 'ALL' && (
            <button
              type="button"
              onClick={() => onChange({ priceRange: 'ALL' })}
              className="text-[10px] underline text-amber-100 hover:text-white cursor-pointer"
            >
              All
            </button>
          )}
        </div>
        <ul className="divide-y divide-slate-100">
          {PRICE_TIERS.map((tier) => {
            const isActive = filters.priceRange === tier.id;
            return (
              <li key={tier.id}>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ priceRange: isActive ? 'ALL' : tier.id })
                  }
                  className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-amber-50 text-amber-950 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white inline-flex items-center justify-center shrink-0">
                      <DollarSign className="w-3 h-3" />
                    </span>
                    <span className="font-mono text-[11.5px]">{tier.label}</span>
                  </span>
                  {isActive && <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 3. Shop By Type */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="px-3.5 py-2.5 bg-amber-600 text-white text-xs font-extrabold tracking-wide flex items-center justify-between">
          <span>Shop By Type</span>
          {filters.bodyType !== 'ALL' && (
            <button
              type="button"
              onClick={() => onChange({ bodyType: 'ALL' })}
              className="text-[10px] underline text-amber-100 hover:text-white cursor-pointer"
            >
              All
            </button>
          )}
        </div>
        <ul className="divide-y divide-slate-100">
          {SIDEBAR_BODY_TYPES.map((type) => {
            const count = bodyCounts[type] || 0;
            const isActive = filters.bodyType === type;
            return (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => onChange({ bodyType: isActive ? 'ALL' : type })}
                  className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-amber-50 text-amber-950 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  <span className="flex items-center gap-2.5 text-slate-800">
                    <BodyTypeSilhouette type={type} />
                    <span>{type}</span>
                  </span>
                  <span
                    className={`font-mono text-[11px] shrink-0 ${
                      count > 0 ? 'text-slate-900 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    ({count})
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 4. Shop By Export Category & Condition */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="px-3.5 py-2.5 bg-amber-600 text-white text-xs font-extrabold tracking-wide">
          Shop By Category &amp; Grade
        </div>
        <ul className="divide-y divide-slate-100 text-xs">
          <li>
            <button
              type="button"
              onClick={() => onChange({ todaysOfferOnly: !filters.todaysOfferOnly })}
              className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer ${
                filters.todaysOfferOnly
                  ? 'bg-amber-50 text-amber-950 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Today&apos;s Featured Offers</span>
              </span>
              {filters.todaysOfferOnly && <Check className="w-3.5 h-3.5 text-amber-700" />}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() =>
                onChange({
                  listingType: filters.listingType === 'auzio_stock' ? 'ALL' : 'auzio_stock',
                  physicalStockOnly: filters.listingType !== 'auzio_stock',
                })
              }
              className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer ${
                filters.listingType === 'auzio_stock'
                  ? 'bg-amber-50 text-amber-950 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Auzio Physical Yard Stock</span>
              </span>
              {filters.listingType === 'auzio_stock' && (
                <Check className="w-3.5 h-3.5 text-amber-700" />
              )}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() =>
                onChange({
                  listingType:
                    filters.listingType === 'auction_listing' ? 'ALL' : 'auction_listing',
                  physicalStockOnly: false,
                })
              }
              className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer ${
                filters.listingType === 'auction_listing'
                  ? 'bg-amber-50 text-amber-950 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Gavel className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Auction Lots (USS / TAA)</span>
              </span>
              {filters.listingType === 'auction_listing' && (
                <Check className="w-3.5 h-3.5 text-amber-700" />
              )}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() =>
                onChange({
                  listingType:
                    filters.listingType === 'partner_stock' ? 'ALL' : 'partner_stock',
                  physicalStockOnly: false,
                })
              }
              className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer ${
                filters.listingType === 'partner_stock'
                  ? 'bg-amber-50 text-amber-950 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-600 shrink-0" />
                <span>Partner Dealer Stock</span>
              </span>
              {filters.listingType === 'partner_stock' && (
                <Check className="w-3.5 h-3.5 text-amber-700" />
              )}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onChange({ highGradeOnly: !filters.highGradeOnly })}
              className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer ${
                filters.highGradeOnly
                  ? 'bg-amber-50 text-amber-950 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Award className="w-4 h-4 text-slate-700 shrink-0" />
                <span>Auction Grade 4.5 &amp; 5</span>
              </span>
              {filters.highGradeOnly && <Check className="w-3.5 h-3.5 text-amber-700" />}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() =>
                onChange({ fuel: filters.fuel === 'Hybrid' ? 'ALL' : 'Hybrid' })
              }
              className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer ${
                filters.fuel === 'Hybrid'
                  ? 'bg-amber-50 text-amber-950 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Hybrid &amp; Fuel Savers</span>
              </span>
              {filters.fuel === 'Hybrid' && <Check className="w-3.5 h-3.5 text-amber-700" />}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onChange({ steering: filters.steering === 'RHD' ? 'ALL' : 'RHD' })}
              className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer ${
                filters.steering === 'RHD'
                  ? 'bg-amber-50 text-amber-950 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Car className="w-4 h-4 text-slate-700 shrink-0" />
                <span>Right-Hand Drive (RHD)</span>
              </span>
              {filters.steering === 'RHD' && <Check className="w-3.5 h-3.5 text-amber-700" />}
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
