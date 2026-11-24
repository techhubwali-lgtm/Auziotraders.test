import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardList,
  Database,
  Edit3,
  Eye,
  EyeOff,
  FilePlus2,
  FileText,
  Gavel,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Package,
  Plus,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ALL_CURRENCIES,
  formatMoney,
  getPortById,
  GLOBAL_PORTS,
  TRADE_MILESTONE_META,
  TRADE_MILESTONE_ORDER,
} from '../data/ports';
import { AdminCmsPanel } from '../components/AdminCmsPanel';
import { AdminVehicleModal } from '../components/AdminVehicleModal';
import { StaffAuctionImportPanel } from '../components/StaffAuctionImportPanel';
import type {
  AuditLogEntry,
  CompanySettings,
  CurrencyCode,
  CustomerTestimonial,
  ExportDocType,
  ExportDocument,
  ExportOrder,
  Inquiry,
  LandingPageContent,
  OrderMessage,
  PersistedUserRole,
  Quotation,
  SourcingOption,
  SourcingRequest,
  TradeOrderMilestone,
  UserProfile,
  UserRole,
  Vehicle,
} from '../types/portal';

type StaffTab =
  | 'overview'
  | 'sourcing'
  | 'quotations'
  | 'orders'
  | 'inventory'
  | 'documents'
  | 'cms'
  | 'audit'
  | 'settings';

interface StaffConsoleViewProps {
  role: UserRole;
  staffProfile: UserProfile | null;
  currency: CurrencyCode;
  settings: CompanySettings;
  isLiveFirestoreMode: boolean;
  vehicles: Vehicle[];
  users: UserProfile[];
  sourcingRequests: SourcingRequest[];
  quotations: Quotation[];
  orders: ExportOrder[];
  messages: OrderMessage[];
  documents: ExportDocument[];
  auditLogs: AuditLogEntry[];
  inquiries: Inquiry[];
  onAttachSourcingOption: (request: SourcingRequest, option: SourcingOption) => Promise<void>;
  onCreateQuotation: (input: {
    sourcingRequestId: string;
    vehicleId: string;
    vehicleTitle: string;
    stockCode: string;
    customerId: string;
    customerName: string;
    customerCompany: string;
    destinationPortId: string;
    destinationPortName: string;
    currency: CurrencyCode;
    fobVehicleUsd: number;
    auctionFeeUsd: number;
    exportDocsUsd: number;
    jevicInspectionUsd: number;
    seaFreightUsd: number;
    marineInsuranceUsd: number;
    authorizedMaxBidUsd: number;
    notes: string;
  }) => Promise<void>;
  onConvertQuoteToOrder: (quotation: Quotation) => Promise<void>;
  onPlaceAuctionBid: (
    order: ExportOrder,
    bidAmountUsd: number
  ) => Promise<{ ok: boolean; error?: string }>;
  onUpdateOrderLogistics: (params: {
    order: ExportOrder;
    milestone: TradeOrderMilestone;
    vesselName: string;
    voyageNumber: string;
    blNumber: string;
    etdDate: string;
    etaDate: string;
    scheduleIsEstimate: boolean;
  }) => Promise<void>;
  onPostOrderMessage: (params: {
    order: ExportOrder;
    body: string;
    isInternalStaffOnly: boolean;
  }) => Promise<void>;
  onArchiveVehicle: (vehicle: Vehicle) => Promise<void>;
  onDeleteVehicle: (vehicleId: string) => Promise<void>;
  onCreateDocument: (input: {
    orderId: string;
    orderNumber: string;
    customerId: string;
    title: string;
    docType: ExportDocType;
    fileName: string;
    fileUrl: string;
    isCustomerVisible: boolean;
    notes: string;
  }) => Promise<void>;
  onToggleDocVisibility: (docRecord: ExportDocument, nextVisible: boolean) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  onUpdateUserRole: (
    uid: string,
    updates: {
      role: PersistedUserRole;
      verified: boolean;
      assignedRepName: string;
      assignedRepEmail: string;
    }
  ) => Promise<void>;
  landingContent: LandingPageContent;
  testimonials: CustomerTestimonial[];
  liveFxRates?: Record<string, number>;
  onSaveLandingContent: (next: LandingPageContent) => Promise<void>;
  onSaveTestimonial: (
    input: Omit<CustomerTestimonial, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteTestimonial: (id: string) => Promise<void>;
  onSaveSettings: (next: CompanySettings) => Promise<void>;
  onSeedDatabase: () => Promise<void>;
  onClearSampleData: () => Promise<void>;
  onNotify: (msg: string) => void;
  onOpenStaffLogin: () => void;
}

export function StaffConsoleView({
  role,
  staffProfile,
  currency,
  settings,
  isLiveFirestoreMode,
  vehicles,
  users,
  sourcingRequests,
  quotations,
  orders,
  messages,
  documents,
  auditLogs,
  inquiries,
  landingContent,
  testimonials,
  liveFxRates,
  onAttachSourcingOption,
  onCreateQuotation,
  onConvertQuoteToOrder,
  onPlaceAuctionBid,
  onUpdateOrderLogistics,
  onPostOrderMessage,
  onArchiveVehicle,
  onDeleteVehicle,
  onCreateDocument,
  onToggleDocVisibility,
  onDeleteDocument,
  onUpdateUserRole,
  onSaveLandingContent,
  onSaveTestimonial,
  onDeleteTestimonial,
  onSaveSettings,
  onSeedDatabase,
  onClearSampleData,
  onNotify,
  onOpenStaffLogin,
}: StaffConsoleViewProps) {
  const isStaff = ['sales', 'accounts', 'operations', 'management', 'admin'].includes(role);
  const isAdmin = role === 'admin' || role === 'management';
  const canQuote = ['sales', 'accounts', 'management', 'admin'].includes(role);
  const canInventory = ['operations', 'management', 'admin'].includes(role);

  const [activeTab, setActiveTab] = useState<StaffTab>('overview');
  const fmt = (usd: number) => formatMoney(usd, currency, liveFxRates || settings.exchangeRates);

  // Sourcing option composer state
  const [optReqId, setOptReqId] = useState<string>('');
  const [optTitle, setOptTitle] = useState('');
  const [optHouse, setOptHouse] = useState('USS Tokyo');
  const [optLot, setOptLot] = useState('');
  const [optGrade, setOptGrade] = useState('4.5 / A');
  const [optMileage, setOptMileage] = useState(32000);
  const [optFob, setOptFob] = useState(19500);
  const [optNotes, setOptNotes] = useState('');

  // Quotation form state
  const customerUsers = useMemo(
    () => users.filter((u) => u.role === 'customer' || u.role === 'dealer'),
    [users]
  );
  const [qCustomerId, setQCustomerId] = useState(customerUsers[0]?.uid || 'cust-kenya-01');
  const [qSourcingId, setQSourcingId] = useState('');
  const [qVehicleId, setQVehicleId] = useState(vehicles[0]?.id || '');
  const [qTitle, setQTitle] = useState(
    vehicles[0] ? `${vehicles[0].year} ${vehicles[0].make} ${vehicles[0].model}` : ''
  );
  const [qStockCode, setQStockCode] = useState(vehicles[0]?.stockCode || 'AUZ-AUC-8821');
  const [qPortId, setQPortId] = useState('mombasa-ke');
  const [qFob, setQFob] = useState(18500);
  const [qAuctionFee, setQAuctionFee] = useState(550);
  const [qExportDocs, setQExportDocs] = useState(250);
  const [qJevic, setQJevic] = useState(285);
  const [qFreight, setQFreight] = useState(1450);
  const [qInsurance, setQInsurance] = useState(310);
  const [qMaxBid, setQMaxBid] = useState(19000);
  const [qNotes, setQNotes] = useState(
    'Fixed fees: Export Docs & Inspection. Variable estimates: Auction Hammer (capped by Max Bid Ceiling) & Sea Freight.'
  );

  // Bid Ceiling Validator state
  const [bidOrderId, setBidOrderId] = useState(orders[0]?.id || '');
  const [bidAmountUsd, setBidAmountUsd] = useState(34000);
  const [bidGuardResult, setBidGuardResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Order Logistics & Messaging state
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || '');
  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || orders[0] || null,
    [orders, selectedOrderId]
  );
  const [editMilestone, setEditMilestone] = useState<TradeOrderMilestone>(
    selectedOrder?.milestone || 'shipment_booked'
  );
  const [editVessel, setEditVessel] = useState(selectedOrder?.vesselName || '');
  const [editVoyage, setEditVoyage] = useState(selectedOrder?.voyageNumber || '');
  const [editBl, setEditBl] = useState(selectedOrder?.blNumber || '');
  const [editEtd, setEditEtd] = useState(selectedOrder?.etdDate || '');
  const [editEta, setEditEta] = useState(selectedOrder?.etaDate || '');
  const [editEstimate, setEditEstimate] = useState(selectedOrder?.scheduleIsEstimate ?? true);
  const [staffMsgBody, setStaffMsgBody] = useState('');
  const [staffMsgInternal, setStaffMsgInternal] = useState(true);

  const selectOrderForEdit = (ord: ExportOrder) => {
    setSelectedOrderId(ord.id);
    setEditMilestone(ord.milestone);
    setEditVessel(ord.vesselName);
    setEditVoyage(ord.voyageNumber);
    setEditBl(ord.blNumber);
    setEditEtd(ord.etdDate);
    setEditEta(ord.etaDate);
    setEditEstimate(ord.scheduleIsEstimate);
  };

  // Inventory Modal & inline delete confirm
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isImportMode, setIsImportMode] = useState(false);
  const [showAuctionImporter, setShowAuctionImporter] = useState(true);
  const [confirmDeleteVehId, setConfirmDeleteVehId] = useState<string | null>(null);

  // Document Manager form
  const [docOrderId, setDocOrderId] = useState(orders[0]?.id || '');
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<ExportDocType>('bill_of_lading');
  const [docFileName, setDocFileName] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docVisible, setDocVisible] = useState(true);
  const [docNotes, setDocNotes] = useState('');

  // Settings form
  const [settingsDraft, setSettingsDraft] = useState<CompanySettings>(settings);
  const [confirmClearData, setConfirmClearData] = useState(false);

  if (!isStaff) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="w-12 h-12 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-950">Management / Staff Console Restricted</h1>
        <p className="text-sm text-slate-600">
          This workspace is restricted to authorized AUZIO TRADERS Sales, Operations, and
          Administrator accounts. Customer accounts cannot access internal staff workflows.
        </p>
        <button
          type="button"
          onClick={onOpenStaffLogin}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          <Lock className="w-4 h-4 text-amber-400" />
          Open Staff / Admin Login Portal
        </button>
      </div>
    );
  }

  const allTabs: { id: StaffTab; label: string; icon: typeof LayoutDashboard; allowed: boolean }[] = [
    { id: 'overview', label: 'Overview Metrics', icon: LayoutDashboard, allowed: true },
    { id: 'sourcing', label: 'Sourcing Queue', icon: ClipboardList, allowed: true },
    { id: 'quotations', label: 'Quotations & Bid Guard', icon: Gavel, allowed: canQuote },
    { id: 'orders', label: 'Orders & Vessel Logistics', icon: Package, allowed: true },
    { id: 'inventory', label: 'Inventory Manager', icon: Database, allowed: canInventory },
    { id: 'documents', label: 'Document Manager', icon: FileText, allowed: canInventory },
    { id: 'cms', label: 'Landing CMS & Reviews', icon: Edit3, allowed: isAdmin },
    { id: 'audit', label: 'Audit Trail', icon: ShieldAlert, allowed: isAdmin },
    { id: 'settings', label: 'System Settings', icon: Settings, allowed: isAdmin },
  ];

  const visibleTabs = allTabs.filter((t) => t.allowed);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Staff Console Header */}
      <div className="bg-slate-950 text-white rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <span>AUZIO TRADERS OPERATIONS CONSOLE</span>
            <span className="text-slate-600">|</span>
            <span>ROLE: {role.toUpperCase()}</span>
            <span className="text-slate-600">|</span>
            <span>{isLiveFirestoreMode ? 'LIVE FIRESTORE' : 'DEMO PREVIEW'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">
            Yokohama Trade, Bidding &amp; Export Logistics Desk
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Signed in as {staffProfile?.displayName || role.toUpperCase()} (
            {staffProfile?.email || 'staff@auziotraders.com'})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {canInventory && (
            <button
              type="button"
              onClick={() => {
                setEditingVehicle(null);
                setVehicleModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Vehicle
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold text-slate-200 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              Admin &amp; Seed Controls
            </button>
          )}
        </div>
      </div>

      {/* Role-Scoped Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-3 text-xs font-semibold whitespace-nowrap border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                isActive
                  ? 'border-amber-600 text-slate-950'
                  : 'border-transparent text-slate-600 hover:text-slate-950'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW METRICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Active Stock &amp; Lots</div>
              <div className="text-2xl font-extrabold font-mono text-slate-950 mt-1">
                {vehicles.filter((v) => v.status !== 'archived').length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {vehicles.filter((v) => v.listingType === 'auzio_stock').length} physical yard units
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Sourcing Queue</div>
              <div className="text-2xl font-extrabold font-mono text-amber-700 mt-1">
                {sourcingRequests.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {sourcingRequests.filter((r) => r.status === 'new').length} awaiting options
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Active Quotations</div>
              <div className="text-2xl font-extrabold font-mono text-slate-950 mt-1">
                {quotations.length}
              </div>
              <div className="text-[11px] text-emerald-700 font-medium mt-1">
                {quotations.filter((q) => q.status === 'approved').length} customer approved
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Active Export Orders</div>
              <div className="text-2xl font-extrabold font-mono text-slate-950 mt-1">
                {orders.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {fmt(orders.reduce((acc, o) => acc + o.totalCifUsd, 0))} pipeline CIF
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Public Quick Inquiries</div>
              <div className="text-2xl font-extrabold font-mono text-slate-950 mt-1">
                {inquiries.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Visitor quotes &amp; 48h holds
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-950">Recent Export Orders</h2>
              <div className="divide-y divide-slate-100 text-xs">
                {orders.slice(0, 5).map((ord) => (
                  <div key={ord.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">
                        {ord.orderNumber} — {ord.vehicleTitle}
                      </div>
                      <div className="text-slate-500">
                        {ord.customerCompany} · {ord.destinationPortName}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-slate-900">
                        {fmt(ord.totalCifUsd)}
                      </div>
                      <div className="text-[11px] text-amber-800 font-medium">
                        {TRADE_MILESTONE_META[ord.milestone]?.shortLabel}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-950">Recent Public Visitor Inquiries</h2>
              {inquiries.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  Visitor CIF inquiries and 48-hour hold requests submitted from the public
                  storefront will appear here.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {inquiries.slice(0, 5).map((inq) => (
                    <div key={inq.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">
                          {inq.buyerName} ({inq.buyerCountry}) — {inq.vehicleStockCode}
                        </div>
                        <div className="text-slate-500">
                          {inq.buyerEmail} · {inq.destinationPortName}
                        </div>
                      </div>
                      <div className="text-right font-mono shrink-0">
                        <div className="font-semibold text-slate-900">{inq.trackingCode}</div>
                        <div className="text-[11px] text-amber-700">{fmt(inq.quotedCifUsd)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SOURCING QUEUE */}
      {activeTab === 'sourcing' && (
        <div className="space-y-4">
          {sourcingRequests.map((req) => (
            <div
              key={req.id}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="text-xs font-mono text-amber-700 font-semibold">
                    {req.requestCode} · {req.customerCompany} ({req.customerName})
                  </div>
                  <h3 className="text-base font-bold text-slate-950 mt-0.5">
                    {req.yearMin}–{req.yearMax} {req.make} {req.model} (Qty {req.quantity})
                  </h3>
                  <div className="text-xs text-slate-600 mt-1">
                    Budget Ceiling: <strong className="font-mono">{fmt(req.maxBudgetUsd)}</strong> ·
                    Max {req.mileageMaxKm.toLocaleString()} km · Grade {req.gradePref} · Port:{' '}
                    {getPortById(req.destinationPortId).name}
                  </div>
                  {req.notes && (
                    <p className="text-xs text-slate-500 mt-1">Buyer Notes: {req.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-semibold uppercase rounded bg-slate-100 text-slate-800">
                    {req.status.replace('_', ' ')}
                  </span>
                  {canQuote && (
                    <button
                      type="button"
                      onClick={() => {
                        setQSourcingId(req.id);
                        setQCustomerId(req.customerId);
                        setQTitle(`${req.yearMax} ${req.make} ${req.model}`);
                        setQPortId(req.destinationPortId);
                        setQFob(Math.round(req.maxBudgetUsd * 0.85));
                        setQMaxBid(Math.round(req.maxBudgetUsd * 0.88));
                        setActiveTab('quotations');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
                    >
                      Prepare Quotation →
                    </button>
                  )}
                </div>
              </div>

              {/* Existing Shortlisted Options */}
              {req.options.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {req.options.map((o) => (
                    <div
                      key={o.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1"
                    >
                      <div className="flex justify-between font-semibold text-slate-950">
                        <span>{o.title}</span>
                        <span className="font-mono text-amber-800">{fmt(o.estFobUsd)}</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {o.auctionHouse} Lot #{o.lotNumber} · Grade {o.grade} ·{' '}
                        {o.mileageKm.toLocaleString()} km
                      </div>
                      <p className="text-[11px] text-slate-600">{o.translatedNotes}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Attach Auction Option + Translated Sheet Notes */}
              {optReqId === req.id ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await onAttachSourcingOption(req, {
                      id: `opt-${Date.now()}`,
                      title: optTitle,
                      auctionHouse: optHouse,
                      lotNumber: optLot,
                      grade: optGrade,
                      mileageKm: Number(optMileage),
                      estFobUsd: Number(optFob),
                      translatedNotes: optNotes,
                    });
                    setOptReqId('');
                    setOptTitle('');
                    setOptLot('');
                    setOptNotes('');
                  }}
                  className="p-4 bg-amber-50/60 border border-amber-200 rounded-lg space-y-3"
                >
                  <div className="text-xs font-bold text-slate-900">
                    Attach Shortlisted Auction Option &amp; Translated Sheet Notes
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      required
                      value={optTitle}
                      onChange={(e) => setOptTitle(e.target.value)}
                      placeholder="Vehicle Title (e.g. 2022 Hilux Z 4WD)"
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                    <input
                      type="text"
                      required
                      value={optHouse}
                      onChange={(e) => setOptHouse(e.target.value)}
                      placeholder="USS Tokyo / TAA Kanto"
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                    <input
                      type="text"
                      required
                      value={optLot}
                      onChange={(e) => setOptLot(e.target.value)}
                      placeholder="Lot Number (e.g. 64120)"
                      className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                    />
                    <input
                      type="text"
                      value={optGrade}
                      onChange={(e) => setOptGrade(e.target.value)}
                      placeholder="Grade (4.5 / A)"
                      className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                    />
                    <input
                      type="number"
                      value={optMileage}
                      onChange={(e) => setOptMileage(Number(e.target.value))}
                      placeholder="Mileage km"
                      className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                    />
                    <input
                      type="number"
                      value={optFob}
                      onChange={(e) => setOptFob(Number(e.target.value))}
                      placeholder="Est FOB USD"
                      className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={optNotes}
                    onChange={(e) => setOptNotes(e.target.value)}
                    placeholder="English translation of Japanese auction inspector remarks..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-950 rounded-md cursor-pointer"
                    >
                      Save &amp; Send Option to Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setOptReqId('')}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setOptReqId(req.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Attach Auction Option &amp; Translated Sheet Notes
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: QUOTATIONS & SERVER-ENFORCED BID CEILING GUARD */}
      {activeTab === 'quotations' && canQuote && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Bid Ceiling Guard Validator */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-slate-950 text-white rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                <ShieldCheck className="w-4 h-4" />
                <span>AUCTION BID CEILING GUARD (SERVER-ENFORCED)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Enter a live auction bid for an approved order. Any attempt exceeding the
                customer&apos;s authorized maximum bid ceiling is strictly blocked by both the
                application guard and Firestore security rules, and logged to the Audit Trail.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Target Export Order</label>
                  <select
                    value={bidOrderId}
                    onChange={(e) => {
                      setBidOrderId(e.target.value);
                      setBidGuardResult(null);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
                  >
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} — {o.vehicleStockCode} (Ceiling: $
                        {o.authorizedMaxBidUsd.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Proposed Auction Bid Amount (USD)
                  </label>
                  <input
                    type="number"
                    min={500}
                    step={100}
                    value={bidAmountUsd}
                    onChange={(e) => setBidAmountUsd(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const target = orders.find((o) => o.id === bidOrderId);
                    if (!target) return;
                    const res = await onPlaceAuctionBid(target, bidAmountUsd);
                    setBidGuardResult({
                      ok: res.ok,
                      text: res.ok
                        ? `Bid of $${bidAmountUsd.toLocaleString()} USD accepted within $${target.authorizedMaxBidUsd.toLocaleString()} ceiling and recorded to Audit Trail.`
                        : res.error || 'Bid blocked.',
                    });
                  }}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
                >
                  Validate &amp; Submit Auction Bid
                </button>

                {bidGuardResult && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                      bidGuardResult.ok
                        ? 'bg-emerald-950 border border-emerald-700 text-emerald-200'
                        : 'bg-red-950 border border-red-700 text-red-200'
                    }`}
                  >
                    {bidGuardResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                    )}
                    <span>{bidGuardResult.text}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Existing Quotations List */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-950">
                Issued Quotations ({quotations.length})
              </h3>
              <div className="space-y-3">
                {quotations.map((q) => (
                  <div
                    key={q.id}
                    className="p-3.5 border border-slate-200 rounded-lg text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-semibold text-amber-800">
                          {q.quoteNumber} · {q.customerCompany}
                        </div>
                        <div className="font-bold text-slate-950">{q.vehicleTitle}</div>
                        <div className="font-mono text-[11px] text-slate-600">
                          CIF {fmt(q.totalCifUsd)} · Ceiling {fmt(q.authorizedMaxBidUsd)}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${
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
                    {q.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => void onConvertQuoteToOrder(q)}
                        className="w-full py-1.5 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-md cursor-pointer"
                      >
                        Convert Approved Quote → Export Order
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Issue New Itemized Quotation Form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const cust =
                users.find((u) => u.uid === qCustomerId) || customerUsers[0] || null;
              const port = getPortById(qPortId);
              await onCreateQuotation({
                sourcingRequestId: qSourcingId,
                vehicleId: qVehicleId,
                vehicleTitle: qTitle,
                stockCode: qStockCode,
                customerId: cust?.uid || qCustomerId,
                customerName: cust?.displayName || 'Registered Dealer',
                customerCompany: cust?.companyName || 'Overseas Dealer',
                destinationPortId: port.id,
                destinationPortName: `${port.name}, ${port.country}`,
                currency,
                fobVehicleUsd: Number(qFob),
                auctionFeeUsd: Number(qAuctionFee),
                exportDocsUsd: Number(qExportDocs),
                jevicInspectionUsd: Number(qJevic),
                seaFreightUsd: Number(qFreight),
                marineInsuranceUsd: Number(qInsurance),
                authorizedMaxBidUsd: Number(qMaxBid),
                notes: qNotes,
              });
            }}
            className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-950 border-b border-slate-200 pb-3">
              Issue Itemized CIF Quotation &amp; Max Bid Authorization
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Customer / Dealer
                </label>
                <select
                  value={qCustomerId}
                  onChange={(e) => setQCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                >
                  {customerUsers.map((c) => (
                    <option key={c.uid} value={c.uid}>
                      {c.companyName} ({c.displayName})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Destination Port
                </label>
                <select
                  value={qPortId}
                  onChange={(e) => setQPortId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
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
                  Vehicle Title *
                </label>
                <input
                  type="text"
                  required
                  value={qTitle}
                  onChange={(e) => setQTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Stock / Auction Lot Code *
                </label>
                <input
                  type="text"
                  required
                  value={qStockCode}
                  onChange={(e) => setQStockCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Vehicle FOB (USD)
                </label>
                <input
                  type="number"
                  value={qFob}
                  onChange={(e) => setQFob(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Auction Fee (USD)
                </label>
                <input
                  type="number"
                  value={qAuctionFee}
                  onChange={(e) => setQAuctionFee(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Export Docs (USD)
                </label>
                <input
                  type="number"
                  value={qExportDocs}
                  onChange={(e) => setQExportDocs(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  JEVIC / QISJ (USD)
                </label>
                <input
                  type="number"
                  value={qJevic}
                  onChange={(e) => setQJevic(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sea Freight (USD)
                </label>
                <input
                  type="number"
                  value={qFreight}
                  onChange={(e) => setQFreight(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Marine Insurance (USD)
                </label>
                <input
                  type="number"
                  value={qInsurance}
                  onChange={(e) => setQInsurance(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-bold text-amber-950 mb-1">
                  Authorized Maximum Bid Ceiling (USD) *
                </label>
                <input
                  type="number"
                  required
                  value={qMaxBid}
                  onChange={(e) => setQMaxBid(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-white border border-amber-400 rounded-lg"
                />
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-600">Calculated Total CIF</div>
                <div className="text-xl font-extrabold font-mono text-slate-950">
                  {fmt(qFob + qAuctionFee + qExportDocs + qJevic + qFreight + qInsurance)}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Quotation Terms &amp; Fixed vs. Estimate Notes
              </label>
              <textarea
                rows={2}
                value={qNotes}
                onChange={(e) => setQNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
            >
              Issue Quotation to Customer Portal
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: ORDERS & VESSEL LOGISTICS + INTERNAL VS CUSTOMER NOTES */}
      {activeTab === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-2.5">
            {orders.map((ord) => (
              <button
                key={ord.id}
                type="button"
                onClick={() => selectOrderForEdit(ord)}
                className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  selectedOrder?.id === ord.id
                    ? 'bg-slate-950 text-white border-slate-950'
                    : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-[11px] font-mono text-amber-500 font-semibold">
                  {ord.orderNumber} · {ord.trackingCode}
                </div>
                <div className="text-sm font-bold mt-0.5">{ord.vehicleTitle}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    selectedOrder?.id === ord.id ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {ord.customerCompany} · {TRADE_MILESTONE_META[ord.milestone]?.shortLabel}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 space-y-6">
            {selectedOrder && (
              <>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await onUpdateOrderLogistics({
                      order: selectedOrder,
                      milestone: editMilestone,
                      vesselName: editVessel,
                      voyageNumber: editVoyage,
                      blNumber: editBl,
                      etdDate: editEtd,
                      etaDate: editEta,
                      scheduleIsEstimate: editEstimate,
                    });
                  }}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-950">
                        {selectedOrder.orderNumber} — 14-Stage Milestone &amp; Vessel Schedule
                      </h2>
                      <p className="text-xs text-slate-500">
                        {selectedOrder.customerCompany} · Max Bid Ceiling{' '}
                        {fmt(selectedOrder.authorizedMaxBidUsd)} · Placed Bid{' '}
                        {fmt(selectedOrder.placedBidUsd)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Current Order Milestone (14 Stages)
                      </label>
                      <select
                        value={editMilestone}
                        onChange={(e) =>
                          setEditMilestone(e.target.value as TradeOrderMilestone)
                        }
                        className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg"
                      >
                        {TRADE_MILESTONE_ORDER.map((m, idx) => (
                          <option key={m} value={m}>
                            {String(idx + 1).padStart(2, '0')}. {TRADE_MILESTONE_META[m].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Vessel Name
                      </label>
                      <input
                        type="text"
                        value={editVessel}
                        onChange={(e) => setEditVessel(e.target.value)}
                        placeholder="MV HOEGH TRAVELLER"
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Voyage Number
                      </label>
                      <input
                        type="text"
                        value={editVoyage}
                        onChange={(e) => setEditVoyage(e.target.value)}
                        placeholder="V.048-EA"
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Bill of Lading (B/L) #
                      </label>
                      <input
                        type="text"
                        value={editBl}
                        onChange={(e) => setEditBl(e.target.value)}
                        placeholder="HLJP-YOK-268841"
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        ETD Japan
                      </label>
                      <input
                        type="date"
                        value={editEtd}
                        onChange={(e) => setEditEtd(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        ETA Destination Port
                      </label>
                      <input
                        type="date"
                        value={editEta}
                        onChange={(e) => setEditEta(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editEstimate}
                      onChange={(e) => setEditEstimate(e.target.checked)}
                      className="accent-amber-600"
                    />
                    Mark vessel dates as Estimated Schedule on customer &amp; public tracker
                  </label>

                  <div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      Save Milestone &amp; Sync Public Tracker
                    </button>
                  </div>
                </form>

                {/* Order Messages: Customer-Visible vs Confidential Internal Staff Notes */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-amber-600" />
                      Order Thread (Customer Messages + Confidential Internal Staff Notes)
                    </h3>
                  </div>

                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {messages
                      .filter((m) => m.orderId === selectedOrder.id)
                      .map((m) => (
                        <div
                          key={m.id}
                          className={`p-3 rounded-lg text-xs border ${
                            m.isInternalStaffOnly
                              ? 'bg-amber-50 border-amber-300 text-amber-950'
                              : 'bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold">
                              {m.senderName} ({m.senderRole})
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                                m.isInternalStaffOnly
                                  ? 'bg-amber-200 text-amber-950'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {m.isInternalStaffOnly
                                ? 'INTERNAL STAFF ONLY (HIDDEN FROM CUSTOMER)'
                                : 'CUSTOMER-VISIBLE'}
                            </span>
                          </div>
                          <p>{m.body}</p>
                        </div>
                      ))}
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!staffMsgBody.trim()) return;
                      await onPostOrderMessage({
                        order: selectedOrder,
                        body: staffMsgBody.trim(),
                        isInternalStaffOnly: staffMsgInternal,
                      });
                      setStaffMsgBody('');
                    }}
                    className="space-y-2.5 pt-2 border-t border-slate-100"
                  >
                    <div className="flex items-center gap-4 text-xs">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-amber-900">
                        <input
                          type="radio"
                          checked={staffMsgInternal}
                          onChange={() => setStaffMsgInternal(true)}
                          className="accent-amber-600"
                        />
                        Confidential Internal Staff Note (Hidden from Customer)
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-emerald-900">
                        <input
                          type="radio"
                          checked={!staffMsgInternal}
                          onChange={() => setStaffMsgInternal(false)}
                          className="accent-emerald-700"
                        />
                        Customer-Visible Update
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={staffMsgBody}
                        onChange={(e) => setStaffMsgBody(e.target.value)}
                        placeholder={
                          staffMsgInternal
                            ? 'Add confidential buy-rate, yard cost, or internal logistics note...'
                            : 'Write update visible to customer in their Dealer Portal...'
                        }
                        className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-950 rounded-lg cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Post
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: INVENTORY MANAGER */}
      {activeTab === 'inventory' && canInventory && (
        <div className="space-y-6">
          {showAuctionImporter && (
            <StaffAuctionImportPanel
              currency={currency}
              settings={settings}
              onImportLot={(lotVehicle) => {
                setEditingVehicle(lotVehicle);
                setIsImportMode(true);
                setVehicleModalOpen(true);
              }}
            />
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-950">
                Firestore Export Stock &amp; Imported Auction Listings ({vehicles.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAuctionImporter((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:border-amber-600 rounded-lg cursor-pointer"
                >
                  <Gavel className="w-3.5 h-3.5 text-amber-600" />
                  {showAuctionImporter ? 'Hide auc.auziotraders.com Importer' : 'Import from auc.auziotraders.com'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingVehicle(null);
                    setIsImportMode(false);
                    setVehicleModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Vehicle
                </button>
              </div>
            </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-3 px-4">Stock ID</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Listing Type</th>
                  <th className="py-3 px-4 text-right">FOB</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-950">
                      {v.stockCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-950">
                        {v.year} {v.make} {v.model}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {v.chassisCode} · Grade {v.auctionReport.exteriorGrade}/
                        {v.auctionReport.interiorGrade}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{v.listingType}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      {fmt(v.fobPriceUsd)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase bg-slate-100 rounded">
                        {v.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVehicle(v);
                          setIsImportMode(false);
                          setVehicleModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </button>
                      {v.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => void onArchiveVehicle(v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded cursor-pointer"
                        >
                          <Archive className="w-3 h-3" />
                          Archive
                        </button>
                      )}
                      {confirmDeleteVehId === v.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            void onDeleteVehicle(v.id);
                            setConfirmDeleteVehId(null);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-red-700 rounded cursor-pointer"
                        >
                          Confirm Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteVehId(v.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* TAB 6: DOCUMENT MANAGER (WITH LIVE CUSTOMER-VISIBLE VS STAFF-ONLY TOGGLE) */}
      {activeTab === 'documents' && canInventory && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ord = orders.find((o) => o.id === docOrderId) || orders[0];
              if (!ord) return;
              await onCreateDocument({
                orderId: ord.id,
                orderNumber: ord.orderNumber,
                customerId: ord.customerId,
                title: docTitle,
                docType,
                fileName: docFileName || `${docType}.pdf`,
                fileUrl: docUrl,
                isCustomerVisible: docVisible,
                notes: docNotes,
              });
              setDocTitle('');
              setDocFileName('');
              setDocUrl('');
              setDocNotes('');
            }}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3.5"
          >
            <h2 className="text-sm font-bold text-slate-950 flex items-center gap-2 border-b border-slate-200 pb-2.5">
              <FilePlus2 className="w-4 h-4 text-amber-600" />
              Publish Export or Internal Document
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Export Order</label>
              <select
                value={docOrderId}
                onChange={(e) => setDocOrderId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} — {o.customerCompany}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Document Title *
              </label>
              <input
                type="text"
                required
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Original Bill of Lading (B/L)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Doc Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as ExportDocType)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                >
                  <option value="proforma_invoice">Proforma Invoice</option>
                  <option value="export_certificate">Export Certificate</option>
                  <option value="bill_of_lading">Bill of Lading</option>
                  <option value="auction_sheet">Auction Sheet</option>
                  <option value="inspection_report">Inspection Report</option>
                  <option value="commercial_invoice">Commercial Invoice</option>
                  <option value="internal_cost_sheet">Internal Cost Sheet</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">File Name</label>
                <input
                  type="text"
                  value={docFileName}
                  onChange={(e) => setDocFileName(e.target.value)}
                  placeholder="BL-701.pdf"
                  className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                File URL (Optional)
              </label>
              <input
                type="url"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
              <input
                type="text"
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={docVisible}
                onChange={(e) => setDocVisible(e.target.checked)}
                className="accent-emerald-700"
              />
              <span>
                <strong>Customer-Visible</strong> (Uncheck to restrict strictly to Internal Staff)
              </span>
            </label>

            <button
              type="submit"
              className="w-full py-2.5 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Publish Document Record
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-950">
              All Trade Documents ({documents.length})
            </div>
            <div className="divide-y divide-slate-200">
              {documents.map((d) => (
                <div
                  key={d.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-mono text-[11px] text-amber-800 font-semibold">
                      {d.orderNumber} · {d.docType.replace(/_/g, ' ')}
                    </div>
                    <div className="font-bold text-slate-950">{d.title}</div>
                    <div className="text-slate-500 font-mono text-[11px]">{d.fileName}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void onToggleDocVisibility(d, !d.isCustomerVisible)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        d.isCustomerVisible
                          ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                          : 'bg-amber-100 text-amber-950 hover:bg-amber-200'
                      }`}
                    >
                      {d.isCustomerVisible ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          Customer-Visible
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          Staff-Only
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteDocument(d.id)}
                      aria-label={`Delete ${d.title}`}
                      className="p-1.5 text-slate-400 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: IMMUTABLE AUDIT TRAIL (ADMIN ONLY) */}
      {activeTab === 'audit' && isAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">
                Immutable Security &amp; Trade Audit Trail ({auditLogs.length})
              </h2>
              <p className="text-xs text-slate-500">
                Append-only log enforced by Firestore security rules (updates and deletions denied).
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-200 text-xs">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 font-mono text-[10px] font-bold uppercase rounded ${
                        log.action === 'bid_blocked'
                          ? 'bg-red-100 text-red-900'
                          : log.action === 'quote_approved' || log.action === 'bid_placed'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="font-mono text-slate-600">{log.actorEmail}</span>
                    <span className="text-slate-400">({log.actorRole})</span>
                  </div>
                  <div className="text-slate-900">{log.summary}</div>
                </div>
                <div className="font-mono text-[11px] text-slate-400 shrink-0">
                  {log.targetType}:{log.targetId}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: SYSTEM SETTINGS, USER RBAC & SEED TOOLS (ADMIN ONLY) */}
      {activeTab === 'settings' && isAdmin && (
        <div className="space-y-6">
          {/* User Roles & Dealer Verification */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              <h2 className="text-base font-bold text-slate-950">
                Registered Users, RBAC Roles &amp; Verification ({users.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-3 px-4">User / Company</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-950">{u.displayName}</div>
                        <div className="text-[11px] text-slate-500">{u.companyName}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{u.email}</td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            void onUpdateUserRole(u.uid, {
                              role: e.target.value as PersistedUserRole,
                              verified: u.verified,
                              assignedRepName: u.assignedRepName,
                              assignedRepEmail: u.assignedRepEmail,
                            })
                          }
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white"
                        >
                          <option value="customer">Customer</option>
                          <option value="dealer">Dealer / Wholesale</option>
                          <option value="sales">Sales Team</option>
                          <option value="accounts">Accounts Department</option>
                          <option value="operations">Operations Department</option>
                          <option value="management">Management</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            void onUpdateUserRole(u.uid, {
                              role: u.role,
                              verified: !u.verified,
                              assignedRepName: u.assignedRepName,
                              assignedRepEmail: u.assignedRepEmail,
                            })
                          }
                          className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                            u.verified
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-amber-100 text-amber-950'
                          }`}
                        >
                          {u.verified ? 'Verified' : 'Mark Verified'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SMBC Bank Wire & 9-Currency FX Rates */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onSaveSettings(settingsDraft);
            }}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <h2 className="text-base font-bold text-slate-950 border-b border-slate-200 pb-3">
              Official SMBC Tokyo Banking &amp; Multi-Currency Exchange Rates
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={settingsDraft.bankName}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, bankName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Account Number</label>
                <input
                  type="text"
                  value={settingsDraft.accountNumber}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, accountNumber: e.target.value })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">SWIFT / BIC Code</label>
                <input
                  type="text"
                  value={settingsDraft.swiftCode}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, swiftCode: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {(ALL_CURRENCIES.filter((c) => c !== 'USD') as (keyof CompanySettings['exchangeRates'])[]).map(
                (code) => (
                  <div key={code}>
                    <label className="block font-medium text-slate-600 mb-1">
                      1 USD → {code}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settingsDraft.exchangeRates[code]}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          exchangeRates: {
                            ...settingsDraft.exchangeRates,
                            [code]: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                )
              )}
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Save Banking &amp; FX Settings
            </button>
          </form>

          {/* Database Seed Reset & Clear Controls */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-950">
                Firestore Database Initialization &amp; Sample Data Tools
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Populate all 8 export vehicles, 2 sample dealers (Kenya &amp; Zambia), sourcing
                requests, quotations, 14-stage orders, messages, documents, and audit logs.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void onSeedDatabase()}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
              >
                Seed / Reset Full Trade Database
              </button>
              {confirmClearData ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void onClearSampleData();
                      setConfirmClearData(false);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
                  >
                    Confirm Clear All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearData(false)}
                    className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearData(true)}
                  className="px-4 py-2 text-xs font-semibold text-red-800 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer"
                >
                  Clear Sample Data
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: LANDING CMS & CUSTOMER TESTIMONIALS (ADMIN / MANAGEMENT ONLY) */}
      {activeTab === 'cms' && isAdmin && (
        <AdminCmsPanel
          landingContent={landingContent}
          testimonials={testimonials}
          onSaveLandingContent={onSaveLandingContent}
          onSaveTestimonial={onSaveTestimonial}
          onDeleteTestimonial={onDeleteTestimonial}
        />
      )}

      {vehicleModalOpen && (
        <AdminVehicleModal
          vehicle={editingVehicle}
          isImportMode={isImportMode}
          onClose={() => {
            setVehicleModalOpen(false);
            setEditingVehicle(null);
            setIsImportMode(false);
          }}
          onSaved={(msg) => onNotify(msg)}
        />
      )}
    </div>
  );
}
