import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchLiveLotDetail,
  getAuctionMeta,
  getAuctionStatus,
  searchLiveAuctions,
} from './server/auctionProxy.ts';
import {
  getLiveExchangeRates,
  testExchangeRateConnection,
} from './server/exchangeRates.ts';
import { aisStreamManager } from './server/aisStreamService.ts';
import { lookupVesselByQuery } from './server/vesselLookupService.ts';
import { runAdminAiAssistant, type AdminAiTaskType } from './server/aiAssistant.ts';
import type { AuctionFeedTable, SteeringType } from './src/types/portal.ts';

function resolveAppDir(): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  return path.dirname(fileURLToPath(import.meta.url));
}

function resolveDistDir(): string {
  const baseDir = resolveAppDir();
  const candidates = [
    path.resolve(process.cwd(), 'dist'),
    path.resolve(baseDir, 'dist'),
    path.resolve(baseDir, '..', 'dist'),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || candidates[0];
}

const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

function isPrivateOrLoopbackIpv4(ip: string): boolean {
  return (
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('0.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

/**
 * Extracts a safe, validated client IP for the AJES API `ip` parameter.
 * Falls back to a valid RFC 5737 documentation IP when running behind local loopback.
 */
function extractClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const rawCandidate = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : req.socket.remoteAddress || '';
  const cleaned = rawCandidate.trim().replace(/^::ffff:/i, '');
  if (IPV4_REGEX.test(cleaned) && !isPrivateOrLoopbackIpv4(cleaned)) {
    return cleaned;
  }
  return '203.0.113.1';
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '256kb' }));

  // ---------------------------------------------------------------------------
  // Live Japanese Auction Feed Routes
  // Primary: Official AJES SQL/JSON API (when AJES_API_CODE is set in Secrets)
  // Fallback: Read-only live proxy to https://auc.auziotraders.com/
  // ---------------------------------------------------------------------------

  app.get('/api/auction/status', async (req, res) => {
    const clientIp = extractClientIp(req);
    const status = await getAuctionStatus(clientIp);
    res.setHeader('Cache-Control', 'no-store');
    res.status(status.ok ? 200 : 503).json(status);
  });

  app.get('/api/auction/meta', async (req, res) => {
    const clientIp = extractClientIp(req);
    const meta = await getAuctionMeta(clientIp);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(meta.ok ? 200 : 503).json(meta);
  });

  app.get('/api/auction/search', async (req, res) => {
    const q = req.query;
    const clientIp = extractClientIp(req);
    const strParam = (val: unknown, maxLen: number): string | undefined => {
      if (typeof val !== 'string') return undefined;
      const trimmed = val.trim();
      return trimmed ? trimmed.slice(0, maxLen) : undefined;
    };
    const numParam = (val: unknown): number | undefined => {
      if (typeof val !== 'string' || !val.trim()) return undefined;
      const n = Number(val);
      return Number.isFinite(n) ? n : undefined;
    };

    const rawTable = strParam(q.table, 10);
    const table: AuctionFeedTable = rawTable === 'stats' ? 'stats' : 'main';

    const rawSteering = strParam(q.steering, 6)?.toUpperCase();
    const steering: SteeringType | undefined =
      rawSteering === 'RHD' || rawSteering === 'LHD' ? rawSteering : undefined;

    const result = await searchLiveAuctions({
      table,
      make: strParam(q.make, 40),
      model: strParam(q.model, 60),
      auction: strParam(q.auction, 60),
      yearMin: numParam(q.yearMin),
      yearMax: numParam(q.yearMax),
      grade: strParam(q.grade, 8),
      steering,
      lot: strParam(q.lot, 24),
      chassis: strParam(q.chassis, 30),
      page: numParam(q.page),
      jpyRate: numParam(q.jpyRate),
      clientIp,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.status(result.ok ? 200 : 502).json(result);
  });

  app.get('/api/auction/lot/:id', async (req, res) => {
    const rawId = typeof req.params.id === 'string' ? req.params.id : '';
    const clientIp = extractClientIp(req);
    const rawTable = typeof req.query.table === 'string' ? req.query.table.trim() : '';
    const table: AuctionFeedTable = rawTable === 'stats' ? 'stats' : 'main';
    const rawJpy =
      typeof req.query.jpyRate === 'string' && req.query.jpyRate.trim()
        ? Number(req.query.jpyRate)
        : undefined;

    const detail = await fetchLiveLotDetail(rawId, {
      table,
      jpyRate: Number.isFinite(rawJpy) ? rawJpy : undefined,
      clientIp,
    });
    res.setHeader('Cache-Control', 'public, max-age=180');
    res.status(detail.ok ? 200 : 400).json(detail);
  });

  // ---------------------------------------------------------------------------
  // Live Global Exchange Rates (ExchangeRate-API USD + JPY, cached 24h)
  // ---------------------------------------------------------------------------
  app.get('/api/exchange-rates', async (req, res) => {
    const force = req.query.refresh === '1';
    const data = await getLiveExchangeRates(force);
    res.setHeader('Cache-Control', data.ok && !force ? 'public, max-age=900' : 'no-store');
    res.status(data.ok ? 200 : 503).json(data);
  });

  app.post('/api/exchange-rates/test', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 20) {
      res.status(401).json({
        ok: false,
        error: 'Authentication required to test ExchangeRate-API.',
      });
      return;
    }
    const result = await testExchangeRateConnection();
    res.setHeader('Cache-Control', 'no-store');
    res.status(result.ok ? 200 : 502).json(result);
  });

  // ---------------------------------------------------------------------------
  // AISStream Live Vessel Tracking Routes (Server-Side WebSocket Proxy)
  // ---------------------------------------------------------------------------
  app.get('/api/ais/status', (_req, res) => {
    const status = aisStreamManager.getStatus();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(status);
  });

  app.get('/api/ais/positions', (_req, res) => {
    const positions = aisStreamManager.getPositions();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ok: true,
      updatedAt: new Date().toISOString(),
      positions,
    });
  });

  app.post('/api/ais/sync-filters', (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 20) {
      res.status(401).json({
        ok: false,
        error: 'Authentication required to update AISStream vessel filters.',
      });
      return;
    }
    const body = (req.body || {}) as { enabled?: boolean; mmsis?: string[] };
    const status = aisStreamManager.syncFilters({
      enabled: body.enabled !== false,
      mmsis: Array.isArray(body.mmsis) ? body.mmsis : [],
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(status);
  });

  app.post('/api/ais/test', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 20) {
      res.status(401).json({
        ok: false,
        error: 'Authentication required to test AISStream connection.',
      });
      return;
    }
    const body = (req.body || {}) as { mmsis?: string[] };
    const result = await aisStreamManager.testConnection(
      Array.isArray(body.mmsis) ? body.mmsis : undefined
    );
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(result);
  });

  app.post('/api/ais/bootstrap-fleet', (req, res) => {
    const body = (req.body || {}) as { mmsis?: string[] };
    const status = aisStreamManager.bootstrapFleetMmsis(
      Array.isArray(body.mmsis) ? body.mmsis : []
    );
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(status);
  });

  app.post('/api/ais/track-mmsi', async (req, res) => {
    const body = (req.body || {}) as { mmsi?: string };
    const mmsi = String(body.mmsi || '').replace(/\D/g, '').trim();
    const streamResult = await aisStreamManager.trackOnDemandMmsi(mmsi, 2500);
    if (streamResult.position && streamResult.position.latitude !== null) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(streamResult);
      return;
    }

    // Fallback to live global AIS maritime resolver if AISStream has not emitted a packet yet
    if (/^\d{9}$/.test(mmsi)) {
      const lookup = await lookupVesselByQuery(mmsi);
      if (lookup.ok && lookup.vessel) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({
          ...streamResult,
          ok: true,
          position: lookup.vessel,
          message: lookup.message,
        });
        return;
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(streamResult.ok ? 200 : 400).json(streamResult);
  });

  app.post('/api/ais/lookup-vessel', async (req, res) => {
    const body = (req.body || {}) as { query?: string; bypassCache?: boolean };
    const query = typeof body.query === 'string' ? body.query.trim().slice(0, 80) : '';
    const result = await lookupVesselByQuery(query, {
      bypassCache: Boolean(body.bypassCache),
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(result.ok ? 200 : result.query.length < 2 ? 400 : 404).json(result);
  });

  app.post('/api/ais/clear-logs', (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 20) {
      res.status(401).json({ ok: false, error: 'Authentication required.' });
      return;
    }
    aisStreamManager.clearLogs();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Server-Side Gemini AI Assistant for Admin Console (Staff Authenticated)
  // ---------------------------------------------------------------------------
  app.post('/api/admin/ai-assist', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 20) {
      res.status(401).json({
        ok: false,
        generatedAt: new Date().toISOString(),
        error: 'Authentication required to use the Admin AI Assistant.',
      });
      return;
    }

    const body = (req.body || {}) as {
      task?: AdminAiTaskType;
      prompt?: string;
      contextSummary?: string;
    };

    const allowedTasks: AdminAiTaskType[] = [
      'daily_report',
      'sales_followup',
      'document_extract',
      'business_chat',
    ];
    const task: AdminAiTaskType =
      typeof body.task === 'string' && allowedTasks.includes(body.task as AdminAiTaskType)
        ? (body.task as AdminAiTaskType)
        : 'business_chat';

    const result = await runAdminAiAssistant({
      task,
      prompt: typeof body.prompt === 'string' ? body.prompt : '',
      contextSummary: typeof body.contextSummary === 'string' ? body.contextSummary : '',
    });

    res.setHeader('Cache-Control', 'no-store');
    res.status(result.ok ? 200 : 400).json(result);
  });

  const httpServer = http.createServer(app);

  // ---------------------------------------------------------------------------
  // Frontend Asset Serving (Vite Dev Middleware in dev, static dist in prod)
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = resolveDistDir();
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Production build not found. Run npm run build first.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`AUZIO TRADERS Export Portal running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AUZIO TRADERS server:', err);
  process.exit(1);
});
