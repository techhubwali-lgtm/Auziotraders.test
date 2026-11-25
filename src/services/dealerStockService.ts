import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_DEALER_PRICING_RULES } from '../data/dealerPricing';
import { auth, db } from '../lib/firebase';
import type {
  DealerImportError,
  DealerInquiry,
  DealerPriceHistoryEntry,
  DealerPricingRules,
  DealerSource,
  DealerStockVehicle,
  DealerSyncLog,
} from '../types/portal';

// =============================================================================
// 7 Dedicated Firestore Collections (strictly isolated from auction `vehicles`)
// =============================================================================
const COL_DEALER_SOURCES = 'dealer_sources';
const COL_DEALER_STOCK = 'dealer_stock';
const COL_DEALER_SYNC_LOGS = 'dealer_sync_logs';
const COL_DEALER_PRICE_HISTORY = 'dealer_price_history';
const COL_DEALER_INQUIRIES = 'dealer_inquiries';
const COL_DEALER_PRICING_RULES = 'dealer_pricing_rules';
const COL_DEALER_IMPORT_ERRORS = 'dealer_import_errors';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Staff sign-in required.');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

export function subscribeDealerStockPublic(
  onData: (items: DealerStockVehicle[]) => void
): Unsubscribe {
  const q = query(collection(db, COL_DEALER_STOCK), orderBy('syncedAt', 'desc'), limit(250));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        ...(d.data() as DealerStockVehicle),
        id: d.id,
      }));
      onData(items);
    },
    (err) => {
      console.warn('dealer_stock subscription warning:', err.message);
      onData([]);
    }
  );
}

export function subscribeDealerSources(
  enabled: boolean,
  onData: (items: DealerSource[]) => void
): Unsubscribe {
  if (!enabled) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, COL_DEALER_SOURCES));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ ...(d.data() as DealerSource), id: d.id }))
        .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));
      onData(items);
    },
    (err) => {
      console.warn('dealer_sources subscription warning:', err.message);
      onData([]);
    }
  );
}

export function subscribeDealerPricingRules(
  enabled: boolean,
  onData: (rules: DealerPricingRules) => void
): Unsubscribe {
  if (!enabled) {
    onData(DEFAULT_DEALER_PRICING_RULES);
    return () => {};
  }
  const ref = doc(db, COL_DEALER_PRICING_RULES, 'default');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onData({ ...DEFAULT_DEALER_PRICING_RULES, ...(snap.data() as Partial<DealerPricingRules>), id: 'default' });
      } else {
        onData(DEFAULT_DEALER_PRICING_RULES);
      }
    },
    () => {
      onData(DEFAULT_DEALER_PRICING_RULES);
    }
  );
}

export function subscribeDealerSyncLogs(
  enabled: boolean,
  onData: (logs: DealerSyncLog[]) => void
): Unsubscribe {
  if (!enabled) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, COL_DEALER_SYNC_LOGS), orderBy('startedAt', 'desc'), limit(60));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ ...(d.data() as DealerSyncLog), id: d.id })));
    },
    () => onData([])
  );
}

export function subscribeDealerPriceHistory(
  enabled: boolean,
  onData: (entries: DealerPriceHistoryEntry[]) => void
): Unsubscribe {
  if (!enabled) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, COL_DEALER_PRICE_HISTORY), orderBy('recordedAt', 'desc'), limit(80));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ ...(d.data() as DealerPriceHistoryEntry), id: d.id })));
    },
    () => onData([])
  );
}

export function subscribeDealerImportErrors(
  enabled: boolean,
  onData: (errors: DealerImportError[]) => void
): Unsubscribe {
  if (!enabled) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, COL_DEALER_IMPORT_ERRORS), orderBy('occurredAt', 'desc'), limit(80));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ ...(d.data() as DealerImportError), id: d.id })));
    },
    () => onData([])
  );
}

export function subscribeDealerInquiries(
  enabled: boolean,
  onData: (items: DealerInquiry[]) => void
): Unsubscribe {
  if (!enabled) {
    onData([]);
    return () => {};
  }
  const q = query(collection(db, COL_DEALER_INQUIRIES), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ ...(d.data() as DealerInquiry), id: d.id })));
    },
    () => onData([])
  );
}

// =============================================================================
// Server-Side API Bridges (never scrapes from customer browser)
// =============================================================================

export async function fetchCandidateDealerRegistry(): Promise<{
  ok: boolean;
  emergencyStop: boolean;
  sources: DealerSource[];
}> {
  const res = await fetch('/api/dealer-stock/registry');
  if (!res.ok) throw new Error('Unable to load candidate dealer registry.');
  return res.json();
}

export async function registerAllCandidateDealerSources(): Promise<number> {
  const reg = await fetchCandidateDealerRegistry();
  const batch = writeBatch(db);
  for (const src of reg.sources) {
    const ref = doc(db, COL_DEALER_SOURCES, src.id);
    batch.set(
      ref,
      {
        ...src,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
  await batch.commit();
  return reg.sources.length;
}

export async function saveDealerSource(source: DealerSource): Promise<void> {
  const ref = doc(db, COL_DEALER_SOURCES, source.id);
  await setDoc(
    ref,
    {
      ...source,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function saveDealerPricingRules(
  rules: DealerPricingRules,
  updatedByEmail: string
): Promise<void> {
  const ref = doc(db, COL_DEALER_PRICING_RULES, 'default');
  await setDoc(
    ref,
    {
      ...rules,
      id: 'default',
      updatedByEmail,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function toggleDealerEmergencyStop(
  active: boolean,
  rules: DealerPricingRules,
  actorEmail: string
): Promise<boolean> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/dealer-stock/emergency-stop', {
    method: 'POST',
    headers,
    body: JSON.stringify({ active }),
  });
  const data = (await res.json()) as { ok: boolean; emergencyStop: boolean };
  await saveDealerPricingRules({ ...rules, emergencyStop: active }, actorEmail);
  return data.emergencyStop;
}

export interface ServerSourceAuditReport {
  sourceId: string;
  auditedAt: string;
  urlValid: boolean;
  robotsAllowed: boolean;
  robotsStatus: number;
  robotsSummary: string;
  httpStatus: number | null;
  antiBotDetected: boolean;
  complianceStatus: DealerSource['complianceStatus'];
  recommendation: string;
  sampleExtractedCount: number;
  sampleVehicles: DealerStockVehicle[];
  verifiedRealExtraction: boolean;
  errors: Array<Omit<DealerImportError, 'id' | 'createdAt'>>;
}

export async function testDealerSourceServer(params: {
  source: DealerSource;
  pricingRules: DealerPricingRules;
  liveJpyRate?: number;
}): Promise<ServerSourceAuditReport> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/dealer-stock/test-source', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const payload = (await res.json()) as { ok: boolean; report?: ServerSourceAuditReport; error?: string };
  if (!res.ok || !payload.ok || !payload.report) {
    throw new Error(payload.error || 'Dealer source compliance test failed.');
  }

  // Persist audit findings back onto dealer_sources
  const r = payload.report;
  const shouldDisable =
    r.complianceStatus === 'prohibited' || r.complianceStatus === 'blocked';

  await saveDealerSource({
    ...params.source,
    enabled: shouldDisable ? false : params.source.enabled,
    complianceStatus: r.complianceStatus,
    robotsAllowed: r.robotsAllowed,
    robotsSummary: r.robotsSummary,
    httpStatus: r.httpStatus,
    antiBotDetected: r.antiBotDetected,
    recommendation: r.recommendation,
    lastAuditedAt: r.auditedAt,
    verifiedRealExtraction: r.verifiedRealExtraction,
    lastError: r.errors[0]?.message || null,
  });

  // Record audit errors if any
  for (const err of r.errors.slice(0, 5)) {
    await setDoc(doc(db, COL_DEALER_IMPORT_ERRORS, makeDocId('err')), {
      ...err,
      createdAt: serverTimestamp(),
    });
  }

  return r;
}

export interface ServerSyncBatchResponse {
  ok: boolean;
  aborted: boolean;
  sourceId: string;
  sourceName: string;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  sourceFailedToLoad: boolean;
  complianceAllowed: boolean;
  complianceReason: string;
  vehicles: DealerStockVehicle[];
  priceRecords: Array<{
    vehicleId: string;
    dedupeKey: string;
    sourceId: string;
    stockId: string;
    vehicleTitle: string;
    originalDealerPriceJpy: number | null;
    totalDealerPriceJpy: number | null;
    estimatedFobUsd: number | null;
  }>;
  duplicateSkippedCount: number;
  errors: Array<Omit<DealerImportError, 'id' | 'createdAt'>>;
}

/**
 * Triggers server-side extraction and persists normalized vehicles, price history,
 * sync logs, and import errors into Firestore with safe lifecycle rules:
 * - Deduplicates via deterministic `dedupeKey`
 * - Tracks price changes in staff-only `dealer_price_history`
 * - NEVER marks all vehicles as sold if the source fails to load (marks them `unverified` instead!)
 */
export async function syncDealerSourceNow(params: {
  source: DealerSource;
  pricingRules: DealerPricingRules;
  liveJpyRate?: number;
  maxVehicles?: number;
  dryRun?: boolean;
  trigger?: DealerSyncLog['trigger'];
  actorEmail: string;
}): Promise<{
  batch: ServerSyncBatchResponse;
  log: DealerSyncLog;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/dealer-stock/sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source: params.source,
      pricingRules: params.pricingRules,
      liveJpyRate: params.liveJpyRate,
      maxVehicles: params.maxVehicles ?? params.source.maxVehiclesPerSync ?? 50,
      dryRun: Boolean(params.dryRun),
    }),
  });

  const batch = (await res.json()) as ServerSyncBatchResponse;
  if (!res.ok) {
    throw new Error(batch.complianceReason || 'Server dealer sync request failed.');
  }

  return persistExtractedBatch({
    source: params.source,
    batch,
    trigger: params.dryRun ? 'dry_run' : params.trigger || 'manual',
    actorEmail: params.actorEmail,
  });
}

export async function importAuthorizedDealerFeed(params: {
  source: DealerSource;
  format: 'csv' | 'xml';
  content: string;
  pricingRules: DealerPricingRules;
  liveJpyRate?: number;
  actorEmail: string;
}): Promise<{
  batch: ServerSyncBatchResponse;
  log: DealerSyncLog;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/dealer-stock/import-feed', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source: params.source,
      format: params.format,
      content: params.content,
      pricingRules: params.pricingRules,
      liveJpyRate: params.liveJpyRate,
      maxVehicles: 100,
    }),
  });
  const batch = (await res.json()) as ServerSyncBatchResponse;
  if (!res.ok) {
    throw new Error('Authorized feed import failed on server.');
  }

  return persistExtractedBatch({
    source: { ...params.source, complianceStatus: 'authorized_feed' },
    batch,
    trigger: 'feed_import',
    actorEmail: params.actorEmail,
  });
}

async function persistExtractedBatch(params: {
  source: DealerSource;
  batch: ServerSyncBatchResponse;
  trigger: DealerSyncLog['trigger'];
  actorEmail: string;
}): Promise<{ batch: ServerSyncBatchResponse; log: DealerSyncLog }> {
  const { source, batch, trigger, actorEmail } = params;
  const nowIso = new Date().toISOString();

  let newCount = 0;
  let updatedCount = 0;
  let priceChangedCount = 0;
  let markedSoldCount = 0;
  let markedUnverifiedCount = 0;

  if (!batch.dryRun) {
    // Load existing vehicles for this source to diff cleanly
    const existingSnap = await getDocs(
      query(collection(db, COL_DEALER_STOCK), where('sourceId', '==', source.id))
    );
    const existingById = new Map<string, DealerStockVehicle>();
    existingSnap.forEach((d) => {
      existingById.set(d.id, { ...(d.data() as DealerStockVehicle), id: d.id });
    });

    const priceRecById = new Map(batch.priceRecords.map((p) => [p.vehicleId, p]));
    const wb = writeBatch(db);
    let ops = 0;

    const commitIfNeeded = async () => {
      if (ops >= 380) {
        await wb.commit();
        ops = 0;
      }
    };

    if (batch.sourceFailedToLoad || !batch.complianceAllowed || batch.aborted) {
      // CRITICAL SAFEGUARD: Never mark all vehicles as sold when a source fails!
      // Mark currently available vehicles from this source as `unverified` until rechecked.
      for (const existing of existingById.values()) {
        if (existing.status === 'available') {
          wb.update(doc(db, COL_DEALER_STOCK, existing.id), {
            status: 'unverified',
            updatedAt: serverTimestamp(),
          });
          markedUnverifiedCount += 1;
          ops += 1;
        }
      }
    } else {
      const seenIds = new Set<string>();
      for (const vehicle of batch.vehicles) {
        seenIds.add(vehicle.id);
        const existing = existingById.get(vehicle.id);
        const priceRec = priceRecById.get(vehicle.id);

        if (!existing) {
          newCount += 1;
          wb.set(doc(db, COL_DEALER_STOCK, vehicle.id), {
            ...vehicle,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          ops += 1;

          if (priceRec) {
            wb.set(doc(db, COL_DEALER_PRICE_HISTORY, makeDocId('ph')), {
              vehicleId: vehicle.id,
              sourceId: source.id,
              stockId: vehicle.stockId,
              vehicleTitle: priceRec.vehicleTitle,
              previousDealerPriceJpy: null,
              newDealerPriceJpy: priceRec.originalDealerPriceJpy,
              previousTotalPriceJpy: null,
              newTotalPriceJpy: priceRec.totalDealerPriceJpy,
              previousEstimatedFobUsd: null,
              newEstimatedFobUsd: priceRec.estimatedFobUsd,
              changeType: 'initial',
              recordedAt: nowIso,
              createdAt: serverTimestamp(),
            });
            ops += 1;
          }
        } else {
          updatedCount += 1;
          const prevFob = existing.estimatedFobUsd;
          const nextFob = vehicle.estimatedFobUsd;
          if (prevFob !== null && nextFob !== null && prevFob !== nextFob) {
            priceChangedCount += 1;
            wb.set(doc(db, COL_DEALER_PRICE_HISTORY, makeDocId('ph')), {
              vehicleId: vehicle.id,
              sourceId: source.id,
              stockId: vehicle.stockId,
              vehicleTitle: priceRec?.vehicleTitle || `${vehicle.manufacturer || ''} ${vehicle.model || ''}`.trim(),
              previousDealerPriceJpy: null,
              newDealerPriceJpy: priceRec?.originalDealerPriceJpy ?? null,
              previousTotalPriceJpy: null,
              newTotalPriceJpy: priceRec?.totalDealerPriceJpy ?? null,
              previousEstimatedFobUsd: prevFob,
              newEstimatedFobUsd: nextFob,
              changeType: nextFob > prevFob ? 'price_increase' : 'price_decrease',
              recordedAt: nowIso,
              createdAt: serverTimestamp(),
            });
            ops += 1;
          }

          wb.set(
            doc(db, COL_DEALER_STOCK, vehicle.id),
            {
              ...vehicle,
              featured: existing.featured,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          ops += 1;
        }
        await commitIfNeeded();
      }

      // Only if a clean sync returned listings: mark missing listings that were previously unverified as sold,
      // and newly missing listings as `unverified` first (two-cycle grace prevents false sold markings!).
      if (batch.vehicles.length > 0) {
        for (const existing of existingById.values()) {
          if (seenIds.has(existing.id)) continue;
          if (existing.status === 'available') {
            wb.update(doc(db, COL_DEALER_STOCK, existing.id), {
              status: 'unverified',
              updatedAt: serverTimestamp(),
            });
            markedUnverifiedCount += 1;
            ops += 1;
          } else if (existing.status === 'unverified') {
            wb.update(doc(db, COL_DEALER_STOCK, existing.id), {
              status: 'sold',
              updatedAt: serverTimestamp(),
            });
            markedSoldCount += 1;
            ops += 1;
          }
        }
      }
    }

    // Record errors (capped at 15 per run)
    for (const err of batch.errors.slice(0, 15)) {
      wb.set(doc(db, COL_DEALER_IMPORT_ERRORS, makeDocId('err')), {
        ...err,
        createdAt: serverTimestamp(),
      });
      ops += 1;
    }

    if (ops > 0) {
      await wb.commit();
    }

    // Update dealer_sources metadata
    await saveDealerSource({
      ...source,
      enabled: !batch.complianceAllowed ? false : source.enabled,
      complianceStatus: !batch.complianceAllowed
        ? 'prohibited'
        : batch.vehicles.length > 0 && source.complianceStatus !== 'authorized_feed'
          ? 'verified_compliant'
          : source.complianceStatus,
      lastSyncedAt: nowIso,
      lastSyncStatus: batch.aborted
        ? 'failed'
        : batch.ok
          ? batch.errors.length > 0
            ? 'partial'
            : 'success'
          : 'failed',
      lastExtractedCount: batch.vehicles.length,
      totalImportedCount: Math.max(source.totalImportedCount || 0, batch.vehicles.length),
      lastError: batch.errors[0]?.message || (!batch.complianceAllowed ? batch.complianceReason : null),
      verifiedRealExtraction: source.verifiedRealExtraction || batch.vehicles.length > 0,
    });
  }

  const logId = makeDocId('synclog');
  const log: DealerSyncLog = {
    id: logId,
    sourceId: source.id,
    sourceName: source.name,
    trigger,
    status: batch.aborted
      ? 'aborted'
      : batch.ok
        ? batch.errors.length > 0
          ? 'partial'
          : 'success'
        : 'failed',
    startedAt: batch.startedAt,
    finishedAt: batch.finishedAt,
    durationMs: batch.durationMs,
    fetchedCount: batch.vehicles.length,
    newCount,
    updatedCount,
    priceChangedCount,
    markedSoldCount,
    markedUnverifiedCount,
    duplicateSkippedCount: batch.duplicateSkippedCount,
    errorCount: batch.errors.length,
    triggeredByEmail: actorEmail,
    summary: batch.dryRun
      ? `Dry-run preview fetched ${batch.vehicles.length} real vehicles from ${source.name} (no database writes).`
      : batch.ok
        ? `Synced ${batch.vehicles.length} vehicles (${newCount} new, ${updatedCount} updated, ${priceChangedCount} price changes, ${markedUnverifiedCount} unverified, ${markedSoldCount} sold).`
        : batch.complianceReason || batch.errors[0]?.message || 'Sync failed.',
  };

  await setDoc(doc(db, COL_DEALER_SYNC_LOGS, logId), {
    ...log,
    createdAt: serverTimestamp(),
  });

  return { batch, log };
}

export async function toggleDealerVehicleFeatured(
  vehicleId: string,
  featured: boolean
): Promise<void> {
  await updateDoc(doc(db, COL_DEALER_STOCK, vehicleId), {
    featured,
    updatedAt: serverTimestamp(),
  });
}

export async function updateDealerVehicleStatus(
  vehicleId: string,
  status: DealerStockVehicle['status']
): Promise<void> {
  await updateDoc(doc(db, COL_DEALER_STOCK, vehicleId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDealerStockVehicle(vehicleId: string): Promise<void> {
  await deleteDoc(doc(db, COL_DEALER_STOCK, vehicleId));
}

export async function submitDealerInquiry(
  input: Omit<DealerInquiry, 'id' | 'inquiryCode' | 'status' | 'staffNotes' | 'createdAt' | 'updatedAt'>
): Promise<DealerInquiry> {
  const id = makeDocId('dinq');
  const inquiryCode = `DLR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  const record: DealerInquiry = {
    ...input,
    id,
    inquiryCode,
    status: 'new',
    staffNotes: '',
  };
  await setDoc(doc(db, COL_DEALER_INQUIRIES, id), {
    ...record,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return record;
}

export async function updateDealerInquiryStaff(
  inquiryId: string,
  updates: { status?: DealerInquiry['status']; staffNotes?: string }
): Promise<void> {
  await updateDoc(doc(db, COL_DEALER_INQUIRIES, inquiryId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}
