import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { CheckCircle2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminVehicleModal } from './components/AdminVehicleModal';
import { ComparisonModal } from './components/ComparisonModal';
import { DualLoginModal } from './components/DualLoginModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { ProformaInvoiceModal } from './components/ProformaInvoiceModal';
import { QuickQuoteModal } from './components/QuickQuoteModal';
import { VehicleDetailModal } from './components/VehicleDetailModal';
import { WorkflowStatusModal } from './components/WorkflowStatusModal';
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
import { auth, googleProvider } from './lib/firebase';
import {
  adminUpdateUser,
  clearSampleTradeData,
  convertQuotationToOrder,
  createExportDocument,
  createQuotation,
  createSourcingRequest,
  deleteExportDocument,
  deleteVehicle,
  getUserProfile,
  placeAuctionBidWithGuard,
  postOrderMessage,
  recordAuditLog,
  respondToQuotation,
  saveCompanySettings,
  seedFullTradeDatabase,
  subscribeAuditLogs,
  subscribeCompanySettings,
  subscribeDocuments,
  subscribeInquiries,
  subscribeOrderMessages,
  subscribeOrders,
  subscribeQuotations,
  subscribeSourcingRequests,
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
  ExportDocument,
  ExportOrder,
  Inquiry,
  LoginPortalType,
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
import { CatalogView } from './views/CatalogView';
import { CustomerPortalView, type CustomerPortalTab } from './views/CustomerPortalView';
import { HowToBuyView } from './views/HowToBuyView';
import { OrderTrackerView } from './views/OrderTrackerView';
import { ShippingRatesView } from './views/ShippingRatesView';
import { StaffConsoleView } from './views/StaffConsoleView';

const BOOTSTRAP_ADMIN_EMAIL = 'techhub.wali@gmail.com';

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

export default function App() {
  // Navigation & Global Trade Preferences
  const [activeView, setActiveView] = useState<AppView>('catalog');
  const [customerTab, setCustomerTab] = useState<CustomerPortalTab>('profile');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [selectedPortId, setSelectedPortId] = useState<string>('mombasa-ke');

  // Auth & Dual Portal State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [cloudProfile, setCloudProfile] = useState<UserProfile | null>(null);
  const [demoRoleOverride, setDemoRoleOverride] = useState<UserRole | null>(null);
  const [demoCustomerUid, setDemoCustomerUid] = useState<string>('cust-kenya-01');
  const [loginModalPortal, setLoginModalPortal] = useState<LoginPortalType | null>(null);
  const [needsCustomerRegistration, setNeedsCustomerRegistration] = useState(false);
  const [crossPortalError, setCrossPortalError] = useState('');

  // Cloud Datasets
  const [cloudVehicles, setCloudVehicles] = useState<Vehicle[]>([]);
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [cloudUsers, setCloudUsers] = useState<UserProfile[]>([]);
  const [cloudRequests, setCloudRequests] = useState<SourcingRequest[]>([]);
  const [cloudQuotations, setCloudQuotations] = useState<Quotation[]>([]);
  const [cloudOrders, setCloudOrders] = useState<ExportOrder[]>([]);
  const [cloudMessages, setCloudMessages] = useState<OrderMessage[]>([]);
  const [cloudDocs, setCloudDocs] = useState<ExportDocument[]>([]);
  const [cloudAuditLogs, setCloudAuditLogs] = useState<AuditLogEntry[]>([]);
  const [cloudInquiries, setCloudInquiries] = useState<Inquiry[]>([]);

  // Local interactive demo-preview state (used seamlessly when testing roles without Firebase login)
  const [localUsers, setLocalUsers] = useState<UserProfile[]>(DEMO_USERS);
  const [localRequests, setLocalRequests] = useState<SourcingRequest[]>(SEED_SOURCING_REQUESTS);
  const [localQuotations, setLocalQuotations] = useState<Quotation[]>(SEED_QUOTATIONS);
  const [localOrders, setLocalOrders] = useState<ExportOrder[]>(SEED_ORDERS);
  const [localMessages, setLocalMessages] = useState<OrderMessage[]>(SEED_MESSAGES);
  const [localDocs, setLocalDocs] = useState<ExportDocument[]>(SEED_DOCUMENTS);
  const [localAuditLogs, setLocalAuditLogs] = useState<AuditLogEntry[]>(SEED_AUDIT_LOGS);

  // Modals & Interactive Overlays
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [prefillSourcingVehicle, setPrefillSourcingVehicle] = useState<Vehicle | null>(null);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
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

  // Resolve real Firebase Auth session & profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setCloudProfile(null);
        setNeedsCustomerRegistration(false);
        return;
      }
      const existing = await getUserProfile(user.uid);
      if (existing) {
        setCloudProfile(existing);
        setNeedsCustomerRegistration(false);
        if (existing.defaultPortId) setSelectedPortId(existing.defaultPortId);
      } else if (user.email === BOOTSTRAP_ADMIN_EMAIL && user.emailVerified) {
        setCloudProfile({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'AUZIO Trade Director',
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
        setNeedsCustomerRegistration(false);
      } else {
        setCloudProfile(null);
      }
    });
    return () => unsub();
  }, []);

  // Compute effective role & profile (real Firebase auth unless overridden by Quick-Demo Role Switcher)
  const effectiveRole: UserRole = useMemo(() => {
    if (demoRoleOverride !== null) return demoRoleOverride;
    if (cloudProfile) return cloudProfile.role;
    return 'visitor';
  }, [demoRoleOverride, cloudProfile]);

  const isLiveFirestoreMode = Boolean(
    firebaseUser && firebaseUser.emailVerified && demoRoleOverride === null && cloudProfile
  );

  const activeProfile: UserProfile | null = useMemo(() => {
    if (effectiveRole === 'visitor') return null;
    if (isLiveFirestoreMode && cloudProfile) return cloudProfile;
    if (effectiveRole === 'customer') {
      return (
        localUsers.find((u) => u.uid === demoCustomerUid) ||
        localUsers.find((u) => u.role === 'customer') ||
        null
      );
    }
    return localUsers.find((u) => u.role === effectiveRole) || null;
  }, [effectiveRole, isLiveFirestoreMode, cloudProfile, localUsers, demoCustomerUid]);

  // Public subscriptions (always safe per firestore.rules)
  useEffect(() => {
    const unsubV = subscribeVehicles((list) => setCloudVehicles(list));
    const unsubS = subscribeCompanySettings((s) => setSettings(s));
    return () => {
      unsubV();
      unsubS();
    };
  }, []);

  // Role-scoped authenticated Firestore subscriptions
  const realStaff = Boolean(
    firebaseUser?.emailVerified &&
      cloudProfile &&
      (cloudProfile.role === 'sales' ||
        cloudProfile.role === 'operations' ||
        cloudProfile.role === 'admin')
  );
  const realAdmin = Boolean(
    firebaseUser?.emailVerified && cloudProfile && cloudProfile.role === 'admin'
  );
  const realCustomerUid =
    firebaseUser?.emailVerified && cloudProfile?.role === 'customer' ? firebaseUser.uid : null;

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

  // Resolved datasets (live cloud data when present, clean fallback to SEED data for preview/unseeded DB)
  const vehicles = useMemo(
    () => (cloudVehicles.length > 0 ? cloudVehicles : SEED_VEHICLES),
    [cloudVehicles]
  );
  const persistedVehicleIds = useMemo(
    () => new Set(cloudVehicles.map((v) => v.id)),
    [cloudVehicles]
  );

  const users = isLiveFirestoreMode && cloudUsers.length > 0 ? cloudUsers : localUsers;
  const sourcingRequests =
    isLiveFirestoreMode && cloudRequests.length > 0 ? cloudRequests : isLiveFirestoreMode ? cloudRequests : localRequests;
  const quotations =
    isLiveFirestoreMode && cloudQuotations.length > 0 ? cloudQuotations : isLiveFirestoreMode ? cloudQuotations : localQuotations;
  const orders =
    isLiveFirestoreMode && cloudOrders.length > 0 ? cloudOrders : isLiveFirestoreMode ? cloudOrders : localOrders;
  const messages =
    isLiveFirestoreMode && cloudMessages.length > 0 ? cloudMessages : isLiveFirestoreMode ? cloudMessages : localMessages;
  const documents =
    isLiveFirestoreMode && cloudDocs.length > 0 ? cloudDocs : isLiveFirestoreMode ? cloudDocs : localDocs;
  const auditLogs =
    isLiveFirestoreMode && cloudAuditLogs.length > 0 ? cloudAuditLogs : localAuditLogs;

  // Dual Login Flow with Strict Cross-Portal Blocking
  const handleGoogleSignIn = async (portal: LoginPortalType) => {
    setCrossPortalError('');
    setNeedsCustomerRegistration(false);
    const cred = await signInWithPopup(auth, googleProvider);
    const user = cred.user;
    const profile = await getUserProfile(user.uid);
    const isBootstrapAdmin = user.email === BOOTSTRAP_ADMIN_EMAIL && user.emailVerified;

    if (portal === 'customer') {
      if (isBootstrapAdmin || (profile && profile.role !== 'customer')) {
        await signOut(auth);
        setCrossPortalError(
          'Access Blocked: This Google account belongs to AUZIO TRADERS Staff/Management. Please sign in through the Management / Staff / Admin Login Portal instead.'
        );
        return;
      }
      if (!profile) {
        setNeedsCustomerRegistration(true);
        return;
      }
      setDemoRoleOverride(null);
      setCloudProfile(profile);
      setLoginModalPortal(null);
      setActiveView('customer_portal');
      void recordAuditLog({
        actorRole: 'customer',
        action: 'login_success',
        targetType: 'user',
        targetId: user.uid,
        summary: `Dealer signed in: ${profile.companyName} (${user.email}).`,
      });
      notify(`Signed in to Dealer Portal as ${profile.companyName}`);
    } else {
      // Staff / Admin Portal
      if (profile && profile.role === 'customer') {
        await signOut(auth);
        setCrossPortalError(
          'Access Blocked: Customer / Dealer accounts cannot sign in to the Management / Staff Portal. Please use the Customer / Dealer Login Portal.'
        );
        return;
      }
      if (!profile && !isBootstrapAdmin) {
        await signOut(auth);
        setCrossPortalError(
          'Access Denied: Your Google account is not registered as authorized AUZIO TRADERS staff. Contact an Administrator or use the Customer / Dealer Portal.'
        );
        return;
      }
      setDemoRoleOverride(null);
      setLoginModalPortal(null);
      setActiveView('staff_console');
      void recordAuditLog({
        actorRole: profile?.role || 'admin',
        action: 'staff_login_success',
        targetType: 'user',
        targetId: user.uid,
        summary: `Staff/Admin signed in: ${user.email}.`,
      });
      notify('Signed in to AUZIO TRADERS Staff Operations Console');
    }
  };

  const handleDemoRoleSwitch = (nextRole: UserRole, customerUid?: string) => {
    if (nextRole === 'visitor') {
      setDemoRoleOverride('visitor');
      if (activeView === 'customer_portal' || activeView === 'staff_console') {
        setActiveView('catalog');
      }
      notify('Switched to Public Visitor view');
      return;
    }
    setDemoRoleOverride(nextRole);
    if (nextRole === 'customer') {
      const targetUid = customerUid || 'cust-kenya-01';
      setDemoCustomerUid(targetUid);
      const demo = localUsers.find((u) => u.uid === targetUid);
      if (demo?.defaultPortId) setSelectedPortId(demo.defaultPortId);
      setActiveView('customer_portal');
      notify(`Demo Preview: ${demo?.companyName || 'Customer / Dealer'}`);
    } else {
      setActiveView('staff_console');
      notify(`Demo Preview: ${nextRole.toUpperCase()} Console`);
    }
  };

  const handleSignOut = async () => {
    setDemoRoleOverride(null);
    if (firebaseUser) {
      await signOut(auth);
    }
    if (activeView === 'customer_portal' || activeView === 'staff_console') {
      setActiveView('catalog');
    }
    notify('Signed out safely');
  };

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
      validUntilDate: addDaysIso(settings.invoiceValidityDays || 14),
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
    if (effectiveRole === 'customer') {
      setCustomerTab('sourcing');
      setActiveView('customer_portal');
    } else {
      setCrossPortalError('');
      setLoginModalPortal('customer');
      notify('Sign in or select a demo dealer account to authorize an auction bid.');
    }
  };

  const handleOpenSourcingWizard = () => {
    if (effectiveRole === 'customer') {
      setCustomerTab('sourcing');
      setActiveView('customer_portal');
    } else {
      setCrossPortalError('');
      setLoginModalPortal('customer');
    }
  };

  const canImportToFirestore =
    effectiveRole === 'operations' || effectiveRole === 'admin';

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

  const activeUserLabel = useMemo(() => {
    if (effectiveRole === 'visitor') return '';
    if (effectiveRole === 'customer') {
      return activeProfile?.companyName || 'Dealer Portal';
    }
    return `${effectiveRole.toUpperCase()} Console`;
  }, [effectiveRole, activeProfile]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <Navbar
          activeView={activeView}
          onNavigate={(v) => setActiveView(v)}
          currency={currency}
          onCurrencyChange={setCurrency}
          selectedPortId={selectedPortId}
          onPortChange={(pid) => {
            setSelectedPortId(pid);
            notify('CIF discharge port updated across portal');
          }}
          compareCount={compareIds.length}
          onOpenCompare={() => setCompareOpen(true)}
          onOpenWorkflowStatus={() => setWorkflowModalOpen(true)}
          effectiveRole={effectiveRole}
          activeUserLabel={activeUserLabel}
          isSignedInFirebase={Boolean(firebaseUser && demoRoleOverride === null)}
          onOpenLoginPortal={(portal) => {
            setCrossPortalError('');
            setLoginModalPortal(portal);
          }}
          onDemoRoleSwitch={handleDemoRoleSwitch}
          onSignOut={() => void handleSignOut()}
        />

        <main className="flex-1">
          {activeView === 'catalog' && (
            <CatalogView
              vehicles={vehicles}
              currency={currency}
              selectedPortId={selectedPortId}
              settings={settings}
              compareIds={compareIds}
              canImportToFirestore={canImportToFirestore}
              onRegisterLiveVehicles={handleRegisterLiveVehicles}
              onImportLiveLot={(lot) => setImportingLiveLot(lot)}
              onToggleCompare={handleToggleCompare}
              onSelectVehicle={(v) => setSelectedVehicle(v)}
              onOpenProforma={({ vehicle, cif }) => openProformaForVehicle({ vehicle, cif })}
              onStartBidRequest={handleStartBidRequest}
              onOpenSourcingWizard={handleOpenSourcingWizard}
              onOpenWorkflowStatus={() => setWorkflowModalOpen(true)}
              onNavigateShipping={() => setActiveView('shipping')}
            />
          )}

          {activeView === 'shipping' && (
            <ShippingRatesView
              currency={currency}
              selectedPortId={selectedPortId}
              settings={settings}
              onSelectPort={(pid) => {
                setSelectedPortId(pid);
                notify('Active CIF port updated across all vehicle listings');
              }}
              onOpenWorkflowStatus={() => setWorkflowModalOpen(true)}
            />
          )}

          {activeView === 'how_to_buy' && (
            <HowToBuyView
              settings={settings}
              onOpenLoginPortal={(portal) => {
                setCrossPortalError('');
                setLoginModalPortal(portal);
              }}
              onNavigateCatalog={() => setActiveView('catalog')}
            />
          )}

          {activeView === 'track' && (
            <OrderTrackerView initialCode={trackerInitialCode} settings={settings} />
          )}

          {activeView === 'customer_portal' && (
            <CustomerPortalView
              activeTab={customerTab}
              onTabChange={setCustomerTab}
              profile={effectiveRole === 'customer' ? activeProfile : null}
              currency={currency}
              settings={settings}
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
                setCrossPortalError('');
                setLoginModalPortal('customer');
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
                setSelectedPortId(updates.defaultPortId);
                notify('Dealership profile & default CIF port saved');
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
                  setLocalAuditLogs((prev) => [
                    {
                      id: `aud-${Date.now()}`,
                      actorUid: activeProfile.uid,
                      actorEmail: activeProfile.email,
                      actorRole: 'customer',
                      action: decision === 'approved' ? 'quote_approved' : 'quote_declined',
                      targetType: 'quotation',
                      targetId: quotation.id,
                      summary:
                        decision === 'approved'
                          ? `Approved ${quotation.quoteNumber} and authorized Max Bid Ceiling $${quotation.authorizedMaxBidUsd.toLocaleString()} USD.`
                          : `Declined ${quotation.quoteNumber}: ${declineReason || 'No reason'}.`,
                    },
                    ...prev,
                  ]);
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
                    senderRole: 'customer',
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
                      senderRole: 'customer',
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
              settings={settings}
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
              onNotify={notify}
              onOpenStaffLogin={() => {
                setCrossPortalError('');
                setLoginModalPortal('staff');
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
                      validUntil: addDaysIso(14),
                    },
                    ...prev,
                  ]);
                  notify(`Issued Quotation ${qNum} to ${input.customerCompany}`);
                }
              }}
              onConvertQuoteToOrder={async (q) => {
                if (isLiveFirestoreMode) {
                  const ordNum = await convertQuotationToOrder(q);
                  notify(`Opened Export Order ${ordNum}`);
                } else {
                  const ordNum = `ORD-AUZ-2026-${Math.floor(710 + Math.random() * 289)}`;
                  const newOrder: ExportOrder = {
                    id: `ord-${Date.now()}`,
                    orderNumber: ordNum,
                    trackingCode: `AUZ-2026-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                    quotationId: q.id,
                    customerId: q.customerId,
                    customerName: q.customerName,
                    customerCompany: q.customerCompany,
                    vehicleId: q.vehicleId || 'GENERAL',
                    vehicleStockCode: q.stockCode,
                    vehicleTitle: q.vehicleTitle,
                    listingType: 'auction_listing',
                    destinationCountry: q.destinationPortName.split(',').pop()?.trim() || 'Kenya',
                    destinationPortId: q.destinationPortId,
                    destinationPortName: q.destinationPortName,
                    shippingMethod: 'roro',
                    fobUsd: q.fobVehicleUsd,
                    freightUsd: q.seaFreightUsd,
                    inspectionUsd: q.jevicInspectionUsd,
                    insuranceUsd: q.marineInsuranceUsd,
                    totalCifUsd: q.totalCifUsd,
                    currency: q.currency,
                    authorizedMaxBidUsd: q.authorizedMaxBidUsd,
                    placedBidUsd: 0,
                    milestone: 'customer_approved',
                    vesselName: '',
                    voyageNumber: '',
                    blNumber: '',
                    etdDate: '',
                    etaDate: '',
                    scheduleIsEstimate: true,
                  };
                  setLocalOrders((prev) => [newOrder, ...prev]);
                  notify(`Opened Export Order ${ordNum}`);
                }
              }}
              onPlaceAuctionBid={async (ord, bidAmountUsd) => {
                if (isLiveFirestoreMode) {
                  return placeAuctionBidWithGuard({
                    order: ord,
                    bidAmountUsd,
                    actorRole: effectiveRole,
                  });
                }
                const bid = Math.round(bidAmountUsd);
                if (ord.authorizedMaxBidUsd > 0 && bid > ord.authorizedMaxBidUsd) {
                  setLocalAuditLogs((prev) => [
                    {
                      id: `aud-${Date.now()}`,
                      actorUid: activeProfile?.uid || 'staff-sales-01',
                      actorEmail: activeProfile?.email || 'k.takahashi@auziotraders.com',
                      actorRole: effectiveRole,
                      action: 'bid_blocked',
                      targetType: 'order',
                      targetId: ord.id,
                      summary: `BLOCKED bid of $${bid.toLocaleString()} USD exceeding authorized ceiling $${ord.authorizedMaxBidUsd.toLocaleString()} USD on ${ord.orderNumber}.`,
                    },
                    ...prev,
                  ]);
                  return {
                    ok: false,
                    error: `Bid Ceiling Guard: $${bid.toLocaleString()} USD exceeds customer's authorized ceiling of $${ord.authorizedMaxBidUsd.toLocaleString()} USD. Bid strictly blocked and logged.`,
                  };
                }
                setLocalOrders((prev) =>
                  prev.map((o) =>
                    o.id === ord.id ? { ...o, placedBidUsd: bid, milestone: 'bid_placed' } : o
                  )
                );
                setLocalAuditLogs((prev) => [
                  {
                    id: `aud-${Date.now()}`,
                    actorUid: activeProfile?.uid || 'staff-sales-01',
                    actorEmail: activeProfile?.email || 'k.takahashi@auziotraders.com',
                    actorRole: effectiveRole,
                    action: 'bid_placed',
                    targetType: 'order',
                    targetId: ord.id,
                    summary: `Placed auction bid of $${bid.toLocaleString()} USD (within $${ord.authorizedMaxBidUsd.toLocaleString()} ceiling) on ${ord.orderNumber}.`,
                  },
                  ...prev,
                ]);
                return { ok: true };
              }}
              onUpdateOrderLogistics={async (params) => {
                if (isLiveFirestoreMode) {
                  await updateOrderLogistics({ ...params, actorRole: effectiveRole });
                } else {
                  setLocalOrders((prev) =>
                    prev.map((o) =>
                      o.id === params.order.id
                        ? {
                            ...o,
                            milestone: params.milestone,
                            vesselName: params.vesselName,
                            voyageNumber: params.voyageNumber,
                            blNumber: params.blNumber,
                            etdDate: params.etdDate,
                            etaDate: params.etaDate,
                            scheduleIsEstimate: params.scheduleIsEstimate,
                          }
                        : o
                    )
                  );
                }
                notify(`Updated ${params.order.orderNumber} logistics & milestone`);
              }}
              onPostOrderMessage={async ({ order, body, isInternalStaffOnly }) => {
                const senderRole =
                  effectiveRole === 'sales' ||
                  effectiveRole === 'operations' ||
                  effectiveRole === 'admin'
                    ? effectiveRole
                    : 'operations';
                if (isLiveFirestoreMode) {
                  await postOrderMessage({
                    orderId: order.id,
                    customerId: order.customerId,
                    senderUid: activeProfile?.uid || 'staff-ops-01',
                    senderName: activeProfile?.displayName || 'AUZIO Operations',
                    senderRole,
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
                      senderName: activeProfile?.displayName || 'AUZIO Operations',
                      senderRole,
                      body,
                      isInternalStaffOnly,
                    },
                  ]);
                }
                notify(
                  isInternalStaffOnly
                    ? 'Confidential internal staff note saved (hidden from customer)'
                    : 'Customer-visible update posted'
                );
              }}
              onArchiveVehicle={async (v) => {
                if (isLiveFirestoreMode) {
                  await updateVehicleStatus(v, 'archived');
                }
                notify(`Archived ${v.stockCode}`);
              }}
              onDeleteVehicle={async (id) => {
                if (isLiveFirestoreMode) {
                  await deleteVehicle(id);
                }
                notify('Vehicle deleted from inventory');
              }}
              onCreateDocument={async (input) => {
                if (isLiveFirestoreMode) {
                  await createExportDocument({
                    ...input,
                    uploadedByName: activeProfile?.displayName || 'Mayumi Sato',
                  });
                } else {
                  setLocalDocs((prev) => [
                    {
                      id: `doc-${Date.now()}`,
                      ...input,
                      uploadedByName: activeProfile?.displayName || 'Mayumi Sato',
                    },
                    ...prev,
                  ]);
                }
                notify(`Published document: ${input.title}`);
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
                    ? `"${docRecord.title}" is now visible in Customer Vault`
                    : `"${docRecord.title}" restricted to Staff-Only`
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
                notify('User role & verification updated');
              }}
              onSaveSettings={async (next) => {
                if (isLiveFirestoreMode) {
                  await saveCompanySettings(next);
                } else {
                  setSettings(next);
                }
                notify('SMBC banking & FX rates saved');
              }}
              onSeedDatabase={async () => {
                if (isLiveFirestoreMode) {
                  await seedFullTradeDatabase();
                  notify('Full AUZIO TRADERS sample database seeded to Firestore');
                } else {
                  setLocalUsers(DEMO_USERS);
                  setLocalRequests(SEED_SOURCING_REQUESTS);
                  setLocalQuotations(SEED_QUOTATIONS);
                  setLocalOrders(SEED_ORDERS);
                  setLocalMessages(SEED_MESSAGES);
                  setLocalDocs(SEED_DOCUMENTS);
                  setLocalAuditLogs(SEED_AUDIT_LOGS);
                  notify('Demo datasets reset (sign in as Admin to seed live Firestore)');
                }
              }}
              onClearSampleData={async () => {
                if (isLiveFirestoreMode) {
                  await clearSampleTradeData();
                  notify('Cleared sample trade collections from Firestore');
                } else {
                  setLocalRequests([]);
                  setLocalQuotations([]);
                  setLocalOrders([]);
                  setLocalMessages([]);
                  setLocalDocs([]);
                  notify('Cleared demo preview collections');
                }
              }}
            />
          )}
        </main>

        <Footer
          settings={settings}
          onNavigate={setActiveView}
          onOpenLoginPortal={(portal) => {
            setCrossPortalError('');
            setLoginModalPortal(portal);
          }}
          onOpenWorkflowStatus={() => setWorkflowModalOpen(true)}
        />

        {/* Vehicle Specifications & CIF Detail Modal */}
        {selectedVehicle && (
          <VehicleDetailModal
            vehicle={selectedVehicle}
            currency={currency}
            defaultPortId={selectedPortId}
            settings={settings}
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

        {/* Side-by-Side Comparison Matrix Modal (up to 4 units) */}
        {compareOpen && compareVehiclesList.length > 0 && (
          <ComparisonModal
            vehicles={compareVehiclesList}
            currency={currency}
            portId={selectedPortId}
            settings={settings}
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
            settings={settings}
            onClose={() => setProformaDraft(null)}
          />
        )}

        {/* Quick Visitor Inquiry / 48h Hold Modal */}
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
            settings={settings}
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

        {/* Platform & Workflow Status Honesty Disclosure Modal */}
        {workflowModalOpen && (
          <WorkflowStatusModal settings={settings} onClose={() => setWorkflowModalOpen(false)} />
        )}

        {/* Dual Login Modal (Customer/Dealer vs Management/Staff/Admin) */}
        {loginModalPortal && (
          <DualLoginModal
            portalType={loginModalPortal}
            firebaseUser={firebaseUser}
            needsCustomerRegistration={needsCustomerRegistration}
            crossPortalError={crossPortalError}
            onGoogleSignIn={handleGoogleSignIn}
            onRegistrationComplete={(profile) => {
              setDemoRoleOverride(null);
              setCloudProfile(profile);
              setNeedsCustomerRegistration(false);
              setSelectedPortId(profile.defaultPortId);
              setActiveView('customer_portal');
              notify(`Dealer account activated for ${profile.companyName}`);
            }}
            onSelectDemoRole={handleDemoRoleSwitch}
            onClose={() => {
              setLoginModalPortal(null);
              setCrossPortalError('');
            }}
          />
        )}

        {/* Non-blocking Toast */}
        {toast && (
          <div className="no-print fixed bottom-5 right-5 z-50 max-w-md bg-slate-950 text-white border border-slate-700 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 text-xs">
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
