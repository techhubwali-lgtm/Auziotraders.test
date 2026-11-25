import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  FileText,
  GitCompare,
  Loader2,
  Maximize2,
  MessageCircle,
  ShieldCheck,
  Ship,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  calculateCif,
  formatJpyConverted,
  formatMoney,
  GLOBAL_PORTS,
  SHIPPING_METHOD_LABELS,
} from '../data/ports';
import { EN_COPY } from '../i18n/en';
import { fetchLiveLotDetail } from '../services/auctionFeedService';
import type {
  CifBreakdown,
  CompanySettings,
  CurrencyCode,
  ShippingMethod,
  Vehicle,
} from '../types/portal';
import { AuctionSheetPanel } from './AuctionSheetPanel';
import { VehicleImage } from './VehicleImage';

interface VehicleDetailModalProps {
  vehicle: Vehicle;
  currency: CurrencyCode;
  defaultPortId: string;
  settings: CompanySettings;
  isCompared: boolean;
  canImportToFirestore?: boolean;
  onImportLiveLot?: (vehicle: Vehicle) => void;
  onToggleCompare: (vehicleId: string) => void;
  onClose: () => void;
  onOpenProforma: (params: { vehicle: Vehicle; cif: CifBreakdown }) => void;
  onOpenInquiry: (params: {
    vehicle: Vehicle;
    portId: string;
    shippingMethod: ShippingMethod;
    includeInsurance: boolean;
  }) => void;
  onStartBidRequest: (vehicle: Vehicle) => void;
}

export function VehicleDetailModal({
  vehicle,
  currency,
  defaultPortId,
  settings,
  isCompared,
  canImportToFirestore = false,
  onImportLiveLot,
  onToggleCompare,
  onClose,
  onOpenProforma,
  onOpenInquiry,
  onStartBidRequest,
}: VehicleDetailModalProps) {
  const [activeVehicle, setActiveVehicle] = useState<Vehicle>(vehicle);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [portId, setPortId] = useState(defaultPortId);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('roro');
  const [includeInsurance, setIncludeInsurance] = useState(true);

  // AJES 3-Size Image Galleries:
  // - liveGallery: MEDIUM (&w=320) for fast default display
  // - liveThumbnails: SMALL (&h=50) for compact thumbnail strip
  // - liveFullGallery: BIG (full resolution) loaded ONLY on Zoom click
  const [liveGallery, setLiveGallery] = useState<string[]>(vehicle.images);
  const [liveFullGallery, setLiveFullGallery] = useState<string[]>(
    vehicle.auctionSourceMeta?.fullImageUrls || vehicle.images
  );
  const [liveThumbnails, setLiveThumbnails] = useState<string[]>(
    vehicle.auctionSourceMeta?.thumbnailUrls || vehicle.images
  );
  const [liveAuctionSheetUrl, setLiveAuctionSheetUrl] = useState<string | undefined>(
    vehicle.auctionSourceMeta?.auctionSheetUrl
  );
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [zoomCaption, setZoomCaption] = useState('');

  // Per AJES Rule: request FULL INFO BY ID whenever user opens a live lot
  useEffect(() => {
    setActiveVehicle(vehicle);
    setPhotoIdx(0);
    setZoomImageUrl(null);
    setLiveGallery(vehicle.images);
    setLiveFullGallery(vehicle.auctionSourceMeta?.fullImageUrls || vehicle.images);
    setLiveThumbnails(vehicle.auctionSourceMeta?.thumbnailUrls || vehicle.images);
    setLiveAuctionSheetUrl(vehicle.auctionSourceMeta?.auctionSheetUrl);

    const extLotId = vehicle.auctionSourceMeta?.externalLotId;
    if (!extLotId) return;

    let active = true;
    setLoadingSheet(true);
    void fetchLiveLotDetail(extLotId, {
      table: vehicle.auctionSourceMeta?.table,
      jpyRate: settings.exchangeRates.JPY || 154,
    })
      .then((detail) => {
        if (!active || !detail.ok) return;
        if (detail.vehicle) {
          setActiveVehicle(detail.vehicle);
        }
        if (detail.images.length > 0) {
          setLiveGallery(detail.images.slice(0, 8));
        }
        if (detail.fullImages.length > 0) {
          setLiveFullGallery(detail.fullImages.slice(0, 8));
        }
        if (detail.thumbnails.length > 0) {
          setLiveThumbnails(detail.thumbnails.slice(0, 8));
        }
        if (detail.auctionSheetUrl) {
          setLiveAuctionSheetUrl(detail.auctionSheetUrl);
        }
      })
      .finally(() => {
        if (active) setLoadingSheet(false);
      });

    return () => {
      active = false;
    };
  }, [vehicle, settings.exchangeRates.JPY]);

  const cif = useMemo(
    () =>
      calculateCif({
        fobUsd: activeVehicle.fobPriceUsd,
        volumeM3: activeVehicle.volumeM3,
        portId,
        shippingMethod,
        includeInsurance,
      }),
    [activeVehicle.fobPriceUsd, activeVehicle.volumeM3, portId, shippingMethod, includeInsurance]
  );

  const fmt = (usd: number) => formatMoney(usd, currency, settings.exchangeRates);
  const listingMeta = EN_COPY.listingTypes[activeVehicle.listingType || 'auzio_stock'];
  const isSoldStat = activeVehicle.auctionSourceMeta?.table === 'stats';

  const cleanPhone = settings.whatsappPhone.replace(/[^0-9]/g, '');
  const whatsappText = encodeURIComponent(
    `Hello AUZIO TRADERS Export Desk, I am inquiring about ${activeVehicle.stockCode} (${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}) shipped CIF to ${cif.port.name}, ${cif.port.country}.`
  );
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${whatsappText}`;

  const specRows = [
    { label: 'Stock / Lot ID', value: activeVehicle.stockCode, mono: true },
    { label: 'Chassis / VIN', value: activeVehicle.chassisCode, mono: true },
    { label: 'Model Year', value: String(activeVehicle.year), mono: true },
    {
      label: 'Mileage',
      value:
        activeVehicle.mileageKm > 0
          ? `${activeVehicle.mileageKm.toLocaleString()} km`
          : 'Verified on Sheet',
      mono: true,
    },
    { label: 'Engine CC', value: `${activeVehicle.engineCc.toLocaleString()} cc`, mono: true },
    {
      label: 'Fuel / Trans',
      value: `${activeVehicle.fuelType} · ${activeVehicle.transmission}`,
    },
    {
      label: 'Drive / Steer',
      value: `${activeVehicle.drivetrain} · ${activeVehicle.steering}`,
    },
    {
      label: 'Color / Port',
      value: `${activeVehicle.exteriorColor} · ${activeVehicle.originPort}`,
    },
    { label: 'Shipping Vol', value: `${activeVehicle.volumeM3} m³`, mono: true },
    {
      label: 'Auction Grade',
      value: `Ext ${activeVehicle.auctionReport.exteriorGrade} / Int ${activeVehicle.auctionReport.interiorGrade}`,
      mono: true,
    },
  ];

  const handleOpenZoom = (url: string, caption: string) => {
    setZoomImageUrl(url);
    setZoomCaption(caption);
  };

  const currentMediumImg = liveGallery[photoIdx] || liveGallery[0] || activeVehicle.images[0];
  const currentBigImg = liveFullGallery[photoIdx] || liveFullGallery[0] || currentMediumImg;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs overflow-y-auto p-3 sm:p-6 flex items-start justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model} specifications`}
    >
      <div className="w-full max-w-[1180px] bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden my-4">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-mono text-amber-400 truncate">
              {activeVehicle.stockCode} ·{' '}
              {isSoldStat ? 'Historical Sold Result' : listingMeta.label}
              {activeVehicle.auctionDate ? ` · ${activeVehicle.auctionDate}` : ''}
              {activeVehicle.auctionSourceMeta?.auctionStatus
                ? ` · ${activeVehicle.auctionSourceMeta.auctionStatus.toUpperCase()}`
                : ''}
            </div>
            <h2 className="text-lg font-bold truncate mt-0.5">
              {activeVehicle.year} {activeVehicle.make} {activeVehicle.model} {activeVehicle.trim}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleCompare(activeVehicle.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                isCompared
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              {isCompared ? 'In Compare' : '+ Compare'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close vehicle details"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Honest Auction Listing Warning Banner */}
        {activeVehicle.listingType === 'auction_listing' && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              {isSoldStat ? (
                <>
                  <span className="font-semibold">Historical Auction Price Benchmark:</span> This
                  vehicle was offered at {activeVehicle.auctionReport.auctionHouse} (Lot #
                  {activeVehicle.auctionReport.lotNumber}, Status:{' '}
                  {activeVehicle.auctionSourceMeta?.auctionStatus || 'Completed'}). Use this real
                  sold price reference to set your Maximum Bid Ceiling on a matching upcoming unit.
                </>
              ) : (
                <>
                  <span className="font-semibold">Auction Listing — Not Yet Purchased:</span> This
                  unit is scheduled at {activeVehicle.auctionReport.auctionHouse} (Lot #
                  {activeVehicle.auctionReport.lotNumber}). Availability is subject to live auction
                  bidding outcome and prior sale. Submit a Maximum Bid Ceiling authorization for
                  AUZIO TRADERS to bid on your behalf.
                </>
              )}
            </div>
          </div>
        )}

        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 max-h-[82vh] overflow-y-auto">
          {/* Left: Gallery + Specs + Auction Inspection */}
          <div className="lg:col-span-7 space-y-6">
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100">
              <div className="relative aspect-[4/3] group">
                <VehicleImage
                  src={currentMediumImg}
                  alt={`${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`}
                />
                <button
                  type="button"
                  onClick={() =>
                    handleOpenZoom(
                      currentBigImg,
                      `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model} — Photo ${photoIdx + 1} (Full Size)`
                    )
                  }
                  className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/85 hover:bg-slate-950 text-white text-xs font-semibold rounded-lg shadow cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                  Zoom Full Size
                </button>
              </div>
              {liveGallery.length > 1 && (
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex gap-2 overflow-x-auto">
                  {liveGallery.map((img, i) => (
                    <button
                      key={`${img.slice(0, 28)}-${i}`}
                      type="button"
                      onClick={() => setPhotoIdx(i)}
                      className={`w-20 aspect-[4/3] rounded-md overflow-hidden border-2 shrink-0 cursor-pointer ${
                        photoIdx === i ? 'border-amber-600' : 'border-transparent opacity-75'
                      }`}
                    >
                      {/* Uses SMALL (&h=50) preview thumbnails per AJES image rules */}
                      <VehicleImage src={liveThumbnails[i] || img} alt={`Thumb ${i + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tech Specs Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-900">
                <span>Technical Specifications &amp; Yard Remarks</span>
                {loadingSheet && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-700">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading full lot details...
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0">
                {specRows.map((row) => (
                  <div
                    key={row.label}
                    className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 text-xs"
                  >
                    <span className="text-slate-500">{row.label}</span>
                    <span
                      className={
                        row.mono
                          ? 'font-mono font-semibold text-slate-950'
                          : 'font-medium text-slate-900'
                      }
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
              {activeVehicle.auctionSourceMeta?.inspectorRawInfo && (
                <div className="px-4 py-2.5 bg-amber-50/70 border-t border-amber-200 text-xs text-amber-950 font-mono">
                  <span className="font-semibold">Auction Info:</span>{' '}
                  {activeVehicle.auctionSourceMeta.inspectorRawInfo}
                </div>
              )}
              {activeVehicle.features.length > 0 && (
                <div className="p-4 border-t border-slate-200 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700">
                    {activeVehicle.features.map((f) => (
                      <div key={f} className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Original Japanese Auction Sheet Image (BIG resolution for legibility + Zoom) */}
            {activeVehicle.auctionSourceMeta && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold">
                    Original Auction Inspection Sheet ·{' '}
                    {activeVehicle.auctionSourceMeta.auctionHouse} (Lot #
                    {activeVehicle.auctionSourceMeta.lotNumber})
                  </span>
                  <div className="flex items-center gap-3">
                    {liveAuctionSheetUrl &&
                      liveAuctionSheetUrl.startsWith('https://8.ajes.com/imgs/') && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenZoom(
                              liveAuctionSheetUrl,
                              `Auction Inspection Sheet · ${activeVehicle.auctionSourceMeta?.auctionHouse} Lot #${activeVehicle.auctionSourceMeta?.lotNumber}`
                            )
                          }
                          className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          Zoom Sheet
                        </button>
                      )}
                    {activeVehicle.auctionSourceMeta.sourceUrl.startsWith(
                      'https://auc.auziotraders.com/'
                    ) && (
                      <a
                        href={activeVehicle.auctionSourceMeta.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-slate-300 hover:text-white font-semibold"
                      >
                        Source
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-slate-50">
                  {loadingSheet ? (
                    <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-600">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                      Fetching full lot details &amp; original auction inspection sheet...
                    </div>
                  ) : liveAuctionSheetUrl &&
                    liveAuctionSheetUrl.startsWith('https://8.ajes.com/imgs/') ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenZoom(
                            liveAuctionSheetUrl,
                            `Auction Inspection Sheet · ${activeVehicle.auctionSourceMeta?.auctionHouse} Lot #${activeVehicle.auctionSourceMeta?.lotNumber}`
                          )
                        }
                        className="w-full block cursor-zoom-in"
                      >
                        <img
                          src={liveAuctionSheetUrl}
                          alt={`Auction inspection sheet for Lot ${activeVehicle.auctionSourceMeta.lotNumber}`}
                          referrerPolicy="no-referrer"
                          className="w-full max-h-[460px] object-contain bg-white border border-slate-200 rounded-lg"
                        />
                      </button>
                      <p className="text-[11px] text-slate-500">
                        Click the sheet to zoom full-size. Need an English line-by-line translation
                        of inspector remarks? Submit a Bid / Sourcing Request and our Yokohama team
                        will translate this sheet prior to bidding.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600">
                      Original scan pending auction house release. Our Yokohama buyers inspect the
                      physical sheet at the lane before placing any authorized bid.
                    </p>
                  )}
                </div>
              </div>
            )}

            <AuctionSheetPanel
              report={activeVehicle.auctionReport}
              stockCode={activeVehicle.stockCode}
              chassisCode={activeVehicle.chassisCode}
            />
          </div>

          {/* Right: Integrated CIF Calculator + Actions */}
          <div className="lg:col-span-5 space-y-4">
            <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/50">
              <div className="flex items-baseline justify-between pb-3 border-b border-slate-200">
                <div>
                  <div className="text-xs text-slate-500">
                    {isSoldStat
                      ? 'Reference Export FOB (Sold Benchmark)'
                      : activeVehicle.listingType === 'auction_listing'
                        ? 'Estimated Auction FOB'
                        : `FOB ${activeVehicle.originPort}, Japan`}
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-950">
                    {fmt(activeVehicle.fobPriceUsd)}
                  </div>
                  {activeVehicle.auctionSourceMeta && (
                    <div className="text-[11px] font-mono text-amber-800 mt-1 space-y-0.5">
                      {activeVehicle.auctionSourceMeta.rawFinishPriceJpy > 0 && (
                        <div>
                          Hammer / Sold:{' '}
                          {formatJpyConverted(
                            activeVehicle.auctionSourceMeta.rawFinishPriceJpy,
                            currency,
                            settings.exchangeRates
                          )}
                          {currency !== 'JPY' && (
                            <span className="text-slate-500 ml-1">
                              (¥{activeVehicle.auctionSourceMeta.rawFinishPriceJpy.toLocaleString()} JPY)
                            </span>
                          )}
                        </div>
                      )}
                      {activeVehicle.auctionSourceMeta.rawAvgPriceJpy > 0 && (
                        <div>
                          Recent Avg:{' '}
                          {formatJpyConverted(
                            activeVehicle.auctionSourceMeta.rawAvgPriceJpy,
                            currency,
                            settings.exchangeRates
                          )}
                          {currency !== 'JPY' && (
                            <span className="text-slate-500 ml-1">
                              (¥{activeVehicle.auctionSourceMeta.rawAvgPriceJpy.toLocaleString()} JPY)
                            </span>
                          )}
                        </div>
                      )}
                      {activeVehicle.auctionSourceMeta.rawStartPriceJpy > 0 && (
                        <div>
                          Start Bid:{' '}
                          {formatJpyConverted(
                            activeVehicle.auctionSourceMeta.rawStartPriceJpy,
                            currency,
                            settings.exchangeRates
                          )}
                          {currency !== 'JPY' && (
                            <span className="text-slate-500 ml-1">
                              (¥{activeVehicle.auctionSourceMeta.rawStartPriceJpy.toLocaleString()} JPY)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right text-xs text-slate-600">
                  <div>{isSoldStat ? 'Sold Stats' : listingMeta.shortLabel}</div>
                  <div className="font-mono text-[11px] text-slate-500">
                    {activeVehicle.volumeM3} m³
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <Ship className="w-4 h-4 text-amber-700" />
                  <span>CIF Landed Cost Calculator</span>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Destination Country &amp; Discharge Port
                  </label>
                  <select
                    value={portId}
                    onChange={(e) => setPortId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    {GLOBAL_PORTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.country} — {p.name} ({p.transitDaysMin}–{p.transitDaysMax}d)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Freight Method
                  </label>
                  <select
                    value={shippingMethod}
                    onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    {(Object.keys(SHIPPING_METHOD_LABELS) as ShippingMethod[]).map((m) => (
                      <option key={m} value={m}>
                        {SHIPPING_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer">
                  <span className="flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeInsurance}
                      onChange={(e) => setIncludeInsurance(e.target.checked)}
                      className="accent-amber-600"
                    />
                    Marine Transit Insurance (1.5%)
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {includeInsurance ? fmt(cif.insuranceUsd) : 'Off'}
                  </span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>FOB Vehicle</span>
                  <span className="font-mono tabular-nums text-slate-900">{fmt(cif.fobUsd)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Sea Freight</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {fmt(cif.freightUsd)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="truncate pr-2">{cif.inspectionLabel}</span>
                  <span className="font-mono tabular-nums text-slate-900 shrink-0">
                    {fmt(cif.inspectionUsd)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Marine Insurance</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {includeInsurance ? fmt(cif.insuranceUsd) : 'Declined'}
                  </span>
                </div>
                <div className="pt-2.5 border-t border-slate-300 flex items-baseline justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-950">
                      Est. Total {includeInsurance ? 'CIF' : 'C&F'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Transit {cif.transitDaysRange}
                    </div>
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-950">
                    {fmt(cif.totalCifUsd)}
                  </div>
                </div>
              </div>

              {/* Action CTAs */}
              <div className="space-y-2 pt-1">
                {activeVehicle.listingType === 'auction_listing' ? (
                  <button
                    type="button"
                    onClick={() => onStartBidRequest(activeVehicle)}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 cursor-pointer"
                  >
                    {isSoldStat
                      ? 'Source Similar Unit at Upcoming Auction'
                      : 'Authorize Auction Bid / Sourcing Request'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenProforma({ vehicle: activeVehicle, cif })}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    Generate Official Proforma Invoice (P/I)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    onOpenInquiry({
                      vehicle: activeVehicle,
                      portId,
                      shippingMethod,
                      includeInsurance,
                    })
                  }
                  className="w-full py-2.5 px-4 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Open Inquiry Desk / 48h Hold Request
                </button>

                {canImportToFirestore && activeVehicle.auctionSourceMeta && onImportLiveLot && (
                  <button
                    type="button"
                    onClick={() =>
                      onImportLiveLot({
                        ...activeVehicle,
                        images: liveGallery.length > 0 ? liveGallery : activeVehicle.images,
                        auctionSourceMeta: {
                          ...activeVehicle.auctionSourceMeta!,
                          auctionSheetUrl: liveAuctionSheetUrl,
                        },
                      })
                    }
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-400" />
                    Staff Action: Import Lot to Firestore Inventory
                  </button>
                )}

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-700" />
                  WhatsApp Yokohama Export Desk
                </a>
              </div>

              <div className="pt-2 flex items-start gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  Payments settle exclusively via Bank TT to {settings.bankName} (
                  {settings.swiftCode}).
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Size (BIG) Zoom Lightbox — loads unresized AJES image only when user clicks Zoom */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setZoomImageUrl(null)}
        >
          <div
            className="max-w-5xl w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white text-xs px-1">
              <span className="font-mono text-amber-300 truncate pr-4">{zoomCaption}</span>
              <button
                type="button"
                onClick={() => setZoomImageUrl(null)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-semibold cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
                Close Zoom
              </button>
            </div>
            <img
              src={zoomImageUrl}
              alt={zoomCaption}
              referrerPolicy="no-referrer"
              className="max-h-[82vh] max-w-full object-contain rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
