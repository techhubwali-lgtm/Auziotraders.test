import type {
  AisServiceStatusResponse,
  AisTestConnectionResponse,
  LiveVesselTelemetry,
  RegisteredVessel,
} from '../types/portal';

export async function fetchAisStatus(): Promise<AisServiceStatusResponse> {
  const res = await fetch('/api/ais/status', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`AIS status request failed (${res.status})`);
  }
  return (await res.json()) as AisServiceStatusResponse;
}

export async function fetchAisPositions(): Promise<Record<string, LiveVesselTelemetry>> {
  const res = await fetch('/api/ais/positions', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return {};
  const data = (await res.json()) as { ok?: boolean; positions?: Record<string, LiveVesselTelemetry> };
  return data.positions || {};
}

export async function syncAisFilters(
  idToken: string,
  payload: { enabled: boolean; mmsis: string[] }
): Promise<AisServiceStatusResponse> {
  const res = await fetch('/api/ais/sync-filters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as AisServiceStatusResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Unable to sync AISStream vessel filters');
  }
  return data;
}

export async function testAisStreamConnection(
  idToken: string,
  mmsis?: string[]
): Promise<AisTestConnectionResponse> {
  const res = await fetch('/api/ais/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ mmsis: mmsis || [] }),
  });
  return (await res.json()) as AisTestConnectionResponse;
}

export async function clearAisServerLogs(idToken: string): Promise<void> {
  await fetch('/api/ais/clear-logs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
}

export async function bootstrapAisFleet(mmsis: string[]): Promise<AisServiceStatusResponse | null> {
  if (mmsis.length === 0) return null;
  const res = await fetch('/api/ais/bootstrap-fleet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mmsis }),
  });
  if (!res.ok) return null;
  return (await res.json()) as AisServiceStatusResponse;
}

export interface TrackMmsiResponse {
  ok: boolean;
  mmsi: string;
  configured: boolean;
  connected: boolean;
  state: string;
  position: LiveVesselTelemetry | null;
  message: string;
}

export async function trackLiveMmsi(mmsi: string): Promise<TrackMmsiResponse> {
  const res = await fetch('/api/ais/track-mmsi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mmsi }),
  });
  return (await res.json()) as TrackMmsiResponse;
}

export interface VesselSearchCandidate {
  imo: string;
  mmsi: string;
  name: string;
  vesselType: string;
  flag: string;
  yearBuilt: string;
  detailId: string;
}

export interface VesselLookupResponse {
  ok: boolean;
  query: string;
  queryType: 'imo' | 'mmsi' | 'name';
  vessel: LiveVesselTelemetry | null;
  candidates: VesselSearchCandidate[];
  source: 'aisstream' | 'global_ais' | 'none';
  message: string;
}

export async function lookupVesselByNumber(
  query: string,
  bypassCache = false
): Promise<VesselLookupResponse> {
  const res = await fetch('/api/ais/lookup-vessel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query.trim(), bypassCache }),
  });
  return (await res.json()) as VesselLookupResponse;
}

export function telemetryToRegisteredVessel(live: LiveVesselTelemetry): RegisteredVessel {
  const idKey = live.mmsi || live.imo || live.vesselName.replace(/\s+/g, '-');
  return {
    id: `live-${idKey}`,
    name: live.vesselName || (live.imo ? `Vessel IMO ${live.imo}` : `Vessel MMSI ${live.mmsi}`),
    mmsi: live.mmsi || '',
    imo: live.imo || '',
    callSign: live.callSign || '',
    carrier: [live.vesselType, live.flag ? `${live.flag} Flag` : ''].filter(Boolean).join(' · ') || 'Live AIS Vessel',
    voyageNumber: '',
    originPort: live.lastPort || '',
    destinationPort: live.destination || '',
    etaReported: live.reportedEta || '',
    etaManual: '',
    latitude: live.latitude ?? null,
    longitude: live.longitude ?? null,
    speedKnots: live.speedKnots ?? null,
    courseDeg: live.courseDeg ?? null,
    headingDeg: live.headingDeg ?? null,
    navStatus: live.navStatus ?? null,
    aisDestination: live.destination || '',
    lastAisUpdateAt: live.lastAisUpdateAt || '',
    manualStatus: live.navStatusText || '',
    manualLocationNote: live.lastPort
      ? `Last departed port: ${live.lastPort}${live.positionReceivedAgo ? ` · AIS signal ${live.positionReceivedAgo}` : ''}`
      : '',
    manualLatitude: null,
    manualLongitude: null,
    manualUpdatedAt: '',
    trackingEnabled: true,
  };
}

/**
 * Merges Firestore-persisted vessel records with any fresher real-time AIS telemetry
 * currently held in the backend WebSocket cache.
 */
export function mergeVesselsWithLiveAis(
  vessels: RegisteredVessel[],
  livePositions: Record<string, LiveVesselTelemetry>
): RegisteredVessel[] {
  return vessels.map((v) => {
    const live = livePositions[v.mmsi];
    if (!live) return v;

    const storedMs = v.lastAisUpdateAt ? Date.parse(v.lastAisUpdateAt) : 0;
    const liveMs = live.lastAisUpdateAt ? Date.parse(live.lastAisUpdateAt) : 0;
    if (storedMs && liveMs && liveMs < storedMs) {
      return v;
    }

    return {
      ...v,
      name: v.name || live.vesselName,
      imo: v.imo || live.imo,
      callSign: v.callSign || live.callSign,
      latitude: live.latitude ?? v.latitude,
      longitude: live.longitude ?? v.longitude,
      speedKnots: live.speedKnots ?? v.speedKnots,
      courseDeg: live.courseDeg ?? v.courseDeg,
      headingDeg: live.headingDeg ?? v.headingDeg,
      navStatus: live.navStatus ?? v.navStatus,
      aisDestination: live.destination || v.aisDestination,
      etaReported: live.reportedEta || v.etaReported,
      lastAisUpdateAt: live.lastAisUpdateAt || v.lastAisUpdateAt,
    };
  });
}

export type VesselFreshnessStatus = 'live' | 'stale' | 'outdated' | 'manual_only' | 'no_signal';

export function getVesselFreshness(vessel: RegisteredVessel): {
  status: VesselFreshnessStatus;
  label: string;
  ageHours: number | null;
} {
  if (!vessel.lastAisUpdateAt || vessel.latitude === null || vessel.longitude === null) {
    if (vessel.manualUpdatedAt || vessel.manualLocationNote) {
      return {
        status: 'manual_only',
        label: 'Manual Coordinator Update',
        ageHours: null,
      };
    }
    return {
      status: 'no_signal',
      label: 'Awaiting AIS Broadcast',
      ageHours: null,
    };
  }

  const ts = Date.parse(vessel.lastAisUpdateAt);
  if (Number.isNaN(ts)) {
    return { status: 'no_signal', label: 'Awaiting AIS Broadcast', ageHours: null };
  }

  const ageHours = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60));
  if (ageHours <= 6) {
    return { status: 'live', label: 'Live AIS Signal', ageHours };
  }
  if (ageHours <= 24) {
    return { status: 'stale', label: `Delayed AIS (${Math.round(ageHours)}h ago)`, ageHours };
  }
  return {
    status: 'outdated',
    label: `Outdated Position (${Math.floor(ageHours / 24)}d ago)`,
    ageHours,
  };
}

export function formatNavigationalStatus(code: number | null | undefined): string {
  switch (code) {
    case 0:
      return 'Under way using engine';
    case 1:
      return 'At anchor';
    case 2:
      return 'Not under command';
    case 3:
      return 'Restricted maneuverability';
    case 4:
      return 'Constrained by draught';
    case 5:
      return 'Moored';
    case 6:
      return 'Aground';
    case 7:
      return 'Engaged in fishing';
    case 8:
      return 'Under way sailing';
    default:
      return 'In transit / Not reported';
  }
}
