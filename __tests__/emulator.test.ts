import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, uniqBy } from 'lodash';
import {
  getHardwareMemoryBus,
  readIntSlot,
  SABFloatOffset,
  SABIntOffset,
  writeIntSlot,
} from '../lib/core/hardwareMemory';
import {
  ACCESSIBILITY_SHORTCUT_DEFS,
  DEFAULT_IOS_SETTINGS,
  IPHONE_MODELS,
  NETWORK_PROFILES,
} from '../lib/core/iosState';
import {
  arxHashBlock32,
  ArxVerdict,
  evaluateGatewayRequest,
  evaluateToffoliArray,
  extractPathnameZeroAlloc,
  resetArxBlacklistForTests,
  toffoliGate,
} from '../lib/security/arxShield';

describe('CorePhone Pro Hardware Memory & Multi-Model Specs', () => {
  it('allocates a 256-byte aligned hardware telemetry buffer and reads/writes int slots', () => {
    const bus = getHardwareMemoryBus();
    assert.equal(bus.buffer.byteLength, 256);
    assert.equal(bus.f32.length, 64);
    assert.equal(bus.i32.length, 64);

    writeIntSlot(bus.i32, SABIntOffset.FRAME_SKIP_MODULO, 2, bus.isAtomicCapable);
    assert.equal(readIntSlot(bus.i32, SABIntOffset.FRAME_SKIP_MODULO, bus.isAtomicCapable), 2);

    bus.f32[SABFloatOffset.MEASURED_FPS] = clamp(120, 15, 120);
    assert.equal(bus.f32[SABFloatOffset.MEASURED_FPS], 120);
  });

  it('defines accurate logical viewports and cutouts across iPhone models', () => {
    assert.equal(IPHONE_MODELS['iphone-16-pro'].logicalWidth, 393);
    assert.equal(IPHONE_MODELS['iphone-16-pro'].logicalHeight, 852);
    assert.equal(IPHONE_MODELS['iphone-14-pro-max'].logicalWidth, 430);
    assert.equal(IPHONE_MODELS['iphone-14-pro-max'].logicalHeight, 932);
    assert.equal(IPHONE_MODELS['iphone-13'].cutout, 'notch');
    assert.equal(IPHONE_MODELS['iphone-se'].hasHomeButton, true);
  });

  it('configures network throttling profiles and deduplicates web clips via lodash', () => {
    assert.equal(DEFAULT_IOS_SETTINGS.networkProfile, 'wifi');
    assert.ok(NETWORK_PROFILES['3g'].rttMs > NETWORK_PROFILES.wifi.rttMs);

    const clips = uniqBy(
      [
        { id: '1', title: 'Wiki', url: 'https://wikipedia.org', accentColor: '#2563EB' },
        { id: '2', title: 'Wiki Duplicate', url: 'https://wikipedia.org', accentColor: '#2563EB' },
      ],
      'url',
    );
    assert.equal(clips.length, 1);
  });

  it('exposes 12 Accessibility Shortcut targets and 1:1 iOS 18 system defaults', () => {
    assert.equal(ACCESSIBILITY_SHORTCUT_DEFS.length, 12);
    assert.ok(DEFAULT_IOS_SETTINGS.accessibilityShortcutTargets.length >= 3);
    assert.equal(DEFAULT_IOS_SETTINGS.tapToWake, true);
    assert.equal(DEFAULT_IOS_SETTINGS.controlCenterInApps, true);
    assert.equal(DEFAULT_IOS_SETTINGS.colorFilter, 'none');
  });

  it('evaluates ARX hashing, reversible Toffoli gates, and bit-level PHP bot blacklists', () => {
    resetArxBlacklistForTests();

    // Reversible Toffoli (CCNOT) gate truth table
    assert.equal(toffoliGate(1, 1, 0), 1);
    assert.equal(toffoliGate(1, 1, 1), 0);
    assert.equal(toffoliGate(1, 0, 0), 0);
    assert.equal(evaluateToffoliArray(0, 0, 0, 0), 0);
    assert.equal(evaluateToffoliArray(1, 0, 0, 0), 1);

    // Deterministic 32-bit unsigned ARX block hash with avalanche
    const h1 = arxHashBlock32('203.0.113.42');
    const h2 = arxHashBlock32('203.0.113.43');
    assert.notEqual(h1, h2);

    // Zero-alloc pathname extraction preserves Safari /api/proxy while catching .php bots
    assert.equal(
      extractPathnameZeroAlloc('http://localhost:3000/wp-login.php?redirect=/'),
      '/wp-login.php',
    );
    assert.equal(
      evaluateGatewayRequest('/api/proxy', '198.51.100.7', 'Mozilla/5.0'),
      ArxVerdict.ALLOW,
    );

    // Scanner hitting .php gets blocked AND permanently blacklisted in the Uint32Array arena
    const botIp = '203.0.113.99';
    assert.equal(
      evaluateGatewayRequest('/wp-login.php', botIp, 'Mozilla/5.0'),
      ArxVerdict.BLOCK_PHP_SCANNER,
    );
    // Subsequent request from blacklisted bot IP to clean '/' is immediately dropped at bitset stage
    assert.equal(
      evaluateGatewayRequest('/', botIp, 'Mozilla/5.0'),
      ArxVerdict.BLOCK_BLACKLISTED_IP,
    );
  });
});
