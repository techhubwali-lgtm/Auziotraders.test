import { validateSafeExternalUrl } from './sourceRegistry';

const BOT_USER_AGENT = 'AuzioTradersInventoryBot/1.0 (+https://auziotraders.com)';

interface RobotsPolicy {
  fetchedAt: number;
  status: number;
  disallows: string[];
  allows: string[];
  crawlDelayMs: number | null;
}

const robotsCache = new Map<string, RobotsPolicy>();
const lastDomainRequestAt = new Map<string, number>();
const ROBOTS_TTL_MS = 10 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitDomainRateLimit(hostname: string, minDelayMs = 1500): Promise<void> {
  const safeDelay = Math.max(1000, Math.min(10000, minDelayMs));
  const last = lastDomainRequestAt.get(hostname) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < safeDelay) {
    await sleep(safeDelay - elapsed);
  }
  lastDomainRequestAt.set(hostname, Date.now());
}

export async function fetchRobotsPolicy(origin: string): Promise<RobotsPolicy> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) {
    return cached;
  }

  const robotsUrl = `${origin}/robots.txt`;
  const check = validateSafeExternalUrl(robotsUrl, false);
  if (!check.ok) {
    return {
      fetchedAt: Date.now(),
      status: 0,
      disallows: ['/'],
      allows: [],
      crawlDelayMs: null,
    };
  }

  try {
    const res = await fetch(robotsUrl, {
      headers: {
        'User-Agent': BOT_USER_AGENT,
        Accept: 'text/plain,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(7000),
    });

    const disallows: string[] = [];
    const allows: string[] = [];
    let crawlDelayMs: number | null = null;

    if (res.ok) {
      const text = await res.text();
      const lines = text.split(/\r?\n/);
      let inWildcardGroup = false;
      for (const rawLine of lines) {
        const line = rawLine.replace(/#.*$/, '').trim();
        if (!line) continue;
        if (/^user-agent:/i.test(line)) {
          const agent = line.replace(/^user-agent:\s*/i, '').trim();
          inWildcardGroup = agent === '*' || /auziotraders/i.test(agent);
        } else if (inWildcardGroup && /^disallow:/i.test(line)) {
          const pathRule = line.replace(/^disallow:\s*/i, '').trim();
          if (pathRule) disallows.push(pathRule);
        } else if (inWildcardGroup && /^allow:/i.test(line)) {
          const pathRule = line.replace(/^allow:\s*/i, '').trim();
          if (pathRule) allows.push(pathRule);
        } else if (inWildcardGroup && /^crawl-delay:/i.test(line)) {
          const sec = parseFloat(line.replace(/^crawl-delay:\s*/i, '').trim());
          if (Number.isFinite(sec) && sec > 0 && sec <= 30) {
            crawlDelayMs = Math.round(sec * 1000);
          }
        }
      }
    }

    const policy: RobotsPolicy = {
      fetchedAt: Date.now(),
      status: res.status,
      disallows,
      allows,
      crawlDelayMs,
    };
    robotsCache.set(origin, policy);
    return policy;
  } catch {
    return {
      fetchedAt: Date.now(),
      status: -1,
      disallows: [],
      allows: [],
      crawlDelayMs: null,
    };
  }
}

function matchesRobotsRule(pathnameAndQuery: string, rule: string): boolean {
  if (!rule) return false;
  if (rule === '/') return true;
  const escaped = rule
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const anchored = escaped.endsWith('$') ? `^${escaped}` : `^${escaped}`;
  try {
    return new RegExp(anchored).test(pathnameAndQuery);
  } catch {
    return pathnameAndQuery.startsWith(rule);
  }
}

export async function checkRobotsAllowance(targetUrl: string): Promise<{
  allowed: boolean;
  robotsStatus: number;
  crawlDelayMs: number | null;
  matchedRule: string | null;
  summary: string;
}> {
  const parsed = new URL(targetUrl);
  const policy = await fetchRobotsPolicy(parsed.origin);

  if (policy.status === 403 || policy.status === 401) {
    return {
      allowed: false,
      robotsStatus: policy.status,
      crawlDelayMs: null,
      matchedRule: 'HTTP 403/401',
      summary: `robots.txt returned HTTP ${policy.status}; automated access prohibited.`,
    };
  }

  const pathAndQuery = `${parsed.pathname}${parsed.search}`;
  let longestDisallow = '';
  for (const rule of policy.disallows) {
    if (matchesRobotsRule(pathAndQuery, rule) && rule.length > longestDisallow.length) {
      longestDisallow = rule;
    }
  }

  let longestAllow = '';
  for (const rule of policy.allows) {
    if (matchesRobotsRule(pathAndQuery, rule) && rule.length > longestAllow.length) {
      longestAllow = rule;
    }
  }

  const disallowed = longestDisallow.length > 0 && longestDisallow.length > longestAllow.length;
  return {
    allowed: !disallowed,
    robotsStatus: policy.status,
    crawlDelayMs: policy.crawlDelayMs,
    matchedRule: disallowed ? longestDisallow : null,
    summary: disallowed
      ? `Disallowed by robots.txt rule: ${longestDisallow}`
      : policy.status === 200
        ? `Allowed by robots.txt (${policy.disallows.length} unrelated disallow rules)`
        : policy.status === 404
          ? 'No robots.txt (HTTP 404) — verify Terms of Service before enabling'
          : `robots.txt status ${policy.status}`,
  };
}

export function detectAntiBotPage(status: number, html: string): {
  blocked: boolean;
  reason: string | null;
} {
  if (status === 401 || status === 403 || status === 429) {
    return { blocked: true, reason: `HTTP ${status} access restriction` };
  }
  const head = html.slice(0, 6000);
  const titleMatch = head.match(/<title[^>]*>([^<]{0,120})<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  if (/access denied|403 forbidden|just a moment|attention required|bot verification|アクセスエラー/i.test(title)) {
    return { blocked: true, reason: `Access restriction interstitial detected ("${title}")` };
  }
  if (/cf-browser-verification|challenge-platform|perimeterx|incapsula_resource|akamai-bot/i.test(head)) {
    return { blocked: true, reason: 'WAF / Bot challenge gate detected' };
  }
  return { blocked: false, reason: null };
}

export async function politeFetchHtml(params: {
  url: string;
  rateLimitMs?: number;
  maxRetries?: number;
  requireAllowlist?: boolean;
}): Promise<{
  ok: boolean;
  status: number;
  finalUrl: string;
  html: string;
  antiBotBlocked: boolean;
  error: string | null;
}> {
  const validation = validateSafeExternalUrl(params.url, params.requireAllowlist ?? true);
  if (!validation.ok) {
    return {
      ok: false,
      status: 0,
      finalUrl: params.url,
      html: '',
      antiBotBlocked: false,
      error: validation.reason,
    };
  }

  const maxRetries = Math.min(2, Math.max(0, params.maxRetries ?? 1));
  let attempt = 0;

  while (attempt <= maxRetries) {
    attempt += 1;
    await waitDomainRateLimit(validation.url.hostname, params.rateLimitMs ?? 1500);
    try {
      const res = await fetch(validation.url.toString(), {
        headers: {
          'User-Agent': BOT_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.8,en;q=0.7',
        },
        signal: AbortSignal.timeout(12000),
      });

      const html = await res.text();
      const botCheck = detectAntiBotPage(res.status, html);
      if (botCheck.blocked) {
        return {
          ok: false,
          status: res.status,
          finalUrl: res.url,
          html: '',
          antiBotBlocked: true,
          error: botCheck.reason || `Blocked (HTTP ${res.status})`,
        };
      }

      if (res.ok) {
        return {
          ok: true,
          status: res.status,
          finalUrl: res.url,
          html,
          antiBotBlocked: false,
          error: null,
        };
      }

      if (res.status >= 500 && attempt <= maxRetries) {
        await sleep(1000 * attempt);
        continue;
      }

      return {
        ok: false,
        status: res.status,
        finalUrl: res.url,
        html: '',
        antiBotBlocked: false,
        error: `HTTP ${res.status}`,
      };
    } catch (err) {
      if (attempt <= maxRetries) {
        await sleep(1000 * attempt);
        continue;
      }
      return {
        ok: false,
        status: 0,
        finalUrl: params.url,
        html: '',
        antiBotBlocked: false,
        error: err instanceof Error ? err.message : 'Network error',
      };
    }
  }

  return {
    ok: false,
    status: 0,
    finalUrl: params.url,
    html: '',
    antiBotBlocked: false,
    error: 'Exhausted retries',
  };
}
