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
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  AuditLogEntry,
  CompanySettings,
  CurrencyCode,
  ExportDocType,
  ExportDocument,
  ExportOrder,
  Inquiry,
  ListingType,
  OrderMessage,
  OrderMilestone,
  OrderStatusRecord,
  PersistedUserRole,
  Quotation,
  ShippingMethod,
  SourcingOption,
  SourcingRequest,
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

export async function registerCustomerProfile(input: {
  uid: string;
  email: string;
  displayName: string;
  companyName: string;
  country: string;
  defaultPortId: string;
  phone: string;
  consigneeAddress: string;
}): Promise<UserProfile> {
  const path = `users/${input.uid}`;
  const payload: UserProfile = {
    uid: input.uid,
    email: input.email.trim().slice(0, 120),
    displayName: input.displayName.trim().slice(0, 100),
    role: 'customer',
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
      actorRole: 'customer',
      action: 'customer_registered',
      targetType: 'user',
      targetId: input.uid,
      summary: `Registered dealer account for ${payload.companyName || payload.displayName} (${payload.country}).`,
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
  }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      role: updates.role,
      verified: Boolean(updates.verified),
      assignedRepName: updates.assignedRepName.trim().slice(0, 100),
      assignedRepEmail: updates.assignedRepEmail.trim().slice(0, 120),
      updatedAt: serverTimestamp(),
    });
    void recordAuditLog({
      actorRole: 'admin',
      action: 'user_role_updated',
      targetType: 'user',
      targetId: uid,
      summary: `Updated user ${uid}: role=${updates.role}, verified=${String(updates.verified)}.`,
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
  listingType: ListingType = 'auction_listing'
): Promise<string> {
  const id = generateDocumentId('ord');
  const orderNumber = `ORD-AUZ-2026-${Math.floor(710 + Math.random() * 289)}`;
  const trackingCode = generateTrackingCode();
  const path = `orders/${id}`;

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
      voyageNumber: '',
      blNumber: '',
      etdDate: '',
      etaDate: '',
      scheduleIsEstimate: true,
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
      etaDate: '',
      publicNote: `Order ${orderNumber} opened following customer quotation approval.`,
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
  voyageNumber: string;
  blNumber: string;
  etdDate: string;
  etaDate: string;
  scheduleIsEstimate: boolean;
  actorRole: UserRole;
}): Promise<void> {
  const path = `orders/${params.order.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'orders', params.order.id), {
      milestone: params.milestone,
      vesselName: params.vesselName.trim().slice(0, 100),
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
        etaDate: params.etaDate.trim().slice(0, 32),
        publicNote: `Stage updated to ${params.milestone.replace(/_/g, ' ')}${params.vesselName ? ` · Vessel: ${params.vesselName}` : ''}.`,
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
      summary: `Updated ${params.order.orderNumber} to ${params.milestone} (${params.vesselName || 'No vessel yet'}).`,
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
