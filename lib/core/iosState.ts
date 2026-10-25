import type { TitaniumFinishSpec } from './hardwareMemory';

export type IOSAppId =
  | 'safari'
  | 'settings'
  | 'calculator'
  | 'notes'
  | 'clock'
  | 'camera'
  | 'photos';

export type IPhoneModelId =
  | 'iphone-16-pro'
  | 'iphone-14-pro-max'
  | 'iphone-13'
  | 'iphone-se';

export interface IPhoneModelSpec {
  id: IPhoneModelId;
  name: string;
  shortName: string;
  diagonal: string;
  logicalWidth: number; // CSS points
  logicalHeight: number; // CSS points
  physicalResolution: string;
  dpr: 2 | 3;
  refreshHz: 60 | 120;
  cutout: 'dynamic-island' | 'notch' | 'classic-bezel';
  hasHomeButton: boolean;
  hasActionButton: boolean;
  hasCameraControl: boolean;
  outerRadiusPx: number;
  screenRadiusPx: number;
  bezelPx: number;
  safeTopPx: number;
  safeBottomPx: number;
  modelNumberRetail: string;
  modelNumberSku: string;
}

export const IPHONE_MODELS: Record<IPhoneModelId, IPhoneModelSpec> = {
  'iphone-16-pro': {
    id: 'iphone-16-pro',
    name: 'iPhone 16 Pro',
    shortName: '16 Pro',
    diagonal: '6.3"',
    logicalWidth: 393,
    logicalHeight: 852,
    physicalResolution: '1206 × 2622',
    dpr: 3,
    refreshHz: 120,
    cutout: 'dynamic-island',
    hasHomeButton: false,
    hasActionButton: true,
    hasCameraControl: true,
    outerRadiusPx: 58,
    screenRadiusPx: 48,
    bezelPx: 4,
    safeTopPx: 54,
    safeBottomPx: 28,
    modelNumberRetail: 'MYND3LL/A',
    modelNumberSku: 'A3083',
  },
  'iphone-14-pro-max': {
    id: 'iphone-14-pro-max',
    name: 'iPhone 14 Pro Max',
    shortName: '14 Pro Max',
    diagonal: '6.7"',
    logicalWidth: 430,
    logicalHeight: 932,
    physicalResolution: '1290 × 2796',
    dpr: 3,
    refreshHz: 120,
    cutout: 'dynamic-island',
    hasHomeButton: false,
    hasActionButton: false,
    hasCameraControl: false,
    outerRadiusPx: 60,
    screenRadiusPx: 50,
    bezelPx: 6,
    safeTopPx: 54,
    safeBottomPx: 28,
    modelNumberRetail: 'MQ8R3LL/A',
    modelNumberSku: 'A2651',
  },
  'iphone-13': {
    id: 'iphone-13',
    name: 'iPhone 13',
    shortName: 'iPhone 13',
    diagonal: '6.1"',
    logicalWidth: 390,
    logicalHeight: 844,
    physicalResolution: '1170 × 2532',
    dpr: 3,
    refreshHz: 60,
    cutout: 'notch',
    hasHomeButton: false,
    hasActionButton: false,
    hasCameraControl: false,
    outerRadiusPx: 52,
    screenRadiusPx: 41,
    bezelPx: 8,
    safeTopPx: 47,
    safeBottomPx: 28,
    modelNumberRetail: 'MLPF3LL/A',
    modelNumberSku: 'A2482',
  },
  'iphone-se': {
    id: 'iphone-se',
    name: 'iPhone SE (3rd Gen)',
    shortName: 'iPhone SE',
    diagonal: '4.7"',
    logicalWidth: 375,
    logicalHeight: 667,
    physicalResolution: '750 × 1334',
    dpr: 2,
    refreshHz: 60,
    cutout: 'classic-bezel',
    hasHomeButton: true,
    hasActionButton: false,
    hasCameraControl: false,
    outerRadiusPx: 46,
    screenRadiusPx: 2,
    bezelPx: 12,
    safeTopPx: 24,
    safeBottomPx: 0,
    modelNumberRetail: 'MMX53LL/A',
    modelNumberSku: 'A2595',
  },
};

export type NetworkProfileId = 'wifi' | 'lte' | '3g' | 'slow-3g' | 'offline';

export interface NetworkProfileSpec {
  id: NetworkProfileId;
  label: string;
  downlinkLabel: string;
  rttMs: number;
  statusBadge: string;
}

export const NETWORK_PROFILES: Record<NetworkProfileId, NetworkProfileSpec> = {
  wifi: {
    id: 'wifi',
    label: 'Wi-Fi 6E',
    downlinkLabel: '240 Mbps',
    rttMs: 12,
    statusBadge: 'Wi-Fi',
  },
  lte: {
    id: 'lte',
    label: '4G LTE',
    downlinkLabel: '24 Mbps',
    rttMs: 65,
    statusBadge: 'LTE',
  },
  '3g': {
    id: '3g',
    label: 'Fast 3G',
    downlinkLabel: '1.6 Mbps',
    rttMs: 320,
    statusBadge: '3G',
  },
  'slow-3g': {
    id: 'slow-3g',
    label: 'Slow 3G',
    downlinkLabel: '400 Kbps',
    rttMs: 780,
    statusBadge: '3G',
  },
  offline: {
    id: 'offline',
    label: 'Offline',
    downlinkLabel: '0 Kbps',
    rttMs: 0,
    statusBadge: 'Offline',
  },
};

export interface DevConsoleEntry {
  id: string;
  level: 'log' | 'info' | 'warn' | 'error' | 'result';
  message: string;
  timestamp: string;
  source: string;
}

export interface DevDomNodeSummary {
  tag: string;
  id: string;
  classes: string;
  textPreview: string;
  depth: number;
  selector: string;
}

export interface DevInspectedElement {
  tag: string;
  id: string;
  classes: string;
  selector: string;
  width: number;
  height: number;
  top: number;
  left: number;
  attributes: Array<{ name: string; value: string }>;
  computedStyles: Record<string, string>;
  innerTextPreview: string;
}

export interface DevNetworkEntry {
  id: string;
  url: string;
  method: string;
  status: number;
  durationMs: number;
  sizeBytes: number;
  profile: NetworkProfileId;
  timestamp: string;
}

export interface HapticEventEntry {
  id: string;
  generator: string;
  pattern: string;
  timestamp: string;
}

export type ActionButtonRole =
  | 'silent'
  | 'flashlight'
  | 'camera'
  | 'safari'
  | 'focus'
  | 'calculator'
  | 'accessibility';

export type FocusModeType = 'off' | 'dnd' | 'work' | 'sleep';

export type SearchEngineId = 'wikipedia' | 'duckduckgo' | 'bing';

export type ColorFilterMode =
  | 'none'
  | 'grayscale'
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia';

export type BackTapAction =
  | 'none'
  | 'screenshot'
  | 'flashlight'
  | 'control-center'
  | 'reachability'
  | 'accessibility-shortcut'
  | 'safari'
  | 'camera';

export type BackgroundSoundId = 'rain' | 'ocean' | 'dark-noise';

export type AccessibilityShortcutTarget =
  | 'smart-invert'
  | 'classic-invert'
  | 'color-filters'
  | 'reduce-white-point'
  | 'zoom'
  | 'assistive-touch'
  | 'vehicle-motion-cues'
  | 'eye-tracking'
  | 'background-sounds'
  | 'guided-access'
  | 'increase-contrast'
  | 'reduce-transparency';

export const ACCESSIBILITY_SHORTCUT_DEFS: Array<{
  id: AccessibilityShortcutTarget;
  label: string;
  description: string;
}> = [
  {
    id: 'smart-invert',
    label: 'Smart Invert',
    description: 'Reverses display colors while preserving photos and media',
  },
  {
    id: 'classic-invert',
    label: 'Classic Invert',
    description: 'Reverses all colors across the OLED panel',
  },
  {
    id: 'color-filters',
    label: 'Color Filters',
    description: 'Applies Grayscale or Daltonization color-blindness matrices',
  },
  {
    id: 'reduce-white-point',
    label: 'Reduce White Point',
    description: 'Dims bright white peak intensity below minimum brightness',
  },
  {
    id: 'zoom',
    label: 'Zoom',
    description: 'Magnifies the entire iOS screen with a floating Zoom lens controller',
  },
  {
    id: 'assistive-touch',
    label: 'AssistiveTouch',
    description: 'Floating magnetic on-screen hardware menu puck',
  },
  {
    id: 'vehicle-motion-cues',
    label: 'Vehicle Motion Cues',
    description: 'iOS 18 animated edge dots that counter-shift with device tilt',
  },
  {
    id: 'eye-tracking',
    label: 'Eye Tracking',
    description: 'iOS 18 on-screen gaze pointer reticle',
  },
  {
    id: 'background-sounds',
    label: 'Background Sounds',
    description: 'Plays ambient Rain, Ocean, or Dark Noise to mask distractions',
  },
  {
    id: 'guided-access',
    label: 'Guided Access',
    description: 'Locks iPhone to a single active app until triple-clicked again',
  },
  {
    id: 'increase-contrast',
    label: 'Increase Contrast',
    description: 'Boosts foreground-to-surface contrast and border crispness',
  },
  {
    id: 'reduce-transparency',
    label: 'Reduce Transparency',
    description: 'Replaces translucent Dock and Control Center surfaces with solid fills',
  },
];

export type SettingsRouteId =
  | 'root'
  | 'wifi'
  | 'bluetooth'
  | 'cellular'
  | 'battery'
  | 'action-button'
  | 'control-center'
  | 'display'
  | 'standby'
  | 'sounds'
  | 'focus'
  | 'camera-settings'
  | 'accessibility'
  | 'ax-display'
  | 'ax-zoom'
  | 'ax-touch'
  | 'ax-motion'
  | 'ax-hearing'
  | 'ax-shortcut'
  | 'safari'
  | 'wallpaper'
  | 'about';

export interface HomeWebClip {
  id: string;
  title: string;
  url: string;
  accentColor: string;
}

export interface CapturedPhoto {
  id: string;
  title: string;
  timestamp: string;
  kind: 'screenshot' | 'camera';
  accentGradient: string;
  caption: string;
  dataUrl?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
}

export interface SafariTab {
  id: string;
  url: string;
  title: string;
  history: string[];
  historyIndex: number;
  isPrivate: boolean;
}

export interface ActiveKeyboardSession {
  source: 'web' | 'native';
  inputType: 'text' | 'url' | 'search' | 'email' | 'number' | 'password' | 'textarea';
  enterKeyLabel: 'Go' | 'Search' | 'Return' | 'Done';
  value: string;
  placeholder: string;
  canTabPrev: boolean;
  canTabNext: boolean;
}

export interface IOSSystemSettings {
  // Active Device Frame Model
  deviceModel: IPhoneModelId;

  // Connectivity & Developer Network Throttling
  networkProfile: NetworkProfileId;
  airplaneMode: boolean;
  wifiEnabled: boolean;
  wifiNetwork: string;
  bluetoothEnabled: boolean;
  cellularEnabled: boolean;
  cellularMode: '5G UW' | '5G Auto' | 'LTE';
  personalHotspot: boolean;

  // Action Button, Control Center & Physical Hardware
  actionButtonRole: ActionButtonRole;
  controlCenterInApps: boolean;
  silentMode: boolean;
  ringerVolume: number; // 0..100
  mediaVolume: number; // 0..100
  flashlightOn: boolean;
  flashlightIntensity: number; // 1..4
  flashlightBeamWidth: number; // 1..3
  orientationLocked: boolean;
  isLandscape: boolean;

  // Display & Brightness
  darkMode: boolean;
  brightness: number; // 15..100
  trueTone: boolean;
  nightShift: boolean;
  nightShiftWarmth: number; // 0..100
  alwaysOnDisplay: boolean;
  aodShowWallpaper: boolean;
  raiseToWake: boolean;
  tapToWake: boolean;
  autoLockSeconds: 30 | 60 | 120 | 0;
  wallpaperId: 'titanium' | 'aurora';
  textScale: number; // 0.88 .. 1.18
  boldText: boolean;

  // Battery & Power
  batteryLevel: number; // 1..100
  isCharging: boolean;
  showBatteryPercentage: boolean;
  lowPowerMode: boolean;
  chargeLimit: 80 | 85 | 90 | 95 | 100;

  // StandBy
  standByEnabled: boolean;
  standByNightRed: boolean;

  // Sounds, Haptics & Camera
  keyboardClicks: boolean;
  keyboardHaptics: boolean;
  systemHaptics: boolean;
  hapticsPlayInSilent: boolean;
  lockSoundEnabled: boolean;
  cameraGrid: boolean;
  cameraLevel: boolean;

  // Touch & Gesture Simulation
  showTouchIndicators: boolean;
  pinchModeEnabled: boolean;

  // Focus
  focusMode: FocusModeType;

  // Accessibility — Vision, Display & Text Size
  buttonShapes: boolean;
  onOffLabels: boolean;
  reduceTransparency: boolean;
  increaseContrast: boolean;
  smartInvert: boolean;
  classicInvert: boolean;
  colorFilter: ColorFilterMode;
  reduceWhitePoint: boolean;
  reduceWhitePointIntensity: number; // 25..95
  accessibilityZoom: boolean;
  accessibilityZoomLevel: number; // 1.25..2.5

  // Accessibility — Physical, Motor, Motion & Hearing
  reachabilityEnabled: boolean;
  assistiveTouchEnabled: boolean;
  reduceMotion: boolean;
  limitFrameRate60Hz: boolean;
  vehicleMotionCues: boolean;
  eyeTrackingEnabled: boolean;
  backTapDouble: BackTapAction;
  backTapTriple: BackTapAction;
  backgroundSounds: boolean;
  backgroundSoundType: BackgroundSoundId;
  ledFlashForAlerts: boolean;
  guidedAccessEnabled: boolean;
  accessibilityShortcutTargets: AccessibilityShortcutTarget[];

  // Safari Specific Settings
  safariSearchEngine: SearchEngineId;
  safariAddressBarLayout: 'bottom' | 'top';
  safariUseProxy: boolean;

  // Chassis
  chassisFinish: TitaniumFinishSpec['id'];
}

export const DEFAULT_IOS_SETTINGS: IOSSystemSettings = {
  deviceModel: 'iphone-16-pro',
  networkProfile: 'wifi',

  airplaneMode: false,
  wifiEnabled: true,
  wifiNetwork: 'Cupertino-6E',
  bluetoothEnabled: true,
  cellularEnabled: true,
  cellularMode: '5G UW',
  personalHotspot: false,

  actionButtonRole: 'silent',
  controlCenterInApps: true,
  silentMode: false,
  ringerVolume: 75,
  mediaVolume: 68,
  flashlightOn: false,
  flashlightIntensity: 3,
  flashlightBeamWidth: 2,
  orientationLocked: false,
  isLandscape: false,

  darkMode: true,
  brightness: 92,
  trueTone: true,
  nightShift: false,
  nightShiftWarmth: 45,
  alwaysOnDisplay: true,
  aodShowWallpaper: true,
  raiseToWake: true,
  tapToWake: true,
  autoLockSeconds: 60,
  wallpaperId: 'titanium',
  textScale: 1.0,
  boldText: false,

  batteryLevel: 88,
  isCharging: false,
  showBatteryPercentage: true,
  lowPowerMode: false,
  chargeLimit: 100,

  standByEnabled: true,
  standByNightRed: true,

  keyboardClicks: true,
  keyboardHaptics: true,
  systemHaptics: true,
  hapticsPlayInSilent: true,
  lockSoundEnabled: true,
  cameraGrid: true,
  cameraLevel: true,

  showTouchIndicators: true,
  pinchModeEnabled: false,

  focusMode: 'off',

  buttonShapes: false,
  onOffLabels: false,
  reduceTransparency: false,
  increaseContrast: false,
  smartInvert: false,
  classicInvert: false,
  colorFilter: 'none',
  reduceWhitePoint: false,
  reduceWhitePointIntensity: 65,
  accessibilityZoom: false,
  accessibilityZoomLevel: 1.6,

  reachabilityEnabled: true,
  assistiveTouchEnabled: false,
  reduceMotion: false,
  limitFrameRate60Hz: false,
  vehicleMotionCues: false,
  eyeTrackingEnabled: false,
  backTapDouble: 'screenshot',
  backTapTriple: 'accessibility-shortcut',
  backgroundSounds: false,
  backgroundSoundType: 'rain',
  ledFlashForAlerts: false,
  guidedAccessEnabled: false,
  accessibilityShortcutTargets: [
    'smart-invert',
    'color-filters',
    'reduce-white-point',
    'zoom',
    'vehicle-motion-cues',
    'assistive-touch',
    'background-sounds',
    'guided-access',
  ],

  safariSearchEngine: 'wikipedia',
  safariAddressBarLayout: 'bottom',
  safariUseProxy: true,

  chassisFinish: 'desert',
};

export const INITIAL_NOTES: NoteItem[] = [
  {
    id: 'note-1',
    title: 'iPhone Hardware & Accessibility Guide',
    body: '• Triple-click the physical Right Side Button (or Touch ID Home Button on iPhone SE) to open the Accessibility Shortcut sheet.\n• Hover over the transparent Master Legend on the right side of the main workspace to inspect and toggle every 1:1 iOS setting.\n• Try Vehicle Motion Cues, Smart Invert, On/Off Labels (I/O), Reduce White Point, Zoom, and Background Sounds.',
    updatedAt: 'Today, 9:41 AM',
  },
  {
    id: 'note-2',
    title: 'WebKit Mobile Viewport Specs',
    body: 'iPhone 16 Pro: 393 × 852 pt (@3x)\niPhone 14 Pro Max: 430 × 932 pt (@3x)\niPhone 13: 390 × 844 pt (@3x)\niPhone SE: 375 × 667 pt (@2x)',
    updatedAt: 'Yesterday',
  },
];

export const INITIAL_PHOTOS: CapturedPhoto[] = [
  {
    id: 'photo-desert',
    title: 'Grade 5 Desert Titanium Macro',
    timestamp: 'Today • 09:12 AM',
    kind: 'camera',
    accentGradient: 'linear-gradient(145deg, #2d241e 0%, #9b7e66 55%, #121318 100%)',
    caption: '24 mm ƒ/1.78 • 48 MP Fusion Camera • HEIF',
  },
  {
    id: 'photo-coast',
    title: 'Big Sur Coastal Twilight',
    timestamp: 'Yesterday • 06:48 PM',
    kind: 'camera',
    accentGradient: 'linear-gradient(145deg, #0f172a 0%, #1e40af 50%, #f59e0b 100%)',
    caption: '120 mm ƒ/2.8 • 5x Tetraprism Telephoto • 12 MP',
  },
];

export const SAFARI_FAVORITES = [
  { title: 'Wikipedia', url: 'https://en.m.wikipedia.org/wiki/IPhone', short: 'W', bg: '#F8FAFC', fg: '#0F172A' },
  { title: 'DuckDuckGo', url: 'https://html.duckduckgo.com/html/', short: 'DDG', bg: '#DE5833', fg: '#FFFFFF' },
  { title: 'Hacker News', url: 'https://news.ycombinator.com', short: 'Y', bg: '#FF6600', fg: '#FFFFFF' },
  { title: 'NPR Text', url: 'https://text.npr.org', short: 'NPR', bg: '#1E293B', fg: '#F8FAFC' },
  { title: 'Example.com', url: 'https://example.com', short: 'Ex', bg: '#2563EB', fg: '#FFFFFF' },
  { title: 'W3C Web', url: 'https://www.w3.org', short: 'W3', bg: '#005A9C', fg: '#FFFFFF' },
  { title: 'HTTPBin', url: 'https://httpbin.org/forms/post', short: 'Form', bg: '#0D9488', fg: '#FFFFFF' },
  { title: 'Python.org', url: 'https://www.python.org', short: 'Py', bg: '#1D4ED8', fg: '#FDE047' },
] as const;
