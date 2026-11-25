/**
 * Server-Side AISStream Live Vessel Tracking Service
 * Provider: AISStream (https://aisstream.io/documentation)
 * Endpoint: wss://stream.aisstream.io/v0/stream
 *
 * Security & Protocol Guarantees:
 * - Reads AISSTREAM_API_KEY strictly from process.env (never exposed to browser or Firestore).
 * - Uses Node.js `ws` package with `perMessageDeflate: true`.
 * - NEVER subscribes with empty FiltersShipMMSI — requires at least one validated 9-digit MMSI.
 * - Sends exact AISStream subscription payload immediately upon socket open (within 3 seconds).
 * - Handles automatic reconnection with exponential backoff and bounded error logging.
 */

import WebSocket from 'ws';

const AISSTREAM_WS_URL = 'wss://stream.aisstream.io/v0/stream';
const MMSI_REGEX = /^\d{9}$/;
const MAX_ERROR_LOGS = 50;
const BASE_RECONNECT_MS = 5000;
const MAX_RECONNECT_MS = 60000;

export type AisConnectionState =
  | 'unconfigured'
  | 'disabled'
  | 'idle_no_vessels'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface LiveVesselTelemetry {
  mmsi: string;
  vesselName: string;
  imo: string;
  callSign: string;
  latitude: number | null;
  longitude: number | null;
  speedKnots: number | null;
  courseDeg: number | null;
  headingDeg: number | null;
  navStatus: number | null;
  navStatusText?: string;
  vesselType?: string;
  flag?: string;
  lastPort?: string;
  positionReceivedAgo?: string;
  destination: string;
  reportedEta: string;
  lastAisUpdateAt: string;
  messageType: 'PositionReport' | 'ShipStaticData';
  dataSource?: 'aisstream' | 'global_ais';
}

export interface AisErrorLogEntry {
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  message: string;
}

export interface AisServiceStatus {
  configured: boolean;
  enabled: boolean;
  connected: boolean;
  state: AisConnectionState;
  endpoint: string;
  subscribedMmsis: string[];
  lastConnectedAt: string | null;
  lastMessageAt: string | null;
  lastSyncAt: string | null;
  reconnectAttempts: number;
  trackedVesselCount: number;
  positions: Record<string, LiveVesselTelemetry>;
  errorLogs: AisErrorLogEntry[];
}

export interface AisTestConnectionResult {
  ok: boolean;
  configured: boolean;
  testedAt: string;
  latencyMs: number;
  handshakeOk: boolean;
  subscriptionSent: boolean;
  sampleReceived: boolean;
  testedMmsis: string[];
  message: string;
  error?: string;
}

interface AisRawEnvelope {
  error?: string;
  MessageType?: string;
  MetaData?: {
    MMSI?: number | string;
    MMSI_String?: string;
    ShipName?: string;
    latitude?: number;
    longitude?: number;
    time_utc?: string;
  };
  Message?: {
    PositionReport?: {
      UserID?: number;
      Latitude?: number;
      Longitude?: number;
      Sog?: number;
      Cog?: number;
      TrueHeading?: number;
      NavigationalStatus?: number;
    };
    ShipStaticData?: {
      UserID?: number;
      ImoNumber?: number;
      CallSign?: string;
      Name?: string;
      Destination?: string;
      Eta?: {
        Month?: number;
        Day?: number;
        Hour?: number;
        Minute?: number;
      };
    };
  };
}

function getApiKey(): string {
  return (process.env.AISSTREAM_API_KEY || '').trim();
}

export function sanitizeMmsiList(rawList: unknown): string[] {
  if (!Array.isArray(rawList)) return [];
  const unique = new Set<string>();
  for (const item of rawList) {
    const cleaned = String(item ?? '').trim();
    if (MMSI_REGEX.test(cleaned)) {
      unique.add(cleaned);
    }
  }
  return Array.from(unique).slice(0, 100);
}

function formatAisEta(eta?: { Month?: number; Day?: number; Hour?: number; Minute?: number }): string {
  if (!eta) return '';
  const month = Number(eta.Month || 0);
  const day = Number(eta.Day || 0);
  const hour = Number(eta.Hour ?? 24);
  const minute = Number(eta.Minute ?? 60);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = hour >= 0 && hour <= 23 ? String(hour).padStart(2, '0') : '00';
  const min = minute >= 0 && minute <= 59 ? String(minute).padStart(2, '0') : '00';
  return `${mm}-${dd} ${hh}:${min} UTC`;
}

const MAX_ON_DEMAND_MMSIS = 20;
const ON_DEMAND_TTL_MS = 30 * 60 * 1000;

class AisStreamManager {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private enabled = true;
  private registeredMmsis: string[] = [];
  private onDemandMmsis = new Map<string, number>(); // mmsi -> expiresAtMs
  private state: AisConnectionState = 'idle_no_vessels';
  private lastConnectedAt: string | null = null;
  private lastMessageAt: string | null = null;
  private lastSyncAt: string | null = null;
  private reconnectAttempts = 0;
  private positions = new Map<string, LiveVesselTelemetry>();
  private errorLogs: AisErrorLogEntry[] = [];
  private mmsiWaiters = new Map<string, Array<(telemetry: LiveVesselTelemetry) => void>>();

  private getEffectiveMmsis(): string[] {
    const now = Date.now();
    for (const [mmsi, exp] of this.onDemandMmsis.entries()) {
      if (exp <= now) {
        this.onDemandMmsis.delete(mmsi);
      }
    }
    const merged = new Set<string>(this.registeredMmsis);
    for (const mmsi of this.onDemandMmsis.keys()) {
      merged.add(mmsi);
    }
    return Array.from(merged).slice(0, 100);
  }

  private pushLog(level: 'error' | 'warning' | 'info', message: string) {
    // Scrub any accidental key leakage before logging
    const apiKey = getApiKey();
    const safeMsg = apiKey ? message.replaceAll(apiKey, '[REDACTED]') : message;
    this.errorLogs.unshift({
      timestamp: new Date().toISOString(),
      level,
      message: safeMsg.slice(0, 400),
    });
    if (this.errorLogs.length > MAX_ERROR_LOGS) {
      this.errorLogs.length = MAX_ERROR_LOGS;
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeSocket(reason?: string) {
    this.clearReconnectTimer();
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        if (
          this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING
        ) {
          this.socket.close(1000, reason || 'filter_update');
        }
      } catch {
        // Ignore close errors
      }
      this.socket = null;
    }
  }

  public syncFilters(params: { enabled: boolean; mmsis: string[] }): AisServiceStatus {
    const prevEffective = this.getEffectiveMmsis();
    const nextRegistered = sanitizeMmsiList(params.mmsis);
    const nextEnabled = Boolean(params.enabled);

    this.enabled = nextEnabled;
    this.registeredMmsis = nextRegistered;
    this.lastSyncAt = new Date().toISOString();

    const nextEffective = this.getEffectiveMmsis();
    const filtersChanged =
      nextEffective.length !== prevEffective.length ||
      nextEffective.some((m, i) => m !== prevEffective[i]);

    if (!getApiKey()) {
      this.closeSocket('unconfigured');
      this.state = 'unconfigured';
      return this.getStatus();
    }

    if (!this.enabled) {
      this.closeSocket('disabled');
      this.state = 'disabled';
      return this.getStatus();
    }

    if (nextEffective.length === 0) {
      // Strictly never subscribe to AISStream without registered/requested MMSI filters
      this.closeSocket('no_vessels');
      this.state = 'idle_no_vessels';
      return this.getStatus();
    }

    if (filtersChanged || !this.socket || this.socket.readyState === WebSocket.CLOSED) {
      this.reconnectAttempts = 0;
      this.connect();
    }

    return this.getStatus();
  }

  /**
   * Allows public app boot to hydrate registered fleet MMSIs from Firestore if the server
   * restarted and currently has no registered MMSIs loaded yet.
   */
  public bootstrapFleetMmsis(mmsis: string[]): AisServiceStatus {
    const clean = sanitizeMmsiList(mmsis);
    if (clean.length === 0 || this.registeredMmsis.length > 0 || !this.enabled) {
      return this.getStatus();
    }
    return this.syncFilters({ enabled: this.enabled, mmsis: clean });
  }

  /**
   * Stores verified real-time AIS telemetry resolved via the global maritime lookup service,
   * without overwriting a fresher direct AISStream WebSocket packet.
   */
  public ingestExternalTelemetry(telemetry: LiveVesselTelemetry) {
    if (!MMSI_REGEX.test(telemetry.mmsi)) return;
    const existing = this.positions.get(telemetry.mmsi);
    if (existing && existing.dataSource === 'aisstream') {
      const existingMs = Date.parse(existing.lastAisUpdateAt || '');
      const incomingMs = Date.parse(telemetry.lastAisUpdateAt || '');
      if (Number.isFinite(existingMs) && Number.isFinite(incomingMs) && existingMs >= incomingMs) {
        return;
      }
    }
    this.positions.set(telemetry.mmsi, {
      ...existing,
      ...telemetry,
      dataSource: telemetry.dataSource || 'global_ais',
    });
  }

  /**
   * Registers an on-demand 9-digit MMSI with AISStream in the background without blocking HTTP responses.
   */
  public registerOnDemandMmsiBackground(rawMmsi: string) {
    const mmsi = String(rawMmsi || '').replace(/\D/g, '').trim();
    if (!MMSI_REGEX.test(mmsi) || !getApiKey() || !this.enabled) return;
    const prevEffective = this.getEffectiveMmsis();
    if (!this.onDemandMmsis.has(mmsi) && this.onDemandMmsis.size >= MAX_ON_DEMAND_MMSIS) {
      const oldestKey = this.onDemandMmsis.keys().next().value;
      if (oldestKey) this.onDemandMmsis.delete(oldestKey);
    }
    this.onDemandMmsis.set(mmsi, Date.now() + ON_DEMAND_TTL_MS);
    this.lastSyncAt = new Date().toISOString();
    const nextEffective = this.getEffectiveMmsis();
    const changed =
      nextEffective.length !== prevEffective.length ||
      nextEffective.some((m, i) => m !== prevEffective[i]);
    if (changed && (!this.socket || this.socket.readyState === WebSocket.OPEN)) {
      this.connect();
    }
  }

  /**
   * Subscribes to a single validated 9-digit MMSI on demand and waits briefly for an
   * immediate AIS broadcast while keeping the persistent stream subscribed.
   */
  public async trackOnDemandMmsi(
    rawMmsi: string,
    waitMs = 7000
  ): Promise<{
    ok: boolean;
    mmsi: string;
    configured: boolean;
    connected: boolean;
    state: AisConnectionState;
    position: LiveVesselTelemetry | null;
    message: string;
  }> {
    const mmsi = String(rawMmsi || '').replace(/\D/g, '').trim();
    if (!MMSI_REGEX.test(mmsi)) {
      return {
        ok: false,
        mmsi,
        configured: Boolean(getApiKey()),
        connected: Boolean(this.socket && this.socket.readyState === WebSocket.OPEN),
        state: this.state,
        position: null,
        message: 'Please enter a valid 9-digit vessel MMSI number (for example: 431001234).',
      };
    }

    if (!getApiKey()) {
      this.state = 'unconfigured';
      return {
        ok: false,
        mmsi,
        configured: false,
        connected: false,
        state: 'unconfigured',
        position: null,
        message: 'AISSTREAM_API_KEY is not configured on the backend server.',
      };
    }

    if (!this.enabled) {
      return {
        ok: false,
        mmsi,
        configured: true,
        connected: false,
        state: 'disabled',
        position: null,
        message: 'AISStream live tracking is currently disabled in Admin Console → API Integrations.',
      };
    }

    const prevEffective = this.getEffectiveMmsis();
    // Enforce cap on temporary on-demand MMSIs (evict oldest)
    if (!this.onDemandMmsis.has(mmsi) && this.onDemandMmsis.size >= MAX_ON_DEMAND_MMSIS) {
      const oldestKey = this.onDemandMmsis.keys().next().value;
      if (oldestKey) this.onDemandMmsis.delete(oldestKey);
    }
    this.onDemandMmsis.set(mmsi, Date.now() + ON_DEMAND_TTL_MS);
    this.lastSyncAt = new Date().toISOString();

    const nextEffective = this.getEffectiveMmsis();
    const needsReconnect =
      !this.socket ||
      this.socket.readyState === WebSocket.CLOSED ||
      nextEffective.length !== prevEffective.length ||
      nextEffective.some((m, i) => m !== prevEffective[i]);

    if (needsReconnect) {
      this.reconnectAttempts = 0;
      this.connect();
    }

    // If we already have a recent cached telemetry packet for this MMSI, return it immediately
    const cached = this.positions.get(mmsi);
    if (cached && cached.latitude !== null && cached.longitude !== null) {
      return {
        ok: true,
        mmsi,
        configured: true,
        connected: Boolean(this.socket && this.socket.readyState === WebSocket.OPEN),
        state: this.state,
        position: cached,
        message: `Live AIS telemetry active for MMSI ${mmsi}.`,
      };
    }

    // Otherwise wait up to waitMs for the first live AIS packet to arrive on the WebSocket
    const received = await new Promise<LiveVesselTelemetry | null>((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        const list = this.mmsiWaiters.get(mmsi) || [];
        this.mmsiWaiters.set(
          mmsi,
          list.filter((fn) => fn !== onHit)
        );
        resolve(this.positions.get(mmsi) || null);
      }, waitMs);

      const onHit = (telemetry: LiveVesselTelemetry) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(telemetry);
      };

      const existing = this.mmsiWaiters.get(mmsi) || [];
      existing.push(onHit);
      this.mmsiWaiters.set(mmsi, existing);
    });

    const isConnected = Boolean(this.socket && this.socket.readyState === WebSocket.OPEN);
    const latestError = this.errorLogs.find((e) => e.level === 'error')?.message;
    return {
      ok: true,
      mmsi,
      configured: true,
      connected: isConnected,
      state: this.state,
      position: received,
      message: received
        ? `Live AIS signal received for ${received.vesselName || `MMSI ${mmsi}`}.`
        : isConnected
          ? `Connected to AISStream and actively listening for MMSI ${mmsi}. Vessels underway broadcast every 10–180 seconds; vessels in deep ocean outside coastal AIS coverage appear once they enter coastal receiver range.`
          : latestError
            ? `Subscribed to MMSI ${mmsi}, but AISStream upstream server (${AISSTREAM_WS_URL}) is currently unresponsive (${latestError}). Auto-reconnect is active; coordinators can post manual position updates in Admin → API Integrations → Vessels.`
            : `Subscribed to MMSI ${mmsi} (${this.state}). Waiting for AISStream WebSocket handshake — retrying automatically in the background.`,
    };
  }

  private connect() {
    const apiKey = getApiKey();
    if (!apiKey) {
      this.state = 'unconfigured';
      return;
    }
    if (!this.enabled) {
      this.state = 'disabled';
      return;
    }
    const effectiveMmsis = this.getEffectiveMmsis();
    if (effectiveMmsis.length === 0) {
      this.state = 'idle_no_vessels';
      return;
    }

    this.closeSocket('reconnecting');
    this.state = 'connecting';

    try {
      const ws = new WebSocket(AISSTREAM_WS_URL, {
        perMessageDeflate: true,
        handshakeTimeout: 10000,
      });
      this.socket = ws;

      ws.on('open', () => {
        if (this.socket !== ws) return;
        this.state = 'connected';
        this.reconnectAttempts = 0;
        this.lastConnectedAt = new Date().toISOString();

        // Send exact required subscription payload immediately (well within 3-second limit)
        const activeMmsis = this.getEffectiveMmsis();
        if (activeMmsis.length === 0) {
          this.closeSocket('no_vessels');
          this.state = 'idle_no_vessels';
          return;
        }
        const subscriptionPayload = {
          APIKey: apiKey,
          BoundingBoxes: [[[-90, -180], [90, 180]]],
          FiltersShipMMSI: activeMmsis,
          FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
        };

        try {
          ws.send(JSON.stringify(subscriptionPayload));
          this.pushLog(
            'info',
            `Subscribed to AISStream for ${activeMmsis.length} vessel MMSI(s): ${activeMmsis.slice(0, 5).join(', ')}${activeMmsis.length > 5 ? '...' : ''}.`
          );
        } catch (sendErr) {
          this.pushLog(
            'error',
            `Failed to send AISStream subscription: ${sendErr instanceof Error ? sendErr.message : 'send error'}`
          );
        }
      });

      ws.on('message', (rawData) => {
        this.handleMessage(rawData);
      });

      ws.on('error', (err) => {
        if (this.socket !== ws) return;
        this.state = 'error';
        this.pushLog('error', `AISStream WebSocket error: ${err.message}`);
      });

      ws.on('close', (code, reasonBuf) => {
        if (this.socket !== ws) return;
        this.socket = null;
        const reason = reasonBuf ? reasonBuf.toString('utf8') : '';
        if (this.enabled && this.getEffectiveMmsis().length > 0 && getApiKey()) {
          this.pushLog(
            'warning',
            `AISStream socket closed (code ${code}${reason ? `: ${reason}` : ''}). Scheduling reconnect.`
          );
          this.scheduleReconnect();
        }
      });
    } catch (err) {
      this.state = 'error';
      this.pushLog(
        'error',
        `AISStream initialization failed: ${err instanceof Error ? err.message : 'unknown error'}`
      );
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    if (!this.enabled || this.getEffectiveMmsis().length === 0 || !getApiKey()) return;

    this.state = 'reconnecting';
    const delay = Math.min(
      MAX_RECONNECT_MS,
      BASE_RECONNECT_MS * Math.pow(2, Math.min(this.reconnectAttempts, 4))
    );
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleMessage(rawData: WebSocket.RawData) {
    try {
      const text = Buffer.isBuffer(rawData) ? rawData.toString('utf8') : String(rawData);
      const parsed = JSON.parse(text) as AisRawEnvelope;

      if (parsed.error) {
        this.state = 'error';
        this.pushLog('error', `AISStream server error: ${parsed.error}`);
        return;
      }

      const meta = parsed.MetaData;
      const pos = parsed.Message?.PositionReport;
      const stat = parsed.Message?.ShipStaticData;

      const mmsiCandidate = String(
        meta?.MMSI_String || meta?.MMSI || pos?.UserID || stat?.UserID || ''
      ).trim();

      if (!MMSI_REGEX.test(mmsiCandidate)) return;

      const nowIso = meta?.time_utc
        ? Number.isNaN(Date.parse(meta.time_utc))
          ? new Date().toISOString()
          : new Date(Date.parse(meta.time_utc)).toISOString()
        : new Date().toISOString();

      this.lastMessageAt = nowIso;

      const existing = this.positions.get(mmsiCandidate) || {
        mmsi: mmsiCandidate,
        vesselName: '',
        imo: '',
        callSign: '',
        latitude: null,
        longitude: null,
        speedKnots: null,
        courseDeg: null,
        headingDeg: null,
        navStatus: null,
        destination: '',
        reportedEta: '',
        lastAisUpdateAt: nowIso,
        messageType: 'PositionReport' as const,
      };

      const next: LiveVesselTelemetry = {
        ...existing,
        lastAisUpdateAt: nowIso,
      };

      if (meta?.ShipName && meta.ShipName.trim()) {
        next.vesselName = meta.ShipName.trim();
      }

      if (parsed.MessageType === 'PositionReport' && pos) {
        const lat = typeof pos.Latitude === 'number' ? pos.Latitude : meta?.latitude ?? null;
        const lon = typeof pos.Longitude === 'number' ? pos.Longitude : meta?.longitude ?? null;
        if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          next.latitude = Number(lat.toFixed(5));
          next.longitude = Number(lon.toFixed(5));
        }
        if (typeof pos.Sog === 'number' && Number.isFinite(pos.Sog) && pos.Sog <= 102.2) {
          next.speedKnots = Number(pos.Sog.toFixed(1));
        }
        if (typeof pos.Cog === 'number' && Number.isFinite(pos.Cog) && pos.Cog < 360) {
          next.courseDeg = Number(pos.Cog.toFixed(1));
        }
        if (
          typeof pos.TrueHeading === 'number' &&
          Number.isFinite(pos.TrueHeading) &&
          pos.TrueHeading >= 0 &&
          pos.TrueHeading < 360
        ) {
          next.headingDeg = Math.round(pos.TrueHeading);
        }
        if (typeof pos.NavigationalStatus === 'number') {
          next.navStatus = pos.NavigationalStatus;
        }
        next.messageType = 'PositionReport';
      }

      if (parsed.MessageType === 'ShipStaticData' && stat) {
        if (stat.Name && stat.Name.trim()) next.vesselName = stat.Name.trim();
        if (typeof stat.ImoNumber === 'number' && stat.ImoNumber > 0) {
          next.imo = String(stat.ImoNumber);
        }
        if (stat.CallSign && stat.CallSign.trim()) next.callSign = stat.CallSign.trim();
        if (stat.Destination && stat.Destination.trim()) {
          next.destination = stat.Destination.trim();
        }
        const etaStr = formatAisEta(stat.Eta);
        if (etaStr) next.reportedEta = etaStr;
        next.messageType = 'ShipStaticData';
      }

      next.dataSource = 'aisstream';
      this.positions.set(mmsiCandidate, next);

      const waiters = this.mmsiWaiters.get(mmsiCandidate);
      if (waiters && waiters.length > 0) {
        this.mmsiWaiters.delete(mmsiCandidate);
        for (const fn of waiters) {
          try {
            fn(next);
          } catch {
            // ignore waiter error
          }
        }
      }
    } catch (err) {
      this.pushLog(
        'error',
        `Malformed AISStream message: ${err instanceof Error ? err.message : 'parse error'}`
      );
    }
  }

  public getStatus(): AisServiceStatus {
    const configured = Boolean(getApiKey());
    const effectiveMmsis = this.getEffectiveMmsis();
    let resolvedState: AisConnectionState = this.state;
    if (!configured) {
      resolvedState = 'unconfigured';
    } else if (!this.enabled) {
      resolvedState = 'disabled';
    } else if (effectiveMmsis.length === 0) {
      resolvedState = 'idle_no_vessels';
    }

    const posObj: Record<string, LiveVesselTelemetry> = {};
    for (const [mmsi, telemetry] of this.positions.entries()) {
      posObj[mmsi] = telemetry;
    }

    return {
      configured,
      enabled: this.enabled,
      connected: Boolean(this.socket && this.socket.readyState === WebSocket.OPEN),
      state: resolvedState,
      endpoint: AISSTREAM_WS_URL,
      subscribedMmsis: effectiveMmsis,
      lastConnectedAt: this.lastConnectedAt,
      lastMessageAt: this.lastMessageAt,
      lastSyncAt: this.lastSyncAt,
      reconnectAttempts: this.reconnectAttempts,
      trackedVesselCount: this.positions.size,
      positions: posObj,
      errorLogs: [...this.errorLogs],
    };
  }

  public getPositions(): Record<string, LiveVesselTelemetry> {
    const posObj: Record<string, LiveVesselTelemetry> = {};
    for (const [mmsi, telemetry] of this.positions.entries()) {
      posObj[mmsi] = telemetry;
    }
    return posObj;
  }

  public clearLogs() {
    this.errorLogs = [];
  }

  /**
   * Performs a live WebSocket handshake & subscription test against AISStream.
   * Never connects without a valid server-side API key and at least one real 9-digit MMSI.
   */
  public async testConnection(mmsisInput?: string[]): Promise<AisTestConnectionResult> {
    const started = Date.now();
    const testedAt = new Date().toISOString();
    const apiKey = getApiKey();

    if (!apiKey) {
      return {
        ok: false,
        configured: false,
        testedAt,
        latencyMs: Date.now() - started,
        handshakeOk: false,
        subscriptionSent: false,
        sampleReceived: false,
        testedMmsis: [],
        message:
          'AISSTREAM_API_KEY is not configured in the server environment. Add it to your backend Secrets / .env file and restart the server.',
        error: 'Missing AISSTREAM_API_KEY',
      };
    }

    const validMmsis = sanitizeMmsiList(
      mmsisInput && mmsisInput.length > 0 ? mmsisInput : this.getEffectiveMmsis()
    );

    if (validMmsis.length === 0) {
      return {
        ok: false,
        configured: true,
        testedAt,
        latencyMs: Date.now() - started,
        handshakeOk: false,
        subscriptionSent: false,
        sampleReceived: false,
        testedMmsis: [],
        message:
          'Register at least one vessel with a valid 9-digit MMSI first. AISStream subscriptions are intentionally blocked without vessel MMSI filters.',
        error: 'No registered MMSI filters available for subscription test',
      };
    }

    return new Promise<AisTestConnectionResult>((resolve) => {
      let settled = false;
      let handshakeOk = false;
      let subscriptionSent = false;
      let sampleReceived = false;

      const finish = (result: Omit<AisTestConnectionResult, 'testedAt' | 'latencyMs'>) => {
        if (settled) return;
        settled = true;
        clearTimeout(overallTimer);
        try {
          testSocket.removeAllListeners();
          if (
            testSocket.readyState === WebSocket.OPEN ||
            testSocket.readyState === WebSocket.CONNECTING
          ) {
            testSocket.close(1000, 'test_complete');
          }
        } catch {
          // Ignore close errors
        }
        resolve({
          ...result,
          testedAt,
          latencyMs: Date.now() - started,
        });
      };

      const testSocket = new WebSocket(AISSTREAM_WS_URL, {
        perMessageDeflate: true,
        handshakeTimeout: 8000,
      });

      const overallTimer = setTimeout(() => {
        finish({
          ok: handshakeOk && subscriptionSent,
          configured: true,
          handshakeOk,
          subscriptionSent,
          sampleReceived,
          testedMmsis: validMmsis,
          message:
            handshakeOk && subscriptionSent
              ? `Connected to AISStream and subscribed to ${validMmsis.length} MMSI(s). No AIS broadcast arrived during the 6s test window (vessels broadcast every 10–180s when in coastal AIS coverage).`
              : 'AISStream connection timed out before completing WebSocket handshake.',
          error: handshakeOk && subscriptionSent ? undefined : 'Handshake timeout',
        });
      }, 6000);

      testSocket.on('open', () => {
        handshakeOk = true;
        try {
          testSocket.send(
            JSON.stringify({
              APIKey: apiKey,
              BoundingBoxes: [[[-90, -180], [90, 180]]],
              FiltersShipMMSI: validMmsis,
              FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
            })
          );
          subscriptionSent = true;
        } catch (err) {
          finish({
            ok: false,
            configured: true,
            handshakeOk,
            subscriptionSent: false,
            sampleReceived: false,
            testedMmsis: validMmsis,
            message: 'WebSocket opened but sending the subscription payload failed.',
            error: err instanceof Error ? err.message : 'Subscription send error',
          });
        }
      });

      testSocket.on('message', (raw) => {
        try {
          const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
          const parsed = JSON.parse(text) as AisRawEnvelope;
          if (parsed.error) {
            finish({
              ok: false,
              configured: true,
              handshakeOk,
              subscriptionSent,
              sampleReceived: false,
              testedMmsis: validMmsis,
              message: `AISStream rejected the subscription: ${parsed.error}`,
              error: parsed.error,
            });
            return;
          }
          sampleReceived = true;
          this.handleMessage(raw);
          finish({
            ok: true,
            configured: true,
            handshakeOk,
            subscriptionSent,
            sampleReceived: true,
            testedMmsis: validMmsis,
            message: `Live AISStream ${parsed.MessageType || 'message'} received for MMSI ${parsed.MetaData?.MMSI || validMmsis[0]}.`,
          });
        } catch {
          // Wait for timeout
        }
      });

      testSocket.on('error', (err) => {
        finish({
          ok: false,
          configured: true,
          handshakeOk,
          subscriptionSent,
          sampleReceived: false,
          testedMmsis: validMmsis,
          message: `AISStream WebSocket error: ${err.message}`,
          error: err.message,
        });
      });

      testSocket.on('close', (code, reasonBuf) => {
        const reason = reasonBuf ? reasonBuf.toString('utf8') : '';
        if (!settled) {
          finish({
            ok: false,
            configured: true,
            handshakeOk,
            subscriptionSent,
            sampleReceived,
            testedMmsis: validMmsis,
            message: `AISStream closed the connection immediately (code ${code}${reason ? `: ${reason}` : ''}). Check your AISSTREAM_API_KEY validity.`,
            error: reason || `WebSocket closed with code ${code}`,
          });
        }
      });
    });
  }
}

export const aisStreamManager = new AisStreamManager();
