import { NextResponse, type NextRequest } from 'next/server';
import {
  ArxVerdict,
  evaluateGatewayRequest,
  extractPathnameZeroAlloc,
  readArxTelemetrySnapshot,
} from './lib/security/arxShield';

const BLOCKED_HEADERS: Record<string, string> = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-ARX-Shield': 'BLOCKED',
};

/**
 * 1. Next.js 16 Native Request Proxy (`proxy.ts` convention — replaces legacy `middleware.ts`)
 * Runs during `bun --bun next dev` to enforce identical bit-level `.php` & Toffoli filtering in dev.
 */
export function proxy(request: NextRequest): NextResponse {
  const forwarded = request.headers.get('x-forwarded-for');
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;

  const verdict = evaluateGatewayRequest(pathname, clientIp, userAgent, false);
  if (verdict !== ArxVerdict.ALLOW) {
    return new NextResponse('403 Forbidden — Blocked by ARX-Toffoli Bitwise Gateway', {
      status: 403,
      headers: BLOCKED_HEADERS,
    });
  }

  const res = NextResponse.next();
  res.headers.set('X-ARX-Shield', 'PASS');
  return res;
}

/**
 * 2. Production Native Bun ARX-Filtering Outer Gateway (`pnpm start` -> `bun run proxy.ts`)
 * Boots Next.js 16's `.next/standalone/server.js` on an internal loopback socket and evaluates
 * ARX hashing blocks, Toffoli gate arrays, and 65,536-bit IP blacklists at C++/Zig native speed
 * before any `.php` bot or exploit scanner ever touches Next.js.
 */
async function startBunProductionGateway(): Promise<void> {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const publicPort = Number(process.env.PORT || 3000);
  const internalPort = publicPort === 3001 ? 3002 : 3001;
  const rootDir = process.cwd();
  const standaloneDir = path.join(rootDir, '.next', 'standalone');
  const standaloneServerPath = path.join(standaloneDir, 'server.js');

  if (!fs.existsSync(standaloneServerPath)) {
    console.error(
      '[ARX Gateway] Missing .next/standalone/server.js — run `pnpm run build` before `pnpm start`.',
    );
    process.exit(1);
  }

  // Ensure standalone bundle has symlinks/copies to `.next/static` and `public`
  const srcStatic = path.join(rootDir, '.next', 'static');
  const dstStatic = path.join(standaloneDir, '.next', 'static');
  if (fs.existsSync(srcStatic) && !fs.existsSync(dstStatic)) {
    fs.mkdirSync(path.dirname(dstStatic), { recursive: true });
    fs.cpSync(srcStatic, dstStatic, { recursive: true });
  }

  const srcPublic = path.join(rootDir, 'public');
  const dstPublic = path.join(standaloneDir, 'public');
  if (fs.existsSync(srcPublic) && !fs.existsSync(dstPublic)) {
    fs.cpSync(srcPublic, dstPublic, { recursive: true });
  }

  // Spawn Next.js 16 standalone worker bound strictly to internal loopback
  const bunGlobal = (globalThis as unknown as {
    Bun: {
      spawn: (
        cmd: string[],
        opts: Record<string, unknown>,
      ) => { kill: () => void };
      serve: (opts: {
        port: number;
        hostname: string;
        fetch: (
          req: Request,
          server: { requestIP: (r: Request) => { address: string } | null },
        ) => Response | Promise<Response>;
      }) => { port: number };
    };
  }).Bun;

  const upstreamProc = bunGlobal.spawn(['bun', standaloneServerPath], {
    cwd: standaloneDir,
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOSTNAME: '127.0.0.1',
      PORT: String(internalPort),
    },
  });

  const cleanup = () => {
    try {
      upstreamProc.kill();
    } catch {}
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const upstreamOrigin = `http://127.0.0.1:${internalPort}`;

  const server = bunGlobal.serve({
    port: publicPort,
    hostname: '0.0.0.0',
    async fetch(req, srv) {
      const pathname = extractPathnameZeroAlloc(req.url);
      const xff = req.headers.get('x-forwarded-for');
      const clientIp = xff
        ? xff.split(',')[0].trim()
        : srv.requestIP(req)?.address || '127.0.0.1';
      const userAgent = req.headers.get('user-agent') || '';
      const forceBlacklist = req.headers.get('x-enforce-blacklist') === '1';

      // Step 1: Bare-metal ARX + Toffoli + Bitset evaluation (0 PHP execution)
      const verdict = evaluateGatewayRequest(
        pathname,
        clientIp,
        userAgent,
        forceBlacklist,
      );

      if (verdict !== ArxVerdict.ALLOW) {
        return new Response('403 Forbidden — Blocked by ARX-Toffoli Bitwise Gateway\n', {
          status: 403,
          headers: BLOCKED_HEADERS,
        });
      }

      // Lightweight gateway telemetry probe
      if (pathname === '/__arx_telemetry') {
        return Response.json(readArxTelemetrySnapshot(), {
          headers: { 'Cache-Control': 'no-store', 'X-ARX-Shield': 'PASS' },
        });
      }

      // Step 2: Forward clean traffic to internal standalone Next.js 16 server
      const qIdx = req.url.indexOf('?');
      const search = qIdx === -1 ? '' : req.url.slice(qIdx);
      const targetUrl = `${upstreamOrigin}${pathname}${search}`;

      const upstreamRes = await fetch(targetUrl, {
        method: req.method,
        headers: req.headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
        redirect: 'manual',
      });

      const outHeaders = new Headers(upstreamRes.headers);
      outHeaders.set('X-ARX-Shield', 'PASS');

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: outHeaders,
      });
    },
  });

  console.log(
    `[ARX Gateway] Bun outer bit-filter active on http://0.0.0.0:${server.port} -> Next.js standalone (${upstreamOrigin})`,
  );
}

// Execute standalone gateway ONLY when invoked directly via `bun run proxy.ts` (`pnpm start`)
const maybeBun = (globalThis as unknown as { Bun?: { main?: string } }).Bun;
const metaPath = (import.meta as unknown as { path?: string }).path;
if (maybeBun && metaPath && maybeBun.main === metaPath) {
  startBunProductionGateway().catch((err) => {
    console.error('[ARX Gateway] Fatal startup error:', err);
    process.exit(1);
  });
}
