import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { CheckCircle2, GitCompare, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminVehicleModal } from './components/AdminVehicleModal';
import { ComparisonModal } from './components/ComparisonModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FloatingUtilities } from './components/FloatingUtilities';
import { Footer } from './components/Footer';
import { LegalPolicyModal, type LegalPolicyType } from './components/LegalPolicyModal';
import { Navbar } from './components/Navbar';
import { ProformaInvoiceModal } from './components/ProformaInvoiceModal';
import { QuickQuoteModal } from './components/QuickQuoteModal';
import { UniversalLoginModal } from './components/UniversalLoginModal';
import { VehicleDetailModal } from './components/VehicleDetailModal';
import { WorkflowStatusModal } from './components/WorkflowStatusModal';
import { DEFAULT_LANDING_CONTENT } from './data/landingDefaults';
import { hasModulePermission, isStaffRole } from './data/permissions';
import { calculateCif } from './data/ports';
import {
  DEFAULT_COMPANY_SETTINGS,
  DEMO_USERS,
  SEED_AUDIT_LOGS,
  SEED_DOCUMENTS,
  SEED_MESSAGES,
  SEED_ORDERS,
  SEED_QUOTATIONS,
  SEED_SOURCING_REQUESTS,
  SEED_VEHICLES,
} from './data/seedData';
import {
  getWorldCountryByCode,
  getWorldCountryByPortId,
} from './data/worldCountriesPorts';
import { auth, googleProvider } from './lib/firebase';
import {
  applyExchangeMargins,
  fetchLiveExchangeRates,
  isFirestoreFxCacheStale,
} from './services/exchangeRateService';
import {
  adminUpdateUser,
  claimPendingStaffInvitation,
  clearSampleTradeData,
  convertQuotationToOrder,
  createExportDocument,
  createFinanceRecord,
  createHrLeaveRequest,
  createQuotation,
  createSourcingRequest,
  createStaffInvitation,
  createTeamTask,
  DEFAULT_API_INTEGRATION_CONFIG,
  deleteExportDocument,
  deleteFinanceRecord,
  deleteHrEmployee,
  deleteSalesTarget,
  deleteTeamTask,
  deleteTestimonial,
  deleteVehicle,
  deleteVessel,
  getUserProfile,
  placeAuctionBidWithGuard,
  postOrderMessage,
  postTeamChannelMessage,
  recordAuditLog,
  registerCustomerProfile,
  respondToQuotation,
  reviewHrLeaveRequest,
  revokeStaffInvitation,
  saveApiIntegrationConfig,
  saveBankingDetailsProtected,
  saveCompanySettings,
  saveExchangeRateCache,
  saveHrEmployee,
  saveLandingContent,
  saveSalesTarget,
  saveTestimonial,
  saveVessel,
  seedFullTradeDatabase,
  submitBuyerInquiry,
  subscribeApiIntegrationConfig,
  subscribeAuditLogs,
  subscribeCompanySettings,
  subscribeDocuments,
  subscribeExchangeRateCache,
  subscribeFinanceRecords,
  subscribeHrEmployees,
  subscribeHrLeaveRequests,
  subscribeInquiries,
  subscribeLandingContent,
  subscribeOrderMessages,
  subscribeOrders,
  subscribeOwnUserProfile,
  subscribeQuotations,
  subscribeSalesTargets,
  subscribeSourcingRequests,
  subscribeStaffInvitations,
  subscribeTeamMessages,
  subscribeTeamTasks,
  subscribeTestimonials,
  subscribeUsers,
  subscribeVehicles,
  subscribeVessels,
  toggleDocumentVisibility,
  updateCustomerProfile,
  updateFinanceRecordStatus,
  updateInquiryStaff,
  updateOrderLogistics,
  updateSourcingRequestStaff,
  updateTeamTaskDetails,
  updateTeamTaskStatus,
  updateVehicleStatus,
  updateVesselAisTelemetry,
  updateVesselManualUpdate,
} from './services/firestoreService';
import {
  bootstrapAisFleet,
  fetchAisPositions,
  fetchAisStatus,
  mergeVesselsWithLiveAis,
  syncAisFilters,
} from './services/vesselTrackingService';
import type {
  AisServiceStatusResponse,
  ApiIntegrationConfig,
  AppView,
  AuditLogEntry,
  CatalogSourceMode,
  CifBreakdown,
  CompanySettings,
  CurrencyCode,
  CustomerTestimonial,
  ExchangeRateCacheDoc,
  ExportDocument,
  ExportOrder,
  FinanceRecord,
  HrEmployee,
  HrLeaveRequest,
  Inquiry,
  LandingPageContent,
  LiveExchangeRateState,
  LiveVesselTelemetry,
  OrderMessage,
  ProformaDraft,
  Quotation,
  RegisteredVessel,
  SalesTarget,
  ShippingMethod,
  SourcingOption,
  SourcingRequest,
  StaffInvitation,
  TeamChannelMessage,
  TeamTask,
  UserProfile,
  UserRole,
  Vehicle,
} from './types/portal';
import { CustomerPortalView, type CustomerPortalTab } from './views/CustomerPortalView';
import { HowToBuyView } from './views/HowToBuyView';
import { LandingView } from './views/LandingView';
import { OrderTrackerView } from './views/OrderTrackerView';
import { ShippingRatesView } from './views/ShippingRatesView';
import { StaffConsoleView } from './views/StaffConsoleView';

const BOOTSTRAP_ADMIN_EMAIL = 'techhub.wali@gmail.com';
const STORAGE_CURRENCY_KEY = 'auzio_currency_v2';
const STORAGE_COUNTRY_KEY = 'auzio_country_v2';
const STORAGE_PORT_KEY = 'auzio_port_v2';

function readStorage(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function createInvoiceNumber(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = Math.floor(1000 + Math.random() * 9000);
  return `PI-AUZ-${y}${m}-${r}`;
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function isBuyerRole(role: UserRole): boolean {
  return role === 'customer' || role === 'dealer';
}

function formatFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please switch to Login.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Please choose at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Please check your credentials and try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment or reset your password.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Authentication settings.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in window was closed before completing.';
    default:
      return err instanceof Error ? err.message : 'Authentication could not be completed.';
  }
}

export default function App() {
  // Navigation & Global Trade Preferences (persisted in localStorage)
  const [activeView, setActiveView] = useState<AppView>('home');
  const [catalogSourceMode, setCatalogSourceMode] = useState<CatalogSourceMode>('dealer_stock');
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const [customerTab, setCustomerTab] = useState<CustomerPortalTab>('profile');
  const [currency, setCurrencyState] = useState<CurrencyCode>(() =>
    readStorage(STORAGE_CURRENCY_KEY, 'USD')
  );
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(() =>
    readStorage(STORAGE_COUNTRY_KEY, 'KE')
  );
  const [selectedPortId, setSelectedPortIdState] = useState<string>(() =>
    readStorage(STORAGE_PORT_KEY, 'mombasa-ke')
  );

  // Live Exchange Rates State (zero fake fallback rates)
  const [liveFx, setLiveFx] = useState<LiveExchangeRateState>({
    ok: false,
    loading: true,
    base: 'USD',
    rates: { USD: 1 },
    updatedAt: null,
    provider: 'ExchangeRate-API',
  });

  // Auth & Universal Login State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [cloudProfile, setCloudProfile] = useState<UserProfile | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalMode, setLoginModalMode] = useState<'login' | 'signup'>('login');
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const openAuthModal = useCallback((mode: 'login' | 'signup' = 'login') => {
    setAuthError('');
    setLoginModalMode(mode);
    setLoginModalOpen(true);
  }, []);

  // Cloud Datasets
  const [cloudVehicles, setCloudVehicles] = useState<Vehicle[]>([]);
  const [fxCache, setFxCache] = useState<ExchangeRateCacheDoc | null>(null);
  const [fxCacheLoaded, setFxCacheLoaded] = useState(false);
  const [cloudVessels, setCloudVessels] = useState<RegisteredVessel[]>([]);
  const [integrationConfig, setIntegrationConfig] = useState<ApiIntegrationConfig>(
    DEFAULT_API_INTEGRATION_CONFIG
  );
  const [aisStatus, setAisStatus] = useState<AisServiceStatusResponse | null>(null);
  const [liveAisPositions, setLiveAisPositions] = useState<Record<string, LiveVesselTelemetry>>({});
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [landingContent, setLandingContent] = useState<LandingPageContent>(DEFAULT_LANDING_CONTENT);
  const [testimonials, setTestimonials] = useState<CustomerTestimonial[]>([]);
  const [cloudUsers, setCloudUsers] = useState<UserProfile[]>([]);
  const [cloudRequests, setCloudRequests] = useState<SourcingRequest[]>([]);
  const [cloudQuotations, setCloudQuotations] = useState<Quotation[]>([]);
  const [cloudOrders, setCloudOrders] = useState<ExportOrder[]>([]);
  const [cloudMessages, setCloudMessages] = useState<OrderMessage[]>([]);
  const [cloudDocs, setCloudDocs] = useState<ExportDocument[]>([]);
  const [cloudAuditLogs, setCloudAuditLogs] = useState<AuditLogEntry[]>([]);
  const [cloudInquiries, setCloudInquiries] = useState<Inquiry[]>([]);
  const [cloudFinanceRecords, setCloudFinanceRecords] = useState<FinanceRecord[]>([]);
  const [cloudHrEmployees, setCloudHrEmployees] = useState<HrEmployee[]>([]);
  const [cloudHrLeaveRequests, setCloudHrLeaveRequests] = useState<HrLeaveRequest[]>([]);
  const [cloudTeamTasks, setCloudTeamTasks] = useState<TeamTask[]>([]);
  const [cloudTeamMessages, setCloudTeamMessages] = useState<TeamChannelMessage[]>([]);
  const [cloudSalesTargets, setCloudSalesTargets] = useState<SalesTarget[]>([]);
  const [cloudStaffInvitations, setCloudStaffInvitations] = useState<StaffInvitation[]>([]);

  // Local fallback datasets for non-populated collections
  const [localUsers, setLocalUsers] = useState<UserProfile[]>(DEMO_USERS);
  const [localRequests, setLocalRequests] = useState<SourcingRequest[]>(SEED_SOURCING_REQUESTS);
  const [localQuotations, setLocalQuotations] = useState<Quotation[]>(SEED_QUOTATIONS);
  const [localOrders, setLocalOrders] = useState<ExportOrder[]>(SEED_ORDERS);
  const [localMessages, setLocalMessages] = useState<OrderMessage[]>(SEED_MESSAGES);
  const [localDocs, setLocalDocs] = useState<ExportDocument[]>(SEED_DOCUMENTS);
  const [localAuditLogs, setLocalAuditLogs] = useState<AuditLogEntry[]>(SEED_AUDIT_LOGS);

  // Modals & Overlays
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [prefillSourcingVehicle, setPrefillSourcingVehicle] = useState<Vehicle | null>(null);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [activePolicy, setActivePolicy] = useState<LegalPolicyType | null>(null);
  const [proformaDraft, setProformaDraft] = useState<ProformaDraft | null>(null);
  const [quickQuoteConfig, setQuickQuoteConfig] = useState<{
    vehicleId?: string;
    portId?: string;
    shippingMethod?: ShippingMethod;
    includeInsurance?: boolean;
  } | null>(null);
  const [trackerInitialCode, setTrackerInitialCode] = useState<string>('');
  const [liveLotMap, setLiveLotMap] = useState<Record<string, Vehicle>>({});
  const [importingLiveLot, setImportingLiveLot] = useState<Vehicle | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 4500);
  }, []);

  // Persist Currency, Country, Port & Wishlist preferences
  const handleCurrencyChange = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_CURRENCY_KEY, code);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handlePortChange = useCallback(
    (portId: string, silent = false) => {
      setSelectedPortIdState(portId);
      const matchedCountry = getWorldCountryByPortId(portId);
      setSelectedCountryCode(matchedCountry.code);
      try {
        localStorage.setItem(STORAGE_PORT_KEY, portId);
        localStorage.setItem(STORAGE_COUNTRY_KEY, matchedCountry.code);
      } catch {
        // Ignore storage errors
      }
      if (!silent) {
        notify(`Destination updated to ${matchedCountry.name}`);
      }
    },
    [notify]
  );

  const handleCountryChange = useCallback(
    (countryCode: string) => {
      const country = getWorldCountryByCode(countryCode);
      setSelectedCountryCode(country.code);
      const defaultPort = country.ports[0]?.id || 'mombasa-ke';
      setSelectedPortIdState(defaultPort);
      try {
        localStorage.setItem(STORAGE_COUNTRY_KEY, country.code);
        localStorage.setItem(STORAGE_PORT_KEY, defaultPort);
      } catch {
        // Ignore storage errors
      }
      notify(
        country.supportedShipping
          ? `Shipping destination set to ${country.name} (${country.ports[0]?.name})`
          : `Destination set to ${country.name} — Custom shipping quote available`
      );
    },
    [notify]
  );

  // Fetch live exchange rates only when Firestore 24h cache is absent/stale or on manual refresh
  const loadExchangeRates = useCallback(async (force = false) => {
    setLiveFx((prev) => ({ ...prev, loading: true }));
    const res = await fetchLiveExchangeRates(force);
    setLiveFx(res);
    return res;
  }, []);

  // Firestore-first 24h FX cache guard: avoid unnecessary API requests when Firebase cache is fresh
  useEffect(() => {
    if (!fxCacheLoaded) return;
    const cacheHasRates = Boolean(fxCache && Object.keys(fxCache.rates || {}).length > 1);
    const cacheFresh = cacheHasRates && !isFirestoreFxCacheStale(fxCache);

    if (cacheFresh) {
      setLiveFx((prev) => (prev.loading ? { ...prev, loading: false } : prev));
    } else if (!liveFx.ok) {
      void loadExchangeRates(false);
    }

    // Periodic 30-minute check to trigger automatic 24-hour refresh if session stays open
    const timer = setInterval(() => {
      if (isFirestoreFxCacheStale(fxCache)) {
        void loadExchangeRates(false);
      }
    }, 30 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fxCacheLoaded, fxCache, liveFx.ok, loadExchangeRates]);

  // Sync dynamic SEO metadata from Landing CMS
  useEffect(() => {
    if (landingContent.seoTitle) {
      document.title = landingContent.seoTitle;
    }
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && landingContent.seoDescription) {
      metaDesc.setAttribute('content', landingContent.seoDescription);
    }
  }, [landingContent.seoTitle, landingContent.seoDescription]);

  // Resolve effective live FX state (Live API -> Firestore 24h cache -> Apply Admin margins)
  const effectiveLiveFx = useMemo<LiveExchangeRateState>(() => {
    const globalMarginPct = fxCache?.globalMarginPct ?? 0;
    const currencyMargins = fxCache?.currencyMargins ?? {};

    if (liveFx.ok && Object.keys(liveFx.rates || {}).length > 1) {
      const rawBase = liveFx.rawRates || liveFx.rates;
      return {
        ...liveFx,
        rates: applyExchangeMargins(rawBase, globalMarginPct, currencyMargins),
        rawRates: rawBase,
        globalMarginPct,
        currencyMargins,
      };
    }

    if (fxCache && Object.keys(fxCache.rates || {}).length > 1) {
      const stale = isFirestoreFxCacheStale(fxCache);
      return {
        ok: true,
        loading: liveFx.loading,
        base: 'USD',
        rates: applyExchangeMargins(fxCache.rates, globalMarginPct, currencyMargins),
        rawRates: fxCache.rates,
        jpyRates: fxCache.jpyRates,
        supportedCount: fxCache.supportedCount || Object.keys(fxCache.rates).length,
        updatedAt: fxCache.updatedAt || null,
        nextUpdateAt: fxCache.nextUpdateAt || null,
        jpyUpdatedAt: fxCache.jpyUpdatedAt || null,
        provider: fxCache.provider || 'ExchangeRate-API (open.er-api.com)',
        attributionUrl: fxCache.attributionUrl || 'https://www.exchangerate-api.com',
        source: 'firestore_cache',
        stale,
        globalMarginPct,
        currencyMargins,
        error: stale
          ? liveFx.error ||
            'Live ExchangeRate-API temporarily unreachable — serving previously saved Firestore rates.'
          : undefined,
      };
    }

    return liveFx;
  }, [liveFx, fxCache]);

  // Merge effective (margin-adjusted) FX rates into settings passed to child views
  const effectiveSettings = useMemo<CompanySettings>(() => {
    if (!effectiveLiveFx.ok) return settings;
    return {
      ...settings,
      exchangeRates: {
        ...settings.exchangeRates,
        ...effectiveLiveFx.rates,
      },
    };
  }, [settings, effectiveLiveFx]);

  // Resolve real Firebase Auth session, enforce immediate suspension & claim pending staff invitations
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setCloudProfile(null);
        setNeedsProfileCompletion(false);
        return;
      }
      const existing = await getUserProfile(user.uid);
      if (existing) {
        if (existing.accountStatus === 'suspended') {
          await signOut(auth);
          setCloudProfile(null);
          setNeedsProfileCompletion(false);
          setActiveView('home');
          setAuthError(
            'This account has been suspended by Administration. Please contact HR or your system administrator.'
          );
          setLoginModalOpen(true);
          return;
        }
        setCloudProfile(existing);
        setNeedsProfileCompletion(false);
        if (existing.defaultPortId) handlePortChange(existing.defaultPortId, true);
      } else if (user.email === BOOTSTRAP_ADMIN_EMAIL && user.emailVerified) {
        setCloudProfile({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Auzio Trade Director',
          role: 'admin',
          department: 'Owner & Management',
          designationLevel: 'director',
          accountStatus: 'active',
          twoFactorRequired: true,
          companyName: 'AUZIO TRADERS HQ',
          country: 'Japan',
          defaultPortId: 'mombasa-ke',
          phone: '+81-45-550-8924',
          consigneeAddress: 'Yokohama, Japan',
          assignedRepName: '',
          assignedRepEmail: '',
          verified: true,
        });
        setNeedsProfileCompletion(false);
      } else if (user.email && user.emailVerified) {
        const claimed = await claimPendingStaffInvitation({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
        });
        if (claimed) {
          setCloudProfile(claimed);
          setNeedsProfileCompletion(false);
        } else {
          setCloudProfile((prev) => (prev && prev.uid === user.uid ? prev : null));
        }
      } else {
        setCloudProfile((prev) => (prev && prev.uid === user.uid ? prev : null));
      }
    });
    return () => unsub();
  }, [handlePortChange]);

  // Real-time sync of the signed-in user's own profile so Admin role changes & suspensions apply immediately
  useEffect(() => {
    if (!firebaseUser) return;
    const isBootstrapAdmin =
      firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL && firebaseUser.emailVerified;
    const unsub = subscribeOwnUserProfile(firebaseUser.uid, (liveProfile) => {
      if (!liveProfile) return;
      if (liveProfile.accountStatus === 'suspended' && !isBootstrapAdmin) {
        void signOut(auth);
        setCloudProfile(null);
        setNeedsProfileCompletion(false);
        setActiveView('home');
        setAuthError(
          'This account has been suspended by Administration. Please contact HR or your system administrator.'
        );
        setLoginModalOpen(true);
        return;
      }
      setCloudProfile(liveProfile);
      setNeedsProfileCompletion(false);
    });
    return () => unsub();
  }, [firebaseUser]);

  const isSuspendedSession = cloudProfile?.accountStatus === 'suspended';
  const effectiveRole: UserRole =
    cloudProfile && !isSuspendedSession ? cloudProfile.role : 'visitor';
  const isAuthenticated = Boolean(firebaseUser && cloudProfile && !isSuspendedSession);
  const isLiveFirestoreMode = isAuthenticated;
  const activeProfile: UserProfile | null = isSuspendedSession ? null : cloudProfile;

  // Public Firestore subscriptions
  useEffect(() => {
    const unsubV = subscribeVehicles((list) => setCloudVehicles(list));
    const unsubS = subscribeCompanySettings((s) => setSettings(s));
    const unsubL = subscribeLandingContent((c) => setLandingContent(c));
    const unsubFx = subscribeExchangeRateCache((cache) => {
      setFxCache(cache);
      setFxCacheLoaded(true);
    });
    const unsubVessels = subscribeVessels((list) => setCloudVessels(list));
    return () => {
      unsubV();
      unsubS();
      unsubL();
      unsubFx();
      unsubVessels();
    };
  }, []);

  // Role-scoped authenticated Firestore subscriptions
  const realStaff = Boolean(isAuthenticated && isStaffRole(effectiveRole));
  const canViewAudit = Boolean(
    realStaff &&
      (effectiveRole === 'admin' ||
        effectiveRole === 'management' ||
        effectiveRole === 'it' ||
        hasModulePermission(effectiveRole, activeProfile, 'settings', 'view'))
  );
  const canViewFinance = Boolean(
    realStaff && hasModulePermission(effectiveRole, activeProfile, 'accounts', 'view')
  );
  const canViewHr = Boolean(
    realStaff && hasModulePermission(effectiveRole, activeProfile, 'hr', 'view')
  );
  const canViewUsers = Boolean(
    realStaff && hasModulePermission(effectiveRole, activeProfile, 'users', 'view')
  );
  const realCustomerUid =
    isAuthenticated && isBuyerRole(effectiveRole) && firebaseUser ? firebaseUser.uid : null;

  // Subscribe to testimonials (public gets approved only; staff gets all for moderation)
  useEffect(() => {
    const unsubT = subscribeTestimonials(realStaff, setTestimonials);
    return () => unsubT();
  }, [realStaff]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    if (realStaff || realCustomerUid) {
      unsubs.push(subscribeSourcingRequests(realStaff, realCustomerUid, setCloudRequests));
      unsubs.push(subscribeQuotations(realStaff, realCustomerUid, setCloudQuotations));
      unsubs.push(subscribeOrders(realStaff, realCustomerUid, setCloudOrders));
      unsubs.push(subscribeOrderMessages(realStaff, realCustomerUid, setCloudMessages));
      unsubs.push(subscribeDocuments(realStaff, realCustomerUid, setCloudDocs));
    } else {
      setCloudRequests([]);
      setCloudQuotations([]);
      setCloudOrders([]);
      setCloudMessages([]);
      setCloudDocs([]);
    }

    if (realStaff) {
      unsubs.push(subscribeUsers(true, setCloudUsers));
      unsubs.push(subscribeInquiries(true, setCloudInquiries));
      unsubs.push(subscribeTeamTasks(true, setCloudTeamTasks));
      unsubs.push(subscribeTeamMessages(true, setCloudTeamMessages));
      unsubs.push(subscribeSalesTargets(true, setCloudSalesTargets));
      unsubs.push(subscribeApiIntegrationConfig(true, setIntegrationConfig));
    } else {
      setCloudUsers([]);
      setCloudInquiries([]);
      setCloudTeamTasks([]);
      setCloudTeamMessages([]);
      setCloudSalesTargets([]);
      setIntegrationConfig(DEFAULT_API_INTEGRATION_CONFIG);
    }

    if (canViewUsers) {
      unsubs.push(subscribeStaffInvitations(true, setCloudStaffInvitations));
    } else {
      setCloudStaffInvitations([]);
    }

    if (canViewFinance) {
      unsubs.push(subscribeFinanceRecords(true, setCloudFinanceRecords));
    } else {
      setCloudFinanceRecords([]);
    }

    if (canViewHr) {
      unsubs.push(subscribeHrEmployees(true, setCloudHrEmployees));
      unsubs.push(subscribeHrLeaveRequests(true, setCloudHrLeaveRequests));
    } else {
      setCloudHrEmployees([]);
      setCloudHrLeaveRequests([]);
    }

    if (canViewAudit) {
      unsubs.push(subscribeAuditLogs(true, setCloudAuditLogs));
    } else {
      setCloudAuditLogs([]);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [realStaff, canViewUsers, canViewFinance, canViewHr, canViewAudit, realCustomerUid]);

  // Staff capability checks for ExchangeRate cache writes & Vessel AIS persistence
  const canPersistFxCache = Boolean(
    realStaff &&
      (effectiveRole === 'admin' ||
        effectiveRole === 'management' ||
        effectiveRole === 'accounts' ||
        effectiveRole === 'it' ||
        hasModulePermission(effectiveRole, activeProfile, 'settings', 'edit'))
  );
  const canPersistVessels = Boolean(
    realStaff &&
      (effectiveRole === 'admin' ||
        effectiveRole === 'management' ||
        effectiveRole === 'operations' ||
        effectiveRole === 'it' ||
        hasModulePermission(effectiveRole, activeProfile, 'logistics', 'edit'))
  );

  // Persist fresh ExchangeRate-API raw snapshot to Firestore every 24h when authorized staff is active
  const persistExchangeRateSnapshot = useCallback(
    async (fx: LiveExchangeRateState) => {
      const rawRates = fx.rawRates || fx.rates;
      if (!canPersistFxCache || !fx.ok || Object.keys(rawRates || {}).length < 2) return;
      await saveExchangeRateCache({
        base: 'USD',
        rates: rawRates,
        jpyRates: fx.jpyRates || { JPY: 1 },
        supportedCount: fx.supportedCount || Object.keys(rawRates).length,
        globalMarginPct: fxCache?.globalMarginPct ?? 0,
        currencyMargins: fxCache?.currencyMargins ?? {},
        provider: fx.provider || 'ExchangeRate-API (open.er-api.com)',
        attributionUrl: fx.attributionUrl || 'https://www.exchangerate-api.com',
        updatedAt: fx.updatedAt || new Date().toISOString(),
        nextUpdateAt: fx.nextUpdateAt || '',
        jpyUpdatedAt: fx.jpyUpdatedAt || '',
        lastSyncStatus: 'ok',
        lastError: '',
      });
    },
    [canPersistFxCache, fxCache?.globalMarginPct, fxCache?.currencyMargins]
  );

  useEffect(() => {
    if (
      canPersistFxCache &&
      integrationConfig.exchangeRateEnabled &&
      liveFx.ok &&
      isFirestoreFxCacheStale(fxCache)
    ) {
      void persistExchangeRateSnapshot(liveFx);
    }
  }, [
    canPersistFxCache,
    integrationConfig.exchangeRateEnabled,
    liveFx,
    fxCache,
    persistExchangeRateSnapshot,
  ]);

  const handleManualFxRefresh = useCallback(async () => {
    const fresh = await loadExchangeRates(true);
    if (fresh.ok && canPersistFxCache) {
      await persistExchangeRateSnapshot(fresh);
      if (realStaff) {
        await saveApiIntegrationConfig({
          ...integrationConfig,
          lastFxSyncAt: new Date().toISOString(),
        });
      }
      notify(`Exchange rates synced (${Object.keys(fresh.rates).length} currencies cached to Firestore)`);
    } else if (!fresh.ok) {
      notify('Live FX API unreachable — serving saved Firestore exchange rates');
    }
  }, [
    loadExchangeRates,
    canPersistFxCache,
    persistExchangeRateSnapshot,
    realStaff,
    integrationConfig,
    notify,
  ]);

  // AISStream Vessel Tracking: merge Firestore vessels with live server-side AIS telemetry
  const mergedVessels = useMemo(
    () => mergeVesselsWithLiveAis(cloudVessels, liveAisPositions),
    [cloudVessels, liveAisPositions]
  );

  const refreshAisTracking = useCallback(async () => {
    try {
      const [statusRes, posRes] = await Promise.all([fetchAisStatus(), fetchAisPositions()]);
      if (statusRes) setAisStatus(statusRes);
      if (posRes) setLiveAisPositions(posRes);
    } catch {
      // Non-blocking fallback to persisted Firestore vessel data
    }
  }, []);

  // Poll live AIS positions when viewing vessel tracking, order tracker, customer orders, or staff console
  useEffect(() => {
    const needsAisPoll =
      activeView === 'vessel_tracking' ||
      activeView === 'track' ||
      activeView === 'customer_portal' ||
      activeView === 'staff_console' ||
      cloudVessels.length > 0;
    if (!needsAisPoll) return;
    void refreshAisTracking();
    const timer = setInterval(() => {
      void refreshAisTracking();
    }, 30000);
    return () => clearInterval(timer);
  }, [activeView, cloudVessels.length, refreshAisTracking]);

  // Bootstrap public registered fleet MMSIs if backend restarted before any staff user logged in
  useEffect(() => {
    if (realStaff || cloudVessels.length === 0) return;
    const activeMmsis = cloudVessels
      .filter((v) => v.trackingEnabled && /^\d{9}$/.test(v.mmsi))
      .map((v) => v.mmsi);
    if (activeMmsis.length === 0) return;
    void bootstrapAisFleet(activeMmsis).then((status) => {
      if (status) setAisStatus(status);
    });
  }, [realStaff, cloudVessels]);

  // Sync registered active 9-digit MMSIs to backend AISStream manager whenever staff & vessels are ready
  useEffect(() => {
    if (!realStaff || !firebaseUser) return;
    const activeMmsis = cloudVessels
      .filter((v) => v.trackingEnabled && /^\d{9}$/.test(v.mmsi))
      .map((v) => v.mmsi);
    let cancelled = false;
    void (async () => {
      try {
        const token = await firebaseUser.getIdToken();
        if (cancelled) return;
        const updatedStatus = await syncAisFilters(token, {
          enabled: integrationConfig.vesselTrackingEnabled,
          mmsis: activeMmsis,
        });
        if (!cancelled && updatedStatus) {
          setAisStatus(updatedStatus);
        }
      } catch {
        // Ignore transient filter sync errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [realStaff, firebaseUser, cloudVessels, integrationConfig.vesselTrackingEnabled]);

  // Persist newer live AIS telemetry into Firestore vessels/{vesselId}
  const handlePersistLiveAisToFirestore = useCallback(async (): Promise<number> => {
    if (!canPersistVessels) return 0;
    let updatedCount = 0;
    for (const v of cloudVessels) {
      const live = liveAisPositions[v.mmsi];
      if (!live || !live.lastAisUpdateAt) continue;
      const liveTs = Date.parse(live.lastAisUpdateAt);
      const savedTs = v.lastAisUpdateAt ? Date.parse(v.lastAisUpdateAt) : 0;
      if (!Number.isNaN(liveTs) && liveTs > savedTs) {
        await updateVesselAisTelemetry(v, live);
        updatedCount += 1;
      }
    }
    return updatedCount;
  }, [canPersistVessels, cloudVessels, liveAisPositions]);

  // Auto-save fresher live AIS positions to Firestore when an authorized staff member is online
  useEffect(() => {
    if (!canPersistVessels || Object.keys(liveAisPositions).length === 0) return;
    void handlePersistLiveAisToFirestore();
  }, [canPersistVessels, liveAisPositions, handlePersistLiveAisToFirestore]);

  // Resolved datasets
  const vehicles = useMemo(
    () => (cloudVehicles.length > 0 ? cloudVehicles : SEED_VEHICLES),
    [cloudVehicles]
  );
  const persistedVehicleIds = useMemo(
    () => new Set(cloudVehicles.map((v) => v.id)),
    [cloudVehicles]
  );

  const users = isLiveFirestoreMode && cloudUsers.length > 0 ? cloudUsers : localUsers;
  const sourcingRequests = isLiveFirestoreMode ? cloudRequests : localRequests;
  const quotations = isLiveFirestoreMode ? cloudQuotations : localQuotations;
  const orders = isLiveFirestoreMode ? cloudOrders : localOrders;
  const messages = isLiveFirestoreMode ? cloudMessages : localMessages;
  const documents = isLiveFirestoreMode ? cloudDocs : localDocs;
  const auditLogs = isLiveFirestoreMode ? cloudAuditLogs : localAuditLogs;

  // Universal Login Flow — automatically identifies assigned role & routes user
  const handleUniversalGoogleSignIn = async () => {
    setAuthError('');
    setIsSigningIn(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      const profile = await getUserProfile(user.uid);
      const isBootstrapAdmin = user.email === BOOTSTRAP_ADMIN_EMAIL && user.emailVerified;

      if (profile) {
        if (profile.accountStatus === 'suspended') {
          await signOut(auth);
          setCloudProfile(null);
          setNeedsProfileCompletion(false);
          setAuthError(
            'This account has been suspended by Administration. Please contact HR or your system administrator.'
          );
          return;
        }
        setCloudProfile(profile);
        setNeedsProfileCompletion(false);
        setLoginModalOpen(false);
        if (profile.defaultPortId) handlePortChange(profile.defaultPortId, true);

        if (isStaffRole(profile.role)) {
          setActiveView('staff_console');
          void recordAuditLog({
            actorRole: profile.role,
            action: 'staff_login_success',
            targetType: 'user',
            targetId: user.uid,
            summary: `Team member signed in: ${user.email} (${profile.role}).`,
          });
          notify(`Welcome back, ${profile.displayName}`);
        } else {
          setActiveView('customer_portal');
          void recordAuditLog({
            actorRole: profile.role,
            action: 'login_success',
            targetType: 'user',
            targetId: user.uid,
            summary: `Buyer signed in: ${profile.companyName || profile.displayName}.`,
          });
          notify(`Signed in to your Buyer Portal (${profile.companyName || profile.displayName})`);
        }
        return;
      }

      if (isBootstrapAdmin) {
        const adminProfile: UserProfile = {
          uid: user.uid,
          email: user.email || BOOTSTRAP_ADMIN_EMAIL,
          displayName: user.displayName || 'Auzio Trade Director',
          role: 'admin',
          department: 'Owner & Management',
          designationLevel: 'director',
          accountStatus: 'active',
          twoFactorRequired: true,
          companyName: 'AUZIO TRADERS HQ',
          country: 'Japan',
          defaultPortId: 'mombasa-ke',
          phone: '+81-45-550-8924',
          consigneeAddress: 'Yokohama, Japan',
          assignedRepName: '',
          assignedRepEmail: '',
          verified: true,
        };
        setCloudProfile(adminProfile);
        setNeedsProfileCompletion(false);
        setLoginModalOpen(false);
        setActiveView('staff_console');
        notify('Signed in to Auzio Traders Management Console');
        return;
      }

      // Check for Admin-provisioned employee invitation matching verified Google email
      if (user.email && user.emailVerified) {
        const claimed = await claimPendingStaffInvitation({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
        });
        if (claimed) {
          setCloudProfile(claimed);
          setNeedsProfileCompletion(false);
          setLoginModalOpen(false);
          setActiveView('staff_console');
          notify(
            `Welcome to your ${claimed.department || 'Department'} Dashboard, ${claimed.displayName}`
          );
          return;
        }
      }

      // First-time buyer account: prompt profile completion (strictly customer or dealer)
      setNeedsProfileCompletion(true);
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setIsSigningIn(false);
    }
  };

  // Open Email & Password Registration — anyone can sign up; default role is customer until Admin defines department role
  const handleEmailSignUp = async (input: {
    fullName: string;
    email: string;
    password: string;
  }) => {
    setAuthError('');
    setIsSigningIn(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
      await updateProfile(cred.user, { displayName: input.fullName.trim() });

      const country = getWorldCountryByCode(selectedCountryCode);
      const created = await registerCustomerProfile({
        uid: cred.user.uid,
        email: cred.user.email || input.email.trim(),
        accountType: 'customer',
        displayName: input.fullName.trim(),
        companyName: '',
        country: country.name,
        defaultPortId: selectedPortId,
        phone: '',
        consigneeAddress: '',
      });

      setCloudProfile(created);
      setNeedsProfileCompletion(false);
      setLoginModalOpen(false);
      setActiveView('customer_portal');
      notify(`Welcome, ${created.displayName}! Your account has been created.`);
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setIsSigningIn(false);
    }
  };

  // Email & Password Login — automatically routes user to their Admin-assigned role dashboard
  const handleEmailSignIn = async (input: { email: string; password: string }) => {
    setAuthError('');
    setIsSigningIn(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, input.email.trim(), input.password);
      const user = cred.user;
      let profile = await getUserProfile(user.uid);

      if (!profile) {
        const country = getWorldCountryByCode(selectedCountryCode);
        profile = await registerCustomerProfile({
          uid: user.uid,
          email: user.email || input.email.trim(),
          accountType: 'customer',
          displayName: user.displayName || input.email.split('@')[0] || 'Auzio User',
          companyName: '',
          country: country.name,
          defaultPortId: selectedPortId,
          phone: '',
          consigneeAddress: '',
        });
      }

      if (profile.accountStatus === 'suspended') {
        await signOut(auth);
        setCloudProfile(null);
        setNeedsProfileCompletion(false);
        setAuthError(
          'This account has been suspended by Administration. Please contact HR or your system administrator.'
        );
        return;
      }

      setCloudProfile(profile);
      setNeedsProfileCompletion(false);
      setLoginModalOpen(false);
      if (profile.defaultPortId) handlePortChange(profile.defaultPortId, true);

      if (isStaffRole(profile.role)) {
        setActiveView('staff_console');
        void recordAuditLog({
          actorRole: profile.role,
          action: 'staff_login_success',
          targetType: 'user',
          targetId: user.uid,
          summary: `Team member signed in via email: ${profile.email} (${profile.role}).`,
        });
        notify(`Welcome back, ${profile.displayName}`);
      } else {
        setActiveView('customer_portal');
        void recordAuditLog({
          actorRole: profile.role,
          action: 'login_success',
          targetType: 'user',
          targetId: user.uid,
          summary: `Account signed in via email: ${profile.email}.`,
        });
        notify(`Welcome back, ${profile.displayName}`);
      }
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleResetPassword = async (email: string): Promise<boolean> => {
    setAuthError('');
    setIsSigningIn(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return true;
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
      return false;
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleCompleteBuyerProfile = async (input: {
    accountType: 'customer' | 'dealer';
    displayName: string;
    companyName: string;
    country: string;
    defaultPortId: string;
    phone: string;
    consigneeAddress: string;
  }) => {
    if (!firebaseUser) return;
    const created = await registerCustomerProfile({
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      ...input,
    });
    setCloudProfile(created);
    setNeedsProfileCompletion(false);
    setLoginModalOpen(false);
    handlePortChange(created.defaultPortId, true);
    setActiveView('customer_portal');
    notify(`Account activated for ${created.companyName || created.displayName}`);
  };

  const handleSignOut = async () => {
    if (firebaseUser) {
      await signOut(auth);
    }
    setCloudProfile(null);
    if (activeView === 'customer_portal' || activeView === 'staff_console') {
      setActiveView('home');
    }
    notify('Signed out safely');
  };

  // Unified Navigation Handler (normalizes 'catalog' into unified Home #vehicle-catalog)
  const handleNavigateView = useCallback(
    (view: AppView, opts?: { sourceMode?: CatalogSourceMode; anchor?: string }) => {
      if (opts?.sourceMode) {
        setCatalogSourceMode(opts.sourceMode);
      }
      const targetView: AppView =
        view === 'catalog' ? 'home' : view === 'vessel_tracking' ? 'track' : view;
      const targetAnchor = opts?.anchor || (view === 'catalog' ? 'vehicle-catalog' : undefined);
      setActiveView(targetView);
      if (targetAnchor) {
        setTimeout(() => {
          const el = document.getElementById(targetAnchor);
          el?.scrollIntoView({ behavior: 'smooth' });
        }, 80);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

  // Compare toggle (max 4)
  const handleToggleCompare = (vehicleId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(vehicleId)) return prev.filter((id) => id !== vehicleId);
      if (prev.length >= 4) {
        notify('Comparison matrix supports up to 4 vehicles at once.');
        return prev;
      }
      return [...prev, vehicleId];
    });
  };

  // Proforma Invoice trigger (preserves confirmed invoice exchange rates when locked)
  const openProformaForVehicle = (params: {
    vehicle: Vehicle;
    cif: CifBreakdown;
    consigneeName?: string;
    consigneeAddress?: string;
    consigneePhone?: string;
    consigneeEmail?: string;
    trackingCode?: string;
    currency?: CurrencyCode;
    lockedExchangeRate?: number;
    lockedRateDate?: string;
    isRateLocked?: boolean;
  }) => {
    const today = new Date().toISOString().slice(0, 10);
    const targetCurrency = params.currency || currency;
    const currentAppliedRate =
      effectiveSettings.exchangeRates[targetCurrency] || (targetCurrency === 'USD' ? 1 : undefined);
    setProformaDraft({
      invoiceNumber: createInvoiceNumber(),
      issueDate: today,
      validUntilDate: addDaysIso(effectiveSettings.invoiceValidityDays || 14),
      vehicle: params.vehicle,
      cif: params.cif,
      currency: targetCurrency,
      lockedExchangeRate: params.lockedExchangeRate || currentAppliedRate,
      lockedRateDate: params.lockedRateDate || effectiveLiveFx.updatedAt || today,
      isRateLocked: params.isRateLocked ?? Boolean(params.lockedExchangeRate),
      consigneeName:
        params.consigneeName || activeProfile?.companyName || activeProfile?.displayName || '',
      consigneeAddress: params.consigneeAddress || activeProfile?.consigneeAddress || '',
      consigneePhone: params.consigneePhone || activeProfile?.phone || '',
      consigneeEmail: params.consigneeEmail || activeProfile?.email || '',
      trackingCode: params.trackingCode,
    });
  };

  // Start Bid Request from Catalogue or Vehicle Detail Modal
  const handleStartBidRequest = (vehicle: Vehicle) => {
    setSelectedVehicle(null);
    setPrefillSourcingVehicle(vehicle);
    if (isAuthenticated && isBuyerRole(effectiveRole)) {
      setCustomerTab('sourcing');
      setActiveView('customer_portal');
    } else {
      setAuthError('');
      setLoginModalOpen(true);
      notify('Please sign in to submit an authorized auction Max Bid Ceiling.');
    }
  };

  const handleOpenSourcingWizard = () => {
    if (isAuthenticated && isBuyerRole(effectiveRole)) {
      setCustomerTab('sourcing');
      setActiveView('customer_portal');
    } else {
      setAuthError('');
      setLoginModalOpen(true);
    }
  };

  const canImportToFirestore =
    isAuthenticated && ['operations', 'management', 'admin'].includes(effectiveRole);

  const handleRegisterLiveVehicles = useCallback((items: Vehicle[]) => {
    setLiveLotMap((prev) => {
      const next = { ...prev };
      for (const item of items) {
        next[item.id] = item;
      }
      return next;
    });
  }, []);

  const compareVehiclesList = useMemo(() => {
    const byId = new Map<string, Vehicle>();
    for (const v of vehicles) byId.set(v.id, v);
    for (const [id, v] of Object.entries(liveLotMap)) {
      if (!byId.has(id)) byId.set(id, v);
    }
    return compareIds
      .map((id) => byId.get(id))
      .filter((v): v is Vehicle => Boolean(v));
  }, [vehicles, liveLotMap, compareIds]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        {gmpQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}
        {activeView !== 'staff_console' && (
          <Navbar
            activeView={activeView}
            currency={currency}
            selectedCountryCode={selectedCountryCode}
            selectedPortId={selectedPortId}
            liveFx={effectiveLiveFx}
            landingContent={landingContent}
            isAuthenticated={isAuthenticated}
            userRole={effectiveRole}
            userProfile={activeProfile}
            onNavigateView={handleNavigateView}
            onCurrencyChange={handleCurrencyChange}
            onCountryChange={handleCountryChange}
            onPortChange={(pid) => handlePortChange(pid)}
            onRefreshFx={() => void handleManualFxRefresh()}
            onOpenLogin={openAuthModal}
            onSignOut={() => void handleSignOut()}
          />
        )}

        {/* Floating Compare Tray when buyer selects vehicles to compare */}
        {activeView !== 'staff_console' && compareIds.length > 0 && (
          <div className="bg-slate-900 text-white border-b border-slate-800 no-print">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-amber-400" />
                <span>
                  <strong>{compareIds.length}</strong> vehicle{compareIds.length === 1 ? '' : 's'}{' '}
                  selected for side-by-side comparison
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCompareOpen(true)}
                  className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
                >
                  Compare Now
                </button>
                <button
                  type="button"
                  onClick={() => setCompareIds([])}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1">
          {(activeView === 'home' || activeView === 'catalog') && (
            <LandingView
              vehicles={vehicles}
              currency={currency}
              liveFx={effectiveLiveFx}
              settings={effectiveSettings}
              selectedCountryCode={selectedCountryCode}
              selectedPortId={selectedPortId}
              catalogSourceMode={catalogSourceMode}
              landingContent={landingContent}
              testimonials={testimonials}
              compareIds={compareIds}
              canImportToFirestore={canImportToFirestore}
              isAuthenticated={isAuthenticated}
              userProfile={activeProfile}
              onOpenLogin={openAuthModal}
              onOpenDashboard={() =>
                setActiveView(isStaffRole(effectiveRole) ? 'staff_console' : 'customer_portal')
              }
              onCountryChange={handleCountryChange}
              onPortChange={(pid) => handlePortChange(pid)}
              onSourceModeChange={setCatalogSourceMode}
              onDealerInquirySubmitted={(code) =>
                notify(`Dealer stock inquiry saved — Reference ${code}`)
              }
              onNavigateView={handleNavigateView}
              onSelectVehicle={(v) => setSelectedVehicle(v)}
              onOpenProforma={({ vehicle, cif }) => openProformaForVehicle({ vehicle, cif })}
              onStartBidRequest={handleStartBidRequest}
              onRequestShippingQuote={(vehicle) => {
                setQuickQuoteConfig({
                  vehicleId: vehicle.id,
                  portId: selectedPortId,
                  shippingMethod: 'roro',
                  includeInsurance: true,
                });
              }}
              onOpenSourcingWizard={handleOpenSourcingWizard}
              onOpenWorkflowStatus={() => setWorkflowModalOpen(true)}
              onToggleCompare={handleToggleCompare}
              onImportLiveLot={(lot) => setImportingLiveLot(lot)}
              onRegisterLiveVehicles={handleRegisterLiveVehicles}
              onSubmitGeneralInquiry={async (input) => {
                const res = await submitBuyerInquiry({
                  type: 'inquiry',
                  vehicleId: 'GENERAL',
                  isVehiclePersisted: false,
                  vehicleStockCode: 'GEN-QUOTE',
                  vehicleTitle: input.subject.slice(0, 120),
                  buyerName: input.buyerName,
                  buyerEmail: input.buyerEmail,
                  buyerPhone: input.buyerPhone,
                  buyerCountry: input.buyerCountry,
                  destinationPortId: input.destinationPortId,
                  destinationPortName: input.destinationPortName,
                  shippingMethod: 'roro',
                  includeInsurance: true,
                  fobPriceUsd: 0,
                  freightUsd: 0,
                  inspectionUsd: 0,
                  insuranceUsd: 0,
                  quotedCifUsd: 0,
                  currency: 'USD',
                  message: input.message,
                });
                notify(`Inquiry logged — Reference ${res.trackingCode}`);
                return res.trackingCode;
              }}
            />
          )}

          {activeView === 'shipping' && (
            <ShippingRatesView
              currency={currency}
              selectedPortId={selectedPortId}
              settings={effectiveSettings}
              onSelectPort={(pid) => handlePortChange(pid)}
              onOpenWorkflowStatus={() => setWorkflowModalOpen(true)}
            />
          )}

          {activeView === 'how_to_buy' && (
            <HowToBuyView
              settings={effectiveSettings}
              landingContent={landingContent}
              onOpenLogin={() => {
                setAuthError('');
                setLoginModalOpen(true);
              }}
              onOpenSourcingWizard={handleOpenSourcingWizard}
              onNavigateView={handleNavigateView}
            />
          )}

          {(activeView === 'track' || activeView === 'vessel_tracking') && (
            <OrderTrackerView
              initialCode={trackerInitialCode}
              settings={effectiveSettings}
              vessels={mergedVessels}
              liveAisPositions={liveAisPositions}
              aisStatus={aisStatus}
              orders={orders}
              canRegisterVessels={canPersistVessels}
              onQuickRegisterVessel={async (v) => {
                const { id: _ignore, createdAt: _c, updatedAt: _u, ...payload } = v;
                await saveVessel(payload);
                notify(`Saved ${v.name} (MMSI ${v.mmsi}) to Fleet Roster in Firestore`);
              }}
              onRefreshPositions={refreshAisTracking}
            />
          )}

          {activeView === 'customer_portal' && (
            <CustomerPortalView
              activeTab={customerTab}
              onTabChange={setCustomerTab}
              profile={isBuyerRole(effectiveRole) ? activeProfile : null}
              currency={currency}
              settings={effectiveSettings}
              vehicles={vehicles}
              sourcingRequests={sourcingRequests}
              quotations={quotations}
              orders={orders}
              vessels={mergedVessels}
              messages={messages}
              documents={documents}
              prefillVehicle={prefillSourcingVehicle}
              isLiveFirestoreMode={isLiveFirestoreMode}
              onClearPrefillVehicle={() => setPrefillSourcingVehicle(null)}
              onOpenVesselTracking={() => handleNavigateView('track')}
              onOpenCustomerLogin={() => {
                setAuthError('');
                setLoginModalOpen(true);
              }}
              onOpenProforma={({
                vehicle,
                cif,
                trackingCode,
                currency: lockedCurrency,
                lockedExchangeRate,
                lockedRateDate,
                isRateLocked,
              }) =>
                openProformaForVehicle({
                  vehicle,
                  cif,
                  trackingCode,
                  currency: lockedCurrency,
                  lockedExchangeRate,
                  lockedRateDate,
                  isRateLocked,
                })
              }
              onSaveProfile={async (updates) => {
                if (!activeProfile) return;
                if (isLiveFirestoreMode) {
                  await updateCustomerProfile(activeProfile.uid, updates);
                  setCloudProfile({ ...activeProfile, ...updates });
                } else {
                  setLocalUsers((prev) =>
                    prev.map((u) => (u.uid === activeProfile.uid ? { ...u, ...updates } : u))
                  );
                }
                handlePortChange(updates.defaultPortId, true);
                notify('Buyer profile & preferred shipping port saved');
              }}
              onCreateSourcingRequest={async (input) => {
                if (!activeProfile) throw new Error('Not signed in');
                if (isLiveFirestoreMode) {
                  const code = await createSourcingRequest({
                    ...input,
                    customerId: activeProfile.uid,
                    customerName: activeProfile.displayName,
                    customerCompany: activeProfile.companyName,
                  });
                  notify(`Sourcing Request ${code} saved to Yokohama Sourcing Queue`);
                  return code;
                }
                const code = `SR-AUZ-2026-${Math.floor(300 + Math.random() * 699)}`;
                const newReq: SourcingRequest = {
                  id: `sr-${Date.now()}`,
                  requestCode: code,
                  customerId: activeProfile.uid,
                  customerName: activeProfile.displayName,
                  customerCompany: activeProfile.companyName,
                  assignedStaffId: 'staff-sales-01',
                  assignedStaffName: 'Kenji Takahashi',
                  ...input,
                  status: 'new',
                  options: [],
                };
                setLocalRequests((prev) => [newReq, ...prev]);
                notify(`Sourcing Request ${code} submitted`);
                return code;
              }}
              onRespondQuotation={async ({ quotation, decision, declineReason }) => {
                if (!activeProfile) return;
                if (isLiveFirestoreMode) {
                  await respondToQuotation({
                    quotation,
                    decision,
                    actorUid: activeProfile.uid,
                    declineReason,
                  });
                } else {
                  setLocalQuotations((prev) =>
                    prev.map((q) =>
                      q.id === quotation.id
                        ? {
                            ...q,
                            status: decision,
                            approvedAt: decision === 'approved' ? new Date().toISOString() : '',
                            approvedByUid: activeProfile.uid,
                            declineReason: declineReason || '',
                          }
                        : q
                    )
                  );
                }
                notify(
                  decision === 'approved'
                    ? `Quotation ${quotation.quoteNumber} approved & Max Bid Ceiling authorized`
                    : `Quotation ${quotation.quoteNumber} declined`
                );
              }}
              onSendOrderMessage={async (orderId, body) => {
                if (!activeProfile) return;
                if (isLiveFirestoreMode) {
                  await postOrderMessage({
                    orderId,
                    customerId: activeProfile.uid,
                    senderUid: activeProfile.uid,
                    senderName: activeProfile.displayName,
                    senderRole: activeProfile.role,
                    body,
                    isInternalStaffOnly: false,
                  });
                } else {
                  setLocalMessages((prev) => [
                    ...prev,
                    {
                      id: `msg-${Date.now()}`,
                      orderId,
                      customerId: activeProfile.uid,
                      senderUid: activeProfile.uid,
                      senderName: activeProfile.displayName,
                      senderRole: activeProfile.role,
                      body,
                      isInternalStaffOnly: false,
                    },
                  ]);
                }
                notify('Message sent to Yokohama Export Desk');
              }}
            />
          )}

          {activeView === 'staff_console' && (
            <StaffConsoleView
              role={effectiveRole}
              staffProfile={activeProfile}
              currency={currency}
              settings={effectiveSettings}
              liveFx={effectiveLiveFx}
              fxCache={fxCache}
              integrationConfig={integrationConfig}
              vessels={mergedVessels}
              aisStatus={aisStatus}
              isLiveFirestoreMode={isLiveFirestoreMode}
              vehicles={vehicles}
              users={users}
              sourcingRequests={sourcingRequests}
              quotations={quotations}
              orders={orders}
              messages={messages}
              documents={documents}
              auditLogs={auditLogs}
              inquiries={cloudInquiries}
              financeRecords={cloudFinanceRecords}
              hrEmployees={cloudHrEmployees}
              hrLeaveRequests={cloudHrLeaveRequests}
              teamTasks={cloudTeamTasks}
              teamMessages={cloudTeamMessages}
              salesTargets={cloudSalesTargets}
              staffInvitations={cloudStaffInvitations}
              landingContent={landingContent}
              testimonials={testimonials}
              onRefreshFx={handleManualFxRefresh}
              onSaveFxMargins={async (globalMarginPct, currencyMargins) => {
                const baseRates =
                  effectiveLiveFx.rawRates ||
                  fxCache?.rates ||
                  liveFx.rates ||
                  effectiveSettings.exchangeRates;
                await saveExchangeRateCache({
                  base: 'USD',
                  rates: baseRates,
                  jpyRates: fxCache?.jpyRates || liveFx.jpyRates || { JPY: 1 },
                  supportedCount: Object.keys(baseRates).length,
                  globalMarginPct,
                  currencyMargins,
                  provider:
                    fxCache?.provider ||
                    liveFx.provider ||
                    'ExchangeRate-API (open.er-api.com)',
                  attributionUrl:
                    fxCache?.attributionUrl || 'https://www.exchangerate-api.com',
                  updatedAt:
                    fxCache?.updatedAt || liveFx.updatedAt || new Date().toISOString(),
                  nextUpdateAt: fxCache?.nextUpdateAt || liveFx.nextUpdateAt || '',
                  jpyUpdatedAt: fxCache?.jpyUpdatedAt || liveFx.jpyUpdatedAt || '',
                  lastSyncStatus: 'ok',
                  lastError: '',
                });
                notify('Currency margins saved and applied across the portal');
              }}
              onSaveIntegrationConfig={async (next) => {
                await saveApiIntegrationConfig(next);
                setIntegrationConfig(next);
                notify('API integration configuration saved');
              }}
              onSaveVessel={async (input, existingId) => {
                await saveVessel(input, existingId);
                notify(
                  existingId
                    ? `Updated vessel ${input.name} (MMSI ${input.mmsi})`
                    : `Registered vessel ${input.name} (MMSI ${input.mmsi}) for AIS tracking`
                );
              }}
              onDeleteVessel={async (vesselId) => {
                await deleteVessel(vesselId);
                notify('Removed vessel from tracking roster');
              }}
              onManualVesselUpdate={async (params) => {
                await updateVesselManualUpdate(params);
                notify(`Saved manual coordinator update for ${params.vessel.name}`);
              }}
              onAssignOrderToVessel={async (order, vessel) => {
                await updateOrderLogistics({
                  order,
                  milestone:
                    order.milestone === 'customer_approved' ||
                    order.milestone === 'vehicle_purchased'
                      ? 'shipment_booked'
                      : order.milestone,
                  vesselName: vessel.name,
                  vesselId: vessel.id,
                  vesselMmsi: vessel.mmsi,
                  voyageNumber: vessel.voyageNumber || order.voyageNumber,
                  blNumber: order.blNumber,
                  etdDate: order.etdDate,
                  etaDate: vessel.etaManual || vessel.etaReported || order.etaDate,
                  scheduleIsEstimate: order.scheduleIsEstimate,
                  actorRole: effectiveRole,
                });
                notify(`Assigned ${order.orderNumber} to vessel ${vessel.name} (MMSI ${vessel.mmsi})`);
              }}
              onRefreshAisStatus={refreshAisTracking}
              onPersistLiveAisToFirestore={handlePersistLiveAisToFirestore}
              onNotify={notify}
              onExitConsole={() => setActiveView('home')}
              onSignOut={() => void handleSignOut()}
              onOpenStaffLogin={() => {
                setAuthError('');
                setLoginModalOpen(true);
              }}
              onUpdateInquiry={async (inquiryId, updates) => {
                await updateInquiryStaff(inquiryId, updates);
                notify('Lead status & CRM notes saved');
              }}
              onCreateFinanceRecord={async (input) => {
                await createFinanceRecord(input);
                notify(`Finance record ${input.referenceCode} saved`);
              }}
              onUpdateFinanceStatus={async (id, updates) => {
                await updateFinanceRecordStatus(id, updates);
                notify('Finance status updated & logged to Audit Trail');
              }}
              onDeleteFinanceRecord={async (id) => {
                await deleteFinanceRecord(id);
                notify('Finance record deleted');
              }}
              onSaveHrEmployee={async (input, existingId) => {
                await saveHrEmployee(input, existingId);
                notify(existingId ? 'Employee updated' : `Added ${input.fullName} to HR directory`);
              }}
              onDeleteHrEmployee={async (id) => {
                await deleteHrEmployee(id);
                notify('Employee record deleted');
              }}
              onCreateHrLeave={async (input) => {
                await createHrLeaveRequest(input);
                notify('Leave request submitted');
              }}
              onReviewHrLeave={async (id, status, reasonNote) => {
                await reviewHrLeaveRequest(
                  id,
                  status,
                  activeProfile?.displayName || 'HR Manager',
                  reasonNote
                );
                notify(`Leave request ${status} & logged to Audit Trail`);
              }}
              onCreateTeamTask={async (input) => {
                await createTeamTask(input);
                notify('Team task created');
              }}
              onUpdateTeamTaskStatus={async (id, status) => {
                await updateTeamTaskStatus(id, status);
                notify('Task status updated');
              }}
              onUpdateTeamTaskDetails={async (id, updates) => {
                await updateTeamTaskDetails(id, updates);
                notify('Task updated & rescheduled');
              }}
              onDeleteTeamTask={async (id) => {
                await deleteTeamTask(id);
                notify('Task deleted');
              }}
              onPostTeamMessage={async (channel, body) => {
                if (!activeProfile) return;
                await postTeamChannelMessage({
                  channel,
                  senderUid: activeProfile.uid,
                  senderName: activeProfile.displayName,
                  senderRole: activeProfile.role,
                  body,
                });
              }}
              onSaveSalesTarget={async (input, existingId) => {
                await saveSalesTarget(input, existingId);
                notify(`Sales target saved for ${input.staffName}`);
              }}
              onDeleteSalesTarget={async (id) => {
                await deleteSalesTarget(id);
                notify('Sales target removed');
              }}
              onSaveBankingDetails={async (next, verificationReason) => {
                await saveBankingDetailsProtected(next, verificationReason);
                setSettings(next);
                notify('Verified corporate banking details updated & logged to Audit Trail');
              }}
              onSaveLandingContent={async (next) => {
                await saveLandingContent(next);
                setLandingContent(next);
                notify('Landing page CMS & SEO settings published live');
              }}
              onSaveTestimonial={async (input, existingId) => {
                await saveTestimonial(input, existingId);
                notify(existingId ? 'Testimonial updated' : 'Verified customer review saved');
              }}
              onDeleteTestimonial={async (id) => {
                await deleteTestimonial(id);
                notify('Customer review deleted');
              }}
              onAttachSourcingOption={async (req, opt: SourcingOption) => {
                const nextOptions = [...(req.options || []), opt];
                if (isLiveFirestoreMode) {
                  await updateSourcingRequestStaff(req.id, {
                    assignedStaffId: activeProfile?.uid || 'staff-sales-01',
                    assignedStaffName: activeProfile?.displayName || 'Kenji Takahashi',
                    status: 'options_sent',
                    options: nextOptions,
                    notes: req.notes,
                  });
                } else {
                  setLocalRequests((prev) =>
                    prev.map((r) =>
                      r.id === req.id ? { ...r, status: 'options_sent', options: nextOptions } : r
                    )
                  );
                }
                notify(`Shortlisted option attached to ${req.requestCode}`);
              }}
              onCreateQuotation={async (input) => {
                const lockedRate =
                  effectiveSettings.exchangeRates[input.currency] ||
                  (input.currency === 'USD' ? 1 : undefined);
                const lockedRateDate = effectiveLiveFx.updatedAt || new Date().toISOString();
                if (isLiveFirestoreMode) {
                  const qNum = await createQuotation({
                    ...input,
                    lockedExchangeRate: lockedRate,
                    lockedCurrency: input.currency,
                    lockedRateDate,
                    preparedByStaffId: activeProfile?.uid || 'staff-sales-01',
                    preparedByName: activeProfile?.displayName || 'Kenji Takahashi',
                  });
                  notify(`Issued Quotation ${qNum} to ${input.customerCompany}`);
                } else {
                  const qNum = `QT-AUZ-2026-${Math.floor(600 + Math.random() * 399)}`;
                  const totalCifUsd =
                    input.fobVehicleUsd +
                    input.auctionFeeUsd +
                    input.exportDocsUsd +
                    input.jevicInspectionUsd +
                    input.seaFreightUsd +
                    input.marineInsuranceUsd;
                  setLocalQuotations((prev) => [
                    {
                      id: `qt-${Date.now()}`,
                      quoteNumber: qNum,
                      ...input,
                      lockedExchangeRate: lockedRate,
                      lockedCurrency: input.currency,
                      lockedRateDate,
                      preparedByStaffId: activeProfile?.uid || 'staff-sales-01',
                      preparedByName: activeProfile?.displayName || 'Kenji Takahashi',
                      totalCifUsd,
                      status: 'sent',
                      approvedAt: '',
                      approvedByUid: '',
                      declineReason: '',
                      validUntil: addDaysIso(7),
                    },
                    ...prev,
                  ]);
                  notify(`Issued Quotation ${qNum} to ${input.customerCompany}`);
                }
              }}
              onConvertQuoteToOrder={async (quotation) => {
                const fallbackRate =
                  effectiveSettings.exchangeRates[quotation.currency] ||
                  (quotation.currency === 'USD' ? 1 : undefined);
                const lockedRate = quotation.lockedExchangeRate || fallbackRate;
                const lockedCurrency = quotation.lockedCurrency || quotation.currency;
                const lockedRateDate =
                  quotation.lockedRateDate || effectiveLiveFx.updatedAt || new Date().toISOString();
                if (isLiveFirestoreMode) {
                  const orderNumber = await convertQuotationToOrder(
                    quotation,
                    'auction_listing',
                    lockedRate
                      ? { rate: lockedRate, currency: lockedCurrency, date: lockedRateDate }
                      : undefined
                  );
                  notify(`Converted ${quotation.quoteNumber} into Export Order ${orderNumber}`);
                } else {
                  const orderNumber = `ORD-AUZ-2026-${Math.floor(300 + Math.random() * 699)}`;
                  setLocalOrders((prev) => [
                    {
                      id: `ord-${Date.now()}`,
                      orderNumber,
                      trackingCode: `AUZ-2026-${Math.floor(100000 + Math.random() * 899999)}`,
                      quotationId: quotation.id,
                      customerId: quotation.customerId,
                      customerName: quotation.customerName,
                      customerCompany: quotation.customerCompany,
                      vehicleId: quotation.vehicleId,
                      vehicleStockCode: quotation.stockCode,
                      vehicleTitle: quotation.vehicleTitle,
                      listingType: 'auction_listing',
                      destinationCountry: '',
                      destinationPortId: quotation.destinationPortId,
                      destinationPortName: quotation.destinationPortName,
                      shippingMethod: 'roro',
                      fobUsd: quotation.fobVehicleUsd,
                      freightUsd: quotation.seaFreightUsd,
                      inspectionUsd: quotation.jevicInspectionUsd,
                      insuranceUsd: quotation.marineInsuranceUsd,
                      totalCifUsd: quotation.totalCifUsd,
                      currency: quotation.currency,
                      lockedExchangeRate: lockedRate,
                      lockedCurrency,
                      lockedRateDate,
                      authorizedMaxBidUsd: quotation.authorizedMaxBidUsd,
                      placedBidUsd: 0,
                      milestone: 'customer_approved',
                      vesselName: '',
                      voyageNumber: '',
                      blNumber: '',
                      etdDate: '',
                      etaDate: '',
                      scheduleIsEstimate: true,
                    },
                    ...prev,
                  ]);
                  notify(`Export Order ${orderNumber} created`);
                }
              }}
              onPlaceAuctionBid={async (order, bidAmountUsd) => {
                if (order.authorizedMaxBidUsd > 0 && bidAmountUsd > order.authorizedMaxBidUsd) {
                  return {
                    ok: false,
                    error: `BLOCKED: Bid $${bidAmountUsd.toLocaleString()} exceeds customer-authorized Max Bid Ceiling ($${order.authorizedMaxBidUsd.toLocaleString()} USD).`,
                  };
                }
                if (isLiveFirestoreMode) {
                  return placeAuctionBidWithGuard({
                    order,
                    bidAmountUsd,
                    actorRole: effectiveRole,
                  });
                }
                setLocalOrders((prev) =>
                  prev.map((o) =>
                    o.id === order.id
                      ? { ...o, placedBidUsd: bidAmountUsd, milestone: 'bid_placed' }
                      : o
                  )
                );
                return { ok: true };
              }}
              onUpdateOrderLogistics={async ({
                order,
                milestone,
                vesselName,
                voyageNumber,
                blNumber,
                etdDate,
                etaDate,
                scheduleIsEstimate,
              }) => {
                if (isLiveFirestoreMode) {
                  await updateOrderLogistics({
                    order,
                    milestone,
                    vesselName,
                    voyageNumber,
                    blNumber,
                    etdDate,
                    etaDate,
                    scheduleIsEstimate,
                    actorRole: effectiveRole,
                  });
                } else {
                  setLocalOrders((prev) =>
                    prev.map((o) =>
                      o.id === order.id
                        ? {
                            ...o,
                            milestone,
                            vesselName,
                            voyageNumber,
                            blNumber,
                            etdDate,
                            etaDate,
                            scheduleIsEstimate,
                          }
                        : o
                    )
                  );
                }
                notify(`Updated vessel & milestone for ${order.orderNumber}`);
              }}
              onPostOrderMessage={async ({ order, body, isInternalStaffOnly }) => {
                if (isLiveFirestoreMode && activeProfile) {
                  await postOrderMessage({
                    orderId: order.id,
                    customerId: order.customerId,
                    senderUid: activeProfile.uid,
                    senderName: activeProfile.displayName,
                    senderRole: activeProfile.role,
                    body,
                    isInternalStaffOnly,
                  });
                } else {
                  setLocalMessages((prev) => [
                    ...prev,
                    {
                      id: `msg-${Date.now()}`,
                      orderId: order.id,
                      customerId: order.customerId,
                      senderUid: activeProfile?.uid || 'staff-ops-01',
                      senderName: activeProfile?.displayName || 'Operations Team',
                      senderRole: activeProfile?.role || 'operations',
                      body,
                      isInternalStaffOnly,
                    },
                  ]);
                }
                notify(
                  isInternalStaffOnly
                    ? 'Internal staff note posted (hidden from customer)'
                    : 'Customer-visible update sent'
                );
              }}
              onArchiveVehicle={async (vehicle) => {
                const nextStatus = vehicle.status === 'archived' ? 'available' : 'archived';
                if (isLiveFirestoreMode && persistedVehicleIds.has(vehicle.id)) {
                  await updateVehicleStatus(vehicle, nextStatus);
                }
                notify(
                  nextStatus === 'archived'
                    ? `Archived ${vehicle.stockCode}`
                    : `Restored ${vehicle.stockCode} to catalog`
                );
              }}
              onDeleteVehicle={async (vehicleId) => {
                if (isLiveFirestoreMode && persistedVehicleIds.has(vehicleId)) {
                  await deleteVehicle(vehicleId);
                }
                notify('Vehicle record deleted');
              }}
              onCreateDocument={async (input) => {
                if (isLiveFirestoreMode) {
                  await createExportDocument({
                    ...input,
                    uploadedByName: activeProfile?.displayName || 'Operations Desk',
                  });
                } else {
                  setLocalDocs((prev) => [
                    {
                      id: `doc-${Date.now()}`,
                      ...input,
                      uploadedByName: activeProfile?.displayName || 'Operations Desk',
                    },
                    ...prev,
                  ]);
                }
                notify(`Uploaded ${input.title}`);
              }}
              onToggleDocVisibility={async (docRecord, nextVisible) => {
                if (isLiveFirestoreMode) {
                  await toggleDocumentVisibility(docRecord, nextVisible);
                } else {
                  setLocalDocs((prev) =>
                    prev.map((d) =>
                      d.id === docRecord.id ? { ...d, isCustomerVisible: nextVisible } : d
                    )
                  );
                }
                notify(
                  nextVisible
                    ? `Released "${docRecord.title}" to Customer Vault`
                    : `Restricted "${docRecord.title}" to Staff-Only`
                );
              }}
              onDeleteDocument={async (docId) => {
                if (isLiveFirestoreMode) {
                  await deleteExportDocument(docId);
                } else {
                  setLocalDocs((prev) => prev.filter((d) => d.id !== docId));
                }
                notify('Document deleted');
              }}
              onUpdateUserRole={async (uid, updates) => {
                if (isLiveFirestoreMode) {
                  await adminUpdateUser(uid, updates);
                } else {
                  setLocalUsers((prev) =>
                    prev.map((u) => (u.uid === uid ? { ...u, ...updates } : u))
                  );
                }
                notify(
                  updates.accountStatus === 'suspended'
                    ? 'Employee account immediately suspended'
                    : `Updated access profile (${updates.role.toUpperCase()})`
                );
              }}
              onCreateStaffInvitation={async (input) => {
                await createStaffInvitation(input);
                notify(`Employee invitation provisioned for ${input.officialEmail}`);
              }}
              onRevokeStaffInvitation={async (inviteId) => {
                await revokeStaffInvitation(inviteId);
                notify('Employee invitation revoked');
              }}
              onSaveSettings={async (next) => {
                if (isLiveFirestoreMode) {
                  await saveCompanySettings(next);
                } else {
                  setSettings(next);
                }
                notify('Company banking & FX settings saved');
              }}
              onSeedDatabase={async () => {
                await seedFullTradeDatabase();
                notify('Full trade database seeded in Firestore');
              }}
              onClearSampleData={async () => {
                await clearSampleTradeData();
                setLocalAuditLogs([]);
                notify('Sample trade data cleared from Firestore');
              }}
            />
          )}
        </main>

        {activeView !== 'staff_console' && (
          <>
            <Footer
              landingContent={landingContent}
              liveFxUpdatedAt={effectiveLiveFx.updatedAt}
              onNavigateView={handleNavigateView}
              onOpenPolicy={(policy) => setActivePolicy(policy)}
            />

            <FloatingUtilities whatsappPhone={landingContent.contactWhatsapp} />
          </>
        )}

        {/* Vehicle Detail Modal */}
        {selectedVehicle && (
          <VehicleDetailModal
            vehicle={selectedVehicle}
            currency={currency}
            defaultPortId={selectedPortId}
            settings={effectiveSettings}
            isCompared={compareIds.includes(selectedVehicle.id)}
            canImportToFirestore={canImportToFirestore}
            onImportLiveLot={(lot) => {
              setSelectedVehicle(null);
              setImportingLiveLot(lot);
            }}
            onToggleCompare={handleToggleCompare}
            onClose={() => setSelectedVehicle(null)}
            onOpenProforma={({ vehicle, cif }) => {
              setSelectedVehicle(null);
              openProformaForVehicle({ vehicle, cif });
            }}
            onOpenInquiry={({ vehicle, portId, shippingMethod, includeInsurance }) => {
              setSelectedVehicle(null);
              setQuickQuoteConfig({
                vehicleId: vehicle.id,
                portId,
                shippingMethod,
                includeInsurance,
              });
            }}
            onStartBidRequest={handleStartBidRequest}
          />
        )}

        {/* Staff Direct Live Auction Lot Import Modal */}
        {importingLiveLot && (
          <AdminVehicleModal
            vehicle={importingLiveLot}
            isImportMode
            onClose={() => setImportingLiveLot(null)}
            onSaved={(msg) => notify(msg)}
          />
        )}

        {/* Side-by-Side Comparison Matrix Modal */}
        {compareOpen && compareVehiclesList.length > 0 && (
          <ComparisonModal
            vehicles={compareVehiclesList}
            currency={currency}
            portId={selectedPortId}
            settings={effectiveSettings}
            onRemove={(id) => {
              setCompareIds((prev) => {
                const next = prev.filter((x) => x !== id);
                if (next.length === 0) setCompareOpen(false);
                return next;
              });
            }}
            onClearAll={() => {
              setCompareIds([]);
              setCompareOpen(false);
            }}
            onViewVehicle={(v) => setSelectedVehicle(v)}
            onOpenProforma={({ vehicle, cif }) => openProformaForVehicle({ vehicle, cif })}
            onClose={() => setCompareOpen(false)}
          />
        )}

        {/* Printable A4 Proforma Invoice Modal */}
        {proformaDraft && (
          <ProformaInvoiceModal
            draft={proformaDraft}
            settings={effectiveSettings}
            onClose={() => setProformaDraft(null)}
          />
        )}

        {/* Quick Inquiry / Shipping Quote Modal */}
        {quickQuoteConfig && (
          <QuickQuoteModal
            vehicles={[
              ...vehicles,
              ...Object.values(liveLotMap).filter(
                (lv) => !vehicles.some((v) => v.id === lv.id)
              ),
            ]}
            persistedVehicleIds={persistedVehicleIds}
            currency={currency}
            settings={effectiveSettings}
            defaultVehicleId={quickQuoteConfig.vehicleId}
            initialPortId={quickQuoteConfig.portId || selectedPortId}
            initialShippingMethod={quickQuoteConfig.shippingMethod}
            initialIncludeInsurance={quickQuoteConfig.includeInsurance}
            onClose={() => setQuickQuoteConfig(null)}
            onTrackOrder={(code) => {
              setTrackerInitialCode(code);
              setActiveView('track');
            }}
            onOpenProforma={(p) => {
              setQuickQuoteConfig(null);
              const cif = calculateCif({
                fobUsd: p.vehicle.fobPriceUsd,
                volumeM3: p.vehicle.volumeM3,
                portId: p.portId,
                shippingMethod: p.shippingMethod,
                includeInsurance: p.includeInsurance,
              });
              openProformaForVehicle({
                vehicle: p.vehicle,
                cif,
                consigneeName: p.consigneeName,
                consigneePhone: p.consigneePhone,
                consigneeEmail: p.consigneeEmail,
                trackingCode: p.trackingCode,
              });
            }}
          />
        )}

        {/* Workflow Disclosure Modal (accessible internally only, never from public header) */}
        {workflowModalOpen && (
          <WorkflowStatusModal
            settings={effectiveSettings}
            onClose={() => setWorkflowModalOpen(false)}
          />
        )}

        {/* Legal Policies Modal */}
        {activePolicy && (
          <LegalPolicyModal
            policy={activePolicy}
            contactEmail={landingContent.contactEmail}
            contactAddress={landingContent.contactAddress}
            onClose={() => setActivePolicy(null)}
          />
        )}

        {/* Single Universal Login & Sign Up Modal */}
        {loginModalOpen && (
          <UniversalLoginModal
            initialMode={loginModalMode}
            isAuthenticated={Boolean(firebaseUser)}
            needsProfileCompletion={needsProfileCompletion}
            currentEmail={firebaseUser?.email || ''}
            currentDisplayName={firebaseUser?.displayName || ''}
            userProfile={activeProfile}
            authError={authError}
            isSigningIn={isSigningIn}
            onEmailSignUp={handleEmailSignUp}
            onEmailSignIn={handleEmailSignIn}
            onResetPassword={handleResetPassword}
            onGoogleSignIn={handleUniversalGoogleSignIn}
            onCompleteBuyerProfile={handleCompleteBuyerProfile}
            onClearError={() => setAuthError('')}
            onClose={() => {
              setLoginModalOpen(false);
              setAuthError('');
            }}
          />
        )}

        {/* Non-blocking Toast */}
        {toast && (
          <div className="no-print fixed bottom-20 right-5 z-50 max-w-md bg-slate-950 text-white border border-slate-700 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 text-xs">
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="leading-snug">{toast}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
