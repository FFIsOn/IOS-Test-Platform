/**
 * Zero-Allocation Hardware Telemetry, SharedArrayBuffer Layout & Taptic Engine
 * Manages 3D chassis transforms, MVP matrices, ProMotion frame throttling,
 * rubber-band physics, and Linear Resonant Actuator (LRA) audio-haptics.
 */

// === 3D ARTIST CONFIGURATION ===
export interface TitaniumFinishSpec {
  id: 'desert' | 'natural' | 'black' | 'white';
  label: string;
  bandHex: number;
  backGlassHex: number;
  plateauHex: number;
  cssBorder: string;
  cssBandGradient: string;
  metalness: number;
  roughness: number;
  anisotropy: number;
}

export const TITANIUM_FINISHES: Record<TitaniumFinishSpec['id'], TitaniumFinishSpec> = {
  desert: {
    id: 'desert',
    label: 'Desert Titanium',
    bandHex: 0xbba48e,
    backGlassHex: 0xd6c7b8,
    plateauHex: 0xc8b49f,
    cssBorder: '#A9927C',
    cssBandGradient: 'linear-gradient(135deg, #cbb59f 0%, #8f7965 48%, #d7c3af 100%)',
    metalness: 0.92,
    roughness: 0.24,
    anisotropy: 0.78,
  },
  natural: {
    id: 'natural',
    label: 'Natural Titanium',
    bandHex: 0xa6a5a1,
    backGlassHex: 0xbcbcb7,
    plateauHex: 0xb2b1ad,
    cssBorder: '#91908C',
    cssBandGradient: 'linear-gradient(135deg, #c2c1bd 0%, #7d7c78 48%, #d4d3cf 100%)',
    metalness: 0.94,
    roughness: 0.22,
    anisotropy: 0.82,
  },
  black: {
    id: 'black',
    label: 'Black Titanium',
    bandHex: 0x2c2d30,
    backGlassHex: 0x383a3e,
    plateauHex: 0x323438,
    cssBorder: '#43454A',
    cssBandGradient: 'linear-gradient(135deg, #4b4d52 0%, #1d1e21 48%, #3c3e42 100%)',
    metalness: 0.9,
    roughness: 0.28,
    anisotropy: 0.75,
  },
  white: {
    id: 'white',
    label: 'White Titanium',
    bandHex: 0xdcdde0,
    backGlassHex: 0xf1f2f4,
    plateauHex: 0xe6e7ea,
    cssBorder: '#C7C9CE',
    cssBandGradient: 'linear-gradient(135deg, #f0f1f4 0%, #adb0b6 48%, #ffffff 100%)',
    metalness: 0.88,
    roughness: 0.2,
    anisotropy: 0.72,
  },
};

export const STUDIO_LIGHTING_CONFIG = {
  keyLightColor: 0xfff3e6,
  keyLightIntensity: 2.2,
  hemiSkyColor: 0xcbe0ff,
  hemiGroundColor: 0x1c1f26,
  hemiIntensity: 0.85,
  rimLightColor: 0x7cb2ff,
  rimLightIntensity: 1.6,
  fogColor: 0x0b0d10,
  fogDensity: 0.045,
} as const;

/**
 * SharedArrayBuffer Numeric Index Offsets (Float32 / Int32 Views)
 * Total size: 64 * 4 bytes = 256 bytes (aligned to 64-byte cache lines)
 */
export enum SABFloatOffset {
  // Quaternion orientation (x, y, z, w)
  QUAT_X = 0,
  QUAT_Y = 1,
  QUAT_Z = 2,
  QUAT_W = 3,
  // Target tilt Euler angles from pointer/gyroscope
  TARGET_TILT_X = 4,
  TARGET_TILT_Y = 5,
  TARGET_ROT_Z = 6,
  // Spring velocities
  VEL_TILT_X = 7,
  VEL_TILT_Y = 8,
  // Rubber-band overscroll displacement & velocity
  RUBBER_BAND_Y = 9,
  RUBBER_BAND_VEL = 10,
  // Taptic Engine physical chassis micro-impulse
  TAPTIC_IMPULSE = 11,
  // Measured FPS & Frame Delta (ms)
  MEASURED_FPS = 12,
  FRAME_TIME_MS = 13,
  // Battery Thermal & Drain simulation
  DEVICE_TEMP_C = 14,
  // 4x4 Model-View-Projection Matrix slots [16..31]
  MVP_MAT_START = 16,
}

export enum SABIntOffset {
  // Frame-skipping throttle: 1 = 120Hz/60Hz full ProMotion, 2 = Low Power 30/60Hz cap, 4 = AOD 1Hz idle
  FRAME_SKIP_MODULO = 32,
  // Atomic telemetry flags
  IS_SHARED_BUFFER = 33,
  TAPTIC_COUNTER = 34,
  VIEW_MODE_3D = 35, // 0 = Direct 1:1 Front Mode, 1 = 3D Inspection Orbit Mode
  ORIENTATION_LANDSCAPE = 36, // 0 = Portrait, 1 = Landscape
  CHARGER_ATTACHED = 37, // 0 = Unplugged, 1 = MagSafe Attached
}

export interface HardwareMemoryBus {
  buffer: SharedArrayBuffer | ArrayBuffer;
  f32: Float32Array;
  i32: Int32Array;
  isAtomicCapable: boolean;
}

let singletonBus: HardwareMemoryBus | null = null;

export function getHardwareMemoryBus(): HardwareMemoryBus {
  if (singletonBus) return singletonBus;

  let buffer: SharedArrayBuffer | ArrayBuffer;
  let isAtomicCapable = false;

  if (typeof SharedArrayBuffer !== 'undefined') {
    try {
      buffer = new SharedArrayBuffer(256);
      isAtomicCapable = true;
    } catch {
      buffer = new ArrayBuffer(256);
    }
  } else {
    buffer = new ArrayBuffer(256);
  }

  const f32 = new Float32Array(buffer);
  const i32 = new Int32Array(buffer);

  // Initialize identity quaternion & baseline telemetry without allocations
  f32[SABFloatOffset.QUAT_W] = 1.0;
  f32[SABFloatOffset.MEASURED_FPS] = 60.0;
  f32[SABFloatOffset.FRAME_TIME_MS] = 16.6;
  f32[SABFloatOffset.DEVICE_TEMP_C] = 31.4;

  // Identity 4x4 matrix in [16..31]
  f32[SABFloatOffset.MVP_MAT_START + 0] = 1;
  f32[SABFloatOffset.MVP_MAT_START + 5] = 1;
  f32[SABFloatOffset.MVP_MAT_START + 10] = 1;
  f32[SABFloatOffset.MVP_MAT_START + 15] = 1;

  writeIntSlot(i32, SABIntOffset.FRAME_SKIP_MODULO, 1, isAtomicCapable);
  writeIntSlot(i32, SABIntOffset.IS_SHARED_BUFFER, isAtomicCapable ? 1 : 0, isAtomicCapable);

  singletonBus = { buffer, f32, i32, isAtomicCapable };
  return singletonBus;
}

export function writeIntSlot(
  i32: Int32Array,
  offset: SABIntOffset,
  value: number,
  atomic: boolean,
): void {
  if (atomic && typeof Atomics !== 'undefined') {
    Atomics.store(i32, offset, value);
  } else {
    i32[offset] = value;
  }
}

export function readIntSlot(
  i32: Int32Array,
  offset: SABIntOffset,
  atomic: boolean,
): number {
  if (atomic && typeof Atomics !== 'undefined') {
    return Atomics.load(i32, offset);
  }
  return i32[offset];
}

/**
 * Apple Linear Resonant Actuator (Taptic Engine) Zero-Asset Synthesizer
 * Emulates crisp mechanical detents, rigid clicks, soft thuds, and ringer alerts
 * using Web Audio API without external MP3 files.
 */
export type HapticPattern =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'rigid'
  | 'soft'
  | 'selection'
  | 'success'
  | 'warning'
  | 'keyboard'
  | 'shutter'
  | 'lock';

let audioCtx: AudioContext | null = null;

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

type TapticListener = (generatorLabel: string, pattern: HapticPattern) => void;
const tapticListeners = new Set<TapticListener>();

export function subscribeTapticEvents(cb: TapticListener): () => void {
  tapticListeners.add(cb);
  return () => {
    tapticListeners.delete(cb);
  };
}

function mapPatternToUIKitGenerator(pattern: HapticPattern): string {
  switch (pattern) {
    case 'selection':
      return 'UISelectionFeedbackGenerator.selectionChanged()';
    case 'success':
      return 'UINotificationFeedbackGenerator(.success)';
    case 'warning':
      return 'UINotificationFeedbackGenerator(.warning)';
    case 'keyboard':
      return 'UIKeyboardFeedbackGenerator.keyDown()';
    case 'shutter':
      return 'AVCaptureShutterHaptic(.rigid)';
    case 'lock':
      return 'SBSleepWakeHapticDetent()';
    default:
      return `UIImpactFeedbackGenerator(.${pattern})`;
  }
}

export function triggerTaptic(
  pattern: HapticPattern,
  systemHapticsEnabled = true,
  soundEnabled = true,
): void {
  const bus = getHardwareMemoryBus();

  // Record physical impulse into SAB so 3D chassis & subtle micro-recoil respond
  if (systemHapticsEnabled) {
    const strength =
      pattern === 'heavy' || pattern === 'shutter'
        ? 1.0
        : pattern === 'rigid' || pattern === 'warning'
          ? 0.75
          : 0.4;
    bus.f32[SABFloatOffset.TAPTIC_IMPULSE] = strength;
    const prev = readIntSlot(bus.i32, SABIntOffset.TAPTIC_COUNTER, bus.isAtomicCapable);
    writeIntSlot(bus.i32, SABIntOffset.TAPTIC_COUNTER, (prev + 1) | 0, bus.isAtomicCapable);

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern === 'heavy' ? 18 : 8);
    }

    if (tapticListeners.size > 0) {
      const label = mapPatternToUIKitGenerator(pattern);
      tapticListeners.forEach((fn) => fn(label, pattern));
    }
  }

  if (!systemHapticsEnabled && !soundEnabled) return;

  const ctx = ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  switch (pattern) {
    case 'keyboard': {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(soundEnabled ? 1150 : 170, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.016);
      gain.gain.setValueAtTime(soundEnabled ? 0.09 : 0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
      osc.start(now);
      osc.stop(now + 0.02);
      break;
    }
    case 'shutter': {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.045);
      gain.gain.setValueAtTime(soundEnabled ? 0.14 : 0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.055);
      break;
    }
    case 'lock': {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.045);
      gain.gain.setValueAtTime(soundEnabled ? 0.12 : 0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.055);
      break;
    }
    case 'success': {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(195, now);
      osc.frequency.setValueAtTime(260, now + 0.045);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      osc.start(now);
      osc.stop(now + 0.12);
      break;
    }
    case 'warning': {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.setValueAtTime(125, now + 0.06);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      osc.start(now);
      osc.stop(now + 0.14);
      break;
    }
    case 'rigid':
    case 'heavy': {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(175, now);
      osc.frequency.exponentialRampToValueAtTime(85, now + 0.024);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);
      osc.start(now);
      osc.stop(now + 0.028);
      break;
    }
    default: {
      // Crisp 155Hz LRA micro-tap
      osc.type = 'sine';
      osc.frequency.setValueAtTime(155, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.014);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.016);
      osc.start(now);
      osc.stop(now + 0.018);
      break;
    }
  }
}

/* ============================================================================
 * iOS Hearing Accessibility — Procedural Ambient Background Sounds Engine
 * Synthesizes gentle Rain, Ocean Surf, and Dark Noise with zero external MP3s.
 * ========================================================================== */
let bgNoiseSource: AudioBufferSourceNode | null = null;
let bgNoiseGain: GainNode | null = null;
let bgOceanLfo: OscillatorNode | null = null;
let cachedNoiseBuffer: AudioBuffer | null = null;
let currentBgKind: 'rain' | 'ocean' | 'dark-noise' | null = null;

function getOrCreatePinkishNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoiseBuffer) return cachedNoiseBuffer;
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * 3;
  const buf = ctx.createBuffer(1, length, sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
  }
  cachedNoiseBuffer = buf;
  return buf;
}

export function syncBackgroundSound(
  enabled: boolean,
  kind: 'rain' | 'ocean' | 'dark-noise',
  volumePct: number,
): void {
  if (typeof window === 'undefined') return;

  if (!enabled) {
    if (bgNoiseSource) {
      try {
        bgNoiseSource.stop();
      } catch {}
      bgNoiseSource.disconnect();
      bgNoiseSource = null;
    }
    if (bgOceanLfo) {
      try {
        bgOceanLfo.stop();
      } catch {}
      bgOceanLfo.disconnect();
      bgOceanLfo = null;
    }
    bgNoiseGain = null;
    currentBgKind = null;
    return;
  }

  const ctx = ensureAudioContext();
  if (!ctx) return;

  const targetGain = Math.max(0.01, (volumePct / 100) * 0.075);

  if (bgNoiseSource && bgNoiseGain && currentBgKind === kind) {
    bgNoiseGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.08);
    return;
  }

  // Rebuild graph if sound kind changed
  syncBackgroundSound(false, kind, volumePct);

  const src = ctx.createBufferSource();
  src.buffer = getOrCreatePinkishNoiseBuffer(ctx);
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(targetGain, ctx.currentTime);

  if (kind === 'rain') {
    filter.type = 'bandpass';
    filter.frequency.value = 1150;
    filter.Q.value = 0.55;
  } else if (kind === 'dark-noise') {
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 0.7;
  } else {
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.14;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    bgOceanLfo = lfo;
  }

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();

  bgNoiseSource = src;
  bgNoiseGain = gain;
  currentBgKind = kind;
}

