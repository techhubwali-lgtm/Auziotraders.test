import {
  AlertCircle,
  Download,
  ExternalLink,
  Gavel,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatJpyConverted, formatMoney } from '../data/ports';
import {
  fetchAuctionMeta,
  fetchLiveLotDetail,
  searchLiveAuctions,
} from '../services/auctionFeedService';
import type {
  AuctionFeedTable,
  CompanySettings,
  CurrencyCode,
  LiveAuctionMetaResponse,
  Vehicle,
} from '../types/portal';
import { VehicleImage } from './VehicleImage';

interface StaffAuctionImportPanelProps {
  currency: CurrencyCode;
  settings: CompanySettings;
  onImportLot: (lotVehicle: Vehicle) => void;
}

export function StaffAuctionImportPanel({
  currency,
  settings,
  onImportLot,
}: StaffAuctionImportPanelProps) {
  const [meta, setMeta] = useState<LiveAuctionMetaResponse | null>(null);
  const [table, setTable] = useState<AuctionFeedTable>('main');
  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('ALL');
  const [yearMin, setYearMin] = useState('2018');
  const [lotQuery, setLotQuery] = useState('');
  const [chassisQuery, setChassisQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [results, setResults] = useState<Vehicle[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [syncedAt, setSyncedAt] = useState('');

  const fmt = (usd: number) => formatMoney(usd, currency, settings.exchangeRates);

  useEffect(() => {
    let active = true;
    void fetchAuctionMeta().then((data) => {
      if (active) setMeta(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const runSearch = async (e?: React.FormEvent, overrideTable?: AuctionFeedTable) => {
    if (e) e.preventDefault();
    const activeTable = overrideTable || table;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await searchLiveAuctions({
        table: activeTable,
        make,
        model: model === 'ALL' ? undefined : model,
        yearMin: yearMin || undefined,
        lot: lotQuery.trim() || undefined,
        chassis: chassisQuery.trim() || undefined,
        page: 1,
        jpyRate: settings.exchangeRates.JPY || 154,
      });
      if (!res.ok) {
        setErrorMsg(res.message || 'Unable to query auction feed right now.');
        setResults([]);
        setTotalMatches(0);
      } else {
        setResults(res.items);
        setTotalMatches(res.totalMatches);
        setSyncedAt(res.syncedAt);
        if (res.items.length === 0 && res.message) {
          setErrorMsg(res.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrepareImport = async (lot: Vehicle) => {
    setEnrichingId(lot.id);
    try {
      let enriched = lot;
      if (lot.auctionSourceMeta?.externalLotId) {
        // Per AJES Rule: request full lot details by ID before importing into Firestore
        const detail = await fetchLiveLotDetail(lot.auctionSourceMeta.externalLotId, {
          table: lot.auctionSourceMeta.table || table,
          jpyRate: settings.exchangeRates.JPY || 154,
        });
        if (detail.ok) {
          if (detail.vehicle) {
            enriched = detail.vehicle;
          } else if (detail.images.length > 0) {
            const mergedImages = Array.from(new Set([...detail.images, ...lot.images])).slice(0, 6);
            enriched = {
              ...lot,
              images: mergedImages,
              auctionSourceMeta: {
                ...lot.auctionSourceMeta,
                auctionSheetUrl: detail.auctionSheetUrl || lot.auctionSourceMeta.auctionSheetUrl,
              },
            };
          }
        }
      }
      onImportLot(enriched);
    } finally {
      setEnrichingId(null);
    }
  };

  const modelsForSelectedMake =
    make !== 'ALL' && meta?.modelsByMake?.[make] ? meta.modelsByMake[make] : [];

  return (
    <div className="bg-white border border-amber-300 rounded-xl overflow-hidden shadow-xs">
      <div className="px-5 py-4 bg-slate-950 text-white flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Gavel className="w-3.5 h-3.5" />
            {meta?.mode === 'ajes_api'
              ? 'Official AJES SQL Feed · Live Import Bridge'
              : 'Live Auction Import Bridge · auc.auziotraders.com'}
          </div>
          <h3 className="text-sm font-bold mt-0.5">
            Search On-Demand &amp; Import Selected Auction Lots into Firestore Inventory
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setTable('main');
                void runSearch(undefined, 'main');
              }}
              className={`px-2.5 py-1 font-semibold rounded-md cursor-pointer ${
                table === 'main' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Live Auctions
            </button>
            <button
              type="button"
              onClick={() => {
                setTable('stats');
                void runSearch(undefined, 'stats');
              }}
              className={`px-2.5 py-1 font-semibold rounded-md cursor-pointer ${
                table === 'stats' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Sold Stats
            </button>
          </div>
          <div className="text-right text-[11px] font-mono text-slate-300">
            {meta?.ok ? (
              <span>
                {meta.totalEstimatedLots.toLocaleString()} active lots · {meta.makes.length} makes
              </span>
            ) : (
              <span>Connecting to auction feed...</span>
            )}
          </div>
        </div>
      </div>

      {/* Staff Search Bar */}
      <form
        onSubmit={(e) => void runSearch(e)}
        className="p-4 bg-amber-50/60 border-b border-amber-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end"
      >
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Make</label>
          <select
            value={make}
            onChange={(e) => {
              setMake(e.target.value);
              setModel('ALL');
            }}
            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
          >
            <option value="ALL">All Makes</option>
            {(meta?.makes || []).slice(0, 40).map((m) => (
              <option key={m.id} value={m.name}>
                {m.name} ({m.totalLots.toLocaleString()})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
          >
            <option value="ALL">Any Model</option>
            {modelsForSelectedMake.slice(0, 80).map((mod) => (
              <option key={mod.name} value={mod.name}>
                {mod.name} ({mod.count})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Min Year</label>
          <input
            type="number"
            min={1985}
            max={2027}
            value={yearMin}
            onChange={(e) => setYearMin(e.target.value)}
            placeholder="2018"
            className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Lot #</label>
          <input
            type="text"
            value={lotQuery}
            onChange={(e) => setLotQuery(e.target.value)}
            placeholder="e.g. 2095"
            className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Chassis ID</label>
          <input
            type="text"
            value={chassisQuery}
            onChange={(e) => setChassisQuery(e.target.value)}
            placeholder="e.g. GDJ150W"
            className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-slate-950 hover:bg-slate-800 rounded-lg disabled:opacity-60 cursor-pointer h-[32px]"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
          Query {table === 'stats' ? 'Sold Stats' : 'Live Feed'}
        </button>
      </form>

      {/* Results Area */}
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span className="font-mono">
            Showing <strong className="text-slate-950">{results.length}</strong> of{' '}
            <strong className="text-slate-950">{totalMatches.toLocaleString()}</strong>{' '}
            {table === 'stats' ? 'sold stats records' : 'live lots'}
            {syncedAt ? ` · Synced ${new Date(syncedAt).toLocaleTimeString()}` : ''}
          </span>
          <button
            type="button"
            onClick={() => void runSearch()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-950 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 rounded-lg border border-slate-200 bg-slate-50 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
            {results.slice(0, 12).map((lot) => {
              const rawJpy =
                lot.auctionSourceMeta?.table === 'stats'
                  ? lot.auctionSourceMeta.rawFinishPriceJpy || lot.auctionSourceMeta.rawAvgPriceJpy
                  : lot.auctionSourceMeta?.rawAvgPriceJpy ||
                    lot.auctionSourceMeta?.rawStartPriceJpy ||
                    0;
              return (
                <div
                  key={lot.id}
                  className="border border-slate-200 rounded-lg p-3 flex gap-3 hover:border-amber-500 transition-colors bg-white"
                >
                  <div className="w-24 h-20 rounded-md overflow-hidden bg-slate-100 shrink-0">
                    <VehicleImage
                      src={lot.images[0]}
                      alt={`${lot.year} ${lot.make} ${lot.model}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-between space-y-1.5">
                    <div>
                      <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-amber-800">
                        <span className="truncate font-semibold">
                          Lot #{lot.auctionReport.lotNumber} · {lot.auctionReport.auctionHouse}
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-900 rounded font-bold shrink-0">
                          Gr {lot.auctionReport.exteriorGrade}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-950 truncate mt-0.5">
                        {lot.year} {lot.make} {lot.model}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">
                        {lot.chassisCode} ·{' '}
                        {lot.mileageKm > 0 ? `${lot.mileageKm.toLocaleString()}km · ` : ''}
                        {lot.engineCc}cc · {lot.steering}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <div className="text-[11px] font-mono">
                        <div className="font-bold text-slate-950">{fmt(lot.fobPriceUsd)} FOB</div>
                        {rawJpy > 0 && (
                          <div className="text-[10px] text-slate-500">
                            Auction: {formatJpyConverted(rawJpy, currency, settings.exchangeRates)}
                            {currency !== 'JPY' ? ` (¥${rawJpy.toLocaleString()})` : ''}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {lot.auctionSourceMeta?.sourceUrl?.startsWith(
                          'https://auc.auziotraders.com/'
                        ) && (
                          <a
                            href={lot.auctionSourceMeta.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open on auc.auziotraders.com"
                            className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 rounded"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={enrichingId === lot.id}
                          onClick={() => void handlePrepareImport(lot)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded disabled:opacity-60 cursor-pointer"
                        >
                          {enrichingId === lot.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          Import
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
