import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  FileText,
  Gavel,
  Loader2,
  Lock,
  MessageSquare,
  Package,
  Radio,
  Send,
  ShieldCheck,
  Ship,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { VesselLeafletMap } from '../components/VesselLeafletMap';
import {
  ALL_CURRENCIES,
  calculateCif,
  formatMoney,
  getPortById,
  GLOBAL_PORTS,
  TRADE_MILESTONE_META,
  TRADE_MILESTONE_ORDER,
} from '../data/ports';
import { EN_COPY } from '../i18n/en';
import { getVesselFreshness } from '../services/vesselTrackingService';
import type {
  CifBreakdown,
  CompanySettings,
  CurrencyCode,
  ExportDocument,
  ExportOrder,
  OrderMessage,
  Quotation,
  RegisteredVessel,
  SourcingRequest,
  UserProfile,
  Vehicle,
} from '../types/portal';

export type CustomerPortalTab =
  | 'profile'
  | 'sourcing'
  | 'quotations'
  | 'orders'
  | 'documents';

interface CustomerPortalViewProps {
  activeTab: CustomerPortalTab;
  onTabChange: (tab: CustomerPortalTab) => void;
  profile: UserProfile | null;
  currency: CurrencyCode;
  settings: CompanySettings;
  vehicles: Vehicle[];
  sourcingRequests: SourcingRequest[];
  quotations: Quotation[];
  orders: ExportOrder[];
  vessels?: RegisteredVessel[];
  messages: OrderMessage[];
  documents: ExportDocument[];
  prefillVehicle: Vehicle | null;
  isLiveFirestoreMode: boolean;
  onClearPrefillVehicle: () => void;
  onSaveProfile: (updates: {
    displayName: string;
    companyName: string;
    country: string;
    defaultPortId: string;
    phone: string;
    consigneeAddress: string;
  }) => Promise<void>;
  onCreateSourcingRequest: (input: {
    make: string;
    model: string;
    yearMin: number;
    yearMax: number;
    mileageMaxKm: number;
    gradePref: string;
    engineCc: string;
    transmission: string;
    fuelType: string;
    colorPref: string;
    quantity: number;
    maxBudgetUsd: number;
    budgetCurrency: CurrencyCode;
    destinationCountry: string;
    destinationPortId: string;
    sourcingChannel: 'auction' | 'stock' | 'either';
    referenceLinks: string;
    notes: string;
    maxBidAcknowledged: boolean;
  }) => Promise<string>;
  onRespondQuotation: (params: {
    quotation: Quotation;
    decision: 'approved' | 'declined';
    declineReason?: string;
  }) => Promise<void>;
  onSendOrderMessage: (orderId: string, body: string) => Promise<void>;
  onOpenProforma: (params: {
    vehicle: Vehicle;
    cif: CifBreakdown;
    trackingCode?: string;
    currency?: CurrencyCode;
    lockedExchangeRate?: number;
    lockedRateDate?: string;
    isRateLocked?: boolean;
  }) => void;
  onOpenVesselTracking?: () => void;
  onOpenCustomerLogin: () => void;
}

export function CustomerPortalView({
  activeTab,
  onTabChange,
  profile,
  currency,
  settings,
  vehicles,
  sourcingRequests,
  quotations,
  orders,
  vessels = [],
  messages,
  documents,
  prefillVehicle,
  isLiveFirestoreMode,
  onClearPrefillVehicle,
  onSaveProfile,
  onCreateSourcingRequest,
  onRespondQuotation,
  onSendOrderMessage,
  onOpenProforma,
  onOpenVesselTracking,
  onOpenCustomerLogin,
}: CustomerPortalViewProps) {
  const fmt = (usd: number) => formatMoney(usd, currency, settings.exchangeRates);

  // Profile form state
  const [pName, setPName] = useState(profile?.displayName || '');
  const [pCompany, setPCompany] = useState(profile?.companyName || '');
  const [pPortId, setPPortId] = useState(profile?.defaultPortId || 'mombasa-ke');
  const [pCountry, setPCountry] = useState(profile?.country || 'Kenya');
  const [pPhone, setPPhone] = useState(profile?.phone || '');
  const [pAddress, setPAddress] = useState(profile?.consigneeAddress || '');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setPName(profile.displayName);
    setPCompany(profile.companyName);
    setPPortId(profile.defaultPortId || 'mombasa-ke');
    setPCountry(profile.country || 'Kenya');
    setPPhone(profile.phone || '');
    setPAddress(profile.consigneeAddress || '');
  }, [profile]);

  // Sourcing Wizard state
  const [srMake, setSrMake] = useState('Toyota');
  const [srModel, setSrModel] = useState('');
  const [srYearMin, setSrYearMin] = useState(2020);
  const [srYearMax, setSrYearMax] = useState(2024);
  const [srMileageMax, setSrMileageMax] = useState(50000);
  const [srGrade, setSrGrade] = useState('4.5 or higher');
  const [srEngineCc, setSrEngineCc] = useState('2000 cc');
  const [srTrans, setSrTrans] = useState('Automatic');
  const [srFuel, setSrFuel] = useState('Hybrid');
  const [srColor, setSrColor] = useState('Pearl White / Silver');
  const [srQty, setSrQty] = useState(1);
  const [srMaxBudgetUsd, setSrMaxBudgetUsd] = useState(22000);
  const [srBudgetCurrency, setSrBudgetCurrency] = useState<CurrencyCode>(currency);
  const [srPortId, setSrPortId] = useState(profile?.defaultPortId || 'mombasa-ke');
  const [srChannel, setSrChannel] = useState<'auction' | 'stock' | 'either'>('auction');
  const [srRefLinks, setSrRefLinks] = useState('');
  const [srNotes, setSrNotes] = useState('');
  const [srMaxBidAck, setSrMaxBidAck] = useState(false);
  const [submittingSr, setSubmittingSr] = useState(false);
  const [srError, setSrError] = useState('');

  // Pre-fill Sourcing Wizard when clicking "Bid / Quote" on an auction vehicle
  useEffect(() => {
    if (!prefillVehicle) return;
    setSrMake(prefillVehicle.make);
    setSrModel(`${prefillVehicle.model} ${prefillVehicle.trim}`.trim());
    setSrYearMin(prefillVehicle.year);
    setSrYearMax(prefillVehicle.year);
    setSrMileageMax(Math.max(40000, prefillVehicle.mileageKm + 10000));
    setSrGrade(`${prefillVehicle.auctionReport.exteriorGrade} or higher`);
    setSrEngineCc(`${prefillVehicle.engineCc} cc`);
    setSrTrans(prefillVehicle.transmission);
    setSrFuel(prefillVehicle.fuelType);
    setSrColor(prefillVehicle.exteriorColor);
    setSrMaxBudgetUsd(Math.round(prefillVehicle.fobPriceUsd * 1.05));
    setSrChannel(prefillVehicle.listingType === 'auction_listing' ? 'auction' : 'stock');
    const sourceRef = prefillVehicle.auctionSourceMeta?.sourceUrl
      ? ` · ${prefillVehicle.auctionSourceMeta.sourceUrl}`
      : '';
    setSrRefLinks(
      `Stock Ref: ${prefillVehicle.stockCode} (${prefillVehicle.auctionReport.auctionHouse} Lot #${prefillVehicle.auctionReport.lotNumber})${sourceRef}`
    );
    const rawJpy =
      prefillVehicle.auctionSourceMeta?.rawAvgPriceJpy ||
      prefillVehicle.auctionSourceMeta?.rawStartPriceJpy ||
      0;
    const jpyNote = rawJpy > 0 ? ` Feed reference: ¥${rawJpy.toLocaleString()} JPY.` : '';
    setSrNotes(
      `Requesting official auction bidding quotation & sheet translation for ${prefillVehicle.stockCode} (${prefillVehicle.year} ${prefillVehicle.make} ${prefillVehicle.model}, Chassis ${prefillVehicle.chassisCode}).${jpyNote}`
    );
    onTabChange('sourcing');
  }, [prefillVehicle, onTabChange]);

  // Quotation approval/decline state
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [busyQuoteId, setBusyQuoteId] = useState<string | null>(null);

  // Order messaging state
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    if (orders.length > 0 && !orders.some((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  // Strict customer data isolation on top of Firestore rules
  const myRequests = useMemo(
    () => (profile ? sourcingRequests.filter((r) => r.customerId === profile.uid) : []),
    [sourcingRequests, profile]
  );
  const myQuotations = useMemo(
    () => (profile ? quotations.filter((q) => q.customerId === profile.uid) : []),
    [quotations, profile]
  );
  const myOrders = useMemo(
    () => (profile ? orders.filter((o) => o.customerId === profile.uid) : []),
    [orders, profile]
  );
  const myVisibleDocs = useMemo(
    () =>
      profile
        ? documents.filter((d) => d.customerId === profile.uid && d.isCustomerVisible === true)
        : [],
    [documents, profile]
  );

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="w-12 h-12 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-950">Customer / Dealer Portal Restricted</h1>
        <p className="text-sm text-slate-600">
          Sign in with your verified overseas dealer account to manage sourcing requests, authorize
          maximum auction bid ceilings, monitor 14-stage orders, and download verified export
          documents.
        </p>
        <button
          type="button"
          onClick={onOpenCustomerLogin}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 cursor-pointer"
        >
          <Building2 className="w-4 h-4" />
          Open Customer / Dealer Login
        </button>
      </div>
    );
  }

  const pendingQuoteCount = myQuotations.filter((q) => q.status === 'sent').length;

  const tabs: { id: CustomerPortalTab; label: string; count?: number }[] = [
    { id: 'profile', label: 'Profile & Rep' },
    { id: 'sourcing', label: 'Sourcing Wizard', count: myRequests.length },
    { id: 'quotations', label: 'Quotations & Bids', count: pendingQuoteCount || myQuotations.length },
    { id: 'orders', label: 'Orders & Tracking', count: myOrders.length },
    { id: 'documents', label: 'Document Vault', count: myVisibleDocs.length },
  ];

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await onSaveProfile({
        displayName: pName,
        companyName: pCompany,
        country: pCountry,
        defaultPortId: pPortId,
        phone: pPhone,
        consigneeAddress: pAddress,
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSourcingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSrError('');
    if (!srMake.trim() || !srModel.trim()) {
      setSrError('Please specify both target Make and Model.');
      return;
    }
    if (!srMaxBidAck) {
      setSrError(
        'You must accept the Maximum Bid Ceiling authorization clause before submitting a sourcing request.'
      );
      return;
    }
    const targetPort = getPortById(srPortId);
    setSubmittingSr(true);
    try {
      await onCreateSourcingRequest({
        make: srMake,
        model: srModel,
        yearMin: Number(srYearMin),
        yearMax: Number(srYearMax),
        mileageMaxKm: Number(srMileageMax),
        gradePref: srGrade,
        engineCc: srEngineCc,
        transmission: srTrans,
        fuelType: srFuel,
        colorPref: srColor,
        quantity: Number(srQty),
        maxBudgetUsd: Number(srMaxBudgetUsd),
        budgetCurrency: srBudgetCurrency,
        destinationCountry: targetPort.country,
        destinationPortId: targetPort.id,
        sourcingChannel: srChannel,
        referenceLinks: srRefLinks,
        notes: srNotes,
        maxBidAcknowledged: true,
      });
      setSrModel('');
      setSrRefLinks('');
      setSrNotes('');
      setSrMaxBidAck(false);
      onClearPrefillVehicle();
    } catch (err) {
      setSrError(err instanceof Error ? err.message : 'Unable to submit sourcing request.');
    } finally {
      setSubmittingSr(false);
    }
  };

  const activeOrder = myOrders.find((o) => o.id === selectedOrderId) || myOrders[0] || null;
  const activeOrderVessel = useMemo(() => {
    if (!activeOrder || vessels.length === 0) return null;
    if (activeOrder.vesselId) {
      const byId = vessels.find((v) => v.id === activeOrder.vesselId);
      if (byId) return byId;
    }
    if (activeOrder.vesselMmsi) {
      const byMmsi = vessels.find((v) => v.mmsi === activeOrder.vesselMmsi);
      if (byMmsi) return byMmsi;
    }
    if (activeOrder.vesselName) {
      const needle = activeOrder.vesselName.trim().toLowerCase();
      return vessels.find((v) => v.name.trim().toLowerCase() === needle) || null;
    }
    return null;
  }, [activeOrder, vessels]);

  const activeOrderMessages = useMemo(
    () =>
      activeOrder
        ? messages.filter(
            (m) =>
              m.orderId === activeOrder.id &&
              m.customerId === profile.uid &&
              m.isInternalStaffOnly === false
          )
        : [],
    [messages, activeOrder, profile.uid]
  );

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !messageDraft.trim()) return;
    setSendingMsg(true);
    try {
      await onSendOrderMessage(activeOrder.id, messageDraft.trim());
      setMessageDraft('');
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Dealer Workspace Header */}
      <div className="bg-slate-950 text-white rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <span>DEALER TRADE PORTAL</span>
            <span className="text-slate-600">|</span>
            <span>{isLiveFirestoreMode ? 'LIVE CLOUD SYNC' : 'DEMO ROLE PREVIEW'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {profile.companyName || profile.displayName}
          </h1>
          <p className="text-xs text-slate-300">
            Account Holder: {profile.displayName} ({profile.email}) · Default Port:{' '}
            {getPortById(profile.defaultPortId).name}, {profile.country}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 ${
              profile.verified
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {profile.verified ? 'Verified Importer Account' : 'Pending KYC Verification'}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
            Rep: <span className="font-semibold text-white">{profile.assignedRepName || 'Kenji Takahashi'}</span>
          </div>
        </div>
      </div>

      {/* Portal Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'border-amber-600 text-slate-950'
                  : 'border-transparent text-slate-600 hover:text-slate-950'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`px-1.5 py-0.5 text-[11px] font-mono rounded ${
                    isActive ? 'bg-amber-100 text-amber-950' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PROFILE & REP */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleProfileSave}
            className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-950">
                Dealership &amp; Consignee Billing Profile
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Used automatically on your official AUZIO TRADERS Proforma Invoices and Bill of
                Lading instructions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contact Full Name
                </label>
                <input
                  type="text"
                  required
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Dealership / Importer Name
                </label>
                <input
                  type="text"
                  required
                  value={pCompany}
                  onChange={(e) => setPCompany(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Default Discharge Port
                </label>
                <select
                  value={pPortId}
                  onChange={(e) => {
                    setPPortId(e.target.value);
                    setPCountry(getPortById(e.target.value).country);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  {GLOBAL_PORTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.country} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  WhatsApp / Direct Phone
                </label>
                <input
                  type="tel"
                  required
                  value={pPhone}
                  onChange={(e) => setPPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Consignee / DHL Document Delivery Address
              </label>
              <input
                type="text"
                required
                value={pAddress}
                onChange={(e) => setPAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg disabled:opacity-60 cursor-pointer"
              >
                {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Dealership Profile
              </button>
            </div>
          </form>

          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                <UserCheck className="w-4 h-4" />
                <span>Assigned Yokohama Representative</span>
              </div>
              <div className="text-lg font-bold text-slate-950">
                {profile.assignedRepName || 'Kenji Takahashi'}
              </div>
              <div className="text-xs font-mono text-slate-600">
                {profile.assignedRepEmail || 'k.takahashi@auziotraders.com'}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dedicated Japan export coordinator for USS/TAA auction sheet translations, maximum
                bid authorization, and Ro-Ro space allocation.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2 text-xs text-slate-600">
              <div className="font-semibold text-slate-950">Data Isolation Guarantee</div>
              <p className="leading-relaxed">
                Your quotations, authorized maximum bids, order messages, and export documents are
                strictly isolated to UID{' '}
                <span className="font-mono text-slate-900">{profile.uid}</span> in Firestore
                security rules.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GUIDED SOURCING REQUEST WIZARD */}
      {activeTab === 'sourcing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSourcingSubmit}
            className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-amber-600" />
                  Guided Vehicle Sourcing &amp; Auction Bid Request
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Specify your target vehicle criteria and maximum budget ceiling. Our Yokohama
                  buyers will shortlist verified USS/TAA/CAA auction lots with translated sheets.
                </p>
              </div>
              {prefillVehicle && (
                <button
                  type="button"
                  onClick={onClearPrefillVehicle}
                  className="text-[11px] font-semibold text-amber-800 hover:underline cursor-pointer shrink-0"
                >
                  Clear Pre-fill
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Make *</label>
                <input
                  type="text"
                  required
                  value={srMake}
                  onChange={(e) => setSrMake(e.target.value)}
                  placeholder="Toyota, Honda, Lexus..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Model &amp; Grade *
                </label>
                <input
                  type="text"
                  required
                  value={srModel}
                  onChange={(e) => setSrModel(e.target.value)}
                  placeholder="Land Cruiser Prado TX-L"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Year Range (Min – Max)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1990}
                    max={2027}
                    value={srYearMin}
                    onChange={(e) => setSrYearMin(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                  <input
                    type="number"
                    min={1990}
                    max={2027}
                    value={srYearMax}
                    onChange={(e) => setSrYearMax(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Max Mileage (km)
                </label>
                <input
                  type="number"
                  min={5000}
                  step={5000}
                  value={srMileageMax}
                  onChange={(e) => setSrMileageMax(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Auction Grade Preference
                </label>
                <select
                  value={srGrade}
                  onChange={(e) => setSrGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="5 / S">Grade 5 / S (Near New)</option>
                  <option value="4.5 or higher">Grade 4.5 or higher</option>
                  <option value="4 or higher">Grade 4 or higher</option>
                  <option value="3.5 or higher">Grade 3.5 or higher</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Engine CC</label>
                <input
                  type="text"
                  value={srEngineCc}
                  onChange={(e) => setSrEngineCc(e.target.value)}
                  placeholder="2000 cc / 2800 cc"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Transmission / Fuel
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={srTrans}
                    onChange={(e) => setSrTrans(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="Automatic">Automatic</option>
                    <option value="CVT">CVT</option>
                    <option value="Manual">Manual</option>
                  </select>
                  <select
                    value={srFuel}
                    onChange={(e) => setSrFuel(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="Hybrid">Hybrid</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Petrol">Petrol</option>
                    <option value="Electric">Electric</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Color &amp; Quantity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={srColor}
                    onChange={(e) => setSrColor(e.target.value)}
                    className="col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={srQty}
                    onChange={(e) => setSrQty(Number(e.target.value))}
                    className="px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Maximum Budget Ceiling (USD Equiv.) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    required
                    min={1000}
                    step={500}
                    value={srMaxBudgetUsd}
                    onChange={(e) => setSrMaxBudgetUsd(Number(e.target.value))}
                    className="col-span-2 px-3 py-2 text-sm font-mono font-semibold border border-slate-300 rounded-lg"
                  />
                  <select
                    value={srBudgetCurrency}
                    onChange={(e) => setSrBudgetCurrency(e.target.value as CurrencyCode)}
                    className="px-2 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  >
                    {ALL_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Destination Country &amp; Discharge Port *
                </label>
                <select
                  value={srPortId}
                  onChange={(e) => setSrPortId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                >
                  {GLOBAL_PORTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.country} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred Sourcing Channel
                </label>
                <select
                  value={srChannel}
                  onChange={(e) =>
                    setSrChannel(e.target.value as 'auction' | 'stock' | 'either')
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                >
                  <option value="auction">Japanese Auto Auctions (USS / TAA / CAA)</option>
                  <option value="stock">AUZIO / Partner Physical Stock Only</option>
                  <option value="either">Either Auction or Verified Stock</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reference Links / Lot Numbers (Optional)
                </label>
                <input
                  type="text"
                  value={srRefLinks}
                  onChange={(e) => setSrRefLinks(e.target.value)}
                  placeholder="Stock ID or auction sheet link..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Additional Requirements / Compliance Notes
              </label>
              <textarea
                rows={2}
                value={srNotes}
                onChange={(e) => setSrNotes(e.target.value)}
                placeholder="Country age-limit rules (e.g. KEBS 8-year rule), required equipment, preferred sailing date..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            {/* Mandatory Maximum Bid Ceiling Legal Acknowledgment */}
            <label className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={srMaxBidAck}
                onChange={(e) => setSrMaxBidAck(e.target.checked)}
                className="mt-0.5 accent-amber-600 shrink-0"
              />
              <span className="text-xs text-amber-950 leading-relaxed">
                <strong className="font-semibold">Maximum Bid Ceiling Authorization (Required):</strong>{' '}
                {EN_COPY.legal.maxBidClause}
              </span>
            </label>

            {srError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                {srError}
              </div>
            )}

            <button
              type="submit"
              disabled={submittingSr}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-60 cursor-pointer"
            >
              {submittingSr && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Sourcing Request to Yokohama Desk
            </button>
          </form>

          {/* Customer's Own Sourcing Requests & Staff Shortlisted Options */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-500" />
              Your Submitted Requests ({myRequests.length})
            </h3>
            {myRequests.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
                No sourcing requests submitted yet. Use the wizard to request a specific Japanese
                auction or yard unit.
              </div>
            ) : (
              myRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-[11px] text-amber-700 font-semibold">
                        {req.requestCode} · {req.sourcingChannel.toUpperCase()}
                      </div>
                      <div className="text-sm font-bold text-slate-950">
                        {req.yearMin}–{req.yearMax} {req.make} {req.model} (x{req.quantity})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Max Budget: <span className="font-mono font-semibold text-slate-900">{fmt(req.maxBudgetUsd)}</span> ·{' '}
                        {getPortById(req.destinationPortId).name}, {req.destinationCountry}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[11px] font-semibold uppercase rounded bg-slate-100 text-slate-800">
                      {req.status.replace('_', ' ')}
                    </span>
                  </div>

                  {req.options && req.options.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-700">
                        Staff Shortlisted Auction / Stock Options ({req.options.length})
                      </div>
                      {req.options.map((opt) => (
                        <div
                          key={opt.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-950">{opt.title}</span>
                            <span className="font-mono font-bold text-amber-800">
                              {fmt(opt.estFobUsd)} FOB
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {opt.auctionHouse} Lot #{opt.lotNumber} · Grade {opt.grade} ·{' '}
                            {opt.mileageKm.toLocaleString()} km
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {opt.translatedNotes}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: QUOTATIONS & MAXIMUM BID AUTHORIZATION */}
      {activeTab === 'quotations' && (
        <div className="space-y-4">
          {myQuotations.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              No quotations issued to your account yet. Submit a Sourcing Request to receive an
              itemized CIF quotation and Maximum Bid Ceiling form.
            </div>
          ) : (
            myQuotations.map((q) => (
              <div
                key={q.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
              >
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono text-amber-800 font-semibold">
                      {q.quoteNumber} · Stock/Lot {q.stockCode} · Valid until {q.validUntil}
                    </div>
                    <h3 className="text-base font-bold text-slate-950 mt-0.5">
                      {q.vehicleTitle}
                    </h3>
                    <div className="text-xs text-slate-500">
                      Destination: {q.destinationPortName} · Prepared by {q.preparedByName}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 text-xs font-semibold uppercase rounded-lg ${
                        q.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-900'
                          : q.status === 'declined'
                            ? 'bg-red-100 text-red-900'
                            : 'bg-amber-100 text-amber-950'
                      }`}
                    >
                      {q.status}
                    </span>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Itemized Breakdown (Fixed vs Estimate) */}
                  <div className="lg:col-span-7 space-y-2 text-xs">
                    <div className="font-semibold text-slate-900 mb-2">
                      Itemized Trade Cost Breakdown
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">
                        Vehicle FOB / Auction Hammer{' '}
                        <span className="text-[10px] font-mono text-amber-700">(ESTIMATE)</span>
                      </span>
                      <span className="font-mono font-semibold text-slate-950 tabular-nums">
                        {fmt(q.fobVehicleUsd)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">
                        Auction &amp; Buying Service Fee{' '}
                        <span className="text-[10px] font-mono text-slate-500">(FIXED)</span>
                      </span>
                      <span className="font-mono text-slate-900 tabular-nums">
                        {fmt(q.auctionFeeUsd)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">
                        Export Deregistration &amp; Customs Docs{' '}
                        <span className="text-[10px] font-mono text-slate-500">(FIXED)</span>
                      </span>
                      <span className="font-mono text-slate-900 tabular-nums">
                        {fmt(q.exportDocsUsd)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">
                        JEVIC / QISJ Pre-Export Inspection{' '}
                        <span className="text-[10px] font-mono text-slate-500">(FIXED)</span>
                      </span>
                      <span className="font-mono text-slate-900 tabular-nums">
                        {fmt(q.jevicInspectionUsd)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">
                        Ocean Freight to {q.destinationPortName}{' '}
                        <span className="text-[10px] font-mono text-amber-700">(ESTIMATE)</span>
                      </span>
                      <span className="font-mono text-slate-900 tabular-nums">
                        {fmt(q.seaFreightUsd)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-600">
                        Marine Transit Insurance{' '}
                        <span className="text-[10px] font-mono text-slate-500">(FIXED)</span>
                      </span>
                      <span className="font-mono text-slate-900 tabular-nums">
                        {fmt(q.marineInsuranceUsd)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 text-sm font-bold text-slate-950">
                      <span>Estimated Total Landed CIF</span>
                      <span className="font-mono tabular-nums">{fmt(q.totalCifUsd)}</span>
                    </div>
                    {q.notes && (
                      <p className="text-[11px] text-slate-500 pt-2 leading-relaxed">{q.notes}</p>
                    )}
                  </div>

                  {/* Max Bid Authorization Card */}
                  <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                        Authorized Maximum Bid Ceiling
                      </div>
                      <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-950">
                        {fmt(q.authorizedMaxBidUsd)}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Server-enforced Bid Ceiling Guard: AUZIO TRADERS staff are strictly blocked
                        from entering any auction bid above this USD ceiling.
                      </p>
                    </div>

                    {q.status === 'sent' ? (
                      <div className="space-y-2.5">
                        <button
                          type="button"
                          disabled={busyQuoteId === q.id}
                          onClick={async () => {
                            setBusyQuoteId(q.id);
                            try {
                              await onRespondQuotation({ quotation: q, decision: 'approved' });
                            } finally {
                              setBusyQuoteId(null);
                            }
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-60 cursor-pointer"
                        >
                          {busyQuoteId === q.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          Approve &amp; Authorize Max Bid Ceiling
                        </button>

                        {decliningId === q.id ? (
                          <div className="space-y-2 pt-1">
                            <input
                              type="text"
                              value={declineReason}
                              onChange={(e) => setDeclineReason(e.target.value)}
                              placeholder="Reason for declining (e.g. over target budget)..."
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={busyQuoteId === q.id}
                                onClick={async () => {
                                  setBusyQuoteId(q.id);
                                  try {
                                    await onRespondQuotation({
                                      quotation: q,
                                      decision: 'declined',
                                      declineReason,
                                    });
                                    setDecliningId(null);
                                    setDeclineReason('');
                                  } finally {
                                    setBusyQuoteId(null);
                                  }
                                }}
                                className="flex-1 py-1.5 text-xs font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 cursor-pointer"
                              >
                                Confirm Decline
                              </button>
                              <button
                                type="button"
                                onClick={() => setDecliningId(null)}
                                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-200 rounded-lg cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDecliningId(q.id)}
                            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-semibold text-red-800 bg-white border border-red-200 hover:bg-red-50 rounded-lg cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            Decline Quotation
                          </button>
                        )}
                      </div>
                    ) : q.status === 'approved' ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          Approved &amp; Max Bid Authorized
                        </div>
                        <div className="font-mono text-[11px]">
                          Timestamp: {q.approvedAt ? q.approvedAt.slice(0, 19).replace('T', ' ') : 'Recorded'} UTC
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900">
                        Declined{q.declineReason ? `: ${q.declineReason}` : '.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: ORDERS & 14-STAGE MILESTONE TRACKING */}
      {activeTab === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Order Selector List */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-950 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600" />
              Your Export Orders ({myOrders.length})
            </h2>
            {myOrders.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-xs text-slate-500">
                No active export orders yet. Approve a quotation to initiate an export order.
              </div>
            ) : (
              myOrders.map((ord) => {
                const isSelected = activeOrder?.id === ord.id;
                const stageIdx = TRADE_MILESTONE_ORDER.indexOf(ord.milestone);
                return (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => setSelectedOrderId(ord.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-slate-950 text-white border-slate-950 shadow-md'
                        : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className={isSelected ? 'text-amber-400' : 'text-amber-700 font-semibold'}>
                        {ord.orderNumber}
                      </span>
                      <span className={isSelected ? 'text-slate-400' : 'text-slate-500'}>
                        Stage {stageIdx + 1}/14
                      </span>
                    </div>
                    <div className="text-sm font-bold">{ord.vehicleTitle}</div>
                    <div className={`text-xs ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {TRADE_MILESTONE_META[ord.milestone]?.label} · {ord.destinationPortName}
                    </div>
                    <div className="font-mono text-xs font-semibold pt-1">
                      CIF {fmt(ord.totalCifUsd)} · Ref {ord.trackingCode}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: 14-Stage Timeline + Vessel Schedule + Customer-Only Messages */}
          <div className="lg:col-span-8 space-y-6">
            {activeOrder ? (
              <>
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <div className="text-xs font-mono text-amber-700 font-semibold">
                        {activeOrder.orderNumber} · Tracking: {activeOrder.trackingCode}
                      </div>
                      <h3 className="text-lg font-bold text-slate-950 mt-0.5">
                        {activeOrder.vehicleTitle}
                      </h3>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Destination: {activeOrder.destinationPortName} · Stock{' '}
                        {activeOrder.vehicleStockCode}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const matched =
                          vehicles.find((v) => v.id === activeOrder.vehicleId) || vehicles[0];
                        if (!matched) return;
                        const cif = calculateCif({
                          fobUsd: activeOrder.fobUsd,
                          volumeM3: matched.volumeM3,
                          portId: activeOrder.destinationPortId,
                          shippingMethod: activeOrder.shippingMethod,
                          includeInsurance: activeOrder.insuranceUsd > 0,
                        });
                        onOpenProforma({
                          vehicle: matched,
                          cif,
                          trackingCode: activeOrder.trackingCode,
                          currency: activeOrder.lockedCurrency || activeOrder.currency,
                          lockedExchangeRate: activeOrder.lockedExchangeRate,
                          lockedRateDate: activeOrder.lockedRateDate,
                          isRateLocked: Boolean(activeOrder.lockedExchangeRate),
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Print Official Proforma P/I
                    </button>
                  </div>

                  {activeOrder.lockedExchangeRate && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        Confirmed Invoice Rate Locked: 1 USD ={' '}
                        <span className="font-mono">
                          {activeOrder.lockedExchangeRate.toFixed(4)}{' '}
                          {activeOrder.lockedCurrency || activeOrder.currency}
                        </span>
                      </span>
                      {activeOrder.lockedRateDate && (
                        <span className="text-[11px] font-mono text-emerald-800">
                          Locked {activeOrder.lockedRateDate.slice(0, 10)} · Unaffected by daily FX updates
                        </span>
                      )}
                    </div>
                  )}

                  {/* Vessel Schedule Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Ship className="w-4 h-4 text-amber-600" />
                        Carrier &amp; Vessel Schedule (Staff-Verified)
                      </div>
                      <div className="flex items-center gap-2">
                        {activeOrder.scheduleIsEstimate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-900 rounded">
                            <AlertTriangle className="w-3 h-3" />
                            Estimated Schedule (Subject to Carrier Confirmation)
                          </span>
                        )}
                        {onOpenVesselTracking && (
                          <button
                            type="button"
                            onClick={onOpenVesselTracking}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer"
                          >
                            <Radio className="w-3 h-3 text-emerald-600" />
                            Live Vessel Map
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Vessel Name</div>
                        <div className="font-mono font-semibold text-slate-950 mt-0.5">
                          {activeOrder.vesselName || 'Pending Booking'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Voyage #</div>
                        <div className="font-mono font-semibold text-slate-950 mt-0.5">
                          {activeOrder.voyageNumber || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">B/L Number</div>
                        <div className="font-mono font-semibold text-slate-950 mt-0.5">
                          {activeOrder.blNumber || 'Pending'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">ETD Japan</div>
                        <div className="font-mono font-semibold text-slate-950 mt-0.5">
                          {activeOrder.etdDate || 'TBD'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Est. ETA Port</div>
                        <div className="font-mono font-semibold text-slate-950 mt-0.5">
                          {activeOrder.etaDate || 'TBD'}
                        </div>
                      </div>
                    </div>

                    {activeOrderVessel && (() => {
                      const freshness = getVesselFreshness(activeOrderVessel);
                      return (
                        <div className="pt-3 border-t border-slate-200 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-slate-900">
                              AIS Telemetry — MMSI {activeOrderVessel.mmsi}
                              {activeOrderVessel.imo ? ` · IMO ${activeOrderVessel.imo}` : ''}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                                freshness.status === 'live'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : freshness.status === 'stale' || freshness.status === 'outdated'
                                    ? 'bg-amber-100 text-amber-900'
                                    : freshness.status === 'manual_only'
                                      ? 'bg-sky-100 text-sky-900'
                                      : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {freshness.label}
                            </span>
                          </div>

                          {(freshness.status === 'stale' || freshness.status === 'outdated') && (
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                              <span>
                                Vessel AIS position is outdated (last terrestrial/satellite report:{' '}
                                {activeOrderVessel.lastAisUpdateAt
                                  ? new Date(activeOrderVessel.lastAisUpdateAt).toLocaleString()
                                  : 'Pending'}
                                ). Showing last recorded coordinates.
                              </span>
                            </div>
                          )}

                          <VesselLeafletMap
                            vessels={[activeOrderVessel]}
                            selectedVesselId={activeOrderVessel.id}
                            heightClass="h-[260px]"
                          />

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <div className="bg-white border border-slate-200 rounded-lg p-2">
                              <div className="text-slate-500">Speed (SOG)</div>
                              <div className="font-mono font-bold text-slate-950">
                                {typeof activeOrderVessel.speedKnots === 'number'
                                  ? `${activeOrderVessel.speedKnots.toFixed(1)} kn`
                                  : '—'}
                              </div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-2">
                              <div className="text-slate-500">Course / Heading</div>
                              <div className="font-mono font-bold text-slate-950">
                                {typeof activeOrderVessel.courseDeg === 'number'
                                  ? `${activeOrderVessel.courseDeg.toFixed(0)}°`
                                  : '—'}
                              </div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-2">
                              <div className="text-slate-500">AIS Destination</div>
                              <div className="font-mono font-bold text-slate-950 truncate">
                                {activeOrderVessel.aisDestination || activeOrderVessel.destinationPort || '—'}
                              </div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-2">
                              <div className="text-slate-500">Reported ETA</div>
                              <div className="font-mono font-bold text-slate-950">
                                {activeOrderVessel.etaReported || activeOrderVessel.etaManual || activeOrder.etaDate || 'TBD'}
                              </div>
                            </div>
                          </div>

                          {activeOrderVessel.manualLocationNote && (
                            <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-950">
                              <strong>Coordinator Update:</strong> {activeOrderVessel.manualStatus ? `[${activeOrderVessel.manualStatus}] ` : ''}
                              {activeOrderVessel.manualLocationNote}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 14-Stage Milestone Grid */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-900">
                      14-Stage Export Milestone Progress
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {TRADE_MILESTONE_ORDER.map((stage, idx) => {
                        const currentIdx = TRADE_MILESTONE_ORDER.indexOf(activeOrder.milestone);
                        const isDone = idx < currentIdx;
                        const isCurrent = idx === currentIdx;
                        return (
                          <div
                            key={stage}
                            className={`p-2.5 rounded-lg border text-xs ${
                              isCurrent
                                ? 'bg-amber-50 border-amber-500 text-amber-950 font-semibold'
                                : isDone
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                  : 'bg-white border-slate-200 text-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
                              <span>{String(idx + 1).padStart(2, '0')}</span>
                              {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
                              {isCurrent && <span className="text-amber-700 font-bold">NOW</span>}
                            </div>
                            <div className="leading-tight">
                              {TRADE_MILESTONE_META[stage].shortLabel}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                      <strong className="text-slate-900">Current Stage:</strong>{' '}
                      {TRADE_MILESTONE_META[activeOrder.milestone]?.label} —{' '}
                      {TRADE_MILESTONE_META[activeOrder.milestone]?.description}
                    </p>
                  </div>
                </div>

                {/* Order Messages Thread (Strictly Customer-Visible Only) */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h4 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-amber-600" />
                      Order Communication Thread ({activeOrder.orderNumber})
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Direct with Yokohama Export Desk
                    </span>
                  </div>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {activeOrderMessages.length === 0 ? (
                      <div className="text-xs text-slate-500 py-4 text-center">
                        No messages on this order yet. Post an instruction below.
                      </div>
                    ) : (
                      activeOrderMessages.map((msg) => {
                        const isMine = msg.senderRole === 'customer';
                        return (
                          <div
                            key={msg.id}
                            className={`p-3.5 rounded-xl text-xs space-y-1 ${
                              isMine
                                ? 'bg-slate-900 text-white ml-8'
                                : 'bg-slate-100 text-slate-900 mr-8'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold">{msg.senderName}</span>
                              <span className={isMine ? 'text-slate-400 uppercase font-mono' : 'text-slate-500 uppercase font-mono'}>
                                {msg.senderRole}
                              </span>
                            </div>
                            <p className="leading-relaxed">{msg.body}</p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={handleMessageSubmit} className="flex gap-2 pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      placeholder="Send shipping instructions, DHL address updates, or payment slip reference..."
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-amber-600"
                    />
                    <button
                      type="submit"
                      disabled={sendingMsg || !messageDraft.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                Select an order to view its 14-stage timeline and vessel booking schedule.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: CUSTOMER DOCUMENT VAULT (isCustomerVisible === true ONLY) */}
      {activeTab === 'documents' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-700" />
                Verified Export Document Vault
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official Proforma Invoices, Export Certificates, QISJ/JEVIC Reports, and Bills of
                Lading released to your account.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-600">
              {myVisibleDocs.length} released files
            </span>
          </div>

          {myVisibleDocs.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No export documents have been published to your vault yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {myVisibleDocs.map((docItem) => (
                <div
                  key={docItem.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-amber-800">
                        {docItem.orderNumber}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 rounded">
                        {docItem.docType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-950">{docItem.title}</div>
                    <div className="text-xs text-slate-500">
                      File: <span className="font-mono">{docItem.fileName}</span> · Released by{' '}
                      {docItem.uploadedByName}
                    </div>
                    {docItem.notes && (
                      <div className="text-xs text-slate-600">{docItem.notes}</div>
                    )}
                  </div>

                  {docItem.fileUrl ? (
                    <a
                      href={docItem.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download File
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified Digital Copy Ready
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
