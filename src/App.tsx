import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
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
import { fetchLiveExchangeRates } from './services/exchangeRateService';
import {
  adminUpdateUser,
  clearSampleTradeData,
  convertQuotationToOrder,
  createExportDocument,
  createQuotation,
  createSourcingRequest,
  deleteExportDocument,
  deleteTestimonial,
  deleteVehicle,
  getUserProfile,
  placeAuctionBidWithGuard,
  postOrderMessage,
  recordAuditLog,
  registerCustomerProfile,
  respondToQuotation,
  saveCompanySettings,
  saveLandingContent,
  saveTestimonial,
  seedFullTradeDatabase,
  submitBuyerInquiry,
  subscribeAuditLogs,
  subscribeCompanySettings,
  subscribeDocuments,
  subscribeInquiries,
  subscribeLandingContent,
  subscribeOrderMessages,
  subscribeOrders,
  subscribeQuotations,
  subscribeSourcingRequests,
  subscribeTestimonials,
  subscribeUsers,
  subscribeVehicles,
  toggleDocumentVisibility,
  updateCustomerProfile,
  updateOrderLogistics,
  updateSourcingRequestStaff,
  updateVehicleStatus,
} from './services/firestoreService';
import type {
  AppView,
  AuditLogEntry,
  CifBreakdown,
  CompanySettings,
  CurrencyCode,
  CustomerTestimonial,
  ExportDocument,
  ExportOrder,
  Inquiry,
  LandingPageContent,
  LiveExchangeRateState,
  OrderMessage,
  ProformaDraft,
  Quotation,
  ShippingMethod,
  SourcingOption,
  SourcingRequest,
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

function isStaffRole(role: UserRole): boolean {
  return ['sales', 'accounts', 'operations', 'management', 'admin'].includes(role);
}

function isBuyerRole(role: UserRole): boolean {
  return role === 'customer' || role === 'dealer';
}

export default function App() {
  // Navigation & Global Trade Preferences (persisted in localStorage)
  const [activeView, setActiveView] = useState<AppView>('home');
  const [catalogSourceMode, setCatalogSourceMode] = useState<'curated' | 'live_auctions'>('curated');

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
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Cloud Datasets
  const [cloudVehicles, setCloudVehicles] = useState<Vehicle[]>([]);
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

  // Fetch live exchange rates on mount & on manual refresh
  const loadExchangeRates = useCallback(async (force = false) => {
    setLiveFx((prev) => ({ ...prev, loading: true }));
    const res = await fetchLiveExchangeRates(force);
    setLiveFx(res);
  }, []);

  useEffect(() => {
    void loadExchangeRates(false);
  }, [loadExchangeRates]);

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

  // Merge live FX rates into settings passed to child views (keep accounting USD base intact)
  const effectiveSettings = useMemo<CompanySettings>(() => {
    if (!liveFx.ok) return settings;
    return {
      ...settings,
      exchangeRates: {
        ...settings.exchangeRates,
        ...liveFx.rates,
      },
    };
  }, [settings, liveFx]);

  // Resolve real Firebase Auth session & profile
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
        setCloudProfile(existing);
        setNeedsProfileCompletion(false);
        if (existing.defaultPortId) handlePortChange(existing.defaultPortId, true);
      } else if (user.email === BOOTSTRAP_ADMIN_EMAIL && user.emailVerified) {
        setCloudProfile({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Auzio Trade Director',
          role: 'admin',
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
      } else {
        setCloudProfile(null);
      }
    });
    return () => unsub();
  }, [handlePortChange]);

  const effectiveRole: UserRole = cloudProfile ? cloudProfile.role : 'visitor';
  const isAuthenticated = Boolean(firebaseUser && firebaseUser.emailVerified && cloudProfile);
  const isLiveFirestoreMode = isAuthenticated;
  const activeProfile: UserProfile | null = cloudProfile;

  // Public Firestore subscriptions
  useEffect(() => {
    const unsubV = subscribeVehicles((list) => setCloudVehicles(list));
    const unsubS = subscribeCompanySettings((s) => setSettings(s));
    const unsubL = subscribeLandingContent((c) => setLandingContent(c));
    return () => {
      unsubV();
      unsubS();
      unsubL();
    };
  }, []);

  // Role-scoped authenticated Firestore subscriptions
  const realStaff = Boolean(isAuthenticated && isStaffRole(effectiveRole));
  const realAdmin = Boolean(
    isAuthenticated && (effectiveRole === 'admin' || effectiveRole === 'management')
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
    } else {
      setCloudUsers([]);
      setCloudInquiries([]);
    }

    if (realAdmin) {
      unsubs.push(subscribeAuditLogs(true, setCloudAuditLogs));
    } else {
      setCloudAuditLogs([]);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [realStaff, realAdmin, realCustomerUid]);

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

      // First-time buyer account: prompt profile completion (strictly customer or dealer)
      setNeedsProfileCompletion(true);
    } catch (err) {
      const message =
        err instanceof Error && !err.message.includes('popup-closed-by-user')
          ? err.message
          : 'Sign-in was cancelled or could not be completed. Please try again.';
      setAuthError(message);
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
    (view: AppView, opts?: { sourceMode?: 'curated' | 'live_auctions'; anchor?: string }) => {
      if (opts?.sourceMode) {
        setCatalogSourceMode(opts.sourceMode);
      }
      const targetView: AppView = view === 'catalog' ? 'home' : view;
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

  // Proforma Invoice trigger
  const openProformaForVehicle = (params: {
    vehicle: Vehicle;
    cif: CifBreakdown;
    consigneeName?: string;
    consigneeAddress?: string;
    consigneePhone?: string;
    consigneeEmail?: string;
    trackingCode?: string;
  }) => {
    const today = new Date().toISOString().slice(0, 10);
    setProformaDraft({
      invoiceNumber: createInvoiceNumber(),
      issueDate: today,
      validUntilDate: addDaysIso(effectiveSettings.invoiceValidityDays || 14),
      vehicle: params.vehicle,
      cif: params.cif,
      currency,
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
        <Navbar
          activeView={activeView}
          currency={currency}
          selectedCountryCode={selectedCountryCode}
          selectedPortId={selectedPortId}
          liveFx={liveFx}
          landingContent={landingContent}
          isAuthenticated={isAuthenticated}
          userRole={effectiveRole}
          userProfile={activeProfile}
          onNavigateView={handleNavigateView}
          onCurrencyChange={handleCurrencyChange}
          onCountryChange={handleCountryChange}
          onPortChange={(pid) => handlePortChange(pid)}
          onRefreshFx={() => void loadExchangeRates(true)}
          onOpenLogin={() => {
            setAuthError('');
            setLoginModalOpen(true);
          }}
          onSignOut={() => void handleSignOut()}
        />

        {/* Floating Compare Tray when buyer selects vehicles to compare */}
        {compareIds.length > 0 && (
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
              liveFx={liveFx}
              settings={effectiveSettings}
              selectedCountryCode={selectedCountryCode}
              selectedPortId={selectedPortId}
              catalogSourceMode={catalogSourceMode}
              landingContent={landingContent}
              testimonials={testimonials}
              compareIds={compareIds}
              canImportToFirestore={canImportToFirestore}
              onCountryChange={handleCountryChange}
              onPortChange={(pid) => handlePortChange(pid)}
              onSourceModeChange={setCatalogSourceMode}
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

          {activeView === 'track' && (
            <OrderTrackerView initialCode={trackerInitialCode} settings={effectiveSettings} />
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
              messages={messages}
              documents={documents}
              prefillVehicle={prefillSourcingVehicle}
              isLiveFirestoreMode={isLiveFirestoreMode}
              onClearPrefillVehicle={() => setPrefillSourcingVehicle(null)}
              onOpenCustomerLogin={() => {
                setAuthError('');
                setLoginModalOpen(true);
              }}
              onOpenProforma={({ vehicle, cif, trackingCode }) =>
                openProformaForVehicle({ vehicle, cif, trackingCode })
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
              liveFxRates={liveFx.rates}
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
              landingContent={landingContent}
              testimonials={testimonials}
              onNotify={notify}
              onOpenStaffLogin={() => {
                setAuthError('');
                setLoginModalOpen(true);
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
                if (isLiveFirestoreMode) {
                  const qNum = await createQuotation({
                    ...input,
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
                if (isLiveFirestoreMode) {
                  const orderNumber = await convertQuotationToOrder(quotation);
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
                notify(`Updated user role to ${updates.role.toUpperCase()}`);
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

        <Footer
          landingContent={landingContent}
          onNavigateView={handleNavigateView}
          onOpenPolicy={(policy) => setActivePolicy(policy)}
        />

        <FloatingUtilities whatsappPhone={landingContent.contactWhatsapp} />

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

        {/* Single Universal Login Modal */}
        {loginModalOpen && (
          <UniversalLoginModal
            isAuthenticated={Boolean(firebaseUser)}
            needsProfileCompletion={needsProfileCompletion}
            currentEmail={firebaseUser?.email || ''}
            currentDisplayName={firebaseUser?.displayName || ''}
            userProfile={activeProfile}
            authError={authError}
            isSigningIn={isSigningIn}
            onGoogleSignIn={handleUniversalGoogleSignIn}
            onCompleteBuyerProfile={handleCompleteBuyerProfile}
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
