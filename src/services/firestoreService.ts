import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
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
} from '../data/seedData';
import { DEFAULT_LANDING_CONTENT } from '../data/landingDefaults';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  ApiErrorLogEntry,
  ApiIntegrationConfig,
  AuditLogEntry,
  CompanySettings,
  CurrencyCode,
  CustomerTestimonial,
  ExchangeRateCacheDoc,
  ExportDocType,
  ExportDocument,
  ExportOrder,
  FinanceRecord,
  HrEmployee,
  HrLeaveRequest,
  Inquiry,
  LandingPageContent,
  ListingType,
  LiveVesselTelemetry,
  OrderMessage,
  OrderMilestone,
  OrderStatusRecord,
  PersistedUserRole,
  Quotation,
  RegisteredVessel,
  RolePermissionsMap,
  SalesTarget,
  ShippingMethod,
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
  VehicleStatus,
} from '../types/portal';

function toMillis(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'object' && val !== null && 'toMillis' in val) {
    return (val as Timestamp).toMillis();
  }
  return 0;
}

export function generateTrackingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `AUZ-2026-${suffix}`;
}

export function generateDocumentId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export function subscribeVehicles(
  onData: (vehicles: Vehicle[], fromCloud: boolean) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(
    collection(db, 'vehicles'),
    where('status', 'in', ['available', 'reserved', 'sold', 'archived'])
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Vehicle[] = snapshot.docs
        .map((snap) => ({
          id: snap.id,
          ...(snap.data() as Omit<Vehicle, 'id'>),
        }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

      onData(list, true);
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'vehicles');
      } catch {
        // Logged
      }
    }
  );
}

export function subscribeCompanySettings(
  onData: (settings: CompanySettings) => void
): Unsubscribe {
  const ref = doc(db, 'companySettings', 'exportProfile');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as CompanySettings;
        onData({
          ...DEFAULT_COMPANY_SETTINGS,
          ...data,
          exchangeRates: {
            ...DEFAULT_COMPANY_SETTINGS.exchangeRates,
            ...(data.exchangeRates || {}),
          },
        });
      } else {
        onData(DEFAULT_COMPANY_SETTINGS);
      }
    },
    () => {
      onData(DEFAULT_COMPANY_SETTINGS);
    }
  );
}

export function subscribeUsers(
  isStaff: boolean,
  onData: (users: UserProfile[]) => void
): Unsubscribe {
  if (!isStaff) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as UserProfile)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } catch {
        // Logged
      }
    }
  );
}

export function subscribeSourcingRequests(
  isStaff: boolean,
  customerUid: string | null,
  onData: (items: SourcingRequest[]) => void
): Unsubscribe {
  if (!isStaff && !customerUid) {
    onData([]);
    return () => {};
  }
  const q = isStaff
    ? query(collection(db, 'sourcingRequests'))
    : query(collection(db, 'sourcingRequests'), where('customerId', '==', customerUid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<SourcingRequest, 'id'>) }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'sourcingRequests');
      } catch {
        // Logged
      }
    }
  );
}

export function subscribeQuotations(
  isStaff: boolean,
  customerUid: string | null,
  onData: (items: Quotation[]) => void
): Unsubscribe {
  if (!isStaff && !customerUid) {
    onData([]);
    return () => {};
  }
  const q = isStaff
    ? query(collection(db, 'quotations'))
    : query(collection(db, 'quotations'), where('customerId', '==', customerUid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Quotation, 'id'>) }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'quotations');
      } catch {
        // Logged
      }
    }
  );
}

export function subscribeOrders(
  isStaff: boolean,
  customerUid: string | null,
  onData: (items: ExportOrder[]) => void
): Unsubscribe {
  if (!isStaff && !customerUid) {
    onData([]);
    return () => {};
  }
  const q = isStaff
    ? query(collection(db, 'orders'))
    : query(collection(db, 'orders'), where('customerId', '==', customerUid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ExportOrder, 'id'>) }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      } catch {
        // Logged
      }
    }
  );
}

export function subscribeOrderMessages(
  isStaff: boolean,
  customerUid: string | null,
  onData: (items: OrderMessage[]) => void
): Unsubscribe {
  if (!isStaff && !customerUid) {
    onData([]);
    return () => {};
  }
  const q = isStaff
    ? query(collection(db, 'orderMessages'))
    : query(
        collection(db, 'orderMessages'),
        where('customerId', '==', customerUid),
        where('isInternalStaffOnly', '==', false)
      );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<OrderMessage, 'id'>) }))
        .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'orderMessages');
      } catch {
        // Logged
      }
    }
  );
}

export function subscribeDocuments(
  isStaff: boolean,
  customerUid: string | null,
  onData: (items: ExportDocument[]) => void
): Unsubscribe {
  if (!isStaff && !customerUid) {
    onData([]);
    return () => {};
  }
  const q = isStaff
    ? query(collection(db, 'documents'))
    : query(
        collection(db, 'documents'),
        where('customerId', '==', customerUid),
        where('isCustomerVisible', '==', true)
      );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ExportDocument, 'id'>) }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'documents');
      } catch {
        // Logged
      }
    }
  );
}

export function subscribeAuditLogs(
  isAdmin: boolean,
  onData: (items: AuditLogEntry[]) => void
): Unsubscribe {
  if (!isAdmin) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'auditLogs'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogEntry, 'id'>) }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'auditLogs');
      } catch {
        // Logged
      }
    }
  );
}

export function subscribeInquiries(
  isStaff: boolean,
  onData: (inquiries: Inquiry[]) => void
): Unsubscribe {
  if (!isStaff) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'inquiries'),
    (snapshot) => {
      const list: Inquiry[] = snapshot.docs
        .map((snap) => ({
          id: snap.id,
          ...(snap.data() as Omit<Inquiry, 'id'>),
        }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'inquiries');
      } catch {
        // Logged
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Audit Logger
// ---------------------------------------------------------------------------

export async function recordAuditLog(params: {
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;
  const id = generateDocumentId('aud');
  try {
    await setDoc(doc(db, 'auditLogs', id), {
      actorUid: user.uid,
      actorEmail: (user.email || 'unknown@auziotraders.com').slice(0, 120),
      actorRole: params.actorRole,
      action: params.action.slice(0, 64),
      targetType: params.targetType.slice(0, 40),
      targetId: params.targetId.slice(0, 128),
      summary: params.summary.slice(0, 400),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking audit logging
  }
}

// ---------------------------------------------------------------------------
// User Profiles & Auth Registration
// ---------------------------------------------------------------------------

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch {
    return null;
  }
}

export function subscribeOwnUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    () => {
      // Ignore transient read errors while account is initializing
    }
  );
}

export async function registerCustomerProfile(input: {
  uid: string;
  email: string;
  accountType?: 'customer' | 'dealer';
  displayName: string;
  companyName: string;
  country: string;
  defaultPortId: string;
  phone: string;
  consigneeAddress: string;
}): Promise<UserProfile> {
  const path = `users/${input.uid}`;
  const chosenRole: PersistedUserRole = input.accountType === 'dealer' ? 'dealer' : 'customer';
  const payload: UserProfile = {
    uid: input.uid,
    email: input.email.trim().slice(0, 120),
    displayName: input.displayName.trim().slice(0, 100),
    role: chosenRole,
    accountStatus: 'active',
    companyName: input.companyName.trim().slice(0, 120),
    country: input.country.trim().slice(0, 80),
    defaultPortId: input.defaultPortId.trim().slice(0, 64),
    phone: input.phone.trim().slice(0, 40),
    consigneeAddress: input.consigneeAddress.trim().slice(0, 240),
    assignedRepName: 'Kenji Takahashi',
    assignedRepEmail: 'k.takahashi@auziotraders.com',
    verified: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', input.uid), payload);
    void recordAuditLog({
      actorRole: chosenRole,
      action: 'customer_registered',
      targetType: 'user',
      targetId: input.uid,
      summary: `Registered ${chosenRole} account for ${payload.companyName || payload.displayName} (${payload.country}).`,
    });
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCustomerProfile(
  uid: string,
  updates: {
    displayName: string;
    companyName: string;
    country: string;
    defaultPortId: string;
    phone: string;
    consigneeAddress: string;
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: updates.displayName.trim().slice(0, 100),
      companyName: updates.companyName.trim().slice(0, 120),
      country: updates.country.trim().slice(0, 80),
      defaultPortId: updates.defaultPortId.trim().slice(0, 64),
      phone: updates.phone.trim().slice(0, 40),
      consigneeAddress: updates.consigneeAddress.trim().slice(0, 240),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateUser(
  uid: string,
  updates: {
    role: PersistedUserRole;
    verified: boolean;
    assignedRepName: string;
    assignedRepEmail: string;
    department?: string;
    designationLevel?: UserProfile['designationLevel'];
    employeeCode?: string;
    reportingManagerName?: string;
    accountStatus?: UserProfile['accountStatus'];
    twoFactorRequired?: boolean;
    permissions?: RolePermissionsMap;
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const payload: Record<string, unknown> = {
      role: updates.role,
      verified: Boolean(updates.verified),
      assignedRepName: updates.assignedRepName.trim().slice(0, 100),
      assignedRepEmail: updates.assignedRepEmail.trim().slice(0, 120),
      updatedAt: serverTimestamp(),
    };
    if (typeof updates.department === 'string') {
      payload.department = updates.department.trim().slice(0, 60);
    }
    if (updates.designationLevel) {
      payload.designationLevel = updates.designationLevel;
    }
    if (typeof updates.employeeCode === 'string') {
      payload.employeeCode = updates.employeeCode.trim().slice(0, 32);
    }
    if (typeof updates.reportingManagerName === 'string') {
      payload.reportingManagerName = updates.reportingManagerName.trim().slice(0, 100);
    }
    if (updates.accountStatus) {
      payload.accountStatus = updates.accountStatus;
    }
    if (typeof updates.twoFactorRequired === 'boolean') {
      payload.twoFactorRequired = updates.twoFactorRequired;
    }
    if (updates.permissions) {
      payload.permissions = updates.permissions;
    }
    await updateDoc(doc(db, 'users', uid), payload);
    void recordAuditLog({
      actorRole: 'admin',
      action:
        updates.accountStatus === 'suspended'
          ? 'employee_account_suspended'
          : 'user_permissions_updated',
      targetType: 'user',
      targetId: uid,
      summary: `Updated user ${uid}: role=${updates.role}, status=${updates.accountStatus || 'active'}, verified=${String(updates.verified)}${updates.permissions ? ', granular permissions saved' : ''}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Sourcing Requests
// ---------------------------------------------------------------------------

export async function createSourcingRequest(input: {
  customerId: string;
  customerName: string;
  customerCompany: string;
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
}): Promise<string> {
  if (!input.maxBidAcknowledged) {
    throw new Error('You must acknowledge the Maximum Bid Ceiling authorization.');
  }
  const id = generateDocumentId('sr');
  const requestCode = `SR-AUZ-2026-${Math.floor(300 + Math.random() * 699)}`;
  const path = `sourcingRequests/${id}`;

  try {
    await setDoc(doc(db, 'sourcingRequests', id), {
      requestCode,
      customerId: input.customerId,
      customerName: input.customerName.trim().slice(0, 100),
      customerCompany: input.customerCompany.trim().slice(0, 120),
      assignedStaffId: 'staff-sales-01',
      assignedStaffName: 'Kenji Takahashi',
      make: input.make.trim().slice(0, 40),
      model: input.model.trim().slice(0, 60),
      yearMin: Math.max(1985, Math.min(2027, Math.round(input.yearMin))),
      yearMax: Math.max(input.yearMin, Math.min(2027, Math.round(input.yearMax))),
      mileageMaxKm: Math.max(0, Math.min(999999, Math.round(input.mileageMaxKm))),
      gradePref: input.gradePref.trim().slice(0, 32),
      engineCc: input.engineCc.trim().slice(0, 32),
      transmission: input.transmission.trim().slice(0, 32),
      fuelType: input.fuelType.trim().slice(0, 32),
      colorPref: input.colorPref.trim().slice(0, 40),
      quantity: Math.max(1, Math.min(50, Math.round(input.quantity))),
      maxBudgetUsd: Math.max(1000, Math.min(2000000, Math.round(input.maxBudgetUsd))),
      budgetCurrency: input.budgetCurrency,
      destinationCountry: input.destinationCountry.trim().slice(0, 80),
      destinationPortId: input.destinationPortId.trim().slice(0, 64),
      sourcingChannel: input.sourcingChannel,
      referenceLinks: input.referenceLinks.trim().slice(0, 500),
      notes: input.notes.trim().slice(0, 1000),
      maxBidAcknowledged: true,
      status: 'new',
      options: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    void recordAuditLog({
      actorRole: 'customer',
      action: 'sourcing_request_created',
      targetType: 'sourcingRequest',
      targetId: id,
      summary: `Submitted ${requestCode} for ${input.make} ${input.model} (Max Budget $${input.maxBudgetUsd.toLocaleString()} USD).`,
    });
    return requestCode;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSourcingRequestStaff(
  requestId: string,
  updates: {
    assignedStaffId: string;
    assignedStaffName: string;
    status: SourcingRequest['status'];
    options: SourcingOption[];
    notes: string;
  }
): Promise<void> {
  const path = `sourcingRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'sourcingRequests', requestId), {
      assignedStaffId: updates.assignedStaffId.slice(0, 128),
      assignedStaffName: updates.assignedStaffName.slice(0, 100),
      status: updates.status,
      options: updates.options.slice(0, 6),
      notes: updates.notes.slice(0, 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Quotations & Bid Ceiling Authorizations
// ---------------------------------------------------------------------------

export async function createQuotation(input: {
  sourcingRequestId: string;
  vehicleId: string;
  vehicleTitle: string;
  stockCode: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  preparedByStaffId: string;
  preparedByName: string;
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
  lockedExchangeRate?: number;
  lockedCurrency?: CurrencyCode;
  lockedRateDate?: string;
}): Promise<string> {
  const id = generateDocumentId('qt');
  const quoteNumber = `QT-AUZ-2026-${Math.floor(600 + Math.random() * 399)}`;
  const validUntil = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const totalCifUsd = Math.round(
    input.fobVehicleUsd +
      input.auctionFeeUsd +
      input.exportDocsUsd +
      input.jevicInspectionUsd +
      input.seaFreightUsd +
      input.marineInsuranceUsd
  );
  const path = `quotations/${id}`;

  try {
    await setDoc(doc(db, 'quotations', id), {
      quoteNumber,
      sourcingRequestId: input.sourcingRequestId,
      vehicleId: input.vehicleId,
      vehicleTitle: input.vehicleTitle.trim().slice(0, 120),
      stockCode: input.stockCode.trim().slice(0, 32),
      customerId: input.customerId,
      customerName: input.customerName.trim().slice(0, 100),
      customerCompany: input.customerCompany.trim().slice(0, 120),
      preparedByStaffId: input.preparedByStaffId,
      preparedByName: input.preparedByName.trim().slice(0, 100),
      destinationPortId: input.destinationPortId,
      destinationPortName: input.destinationPortName.trim().slice(0, 100),
      currency: input.currency,
      fobVehicleUsd: Math.round(input.fobVehicleUsd),
      auctionFeeUsd: Math.round(input.auctionFeeUsd),
      exportDocsUsd: Math.round(input.exportDocsUsd),
      jevicInspectionUsd: Math.round(input.jevicInspectionUsd),
      seaFreightUsd: Math.round(input.seaFreightUsd),
      marineInsuranceUsd: Math.round(input.marineInsuranceUsd),
      totalCifUsd,
      authorizedMaxBidUsd: Math.round(input.authorizedMaxBidUsd),
      status: 'sent',
      approvedAt: '',
      approvedByUid: '',
      declineReason: '',
      validUntil,
      notes: input.notes.trim().slice(0, 800),
      ...(typeof input.lockedExchangeRate === 'number' && input.lockedExchangeRate > 0
        ? {
            lockedExchangeRate: Number(input.lockedExchangeRate.toFixed(6)),
            lockedCurrency: input.lockedCurrency || input.currency,
            lockedRateDate: input.lockedRateDate || new Date().toISOString(),
          }
        : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    void recordAuditLog({
      actorRole: 'sales',
      action: 'quote_issued',
      targetType: 'quotation',
      targetId: id,
      summary: `Issued ${quoteNumber} for ${input.vehicleTitle} — Total CIF $${totalCifUsd.toLocaleString()}, Max Bid $${input.authorizedMaxBidUsd.toLocaleString()}.`,
    });
    return quoteNumber;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function respondToQuotation(params: {
  quotation: Quotation;
  decision: 'approved' | 'declined';
  actorUid: string;
  declineReason?: string;
}): Promise<void> {
  const path = `quotations/${params.quotation.id}`;
  const nowIso = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'quotations', params.quotation.id), {
      status: params.decision,
      approvedAt: params.decision === 'approved' ? nowIso : '',
      approvedByUid: params.actorUid,
      declineReason: (params.declineReason || '').trim().slice(0, 400),
      updatedAt: serverTimestamp(),
    });
    void recordAuditLog({
      actorRole: 'customer',
      action: params.decision === 'approved' ? 'quote_approved' : 'quote_declined',
      targetType: 'quotation',
      targetId: params.quotation.id,
      summary:
        params.decision === 'approved'
          ? `Approved ${params.quotation.quoteNumber} and authorized Max Bid Ceiling of $${params.quotation.authorizedMaxBidUsd.toLocaleString()} USD.`
          : `Declined ${params.quotation.quoteNumber}: ${params.declineReason || 'No reason specified'}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Orders, Bid Ceiling Guard & Vessel Logistics
// ---------------------------------------------------------------------------

export async function convertQuotationToOrder(
  quotation: Quotation,
  listingType: ListingType = 'auction_listing',
  lockedRateSnapshot?: { rate: number; currency: CurrencyCode; date?: string }
): Promise<string> {
  const id = generateDocumentId('ord');
  const orderNumber = `ORD-AUZ-2026-${Math.floor(710 + Math.random() * 289)}`;
  const trackingCode = generateTrackingCode();
  const path = `orders/${id}`;

  const lockedRate =
    quotation.lockedExchangeRate || lockedRateSnapshot?.rate || undefined;
  const lockedCurr =
    quotation.lockedCurrency || lockedRateSnapshot?.currency || quotation.currency;
  const lockedDate =
    quotation.lockedRateDate || lockedRateSnapshot?.date || new Date().toISOString();

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'orders', id), {
      orderNumber,
      trackingCode,
      quotationId: quotation.id,
      customerId: quotation.customerId,
      customerName: quotation.customerName,
      customerCompany: quotation.customerCompany,
      vehicleId: quotation.vehicleId || 'GENERAL',
      vehicleStockCode: quotation.stockCode,
      vehicleTitle: quotation.vehicleTitle,
      listingType,
      destinationCountry: quotation.destinationPortName.split(',').pop()?.trim() || 'Kenya',
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
      milestone: 'customer_approved' as TradeOrderMilestone,
      vesselName: '',
      vesselId: '',
      vesselMmsi: '',
      voyageNumber: '',
      blNumber: '',
      etdDate: '',
      etaDate: '',
      scheduleIsEstimate: true,
      ...(typeof lockedRate === 'number' && lockedRate > 0
        ? {
            lockedExchangeRate: Number(lockedRate.toFixed(6)),
            lockedCurrency: lockedCurr,
            lockedRateDate: lockedDate,
          }
        : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'orderStatus', trackingCode), {
      trackingCode,
      inquiryId: id,
      vehicleStockCode: quotation.stockCode,
      vehicleTitle: quotation.vehicleTitle,
      destinationPortName: quotation.destinationPortName,
      shippingMethod: 'roro',
      quotedCifUsd: quotation.totalCifUsd,
      currency: quotation.currency,
      milestone: 'customer_approved',
      vesselName: '',
      vesselId: '',
      vesselMmsi: '',
      etaDate: '',
      publicNote: `Order ${orderNumber} opened following customer quotation approval.`,
      ...(typeof lockedRate === 'number' && lockedRate > 0
        ? {
            lockedExchangeRate: Number(lockedRate.toFixed(6)),
            lockedCurrency: lockedCurr,
            lockedRateDate: lockedDate,
          }
        : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return orderNumber;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function placeAuctionBidWithGuard(params: {
  order: ExportOrder;
  bidAmountUsd: number;
  actorRole: UserRole;
}): Promise<{ ok: boolean; error?: string }> {
  const bid = Math.round(params.bidAmountUsd);
  if (bid <= 0) {
    return { ok: false, error: 'Bid amount must be greater than $0 USD.' };
  }
  if (
    params.order.authorizedMaxBidUsd > 0 &&
    bid > params.order.authorizedMaxBidUsd
  ) {
    void recordAuditLog({
      actorRole: params.actorRole,
      action: 'bid_blocked',
      targetType: 'order',
      targetId: params.order.id,
      summary: `BLOCKED bid attempt of $${bid.toLocaleString()} USD exceeding authorized ceiling of $${params.order.authorizedMaxBidUsd.toLocaleString()} USD on ${params.order.orderNumber}.`,
    });
    return {
      ok: false,
      error: `Bid Ceiling Guard: $${bid.toLocaleString()} USD exceeds customer's authorized ceiling of $${params.order.authorizedMaxBidUsd.toLocaleString()} USD. Bid strictly blocked.`,
    };
  }

  const path = `orders/${params.order.id}`;
  try {
    await updateDoc(doc(db, 'orders', params.order.id), {
      placedBidUsd: bid,
      milestone: 'bid_placed',
      updatedAt: serverTimestamp(),
    });
    void recordAuditLog({
      actorRole: params.actorRole,
      action: 'bid_placed',
      targetType: 'order',
      targetId: params.order.id,
      summary: `Placed auction bid of $${bid.toLocaleString()} USD (within $${params.order.authorizedMaxBidUsd.toLocaleString()} ceiling) on ${params.order.orderNumber}.`,
    });
    return { ok: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateOrderLogistics(params: {
  order: ExportOrder;
  milestone: TradeOrderMilestone;
  vesselName: string;
  vesselId?: string;
  vesselMmsi?: string;
  voyageNumber: string;
  blNumber: string;
  etdDate: string;
  etaDate: string;
  scheduleIsEstimate: boolean;
  actorRole: UserRole;
}): Promise<void> {
  const path = `orders/${params.order.id}`;
  const cleanVesselId = (params.vesselId ?? params.order.vesselId ?? '').trim().slice(0, 128);
  const cleanVesselMmsi = (params.vesselMmsi ?? params.order.vesselMmsi ?? '').trim().slice(0, 12);
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'orders', params.order.id), {
      milestone: params.milestone,
      vesselName: params.vesselName.trim().slice(0, 100),
      vesselId: cleanVesselId,
      vesselMmsi: cleanVesselMmsi,
      voyageNumber: params.voyageNumber.trim().slice(0, 40),
      blNumber: params.blNumber.trim().slice(0, 60),
      etdDate: params.etdDate.trim().slice(0, 32),
      etaDate: params.etaDate.trim().slice(0, 32),
      scheduleIsEstimate: Boolean(params.scheduleIsEstimate),
      updatedAt: serverTimestamp(),
    });

    batch.set(
      doc(db, 'orderStatus', params.order.trackingCode),
      {
        trackingCode: params.order.trackingCode,
        inquiryId: params.order.id,
        vehicleStockCode: params.order.vehicleStockCode,
        vehicleTitle: params.order.vehicleTitle,
        destinationPortName: params.order.destinationPortName,
        shippingMethod: params.order.shippingMethod,
        quotedCifUsd: params.order.totalCifUsd,
        currency: params.order.currency,
        milestone: params.milestone,
        vesselName: params.vesselName.trim().slice(0, 100),
        vesselId: cleanVesselId,
        vesselMmsi: cleanVesselMmsi,
        etaDate: params.etaDate.trim().slice(0, 32),
        publicNote: `Stage updated to ${params.milestone.replace(/_/g, ' ')}${params.vesselName ? ` · Vessel: ${params.vesselName}` : ''}.`,
        ...(params.order.lockedExchangeRate
          ? {
              lockedExchangeRate: params.order.lockedExchangeRate,
              lockedCurrency: params.order.lockedCurrency || params.order.currency,
              lockedRateDate: params.order.lockedRateDate || '',
            }
          : {}),
        createdAt: params.order.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );

    await batch.commit();
    void recordAuditLog({
      actorRole: params.actorRole,
      action: 'milestone_updated',
      targetType: 'order',
      targetId: params.order.id,
      summary: `Updated ${params.order.orderNumber} to ${params.milestone} (${params.vesselName || 'No vessel yet'}${cleanVesselMmsi ? ` · MMSI ${cleanVesselMmsi}` : ''}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Order Messages & Document Vault
// ---------------------------------------------------------------------------

export async function postOrderMessage(input: {
  orderId: string;
  customerId: string;
  senderUid: string;
  senderName: string;
  senderRole: PersistedUserRole;
  body: string;
  isInternalStaffOnly: boolean;
}): Promise<void> {
  const id = generateDocumentId('msg');
  const path = `orderMessages/${id}`;
  try {
    await setDoc(doc(db, 'orderMessages', id), {
      orderId: input.orderId,
      customerId: input.customerId,
      senderUid: input.senderUid,
      senderName: input.senderName.trim().slice(0, 100),
      senderRole: input.senderRole,
      body: input.body.trim().slice(0, 1500),
      isInternalStaffOnly: input.senderRole === 'customer' ? false : Boolean(input.isInternalStaffOnly),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createExportDocument(input: {
  orderId: string;
  orderNumber: string;
  customerId: string;
  title: string;
  docType: ExportDocType;
  fileName: string;
  fileUrl: string;
  isCustomerVisible: boolean;
  uploadedByName: string;
  notes: string;
}): Promise<void> {
  const id = generateDocumentId('doc');
  const path = `documents/${id}`;
  try {
    await setDoc(doc(db, 'documents', id), {
      orderId: input.orderId,
      orderNumber: input.orderNumber.trim().slice(0, 32),
      customerId: input.customerId,
      title: input.title.trim().slice(0, 120),
      docType: input.docType,
      fileName: input.fileName.trim().slice(0, 120),
      fileUrl: input.fileUrl.trim().slice(0, 200000),
      isCustomerVisible: Boolean(input.isCustomerVisible),
      uploadedByName: input.uploadedByName.trim().slice(0, 100),
      notes: input.notes.trim().slice(0, 400),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    void recordAuditLog({
      actorRole: 'operations',
      action: 'document_uploaded',
      targetType: 'document',
      targetId: id,
      summary: `Uploaded ${input.title} for ${input.orderNumber} (Customer-Visible: ${String(input.isCustomerVisible).toUpperCase()}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleDocumentVisibility(
  docRecord: ExportDocument,
  nextVisible: boolean
): Promise<void> {
  const path = `documents/${docRecord.id}`;
  try {
    await updateDoc(doc(db, 'documents', docRecord.id), {
      isCustomerVisible: nextVisible,
      updatedAt: serverTimestamp(),
    });
    void recordAuditLog({
      actorRole: 'operations',
      action: 'document_visibility_changed',
      targetType: 'document',
      targetId: docRecord.id,
      summary: `Changed "${docRecord.title}" visibility to ${nextVisible ? 'CUSTOMER-VISIBLE' : 'STAFF-ONLY'}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteExportDocument(docId: string): Promise<void> {
  const path = `documents/${docId}`;
  try {
    await deleteDoc(doc(db, 'documents', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// Public Order Tracker & Visitor Quick Inquiries
// ---------------------------------------------------------------------------

export async function lookupOrderStatus(
  rawCode: string
): Promise<OrderStatusRecord | null> {
  const trackingCode = rawCode.trim().toUpperCase();
  if (
    !/^AUZ-[A-Z0-9-]+$/.test(trackingCode) ||
    trackingCode.length < 8 ||
    trackingCode.length > 32
  ) {
    return null;
  }
  const path = `orderStatus/${trackingCode}`;
  try {
    const snap = await getDoc(doc(db, 'orderStatus', trackingCode));
    if (!snap.exists()) return null;
    return snap.data() as OrderStatusRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export interface CreateInquiryInput {
  type: 'inquiry' | 'reservation';
  vehicleId: string;
  isVehiclePersisted: boolean;
  vehicleStockCode: string;
  vehicleTitle: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerCountry: string;
  destinationPortId: string;
  destinationPortName: string;
  shippingMethod: ShippingMethod;
  includeInsurance: boolean;
  fobPriceUsd: number;
  freightUsd: number;
  inspectionUsd: number;
  insuranceUsd: number;
  quotedCifUsd: number;
  currency: CurrencyCode;
  message: string;
}

export async function submitBuyerInquiry(
  input: CreateInquiryInput
): Promise<{ inquiryId: string; trackingCode: string }> {
  const inquiryId = generateDocumentId('inq');
  const trackingCode = generateTrackingCode();
  const sanitizedVehicleId = input.isVehiclePersisted ? input.vehicleId : 'GENERAL';

  const inquiryPayload = {
    trackingCode,
    type: input.type,
    vehicleId: sanitizedVehicleId,
    vehicleStockCode: input.vehicleStockCode.trim().slice(0, 32),
    vehicleTitle: input.vehicleTitle.trim().slice(0, 120),
    buyerName: input.buyerName.trim().slice(0, 100),
    buyerEmail: input.buyerEmail.trim().slice(0, 120),
    buyerPhone: input.buyerPhone.trim().slice(0, 40),
    buyerCountry: input.buyerCountry.trim().slice(0, 80),
    destinationPortId: input.destinationPortId.trim().slice(0, 64),
    destinationPortName: input.destinationPortName.trim().slice(0, 100),
    shippingMethod: input.shippingMethod,
    includeInsurance: Boolean(input.includeInsurance),
    fobPriceUsd: Math.max(0, Math.round(input.fobPriceUsd)),
    freightUsd: Math.max(0, Math.round(input.freightUsd)),
    inspectionUsd: Math.max(0, Math.round(input.inspectionUsd)),
    insuranceUsd: Math.max(0, Math.round(input.insuranceUsd)),
    quotedCifUsd: Math.max(0, Math.round(input.quotedCifUsd)),
    currency: input.currency,
    message: input.message.trim().slice(0, 1000),
    status: 'received' as OrderMilestone,
    vesselName: '',
    etaDate: '',
    adminNotes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const orderStatusPayload = {
    trackingCode,
    inquiryId,
    vehicleStockCode: inquiryPayload.vehicleStockCode,
    vehicleTitle: inquiryPayload.vehicleTitle,
    destinationPortName: inquiryPayload.destinationPortName,
    shippingMethod: inquiryPayload.shippingMethod,
    quotedCifUsd: inquiryPayload.quotedCifUsd,
    currency: inquiryPayload.currency,
    milestone: 'received' as OrderMilestone,
    vesselName: '',
    etaDate: '',
    publicNote:
      input.type === 'reservation'
        ? 'Vehicle inquiry logged. Yokohama export desk preparing official Proforma Invoice.'
        : 'CIF inquiry received. Export coordinator reviewing current sailing schedule.',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'inquiries', inquiryId), inquiryPayload);
    batch.set(doc(db, 'orderStatus', trackingCode), orderStatusPayload);
    await batch.commit();
    return { inquiryId, trackingCode };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `inquiries/${inquiryId}`);
  }
}

// ---------------------------------------------------------------------------
// Inventory CRUD & Company Settings
// ---------------------------------------------------------------------------

export async function saveVehicle(
  vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
  existingCreatedAt?: unknown
): Promise<string> {
  const id = existingId || generateDocumentId('veh');
  const path = `vehicles/${id}`;

  const normalizedPayload = {
    stockCode: vehicle.stockCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 32),
    listingType: vehicle.listingType || 'auzio_stock',
    auctionDate: (vehicle.auctionDate || '').trim().slice(0, 32),
    make: vehicle.make.trim().slice(0, 40),
    model: vehicle.model.trim().slice(0, 60),
    trim: vehicle.trim.trim().slice(0, 60),
    year: Math.min(2027, Math.max(1985, Math.round(vehicle.year))),
    chassisCode: vehicle.chassisCode.trim().toUpperCase().slice(0, 40),
    mileageKm: Math.min(999999, Math.max(0, Math.round(vehicle.mileageKm))),
    engineCc: Math.min(10000, Math.max(500, Math.round(vehicle.engineCc))),
    fuelType: vehicle.fuelType,
    transmission: vehicle.transmission,
    drivetrain: vehicle.drivetrain,
    steering: vehicle.steering,
    exteriorColor: vehicle.exteriorColor.trim().slice(0, 40),
    bodyType: vehicle.bodyType,
    originPort: vehicle.originPort,
    volumeM3: Math.min(40, Math.max(5, Number(vehicle.volumeM3))),
    fobPriceUsd: Math.min(500000, Math.max(500, Math.round(vehicle.fobPriceUsd))),
    status: vehicle.status,
    featured: Boolean(vehicle.featured),
    images: vehicle.images.slice(0, 6),
    features: vehicle.features
      .map((f) => f.trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 20),
    auctionReport: {
      exteriorGrade: vehicle.auctionReport.exteriorGrade.trim().slice(0, 10) || '4',
      interiorGrade: vehicle.auctionReport.interiorGrade.trim().slice(0, 10) || 'B',
      auctionHouse: vehicle.auctionReport.auctionHouse.trim().slice(0, 60) || 'USS Tokyo',
      lotNumber: vehicle.auctionReport.lotNumber.trim().slice(0, 30) || '10001',
      inspectionDate: vehicle.auctionReport.inspectionDate.trim().slice(0, 24) || '2026-11-01',
      inspectorNotes: vehicle.auctionReport.inspectorNotes.trim().slice(0, 600),
      mechanicalStatus: {
        engine: vehicle.auctionReport.mechanicalStatus.engine.trim().slice(0, 120) || 'Pass',
        transmission: vehicle.auctionReport.mechanicalStatus.transmission.trim().slice(0, 120) || 'Pass',
        suspension: vehicle.auctionReport.mechanicalStatus.suspension.trim().slice(0, 120) || 'Pass',
        airConditioning:
          vehicle.auctionReport.mechanicalStatus.airConditioning.trim().slice(0, 120) || 'Pass',
        frame: vehicle.auctionReport.mechanicalStatus.frame.trim().slice(0, 120) || 'Pass',
      },
      panelMarks: vehicle.auctionReport.panelMarks || {},
    },
    createdAt: existingId && existingCreatedAt ? existingCreatedAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    if (existingId && existingCreatedAt) {
      await updateDoc(doc(db, 'vehicles', id), normalizedPayload);
    } else {
      await setDoc(doc(db, 'vehicles', id), normalizedPayload);
    }
    void recordAuditLog({
      actorRole: 'operations',
      action: 'inventory_updated',
      targetType: 'vehicle',
      targetId: id,
      summary: `${existingId ? 'Updated' : 'Published'} ${normalizedPayload.stockCode} (${normalizedPayload.year} ${normalizedPayload.make} ${normalizedPayload.model}).`,
    });
    return id;
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function updateVehicleStatus(
  vehicle: Vehicle,
  nextStatus: VehicleStatus
): Promise<void> {
  const path = `vehicles/${vehicle.id}`;
  try {
    await updateDoc(doc(db, 'vehicles', vehicle.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  const path = `vehicles/${vehicleId}`;
  try {
    await deleteDoc(doc(db, 'vehicles', vehicleId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  const path = 'companySettings/exportProfile';
  const payload = {
    companyName: settings.companyName.trim().slice(0, 100),
    tagline: settings.tagline.trim().slice(0, 160),
    officeAddress: settings.officeAddress.trim().slice(0, 240),
    supportEmail: settings.supportEmail.trim().slice(0, 120),
    whatsappPhone: settings.whatsappPhone.trim().slice(0, 40),
    bankName: settings.bankName.trim().slice(0, 120),
    bankBranch: settings.bankBranch.trim().slice(0, 120),
    accountName: settings.accountName.trim().slice(0, 120),
    accountNumber: settings.accountNumber.trim().slice(0, 60),
    swiftCode: settings.swiftCode.trim().toUpperCase().slice(0, 20),
    bankAddress: settings.bankAddress.trim().slice(0, 240),
    invoiceValidityDays: Math.min(30, Math.max(1, Math.round(settings.invoiceValidityDays))),
    exchangeRates: {
      JPY: Math.max(1, Number(settings.exchangeRates.JPY)),
      EUR: Math.max(0.1, Number(settings.exchangeRates.EUR)),
      AUD: Math.max(0.1, Number(settings.exchangeRates.AUD)),
      GBP: Math.max(0.1, Number(settings.exchangeRates.GBP)),
      KES: Math.max(1, Number(settings.exchangeRates.KES)),
      ZAR: Math.max(0.1, Number(settings.exchangeRates.ZAR)),
      NZD: Math.max(0.1, Number(settings.exchangeRates.NZD)),
      CAD: Math.max(0.1, Number(settings.exchangeRates.CAD)),
    },
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'companySettings', 'exportProfile'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ---------------------------------------------------------------------------
// Complete Seed Reset & Clear Tools (Admin Only)
// ---------------------------------------------------------------------------

export async function seedFullTradeDatabase(): Promise<void> {
  try {
    const batch = writeBatch(db);

    for (const u of DEMO_USERS) {
      batch.set(doc(db, 'users', u.uid), {
        ...u,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const v of SEED_VEHICLES) {
      const { id, ...rest } = v;
      batch.set(doc(db, 'vehicles', id), {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const sr of SEED_SOURCING_REQUESTS) {
      const { id, ...rest } = sr;
      batch.set(doc(db, 'sourcingRequests', id), {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const qt of SEED_QUOTATIONS) {
      const { id, ...rest } = qt;
      batch.set(doc(db, 'quotations', id), {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const ord of SEED_ORDERS) {
      const { id, ...rest } = ord;
      batch.set(doc(db, 'orders', id), {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'orderStatus', ord.trackingCode), {
        trackingCode: ord.trackingCode,
        inquiryId: id,
        vehicleStockCode: ord.vehicleStockCode,
        vehicleTitle: ord.vehicleTitle,
        destinationPortName: ord.destinationPortName,
        shippingMethod: ord.shippingMethod,
        quotedCifUsd: ord.totalCifUsd,
        currency: ord.currency,
        milestone: ord.milestone,
        vesselName: ord.vesselName,
        etaDate: ord.etaDate,
        publicNote: `Vessel ${ord.vesselName} (${ord.voyageNumber}) — ETD ${ord.etdDate}, Est. ETA ${ord.etaDate}.`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const msg of SEED_MESSAGES) {
      const { id, ...rest } = msg;
      batch.set(doc(db, 'orderMessages', id), {
        ...rest,
        createdAt: serverTimestamp(),
      });
    }

    for (const d of SEED_DOCUMENTS) {
      const { id, ...rest } = d;
      batch.set(doc(db, 'documents', id), {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(doc(db, 'companySettings', 'exportProfile'), {
      ...DEFAULT_COMPANY_SETTINGS,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    // Write seed audit logs if current user is authenticated admin
    const currentUser = auth.currentUser;
    if (currentUser?.emailVerified) {
      const audBatch = writeBatch(db);
      for (const log of SEED_AUDIT_LOGS) {
        const { id, ...rest } = log;
        audBatch.set(doc(db, 'auditLogs', id), {
          ...rest,
          actorUid: currentUser.uid,
          createdAt: serverTimestamp(),
        });
      }
      audBatch.set(doc(db, 'auditLogs', generateDocumentId('aud')), {
        actorUid: currentUser.uid,
        actorEmail: currentUser.email || 'admin@auziotraders.com',
        actorRole: 'admin',
        action: 'seed_reset',
        targetType: 'system',
        targetId: 'full_seed',
        summary: 'Initialized/reset full AUZIO TRADERS sample database across all trade collections.',
        createdAt: serverTimestamp(),
      });
      await audBatch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'vehicles');
  }
}

export async function clearSampleTradeData(): Promise<void> {
  const collectionsToClear = [
    'vehicles',
    'sourcingRequests',
    'quotations',
    'orders',
    'orderMessages',
    'documents',
  ];
  try {
    for (const colName of collectionsToClear) {
      const snap = await getDocs(collection(db, colName));
      if (snap.empty) continue;
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    void recordAuditLog({
      actorRole: 'admin',
      action: 'seed_cleared',
      targetType: 'system',
      targetId: 'all_collections',
      summary: 'Cleared sample trade data collections from Firestore.',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'vehicles');
  }
}

// ---------------------------------------------------------------------------
// Landing Page CMS & Verified Customer Testimonials
// ---------------------------------------------------------------------------

export function subscribeLandingContent(
  onData: (content: LandingPageContent) => void
): Unsubscribe {
  const ref = doc(db, 'landingContent', 'public');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<LandingPageContent>;
        onData({
          ...DEFAULT_LANDING_CONTENT,
          ...data,
          stats: Array.isArray(data.stats) && data.stats.length > 0 ? data.stats : DEFAULT_LANDING_CONTENT.stats,
          services:
            Array.isArray(data.services) && data.services.length > 0
              ? data.services
              : DEFAULT_LANDING_CONTENT.services,
          faqs: Array.isArray(data.faqs) && data.faqs.length > 0 ? data.faqs : DEFAULT_LANDING_CONTENT.faqs,
          socialLinks: {
            ...DEFAULT_LANDING_CONTENT.socialLinks,
            ...(data.socialLinks || {}),
          },
        });
      } else {
        onData(DEFAULT_LANDING_CONTENT);
      }
    },
    () => {
      onData(DEFAULT_LANDING_CONTENT);
    }
  );
}

export async function saveLandingContent(content: LandingPageContent): Promise<void> {
  try {
    const { updatedAt: _ignored, ...rest } = content;
    await setDoc(
      doc(db, 'landingContent', 'public'),
      {
        ...rest,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    void recordAuditLog({
      actorRole: 'admin',
      action: 'landing_cms_updated',
      targetType: 'landingContent',
      targetId: 'public',
      summary: 'Updated public landing page CMS content, statistics, FAQs, and SEO settings.',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'landingContent/public');
  }
}

export function subscribeTestimonials(
  includeUnapproved: boolean,
  onData: (items: CustomerTestimonial[]) => void
): Unsubscribe {
  const q = includeUnapproved
    ? query(collection(db, 'testimonials'))
    : query(collection(db, 'testimonials'), where('approved', '==', true));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CustomerTestimonial, 'id'>),
        }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    () => {
      onData([]);
    }
  );
}

export async function saveTestimonial(
  input: Omit<CustomerTestimonial, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId || generateDocumentId('rev');
  try {
    const payload = {
      customerName: input.customerName.trim().slice(0, 100),
      country: input.country.trim().slice(0, 80),
      vehiclePurchased: input.vehiclePurchased.trim().slice(0, 120),
      photoUrl: input.photoUrl.trim().slice(0, 500),
      rating: Math.max(1, Math.min(5, Math.round(input.rating || 5))),
      reviewText: input.reviewText.trim().slice(0, 1200),
      verified: Boolean(input.verified),
      approved: Boolean(input.approved),
      updatedAt: serverTimestamp(),
    };
    if (existingId) {
      await updateDoc(doc(db, 'testimonials', id), payload);
    } else {
      await setDoc(doc(db, 'testimonials', id), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    void recordAuditLog({
      actorRole: 'admin',
      action: existingId ? 'testimonial_updated' : 'testimonial_created',
      targetType: 'testimonial',
      targetId: id,
      summary: `${existingId ? 'Updated' : 'Published'} customer testimonial from ${payload.customerName} (${payload.country}).`,
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `testimonials/${id}`);
  }
}

export async function deleteTestimonial(testimonialId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'testimonials', testimonialId));
    void recordAuditLog({
      actorRole: 'admin',
      action: 'testimonial_deleted',
      targetType: 'testimonial',
      targetId: testimonialId,
      summary: `Deleted testimonial ${testimonialId}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `testimonials/${testimonialId}`);
  }
}

// ---------------------------------------------------------------------------
// Protected Banking Details Update (Restricted + Mandatory Audit Trail)
// ---------------------------------------------------------------------------

export async function saveBankingDetailsProtected(
  settings: CompanySettings,
  verificationReason: string
): Promise<void> {
  const path = 'companySettings/exportProfile';
  const payload = {
    bankName: settings.bankName.trim().slice(0, 120),
    bankBranch: settings.bankBranch.trim().slice(0, 120),
    accountName: settings.accountName.trim().slice(0, 120),
    accountNumber: settings.accountNumber.trim().slice(0, 60),
    swiftCode: settings.swiftCode.trim().toUpperCase().slice(0, 20),
    bankAddress: settings.bankAddress.trim().slice(0, 240),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'companySettings', 'exportProfile'), payload, { merge: true });
    await recordAuditLog({
      actorRole: 'admin',
      action: 'banking_details_updated',
      targetType: 'companySettings',
      targetId: 'exportProfile',
      summary: `Updated corporate wire details (${payload.bankName}, SWIFT ${payload.swiftCode}). Verification reason: ${verificationReason.trim().slice(0, 180)}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// CRM Inquiries Status & Follow-up Notes
// ---------------------------------------------------------------------------

export async function updateInquiryStaff(
  inquiryId: string,
  updates: { status: OrderMilestone; adminNotes: string; vesselName?: string; etaDate?: string }
): Promise<void> {
  const path = `inquiries/${inquiryId}`;
  try {
    await updateDoc(doc(db, 'inquiries', inquiryId), {
      status: updates.status,
      adminNotes: updates.adminNotes.trim().slice(0, 1000),
      ...(typeof updates.vesselName === 'string'
        ? { vesselName: updates.vesselName.trim().slice(0, 100) }
        : {}),
      ...(typeof updates.etaDate === 'string'
        ? { etaDate: updates.etaDate.trim().slice(0, 40) }
        : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Accounts & Finance Ledger (Invoices, Payments, Expenses, Reconciliation)
// ---------------------------------------------------------------------------

export function subscribeFinanceRecords(
  canView: boolean,
  onData: (items: FinanceRecord[]) => void
): Unsubscribe {
  if (!canView) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'financeRecords'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<FinanceRecord, 'id'>) }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'financeRecords');
      } catch {
        // Logged
      }
    }
  );
}

export async function createFinanceRecord(
  input: Omit<FinanceRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateDocumentId('fin');
  const path = `financeRecords/${id}`;
  try {
    await setDoc(doc(db, 'financeRecords', id), {
      type: input.type,
      referenceCode: input.referenceCode.trim().slice(0, 40),
      orderId: input.orderId.trim().slice(0, 128),
      orderNumber: input.orderNumber.trim().slice(0, 40),
      counterpartyName: input.counterpartyName.trim().slice(0, 120),
      category: input.category.trim().slice(0, 80),
      amountUsd: Math.max(0, Math.round(Number(input.amountUsd) || 0)),
      currency: input.currency.trim().toUpperCase().slice(0, 3) || 'USD',
      status: input.status,
      reconciled: Boolean(input.reconciled),
      transactionDate: input.transactionDate.trim().slice(0, 32),
      notes: input.notes.trim().slice(0, 800),
      createdByUid: input.createdByUid.slice(0, 128),
      createdByName: input.createdByName.trim().slice(0, 100),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    void recordAuditLog({
      actorRole: 'accounts',
      action: 'finance_record_created',
      targetType: 'financeRecord',
      targetId: id,
      summary: `Logged ${input.type} ${input.referenceCode} for $${Math.round(input.amountUsd).toLocaleString()} (${input.counterpartyName}).`,
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFinanceRecordStatus(
  id: string,
  updates: { status: FinanceRecord['status']; reconciled: boolean }
): Promise<void> {
  const path = `financeRecords/${id}`;
  try {
    await updateDoc(doc(db, 'financeRecords', id), {
      status: updates.status,
      reconciled: Boolean(updates.reconciled),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFinanceRecord(id: string): Promise<void> {
  const path = `financeRecords/${id}`;
  try {
    await deleteDoc(doc(db, 'financeRecords', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// Human Resources (Employees & Leave Requests)
// ---------------------------------------------------------------------------

export function subscribeHrEmployees(
  canView: boolean,
  onData: (items: HrEmployee[]) => void
): Unsubscribe {
  if (!canView) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'hrEmployees'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<HrEmployee, 'id'>) }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'hrEmployees');
      } catch {
        // Logged
      }
    }
  );
}

export async function saveHrEmployee(
  input: Omit<HrEmployee, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId || generateDocumentId('emp');
  const path = `hrEmployees/${id}`;
  const payload = {
    employeeCode: input.employeeCode.trim().slice(0, 32),
    fullName: input.fullName.trim().slice(0, 100),
    email: input.email.trim().slice(0, 120),
    phone: input.phone.trim().slice(0, 40),
    department: input.department.trim().slice(0, 60),
    jobTitle: input.jobTitle.trim().slice(0, 80),
    status: input.status,
    baseSalaryUsd: Math.max(0, Math.round(Number(input.baseSalaryUsd) || 0)),
    commissionRatePct: Math.max(0, Math.min(50, Number(input.commissionRatePct) || 0)),
    attendanceDaysThisMonth: Math.max(0, Math.min(31, Math.round(Number(input.attendanceDaysThisMonth) || 0))),
    leaveDaysRemaining: Math.max(0, Math.min(60, Math.round(Number(input.leaveDaysRemaining) || 0))),
    performanceRating: Math.max(1, Math.min(5, Number(input.performanceRating) || 4)),
    joinedDate: input.joinedDate.trim().slice(0, 32),
    notes: input.notes.trim().slice(0, 600),
    updatedAt: serverTimestamp(),
  };
  try {
    if (existingId) {
      await updateDoc(doc(db, 'hrEmployees', id), payload);
    } else {
      await setDoc(doc(db, 'hrEmployees', id), { ...payload, createdAt: serverTimestamp() });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteHrEmployee(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'hrEmployees', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `hrEmployees/${id}`);
  }
}

export function subscribeHrLeaveRequests(
  canView: boolean,
  onData: (items: HrLeaveRequest[]) => void
): Unsubscribe {
  if (!canView) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'hrLeaveRequests'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<HrLeaveRequest, 'id'>) }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'hrLeaveRequests');
      } catch {
        // Logged
      }
    }
  );
}

export async function createHrLeaveRequest(
  input: Omit<HrLeaveRequest, 'id' | 'status' | 'reviewedByName' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateDocumentId('lv');
  const path = `hrLeaveRequests/${id}`;
  try {
    await setDoc(doc(db, 'hrLeaveRequests', id), {
      employeeId: input.employeeId.slice(0, 128),
      employeeName: input.employeeName.trim().slice(0, 100),
      department: input.department.trim().slice(0, 60),
      leaveType: input.leaveType,
      startDate: input.startDate.trim().slice(0, 32),
      endDate: input.endDate.trim().slice(0, 32),
      days: Math.max(1, Math.min(90, Math.round(Number(input.days) || 1))),
      reason: input.reason.trim().slice(0, 500),
      status: 'pending',
      reviewedByName: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function reviewHrLeaveRequest(
  id: string,
  status: 'approved' | 'rejected',
  reviewedByName: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'hrLeaveRequests', id), {
      status,
      reviewedByName: reviewedByName.trim().slice(0, 100),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `hrLeaveRequests/${id}`);
  }
}

// ---------------------------------------------------------------------------
// Employee Task Management & Internal Team Messaging
// ---------------------------------------------------------------------------

export function subscribeTeamTasks(
  isStaff: boolean,
  onData: (items: TeamTask[]) => void
): Unsubscribe {
  if (!isStaff) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'teamTasks'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<TeamTask, 'id'>) }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'teamTasks');
      } catch {
        // Logged
      }
    }
  );
}

export async function createTeamTask(
  input: Omit<TeamTask, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateDocumentId('tsk');
  try {
    await setDoc(doc(db, 'teamTasks', id), {
      title: input.title.trim().slice(0, 140),
      description: input.description.trim().slice(0, 800),
      department: input.department.trim().slice(0, 60),
      assignedToName: input.assignedToName.trim().slice(0, 100),
      priority: input.priority,
      status: input.status,
      dueDate: input.dueDate.trim().slice(0, 32),
      createdByUid: input.createdByUid.slice(0, 128),
      createdByName: input.createdByName.trim().slice(0, 100),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `teamTasks/${id}`);
  }
}

export async function updateTeamTaskStatus(id: string, status: TeamTask['status']): Promise<void> {
  try {
    await updateDoc(doc(db, 'teamTasks', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `teamTasks/${id}`);
  }
}

export async function deleteTeamTask(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'teamTasks', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `teamTasks/${id}`);
  }
}

export function subscribeTeamMessages(
  isStaff: boolean,
  onData: (items: TeamChannelMessage[]) => void
): Unsubscribe {
  if (!isStaff) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'teamMessages'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<TeamChannelMessage, 'id'>) }))
        .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'teamMessages');
      } catch {
        // Logged
      }
    }
  );
}

export async function postTeamChannelMessage(input: {
  channel: TeamChannelId;
  senderUid: string;
  senderName: string;
  senderRole: PersistedUserRole;
  body: string;
}): Promise<string> {
  const id = generateDocumentId('tmsg');
  try {
    await setDoc(doc(db, 'teamMessages', id), {
      channel: input.channel,
      senderUid: input.senderUid.slice(0, 128),
      senderName: input.senderName.trim().slice(0, 100),
      senderRole: input.senderRole,
      body: input.body.trim().slice(0, 1500),
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `teamMessages/${id}`);
  }
}

// ---------------------------------------------------------------------------
// Sales Targets & Commission Plans
// ---------------------------------------------------------------------------

export function subscribeSalesTargets(
  isStaff: boolean,
  onData: (items: SalesTarget[]) => void
): Unsubscribe {
  if (!isStaff) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'salesTargets'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<SalesTarget, 'id'>) }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'salesTargets');
      } catch {
        // Logged
      }
    }
  );
}

export async function saveSalesTarget(
  input: Omit<SalesTarget, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId || generateDocumentId('tgt');
  const payload = {
    staffName: input.staffName.trim().slice(0, 100),
    staffEmail: input.staffEmail.trim().slice(0, 120),
    period: input.period.trim().slice(0, 40),
    targetRevenueUsd: Math.max(0, Math.round(Number(input.targetRevenueUsd) || 0)),
    achievedRevenueUsd: Math.max(0, Math.round(Number(input.achievedRevenueUsd) || 0)),
    targetUnits: Math.max(0, Math.round(Number(input.targetUnits) || 0)),
    soldUnits: Math.max(0, Math.round(Number(input.soldUnits) || 0)),
    commissionRatePct: Math.max(0, Math.min(35, Number(input.commissionRatePct) || 0)),
    notes: input.notes.trim().slice(0, 400),
    updatedAt: serverTimestamp(),
  };
  try {
    if (existingId) {
      await updateDoc(doc(db, 'salesTargets', id), payload);
    } else {
      await setDoc(doc(db, 'salesTargets', id), { ...payload, createdAt: serverTimestamp() });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `salesTargets/${id}`);
  }
}

export async function deleteSalesTarget(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'salesTargets', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `salesTargets/${id}`);
  }
}

// ---------------------------------------------------------------------------
// Admin-Provisioned Staff Invitations (No Staff Self-Registration)
// ---------------------------------------------------------------------------

export function subscribeStaffInvitations(
  canView: boolean,
  onData: (items: StaffInvitation[]) => void
): Unsubscribe {
  if (!canView) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'staffInvitations'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<StaffInvitation, 'id'>) }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'staffInvitations');
      } catch {
        // Logged
      }
    }
  );
}

export async function createStaffInvitation(
  input: Omit<StaffInvitation, 'id' | 'status' | 'acceptedByUid' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateDocumentId('inv');
  const path = `staffInvitations/${id}`;
  const normalizedEmail = input.officialEmail.trim().toLowerCase().slice(0, 120);
  try {
    await setDoc(doc(db, 'staffInvitations', id), {
      employeeName: input.employeeName.trim().slice(0, 100),
      employeeCode: input.employeeCode.trim().toUpperCase().slice(0, 32),
      officialEmail: normalizedEmail,
      department: input.department.trim().slice(0, 60),
      designationLevel: input.designationLevel,
      reportingManagerName: input.reportingManagerName.trim().slice(0, 100),
      role: input.role,
      permissions: input.permissions || {},
      twoFactorRequired: Boolean(input.twoFactorRequired),
      status: 'pending',
      invitedByUid: input.invitedByUid.slice(0, 128),
      invitedByEmail: input.invitedByEmail.trim().slice(0, 120),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    void recordAuditLog({
      actorRole: 'admin',
      action: 'employee_invited',
      targetType: 'staffInvitation',
      targetId: id,
      summary: `Created employee invitation for ${input.employeeName} (${normalizedEmail}) — ${input.department} / ${input.role} (${input.employeeCode}).`,
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeStaffInvitation(inviteId: string): Promise<void> {
  const path = `staffInvitations/${inviteId}`;
  try {
    await updateDoc(doc(db, 'staffInvitations', inviteId), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
    void recordAuditLog({
      actorRole: 'admin',
      action: 'employee_invitation_revoked',
      targetType: 'staffInvitation',
      targetId: inviteId,
      summary: `Revoked pending employee invitation ${inviteId}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function claimPendingStaffInvitation(params: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<UserProfile | null> {
  const normalizedEmail = params.email.trim().toLowerCase();
  if (!normalizedEmail) return null;
  try {
    const q = query(
      collection(db, 'staffInvitations'),
      where('officialEmail', '==', normalizedEmail)
    );
    const snap = await getDocs(q);
    const pendingDoc = snap.docs.find((d) => d.data().status === 'pending');
    if (!pendingDoc) return null;

    const inv = pendingDoc.data() as Omit<StaffInvitation, 'id'>;
    const inviteId = pendingDoc.id;

    const newProfile: UserProfile = {
      uid: params.uid,
      email: normalizedEmail,
      displayName: inv.employeeName || params.displayName || 'Team Member',
      role: inv.role,
      department: inv.department,
      designationLevel: inv.designationLevel,
      employeeCode: inv.employeeCode,
      reportingManagerName: inv.reportingManagerName || '',
      accountStatus: 'active',
      twoFactorRequired: Boolean(inv.twoFactorRequired),
      permissions: inv.permissions || {},
      companyName: 'AUZIO TRADERS',
      country: 'Japan',
      defaultPortId: 'mombasa-ke',
      phone: '',
      consigneeAddress: 'Yokohama, Japan',
      assignedRepName: '',
      assignedRepEmail: '',
      verified: true,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'users', params.uid), {
      ...newProfile,
      invitationId: inviteId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'staffInvitations', inviteId), {
      status: 'accepted',
      acceptedByUid: params.uid,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    void recordAuditLog({
      actorRole: inv.role,
      action: 'employee_invitation_accepted',
      targetType: 'user',
      targetId: params.uid,
      summary: `${newProfile.displayName} (${normalizedEmail}) activated invited ${inv.department} (${inv.role}) account.`,
    });
    return newProfile;
  } catch {
    return null;
  }
}

// ============================================================================
// 16. Exchange Rate 24h Firestore Cache & Margin Management
// ============================================================================

export function subscribeExchangeRateCache(
  onData: (cache: ExchangeRateCacheDoc | null) => void
): Unsubscribe {
  const ref = doc(db, 'exchangeRates', 'latest');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as ExchangeRateCacheDoc);
      } else {
        onData(null);
      }
    },
    () => {
      onData(null);
    }
  );
}

export async function saveExchangeRateCache(cache: ExchangeRateCacheDoc): Promise<void> {
  const path = 'exchangeRates/latest';
  try {
    const cleanedMargins: Record<string, number> = {};
    for (const [k, v] of Object.entries(cache.currencyMargins || {})) {
      const code = k.trim().toUpperCase();
      if (/^[A-Z]{3}$/.test(code) && typeof v === 'number' && Number.isFinite(v)) {
        cleanedMargins[code] = Math.max(-20, Math.min(25, Number(v.toFixed(2))));
      }
    }

    await setDoc(doc(db, 'exchangeRates', 'latest'), {
      base: 'USD',
      rates: cache.rates,
      jpyRates: cache.jpyRates || { JPY: 1 },
      supportedCount: Object.keys(cache.rates || {}).length,
      globalMarginPct: Math.max(-20, Math.min(25, Number((cache.globalMarginPct || 0).toFixed(2)))),
      currencyMargins: cleanedMargins,
      provider: (cache.provider || 'ExchangeRate-API (open.er-api.com)').slice(0, 120),
      attributionUrl: (cache.attributionUrl || 'https://www.exchangerate-api.com').slice(0, 200),
      updatedAt: (cache.updatedAt || new Date().toISOString()).slice(0, 64),
      nextUpdateAt: (cache.nextUpdateAt || '').slice(0, 64),
      jpyUpdatedAt: (cache.jpyUpdatedAt || '').slice(0, 64),
      lastSyncStatus: cache.lastSyncStatus || 'ok',
      lastError: (cache.lastError || '').slice(0, 400),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================================
// 17. Registered Export Vessels & AISStream / Manual Position Persistence
// ============================================================================

export function subscribeVessels(
  onData: (vessels: RegisteredVessel[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'vessels'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RegisteredVessel, 'id'>),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(list);
    },
    () => {
      onData([]);
    }
  );
}

export async function saveVessel(
  input: Omit<RegisteredVessel, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId || generateDocumentId('vsl');
  const path = `vessels/${id}`;
  const cleanMmsi = input.mmsi.replace(/\D/g, '').slice(0, 9);
  if (!/^\d{9}$/.test(cleanMmsi)) {
    throw new Error('Vessel MMSI must be exactly 9 numeric digits.');
  }

  const payload = {
    name: input.name.trim().slice(0, 100),
    mmsi: cleanMmsi,
    imo: input.imo.replace(/\D/g, '').slice(0, 20),
    callSign: input.callSign.trim().toUpperCase().slice(0, 24),
    carrier: input.carrier.trim().slice(0, 80),
    voyageNumber: input.voyageNumber.trim().slice(0, 40),
    originPort: input.originPort.trim().slice(0, 80),
    destinationPort: input.destinationPort.trim().slice(0, 100),
    etaReported: (input.etaReported || '').trim().slice(0, 60),
    etaManual: (input.etaManual || '').trim().slice(0, 40),
    latitude:
      typeof input.latitude === 'number' && Number.isFinite(input.latitude)
        ? Number(input.latitude.toFixed(5))
        : null,
    longitude:
      typeof input.longitude === 'number' && Number.isFinite(input.longitude)
        ? Number(input.longitude.toFixed(5))
        : null,
    speedKnots:
      typeof input.speedKnots === 'number' && Number.isFinite(input.speedKnots)
        ? Number(input.speedKnots.toFixed(1))
        : null,
    courseDeg:
      typeof input.courseDeg === 'number' && Number.isFinite(input.courseDeg)
        ? Number(input.courseDeg.toFixed(1))
        : null,
    headingDeg:
      typeof input.headingDeg === 'number' && Number.isFinite(input.headingDeg)
        ? Math.round(input.headingDeg)
        : null,
    navStatus: typeof input.navStatus === 'number' ? input.navStatus : null,
    aisDestination: (input.aisDestination || '').trim().slice(0, 100),
    lastAisUpdateAt: (input.lastAisUpdateAt || '').trim().slice(0, 40),
    manualStatus: (input.manualStatus || '').trim().slice(0, 80),
    manualLocationNote: (input.manualLocationNote || '').trim().slice(0, 500),
    manualLatitude:
      typeof input.manualLatitude === 'number' && Number.isFinite(input.manualLatitude)
        ? Number(input.manualLatitude.toFixed(5))
        : null,
    manualLongitude:
      typeof input.manualLongitude === 'number' && Number.isFinite(input.manualLongitude)
        ? Number(input.manualLongitude.toFixed(5))
        : null,
    manualUpdatedAt: (input.manualUpdatedAt || '').trim().slice(0, 40),
    trackingEnabled: Boolean(input.trackingEnabled),
    updatedAt: serverTimestamp(),
  };

  try {
    if (existingId) {
      await setDoc(doc(db, 'vessels', id), payload, { merge: true });
    } else {
      await setDoc(doc(db, 'vessels', id), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    void recordAuditLog({
      actorRole: 'operations',
      action: existingId ? 'vessel_updated' : 'vessel_registered',
      targetType: 'vessel',
      targetId: id,
      summary: `${existingId ? 'Updated' : 'Registered'} vessel ${payload.name} (MMSI: ${payload.mmsi}${payload.imo ? `, IMO: ${payload.imo}` : ''}).`,
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function updateVesselAisTelemetry(
  vessel: RegisteredVessel,
  telemetry: LiveVesselTelemetry
): Promise<void> {
  const path = `vessels/${vessel.id}`;
  try {
    await setDoc(
      doc(db, 'vessels', vessel.id),
      {
        name: vessel.name || telemetry.vesselName || `MMSI ${vessel.mmsi}`,
        mmsi: vessel.mmsi,
        imo: telemetry.imo || vessel.imo || '',
        callSign: telemetry.callSign || vessel.callSign || '',
        carrier: vessel.carrier || '',
        voyageNumber: vessel.voyageNumber || '',
        originPort: vessel.originPort || '',
        destinationPort: vessel.destinationPort || '',
        etaReported: telemetry.reportedEta || vessel.etaReported || '',
        etaManual: vessel.etaManual || '',
        latitude: telemetry.latitude ?? vessel.latitude ?? null,
        longitude: telemetry.longitude ?? vessel.longitude ?? null,
        speedKnots: telemetry.speedKnots ?? vessel.speedKnots ?? null,
        courseDeg: telemetry.courseDeg ?? vessel.courseDeg ?? null,
        headingDeg: telemetry.headingDeg ?? vessel.headingDeg ?? null,
        navStatus: telemetry.navStatus ?? vessel.navStatus ?? null,
        aisDestination: telemetry.destination || vessel.aisDestination || '',
        lastAisUpdateAt: telemetry.lastAisUpdateAt || new Date().toISOString(),
        manualStatus: vessel.manualStatus || '',
        manualLocationNote: vessel.manualLocationNote || '',
        manualUpdatedAt: vessel.manualUpdatedAt || '',
        trackingEnabled: vessel.trackingEnabled,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateVesselManualUpdate(params: {
  vessel: RegisteredVessel;
  manualStatus: string;
  manualLocationNote: string;
  etaManual: string;
  manualLatitude?: number | null;
  manualLongitude?: number | null;
}): Promise<void> {
  const path = `vessels/${params.vessel.id}`;
  const nowIso = new Date().toISOString();
  try {
    await setDoc(
      doc(db, 'vessels', params.vessel.id),
      {
        name: params.vessel.name,
        mmsi: params.vessel.mmsi,
        imo: params.vessel.imo || '',
        callSign: params.vessel.callSign || '',
        carrier: params.vessel.carrier || '',
        voyageNumber: params.vessel.voyageNumber || '',
        originPort: params.vessel.originPort || '',
        destinationPort: params.vessel.destinationPort || '',
        etaManual: params.etaManual.trim().slice(0, 40),
        manualStatus: params.manualStatus.trim().slice(0, 80),
        manualLocationNote: params.manualLocationNote.trim().slice(0, 500),
        manualLatitude:
          typeof params.manualLatitude === 'number' && Number.isFinite(params.manualLatitude)
            ? Number(params.manualLatitude.toFixed(5))
            : params.vessel.manualLatitude ?? null,
        manualLongitude:
          typeof params.manualLongitude === 'number' && Number.isFinite(params.manualLongitude)
            ? Number(params.manualLongitude.toFixed(5))
            : params.vessel.manualLongitude ?? null,
        manualUpdatedAt: nowIso,
        latitude: params.vessel.latitude ?? null,
        longitude: params.vessel.longitude ?? null,
        trackingEnabled: params.vessel.trackingEnabled,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    void recordAuditLog({
      actorRole: 'operations',
      action: 'vessel_manual_update',
      targetType: 'vessel',
      targetId: params.vessel.id,
      summary: `Manual position/status update for ${params.vessel.name} (MMSI ${params.vessel.mmsi}): ${params.manualStatus || params.manualLocationNote.slice(0, 80)}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteVessel(vesselId: string): Promise<void> {
  const path = `vessels/${vesselId}`;
  try {
    await deleteDoc(doc(db, 'vessels', vesselId));
    void recordAuditLog({
      actorRole: 'operations',
      action: 'vessel_deleted',
      targetType: 'vessel',
      targetId: vesselId,
      summary: `Removed registered vessel ${vesselId} from tracking roster.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 18. API Integrations Configuration & Error Logs (Staff Only; No API Secrets)
// ============================================================================

export const DEFAULT_API_INTEGRATION_CONFIG: ApiIntegrationConfig = {
  exchangeRateEnabled: true,
  vesselTrackingEnabled: true,
  commercialDisplayConfirmed: false,
  lastFxSyncAt: '',
  lastAisSyncAt: '',
  errorLogs: [],
};

export function subscribeApiIntegrationConfig(
  isStaffUser: boolean,
  onData: (config: ApiIntegrationConfig) => void
): Unsubscribe {
  if (!isStaffUser) {
    onData(DEFAULT_API_INTEGRATION_CONFIG);
    return () => {};
  }
  const ref = doc(db, 'apiIntegrations', 'config');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<ApiIntegrationConfig>;
        onData({
          ...DEFAULT_API_INTEGRATION_CONFIG,
          ...data,
          errorLogs: Array.isArray(data.errorLogs) ? data.errorLogs : [],
        });
      } else {
        onData(DEFAULT_API_INTEGRATION_CONFIG);
      }
    },
    () => {
      onData(DEFAULT_API_INTEGRATION_CONFIG);
    }
  );
}

export async function saveApiIntegrationConfig(config: ApiIntegrationConfig): Promise<void> {
  const path = 'apiIntegrations/config';
  try {
    const safeLogs: ApiErrorLogEntry[] = (config.errorLogs || [])
      .slice(0, 80)
      .map((entry) => ({
        id: String(entry.id || generateDocumentId('err')).slice(0, 64),
        provider: entry.provider,
        level: entry.level,
        message: String(entry.message || '').slice(0, 400),
        timestamp: String(entry.timestamp || new Date().toISOString()).slice(0, 40),
      }));

    await setDoc(doc(db, 'apiIntegrations', 'config'), {
      exchangeRateEnabled: Boolean(config.exchangeRateEnabled),
      vesselTrackingEnabled: Boolean(config.vesselTrackingEnabled),
      commercialDisplayConfirmed: Boolean(config.commercialDisplayConfirmed),
      lastFxSyncAt: (config.lastFxSyncAt || '').slice(0, 64),
      lastAisSyncAt: (config.lastAisSyncAt || '').slice(0, 64),
      errorLogs: safeLogs,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}




