import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Bell,
  Bot,
  Briefcase,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileBarChart2,
  FileText,
  Gavel,
  Globe,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Package,
  Plus,
  Radio,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Ship,
  Sun,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminCmsPanel } from '../components/AdminCmsPanel';
import { AdminVehicleModal } from '../components/AdminVehicleModal';
import { StaffAuctionImportPanel } from '../components/StaffAuctionImportPanel';
import { AccountsFinancePanel } from '../components/admin/AccountsFinancePanel';
import { AdminSettingsPanel } from '../components/admin/AdminSettingsPanel';
import { AiAutomationPanel } from '../components/admin/AiAutomationPanel';
import { ApiIntegrationsPanel } from '../components/admin/ApiIntegrationsPanel';
import { CrmSalesPanel } from '../components/admin/CrmSalesPanel';
import { ExecutiveDashboardPanel } from '../components/admin/ExecutiveDashboardPanel';
import { HrManagementPanel } from '../components/admin/HrManagementPanel';
import { ReportsTasksHubPanel } from '../components/admin/ReportsTasksHubPanel';
import { UsersPermissionsPanel } from '../components/admin/UsersPermissionsPanel';
import { OFFICIAL_LOGO_URL } from '../data/landingDefaults';
import {
  canViewCompanyProfit,
  hasModulePermission,
  isStaffRole,
  ROLE_METADATA,
} from '../data/permissions';
import {
  formatMoney,
  getPortById,
  TRADE_MILESTONE_META,
  TRADE_MILESTONE_ORDER,
} from '../data/ports';
import type {
  AccountStatus,
  AdminModuleKey,
  AisServiceStatusResponse,
  ApiIntegrationConfig,
  AuditLogEntry,
  CompanySettings,
  CurrencyCode,
  CustomerTestimonial,
  DesignationLevel,
  ExchangeRateCacheDoc,
  ExportDocType,
  ExportDocument,
  ExportOrder,
  FinanceRecord,
  FinanceRecordStatus,
  HrEmployee,
  HrLeaveRequest,
  Inquiry,
  LandingPageContent,
  LiveExchangeRateState,
  OrderMessage,
  OrderMilestone,
  PersistedUserRole,
  Quotation,
  RegisteredVessel,
  RolePermissionsMap,
  SalesTarget,
  SourcingOption,
  SourcingRequest,
  StaffInvitation,
  TeamChannelId,
  TeamChannelMessage,
  TeamTask,
  TradeOrderMilestone,
  UserProfile,
  UserRole,
  Vehicle,
} from '../types/portal';

type ConsoleSection =
  | 'dashboard'
  | 'crm'
  | 'sales'
  | 'inventory'
  | 'auctions'
  | 'orders'
  | 'logistics'
  | 'accounts'
  | 'hr'
  | 'documents'
  | 'reports'
  | 'cms'
  | 'ai'
  | 'users'
  | 'integrations'
  | 'settings';

const THEME_STORAGE_KEY = 'auzio_admin_theme';

interface StaffConsoleViewProps {
  role: UserRole;
  staffProfile: UserProfile | null;
  currency: CurrencyCode;
  settings: CompanySettings;
  liveFx: LiveExchangeRateState;
  fxCache: ExchangeRateCacheDoc | null;
  integrationConfig: ApiIntegrationConfig;
  vessels: RegisteredVessel[];
  aisStatus: AisServiceStatusResponse | null;
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
  financeRecords: FinanceRecord[];
  hrEmployees: HrEmployee[];
  hrLeaveRequests: HrLeaveRequest[];
  teamTasks: TeamTask[];
  teamMessages: TeamChannelMessage[];
  salesTargets: SalesTarget[];
  staffInvitations: StaffInvitation[];
  landingContent: LandingPageContent;
  testimonials: CustomerTestimonial[];
  onRefreshFx: () => Promise<void>;
  onSaveFxMargins: (
    globalMarginPct: number,
    currencyMargins: Record<string, number>
  ) => Promise<void>;
  onSaveIntegrationConfig: (next: ApiIntegrationConfig) => Promise<void>;
  onSaveVessel: (
    input: Omit<RegisteredVessel, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteVessel: (vesselId: string) => Promise<void>;
  onManualVesselUpdate: (params: {
    vessel: RegisteredVessel;
    manualStatus: string;
    manualLocationNote: string;
    etaManual: string;
    manualLatitude?: number | null;
    manualLongitude?: number | null;
  }) => Promise<void>;
  onAssignOrderToVessel: (order: ExportOrder, vessel: RegisteredVessel) => Promise<void>;
  onRefreshAisStatus: () => Promise<void>;
  onPersistLiveAisToFirestore: () => Promise<number>;
  onUpdateInquiry: (
    inquiryId: string,
    updates: { status: OrderMilestone; adminNotes: string }
  ) => Promise<void>;
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
      department?: string;
      designationLevel?: DesignationLevel;
      employeeCode?: string;
      reportingManagerName?: string;
      accountStatus?: AccountStatus;
      twoFactorRequired?: boolean;
      permissions?: RolePermissionsMap;
    }
  ) => Promise<void>;
  onCreateStaffInvitation: (
    input: Omit<StaffInvitation, 'id' | 'status' | 'acceptedByUid' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onRevokeStaffInvitation: (inviteId: string) => Promise<void>;
  onCreateFinanceRecord: (
    input: Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateFinanceStatus: (
    id: string,
    updates: { status: FinanceRecordStatus; reconciled: boolean; notes?: string }
  ) => Promise<void>;
  onDeleteFinanceRecord: (id: string) => Promise<void>;
  onSaveHrEmployee: (
    input: Omit<HrEmployee, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteHrEmployee: (id: string) => Promise<void>;
  onCreateHrLeave: (
    input: Omit<HrLeaveRequest, 'id' | 'status' | 'reviewedByName' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onReviewHrLeave: (
    id: string,
    status: 'approved' | 'rejected',
    reasonNote?: string
  ) => Promise<void>;
  onCreateTeamTask: (input: Omit<TeamTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateTeamTaskStatus: (id: string, status: TeamTask['status']) => Promise<void>;
  onUpdateTeamTaskDetails: (
    id: string,
    updates: Partial<
      Pick<
        TeamTask,
        'title' | 'description' | 'department' | 'assignedToName' | 'priority' | 'status' | 'dueDate'
      >
    >
  ) => Promise<void>;
  onDeleteTeamTask: (id: string) => Promise<void>;
  onPostTeamMessage: (channel: TeamChannelId, body: string) => Promise<void>;
  onSaveSalesTarget: (
    input: Omit<SalesTarget, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteSalesTarget: (id: string) => Promise<void>;
  onSaveLandingContent: (next: LandingPageContent) => Promise<void>;
  onSaveTestimonial: (
    input: Omit<CustomerTestimonial, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteTestimonial: (id: string) => Promise<void>;
  onSaveSettings: (next: CompanySettings) => Promise<void>;
  onSaveBankingDetails: (next: CompanySettings, verificationReason: string) => Promise<void>;
  onSeedDatabase: () => Promise<void>;
  onClearSampleData: () => Promise<void>;
  onNotify: (msg: string) => void;
  onOpenStaffLogin: () => void;
  onExitConsole: () => void;
  onSignOut: () => void;
}

export function StaffConsoleView(props: StaffConsoleViewProps) {
  const {
    role,
    staffProfile,
    currency,
    settings,
    liveFx,
    fxCache,
    integrationConfig,
    vessels,
    aisStatus,
    vehicles,
    users,
    sourcingRequests,
    quotations,
    orders,
    messages,
    documents,
    auditLogs,
    inquiries,
    financeRecords,
    hrEmployees,
    hrLeaveRequests,
    teamTasks,
    teamMessages,
    salesTargets,
    staffInvitations,
    landingContent,
    testimonials,
    onRefreshFx,
    onSaveFxMargins,
    onSaveIntegrationConfig,
    onSaveVessel,
    onDeleteVessel,
    onManualVesselUpdate,
    onAssignOrderToVessel,
    onRefreshAisStatus,
    onPersistLiveAisToFirestore,
    onUpdateInquiry,
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
    onCreateStaffInvitation,
    onRevokeStaffInvitation,
    onCreateFinanceRecord,
    onUpdateFinanceStatus,
    onDeleteFinanceRecord,
    onSaveHrEmployee,
    onDeleteHrEmployee,
    onCreateHrLeave,
    onReviewHrLeave,
    onCreateTeamTask,
    onUpdateTeamTaskStatus,
    onUpdateTeamTaskDetails,
    onDeleteTeamTask,
    onPostTeamMessage,
    onSaveSalesTarget,
    onDeleteSalesTarget,
    onSaveLandingContent,
    onSaveTestimonial,
    onDeleteTestimonial,
    onSaveSettings,
    onSaveBankingDetails,
    onSeedDatabase,
    onClearSampleData,
    onNotify,
    onOpenStaffLogin,
    onExitConsole,
    onSignOut,
  } = props;

  const isAuthorizedStaff = isStaffRole(role);
  const can = (mod: AdminModuleKey, action: 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export') =>
    hasModulePermission(role, staffProfile, mod, action);

  const fxRates = liveFx.ok ? liveFx.rates : settings.exchangeRates;
  const fmt = (usd: number) => formatMoney(usd, currency, fxRates);

  // Shell State
  const [activeSection, setActiveSection] = useState<ConsoleSection>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  });
  const [universalSearch, setUniversalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [nowClock, setNowClock] = useState(() => new Date());
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`auzio_read_notif_${staffProfile?.uid || 'staff'}`);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const t = setInterval(() => setNowClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        `auzio_read_notif_${staffProfile?.uid || 'staff'}`,
        JSON.stringify(readNotificationIds.slice(-100))
      );
    } catch {
      // ignore
    }
  }, [readNotificationIds, staffProfile?.uid]);

  // AI prefill state (when triggered from Dashboard or CRM)
  const [aiPreset, setAiPreset] = useState<{
    tool: 'daily_report' | 'sales_followup' | 'document_extract' | 'business_chat';
    prompt: string;
  }>({
    tool: 'daily_report',
    prompt: '',
  });

  // Sync Tailwind v4 dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
    return () => {
      root.classList.remove('dark');
    };
  }, [darkMode]);

  // Inventory State
  const [invSearch, setInvSearch] = useState('');
  const [invStatusFilter, setInvStatusFilter] = useState<'ALL' | 'available' | 'reserved' | 'sold' | 'archived'>('ALL');
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isImportMode, setIsImportMode] = useState(false);
  const [confirmDeleteVehId, setConfirmDeleteVehId] = useState<string | null>(null);

  // Auctions & Sourcing State
  const [auctionSubTab, setAuctionSubTab] = useState<'import' | 'sourcing' | 'bidding'>('sourcing');
  const [optReqId, setOptReqId] = useState<string>('');
  const [optTitle, setOptTitle] = useState('');
  const [optHouse, setOptHouse] = useState('USS Tokyo');
  const [optLot, setOptLot] = useState('');
  const [optGrade, setOptGrade] = useState('4.5 / A');
  const [optMileage, setOptMileage] = useState(32000);
  const [optFob, setOptFob] = useState(19500);
  const [optNotes, setOptNotes] = useState('');
  const [bidOrderId, setBidOrderId] = useState(orders[0]?.id || '');
  const [bidAmountUsd, setBidAmountUsd] = useState(25000);
  const [bidGuardResult, setBidGuardResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Orders & Logistics State
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

  // Document Vault State
  const [docOrderId, setDocOrderId] = useState(orders[0]?.id || '');
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<ExportDocType>('bill_of_lading');
  const [docFileName, setDocFileName] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docVisible, setDocVisible] = useState(true);
  const [docNotes, setDocNotes] = useState('');

  // Full JSON Database Backup Downloader
  const handleDownloadFullBackup = () => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      company: settings.companyName,
      counts: {
        vehicles: vehicles.length,
        users: users.length,
        sourcingRequests: sourcingRequests.length,
        quotations: quotations.length,
        orders: orders.length,
        inquiries: inquiries.length,
        documents: documents.length,
        financeRecords: financeRecords.length,
        hrEmployees: hrEmployees.length,
        hrLeaveRequests: hrLeaveRequests.length,
        teamTasks: teamTasks.length,
        salesTargets: salesTargets.length,
      },
      data: {
        vehicles,
        users,
        sourcingRequests,
        quotations,
        orders,
        inquiries,
        documents,
        financeRecords,
        hrEmployees,
        hrLeaveRequests,
        teamTasks,
        salesTargets,
        companySettings: {
          companyName: settings.companyName,
          tagline: settings.tagline,
          officeAddress: settings.officeAddress,
          supportEmail: settings.supportEmail,
          whatsappPhone: settings.whatsappPhone,
          invoiceValidityDays: settings.invoiceValidityDays,
        },
      },
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auzio-traders-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Full database JSON backup downloaded');
  };

  // Sidebar Navigation Definition
  const navItems = useMemo(() => {
    const all: Array<{
      id: ConsoleSection;
      label: string;
      icon: typeof LayoutDashboard;
      moduleKey: AdminModuleKey;
      badge?: number;
    }> = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, moduleKey: 'dashboard' },
      {
        id: 'crm',
        label: 'CRM & Leads',
        icon: Users,
        moduleKey: 'crm',
        badge: inquiries.filter((i) => i.status === 'received').length || undefined,
      },
      { id: 'sales', label: 'Sales', icon: TrendingUp, moduleKey: 'sales' },
      { id: 'inventory', label: 'Inventory', icon: Car, moduleKey: 'inventory' },
      {
        id: 'auctions',
        label: 'Auctions',
        icon: Gavel,
        moduleKey: 'auctions',
        badge: sourcingRequests.filter((r) => r.status === 'new').length || undefined,
      },
      { id: 'orders', label: 'Orders', icon: Package, moduleKey: 'orders' },
      { id: 'logistics', label: 'Logistics', icon: Ship, moduleKey: 'logistics' },
      { id: 'accounts', label: 'Accounts', icon: CreditCard, moduleKey: 'accounts' },
      {
        id: 'hr',
        label: 'Human Resources',
        icon: Briefcase,
        moduleKey: 'hr',
        badge: hrLeaveRequests.filter((l) => l.status === 'pending').length || undefined,
      },
      { id: 'documents', label: 'Documents', icon: FileText, moduleKey: 'documents' },
      { id: 'reports', label: 'Reports', icon: FileBarChart2, moduleKey: 'reports' },
      { id: 'cms', label: 'Website CMS', icon: Globe, moduleKey: 'cms' },
      { id: 'ai', label: 'AI Assistant', icon: Bot, moduleKey: 'ai' },
      { id: 'users', label: 'Users & Roles', icon: Shield, moduleKey: 'users' },
      { id: 'integrations', label: 'API Integrations', icon: Radio, moduleKey: 'settings' },
      { id: 'settings', label: 'Settings', icon: Settings, moduleKey: 'settings' },
    ];
    return all.filter((item) => {
      if (item.id === 'integrations') {
        return (
          can('settings', 'view') ||
          can('logistics', 'edit') ||
          role === 'accounts' ||
          role === 'it' ||
          role === 'management' ||
          role === 'admin'
        );
      }
      return can(item.moduleKey, 'view');
    });
  }, [role, staffProfile, inquiries, sourcingRequests, hrLeaveRequests]);

  // Universal Search Results across all modules
  const universalResults = useMemo(() => {
    const q = universalSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: Array<{
      id: string;
      category: string;
      title: string;
      subtitle: string;
      section: ConsoleSection;
      onSelect?: () => void;
    }> = [];

    if (can('orders', 'view')) {
      for (const o of orders) {
        if (
          o.orderNumber.toLowerCase().includes(q) ||
          o.trackingCode.toLowerCase().includes(q) ||
          o.vehicleTitle.toLowerCase().includes(q) ||
          o.customerCompany.toLowerCase().includes(q) ||
          o.blNumber.toLowerCase().includes(q)
        ) {
          results.push({
            id: `ord-${o.id}`,
            category: 'Order',
            title: `${o.orderNumber} — ${o.vehicleTitle}`,
            subtitle: `${o.customerCompany} · ${TRADE_MILESTONE_META[o.milestone]?.shortLabel}`,
            section: 'orders',
            onSelect: () => selectOrderForEdit(o),
          });
        }
      }
    }

    if (can('inventory', 'view')) {
      for (const v of vehicles) {
        if (
          v.stockCode.toLowerCase().includes(q) ||
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.chassisCode.toLowerCase().includes(q)
        ) {
          results.push({
            id: `veh-${v.id}`,
            category: 'Vehicle',
            title: `${v.stockCode} — ${v.year} ${v.make} ${v.model}`,
            subtitle: `${v.status.toUpperCase()} · ${fmt(v.fobPriceUsd)}`,
            section: 'inventory',
            onSelect: () => setInvSearch(v.stockCode),
          });
        }
      }
    }

    if (can('crm', 'view')) {
      for (const u of users) {
        if (
          u.displayName.toLowerCase().includes(q) ||
          u.companyName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        ) {
          results.push({
            id: `usr-${u.uid}`,
            category: 'Contact',
            title: u.companyName || u.displayName,
            subtitle: `${u.email} · ${ROLE_METADATA[u.role]?.label || u.role}`,
            section: ROLE_METADATA[u.role]?.isStaff && can('users', 'view') ? 'users' : 'crm',
          });
        }
      }
      for (const inq of inquiries) {
        if (
          inq.buyerName.toLowerCase().includes(q) ||
          inq.trackingCode.toLowerCase().includes(q) ||
          inq.vehicleTitle.toLowerCase().includes(q)
        ) {
          results.push({
            id: `inq-${inq.id}`,
            category: 'Lead',
            title: `${inq.buyerName} — ${inq.vehicleTitle}`,
            subtitle: `${inq.trackingCode} · ${inq.destinationPortName}`,
            section: 'crm',
          });
        }
      }
    }

    if (can('accounts', 'view')) {
      for (const f of financeRecords) {
        if (
          f.referenceCode.toLowerCase().includes(q) ||
          f.counterpartyName.toLowerCase().includes(q)
        ) {
          results.push({
            id: `fin-${f.id}`,
            category: 'Finance',
            title: `${f.referenceCode} — ${f.counterpartyName}`,
            subtitle: `${f.type.toUpperCase()} · ${fmt(f.amountUsd)} (${f.status})`,
            section: 'accounts',
          });
        }
      }
    }

    if (can('hr', 'view')) {
      for (const emp of hrEmployees) {
        if (
          emp.fullName.toLowerCase().includes(q) ||
          emp.employeeCode.toLowerCase().includes(q) ||
          emp.department.toLowerCase().includes(q)
        ) {
          results.push({
            id: `emp-${emp.id}`,
            category: 'Employee',
            title: `${emp.fullName} (${emp.employeeCode})`,
            subtitle: `${emp.jobTitle} · ${emp.department}`,
            section: 'hr',
          });
        }
      }
    }

    return results.slice(0, 10);
  }, [universalSearch, orders, vehicles, users, inquiries, financeRecords, hrEmployees, role, staffProfile]);

  // Real-Time Permission-Scoped Notification Center
  const notifications = useMemo(() => {
    const list: Array<{
      id: string;
      category: string;
      title: string;
      detail: string;
      section: ConsoleSection;
      urgent?: boolean;
    }> = [];

    const unverifiedBuyers = users.filter(
      (u) => (u.role === 'customer' || u.role === 'dealer') && !u.verified
    );
    if (unverifiedBuyers.length > 0 && can('users', 'view')) {
      list.push({
        id: `n-kyc-${unverifiedBuyers.length}`,
        category: 'Registrations',
        title: `${unverifiedBuyers.length} buyer account${unverifiedBuyers.length === 1 ? '' : 's'} awaiting verification`,
        detail: 'Review KYC details in Approvals Center or Users & Roles.',
        section: 'dashboard',
      });
    }

    const newLeads = inquiries.filter((i) => i.status === 'received');
    if (newLeads.length > 0 && can('crm', 'view')) {
      list.push({
        id: `n-leads-${newLeads.length}`,
        category: 'CRM & Leads',
        title: `${newLeads.length} new buyer inquir${newLeads.length === 1 ? 'y' : 'ies'}`,
        detail: 'Waiting for sales follow-up and CIF confirmation.',
        section: 'crm',
      });
    }

    const newSourcing = sourcingRequests.filter((r) => r.status === 'new');
    if (newSourcing.length > 0 && can('auctions', 'view')) {
      list.push({
        id: `n-sourcing-${newSourcing.length}`,
        category: 'Auctions',
        title: `${newSourcing.length} open auction sourcing request${newSourcing.length === 1 ? '' : 's'}`,
        detail: 'Attach shortlisted Japanese auction lots & translated notes.',
        section: 'auctions',
      });
    }

    const approvedQuotes = quotations.filter((q) => q.status === 'approved');
    if (approvedQuotes.length > 0 && can('sales', 'view')) {
      list.push({
        id: `n-quotes-${approvedQuotes.length}`,
        category: 'Sales & Orders',
        title: `${approvedQuotes.length} customer-approved quotation${approvedQuotes.length === 1 ? '' : 's'}`,
        detail: 'Ready to convert into active Export Orders.',
        section: 'sales',
      });
    }

    const overdueFin = financeRecords.filter((f) => f.status === 'overdue');
    if (overdueFin.length > 0 && can('accounts', 'view')) {
      list.push({
        id: `n-overdue-${overdueFin.length}`,
        category: 'Finance Alert',
        title: `${overdueFin.length} overdue invoice${overdueFin.length === 1 ? '' : 's'}`,
        detail: 'Follow up with buyer for TT remittance confirmation.',
        section: 'accounts',
        urgent: true,
      });
    }

    const pendingPayments = financeRecords.filter(
      (f) => f.type === 'payment' && f.status === 'pending'
    );
    if (pendingPayments.length > 0 && can('accounts', 'view')) {
      list.push({
        id: `n-pay-${pendingPayments.length}`,
        category: 'Payments',
        title: `${pendingPayments.length} pending payment verification${pendingPayments.length === 1 ? '' : 's'}`,
        detail: 'Confirm bank wire receipt and mark reconciled.',
        section: 'accounts',
      });
    }

    const pendingLeaves = hrLeaveRequests.filter((l) => l.status === 'pending');
    if (pendingLeaves.length > 0 && can('hr', 'view')) {
      list.push({
        id: `n-leaves-${pendingLeaves.length}`,
        category: 'HR & Leave',
        title: `${pendingLeaves.length} pending HR leave request${pendingLeaves.length === 1 ? '' : 's'}`,
        detail: 'Awaiting manager approval or rejection.',
        section: 'hr',
      });
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const delayedOrders = orders.filter(
      (o) => o.etaDate && o.etaDate < todayIso && !['arrived_port', 'completed'].includes(o.milestone)
    );
    if (delayedOrders.length > 0 && can('logistics', 'view')) {
      list.push({
        id: `n-delay-${delayedOrders.length}`,
        category: 'Logistics',
        title: `${delayedOrders.length} shipment${delayedOrders.length === 1 ? '' : 's'} past ETA`,
        detail: 'Verify live vessel AIS status and notify consignee.',
        section: 'logistics',
        urgent: true,
      });
    }

    const pendingReviews = testimonials.filter((t) => !t.approved);
    if (pendingReviews.length > 0 && can('cms', 'view')) {
      list.push({
        id: `n-cms-${pendingReviews.length}`,
        category: 'Website CMS',
        title: `${pendingReviews.length} customer review${pendingReviews.length === 1 ? '' : 's'} pending approval`,
        detail: 'Publish verified buyer testimonials to storefront.',
        section: 'cms',
      });
    }

    if ((integrationConfig.errorLogs || []).some((e) => e.level === 'error') && can('settings', 'view')) {
      list.push({
        id: `n-api-err-${(integrationConfig.errorLogs || []).length}`,
        category: 'System Health',
        title: 'API integration warning logged',
        detail: 'Inspect ExchangeRate-API / AISStream logs in Integrations.',
        section: 'integrations',
      });
    }

    return list;
  }, [
    users,
    inquiries,
    sourcingRequests,
    quotations,
    hrLeaveRequests,
    financeRecords,
    orders,
    testimonials,
    integrationConfig.errorLogs,
    role,
    staffProfile,
  ]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !readNotificationIds.includes(n.id)),
    [notifications, readNotificationIds]
  );

  const handleDashboardQuickAction = (actionId: string) => {
    setQuickMenuOpen(false);
    switch (actionId) {
      case 'add_vehicle':
      case 'publish_vehicle':
        if (can('inventory', 'create')) {
          setEditingVehicle(null);
          setIsImportMode(false);
          setActiveSection('inventory');
          setVehicleModalOpen(true);
        } else {
          setActiveSection('inventory');
        }
        break;
      case 'add_customer':
      case 'add_lead':
        setActiveSection('crm');
        break;
      case 'create_quotation':
        setActiveSection('sales');
        break;
      case 'create_order':
        setActiveSection('orders');
        break;
      case 'proforma_invoice':
      case 'commercial_invoice':
      case 'record_payment':
      case 'record_expense':
        setActiveSection('accounts');
        break;
      case 'create_shipment':
        setActiveSection('logistics');
        break;
      case 'auction_bid':
        setActiveSection('auctions');
        break;
      case 'add_employee':
        setActiveSection('hr');
        break;
      case 'create_user':
        setActiveSection('users');
        break;
      case 'upload_document':
        setActiveSection('documents');
        break;
      case 'create_announcement':
      case 'update_website':
        setActiveSection('cms');
        break;
      case 'generate_report':
        setActiveSection('reports');
        break;
      default:
        setActiveSection('dashboard');
    }
  };

  const filteredVehicles = useMemo(() => {
    const q = invSearch.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (invStatusFilter !== 'ALL' && v.status !== invStatusFilter) return false;
      if (!q) return true;
      return (
        v.stockCode.toLowerCase().includes(q) ||
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.chassisCode.toLowerCase().includes(q)
      );
    });
  }, [vehicles, invSearch, invStatusFilter]);

  // Immediate Account Suspension Lockout
  if (staffProfile?.accountStatus === 'suspended') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-8 text-center space-y-5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-950">Account Access Suspended</h1>
          <p className="text-sm text-slate-600">
            Your Auzio Traders employee account has been suspended by Administration. All internal
            dashboard and database permissions have been revoked.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
            <button
              type="button"
              onClick={onExitConsole}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              Return to Website
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Restricted Fallback for non-staff visitors/customers
  if (!isAuthorizedStaff) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-950">Auzio Traders Admin Console</h1>
          <p className="text-sm text-slate-600">
            This management system is restricted to authorized Auzio Traders team members. Please
            sign in with your company account.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              type="button"
              onClick={onOpenStaffLogin}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              Sign In
            </button>
            <button
              type="button"
              onClick={onExitConsole}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              Return to Website
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeNavMeta = navItems.find((n) => n.id === activeSection) || navItems[0];
  const roleLabel =
    role !== 'visitor' ? ROLE_METADATA[role]?.label || role : 'Staff';

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Collapsible Vertical Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col bg-slate-950 text-slate-200 border-r border-slate-800 transition-all duration-200 shrink-0 ${
          sidebarCollapsed ? 'lg:w-[74px]' : 'lg:w-64'
        } w-64 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Auzio Traders"
              className="w-9 h-9 rounded-full object-cover bg-white border border-slate-700 shrink-0"
            />
            {!sidebarCollapsed && (
              <div className="leading-tight truncate">
                <div className="text-sm font-extrabold tracking-tight text-white truncate">
                  AUZIO <span className="text-amber-400">TRADERS</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">Management System</div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="hidden lg:flex p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!sidebarCollapsed && item.badge ? (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold font-mono rounded-md ${
                      isActive ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: User Profile & Exit */}
        <div className="p-3 border-t border-slate-800 space-y-2 shrink-0">
          {!sidebarCollapsed && (
            <div className="px-2 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800">
              <div className="text-xs font-bold text-white truncate">
                {staffProfile?.displayName || 'Team Member'}
              </div>
              <div className="text-[11px] text-amber-400 truncate">{roleLabel}</div>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onExitConsole}
              title="Return to Public Website"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              {!sidebarCollapsed && <span>Website</span>}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-2 text-slate-400 hover:text-red-400 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                Auzio Traders Admin Console
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white leading-tight truncate">
                {activeNavMeta?.label || 'Dashboard'}
              </h1>
            </div>
          </div>

          {/* Universal Search Bar */}
          <div className="relative flex-1 max-w-md hidden md:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={universalSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onChange={(e) => setUniversalSearch(e.target.value)}
              placeholder="Search orders, vehicles, customers, invoices, staff..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            />
            {searchFocused && universalSearch.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                {universalResults.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                    No matching records for &ldquo;{universalSearch}&rdquo;
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                    {universalResults.map((res) => (
                      <button
                        key={res.id}
                        type="button"
                        onMouseDown={() => {
                          setActiveSection(res.section);
                          res.onSelect?.();
                          setUniversalSearch('');
                          setSearchFocused(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-950 dark:text-white truncate">
                            {res.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {res.subtitle}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                          {res.category}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Controls: Connectivity, Live Clock, Quick Action, Notifications, Theme & Profile */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Real System Connectivity Indicator */}
            <button
              type="button"
              onClick={() => setActiveSection('integrations')}
              title={`Firestore: ${props.isLiveFirestoreMode ? 'Connected' : 'Local'} | FX API: ${liveFx.ok ? 'Online' : 'Offline'} | AIS: ${aisStatus?.connected ? 'Connected' : aisStatus?.state || 'Standby'}`}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  props.isLiveFirestoreMode && liveFx.ok
                    ? 'bg-emerald-500'
                    : props.isLiveFirestoreMode
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              <span>
                {props.isLiveFirestoreMode && liveFx.ok
                  ? 'Systems Online'
                  : props.isLiveFirestoreMode
                  ? 'Partial Sync'
                  : 'Offline Mode'}
              </span>
            </button>

            {/* Live Date & Time */}
            <div className="hidden 2xl:flex flex-col items-end text-[10px] font-mono leading-tight text-slate-500 dark:text-slate-400 px-1.5">
              <span>{nowClock.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {nowClock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Header Quick Action Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setQuickMenuOpen((o) => !o);
                  setNotificationsOpen(false);
                  setProfileMenuOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Quick Action</span>
              </button>
              {quickMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden text-xs">
                  <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 font-bold uppercase text-[10px] tracking-wider text-slate-500">
                    Launch Action
                  </div>
                  {[
                    ['add_vehicle', 'Add Vehicle to Stock'],
                    ['add_lead', 'Manage Leads / CRM'],
                    ['create_quotation', 'Create CIF Quotation'],
                    ['create_order', 'Manage Export Orders'],
                    ['record_payment', 'Record Payment / Expense'],
                    ['create_shipment', 'Assign Vessel Shipment'],
                    ['upload_document', 'Upload Export Document'],
                    ['create_user', 'Provision Employee User'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleDashboardQuickAction(id)}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Enhanced Notification Center */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((o) => !o);
                  setProfileMenuOpen(false);
                  setQuickMenuOpen(false);
                }}
                aria-label="Notifications"
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Notifications ({unreadNotifications.length} unread)
                    </span>
                    <div className="flex items-center gap-2">
                      {unreadNotifications.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setReadNotificationIds((prev) =>
                              Array.from(new Set([...prev, ...notifications.map((n) => n.id)]))
                            )
                          }
                          className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-5 text-xs text-slate-500 dark:text-slate-400 text-center">
                      All caught up — no pending operational alerts.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                      {notifications.map((n) => {
                        const isRead = readNotificationIds.includes(n.id);
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              setReadNotificationIds((prev) =>
                                prev.includes(n.id) ? prev : [...prev, n.id]
                              );
                              setActiveSection(n.section);
                              setNotificationsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                              isRead ? 'opacity-65' : 'bg-amber-50/30 dark:bg-amber-950/10'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider">
                              <span className={n.urgent ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}>
                                {n.category}
                              </span>
                              {!isRead && <span className="text-slate-500">Unread</span>}
                            </div>
                            <div className="text-xs font-bold text-slate-950 dark:text-white mt-0.5">
                              {n.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {n.detail}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Light mode' : 'Dark mode'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((o) => !o);
                  setNotificationsOpen(false);
                  setQuickMenuOpen(false);
                }}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="w-6 h-6 rounded-md bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-bold flex items-center justify-center">
                  {(staffProfile?.displayName || 'A').slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[110px] truncate">
                  {staffProfile?.displayName || 'Admin'}
                </span>
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden text-xs">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="font-bold text-slate-950 dark:text-white truncate">
                      {staffProfile?.displayName || 'Administrator'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{staffProfile?.email}</div>
                    <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                      {roleLabel} · {staffProfile?.department || 'Executive'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setActiveSection('settings');
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    System Settings & Security
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onExitConsole();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Return to Public Storefront
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold border-t border-slate-100 dark:border-slate-800 cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Active Module Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {/* 1. SUPER ADMIN BUSINESS COMMAND CENTER */}
          {activeSection === 'dashboard' && (
            <ExecutiveDashboardPanel
              role={role}
              staffProfile={staffProfile}
              currency={currency}
              fxRates={fxRates}
              settings={settings}
              liveFx={liveFx}
              aisStatus={aisStatus}
              integrationConfig={integrationConfig}
              isLiveFirestoreMode={props.isLiveFirestoreMode}
              vehicles={vehicles}
              users={users}
              sourcingRequests={sourcingRequests}
              quotations={quotations}
              orders={orders}
              inquiries={inquiries}
              financeRecords={financeRecords}
              hrEmployees={hrEmployees}
              leaveRequests={hrLeaveRequests}
              teamTasks={teamTasks}
              salesTargets={salesTargets}
              vessels={vessels}
              documents={documents}
              auditLogs={auditLogs}
              testimonials={testimonials}
              landingContent={landingContent}
              approvalHandlers={{
                onApprovePayment: async (rec) => {
                  await onUpdateFinanceStatus(rec.id, {
                    status: 'reconciled',
                    reconciled: true,
                    notes: `${rec.notes ? `${rec.notes} | ` : ''}Approved by ${staffProfile?.displayName || 'Super Admin'}`,
                  });
                },
                onRejectPayment: async (rec, reason) => {
                  await onUpdateFinanceStatus(rec.id, {
                    status: 'overdue',
                    reconciled: false,
                    notes: `REJECTED (${new Date().toISOString().slice(0, 10)}): ${reason}`,
                  });
                },
                onApproveLeave: async (req) => {
                  await onReviewHrLeave(req.id, 'approved');
                },
                onRejectLeave: async (req, reason) => {
                  await onReviewHrLeave(req.id, 'rejected', reason);
                },
                onApproveCustomerVerification: async (u) => {
                  await onUpdateUserRole(u.uid, {
                    role: u.role,
                    verified: true,
                    assignedRepName: u.assignedRepName || staffProfile?.displayName || 'Sales Desk',
                    assignedRepEmail: u.assignedRepEmail || staffProfile?.email || 'sales@auziotraders.com',
                    accountStatus: 'active',
                  });
                },
                onRejectCustomerVerification: async (u, reason) => {
                  await onUpdateUserRole(u.uid, {
                    role: u.role,
                    verified: false,
                    assignedRepName: u.assignedRepName || '',
                    assignedRepEmail: u.assignedRepEmail || '',
                    accountStatus: 'suspended',
                  });
                  onNotify(`Verification rejected for ${u.displayName}: ${reason}`);
                },
                onApproveTestimonial: async (t) => {
                  await onSaveTestimonial(
                    {
                      customerName: t.customerName,
                      country: t.country,
                      vehiclePurchased: t.vehiclePurchased,
                      photoUrl: t.photoUrl,
                      rating: t.rating,
                      reviewText: t.reviewText,
                      verified: true,
                      approved: true,
                    },
                    t.id
                  );
                },
                onRejectTestimonial: async (t, reason) => {
                  await onDeleteTestimonial(t.id);
                  onNotify(`Testimonial rejected & removed: ${reason}`);
                },
                onConvertApprovedQuote: async (q) => {
                  await onConvertQuoteToOrder(q);
                },
                onRequestApprovalInfo: async (title, details, assignee) => {
                  await onCreateTeamTask({
                    title: title.slice(0, 140),
                    description: details.slice(0, 800),
                    department: 'Management',
                    assignedToName: assignee || staffProfile?.displayName || 'Operations',
                    priority: 'high',
                    status: 'todo',
                    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
                    createdByUid: staffProfile?.uid || 'admin',
                    createdByName: staffProfile?.displayName || 'Super Admin',
                  });
                  onNotify(`Follow-up task created requesting additional details for "${title}"`);
                },
              }}
              onCreateTask={onCreateTeamTask}
              onUpdateTaskDetails={onUpdateTeamTaskDetails}
              onRefreshDashboard={async () => {
                await Promise.allSettled([onRefreshFx(), onRefreshAisStatus()]);
                onNotify('Dashboard synced with live ExchangeRate-API, AIS & Firestore feeds');
              }}
              onRefreshFx={onRefreshFx}
              onRefreshAis={onRefreshAisStatus}
              onNavigateSection={(sec, opts) => {
                if (opts?.search) {
                  if (sec === 'inventory') setInvSearch(opts.search);
                }
                setActiveSection(sec as ConsoleSection);
              }}
              onQuickAction={handleDashboardQuickAction}
              onGenerateDailyAiReport={() => {
                setAiPreset({
                  tool: 'daily_report',
                  prompt:
                    'Generate today’s Daily Business Report covering pending quotations, shipping pipeline, and top 3 priorities.',
                });
                setActiveSection('ai');
              }}
              onDownloadBackup={handleDownloadFullBackup}
            />
          )}

          {/* 2. CRM & LEADS */}
          {activeSection === 'crm' && (
            <CrmSalesPanel
              mode="crm"
              currency={currency}
              fxRates={fxRates}
              users={users}
              inquiries={inquiries}
              sourcingRequests={sourcingRequests}
              quotations={quotations}
              orders={orders}
              vehicles={vehicles}
              salesTargets={salesTargets}
              canCreate={can('crm', 'create')}
              canEdit={can('crm', 'edit')}
              canDelete={can('crm', 'delete')}
              canExport={can('crm', 'export')}
              onUpdateInquiry={onUpdateInquiry}
              onCreateQuotation={onCreateQuotation}
              onConvertQuoteToOrder={onConvertQuoteToOrder}
              onSaveSalesTarget={onSaveSalesTarget}
              onDeleteSalesTarget={onDeleteSalesTarget}
              onOpenAiFollowup={(prompt) => {
                setAiPreset({ tool: 'sales_followup', prompt });
                setActiveSection('ai');
              }}
            />
          )}

          {/* 3. SALES DEPARTMENT */}
          {activeSection === 'sales' && (
            <CrmSalesPanel
              mode="sales"
              currency={currency}
              fxRates={fxRates}
              users={users}
              inquiries={inquiries}
              sourcingRequests={sourcingRequests}
              quotations={quotations}
              orders={orders}
              vehicles={vehicles}
              salesTargets={salesTargets}
              canCreate={can('sales', 'create')}
              canEdit={can('sales', 'edit')}
              canDelete={can('sales', 'delete')}
              canExport={can('sales', 'export')}
              onUpdateInquiry={onUpdateInquiry}
              onCreateQuotation={onCreateQuotation}
              onConvertQuoteToOrder={onConvertQuoteToOrder}
              onSaveSalesTarget={onSaveSalesTarget}
              onDeleteSalesTarget={onDeleteSalesTarget}
              onOpenAiFollowup={(prompt) => {
                setAiPreset({ tool: 'sales_followup', prompt });
                setActiveSection('ai');
              }}
            />
          )}

          {/* 4. INVENTORY MANAGEMENT */}
          {activeSection === 'inventory' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
                    Inventory Management
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Manage yard stock, auction listings, partner inventory, pricing, and availability.
                  </p>
                </div>
                {can('inventory', 'create') && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVehicle(null);
                      setIsImportMode(false);
                      setVehicleModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Vehicle
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    placeholder="Filter by stock code, make, model, chassis..."
                    className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1">
                  {(['ALL', 'available', 'reserved', 'sold', 'archived'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setInvStatusFilter(st)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize cursor-pointer ${
                        invStatusFilter === st
                          ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {st === 'ALL' ? `All (${vehicles.length})` : st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Vehicle</th>
                      <th className="px-4 py-3">Type &amp; Port</th>
                      <th className="px-4 py-3">Specs</th>
                      <th className="px-4 py-3">FOB Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredVehicles.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {v.images[0] && (
                              <img
                                src={v.images[0]}
                                alt={v.model}
                                className="w-14 h-10 object-cover rounded-md border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                            )}
                            <div>
                              <div className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                                {v.stockCode}
                              </div>
                              <div className="font-bold text-slate-950 dark:text-white">
                                {v.year} {v.make} {v.model}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                          <div className="capitalize">{v.listingType.replace('_', ' ')}</div>
                          <div className="text-slate-400">{v.originPort}</div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-300">
                          <div>{v.mileageKm.toLocaleString()} km</div>
                          <div className="text-slate-400">
                            Grade {v.auctionReport.exteriorGrade} · {v.chassisCode}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-950 dark:text-white">
                          {fmt(v.fobPriceUsd)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold uppercase rounded ${
                              v.status === 'available'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : v.status === 'reserved'
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {can('inventory', 'edit') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingVehicle(v);
                                    setIsImportMode(false);
                                    setVehicleModalOpen(true);
                                  }}
                                  title="Edit vehicle"
                                  className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onArchiveVehicle(v)}
                                  title={v.status === 'archived' ? 'Restore vehicle' : 'Archive vehicle'}
                                  className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {can('inventory', 'delete') &&
                              (confirmDeleteVehId === v.id ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onDeleteVehicle(v.id);
                                    setConfirmDeleteVehId(null);
                                  }}
                                  className="px-2 py-1 text-xs font-bold text-white bg-red-600 rounded cursor-pointer"
                                >
                                  Confirm
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteVehId(v.id)}
                                  title="Delete vehicle"
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. AUCTION MANAGEMENT */}
          {activeSection === 'auctions' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
                    Auction Management
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Process buyer sourcing requests, enforce Max Bid Ceiling approvals, and import
                    live Japanese auction lots.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'sourcing', label: `Sourcing Requests (${sourcingRequests.length})` },
                    { id: 'bidding', label: 'Bid Approvals & Guard' },
                    { id: 'import', label: 'Live Auction Import' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAuctionSubTab(t.id as 'import' | 'sourcing' | 'bidding')}
                      className={`px-3.5 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
                        auctionSubTab === t.id
                          ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {auctionSubTab === 'import' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                  <StaffAuctionImportPanel
                    currency={currency}
                    settings={settings}
                    onImportLot={(lot) => {
                      setEditingVehicle(lot);
                      setIsImportMode(true);
                      setVehicleModalOpen(true);
                    }}
                  />
                </div>
              )}

              {auctionSubTab === 'bidding' && (
                <div className="max-w-2xl bg-slate-950 text-white rounded-2xl p-6 space-y-5 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>SERVER-ENFORCED MAX BID CEILING GUARD</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Submit a live Japanese auction bid for an approved export order. Any bid above
                    the customer&apos;s authorized ceiling is blocked automatically and logged to
                    the immutable Audit Trail.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Target Export Order</label>
                      <select
                        value={bidOrderId}
                        onChange={(e) => {
                          setBidOrderId(e.target.value);
                          setBidGuardResult(null);
                        }}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white"
                      >
                        {orders.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.orderNumber} — {o.vehicleStockCode} (Authorized Ceiling: $
                            {o.authorizedMaxBidUsd.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Proposed Auction Bid (USD)
                      </label>
                      <input
                        type="number"
                        min={500}
                        step={100}
                        value={bidAmountUsd}
                        onChange={(e) => setBidAmountUsd(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 text-base font-mono bg-slate-900 border border-slate-700 rounded-lg text-white"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!can('auctions', 'approve')}
                      onClick={async () => {
                        const target = orders.find((o) => o.id === bidOrderId);
                        if (!target) return;
                        const res = await onPlaceAuctionBid(target, bidAmountUsd);
                        setBidGuardResult({
                          ok: res.ok,
                          text: res.ok
                            ? `Bid of $${bidAmountUsd.toLocaleString()} USD approved within $${target.authorizedMaxBidUsd.toLocaleString()} ceiling and logged.`
                            : res.error || 'Bid blocked.',
                        });
                      }}
                      className="w-full py-2.5 px-4 text-sm font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      Validate &amp; Submit Auction Bid
                    </button>
                    {bidGuardResult && (
                      <div
                        className={`p-3.5 rounded-lg text-xs flex items-start gap-2 ${
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
              )}

              {auctionSubTab === 'sourcing' && (
                <div className="space-y-4">
                  {sourcingRequests.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500">
                      No buyer sourcing requests yet.
                    </div>
                  ) : (
                    sourcingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                          <div>
                            <div className="text-xs font-mono text-amber-700 dark:text-amber-400 font-semibold">
                              {req.requestCode} · {req.customerCompany} ({req.customerName})
                            </div>
                            <h3 className="text-base font-bold text-slate-950 dark:text-white mt-0.5">
                              {req.yearMin}–{req.yearMax} {req.make} {req.model} (Qty {req.quantity})
                            </h3>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              Budget Ceiling: <strong className="font-mono">{fmt(req.maxBudgetUsd)}</strong> ·
                              Max {req.mileageMaxKm.toLocaleString()} km · Grade {req.gradePref} ·
                              Port: {getPortById(req.destinationPortId).name}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 text-xs font-semibold uppercase rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                            {req.status.replace('_', ' ')}
                          </span>
                        </div>

                        {req.options.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {req.options.map((o) => (
                              <div
                                key={o.id}
                                className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs space-y-1"
                              >
                                <div className="flex justify-between font-semibold text-slate-950 dark:text-white">
                                  <span>{o.title}</span>
                                  <span className="font-mono text-amber-700 dark:text-amber-400">
                                    {fmt(o.estFobUsd)}
                                  </span>
                                </div>
                                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                  {o.auctionHouse} Lot #{o.lotNumber} · Grade {o.grade} ·{' '}
                                  {o.mileageKm.toLocaleString()} km
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                  {o.translatedNotes}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {can('auctions', 'edit') &&
                          (optReqId === req.id ? (
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
                              className="p-4 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <input
                                  type="text"
                                  required
                                  value={optTitle}
                                  onChange={(e) => setOptTitle(e.target.value)}
                                  placeholder="Vehicle Title"
                                  className="px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md"
                                />
                                <input
                                  type="text"
                                  required
                                  value={optHouse}
                                  onChange={(e) => setOptHouse(e.target.value)}
                                  placeholder="Auction House"
                                  className="px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md"
                                />
                                <input
                                  type="text"
                                  required
                                  value={optLot}
                                  onChange={(e) => setOptLot(e.target.value)}
                                  placeholder="Lot Number"
                                  className="px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md"
                                />
                                <input
                                  type="text"
                                  value={optGrade}
                                  onChange={(e) => setOptGrade(e.target.value)}
                                  placeholder="Grade (4.5 / A)"
                                  className="px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md"
                                />
                                <input
                                  type="number"
                                  value={optMileage}
                                  onChange={(e) => setOptMileage(Number(e.target.value))}
                                  placeholder="Mileage km"
                                  className="px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md"
                                />
                                <input
                                  type="number"
                                  value={optFob}
                                  onChange={(e) => setOptFob(Number(e.target.value))}
                                  placeholder="Est FOB USD"
                                  className="px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md"
                                />
                              </div>
                              <textarea
                                rows={2}
                                required
                                value={optNotes}
                                onChange={(e) => setOptNotes(e.target.value)}
                                placeholder="Translated Japanese auction inspector sheet notes..."
                                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 rounded-md cursor-pointer"
                                >
                                  Send Option to Buyer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOptReqId('')}
                                  className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setOptReqId(req.id)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Attach Shortlisted Auction Option
                            </button>
                          ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* 6. ORDERS MANAGEMENT */}
          {activeSection === 'orders' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
                  Export Orders
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Track every export order across all 14 milestones and exchange customer or
                  internal staff notes.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-2.5">
                  {orders.map((ord) => (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => selectOrderForEdit(ord)}
                      className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                        selectedOrder?.id === ord.id
                          ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950 border-slate-950 dark:border-amber-500'
                          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`text-xs font-mono font-bold ${
                          selectedOrder?.id === ord.id
                            ? 'text-amber-400 dark:text-slate-900'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {ord.orderNumber} · {ord.trackingCode}
                      </div>
                      <div className="text-sm font-bold mt-0.5">{ord.vehicleTitle}</div>
                      <div className="text-xs opacity-75 mt-0.5">
                        {ord.customerCompany} · {TRADE_MILESTONE_META[ord.milestone]?.shortLabel}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="lg:col-span-8 space-y-6">
                  {selectedOrder ? (
                    <>
                      {/* 9-Step Cross-Department Collaboration Workflow on One Unified Order Record */}
                      {(() => {
                        const milestoneStepMap: Record<TradeOrderMilestone, number> = {
                          request_received: 0,
                          options_prepared: 1,
                          quotation_sent: 1,
                          customer_approved: 2,
                          bid_placed: 4,
                          vehicle_purchased: 4,
                          payment_pending: 3,
                          payment_received: 3,
                          vehicle_in_yard: 5,
                          export_docs_ready: 5,
                          shipment_booked: 6,
                          shipped: 6,
                          arrived_port: 7,
                          completed: 8,
                        };
                        const activeCollabIdx = milestoneStepMap[selectedOrder.milestone] ?? 0;
                        const collabSteps = [
                          { step: 1, dept: 'Customer', label: 'Request' },
                          { step: 2, dept: 'Sales Exec', label: 'Quotation' },
                          { step: 3, dept: 'Sales Mgr', label: 'Approval' },
                          { step: 4, dept: 'Accounts', label: 'Invoice & TT' },
                          { step: 5, dept: 'Purchasing', label: 'Auction Buy' },
                          { step: 6, dept: 'Operations', label: 'Inspect & Docs' },
                          { step: 7, dept: 'Logistics', label: 'Vessel & B/L' },
                          { step: 8, dept: 'Customer', label: 'Track & Docs' },
                          { step: 9, dept: 'Owner', label: 'Profit Audit' },
                        ];
                        const directCostUsd =
                          (selectedOrder.fobUsd || 0) +
                          (selectedOrder.freightUsd || 0) +
                          (selectedOrder.inspectionUsd || 0) +
                          (selectedOrder.insuranceUsd || 0);
                        const orderMarginUsd = Math.max(
                          0,
                          (selectedOrder.totalCifUsd || 0) - directCostUsd
                        );
                        const showProfit = canViewCompanyProfit(role, staffProfile);

                        return (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                  Cross-Department Collaboration Workflow
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  All departments collaborate on one single live order record (
                                  {selectedOrder.orderNumber})
                                </div>
                              </div>
                              {showProfit ? (
                                <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs">
                                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                                    Est. Net Margin (Owner/Accounts):{' '}
                                  </span>
                                  <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200">
                                    {fmt(orderMarginUsd)}
                                  </span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                                  Profit Restricted (Owner &amp; Accounts Only)
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
                              {collabSteps.map((s, idx) => {
                                const done = idx < activeCollabIdx;
                                const current = idx === activeCollabIdx;
                                return (
                                  <div
                                    key={s.step}
                                    className={`p-2 rounded-lg border text-center transition-colors ${
                                      current
                                        ? 'bg-amber-500 border-amber-500 text-slate-950'
                                        : done
                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-300'
                                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    <div className="text-[10px] font-mono font-bold">
                                      {done ? '✓' : s.step}. {s.dept}
                                    </div>
                                    <div className="text-[10px] font-semibold truncate mt-0.5">
                                      {s.label}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

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
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                          <div>
                            <h3 className="text-base font-bold text-slate-950 dark:text-white">
                              {selectedOrder.orderNumber} — {selectedOrder.vehicleTitle}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {selectedOrder.customerCompany} · {selectedOrder.destinationPortName} ·
                              CIF {fmt(selectedOrder.totalCifUsd)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Order Milestone (14-Stage Pipeline)
                            </label>
                            <select
                              value={editMilestone}
                              onChange={(e) =>
                                setEditMilestone(e.target.value as TradeOrderMilestone)
                              }
                              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            >
                              {TRADE_MILESTONE_ORDER.map((m, idx) => (
                                <option key={m} value={m}>
                                  {idx + 1}. {TRADE_MILESTONE_META[m].label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Vessel Name
                            </label>
                            <input
                              type="text"
                              value={editVessel}
                              onChange={(e) => setEditVessel(e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Bill of Lading (B/L) #
                            </label>
                            <input
                              type="text"
                              value={editBl}
                              onChange={(e) => setEditBl(e.target.value)}
                              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              ETD Date
                            </label>
                            <input
                              type="date"
                              value={editEtd}
                              onChange={(e) => setEditEtd(e.target.value)}
                              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              ETA Date
                            </label>
                            <input
                              type="date"
                              value={editEta}
                              onChange={(e) => setEditEta(e.target.value)}
                              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>

                        {can('orders', 'edit') && (
                          <button
                            type="submit"
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 rounded-lg cursor-pointer"
                          >
                            Save Order &amp; Sync Public Tracker
                          </button>
                        )}
                      </form>

                      {/* Order Messages */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                        <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-amber-600" />
                          Order Communication Thread
                        </h3>
                        <div className="space-y-2.5 max-h-64 overflow-y-auto">
                          {messages
                            .filter((m) => m.orderId === selectedOrder.id)
                            .map((m) => (
                              <div
                                key={m.id}
                                className={`p-3 rounded-lg text-xs border ${
                                  m.isInternalStaffOnly
                                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {m.senderName} ({m.senderRole})
                                  </span>
                                  <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                                    {m.isInternalStaffOnly ? 'Internal Only' : 'Customer Visible'}
                                  </span>
                                </div>
                                <p className="text-slate-700 dark:text-slate-200">{m.body}</p>
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
                          className="space-y-2.5"
                        >
                          <div className="flex items-center gap-4 text-xs">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={staffMsgInternal}
                                onChange={(e) => setStaffMsgInternal(e.target.checked)}
                                className="accent-amber-600"
                              />
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Internal Staff Note (Hidden from Buyer)
                              </span>
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={staffMsgBody}
                              onChange={(e) => setStaffMsgBody(e.target.value)}
                              placeholder="Post an order update or internal logistics note..."
                              className="flex-1 px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 rounded-lg cursor-pointer"
                            >
                              <Send className="w-4 h-4" />
                              Post
                            </button>
                          </div>
                        </form>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500">
                      No export orders recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 7. OPERATIONS & LOGISTICS */}
          {activeSection === 'logistics' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
                  Operations &amp; Logistics Desk
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Monitor yard inspections, export certificates, vessel schedules, B/L numbers, and
                  port arrivals.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: 'In Yard / Inspection',
                    count: orders.filter((o) =>
                      ['vehicle_in_yard', 'export_docs_ready'].includes(o.milestone)
                    ).length,
                  },
                  {
                    label: 'Vessel Booked',
                    count: orders.filter((o) => o.milestone === 'shipment_booked').length,
                  },
                  {
                    label: 'On Water (Shipped)',
                    count: orders.filter((o) => o.milestone === 'shipped').length,
                  },
                  {
                    label: 'Arrived / Delivered',
                    count: orders.filter((o) =>
                      ['arrived_port', 'completed'].includes(o.milestone)
                    ).length,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
                  >
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {stat.label}
                    </div>
                    <div className="text-2xl font-extrabold font-mono text-slate-950 dark:text-white mt-1">
                      {stat.count}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Order &amp; Vehicle</th>
                      <th className="px-4 py-3">Destination Port</th>
                      <th className="px-4 py-3">Vessel &amp; Voyage</th>
                      <th className="px-4 py-3">B/L Number</th>
                      <th className="px-4 py-3">ETD / ETA</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3.5">
                          <div className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                            {o.orderNumber}
                          </div>
                          <div className="font-semibold text-slate-950 dark:text-white">
                            {o.vehicleTitle}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                          <div>{o.destinationPortName}</div>
                          <div className="uppercase text-slate-400">{o.shippingMethod}</div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-700 dark:text-slate-300">
                          <div>{o.vesselName || 'Pending Booking'}</div>
                          <div className="font-mono text-slate-400">{o.voyageNumber || '—'}</div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {o.blNumber || 'Pending'}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-300">
                          <div>ETD: {o.etdDate || 'TBD'}</div>
                          <div>ETA: {o.etaDate || 'TBD'}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300">
                            {TRADE_MILESTONE_META[o.milestone]?.shortLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              selectOrderForEdit(o);
                              setActiveSection('orders');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
                          >
                            Update Vessel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. ACCOUNTS & FINANCE */}
          {activeSection === 'accounts' && (
            <AccountsFinancePanel
              currency={currency}
              fxRates={fxRates}
              staffProfile={staffProfile}
              orders={orders}
              financeRecords={financeRecords}
              canCreate={can('accounts', 'create')}
              canEdit={can('accounts', 'edit')}
              canDelete={can('accounts', 'delete')}
              canExport={can('accounts', 'export')}
              onCreateRecord={onCreateFinanceRecord}
              onUpdateStatus={onUpdateFinanceStatus}
              onDeleteRecord={onDeleteFinanceRecord}
            />
          )}

          {/* 9. HUMAN RESOURCES */}
          {activeSection === 'hr' && (
            <HrManagementPanel
              currency={currency}
              fxRates={fxRates}
              staffProfile={staffProfile}
              employees={hrEmployees}
              leaveRequests={hrLeaveRequests}
              canCreate={can('hr', 'create')}
              canEdit={can('hr', 'edit')}
              canDelete={can('hr', 'delete')}
              canApprove={can('hr', 'approve')}
              onSaveEmployee={onSaveHrEmployee}
              onDeleteEmployee={onDeleteHrEmployee}
              onCreateLeaveRequest={onCreateHrLeave}
              onReviewLeave={onReviewHrLeave}
            />
          )}

          {/* 10. DOCUMENT MANAGEMENT */}
          {activeSection === 'documents' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
                  Export Document Vault
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Manage Proforma Invoices, Bills of Lading, JEVIC/QISJ Inspection Reports, and
                  Export Certificates with customer visibility controls.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {can('documents', 'create') && (
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
                        fileName: docFileName || `${docTitle.replace(/\s+/g, '_')}.pdf`,
                        fileUrl: docUrl || 'https://auziotraders.com/docs/verified',
                        isCustomerVisible: docVisible,
                        notes: docNotes,
                      });
                      setDocTitle('');
                      setDocFileName('');
                      setDocUrl('');
                      setDocNotes('');
                    }}
                    className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5 h-fit"
                  >
                    <h3 className="text-base font-bold text-slate-950 dark:text-white">
                      Register Export Document
                    </h3>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Linked Export Order
                      </label>
                      <select
                        value={docOrderId}
                        onChange={(e) => setDocOrderId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      >
                        {orders.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.orderNumber} — {o.customerCompany}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Document Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        placeholder="e.g. Original Bill of Lading"
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Document Category
                      </label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value as ExportDocType)}
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      >
                        <option value="proforma_invoice">Proforma Invoice</option>
                        <option value="bill_of_lading">Bill of Lading (B/L)</option>
                        <option value="export_certificate">Export Certificate</option>
                        <option value="inspection_report">Inspection Report (JEVIC/QISJ)</option>
                        <option value="auction_sheet">Auction Sheet</option>
                        <option value="commercial_invoice">Commercial Invoice</option>
                        <option value="internal_cost_sheet">Internal Cost Sheet</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        File URL / Storage Link
                      </label>
                      <input
                        type="url"
                        value={docUrl}
                        onChange={(e) => setDocUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={docVisible}
                        onChange={(e) => setDocVisible(e.target.checked)}
                        className="accent-amber-600"
                      />
                      Release immediately to Customer Portal
                    </label>
                    <button
                      type="submit"
                      className="w-full py-2.5 text-sm font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 rounded-lg cursor-pointer"
                    >
                      Save Document Record
                    </button>
                  </form>
                )}

                <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
                  {documents.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                      No export documents registered yet.
                    </div>
                  ) : (
                    documents.map((d) => (
                      <div
                        key={d.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                            {d.orderNumber} · {d.docType.replace(/_/g, ' ').toUpperCase()}
                          </div>
                          <div className="text-sm font-bold text-slate-950 dark:text-white">
                            {d.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {d.fileName} · Uploaded by {d.uploadedByName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {d.fileUrl && (
                            <a
                              href={d.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                              title="Open document"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          {can('documents', 'edit') && (
                            <button
                              type="button"
                              onClick={() => void onToggleDocVisibility(d, !d.isCustomerVisible)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                                d.isCustomerVisible
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {d.isCustomerVisible ? (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  Customer Visible
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  Staff Only
                                </>
                              )}
                            </button>
                          )}
                          {can('documents', 'delete') && (
                            <button
                              type="button"
                              onClick={() => void onDeleteDocument(d.id)}
                              aria-label="Delete document"
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 11. REPORTS, TASKS & TEAM MESSAGING */}
          {activeSection === 'reports' && (
            <ReportsTasksHubPanel
              currency={currency}
              fxRates={fxRates}
              staffProfile={staffProfile}
              vehicles={vehicles}
              orders={orders}
              inquiries={inquiries}
              financeRecords={financeRecords}
              teamTasks={teamTasks}
              teamMessages={teamMessages}
              canCreate={can('reports', 'create')}
              canEdit={can('reports', 'create')}
              canDelete={can('reports', 'delete') || role === 'admin'}
              canExport={can('reports', 'export')}
              onCreateTask={onCreateTeamTask}
              onUpdateTaskStatus={onUpdateTeamTaskStatus}
              onDeleteTask={onDeleteTeamTask}
              onPostTeamMessage={onPostTeamMessage}
              onDownloadFullBackup={handleDownloadFullBackup}
            />
          )}

          {/* 12. WEBSITE CMS */}
          {activeSection === 'cms' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <AdminCmsPanel
                landingContent={landingContent}
                testimonials={testimonials}
                onSaveLandingContent={onSaveLandingContent}
                onSaveTestimonial={onSaveTestimonial}
                onDeleteTestimonial={onDeleteTestimonial}
              />
            </div>
          )}

          {/* 13. AI & AUTOMATION ASSISTANT */}
          {activeSection === 'ai' && (
            <AiAutomationPanel
              key={`${aiPreset.tool}-${aiPreset.prompt.slice(0, 20)}`}
              vehicles={vehicles}
              users={users}
              sourcingRequests={sourcingRequests}
              quotations={quotations}
              orders={orders}
              inquiries={inquiries}
              financeRecords={financeRecords}
              initialTool={aiPreset.tool}
              initialPrompt={aiPreset.prompt}
            />
          )}

          {/* 14. USERS, ROLES, INVITATIONS & GRANULAR PERMISSIONS */}
          {activeSection === 'users' && (
            <UsersPermissionsPanel
              users={users}
              staffInvitations={staffInvitations}
              currentUserUid={staffProfile?.uid}
              currentUserEmail={staffProfile?.email}
              canCreate={can('users', 'create') || role === 'admin' || role === 'management'}
              canEdit={can('users', 'edit')}
              onUpdateUser={onUpdateUserRole}
              onCreateInvitation={onCreateStaffInvitation}
              onRevokeInvitation={onRevokeStaffInvitation}
            />
          )}

          {/* 15. API INTEGRATIONS (EXCHANGE RATE API & AISSTREAM VESSEL TRACKING) */}
          {activeSection === 'integrations' && (
            <ApiIntegrationsPanel
              role={role}
              canEditSettings={
                can('settings', 'edit') ||
                role === 'accounts' ||
                role === 'it' ||
                role === 'management' ||
                role === 'admin'
              }
              canEditLogistics={
                can('logistics', 'edit') ||
                role === 'operations' ||
                role === 'management' ||
                role === 'admin'
              }
              liveFx={liveFx}
              fxCache={fxCache}
              integrationConfig={integrationConfig}
              vessels={vessels}
              aisStatus={aisStatus}
              orders={orders}
              onRefreshFx={onRefreshFx}
              onSaveFxMargins={onSaveFxMargins}
              onSaveIntegrationConfig={onSaveIntegrationConfig}
              onSaveVessel={onSaveVessel}
              onDeleteVessel={onDeleteVessel}
              onManualVesselUpdate={onManualVesselUpdate}
              onAssignOrderToVessel={onAssignOrderToVessel}
              onRefreshAisStatus={onRefreshAisStatus}
              onPersistLiveAisToFirestore={onPersistLiveAisToFirestore}
              onNotify={onNotify}
            />
          )}

          {/* 16. SETTINGS, AUTOMATIC FX, PROTECTED BANKING & AUDIT */}
          {activeSection === 'settings' && (
            <AdminSettingsPanel
              role={role}
              settings={settings}
              liveFx={liveFx}
              auditLogs={auditLogs}
              canEditSettings={can('settings', 'edit')}
              canViewBanking={can('banking', 'view')}
              canEditBanking={can('banking', 'edit')}
              canExport={can('settings', 'export')}
              onRefreshFx={() => void onRefreshFx()}
              onSaveCompanyProfile={onSaveSettings}
              onSaveBankingDetails={onSaveBankingDetails}
              onDownloadFullBackup={handleDownloadFullBackup}
              onSeedDatabase={onSeedDatabase}
              onClearSampleData={onClearSampleData}
            />
          )}
        </main>
      </div>

      {/* Add / Edit / Import Vehicle Modal */}
      {vehicleModalOpen && (
        <AdminVehicleModal
          vehicle={editingVehicle}
          isImportMode={isImportMode}
          onClose={() => {
            setVehicleModalOpen(false);
            setEditingVehicle(null);
            setIsImportMode(false);
          }}
          onSaved={(msg) => {
            onNotify(msg);
            setVehicleModalOpen(false);
            setEditingVehicle(null);
            setIsImportMode(false);
          }}
        />
      )}
    </div>
  );
}
