'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Image from 'next/image';
import {
  Accessibility,
  Battery,
  Bell,
  BellOff,
  Bluetooth,
  Calculator,
  Camera,
  Check,
  Clock,
  Compass,
  Ear,
  Eye,
  FileText,
  Fingerprint,
  Flashlight,
  Globe,
  Image as ImageIcon,
  Lock,
  Maximize2,
  Moon,
  Plane,
  Power,
  RotateCcw,
  Settings,
  Smartphone,
  Sun,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Zap,
  ZoomIn,
} from 'lucide-react';
import titaniumWallpaper from '@/src/assets/images/ios_titanium_wallpaper_1792903595724.jpg';
import auroraWallpaper from '@/src/assets/images/ios_aurora_wallpaper_1792903595133.jpg';
import {
  syncBackgroundSound,
  TITANIUM_FINISHES,
  triggerTaptic,
} from '@/lib/core/hardwareMemory';
import {
  ACCESSIBILITY_SHORTCUT_DEFS,
  IPHONE_MODELS,
  type AccessibilityShortcutTarget,
  type ActiveKeyboardSession,
  type BackTapAction,
  type CapturedPhoto,
  type DevConsoleEntry,
  type DevDomNodeSummary,
  type DevInspectedElement,
  type DevNetworkEntry,
  type HomeWebClip,
  type IOSAppId,
  type IOSSystemSettings,
  type NoteItem,
  type SettingsRouteId,
} from '@/lib/core/iosState';
import SafariApp, { type SafariAppHandle } from '@/components/apps/SafariApp';
import SettingsApp, { type SettingsAppHandle } from '@/components/apps/SettingsApp';
import IOSKeyboard from '@/components/ios/IOSKeyboard';
import {
  CalculatorApp,
  CameraApp,
  ClockApp,
  NotesApp,
  PhotosApp,
} from '@/components/apps/NativeApps';

export interface IPhoneDeviceHandle {
  openUrlInSafari: (url: string) => void;
  triggerScreenshot: () => void;
  notifyChargingStarted: () => void;
  evalJavaScript: (code: string) => void;
  queryDomSelector: (selector: string) => void;
  openSettingsRoute: (route: SettingsRouteId) => void;
  triggerAccessibilityShortcut: () => void;
  triggerBackTap: (taps: 2 | 3) => void;
}

interface IPhoneDeviceProps {
  settings: IOSSystemSettings;
  onUpdateSettings: (patch: Partial<IOSSystemSettings>) => void;
  notes: NoteItem[];
  onUpdateNotes: (notes: NoteItem[]) => void;
  photos: CapturedPhoto[];
  onAddPhoto: (photo: CapturedPhoto) => void;
  webClips: HomeWebClip[];
  onAddWebClip: (clip: HomeWebClip) => void;
  onRemoveWebClip: (id: string) => void;
  inspectElementActive: boolean;
  onConsoleEntry: (entry: DevConsoleEntry) => void;
  onDomTreeUpdate: (nodes: DevDomNodeSummary[]) => void;
  onElementSelected: (el: DevInspectedElement) => void;
  onNetworkEntry: (entry: DevNetworkEntry) => void;
}

type IslandBannerKind =
  | null
  | 'silent'
  | 'hold-hint'
  | 'flashlight'
  | 'charging'
  | 'faceid'
  | 'timer'
  | 'custom-status';

interface TouchContactState {
  active: boolean;
  x: number;
  y: number;
  longPressed: boolean;
}

interface PinchContactState {
  active: boolean;
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
  dragging: boolean;
}

const NATIVE_APP_DEFS: Array<{
  id: IOSAppId;
  label: string;
  bg: string;
  fg: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'safari',
    label: 'Safari',
    bg: 'linear-gradient(180deg, #38BDF8 0%, #2563EB 100%)',
    fg: '#FFFFFF',
    Icon: Compass,
  },
  {
    id: 'settings',
    label: 'Settings',
    bg: 'linear-gradient(180deg, #94A3B8 0%, #475569 100%)',
    fg: '#FFFFFF',
    Icon: Settings,
  },
  {
    id: 'camera',
    label: 'Camera',
    bg: 'linear-gradient(180deg, #52525B 0%, #18181B 100%)',
    fg: '#F4F4F5',
    Icon: Camera,
  },
  {
    id: 'photos',
    label: 'Photos',
    bg: 'linear-gradient(135deg, #FB7185 0%, #FBBF24 50%, #38BDF8 100%)',
    fg: '#FFFFFF',
    Icon: ImageIcon,
  },
  { id: 'clock', label: 'Clock', bg: '#18181B', fg: '#F59E0B', Icon: Clock },
  {
    id: 'notes',
    label: 'Notes',
    bg: 'linear-gradient(180deg, #FBBF24 0%, #F59E0B 32%, #FFFFFF 32%, #F4F4F5 100%)',
    fg: '#18181B',
    Icon: FileText,
  },
  { id: 'calculator', label: 'Calculator', bg: '#27272A', fg: '#FF9F0A', Icon: Calculator },
];

function setNativeInputValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  nextVal: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(el, nextVal);
  } else {
    el.value = nextVal;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const IPhoneDevice = forwardRef<IPhoneDeviceHandle, IPhoneDeviceProps>(function IPhoneDevice(
  {
    settings,
    onUpdateSettings,
    notes,
    onUpdateNotes,
    photos,
    onAddPhoto,
    webClips,
    onAddWebClip,
    onRemoveWebClip,
    inspectElementActive,
    onConsoleEntry,
    onDomTreeUpdate,
    onElementSelected,
    onNetworkEntry,
  },
  ref,
) {
  const modelSpec = IPHONE_MODELS[settings.deviceModel];

  // Power & Screen States
  const [poweredOff, setPoweredOff] = useState<boolean>(false);
  const [showPowerOffSheet, setShowPowerOffSheet] = useState<boolean>(false);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(true);

  // Active App & Multitasking Switcher
  const [activeApp, setActiveApp] = useState<IOSAppId | null>(null);
  const [recentApps, setRecentApps] = useState<IOSAppId[]>(['safari', 'settings']);
  const [showAppSwitcher, setShowAppSwitcher] = useState<boolean>(false);
  const [showControlCenter, setShowControlCenter] = useState<boolean>(false);
  const [jiggleMode, setJiggleMode] = useState<boolean>(false);
  const [reachabilityActive, setReachabilityActive] = useState<boolean>(false);
  const [scrollToTopSignal, setScrollToTopSignal] = useState<number>(0);

  // Unified iOS Software Keyboard Session (pops up on ANY web input OR native OS input!)
  const [keyboardSession, setKeyboardSession] = useState<ActiveKeyboardSession | null>(null);
  const nativeFocusedElRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Hydration-safe Live Clock (deterministic '9:41 AM' SSR snapshot -> local browser clock on client)
  const clockSnapshot = useSyncExternalStore(
    subscribeWallClock,
    getClientWallClockSnapshot,
    getServerWallClockSnapshot,
  );
  const [timeFormatted, dateFormatted] = clockSnapshot.split('|');

  // Dynamic Island / Top Alert Banner State
  const [islandBanner, setIslandBanner] = useState<IslandBannerKind>(null);
  const [customBannerText, setCustomBannerText] = useState<string>('');
  const [islandExpanded, setIslandExpanded] = useState<boolean>(false);
  const islandTimeoutRef = useRef<number | null>(null);

  // Accessibility Shortcut Sheet & Sensory Overlays
  const [showAxShortcutSheet, setShowAxShortcutSheet] = useState<boolean>(false);
  const [alertLedStrobe, setAlertLedStrobe] = useState<boolean>(false);
  const [gazePos, setGazePos] = useState<{ x: number; y: number }>({ x: 196, y: 380 });
  const [motionCueShift, setMotionCueShift] = useState<{ dx: number; dy: number }>({
    dx: 0,
    dy: 0,
  });

  // Physical Left-Edge Volume HUD Quirk (Wide on first press, slim on subsequent!)
  const [volHudVisible, setVolHudVisible] = useState<boolean>(false);
  const [volHudSlim, setVolHudSlim] = useState<boolean>(false);
  const volTimeoutRef = useRef<number | null>(null);

  // Screenshot Flash & Thumbnail Toast
  const [screenshotFlash, setScreenshotFlash] = useState<boolean>(false);
  const [screenshotThumb, setScreenshotThumb] = useState<CapturedPhoto | null>(null);
  const [pendingSafariUrl, setPendingSafariUrl] = useState<string | null>(null);
  const safariRef = useRef<SafariAppHandle | null>(null);
  const settingsRef = useRef<SettingsAppHandle | null>(null);

  // Background Timer
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // AssistiveTouch Floating Puck State
  const [puckPos, setPuckPos] = useState<{ side: 'left' | 'right'; yPct: number }>({
    side: 'right',
    yPct: 62,
  });
  const [puckMenuOpen, setPuckMenuOpen] = useState<boolean>(false);

  // Realistic Touch, Long-Press & Multi-Touch Pinch Simulation State
  const screenRef = useRef<HTMLDivElement | null>(null);
  const [altKeyHeld, setAltKeyHeld] = useState<boolean>(false);
  const [touchContact, setTouchContact] = useState<TouchContactState>({
    active: false,
    x: 0,
    y: 0,
    longPressed: false,
  });
  const [pinchContact, setPinchContact] = useState<PinchContactState>({
    active: false,
    p1x: 0,
    p1y: 0,
    p2x: 0,
    p2y: 0,
    dragging: false,
  });
  const [photosPinchZoom, setPhotosPinchZoom] = useState<number>(1);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);
  const prevPinchDistRef = useRef<number | null>(null);

  // Physical Button Press & Triple-Click Tracking Timers
  const actionHoldTimerRef = useRef<number | null>(null);
  const actionTriggeredRef = useRef<boolean>(false);
  const powerHoldTimerRef = useRef<number | null>(null);
  const powerTriggeredRef = useRef<boolean>(false);
  const sideClickTimesRef = useRef<number[]>([]);
  const wasUnlockedBeforeSideRef = useRef<boolean>(false);
  const lockCornerHoldRef = useRef<number | null>(null);
  const homeBtnLastClickRef = useRef<number>(0);
  const homeClickTimesRef = useRef<number[]>([]);
  const homeBtnClickTimerRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(0);
  const [pressingLockBtn, setPressingLockBtn] = useState<'flashlight' | 'camera' | null>(null);

  // Home Bar / Bottom-Edge Gesture Tracking
  const homeBarGestureRef = useRef<{ startX: number; startY: number; startTime: number } | null>(
    null,
  );
  const iconLongPressRef = useRef<number | null>(null);

  const effectiveHaptics =
    settings.systemHaptics && (!settings.silentMode || settings.hapticsPlayInSilent);

  // Hearing Accessibility: Procedural Ambient Background Sounds (Rain / Ocean / Dark Noise)
  useEffect(() => {
    syncBackgroundSound(
      settings.backgroundSounds && !poweredOff,
      settings.backgroundSoundType,
      settings.mediaVolume,
    );
  }, [
    settings.backgroundSounds,
    settings.backgroundSoundType,
    settings.mediaVolume,
    poweredOff,
  ]);

  useEffect(() => {
    return () => {
      syncBackgroundSound(false, 'rain', 0);
    };
  }, []);

  // Auto-Lock Idle Screen Timer (30s / 60s / 120s / Never)
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, [isSleeping, isLocked, activeApp, settings.autoLockSeconds]);

  useEffect(() => {
    if (poweredOff || isSleeping || settings.autoLockSeconds === 0) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= settings.autoLockSeconds * 1000) {
        setIsSleeping(true);
        setIsLocked(true);
        setShowControlCenter(false);
        setShowAppSwitcher(false);
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [poweredOff, isSleeping, settings.autoLockSeconds]);

  // Track Option/Alt key for Xcode-Simulator-style Two-Finger Pinch Simulation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltKeyHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltKeyHeld(false);
        prevPinchDistRef.current = null;
        setPinchContact((p) => ({ ...p, active: false, dragging: false }));
      }
    };
    const onBlur = () => {
      setAltKeyHeld(false);
      prevPinchDistRef.current = null;
      setPinchContact((p) => ({ ...p, active: false, dragging: false }));
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const pulseLedAlertFlash = useCallback(() => {
    if (!settings.ledFlashForAlerts) return;
    setAlertLedStrobe(true);
    window.setTimeout(() => setAlertLedStrobe(false), 140);
    window.setTimeout(() => setAlertLedStrobe(true), 260);
    window.setTimeout(() => setAlertLedStrobe(false), 420);
  }, [settings.ledFlashForAlerts]);

  // Background Timer ticker
  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          triggerTaptic('warning', effectiveHaptics, !settings.silentMode);
          pulseLedAlertFlash();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, effectiveHaptics, settings.silentMode, pulseLedAlertFlash]);

  const dismissAllKeyboards = useCallback(() => {
    setKeyboardSession(null);
    if (nativeFocusedElRef.current) {
      nativeFocusedElRef.current.blur();
      nativeFocusedElRef.current = null;
    }
    safariRef.current?.dismissKeyboard();
  }, []);

  const showIslandTransient = useCallback((kind: IslandBannerKind, ms = 2200) => {
    if (islandTimeoutRef.current) window.clearTimeout(islandTimeoutRef.current);
    setIslandBanner(kind);
    islandTimeoutRef.current = window.setTimeout(() => {
      setIslandBanner(null);
      setIslandExpanded(false);
    }, ms);
  }, []);

  const showCustomStatusBanner = useCallback(
    (message: string, ms = 2100) => {
      setCustomBannerText(message);
      showIslandTransient('custom-status', ms);
    },
    [showIslandTransient],
  );

  const openApp = useCallback(
    (appId: IOSAppId) => {
      triggerTaptic('light', effectiveHaptics, false);
      dismissAllKeyboards();
      setIsSleeping(false);
      setIsLocked(false);
      setShowControlCenter(false);
      setShowAppSwitcher(false);
      setShowAxShortcutSheet(false);
      setJiggleMode(false);
      setReachabilityActive(false);
      setActiveApp(appId);
      setRecentApps((prev) => [appId, ...prev.filter((id) => id !== appId)]);
    },
    [dismissAllKeyboards, effectiveHaptics],
  );

  const isShortcutTargetActive = useCallback(
    (target: AccessibilityShortcutTarget): boolean => {
      switch (target) {
        case 'smart-invert':
          return settings.smartInvert;
        case 'classic-invert':
          return settings.classicInvert;
        case 'color-filters':
          return settings.colorFilter !== 'none';
        case 'reduce-white-point':
          return settings.reduceWhitePoint;
        case 'zoom':
          return settings.accessibilityZoom;
        case 'assistive-touch':
          return settings.assistiveTouchEnabled;
        case 'vehicle-motion-cues':
          return settings.vehicleMotionCues;
        case 'eye-tracking':
          return settings.eyeTrackingEnabled;
        case 'background-sounds':
          return settings.backgroundSounds;
        case 'guided-access':
          return settings.guidedAccessEnabled;
        case 'increase-contrast':
          return settings.increaseContrast;
        case 'reduce-transparency':
          return settings.reduceTransparency;
      }
    },
    [settings],
  );

  const toggleShortcutTarget = useCallback(
    (target: AccessibilityShortcutTarget) => {
      triggerTaptic('selection', effectiveHaptics, false);
      const def = ACCESSIBILITY_SHORTCUT_DEFS.find((d) => d.id === target);
      const willBeOn = !isShortcutTargetActive(target);

      switch (target) {
        case 'smart-invert':
          onUpdateSettings({ smartInvert: willBeOn, classicInvert: false });
          break;
        case 'classic-invert':
          onUpdateSettings({ classicInvert: willBeOn, smartInvert: false });
          break;
        case 'color-filters':
          onUpdateSettings({ colorFilter: willBeOn ? 'grayscale' : 'none' });
          break;
        case 'reduce-white-point':
          onUpdateSettings({ reduceWhitePoint: willBeOn });
          break;
        case 'zoom':
          onUpdateSettings({ accessibilityZoom: willBeOn });
          break;
        case 'assistive-touch':
          onUpdateSettings({ assistiveTouchEnabled: willBeOn });
          break;
        case 'vehicle-motion-cues':
          onUpdateSettings({ vehicleMotionCues: willBeOn });
          break;
        case 'eye-tracking':
          onUpdateSettings({ eyeTrackingEnabled: willBeOn });
          break;
        case 'background-sounds':
          onUpdateSettings({ backgroundSounds: willBeOn });
          break;
        case 'guided-access':
          if (willBeOn && activeApp === null) {
            setActiveApp('safari');
            setIsLocked(false);
          }
          onUpdateSettings({ guidedAccessEnabled: willBeOn });
          break;
        case 'increase-contrast':
          onUpdateSettings({ increaseContrast: willBeOn });
          break;
        case 'reduce-transparency':
          onUpdateSettings({ reduceTransparency: willBeOn });
          break;
      }

      if (def) {
        showCustomStatusBanner(`${def.label} · ${willBeOn ? 'On' : 'Off'}`, 1900);
      }
    },
    [
      activeApp,
      effectiveHaptics,
      isShortcutTargetActive,
      onUpdateSettings,
      showCustomStatusBanner,
    ],
  );

  // Triple-Click Side / Home Button -> Accessibility Shortcut!
  const triggerAccessibilityShortcut = useCallback(() => {
    if (poweredOff) return;
    triggerTaptic('medium', effectiveHaptics, false);
    setIsSleeping(false);

    if (settings.guidedAccessEnabled && activeApp !== null) {
      onUpdateSettings({ guidedAccessEnabled: false });
      showCustomStatusBanner('Guided Access Ended', 2100);
      return;
    }

    if (settings.accessibilityShortcutTargets.length === 1) {
      toggleShortcutTarget(settings.accessibilityShortcutTargets[0]);
      return;
    }

    setShowControlCenter(false);
    setShowAppSwitcher(false);
    setShowAxShortcutSheet((prev) => !prev);
  }, [
    activeApp,
    effectiveHaptics,
    onUpdateSettings,
    poweredOff,
    settings.accessibilityShortcutTargets,
    settings.guidedAccessEnabled,
    showCustomStatusBanner,
    toggleShortcutTarget,
  ]);

  // Screenshot Capture Quirk (Side + Volume Up)
  const captureScreenshot = useCallback(() => {
    if (poweredOff) return;
    triggerTaptic('shutter', effectiveHaptics, !settings.silentMode);
    setScreenshotFlash(true);
    window.setTimeout(() => setScreenshotFlash(false), 140);

    const shot: CapturedPhoto = {
      id: `shot-${Date.now()}`,
      title: `Screenshot — ${activeApp ? activeApp.toUpperCase() : isLocked ? 'Lock Screen' : 'Home Screen'}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      kind: 'screenshot',
      accentGradient: 'linear-gradient(145deg, #1e293b 0%, #3b82f6 52%, #0f172a 100%)',
      caption: `${modelSpec.physicalResolution} • Display P3 PNG`,
    };
    onAddPhoto(shot);
    setScreenshotThumb(shot);
    window.setTimeout(() => {
      setScreenshotThumb((cur) => (cur?.id === shot.id ? null : cur));
    }, 3400);
  }, [
    activeApp,
    effectiveHaptics,
    isLocked,
    modelSpec.physicalResolution,
    onAddPhoto,
    poweredOff,
    settings.silentMode,
  ]);

  // Double / Triple Back Tap Accelerometer Action
  const executeBackTap = useCallback(
    (taps: 2 | 3) => {
      if (poweredOff) return;
      const action: BackTapAction =
        taps === 2 ? settings.backTapDouble : settings.backTapTriple;
      if (action === 'none') {
        showCustomStatusBanner(`${taps === 2 ? 'Double' : 'Triple'} Back Tap · None`, 1600);
        return;
      }

      setIsSleeping(false);
      triggerTaptic('rigid', effectiveHaptics, false);

      switch (action) {
        case 'screenshot':
          captureScreenshot();
          showCustomStatusBanner('Back Tap · Screenshot', 1600);
          break;
        case 'flashlight': {
          const next = !settings.flashlightOn;
          onUpdateSettings({ flashlightOn: next });
          showCustomStatusBanner(`Back Tap · Torch ${next ? 'On' : 'Off'}`, 1800);
          break;
        }
        case 'control-center':
          if (activeApp !== null && !settings.controlCenterInApps) {
            showCustomStatusBanner('Control Center Disabled in Apps', 1800);
          } else {
            setShowControlCenter((v) => !v);
          }
          break;
        case 'reachability':
          setReachabilityActive((r) => !r);
          break;
        case 'accessibility-shortcut':
          triggerAccessibilityShortcut();
          break;
        case 'safari':
          openApp('safari');
          break;
        case 'camera':
          openApp('camera');
          break;
      }
    },
    [
      activeApp,
      captureScreenshot,
      effectiveHaptics,
      onUpdateSettings,
      openApp,
      poweredOff,
      settings.backTapDouble,
      settings.backTapTriple,
      settings.controlCenterInApps,
      settings.flashlightOn,
      showCustomStatusBanner,
      triggerAccessibilityShortcut,
    ],
  );

  const launchSafariWithUrl = useCallback(
    (url: string) => {
      dismissAllKeyboards();
      setIsSleeping(false);
      setIsLocked(false);
      setShowControlCenter(false);
      setShowAppSwitcher(false);
      setShowAxShortcutSheet(false);
      setJiggleMode(false);
      setReachabilityActive(false);
      setActiveApp('safari');
      setRecentApps((prev) => ['safari', ...prev.filter((a) => a !== 'safari')]);
      if (safariRef.current) {
        safariRef.current.navigateToUrl(url);
      } else {
        setPendingSafariUrl(url);
      }
    },
    [dismissAllKeyboards],
  );

  const openSettingsToRoute = useCallback(
    (route: SettingsRouteId) => {
      openApp('settings');
      window.setTimeout(() => {
        settingsRef.current?.navigateToRoute(route);
      }, 28);
    },
    [openApp],
  );

  useImperativeHandle(
    ref,
    () => ({
      openUrlInSafari: (url: string) => {
        launchSafariWithUrl(url);
      },
      triggerScreenshot: () => {
        captureScreenshot();
      },
      notifyChargingStarted: () => {
        setIsSleeping(false);
        triggerTaptic('success', effectiveHaptics, !settings.silentMode);
        pulseLedAlertFlash();
        showIslandTransient('charging', 2400);
      },
      evalJavaScript: (code: string) => {
        if (activeApp !== 'safari') {
          setIsSleeping(false);
          setIsLocked(false);
          setActiveApp('safari');
        }
        window.setTimeout(() => {
          safariRef.current?.evalJavaScript(code);
        }, 40);
      },
      queryDomSelector: (selector: string) => {
        safariRef.current?.queryDomSelector(selector);
      },
      openSettingsRoute: (route: SettingsRouteId) => {
        openSettingsToRoute(route);
      },
      triggerAccessibilityShortcut: () => {
        triggerAccessibilityShortcut();
      },
      triggerBackTap: (taps: 2 | 3) => {
        executeBackTap(taps);
      },
    }),
    [
      activeApp,
      captureScreenshot,
      effectiveHaptics,
      executeBackTap,
      launchSafariWithUrl,
      openSettingsToRoute,
      pulseLedAlertFlash,
      settings.silentMode,
      showIslandTransient,
      triggerAccessibilityShortcut,
    ],
  );

  // Apply zoom ratio from Pinch-to-Zoom or Trackpad Pinch to active app
  const applyPinchZoomRatio = useCallback(
    (ratio: number) => {
      if (!Number.isFinite(ratio) || ratio <= 0) return;
      if (activeApp === 'safari') {
        safariRef.current?.setPinchZoomDelta(ratio);
      } else if (activeApp === 'photos') {
        setPhotosPinchZoom((prev) => Math.max(0.75, Math.min(3.5, prev * ratio)));
      }
    },
    [activeApp],
  );

  const isPinchSimActive = altKeyHeld || settings.pinchModeEnabled;

  // Screen-level Capacitive Touch, 500ms Haptic Long-Press & Two-Finger Pinch Handlers
  const getLocalScreenCoords = (clientX: number, clientY: number) => {
    const el = screenRef.current;
    if (!el) return { x: 0, y: 0, w: modelSpec.logicalWidth, h: modelSpec.logicalHeight };
    const rect = el.getBoundingClientRect();
    const scaleX = rect.width > 0 ? modelSpec.logicalWidth / rect.width : 1;
    const scaleY = rect.height > 0 ? modelSpec.logicalHeight / rect.height : 1;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      w: modelSpec.logicalWidth,
      h: modelSpec.logicalHeight,
    };
  };

  const handleScreenPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (poweredOff) return;
    lastActivityRef.current = Date.now();
    const { x, y, w, h } = getLocalScreenCoords(e.clientX, e.clientY);

    if (settings.eyeTrackingEnabled) {
      setGazePos({ x, y });
    }

    if (isPinchSimActive) {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const p2x = cx * 2 - x;
      const p2y = cy * 2 - y;
      prevPinchDistRef.current = Math.hypot(x - p2x, y - p2y);
      setPinchContact({ active: true, p1x: x, p1y: y, p2x, p2y, dragging: true });
      triggerTaptic('selection', effectiveHaptics, false);
      return;
    }

    pointerOriginRef.current = { x, y };
    if (settings.showTouchIndicators) {
      setTouchContact({ active: true, x, y, longPressed: false });
    }

    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      setTouchContact((prev) => (prev.active ? { ...prev, longPressed: true } : prev));
      triggerTaptic('medium', effectiveHaptics, false);
    }, 500);
  };

  const handleScreenPointerMoveCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (poweredOff) return;
    lastActivityRef.current = Date.now();
    const { x, y, w, h } = getLocalScreenCoords(e.clientX, e.clientY);

    if (settings.eyeTrackingEnabled) {
      setGazePos({ x, y });
    }

    if (settings.vehicleMotionCues && !settings.reduceMotion) {
      const nx = (x / Math.max(1, w) - 0.5) * -10;
      const ny = (y / Math.max(1, h) - 0.5) * -14;
      setMotionCueShift({ dx: nx, dy: ny });
    }

    if (isPinchSimActive) {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const p2x = cx * 2 - x;
      const p2y = cy * 2 - y;
      const dist = Math.hypot(x - p2x, y - p2y);

      if ((e.buttons & 1) === 1 && prevPinchDistRef.current && prevPinchDistRef.current > 12) {
        const ratio = dist / prevPinchDistRef.current;
        if (Math.abs(ratio - 1) > 0.012) {
          applyPinchZoomRatio(ratio);
          prevPinchDistRef.current = dist;
        }
      }
      setPinchContact({
        active: true,
        p1x: x,
        p1y: y,
        p2x,
        p2y,
        dragging: (e.buttons & 1) === 1,
      });
      return;
    }

    if (pointerOriginRef.current) {
      const moved = Math.hypot(x - pointerOriginRef.current.x, y - pointerOriginRef.current.y);
      if (moved > 10 && longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if ((e.buttons & 1) === 1 && settings.showTouchIndicators) {
        setTouchContact((prev) => (prev.active ? { ...prev, x, y } : prev));
      }
    }
  };

  const handleScreenPointerEndCapture = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerOriginRef.current = null;
    prevPinchDistRef.current = null;
    setTouchContact((prev) => ({ ...prev, active: false, longPressed: false }));
    setPinchContact((prev) => ({ ...prev, dragging: false }));
  };

  // Trackpad Pinch-to-Zoom (ctrlKey + wheel)
  const handleScreenWheelCapture = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.05 : 0.95;
      applyPinchZoomRatio(factor);
    }
  };

  // Capture focus on Native App inputs (Settings Search, Notes Title/Body) to pop out IOSKeyboard!
  const handleNativeAppFocusCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    if (activeApp === 'safari') return;
    const target = e.target;
    if (
      target instanceof HTMLInputElement &&
      target.type !== 'range' &&
      target.type !== 'checkbox' &&
      target.type !== 'radio'
    ) {
      nativeFocusedElRef.current = target;
      const isSearch =
        target.type === 'search' || target.placeholder.toLowerCase().includes('search');
      setKeyboardSession({
        source: 'native',
        inputType: isSearch ? 'search' : 'text',
        enterKeyLabel: isSearch ? 'Search' : 'Done',
        value: target.value,
        placeholder: target.placeholder || '',
        canTabPrev: false,
        canTabNext: false,
      });
    } else if (target instanceof HTMLTextAreaElement) {
      nativeFocusedElRef.current = target;
      setKeyboardSession({
        source: 'native',
        inputType: 'textarea',
        enterKeyLabel: 'Return',
        value: target.value,
        placeholder: target.placeholder || '',
        canTabPrev: false,
        canTabNext: false,
      });
    }
  };

  // Execute Configured Action Button Role (on 450ms Hold — iPhone 16 Pro)
  const executeActionButtonRole = () => {
    triggerTaptic('heavy', effectiveHaptics, !settings.silentMode);
    setIsSleeping(false);

    switch (settings.actionButtonRole) {
      case 'silent': {
        const nextSilent = !settings.silentMode;
        onUpdateSettings({ silentMode: nextSilent });
        showIslandTransient('silent', 2200);
        break;
      }
      case 'flashlight': {
        const nextFlash = !settings.flashlightOn;
        onUpdateSettings({ flashlightOn: nextFlash });
        setIslandBanner('flashlight');
        setIslandExpanded(nextFlash);
        if (!nextFlash) showIslandTransient('flashlight', 1400);
        break;
      }
      case 'camera':
        openApp('camera');
        break;
      case 'safari':
        openApp('safari');
        break;
      case 'calculator':
        openApp('calculator');
        break;
      case 'focus':
        onUpdateSettings({ focusMode: settings.focusMode === 'off' ? 'dnd' : 'off' });
        break;
      case 'accessibility':
        triggerAccessibilityShortcut();
        break;
    }
  };

  const onActionDown = () => {
    if (poweredOff) return;
    actionTriggeredRef.current = false;
    actionHoldTimerRef.current = window.setTimeout(() => {
      actionTriggeredRef.current = true;
      executeActionButtonRole();
    }, 450);
  };

  const onActionUp = () => {
    if (actionHoldTimerRef.current) {
      window.clearTimeout(actionHoldTimerRef.current);
      actionHoldTimerRef.current = null;
    }
    if (!poweredOff && !actionTriggeredRef.current) {
      triggerTaptic('rigid', effectiveHaptics, false);
      setIsSleeping(false);
      showIslandTransient('hold-hint', 1800);
    }
  };

  // Classic Physical Ring / Silent Toggle Switch (iPhone 14 Pro Max, iPhone 13, iPhone SE)
  const toggleRingSilentSwitch = () => {
    if (poweredOff) return;
    const nextSilent = !settings.silentMode;
    triggerTaptic(
      nextSilent ? 'heavy' : 'rigid',
      settings.systemHaptics && (!nextSilent || settings.hapticsPlayInSilent),
      !nextSilent,
    );
    setIsSleeping(false);
    onUpdateSettings({ silentMode: nextSilent });
    showIslandTransient('silent', 2000);
  };

  // Physical Volume Up / Down Press (with edge-bulge -> slim pill quirk!)
  const adjustVolume = (delta: number) => {
    if (poweredOff) return;
    triggerTaptic('light', effectiveHaptics, false);
    const nextVol = Math.max(0, Math.min(100, settings.mediaVolume + delta));
    onUpdateSettings({ mediaVolume: nextVol });

    if (volHudVisible) {
      setVolHudSlim(true);
    } else {
      setVolHudVisible(true);
      setVolHudSlim(false);
    }

    if (volTimeoutRef.current) window.clearTimeout(volTimeoutRef.current);
    volTimeoutRef.current = window.setTimeout(() => {
      setVolHudVisible(false);
      setVolHudSlim(false);
    }, 2000);
  };

  // Physical Right Power / Side Button (Single-Click Lock/Wake · Hold Power Off · Triple-Click Accessibility Shortcut!)
  const onPowerDown = () => {
    powerTriggeredRef.current = false;
    powerHoldTimerRef.current = window.setTimeout(() => {
      powerTriggeredRef.current = true;
      if (poweredOff) {
        triggerTaptic('heavy', true, true);
        setPoweredOff(false);
        setIsSleeping(false);
        setIsLocked(true);
      } else {
        triggerTaptic('warning', effectiveHaptics, false);
        setShowPowerOffSheet(true);
      }
    }, 700);
  };

  const onPowerUp = () => {
    if (powerHoldTimerRef.current) {
      window.clearTimeout(powerHoldTimerRef.current);
      powerHoldTimerRef.current = null;
    }
    if (poweredOff || powerTriggeredRef.current) return;

    const now = Date.now();
    const recent = [...sideClickTimesRef.current.filter((t) => now - t < 680), now];
    if (recent.length === 1) {
      wasUnlockedBeforeSideRef.current = !isLocked;
    }
    sideClickTimesRef.current = recent;

    // 3 rapid Side Button clicks -> Accessibility Shortcut / Exit Guided Access!
    if (recent.length >= 3) {
      sideClickTimesRef.current = [];
      setIsSleeping(false);
      if (wasUnlockedBeforeSideRef.current) {
        setIsLocked(false);
      }
      triggerAccessibilityShortcut();
      return;
    }

    if (isSleeping) {
      triggerTaptic('light', effectiveHaptics, false);
      setIsSleeping(false);
    } else {
      triggerTaptic(
        'lock',
        effectiveHaptics,
        !settings.silentMode && settings.lockSoundEnabled,
      );
      dismissAllKeyboards();
      setIsSleeping(true);
      setIsLocked(true);
      setShowControlCenter(false);
      setShowAppSwitcher(false);
      setReachabilityActive(false);
    }
  };

  const unlockBiometric = () => {
    triggerTaptic('success', effectiveHaptics, false);
    setIsSleeping(false);
    setIsLocked(false);
    showIslandTransient('faceid', 1300);
  };

  // Physical Touch ID Sapphire Home Button (iPhone SE 3rd Gen — Click = Home, Double = Switcher, Triple = Accessibility Shortcut!)
  const handlePhysicalHomeButtonClick = () => {
    if (poweredOff) return;
    triggerTaptic('rigid', effectiveHaptics, false);

    const now = Date.now();
    const recent = [...homeClickTimesRef.current.filter((t) => now - t < 680), now];
    homeClickTimesRef.current = recent;

    if (recent.length >= 3) {
      homeClickTimesRef.current = [];
      homeBtnLastClickRef.current = 0;
      if (homeBtnClickTimerRef.current) window.clearTimeout(homeBtnClickTimerRef.current);
      setShowAppSwitcher(false);
      triggerAccessibilityShortcut();
      return;
    }

    if (isSleeping || isLocked) {
      unlockBiometric();
      return;
    }

    if (settings.guidedAccessEnabled && activeApp !== null) {
      showCustomStatusBanner('Guided Access Enabled · Triple-Click Home to Exit', 2100);
      return;
    }

    if (now - homeBtnLastClickRef.current < 280) {
      if (homeBtnClickTimerRef.current) window.clearTimeout(homeBtnClickTimerRef.current);
      homeBtnLastClickRef.current = 0;
      dismissAllKeyboards();
      setShowControlCenter(false);
      setShowAppSwitcher((v) => !v);
      return;
    }

    homeBtnLastClickRef.current = now;
    homeBtnClickTimerRef.current = window.setTimeout(() => {
      dismissAllKeyboards();
      setReachabilityActive(false);
      if (showControlCenter) {
        setShowControlCenter(false);
      } else if (showAppSwitcher) {
        setShowAppSwitcher(false);
      } else if (activeApp !== null) {
        setActiveApp(null);
      } else if (jiggleMode) {
        setJiggleMode(false);
      }
    }, 240);
  };

  // Home Bar / Bottom-Edge Gestures
  const handleHomeBarStart = (clientX: number, clientY: number) => {
    homeBarGestureRef.current = { startX: clientX, startY: clientY, startTime: Date.now() };
  };

  const handleHomeBarEnd = (clientX: number, clientY: number) => {
    const start = homeBarGestureRef.current;
    homeBarGestureRef.current = null;
    if (!start) return;

    const dx = clientX - start.startX;
    const dy = clientY - start.startY;
    const elapsed = Date.now() - start.startTime;

    // On iPhone SE (Touch ID model), swiping UP from the bottom screen edge opens Control Center!
    if (modelSpec.hasHomeButton) {
      if (dy < -24) {
        if (activeApp !== null && !settings.controlCenterInApps) {
          showCustomStatusBanner('Control Center Disabled in Apps', 1800);
          return;
        }
        triggerTaptic('selection', effectiveHaptics, false);
        setShowControlCenter(true);
      }
      return;
    }

    if (isLocked) {
      if (dy < -24 || Math.abs(dy) < 10) {
        unlockBiometric();
      }
      return;
    }

    // Guided Access Single-App Lock Quirk!
    if (settings.guidedAccessEnabled && activeApp !== null && !showControlCenter) {
      triggerTaptic('warning', effectiveHaptics, false);
      showCustomStatusBanner('Guided Access Enabled · Triple-Click Side to Exit', 2100);
      return;
    }

    // Swipe Down on Home Bar -> One-Handed Reachability!
    if (dy > 22 && settings.reachabilityEnabled) {
      triggerTaptic('soft', effectiveHaptics, false);
      setReachabilityActive(true);
      return;
    }

    // Horizontal Swipe on Home Bar -> Cycle Recent Apps!
    if (Math.abs(dx) > 36 && Math.abs(dy) < 28 && recentApps.length > 1) {
      triggerTaptic('selection', effectiveHaptics, false);
      dismissAllKeyboards();
      const curIdx = activeApp ? recentApps.indexOf(activeApp) : 0;
      const nextIdx =
        dx < 0 ? Math.min(recentApps.length - 1, curIdx + 1) : Math.max(0, curIdx - 1);
      setActiveApp(recentApps[nextIdx]);
      return;
    }

    // Swipe Up & Pause (> 280ms) -> App Switcher
    if (dy < -25 && elapsed > 280) {
      triggerTaptic('medium', effectiveHaptics, false);
      dismissAllKeyboards();
      setShowAppSwitcher(true);
      setShowControlCenter(false);
      return;
    }

    // Crisp Swipe Up or Click -> Home Screen
    triggerTaptic('light', effectiveHaptics, false);
    dismissAllKeyboards();
    setReachabilityActive(false);
    if (showAxShortcutSheet) {
      setShowAxShortcutSheet(false);
    } else if (showControlCenter) {
      setShowControlCenter(false);
    } else if (showAppSwitcher) {
      setShowAppSwitcher(false);
    } else if (activeApp !== null) {
      setActiveApp(null);
    } else if (jiggleMode) {
      setJiggleMode(false);
    }
  };

  // Forward IOSKeyboard events to either Safari (Web Input / URL Bar) or Focused Native Input!
  const handleKeyboardInsert = (text: string) => {
    if (activeApp === 'safari') {
      safariRef.current?.sendKeyboardInsert(text);
      return;
    }
    const el = nativeFocusedElRef.current;
    if (el) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const nextVal = el.value.slice(0, start) + text + el.value.slice(end);
      setNativeInputValue(el, nextVal);
      const nextCaret = start + text.length;
      try {
        el.setSelectionRange(nextCaret, nextCaret);
      } catch {}
      setKeyboardSession((prev) => (prev ? { ...prev, value: nextVal } : null));
    }
  };

  const handleKeyboardBackspace = () => {
    if (activeApp === 'safari') {
      safariRef.current?.sendKeyboardBackspace();
      return;
    }
    const el = nativeFocusedElRef.current;
    if (el && el.value.length > 0) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      let nextVal = el.value;
      let nextCaret = start;
      if (start !== end) {
        nextVal = el.value.slice(0, start) + el.value.slice(end);
      } else if (start > 0) {
        nextVal = el.value.slice(0, start - 1) + el.value.slice(end);
        nextCaret = start - 1;
      }
      setNativeInputValue(el, nextVal);
      try {
        el.setSelectionRange(nextCaret, nextCaret);
      } catch {}
      setKeyboardSession((prev) => (prev ? { ...prev, value: nextVal } : null));
    }
  };

  const handleKeyboardEnter = () => {
    if (activeApp === 'safari') {
      safariRef.current?.sendKeyboardEnter();
      return;
    }
    const el = nativeFocusedElRef.current;
    if (el instanceof HTMLTextAreaElement) {
      handleKeyboardInsert('\n');
    } else {
      dismissAllKeyboards();
    }
  };

  const finishSpec = TITANIUM_FINISHES[settings.chassisFinish];

  // Compute True Tone + Night Shift + Brightness + Accessibility Optical Filters
  const nightWarmthOpacity = settings.nightShift ? (settings.nightShiftWarmth / 100) * 0.24 : 0;
  const trueToneOpacity = settings.trueTone ? 0.045 : 0;
  const screenBrightness = Math.max(0.32, settings.brightness / 100);
  const whitePointDimOpacity = settings.reduceWhitePoint
    ? (settings.reduceWhitePointIntensity / 100) * 0.56
    : 0;

  const colorFilterCss =
    settings.colorFilter === 'grayscale'
      ? 'grayscale(1)'
      : settings.colorFilter === 'protanopia'
        ? 'sepia(0.32) saturate(1.45) hue-rotate(-18deg)'
        : settings.colorFilter === 'deuteranopia'
          ? 'sepia(0.28) saturate(1.38) hue-rotate(22deg)'
          : settings.colorFilter === 'tritanopia'
            ? 'sepia(0.24) saturate(1.52) hue-rotate(155deg)'
            : '';

  const displayFilter = [
    `brightness(${
      (
        settings.deviceModel === 'iphone-16-pro' || settings.deviceModel === 'iphone-14-pro-max'
          ? isSleeping && settings.alwaysOnDisplay && !settings.lowPowerMode && !poweredOff
          : false
      )
        ? 0.36
        : screenBrightness
    })`,
    settings.increaseContrast ? 'contrast(1.18)' : '',
    settings.classicInvert ? 'invert(1)' : '',
    settings.smartInvert && !settings.classicInvert ? 'invert(1) hue-rotate(180deg)' : '',
    colorFilterCss,
  ]
    .filter(Boolean)
    .join(' ');

  // AOD is exclusive to Pro Always-On OLED models (16 Pro & 14 Pro Max)
  const supportsAod =
    settings.deviceModel === 'iphone-16-pro' || settings.deviceModel === 'iphone-14-pro-max';
  const isAodActive =
    supportsAod &&
    isSleeping &&
    settings.alwaysOnDisplay &&
    !settings.lowPowerMode &&
    !poweredOff;

  const isStandByActive =
    settings.standByEnabled &&
    settings.isLandscape &&
    settings.isCharging &&
    (isLocked || isSleeping) &&
    !poweredOff;

  const wallpaperSrc = settings.wallpaperId === 'titanium' ? titaniumWallpaper : auroraWallpaper;
  const shortcutSheetItems =
    settings.accessibilityShortcutTargets.length > 0
      ? ACCESSIBILITY_SHORTCUT_DEFS.filter((d) =>
          settings.accessibilityShortcutTargets.includes(d.id),
        )
      : ACCESSIBILITY_SHORTCUT_DEFS.slice(0, 6);

  return (
    <div
      className="relative flex items-center justify-center transition-transform duration-300 ease-out"
      style={{
        transform: settings.isLandscape ? 'rotate(-90deg) scale(0.84)' : 'rotate(0deg) scale(1)',
      }}
    >
      {/* =====================================================================
       * PHYSICAL LEFT RAIL CONTROLS
       * - iPhone 16 Pro: Programmable Action Button (450ms hold)
       * - iPhone 14 Pro Max / 13 / SE: Classic Mechanical Ring/Silent Switch
       * =================================================================== */}
      {modelSpec.hasActionButton ? (
        <button
          type="button"
          onMouseDown={onActionDown}
          onMouseUp={onActionUp}
          onMouseLeave={() => {
            if (actionHoldTimerRef.current) window.clearTimeout(actionHoldTimerRef.current);
          }}
          onTouchStart={onActionDown}
          onTouchEnd={onActionUp}
          title="Action Button (Tap for Hint, Hold 450ms to Trigger)"
          className="absolute -left-[6px] top-[134px] w-[6px] h-[30px] rounded-l-md active:translate-x-[2px] transition-transform cursor-pointer z-30 shadow"
          style={{ background: finishSpec.cssBandGradient }}
        />
      ) : (
        <button
          type="button"
          onClick={toggleRingSilentSwitch}
          title={`Ring / Silent Switch (${settings.silentMode ? 'Silent — Orange Showing' : 'Ring'})`}
          className="absolute -left-[6px] top-[126px] w-[6px] h-[26px] rounded-l-md active:translate-x-[2px] transition-transform cursor-pointer z-30 shadow overflow-hidden flex items-center justify-center"
          style={{
            background: settings.silentMode ? '#EA580C' : finishSpec.cssBandGradient,
          }}
        />
      )}

      <button
        type="button"
        onClick={() => adjustVolume(8)}
        title="Volume Up"
        className="absolute -left-[6px] top-[182px] w-[6px] h-[52px] rounded-l-md active:translate-x-[2px] transition-transform cursor-pointer z-30 shadow"
        style={{ background: finishSpec.cssBandGradient }}
      />

      <button
        type="button"
        onClick={() => adjustVolume(-8)}
        title="Volume Down"
        className="absolute -left-[6px] top-[246px] w-[6px] h-[52px] rounded-l-md active:translate-x-[2px] transition-transform cursor-pointer z-30 shadow"
        style={{ background: finishSpec.cssBandGradient }}
      />

      {/* =====================================================================
       * PHYSICAL RIGHT RAIL CONTROLS (Side Power + Optional Camera Control)
       * =================================================================== */}
      <button
        type="button"
        onMouseDown={onPowerDown}
        onMouseUp={onPowerUp}
        onTouchStart={onPowerDown}
        onTouchEnd={onPowerUp}
        title="Side Power Button (Click to Lock/Wake · Hold to Power Off · Triple-Click for Accessibility Shortcut)"
        className="absolute -right-[6px] top-[198px] w-[6px] h-[74px] rounded-r-md active:-translate-x-[2px] transition-transform cursor-pointer z-30 shadow"
        style={{ background: finishSpec.cssBandGradient }}
      />

      {modelSpec.hasCameraControl && (
        <button
          type="button"
          onClick={() => {
            if (poweredOff) return;
            triggerTaptic('rigid', effectiveHaptics, false);
            openApp('camera');
          }}
          title="Camera Control Sapphire Button (Click to Launch Camera)"
          className="absolute -right-[5px] top-[468px] w-[5px] h-[58px] rounded-r-sm bg-zinc-700 border-y border-white/25 active:-translate-x-[1.5px] transition-transform cursor-pointer z-30"
        />
      )}

      {/* =====================================================================
       * AUTHENTIC PER-MODEL METALLIC OUTER CHASSIS & PHYSICAL BEZEL ARCHITECTURE
       * Double-tapping the outer frame triggers Back Tap!
       * =================================================================== */}
      <div
        onDoubleClick={(e) => {
          if (e.target === e.currentTarget) {
            executeBackTap(2);
          }
        }}
        title="Double-click metallic bezel to trigger Back Tap"
        className="relative select-none transition-all duration-300"
        style={{
          borderRadius: `${modelSpec.outerRadiusPx}px`,
          padding: `${modelSpec.hasHomeButton ? 9 : 8}px`,
          background: finishSpec.cssBandGradient,
          boxShadow: alertLedStrobe
            ? `0 0 65px 18px rgba(255,250,220,0.92), inset 0 0 0 2px #FFFFFF`
            : `0 30px 90px rgba(0,0,0,0.88), inset 0 0 0 1.5px ${finishSpec.cssBorder}`,
        }}
      >
        {/* Inner Front Glass Bezel Housing */}
        <div
          className="relative bg-black flex flex-col items-center overflow-hidden transition-all duration-300"
          style={{
            borderRadius: `${Math.max(12, modelSpec.outerRadiusPx - 8)}px`,
            paddingLeft: `${modelSpec.bezelPx}px`,
            paddingRight: `${modelSpec.bezelPx}px`,
            paddingTop: modelSpec.hasHomeButton ? '0px' : `${modelSpec.bezelPx}px`,
            paddingBottom: modelSpec.hasHomeButton ? '0px' : `${modelSpec.bezelPx}px`,
          }}
        >
          {/* Classic iPhone SE Top Forehead Bezel (Front Camera + Earpiece Speaker Grille) */}
          {modelSpec.hasHomeButton && (
            <div className="w-full h-[54px] bg-black flex items-center justify-center gap-4 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-[#0d1326] border border-slate-700/60" />
              <div className="w-12 h-[5px] rounded-full bg-zinc-800 border border-white/10" />
              <div className="w-2.5 h-2.5 opacity-0" />
            </div>
          )}

          {/* =================================================================
           * EXACT LOGICAL VIEWPORT DISPLAY PANEL (393x852 / 430x932 / 390x844 / 375x667)
           * =============================================================== */}
          <div
            ref={screenRef}
            onPointerDownCapture={handleScreenPointerDownCapture}
            onPointerMoveCapture={handleScreenPointerMoveCapture}
            onPointerUpCapture={handleScreenPointerEndCapture}
            onPointerCancelCapture={handleScreenPointerEndCapture}
            onWheelCapture={handleScreenWheelCapture}
            className={`relative bg-black overflow-hidden transition-all duration-300 ${
              settings.boldText ? 'font-semibold' : ''
            }`}
            style={{
              width: `${modelSpec.logicalWidth}px`,
              height: `${modelSpec.logicalHeight}px`,
              borderRadius: `${modelSpec.screenRadiusPx}px`,
              filter: displayFilter,
            }}
          >
            {/* Wallpaper Layer (Smart Invert preserves natural photo/wallpaper colors!) */}
            <div
              className={`absolute inset-0 transition-opacity duration-300 ${
                isSleeping && (!isAodActive || !settings.aodShowWallpaper)
                  ? 'opacity-0'
                  : 'opacity-100'
              }`}
              style={{
                background:
                  settings.wallpaperId === 'titanium'
                    ? 'linear-gradient(165deg, #1b1714 0%, #3d3024 45%, #090a0d 100%)'
                    : 'linear-gradient(165deg, #0f172a 0%, #334155 48%, #fda4af 100%)',
                filter:
                  settings.smartInvert && !settings.classicInvert
                    ? 'invert(1) hue-rotate(180deg)'
                    : undefined,
              }}
            >
              <Image
                src={wallpaperSrc}
                alt="iOS 18 Wallpaper"
                fill
                priority
                sizes="440px"
                referrerPolicy="no-referrer"
                className="object-cover"
              />
            </div>

            {/* True Tone & Night Shift Ambient Color Matrix Overlay */}
            {(nightWarmthOpacity > 0 || trueToneOpacity > 0) && !poweredOff && (
              <div
                className="absolute inset-0 pointer-events-none z-[45]"
                style={{
                  backgroundColor: `rgba(255, 166, 77, ${(nightWarmthOpacity + trueToneOpacity).toFixed(3)})`,
                  mixBlendMode: 'multiply',
                }}
              />
            )}

            {/* Reduce White Point Accessibility Scrim */}
            {whitePointDimOpacity > 0 && !poweredOff && (
              <div
                className="absolute inset-0 pointer-events-none z-[46]"
                style={{
                  backgroundColor: `rgba(0, 0, 0, ${whitePointDimOpacity.toFixed(3)})`,
                }}
              />
            )}

            {/* Powered Off State */}
            {poweredOff ? (
              <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center text-zinc-600 text-xs px-8 text-center">
                <Power className="w-7 h-7 mb-2 opacity-40" />
                <span>{modelSpec.name} Powered Off — Hold Right Side Button to Boot</span>
              </div>
            ) : isSleeping && !isAodActive && !isStandByActive ? (
              <div
                onClick={() => {
                  if (!settings.tapToWake) return;
                  triggerTaptic('light', effectiveHaptics, false);
                  setIsSleeping(false);
                }}
                className={`absolute inset-0 bg-black z-40 ${
                  settings.tapToWake ? 'cursor-pointer' : 'cursor-default'
                }`}
                title={
                  settings.tapToWake
                    ? 'Tap to Wake'
                    : 'Tap to Wake is Off — Press Side or Home Button to Wake'
                }
              />
            ) : isStandByActive ? (
              /* STANDBY MODE (Landscape + Charging + Locked) */
              <div
                onClick={() => {
                  setIsSleeping(false);
                  unlockBiometric();
                }}
                className={`absolute inset-0 z-40 bg-black flex items-center justify-center cursor-pointer ${
                  settings.standByNightRed ? 'text-red-500' : 'text-amber-100'
                }`}
              >
                <div className="rotate-90 flex flex-col items-center gap-3">
                  <div className="text-xs uppercase tracking-widest opacity-60 font-medium">
                    StandBy · MagSafe {settings.batteryLevel}%
                  </div>
                  <div className="text-7xl font-bold tracking-tight tabular-nums">
                    {timeFormatted.replace(/\s?[AP]M/i, '')}
                  </div>
                  <div className="text-sm opacity-75">{dateFormatted}</div>
                </div>
              </div>
            ) : (
              /* REACHABILITY + ACCESSIBILITY ZOOM WRAPPER */
              <div className="relative w-full h-full">
                {reachabilityActive && (
                  <div
                    onClick={() => setReachabilityActive(false)}
                    className="absolute top-0 left-0 right-0 h-[36%] z-40 bg-black/85 flex items-center justify-center cursor-pointer"
                  >
                    <ChevronDownIndicator />
                  </div>
                )}

                <div
                  className={`relative w-full h-full transition-transform origin-center ${
                    settings.reduceMotion ? 'duration-75' : 'duration-300'
                  } ease-out`}
                  style={{
                    transform: `${
                      reachabilityActive ? 'translateY(36%)' : 'translateY(0%)'
                    } scale(${settings.accessibilityZoom ? settings.accessibilityZoomLevel : 1})`,
                  }}
                >
                  {/* =========================================================
                   * TOP SENSOR CUTOUT ARCHITECTURE PER IPHONE GENERATION:
                   * 1. Dynamic Island (iPhone 16 Pro & iPhone 14 Pro Max)
                   * 2. Sculpted TrueDepth Notch + Floating Pill HUD (iPhone 13)
                   * 3. Classic Top Alert Pill for Silent / Charging (iPhone SE)
                   * ======================================================= */}
                  {modelSpec.cutout === 'dynamic-island' && (
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-50 flex justify-center">
                      <div
                        onClick={() => {
                          triggerTaptic('selection', settings.systemHaptics, false);
                          if (settings.flashlightOn) {
                            setIslandBanner('flashlight');
                            setIslandExpanded((v) => !v);
                          } else if (timerRunning || timerSecondsLeft > 0) {
                            openApp('clock');
                          } else {
                            setIslandExpanded((v) => !v);
                          }
                        }}
                        className={`bg-black text-white shadow-xl border border-white/10 cursor-pointer overflow-hidden transition-all duration-300 flex items-center justify-between ${
                          islandExpanded && islandBanner === 'flashlight'
                            ? 'w-[310px] h-[126px] rounded-[34px] px-5 py-4'
                            : islandBanner === 'silent' ||
                                islandBanner === 'hold-hint' ||
                                islandBanner === 'charging' ||
                                islandBanner === 'faceid' ||
                                islandBanner === 'custom-status'
                              ? 'w-[252px] h-[38px] rounded-full px-3.5'
                              : settings.flashlightOn || timerRunning
                                ? 'w-[172px] h-[32px] rounded-full px-3'
                                : 'w-[122px] h-[34px] rounded-full px-3'
                        }`}
                      >
                        {islandExpanded && islandBanner === 'flashlight' ? (
                          <div
                            className="w-full space-y-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                                <Flashlight className="w-4 h-4" />
                                <span>Flashlight Beam</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateSettings({ flashlightOn: false });
                                  setIslandExpanded(false);
                                  setIslandBanner(null);
                                }}
                                className="px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-semibold"
                              >
                                Turn Off
                              </button>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-zinc-400">
                                <span>Intensity ({settings.flashlightIntensity}/4)</span>
                                <span>Beam Width ({settings.flashlightBeamWidth}/3)</span>
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="range"
                                  min={1}
                                  max={4}
                                  value={settings.flashlightIntensity}
                                  onChange={(e) =>
                                    onUpdateSettings({
                                      flashlightIntensity: Number(e.target.value),
                                    })
                                  }
                                  className="w-1/2 accent-amber-400"
                                />
                                <input
                                  type="range"
                                  min={1}
                                  max={3}
                                  value={settings.flashlightBeamWidth}
                                  onChange={(e) =>
                                    onUpdateSettings({
                                      flashlightBeamWidth: Number(e.target.value),
                                    })
                                  }
                                  className="w-1/2 accent-sky-400"
                                />
                              </div>
                            </div>
                          </div>
                        ) : islandBanner === 'custom-status' ? (
                          <div className="flex items-center gap-2 w-full justify-between">
                            <Accessibility className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span className="text-[11px] font-semibold text-white truncate">
                              {customBannerText}
                            </span>
                          </div>
                        ) : islandBanner === 'silent' ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              {settings.silentMode ? (
                                <BellOff className="w-4 h-4 text-rose-500" />
                              ) : (
                                <Bell className="w-4 h-4 text-white" />
                              )}
                              <span
                                className={`text-xs font-semibold ${
                                  settings.silentMode ? 'text-rose-400' : 'text-white'
                                }`}
                              >
                                {settings.silentMode ? 'Silent' : 'Ring'}
                              </span>
                            </div>
                            <span className="text-[11px] text-zinc-400">
                              {modelSpec.hasActionButton ? 'Action Button' : 'Silent Switch'}
                            </span>
                          </>
                        ) : islandBanner === 'hold-hint' ? (
                          <>
                            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-[11px] font-medium truncate">
                              Press and Hold Action Button
                            </span>
                          </>
                        ) : islandBanner === 'charging' ? (
                          <>
                            <span className="text-xs font-semibold text-[#34C759]">Charging</span>
                            <span className="text-xs font-mono tabular-nums text-[#34C759]">
                              {settings.batteryLevel}% ⚡
                            </span>
                          </>
                        ) : islandBanner === 'faceid' ? (
                          <>
                            <Lock className="w-3.5 h-3.5 text-[#34C759]" />
                            <span className="text-xs font-semibold text-[#34C759]">Unlocked</span>
                            <Check className="w-3.5 h-3.5 text-[#34C759]" />
                          </>
                        ) : timerRunning ? (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-xs font-mono tabular-nums text-amber-400">
                              {Math.floor(timerSecondsLeft / 60)}:
                              {String(timerSecondsLeft % 60).padStart(2, '0')}
                            </span>
                          </>
                        ) : settings.flashlightOn ? (
                          <>
                            <Flashlight className="w-3.5 h-3.5 text-amber-300" />
                            <span className="text-[11px] text-amber-200 font-medium">On</span>
                          </>
                        ) : (
                          <div className="w-full flex items-center justify-end pr-0.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#0e1326] border border-indigo-950/60" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* iPhone 13 Sculpted TrueDepth Top Notch */}
                  {modelSpec.cutout === 'notch' && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[158px] h-[30px] bg-black rounded-b-[18px] z-50 flex items-center justify-center gap-3 pointer-events-none">
                      <div className="w-10 h-[3.5px] rounded-full bg-zinc-800/90 -mt-1" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0d1428] border border-indigo-950/60 -mt-0.5" />
                    </div>
                  )}

                  {/* Classic iOS Top Pill Alert Banner for Non-Dynamic-Island Models (iPhone 13 & SE) */}
                  {modelSpec.cutout !== 'dynamic-island' && islandBanner && (
                    <div className="absolute top-9 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full bg-zinc-900 border border-white/15 text-white shadow-xl flex items-center gap-2 text-xs font-semibold whitespace-nowrap">
                      {islandBanner === 'custom-status' ? (
                        <>
                          <Accessibility className="w-3.5 h-3.5 text-sky-400" />
                          <span>{customBannerText}</span>
                        </>
                      ) : islandBanner === 'silent' ? (
                        <>
                          {settings.silentMode ? (
                            <BellOff className="w-3.5 h-3.5 text-rose-400" />
                          ) : (
                            <Bell className="w-3.5 h-3.5 text-white" />
                          )}
                          <span>{settings.silentMode ? 'Silent Mode · On' : 'Silent Mode · Off'}</span>
                        </>
                      ) : islandBanner === 'charging' ? (
                        <span className="text-[#34C759] tabular-nums">
                          {settings.batteryLevel}% Charged ⚡
                        </span>
                      ) : islandBanner === 'faceid' ? (
                        <span className="text-[#34C759] flex items-center gap-1.5">
                          {modelSpec.hasHomeButton ? (
                            <>
                              <Fingerprint className="w-3.5 h-3.5" />
                              <span>Touch ID Unlocked</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Face ID Unlocked</span>
                            </>
                          )}
                        </span>
                      ) : null}
                    </div>
                  )}

                  {/* =========================================================
                   * TOP STATUS BAR (Adapts between Face ID Split Ears vs SE Classic 24px Bar!)
                   * ======================================================= */}
                  <div
                    className={`absolute top-0 left-0 right-0 z-40 text-white font-semibold flex items-center justify-between ${
                      modelSpec.hasHomeButton
                        ? 'h-6 px-3 text-[11px] bg-black/25'
                        : 'h-12 px-6 text-xs'
                    }`}
                  >
                    {/* Left Slot */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerTaptic('light', settings.systemHaptics, false);
                        safariRef.current?.scrollToTop();
                        setScrollToTopSignal((s) => s + 1);
                      }}
                      className="flex items-center gap-1 min-w-[76px] h-full text-left"
                      title="Tap Status Bar to Scroll Active App to Top"
                    >
                      {modelSpec.hasHomeButton ? (
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-end gap-[1.5px] h-2">
                            <span className="w-[2px] h-1 bg-white rounded-full" />
                            <span className="w-[2px] h-1.5 bg-white rounded-full" />
                            <span className="w-[2px] h-2 bg-white rounded-full" />
                            <span className="w-[2px] h-2 bg-white rounded-full" />
                          </div>
                          <span>{settings.airplaneMode ? 'Airplane' : 'CoreTel'}</span>
                          {settings.wifiEnabled && !settings.airplaneMode && (
                            <Wifi className="w-3 h-3" />
                          )}
                        </div>
                      ) : (
                        <>
                          <span className="tabular-nums tracking-tight drop-shadow">
                            {isLocked
                              ? settings.airplaneMode
                                ? 'Airplane'
                                : 'CoreTel'
                              : timeFormatted.replace(/\s?[AP]M/i, '')}
                          </span>
                          {settings.focusMode !== 'off' && (
                            <Moon className="w-3 h-3 text-indigo-300 fill-indigo-300" />
                          )}
                        </>
                      )}
                    </button>

                    {/* Center Time Slot (Classic iPhone SE Single-Row Status Bar!) */}
                    {modelSpec.hasHomeButton && (
                      <button
                        type="button"
                        onClick={() => {
                          safariRef.current?.scrollToTop();
                          setScrollToTopSignal((s) => s + 1);
                        }}
                        className="tabular-nums font-bold"
                      >
                        {timeFormatted}
                      </button>
                    )}

                    {/* Right Slot: Signal, Wi-Fi/5G, Battery (Tap opens Control Center!) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (activeApp !== null && !settings.controlCenterInApps) {
                          triggerTaptic('warning', effectiveHaptics, false);
                          showCustomStatusBanner('Control Center Disabled in Apps', 1800);
                          return;
                        }
                        triggerTaptic('selection', effectiveHaptics, false);
                        dismissAllKeyboards();
                        setShowControlCenter((v) => !v);
                      }}
                      className="flex items-center gap-1.5 min-w-[76px] h-full justify-end"
                      title="Open Control Center"
                    >
                      {!modelSpec.hasHomeButton &&
                        (settings.airplaneMode ? (
                          <Plane className="w-3.5 h-3.5" />
                        ) : (
                          <>
                            <div className="flex items-end gap-[1.5px] h-2.5">
                              <span className="w-[2px] h-1 bg-white rounded-full" />
                              <span className="w-[2px] h-1.5 bg-white rounded-full" />
                              <span className="w-[2px] h-2 bg-white rounded-full" />
                              <span
                                className={`w-[2px] h-2.5 rounded-full ${
                                  settings.cellularEnabled ? 'bg-white' : 'bg-white/30'
                                }`}
                              />
                            </div>
                            {settings.wifiEnabled ? (
                              <Wifi className="w-3.5 h-3.5" />
                            ) : settings.cellularEnabled ? (
                              <span className="text-[9px] font-bold tracking-tighter">
                                {settings.cellularMode.split(' ')[0]}
                              </span>
                            ) : null}
                          </>
                        ))}

                      {modelSpec.hasHomeButton && settings.showBatteryPercentage && (
                        <span className="text-[10px] tabular-nums">{settings.batteryLevel}%</span>
                      )}

                      <div className="relative flex items-center">
                        <div className="w-[24px] h-[11.5px] rounded-[3.5px] border border-white/65 p-[1.5px] flex items-center relative overflow-hidden">
                          <div
                            className={`h-full rounded-[1.5px] transition-all ${
                              settings.isCharging
                                ? 'bg-[#34C759]'
                                : settings.lowPowerMode
                                  ? 'bg-[#FFD60A]'
                                  : settings.batteryLevel <= 20
                                    ? 'bg-rose-500'
                                    : 'bg-white'
                            }`}
                            style={{ width: `${settings.batteryLevel}%` }}
                          />
                          {!modelSpec.hasHomeButton && settings.showBatteryPercentage && (
                            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-extrabold text-black mix-blend-difference tabular-nums leading-none">
                              {settings.batteryLevel}
                            </span>
                          )}
                        </div>
                        <div className="w-[1.5px] h-[4px] bg-white/60 rounded-r-full ml-[1px]" />
                      </div>
                    </button>
                  </div>

                  {/* =========================================================
                   * PHYSICAL LEFT-EDGE VOLUME HUD PILL (Wide -> Slim Quirk!)
                   * ======================================================= */}
                  {volHudVisible && (
                    <div
                      className={`absolute left-2.5 top-[158px] z-50 rounded-full bg-white/85 shadow-xl overflow-hidden transition-all duration-200 flex flex-col justify-end ${
                        volHudSlim ? 'w-1.5 h-36' : 'w-3.5 h-36'
                      }`}
                    >
                      <div
                        className="w-full bg-zinc-900 transition-all duration-100"
                        style={{ height: `${settings.mediaVolume}%` }}
                      />
                    </div>
                  )}

                  {/* =========================================================
                   * MAIN OS LAYER: LOCK SCREEN vs HOME SCREEN vs ACTIVE APP
                   * ======================================================= */}
                  {isLocked || isAodActive ? (
                    <div
                      onClick={() => {
                        if (isSleeping) {
                          triggerTaptic('light', settings.systemHaptics, false);
                          setIsSleeping(false);
                        }
                      }}
                      style={{ paddingTop: `${Math.max(44, modelSpec.safeTopPx + 8)}px` }}
                      className="relative w-full h-full flex flex-col items-center justify-between pb-9 px-6 text-white z-20"
                    >
                      <div className="text-center space-y-0.5 mt-2">
                        <div className="text-sm font-medium text-white/90 drop-shadow">
                          {dateFormatted}
                        </div>
                        <div className="text-[70px] leading-none font-bold tracking-tight tabular-nums drop-shadow-md">
                          {timeFormatted.replace(/\s?[AP]M/i, '')}
                        </div>
                      </div>

                      {!isAodActive && (
                        <div className="w-full space-y-5">
                          <div
                            className={`p-3.5 rounded-2xl border text-left space-y-1 ${
                              settings.reduceTransparency
                                ? 'bg-zinc-900 border-zinc-600'
                                : 'bg-zinc-900/80 border-white/15'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] text-zinc-300">
                              <span className="font-semibold flex items-center gap-1.5">
                                <Compass className="w-3.5 h-3.5 text-sky-400" />
                                {modelSpec.shortName.toUpperCase()} · SAFARI READY
                              </span>
                              <span>Now</span>
                            </div>
                            <p className="text-xs text-white/90 leading-snug">
                              {modelSpec.hasHomeButton
                                ? 'Press Touch ID Home Button to unlock · Triple-click for Accessibility.'
                                : 'Swipe up or tap to unlock · Triple-click Side Button for Accessibility Shortcut.'}
                            </p>
                          </div>

                          <div className="flex items-center justify-between px-2">
                            {!modelSpec.hasHomeButton ? (
                              <button
                                type="button"
                                onMouseDown={() => {
                                  setPressingLockBtn('flashlight');
                                  lockCornerHoldRef.current = window.setTimeout(() => {
                                    triggerTaptic(
                                      'heavy',
                                      settings.systemHaptics,
                                      !settings.silentMode,
                                    );
                                    onUpdateSettings({ flashlightOn: !settings.flashlightOn });
                                    setPressingLockBtn(null);
                                  }, 240);
                                }}
                                onMouseUp={() => {
                                  if (lockCornerHoldRef.current)
                                    window.clearTimeout(lockCornerHoldRef.current);
                                  setPressingLockBtn(null);
                                }}
                                onTouchStart={() => {
                                  setPressingLockBtn('flashlight');
                                  lockCornerHoldRef.current = window.setTimeout(() => {
                                    triggerTaptic(
                                      'heavy',
                                      settings.systemHaptics,
                                      !settings.silentMode,
                                    );
                                    onUpdateSettings({ flashlightOn: !settings.flashlightOn });
                                    setPressingLockBtn(null);
                                  }, 240);
                                }}
                                onTouchEnd={() => {
                                  if (lockCornerHoldRef.current)
                                    window.clearTimeout(lockCornerHoldRef.current);
                                  setPressingLockBtn(null);
                                }}
                                title="Press & Hold firmly (240ms) to toggle Flashlight"
                                className={`w-12 h-12 rounded-full flex items-center justify-center border transition-transform ${
                                  pressingLockBtn === 'flashlight' ? 'scale-125' : 'scale-100'
                                } ${
                                  settings.flashlightOn
                                    ? 'bg-white text-black border-white'
                                    : 'bg-black/45 text-white border-white/20'
                                }`}
                              >
                                <Flashlight className="w-5 h-5" />
                              </button>
                            ) : (
                              <div className="w-8" />
                            )}

                            <button
                              type="button"
                              onClick={unlockBiometric}
                              className="text-xs font-medium text-white/90 hover:text-white py-2 px-3"
                            >
                              {modelSpec.hasHomeButton
                                ? 'Press Home to Unlock'
                                : 'Swipe up or tap to unlock'}
                            </button>

                            {!modelSpec.hasHomeButton ? (
                              <button
                                type="button"
                                onMouseDown={() => {
                                  setPressingLockBtn('camera');
                                  lockCornerHoldRef.current = window.setTimeout(() => {
                                    triggerTaptic(
                                      'heavy',
                                      settings.systemHaptics,
                                      !settings.silentMode,
                                    );
                                    setPressingLockBtn(null);
                                    openApp('camera');
                                  }, 240);
                                }}
                                onMouseUp={() => {
                                  if (lockCornerHoldRef.current)
                                    window.clearTimeout(lockCornerHoldRef.current);
                                  setPressingLockBtn(null);
                                }}
                                onTouchStart={() => {
                                  setPressingLockBtn('camera');
                                  lockCornerHoldRef.current = window.setTimeout(() => {
                                    triggerTaptic(
                                      'heavy',
                                      settings.systemHaptics,
                                      !settings.silentMode,
                                    );
                                    setPressingLockBtn(null);
                                    openApp('camera');
                                  }, 240);
                                }}
                                onTouchEnd={() => {
                                  if (lockCornerHoldRef.current)
                                    window.clearTimeout(lockCornerHoldRef.current);
                                  setPressingLockBtn(null);
                                }}
                                title="Press & Hold firmly (240ms) to launch Camera"
                                className={`w-12 h-12 rounded-full bg-black/45 text-white border border-white/20 flex items-center justify-center transition-transform ${
                                  pressingLockBtn === 'camera' ? 'scale-125' : 'scale-100'
                                }`}
                              >
                                <Camera className="w-5 h-5" />
                              </button>
                            ) : (
                              <div className="w-8" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : activeApp === null ? (
                    /* =========================================================
                     * iOS 18 SPRINGBOARD HOME SCREEN
                     * ======================================================= */
                    <div
                      onClick={() => {
                        if (jiggleMode) setJiggleMode(false);
                      }}
                      style={{ paddingTop: `${Math.max(36, modelSpec.safeTopPx + 4)}px` }}
                      className="relative w-full h-full flex flex-col justify-between pb-6 px-5 z-20"
                    >
                      {jiggleMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setJiggleMode(false);
                          }}
                          className="absolute top-12 right-5 px-3 py-1 rounded-full bg-white/85 text-black text-xs font-bold z-30"
                        >
                          Done
                        </button>
                      )}

                      <div className="space-y-4">
                        {/* Top Smart Widget Row */}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => openApp('safari')}
                            className={`${
                              modelSpec.hasHomeButton ? 'h-28' : 'h-36'
                            } rounded-3xl bg-zinc-950/75 border border-white/15 p-3.5 text-left text-white flex flex-col justify-between active:scale-95 transition-transform`}
                          >
                            <div className="flex items-center justify-between">
                              <Compass className="w-5 h-5 text-sky-400" />
                              <span className="text-[10px] text-zinc-400">Mobile WebKit</span>
                            </div>
                            <div>
                              <div className="text-xs font-bold leading-snug">
                                Browse Any Live URL
                              </div>
                              <div className="text-[11px] text-zinc-400 mt-0.5">
                                Auto Keyboard & Touch
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => openApp('settings')}
                            className={`${
                              modelSpec.hasHomeButton ? 'h-28' : 'h-36'
                            } rounded-3xl bg-zinc-950/75 border border-white/15 p-3.5 text-left text-white flex flex-col justify-between active:scale-95 transition-transform`}
                          >
                            <div className="flex items-center justify-between">
                              <Battery className="w-5 h-5 text-[#34C759]" />
                              <span className="text-xs font-mono tabular-nums font-bold">
                                {settings.batteryLevel}%
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-xs font-semibold truncate">{modelSpec.name}</div>
                              <div className="text-[10px] text-zinc-400 font-mono tabular-nums">
                                {modelSpec.logicalWidth}×{modelSpec.logicalHeight} @{modelSpec.dpr}x
                              </div>
                            </div>
                          </button>
                        </div>

                        {/* App Icon Grid (Hold 500ms for Jiggle Mode!) */}
                        <div className="grid grid-cols-4 gap-x-3 gap-y-3.5">
                          {NATIVE_APP_DEFS.map((app) => {
                            const IconComp = app.Icon;
                            return (
                              <button
                                key={app.id}
                                type="button"
                                onMouseDown={() => {
                                  iconLongPressRef.current = window.setTimeout(() => {
                                    triggerTaptic('medium', settings.systemHaptics, false);
                                    setJiggleMode(true);
                                  }, 500);
                                }}
                                onMouseUp={() => {
                                  if (iconLongPressRef.current)
                                    window.clearTimeout(iconLongPressRef.current);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!jiggleMode) openApp(app.id);
                                }}
                                className={`flex flex-col items-center gap-1 group ${
                                  jiggleMode ? 'animate-ios-jiggle' : ''
                                }`}
                              >
                                <div
                                  className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center shadow-md group-active:scale-90 transition-transform"
                                  style={{ background: app.bg, color: app.fg }}
                                >
                                  <IconComp className="w-7 h-7" />
                                </div>
                                <span className="text-[11px] font-medium text-white drop-shadow truncate w-full text-center">
                                  {app.label}
                                </span>
                              </button>
                            );
                          })}

                          {/* User-Added Safari Web Clips ("Add to Home Screen"!) */}
                          {webClips.map((clip) => (
                            <div
                              key={clip.id}
                              className={`relative flex flex-col items-center gap-1 ${
                                jiggleMode ? 'animate-ios-jiggle' : ''
                              }`}
                            >
                              {jiggleMode && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveWebClip(clip.id);
                                  }}
                                  className="absolute -top-1.5 left-1 w-5 h-5 rounded-full bg-zinc-300 text-black flex items-center justify-center text-xs font-bold z-20"
                                >
                                  −
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (jiggleMode) return;
                                  launchSafariWithUrl(clip.url);
                                }}
                                className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center text-white font-bold text-lg shadow-md"
                                style={{ backgroundColor: clip.accentColor }}
                              >
                                <Globe className="w-6 h-6" />
                              </button>
                              <span className="text-[11px] font-medium text-white drop-shadow truncate w-full text-center">
                                {clip.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* iOS Home Dock (Solid opaque when Reduce Transparency is On) */}
                      <div
                        className={`${
                          modelSpec.hasHomeButton ? 'h-[74px] rounded-[24px]' : 'h-[82px] rounded-[30px]'
                        } ${
                          settings.reduceTransparency
                            ? 'bg-zinc-900 border-zinc-600'
                            : 'bg-white/20 border-white/15'
                        } border px-4 flex items-center justify-around`}
                      >
                        {(['safari', 'settings', 'camera', 'notes'] as IOSAppId[]).map((dockId) => {
                          const def = NATIVE_APP_DEFS.find((d) => d.id === dockId)!;
                          const DockIcon = def.Icon;
                          return (
                            <button
                              key={dockId}
                              type="button"
                              onClick={() => openApp(dockId)}
                              className="w-[54px] h-[54px] rounded-[14px] flex items-center justify-center shadow-md active:scale-90 transition-transform"
                              style={{ background: def.bg, color: def.fg }}
                              title={def.label}
                            >
                              <DockIcon className="w-7 h-7" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* =========================================================
                     * ACTIVE FULL-SCREEN APP CONTAINER (shrinks above Keyboard when open!)
                     * ======================================================= */
                    <div
                      onFocusCapture={handleNativeAppFocusCapture}
                      className="relative w-full h-full z-20 flex flex-col"
                      style={{
                        paddingBottom: keyboardSession
                          ? modelSpec.hasHomeButton
                            ? '242px'
                            : '264px'
                          : '0px',
                      }}
                    >
                      {activeApp === 'safari' && (
                        <SafariApp
                          ref={safariRef}
                          settings={settings}
                          onUpdateSettings={onUpdateSettings}
                          onAddWebClip={onAddWebClip}
                          initialPendingUrl={pendingSafariUrl}
                          onConsumeInitialUrl={() => setPendingSafariUrl(null)}
                          inspectElementActive={inspectElementActive}
                          onKeyboardSessionChange={setKeyboardSession}
                          onConsoleEntry={onConsoleEntry}
                          onDomTreeUpdate={onDomTreeUpdate}
                          onElementSelected={onElementSelected}
                          onNetworkEntry={onNetworkEntry}
                        />
                      )}
                      {activeApp === 'settings' && (
                        <div
                          className="w-full h-full flex flex-col"
                          style={{
                            zoom: settings.textScale !== 1 ? settings.textScale : undefined,
                          }}
                        >
                          <SettingsApp
                            ref={settingsRef}
                            settings={settings}
                            onUpdate={onUpdateSettings}
                            scrollToTopSignal={scrollToTopSignal}
                          />
                        </div>
                      )}
                      {activeApp === 'calculator' && <CalculatorApp settings={settings} />}
                      {activeApp === 'clock' && (
                        <ClockApp
                          settings={settings}
                          timerSecondsLeft={timerSecondsLeft}
                          timerRunning={timerRunning}
                          onStartTimer={(sec) => {
                            setTimerSecondsLeft(sec);
                            setTimerRunning(true);
                          }}
                          onPauseTimer={() => setTimerRunning(false)}
                          onCancelTimer={() => {
                            setTimerRunning(false);
                            setTimerSecondsLeft(0);
                          }}
                        />
                      )}
                      {activeApp === 'notes' && (
                        <div
                          className="w-full h-full flex flex-col"
                          style={{
                            zoom: settings.textScale !== 1 ? settings.textScale : undefined,
                          }}
                        >
                          <NotesApp
                            settings={settings}
                            notes={notes}
                            onUpdateNotes={onUpdateNotes}
                          />
                        </div>
                      )}
                      {activeApp === 'camera' && (
                        <CameraApp settings={settings} onCapturePhoto={onAddPhoto} />
                      )}
                      {activeApp === 'photos' && (
                        <PhotosApp
                          settings={settings}
                          photos={photos}
                          pinchZoomScale={photosPinchZoom}
                          onResetPinchZoom={() => setPhotosPinchZoom(1)}
                        />
                      )}
                    </div>
                  )}

                  {/* =========================================================
                   * POP-OUT iOS SOFTWARE KEYBOARD (Identical on Web Inputs & Native Inputs!)
                   * ======================================================= */}
                  {keyboardSession && !isLocked && !isSleeping && (
                    <IOSKeyboard
                      session={keyboardSession}
                      settings={settings}
                      hasHomeIndicator={!modelSpec.hasHomeButton}
                      onInsertText={handleKeyboardInsert}
                      onBackspace={handleKeyboardBackspace}
                      onEnter={handleKeyboardEnter}
                      onTabField={(dir) => safariRef.current?.sendKeyboardTabField(dir)}
                      onDismiss={dismissAllKeyboards}
                    />
                  )}

                  {/* =========================================================
                   * CAPACITIVE TOUCH RIPPLE, LONG-PRESS RING & 2-FINGER PINCH OVERLAY
                   * ======================================================= */}
                  {touchContact.active && settings.showTouchIndicators && !isPinchSimActive && (
                    <div
                      className="pointer-events-none absolute z-[55] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                      style={{ left: `${touchContact.x}px`, top: `${touchContact.y}px` }}
                    >
                      <div
                        className={`rounded-full border-2 transition-all duration-150 ${
                          touchContact.longPressed
                            ? 'w-14 h-14 bg-sky-400/25 border-sky-300 scale-110'
                            : 'w-9 h-9 bg-white/25 border-white/80'
                        }`}
                      />
                    </div>
                  )}

                  {isPinchSimActive && pinchContact.active && (
                    <div className="pointer-events-none absolute inset-0 z-[56]">
                      {/* Focal center crosshair */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                      {/* Finger 1 */}
                      <div
                        className={`absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                          pinchContact.dragging
                            ? 'bg-blue-500/35 border-blue-300 scale-105'
                            : 'bg-white/20 border-white/75'
                        }`}
                        style={{ left: `${pinchContact.p1x}px`, top: `${pinchContact.p1y}px` }}
                      />
                      {/* Mirrored Finger 2 */}
                      <div
                        className={`absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                          pinchContact.dragging
                            ? 'bg-blue-500/35 border-blue-300 scale-105'
                            : 'bg-white/20 border-white/75'
                        }`}
                        style={{ left: `${pinchContact.p2x}px`, top: `${pinchContact.p2y}px` }}
                      />
                    </div>
                  )}

                  {/* =========================================================
                   * iOS 18 VEHICLE MOTION CUES (Edge Inertial Dots)
                   * ======================================================= */}
                  {settings.vehicleMotionCues && (
                    <div className="pointer-events-none absolute inset-0 z-[53] overflow-hidden">
                      {[18, 38, 60, 80].map((topPct) => (
                        <React.Fragment key={topPct}>
                          <div
                            className="absolute left-2.5 w-2.5 h-2.5 rounded-full bg-white border border-zinc-900 shadow transition-transform duration-150 ease-out"
                            style={{
                              top: `${topPct}%`,
                              transform: `translate(${motionCueShift.dx.toFixed(1)}px, ${motionCueShift.dy.toFixed(1)}px)`,
                            }}
                          />
                          <div
                            className="absolute right-2.5 w-2.5 h-2.5 rounded-full bg-white border border-zinc-900 shadow transition-transform duration-150 ease-out"
                            style={{
                              top: `${topPct}%`,
                              transform: `translate(${motionCueShift.dx.toFixed(1)}px, ${motionCueShift.dy.toFixed(1)}px)`,
                            }}
                          />
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {/* =========================================================
                   * iOS 18 EYE TRACKING GAZE POINTER RETICLE
                   * ======================================================= */}
                  {settings.eyeTrackingEnabled && (
                    <div
                      className="pointer-events-none absolute z-[54] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-75"
                      style={{ left: `${gazePos.x}px`, top: `${gazePos.y}px` }}
                    >
                      <div className="w-8 h-8 rounded-full border-2 border-cyan-300/90 bg-cyan-400/15 flex items-center justify-center shadow">
                        <Eye className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  )}

                  {/* =========================================================
                   * iOS 18 CONTROL CENTER OVERLAY
                   * ======================================================= */}
                  {showControlCenter && (
                    <div
                      onClick={() => setShowControlCenter(false)}
                      style={{ paddingTop: `${Math.max(36, modelSpec.safeTopPx + 4)}px` }}
                      className={`absolute inset-0 z-[49] ${
                        settings.reduceTransparency ? 'bg-zinc-950' : 'bg-zinc-950/94'
                      } text-white px-5 pb-9 flex flex-col justify-between`}
                    >
                      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-3xl bg-zinc-900 border border-white/10 p-3 grid grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSettings({
                                  airplaneMode: !settings.airplaneMode,
                                  wifiEnabled: settings.airplaneMode,
                                  cellularEnabled: settings.airplaneMode,
                                })
                              }
                              className={`h-11 rounded-full flex items-center justify-center ${
                                settings.airplaneMode
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}
                              title="Airplane Mode"
                            >
                              <Plane className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSettings({
                                  wifiEnabled: !settings.wifiEnabled,
                                  airplaneMode: false,
                                })
                              }
                              className={`h-11 rounded-full flex items-center justify-center ${
                                settings.wifiEnabled && !settings.airplaneMode
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}
                              title="Wi-Fi"
                            >
                              <Wifi className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSettings({ bluetoothEnabled: !settings.bluetoothEnabled })
                              }
                              className={`h-11 rounded-full flex items-center justify-center ${
                                settings.bluetoothEnabled
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}
                              title="Bluetooth"
                            >
                              <Bluetooth className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSettings({
                                  cellularEnabled: !settings.cellularEnabled,
                                  airplaneMode: false,
                                })
                              }
                              className={`h-11 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                settings.cellularEnabled && !settings.airplaneMode
                                  ? 'bg-[#34C759] text-white'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}
                              title="Cellular Data"
                            >
                              5G
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-3xl bg-zinc-900 border border-white/10 relative overflow-hidden flex flex-col justify-end h-28">
                              <div
                                className="w-full bg-white transition-all"
                                style={{ height: `${settings.brightness}%` }}
                              />
                              <input
                                type="range"
                                min={25}
                                max={100}
                                value={settings.brightness}
                                onChange={(e) =>
                                  onUpdateSettings({ brightness: Number(e.target.value) })
                                }
                                className="absolute inset-0 opacity-0 cursor-ns-resize"
                                title="Display Brightness"
                              />
                              <Sun className="w-4 h-4 text-zinc-500 mix-blend-difference absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none" />
                            </div>

                            <div className="rounded-3xl bg-zinc-900 border border-white/10 relative overflow-hidden flex flex-col justify-end h-28">
                              <div
                                className="w-full bg-white transition-all"
                                style={{ height: `${settings.mediaVolume}%` }}
                              />
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={settings.mediaVolume}
                                onChange={(e) =>
                                  onUpdateSettings({ mediaVolume: Number(e.target.value) })
                                }
                                className="absolute inset-0 opacity-0 cursor-ns-resize"
                                title="Volume"
                              />
                              {settings.mediaVolume === 0 ? (
                                <VolumeX className="w-4 h-4 text-zinc-500 mix-blend-difference absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none" />
                              ) : (
                                <Volume2 className="w-4 h-4 text-zinc-500 mix-blend-difference absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none" />
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSettings({ flashlightOn: !settings.flashlightOn })
                            }
                            className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-1 border border-white/10 ${
                              settings.flashlightOn ? 'bg-white text-black' : 'bg-zinc-900 text-white'
                            }`}
                          >
                            <Flashlight className="w-4 h-4" />
                            <span className="text-[9px] font-medium">Torch</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSettings({ orientationLocked: !settings.orientationLocked })
                            }
                            className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-1 border border-white/10 ${
                              settings.orientationLocked
                                ? 'bg-rose-500 text-white'
                                : 'bg-zinc-900 text-white'
                            }`}
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span className="text-[9px] font-medium">Lock Rot</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSettings({ lowPowerMode: !settings.lowPowerMode })
                            }
                            className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-1 border border-white/10 ${
                              settings.lowPowerMode
                                ? 'bg-[#FFD60A] text-black'
                                : 'bg-zinc-900 text-white'
                            }`}
                          >
                            <Battery className="w-4 h-4" />
                            <span className="text-[9px] font-medium">Low Pwr</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onUpdateSettings({ darkMode: !settings.darkMode })}
                            className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-1 border border-white/10 ${
                              settings.darkMode ? 'bg-indigo-600 text-white' : 'bg-white text-black'
                            }`}
                          >
                            <Moon className="w-4 h-4" />
                            <span className="text-[9px] font-medium">Dark</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSettings({
                                focusMode: settings.focusMode === 'off' ? 'dnd' : 'off',
                              })
                            }
                            className={`p-3 rounded-2xl flex items-center gap-2.5 border border-white/10 text-xs font-medium ${
                              settings.focusMode !== 'off'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-zinc-900 text-zinc-200'
                            }`}
                          >
                            <Moon className="w-4 h-4 shrink-0" />
                            <span>{settings.focusMode === 'off' ? 'Focus' : 'DND On'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onUpdateSettings({ nightShift: !settings.nightShift })}
                            className={`p-3 rounded-2xl flex items-center gap-2.5 border border-white/10 text-xs font-medium ${
                              settings.nightShift
                                ? 'bg-amber-500 text-black'
                                : 'bg-zinc-900 text-zinc-200'
                            }`}
                          >
                            <Sun className="w-4 h-4 shrink-0" />
                            <span>Night Shift</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-5 gap-2">
                          <button
                            type="button"
                            onClick={() => openApp('calculator')}
                            className="h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center"
                            title="Calculator"
                          >
                            <Calculator className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openApp('clock')}
                            className="h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center"
                            title="Timer"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openApp('camera')}
                            className="h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center"
                            title="Camera"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSettings({ backgroundSounds: !settings.backgroundSounds })
                            }
                            className={`h-12 rounded-2xl border border-white/10 flex items-center justify-center ${
                              settings.backgroundSounds
                                ? 'bg-sky-500 text-white'
                                : 'bg-zinc-900 text-white'
                            }`}
                            title="Hearing · Background Sounds"
                          >
                            <Ear className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowControlCenter(false);
                              setShowAxShortcutSheet(true);
                            }}
                            className="h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-sky-400"
                            title="Accessibility Shortcuts"
                          >
                            <Accessibility className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="text-center text-[11px] text-zinc-400">
                        {modelSpec.hasHomeButton
                          ? 'Tap empty space or press Home Button to dismiss'
                          : 'Tap empty space or swipe Home Bar to dismiss'}
                      </div>
                    </div>
                  )}

                  {/* =========================================================
                   * MULTITASKING APP SWITCHER
                   * ======================================================= */}
                  {showAppSwitcher && (
                    <div
                      onClick={() => setShowAppSwitcher(false)}
                      className="absolute inset-0 z-[49] bg-black/88 px-6 pt-16 pb-12 flex flex-col justify-between text-white"
                    >
                      <div className="text-xs font-semibold text-zinc-300 text-center">
                        App Switcher · Tap Card to Open or X to Force-Quit
                      </div>
                      <div
                        className="flex gap-4 overflow-x-auto py-4 snap-x no-scrollbar"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {recentApps.length === 0 ? (
                          <div className="w-full text-center text-xs text-zinc-400 py-20">
                            No Recent Apps Open
                          </div>
                        ) : (
                          recentApps.map((appId) => {
                            const def = NATIVE_APP_DEFS.find((d) => d.id === appId)!;
                            const CardIcon = def.Icon;
                            return (
                              <div
                                key={appId}
                                onClick={() => openApp(appId)}
                                className="min-w-[205px] h-[340px] rounded-3xl bg-zinc-900 border border-white/15 p-4 flex flex-col justify-between snap-center cursor-pointer shrink-0 active:scale-95 transition-transform"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-6 h-6 rounded-md flex items-center justify-center"
                                      style={{ background: def.bg, color: def.fg }}
                                    >
                                      <CardIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs font-semibold">{def.label}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerTaptic('rigid', settings.systemHaptics, false);
                                      const next = recentApps.filter((r) => r !== appId);
                                      setRecentApps(next);
                                      if (activeApp === appId) setActiveApp(null);
                                      if (next.length === 0) setShowAppSwitcher(false);
                                    }}
                                    className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-rose-500/40"
                                    title="Force Quit App"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="flex-1 my-3 rounded-2xl bg-zinc-950 border border-white/5 flex items-center justify-center">
                                  <CardIcon className="w-10 h-10 opacity-30" />
                                </div>
                                <div className="text-[10px] text-zinc-400 text-center">
                                  Active in Memory
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="h-2" />
                    </div>
                  )}

                  {/* ASSISTIVETOUCH PUCK */}
                  {settings.assistiveTouchEnabled && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          triggerTaptic('selection', settings.systemHaptics, false);
                          setPuckMenuOpen((o) => !o);
                        }}
                        style={{
                          top: `${puckPos.yPct}%`,
                          left: puckPos.side === 'left' ? '10px' : undefined,
                          right: puckPos.side === 'right' ? '10px' : undefined,
                        }}
                        className="absolute z-50 w-12 h-12 rounded-2xl bg-zinc-900/80 border border-white/25 flex items-center justify-center shadow-lg active:scale-95"
                        title="AssistiveTouch"
                      >
                        <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-white/90" />
                        </div>
                      </button>

                      {puckMenuOpen && (
                        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 z-50 rounded-3xl bg-zinc-900/95 border border-white/15 p-4 grid grid-cols-3 gap-3 text-white text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              dismissAllKeyboards();
                              setActiveApp(null);
                              setIsLocked(false);
                              setPuckMenuOpen(false);
                            }}
                            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10"
                          >
                            <Smartphone className="w-5 h-5" />
                            <span>Home</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowControlCenter(true);
                              setPuckMenuOpen(false);
                            }}
                            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10"
                          >
                            <Settings className="w-5 h-5" />
                            <span>Control</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPuckMenuOpen(false);
                              captureScreenshot();
                            }}
                            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10"
                          >
                            <Camera className="w-5 h-5" />
                            <span>Screenshot</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReachabilityActive((r) => !r);
                              setPuckMenuOpen(false);
                            }}
                            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10"
                          >
                            <Maximize2 className="w-5 h-5" />
                            <span>Reach</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPuckPos((p) => ({
                                ...p,
                                side: p.side === 'left' ? 'right' : 'left',
                              }));
                            }}
                            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10"
                          >
                            <RotateCcw className="w-5 h-5" />
                            <span>Snap Side</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPuckMenuOpen(false)}
                            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10 text-zinc-400"
                          >
                            <X className="w-5 h-5" />
                            <span>Close</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* =========================================================
                   * TRIPLE-CLICK ACCESSIBILITY SHORTCUT ACTION SHEET (1:1 iOS)
                   * ======================================================= */}
                  {showAxShortcutSheet && (
                    <div
                      onClick={() => setShowAxShortcutSheet(false)}
                      className="absolute inset-0 z-50 bg-black/60 flex flex-col justify-end p-3 text-white"
                    >
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-3xl bg-zinc-900 border border-white/15 overflow-hidden shadow-2xl mb-2"
                      >
                        <div className="px-4 py-3 border-b border-white/10 text-center">
                          <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                            <Accessibility className="w-3.5 h-3.5 text-sky-400" />
                            <span>Accessibility Shortcuts</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            Triple-click {modelSpec.hasHomeButton ? 'Home' : 'Side'} Button to toggle
                          </div>
                        </div>
                        <div className="max-h-[260px] overflow-y-auto divide-y divide-white/10">
                          {shortcutSheetItems.map((item) => {
                            const active = isShortcutTargetActive(item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleShortcutTarget(item.id)}
                                className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
                              >
                                <span className="text-xs font-medium text-white">{item.label}</span>
                                <span
                                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                    active
                                      ? 'bg-sky-500 text-white'
                                      : 'border border-white/25 text-transparent'
                                  }`}
                                >
                                  <Check className="w-3 h-3" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAxShortcutSheet(false);
                            openSettingsToRoute('ax-shortcut');
                          }}
                          className="w-full px-4 py-2.5 border-t border-white/10 text-[11px] font-semibold text-sky-400 hover:bg-white/5 text-center"
                        >
                          Configure Shortcut in Settings…
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAxShortcutSheet(false)}
                        className="w-full py-3 rounded-2xl bg-zinc-900 border border-white/15 text-xs font-bold text-sky-400"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* FLOATING ZOOM LENS CONTROLLER (When Accessibility Zoom is Active) */}
                  {settings.accessibilityZoom && (
                    <div className="absolute bottom-10 right-3 z-50 flex items-center gap-1 rounded-full bg-zinc-900 border border-white/20 px-2.5 py-1.5 shadow-xl text-white text-[10px]">
                      <ZoomIn className="w-3 h-3 text-sky-400" />
                      <button
                        type="button"
                        onClick={() => {
                          const levels = [1.25, 1.5, 1.8, 2.2];
                          const idx = levels.findIndex(
                            (l) => Math.abs(l - settings.accessibilityZoomLevel) < 0.1,
                          );
                          const next = levels[(idx + 1) % levels.length];
                          onUpdateSettings({ accessibilityZoomLevel: next });
                        }}
                        className="font-mono tabular-nums font-bold px-1 hover:text-sky-300"
                        title="Cycle Zoom Magnification"
                      >
                        {settings.accessibilityZoomLevel.toFixed(2)}×
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ accessibilityZoom: false })}
                        className="px-1.5 py-0.5 rounded-full bg-white/15 hover:bg-white/25 font-semibold"
                      >
                        Off
                      </button>
                    </div>
                  )}

                  {/* SLIDE TO POWER OFF SHEET */}
                  {showPowerOffSheet && (
                    <div className="absolute inset-0 z-50 bg-black/90 text-white flex flex-col items-center justify-between py-16 px-8">
                      <button
                        type="button"
                        onClick={() => {
                          triggerTaptic('heavy', settings.systemHaptics, false);
                          dismissAllKeyboards();
                          setShowPowerOffSheet(false);
                          setPoweredOff(true);
                        }}
                        className="w-full py-3.5 rounded-full bg-rose-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg"
                      >
                        <Power className="w-4 h-4" />
                        <span>Tap to Power Off {modelSpec.shortName}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowPowerOffSheet(false)}
                        className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* SCREENSHOT FLASH & BOTTOM-LEFT THUMBNAIL */}
                  {screenshotFlash && (
                    <div className="absolute inset-0 bg-white z-50 pointer-events-none" />
                  )}

                  {screenshotThumb && (
                    <button
                      type="button"
                      onClick={() => {
                        setScreenshotThumb(null);
                        openApp('photos');
                      }}
                      className="absolute bottom-8 left-4 z-50 w-16 h-28 rounded-xl border-2 border-white shadow-2xl overflow-hidden flex flex-col justify-end p-1.5 text-left text-white animate-in fade-in slide-in-from-bottom-3"
                      style={{ background: screenshotThumb.accentGradient }}
                      title="Open Screenshot in Photos"
                    >
                      <span className="text-[8px] font-bold leading-tight">Saved to Photos</span>
                    </button>
                  )}

                  {/* =========================================================
                   * BOTTOM GESTURE ZONE:
                   * - Face ID Models: Home Indicator Bar (Swipe Up / Hold / Down / L-R)
                   * - iPhone SE: Bottom-Edge Swipe-Up Zone for Control Center!
                   * ======================================================= */}
                  <div
                    onMouseDown={(e) => handleHomeBarStart(e.clientX, e.clientY)}
                    onMouseUp={(e) => handleHomeBarEnd(e.clientX, e.clientY)}
                    onTouchStart={(e) =>
                      handleHomeBarStart(e.touches[0].clientX, e.touches[0].clientY)
                    }
                    onTouchEnd={(e) => {
                      if (e.changedTouches[0]) {
                        handleHomeBarEnd(
                          e.changedTouches[0].clientX,
                          e.changedTouches[0].clientY,
                        );
                      }
                    }}
                    className={`absolute bottom-0 left-0 right-0 z-50 flex items-center justify-center cursor-pointer group ${
                      modelSpec.hasHomeButton ? 'h-4' : 'h-7'
                    }`}
                    title={
                      modelSpec.hasHomeButton
                        ? 'Swipe Up from bottom screen edge for Control Center'
                        : 'Click or Swipe Up for Home · Swipe Up & Hold for App Switcher · Swipe Down for Reachability · Swipe Left/Right to Switch Apps'
                    }
                  >
                    {!modelSpec.hasHomeButton && (
                      <div
                        className={`w-32 h-[5px] rounded-full transition-transform group-active:scale-x-105 ${
                          activeApp &&
                          !settings.darkMode &&
                          !keyboardSession &&
                          activeApp !== 'calculator' &&
                          activeApp !== 'clock' &&
                          activeApp !== 'camera'
                            ? 'bg-zinc-900/80'
                            : 'bg-white/90'
                        }`}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* =================================================================
           * CLASSIC iPHONE SE BOTTOM CHIN BEZEL + PHYSICAL TOUCH ID HOME BUTTON
           * =============================================================== */}
          {modelSpec.hasHomeButton && (
            <div className="w-full h-[58px] bg-black flex items-center justify-center shrink-0">
              <button
                type="button"
                onClick={handlePhysicalHomeButtonClick}
                onDoubleClick={(e) => {
                  e.preventDefault();
                }}
                title="Touch ID Sapphire Home Button (Click for Home / Unlock · Double-Click for App Switcher)"
                className="w-[44px] h-[44px] rounded-full bg-gradient-to-b from-zinc-950 to-zinc-900 flex items-center justify-center active:scale-95 transition-transform shadow-inner cursor-pointer"
                style={{
                  boxShadow: `inset 0 1px 4px rgba(0,0,0,0.9), 0 0 0 2px ${finishSpec.cssBorder}`,
                }}
              >
                <div className="w-[38px] h-[38px] rounded-full border border-white/10" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default IPhoneDevice;

function ChevronDownIndicator() {
  return (
    <div className="flex flex-col items-center gap-1 text-zinc-400 text-xs">
      <div className="w-8 h-1 rounded-full bg-zinc-600" />
      <span>Tap to exit Reachability</span>
    </div>
  );
}

function subscribeWallClock(callback: () => void): () => void {
  const id = window.setInterval(callback, 5000);
  return () => window.clearInterval(id);
}

function getClientWallClockSnapshot(): string {
  const now = new Date();
  const time = now.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const date = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return `${time}|${date}`;
}

function getServerWallClockSnapshot(): string {
  return '9:41 AM|Tuesday, September 9';
}
