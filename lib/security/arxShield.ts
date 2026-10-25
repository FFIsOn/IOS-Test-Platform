/**
 * Zero-Allocation ARX Hashing, Reversible Toffoli Gate Array & Bit-Level Blacklist Engine
 *
 * Designed for bare-metal execution inside Bun (`proxy.ts`) and Next.js 16 edge/node paths:
 * - Zero heap allocations (`{}`, `[]`, `RegExp`, `new URL`) inside the request evaluation loop.
 * - 65,536-bit L1-cache-resident `Uint32Array` IP Bloom/Blacklist backed by `SharedArrayBuffer`.
 * - 4-round ChaCha/SipHash-inspired 32-bit Add-Rotate-XOR (ARX) block mixer.
 * - Cascade of reversible 3-bit Toffoli (`CCNOT`) logic gates to compute bot threat syndromes.
 */

const BLACKLIST_WORD_COUNT = 2048; // 2048 * 32-bit words = 65,536 bit slots (8,192 bytes)
const TELEMETRY_WORD_COUNT = 8; // 32 bytes for atomic counters
const ARENA_BYTE_LENGTH = (BLACKLIST_WORD_COUNT + TELEMETRY_WORD_COUNT) * 4;

export enum ArxVerdict {
  ALLOW = 0,
  BLOCK_BLACKLISTED_IP = 1,
  BLOCK_PHP_SCANNER = 2,
  BLOCK_TOFFOLI_PROBE = 3,
}

export enum ArxTelemetrySlot {
  TOTAL_REQUESTS = 0,
  BLOCKED_PHP_SCANS = 1,
  BLACKLIST_DROPS = 2,
  TOFFOLI_TRIPS = 3,
}

interface ArxMemoryArena {
  bitset: Uint32Array;
  telemetry: Int32Array;
  atomic: boolean;
}

let singletonArena: ArxMemoryArena | null = null;

function getArxArena(): ArxMemoryArena {
  if (singletonArena !== null) return singletonArena;

  let backing: ArrayBufferLike;
  let atomic = false;

  if (typeof SharedArrayBuffer !== 'undefined') {
    backing = new SharedArrayBuffer(ARENA_BYTE_LENGTH);
    atomic = typeof Atomics !== 'undefined';
  } else {
    backing = new ArrayBuffer(ARENA_BYTE_LENGTH);
  }

  const bitset = new Uint32Array(backing, 0, BLACKLIST_WORD_COUNT);
  const telemetry = new Int32Array(
    backing,
    BLACKLIST_WORD_COUNT * 4,
    TELEMETRY_WORD_COUNT,
  );

  singletonArena = { bitset, telemetry, atomic };
  return singletonArena;
}

/** 32-bit unsigned left rotate (`ROTL32`) */
function rotl32(x: number, r: number): number {
  return ((x << r) | (x >>> (32 - r))) >>> 0;
}

/**
 * Pure 32-bit Add-Rotate-XOR (ARX) Quarter-Round Block Mixer.
 * Hashes an IP string or fingerprint into a 32-bit unsigned word (two 16-bit bitset indices)
 * with zero intermediate buffer or string allocations.
 */
export function arxHashBlock32(
  input: string,
  seed0 = 0x61707865,
  seed1 = 0x3320646e,
): number {
  let v0 = seed0 >>> 0;
  let v1 = seed1 >>> 0;
  let v2 = (0x79622d32 ^ input.length) >>> 0;
  let v3 = 0x6b206574 >>> 0;

  const len = input.length;
  let i = 0;

  while (i < len) {
    const c0 = input.charCodeAt(i) & 0xff;
    const c1 = i + 1 < len ? input.charCodeAt(i + 1) & 0xff : 0x80;
    const c2 = i + 2 < len ? input.charCodeAt(i + 2) & 0xff : 0;
    const c3 = i + 3 < len ? input.charCodeAt(i + 3) & 0xff : 0;
    const lane = ((c0 | (c1 << 8) | (c2 << 16) | (c3 << 24)) >>> 0);

    v3 = (v3 ^ lane) >>> 0;

    // ARX Round 1
    v0 = (v0 + v1) >>> 0;
    v3 = rotl32(v3 ^ v0, 16);
    v2 = (v2 + v3) >>> 0;
    v1 = rotl32(v1 ^ v2, 12);
    v0 = (v0 + v1) >>> 0;
    v3 = rotl32(v3 ^ v0, 8);
    v2 = (v2 + v3) >>> 0;
    v1 = rotl32(v1 ^ v2, 7);

    v0 = (v0 ^ lane) >>> 0;
    i += 4;
  }

  // Finalization ARX avalanche round
  v2 = (v2 ^ 0xff) >>> 0;
  v0 = (v0 + v1) >>> 0;
  v3 = rotl32(v3 ^ v0, 16);
  v2 = (v2 + v3) >>> 0;
  v1 = rotl32(v1 ^ v2, 12);
  v0 = (v0 + v1) >>> 0;
  v3 = rotl32(v3 ^ v0, 8);
  v2 = (v2 + v3) >>> 0;
  v1 = rotl32(v1 ^ v2, 7);

  return (v0 ^ v1 ^ v2 ^ v3) >>> 0;
}

/**
 * Reversible 3-Bit Toffoli (`CCNOT`) Logic Gate.
 * Flips `target` wire if and only if both control wires `c1` and `c2` are `1`.
 */
export function toffoliGate(c1: number, c2: number, target: number): number {
  return (target ^ (c1 & c2)) & 1;
}

/**
 * Evaluates a cascade of reversible Toffoli gates over 4 single-bit input wires:
 * - `wPhp`: `.php` / `.phtml` / `.phar` script extension detected
 * - `wScanner`: vulnerability bot probe path (`wp-login`, `xmlrpc`, `.env`, `phpmyadmin`)
 * - `wTraversal`: directory traversal (`../` or `%2e%2e`)
 * - `wBotAgent`: automated exploit scanner User-Agent signature (`sqlmap`, `nikto`, `nuclei`, `zgrab`)
 *
 * Returns `1` if the reversible circuit trips an immediate block syndrome, `0` otherwise.
 */
export function evaluateToffoliArray(
  wPhp: number,
  wScanner: number,
  wTraversal: number,
  wBotAgent: number,
): number {
  let ancilla = 0;
  // Gate 1: Any .php probe immediately trips ancilla via CCNOT(wPhp, 1, ancilla)
  ancilla = toffoliGate(wPhp & 1, 1, ancilla);
  // Gate 2: Scanner path probe if ancilla is still 0 -> CCNOT(wScanner, ancilla ^ 1, ancilla)
  ancilla = toffoliGate(wScanner & 1, (ancilla ^ 1) & 1, ancilla);
  // Gate 3: Directory traversal if ancilla is still 0
  ancilla = toffoliGate(wTraversal & 1, (ancilla ^ 1) & 1, ancilla);
  // Gate 4: Exploit scanner user-agent if ancilla is still 0
  ancilla = toffoliGate(wBotAgent & 1, (ancilla ^ 1) & 1, ancilla);
  return ancilla & 1;
}

/** Bit-level double-hash lookup in 65,536-bit `Uint32Array` blacklist */
export function isIpHashBlacklisted(hash32: number): boolean {
  const { bitset } = getArxArena();
  const bitA = hash32 & 0xffff;
  const bitB = (hash32 >>> 16) & 0xffff;

  const wordA = bitset[bitA >>> 5];
  const maskA = (1 << (bitA & 31)) >>> 0;
  if ((wordA & maskA) === 0) return false;

  const wordB = bitset[bitB >>> 5];
  const maskB = (1 << (bitB & 31)) >>> 0;
  return (wordB & maskB) !== 0;
}

/** Bit-level atomic insertion into `Uint32Array` blacklist */
export function blacklistIpHash(hash32: number): void {
  const { bitset, atomic } = getArxArena();
  const bitA = hash32 & 0xffff;
  const bitB = (hash32 >>> 16) & 0xffff;
  const idxA = bitA >>> 5;
  const maskA = (1 << (bitA & 31)) >>> 0;
  const idxB = bitB >>> 5;
  const maskB = (1 << (bitB & 31)) >>> 0;

  if (atomic) {
    Atomics.or(bitset, idxA, maskA);
    Atomics.or(bitset, idxB, maskB);
  } else {
    bitset[idxA] = (bitset[idxA] | maskA) >>> 0;
    bitset[idxB] = (bitset[idxB] | maskB) >>> 0;
  }
}

function incrementCounter(slot: ArxTelemetrySlot): void {
  const { telemetry, atomic } = getArxArena();
  if (atomic) {
    Atomics.add(telemetry, slot, 1);
  } else {
    telemetry[slot] = (telemetry[slot] + 1) | 0;
  }
}

/** Case-insensitive ASCII substring match without allocating `.toLowerCase()` strings */
function containsAsciiToken(haystack: string, lowercaseNeedle: string): boolean {
  const nLen = lowercaseNeedle.length;
  const hLen = haystack.length;
  if (nLen === 0 || hLen < nLen) return false;

  const first = lowercaseNeedle.charCodeAt(0);
  const limit = hLen - nLen;

  for (let i = 0; i <= limit; i++) {
    const ch = haystack.charCodeAt(i);
    const lower = ch >= 65 && ch <= 90 ? ch | 32 : ch;
    if (lower !== first) continue;

    let matched = true;
    for (let j = 1; j < nLen; j++) {
      const c2 = haystack.charCodeAt(i + j);
      const l2 = c2 >= 65 && c2 <= 90 ? c2 | 32 : c2;
      if (l2 !== lowercaseNeedle.charCodeAt(j)) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

/**
 * Zero-allocation character-level `.php` extension detector on URL pathname.
 * Catches `.php`, `.php/`, `.php5`, `.php7`, `.php8`, `.phtml`, `.phar` anywhere in the path.
 */
export function hasPhpPathSignature(pathname: string): number {
  const len = pathname.length;
  for (let i = 0; i <= len - 4; i++) {
    if (pathname.charCodeAt(i) !== 46) continue; // '.'
    const c1 = pathname.charCodeAt(i + 1) | 32;
    const c2 = pathname.charCodeAt(i + 2) | 32;
    if (c1 !== 112 || c2 !== 104) continue; // 'ph'

    const c3 = pathname.charCodeAt(i + 3) | 32;
    // '.php' followed by end, '/', '.', or digit ('5','7','8')
    if (c3 === 112) {
      if (i + 4 === len) return 1;
      const next = pathname.charCodeAt(i + 4);
      if (
        next === 47 || // '/'
        next === 46 || // '.'
        next === 59 || // ';'
        (next >= 51 && next <= 57) // '3'..'9' (.php5, .php7, .php8)
      ) {
        return 1;
      }
    }
    // '.phtml' or '.phar'
    if (c3 === 116 && i + 5 < len && (pathname.charCodeAt(i + 4) | 32) === 109) {
      return 1;
    }
    if (c3 === 97 && i + 4 < len && (pathname.charCodeAt(i + 4) | 32) === 114) {
      return 1;
    }
  }
  return 0;
}

function isLoopbackIp(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost' ||
    ip === ''
  );
}

/**
 * Zero-allocation hot-path request evaluator invoked by `proxy.ts`.
 * Returns a stack-allocated SMI `ArxVerdict` (`0` = ALLOW, non-zero = DROP).
 */
export function evaluateGatewayRequest(
  pathname: string,
  clientIp: string,
  userAgent: string,
  blacklistLoopback = false,
): ArxVerdict {
  incrementCounter(ArxTelemetrySlot.TOTAL_REQUESTS);

  const ipHash = arxHashBlock32(clientIp);
  const canPersistBlacklist = blacklistLoopback || !isLoopbackIp(clientIp);

  // 1. O(1) L1-cache bitset check: drop already-blacklisted bot IPs immediately
  if (canPersistBlacklist && isIpHashBlacklisted(ipHash)) {
    incrementCounter(ArxTelemetrySlot.BLACKLIST_DROPS);
    return ArxVerdict.BLOCK_BLACKLISTED_IP;
  }

  // 2. Compute packed single-bit hardware wires without regex or heap allocations
  const wPhp = hasPhpPathSignature(pathname);
  const wScanner =
    containsAsciiToken(pathname, '/wp-admin') ||
    containsAsciiToken(pathname, '/wp-login') ||
    containsAsciiToken(pathname, '/xmlrpc') ||
    containsAsciiToken(pathname, '/phpmyadmin') ||
    containsAsciiToken(pathname, '/.env') ||
    containsAsciiToken(pathname, '/.git/config') ||
    containsAsciiToken(pathname, '/vendor/phpunit')
      ? 1
      : 0;
  const wTraversal =
    containsAsciiToken(pathname, '../') || containsAsciiToken(pathname, '%2e%2e')
      ? 1
      : 0;
  const wBotAgent =
    userAgent.length > 0 &&
    (containsAsciiToken(userAgent, 'sqlmap') ||
      containsAsciiToken(userAgent, 'nikto') ||
      containsAsciiToken(userAgent, 'nuclei') ||
      containsAsciiToken(userAgent, 'masscan'))
      ? 1
      : 0;

  // 3. Evaluate reversible Toffoli gate cascade
  const syndrome = evaluateToffoliArray(wPhp, wScanner, wTraversal, wBotAgent);
  if (syndrome === 0) {
    return ArxVerdict.ALLOW;
  }

  // 4. Permanently blacklist offending scanner IP in the 65,536-bit arena
  if (canPersistBlacklist) {
    blacklistIpHash(ipHash);
  }

  if (wPhp === 1) {
    incrementCounter(ArxTelemetrySlot.BLOCKED_PHP_SCANS);
    return ArxVerdict.BLOCK_PHP_SCANNER;
  }

  incrementCounter(ArxTelemetrySlot.TOFFOLI_TRIPS);
  return ArxVerdict.BLOCK_TOFFOLI_PROBE;
}

/** Zero-allocation fast pathname slicer from raw `req.url` (`http://host:3000/foo.php?x=1` -> `/foo.php`) */
export function extractPathnameZeroAlloc(rawUrl: string): string {
  const len = rawUrl.length;
  let pathStart = 0;

  // Skip `http://` or `https://` + host
  if (len > 8 && rawUrl.charCodeAt(4) === 58) {
    // 'http:'
    pathStart = rawUrl.indexOf('/', 7);
  } else if (len > 9 && rawUrl.charCodeAt(5) === 58) {
    // 'https:'
    pathStart = rawUrl.indexOf('/', 8);
  }

  if (pathStart === -1) return '/';

  const queryIdx = rawUrl.indexOf('?', pathStart);
  if (queryIdx === -1) {
    return pathStart === 0 ? rawUrl : rawUrl.slice(pathStart);
  }
  return rawUrl.slice(pathStart, queryIdx);
}

export function readArxTelemetrySnapshot(): {
  totalRequests: number;
  blockedPhpScans: number;
  blacklistDrops: number;
  toffoliTrips: number;
} {
  const { telemetry } = getArxArena();
  return {
    totalRequests: telemetry[ArxTelemetrySlot.TOTAL_REQUESTS],
    blockedPhpScans: telemetry[ArxTelemetrySlot.BLOCKED_PHP_SCANS],
    blacklistDrops: telemetry[ArxTelemetrySlot.BLACKLIST_DROPS],
    toffoliTrips: telemetry[ArxTelemetrySlot.TOFFOLI_TRIPS],
  };
}

export function resetArxBlacklistForTests(): void {
  const { bitset, telemetry } = getArxArena();
  bitset.fill(0);
  telemetry.fill(0);
}
