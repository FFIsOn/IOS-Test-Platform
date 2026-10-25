'use client';

import React, { useMemo, useState } from 'react';
import {
  Accessibility,
  ArrowUpRight,
  Hand,
  Search,
  Sliders,
  Smartphone,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type {
  BackTapAction,
  ColorFilterMode,
  IOSSystemSettings,
  SettingsRouteId,
} from '@/lib/core/iosState';
import { triggerTaptic } from '@/lib/core/hardwareMemory';

interface HoverOptionsLegendProps {
  settings: IOSSystemSettings;
  onUpdateSettings: (patch: Partial<IOSSystemSettings>) => void;
  onOpenSettingsRoute: (route: SettingsRouteId) => void;
  onTriggerAccessibilityShortcut: () => void;
  onTriggerBackTap: (taps: 2 | 3) => void;
  onTriggerScreenshot: () => void;
}

interface LegendOptionItem {
  id: string;
  category: 'Accessibility Vision' | 'Motor, Motion & Hearing' | 'Display & System' | 'Quirks & Hardware';
  label: string;
  hint: string;
  statusText: string;
  isActive: boolean;
  settingsRoute?: SettingsRouteId;
  onToggle: () => void;
}

const COLOR_FILTER_CYCLE: ColorFilterMode[] = [
  'none',
  'grayscale',
  'protanopia',
  'deuteranopia',
  'tritanopia',
];

const COLOR_FILTER_LABELS: Record<ColorFilterMode, string> = {
  none: 'Off',
  grayscale: 'Gray',
  protanopia: 'Red/Grn',
  deuteranopia: 'Grn/Red',
  tritanopia: 'Blu/Yel',
};

const BACK_TAP_CYCLE: BackTapAction[] = [
  'accessibility-shortcut',
  'screenshot',
  'flashlight',
  'control-center',
  'reachability',
  'camera',
  'safari',
  'none',
];

const BACK_TAP_SHORT: Record<BackTapAction, string> = {
  none: 'Off',
  screenshot: 'Shot',
  flashlight: 'Torch',
  'control-center': 'Ctrl Ctr',
  reachability: 'Reach',
  'accessibility-shortcut': 'AX Menu',
  safari: 'Safari',
  camera: 'Camera',
};

export default function HoverOptionsLegend({
  settings,
  onUpdateSettings,
  onOpenSettingsRoute,
  onTriggerAccessibilityShortcut,
  onTriggerBackTap,
  onTriggerScreenshot,
}: HoverOptionsLegendProps) {
  const [query, setQuery] = useState<string>('');

  const items: LegendOptionItem[] = useMemo(
    () => [
      // 1. Accessibility Vision & Display
      {
        id: 'smart-invert',
        category: 'Accessibility Vision',
        label: 'Smart Invert',
        hint: 'Inverts UI colors while preserving wallpapers & media',
        statusText: settings.smartInvert ? 'On' : 'Off',
        isActive: settings.smartInvert,
        settingsRoute: 'ax-display',
        onToggle: () =>
          onUpdateSettings({ smartInvert: !settings.smartInvert, classicInvert: false }),
      },
      {
        id: 'classic-invert',
        category: 'Accessibility Vision',
        label: 'Classic Invert',
        hint: 'Reverses every pixel across the OLED display',
        statusText: settings.classicInvert ? 'On' : 'Off',
        isActive: settings.classicInvert,
        settingsRoute: 'ax-display',
        onToggle: () =>
          onUpdateSettings({ classicInvert: !settings.classicInvert, smartInvert: false }),
      },
      {
        id: 'color-filters',
        category: 'Accessibility Vision',
        label: 'Color Filters',
        hint: 'Cycles Grayscale, Protanopia, Deuteranopia & Tritanopia',
        statusText: COLOR_FILTER_LABELS[settings.colorFilter],
        isActive: settings.colorFilter !== 'none',
        settingsRoute: 'ax-display',
        onToggle: () => {
          const idx = COLOR_FILTER_CYCLE.indexOf(settings.colorFilter);
          const next = COLOR_FILTER_CYCLE[(idx + 1) % COLOR_FILTER_CYCLE.length];
          onUpdateSettings({ colorFilter: next });
        },
      },
      {
        id: 'reduce-white-point',
        category: 'Accessibility Vision',
        label: 'Reduce White Point',
        hint: 'Attenuates peak bright white intensity below minimum slider',
        statusText: settings.reduceWhitePoint ? `${settings.reduceWhitePointIntensity}%` : 'Off',
        isActive: settings.reduceWhitePoint,
        settingsRoute: 'ax-display',
        onToggle: () => onUpdateSettings({ reduceWhitePoint: !settings.reduceWhitePoint }),
      },
      {
        id: 'increase-contrast',
        category: 'Accessibility Vision',
        label: 'Increase Contrast',
        hint: 'Sharpens foreground contrast & switch fills',
        statusText: settings.increaseContrast ? 'On' : 'Off',
        isActive: settings.increaseContrast,
        settingsRoute: 'ax-display',
        onToggle: () => onUpdateSettings({ increaseContrast: !settings.increaseContrast }),
      },
      {
        id: 'reduce-transparency',
        category: 'Accessibility Vision',
        label: 'Reduce Transparency',
        hint: 'Replaces translucent Dock & Control Center with solid fills',
        statusText: settings.reduceTransparency ? 'On' : 'Off',
        isActive: settings.reduceTransparency,
        settingsRoute: 'ax-display',
        onToggle: () => onUpdateSettings({ reduceTransparency: !settings.reduceTransparency }),
      },
      {
        id: 'on-off-labels',
        category: 'Accessibility Vision',
        label: 'On/Off Switch Labels',
        hint: 'Draws | and O glyphs inside every iOS toggle switch',
        statusText: settings.onOffLabels ? 'I / O' : 'Off',
        isActive: settings.onOffLabels,
        settingsRoute: 'ax-display',
        onToggle: () => onUpdateSettings({ onOffLabels: !settings.onOffLabels }),
      },
      {
        id: 'button-shapes',
        category: 'Accessibility Vision',
        label: 'Button Shapes',
        hint: 'Underlines text navigation buttons across iOS headers',
        statusText: settings.buttonShapes ? 'On' : 'Off',
        isActive: settings.buttonShapes,
        settingsRoute: 'ax-display',
        onToggle: () => onUpdateSettings({ buttonShapes: !settings.buttonShapes }),
      },
      {
        id: 'bold-text',
        category: 'Accessibility Vision',
        label: 'Bold Text',
        hint: 'Renders system-wide San Francisco typography in semibold',
        statusText: settings.boldText ? 'On' : 'Off',
        isActive: settings.boldText,
        settingsRoute: 'ax-display',
        onToggle: () => onUpdateSettings({ boldText: !settings.boldText }),
      },
      {
        id: 'text-scale',
        category: 'Accessibility Vision',
        label: 'Dynamic Type Size',
        hint: 'Cycles native OS text scale (88% · 100% · 108% · 116%)',
        statusText: `${Math.round(settings.textScale * 100)}%`,
        isActive: settings.textScale !== 1,
        settingsRoute: 'ax-display',
        onToggle: () => {
          const steps = [0.88, 1, 1.08, 1.16];
          const idx = steps.findIndex((s) => Math.abs(s - settings.textScale) < 0.03);
          const next = steps[(idx + 1) % steps.length];
          onUpdateSettings({ textScale: next });
        },
      },
      {
        id: 'ax-zoom',
        category: 'Accessibility Vision',
        label: 'Screen Zoom Controller',
        hint: 'Magnifies viewport with floating iOS Zoom lens pill',
        statusText: settings.accessibilityZoom
          ? `${settings.accessibilityZoomLevel.toFixed(2)}×`
          : 'Off',
        isActive: settings.accessibilityZoom,
        settingsRoute: 'ax-zoom',
        onToggle: () => onUpdateSettings({ accessibilityZoom: !settings.accessibilityZoom }),
      },

      // 2. Motor, Motion & Hearing
      {
        id: 'assistive-touch',
        category: 'Motor, Motion & Hearing',
        label: 'AssistiveTouch Puck',
        hint: 'Floating magnetic on-screen hardware menu button',
        statusText: settings.assistiveTouchEnabled ? 'On' : 'Off',
        isActive: settings.assistiveTouchEnabled,
        settingsRoute: 'ax-touch',
        onToggle: () =>
          onUpdateSettings({ assistiveTouchEnabled: !settings.assistiveTouchEnabled }),
      },
      {
        id: 'reachability',
        category: 'Motor, Motion & Hearing',
        label: 'Reachability (One-Hand)',
        hint: 'Swipe down on Home Bar to pull top half within thumb reach',
        statusText: settings.reachabilityEnabled ? 'On' : 'Off',
        isActive: settings.reachabilityEnabled,
        settingsRoute: 'ax-touch',
        onToggle: () => onUpdateSettings({ reachabilityEnabled: !settings.reachabilityEnabled }),
      },
      {
        id: 'vehicle-motion-cues',
        category: 'Motor, Motion & Hearing',
        label: 'Vehicle Motion Cues',
        hint: 'iOS 18 edge dots that shift with pointer tilt to reduce motion cues',
        statusText: settings.vehicleMotionCues ? 'On' : 'Off',
        isActive: settings.vehicleMotionCues,
        settingsRoute: 'ax-motion',
        onToggle: () => onUpdateSettings({ vehicleMotionCues: !settings.vehicleMotionCues }),
      },
      {
        id: 'eye-tracking',
        category: 'Motor, Motion & Hearing',
        label: 'Eye Tracking Reticle',
        hint: 'iOS 18 on-screen gaze pointer ring following focus coordinates',
        statusText: settings.eyeTrackingEnabled ? 'On' : 'Off',
        isActive: settings.eyeTrackingEnabled,
        settingsRoute: 'ax-motion',
        onToggle: () => onUpdateSettings({ eyeTrackingEnabled: !settings.eyeTrackingEnabled }),
      },
      {
        id: 'reduce-motion',
        category: 'Motor, Motion & Hearing',
        label: 'Reduce Motion',
        hint: 'Replaces spring physics with rapid crossfades',
        statusText: settings.reduceMotion ? 'On' : 'Off',
        isActive: settings.reduceMotion,
        settingsRoute: 'ax-motion',
        onToggle: () => onUpdateSettings({ reduceMotion: !settings.reduceMotion }),
      },
      {
        id: 'limit-frame-rate',
        category: 'Motor, Motion & Hearing',
        label: 'Limit Frame Rate (60Hz)',
        hint: 'Throttles ProMotion 120Hz display refresh to 60 fps',
        statusText: settings.limitFrameRate60Hz ? '60Hz' : '120Hz',
        isActive: settings.limitFrameRate60Hz,
        settingsRoute: 'ax-motion',
        onToggle: () => onUpdateSettings({ limitFrameRate60Hz: !settings.limitFrameRate60Hz }),
      },
      {
        id: 'background-sounds',
        category: 'Motor, Motion & Hearing',
        label: 'Background Sounds',
        hint: 'Synthesizes calming Rain, Ocean, or Dark Noise via Web Audio',
        statusText: settings.backgroundSounds ? settings.backgroundSoundType : 'Off',
        isActive: settings.backgroundSounds,
        settingsRoute: 'ax-hearing',
        onToggle: () => onUpdateSettings({ backgroundSounds: !settings.backgroundSounds }),
      },
      {
        id: 'led-flash-alerts',
        category: 'Motor, Motion & Hearing',
        label: 'LED Flash for Alerts',
        hint: 'Strobes outer xenon flash rim on timers & MagSafe alerts',
        statusText: settings.ledFlashForAlerts ? 'On' : 'Off',
        isActive: settings.ledFlashForAlerts,
        settingsRoute: 'ax-hearing',
        onToggle: () => onUpdateSettings({ ledFlashForAlerts: !settings.ledFlashForAlerts }),
      },
      {
        id: 'guided-access',
        category: 'Motor, Motion & Hearing',
        label: 'Guided Access Lock',
        hint: 'Locks iPhone inside single active app until Side/Home triple-clicked',
        statusText: settings.guidedAccessEnabled ? 'Locked' : 'Off',
        isActive: settings.guidedAccessEnabled,
        settingsRoute: 'ax-shortcut',
        onToggle: () => onUpdateSettings({ guidedAccessEnabled: !settings.guidedAccessEnabled }),
      },
      {
        id: 'back-tap-double',
        category: 'Motor, Motion & Hearing',
        label: 'Double Back Tap Role',
        hint: 'Double-click metallic bezel or tap trigger bar above',
        statusText: BACK_TAP_SHORT[settings.backTapDouble],
        isActive: settings.backTapDouble !== 'none',
        settingsRoute: 'ax-touch',
        onToggle: () => {
          const idx = BACK_TAP_CYCLE.indexOf(settings.backTapDouble);
          onUpdateSettings({
            backTapDouble: BACK_TAP_CYCLE[(idx + 1) % BACK_TAP_CYCLE.length],
          });
        },
      },
      {
        id: 'back-tap-triple',
        category: 'Motor, Motion & Hearing',
        label: 'Triple Back Tap Role',
        hint: 'Cycles action assigned to 3 rear-chassis taps',
        statusText: BACK_TAP_SHORT[settings.backTapTriple],
        isActive: settings.backTapTriple !== 'none',
        settingsRoute: 'ax-touch',
        onToggle: () => {
          const idx = BACK_TAP_CYCLE.indexOf(settings.backTapTriple);
          onUpdateSettings({
            backTapTriple: BACK_TAP_CYCLE[(idx + 1) % BACK_TAP_CYCLE.length],
          });
        },
      },

      // 3. Display, Lock, Control Center & System
      {
        id: 'dark-mode',
        category: 'Display & System',
        label: 'Dark Appearance',
        hint: 'Switches native Settings, Notes & Safari chrome to OLED dark',
        statusText: settings.darkMode ? 'Dark' : 'Light',
        isActive: settings.darkMode,
        settingsRoute: 'display',
        onToggle: () => onUpdateSettings({ darkMode: !settings.darkMode }),
      },
      {
        id: 'true-tone',
        category: 'Display & System',
        label: 'True Tone Sensor',
        hint: 'Matches OLED white point to ambient room warmth',
        statusText: settings.trueTone ? 'On' : 'Off',
        isActive: settings.trueTone,
        settingsRoute: 'display',
        onToggle: () => onUpdateSettings({ trueTone: !settings.trueTone }),
      },
      {
        id: 'night-shift',
        category: 'Display & System',
        label: 'Night Shift Warmth',
        hint: 'Shifts display spectrum toward warm amber wavelengths',
        statusText: settings.nightShift ? `${settings.nightShiftWarmth}%` : 'Off',
        isActive: settings.nightShift,
        settingsRoute: 'display',
        onToggle: () => onUpdateSettings({ nightShift: !settings.nightShift }),
      },
      {
        id: 'always-on-display',
        category: 'Display & System',
        label: 'Always-On Display',
        hint: 'Dims Pro OLED lock screen to 1Hz instead of full black sleep',
        statusText: settings.alwaysOnDisplay ? 'On' : 'Off',
        isActive: settings.alwaysOnDisplay,
        settingsRoute: 'display',
        onToggle: () => onUpdateSettings({ alwaysOnDisplay: !settings.alwaysOnDisplay }),
      },
      {
        id: 'tap-to-wake',
        category: 'Display & System',
        label: 'Tap to Wake',
        hint: 'Wake sleeping screen with single tap (when Off, use Side/Home button)',
        statusText: settings.tapToWake ? 'On' : 'Off',
        isActive: settings.tapToWake,
        settingsRoute: 'ax-touch',
        onToggle: () => onUpdateSettings({ tapToWake: !settings.tapToWake }),
      },
      {
        id: 'auto-lock',
        category: 'Display & System',
        label: 'Auto-Lock Timer',
        hint: 'Automatically sleeps idle display (30s · 1m · 2m · Never)',
        statusText:
          settings.autoLockSeconds === 0
            ? 'Never'
            : settings.autoLockSeconds === 30
              ? '30s'
              : `${settings.autoLockSeconds / 60}m`,
        isActive: settings.autoLockSeconds > 0,
        settingsRoute: 'display',
        onToggle: () => {
          const order: Array<30 | 60 | 120 | 0> = [30, 60, 120, 0];
          const next = order[(order.indexOf(settings.autoLockSeconds) + 1) % order.length];
          onUpdateSettings({ autoLockSeconds: next });
        },
      },
      {
        id: 'cc-in-apps',
        category: 'Display & System',
        label: 'Control Center in Apps',
        hint: 'Allow or block Control Center pull-down while inside apps',
        statusText: settings.controlCenterInApps ? 'Allow' : 'Blocked',
        isActive: settings.controlCenterInApps,
        settingsRoute: 'control-center',
        onToggle: () => onUpdateSettings({ controlCenterInApps: !settings.controlCenterInApps }),
      },
      {
        id: 'standby-mode',
        category: 'Display & System',
        label: 'StandBy Nightstand',
        hint: 'Activates fullscreen clock when Landscape + MagSafe + Locked',
        statusText: settings.standByEnabled ? 'On' : 'Off',
        isActive: settings.standByEnabled,
        settingsRoute: 'standby',
        onToggle: () => onUpdateSettings({ standByEnabled: !settings.standByEnabled }),
      },
      {
        id: 'low-power-mode',
        category: 'Display & System',
        label: 'Low Power Mode',
        hint: 'Yellow battery icon, 60Hz cap, and pauses Always-On Display',
        statusText: settings.lowPowerMode ? 'On' : 'Off',
        isActive: settings.lowPowerMode,
        settingsRoute: 'battery',
        onToggle: () => onUpdateSettings({ lowPowerMode: !settings.lowPowerMode }),
      },

      // 4. Sounds, Haptics, Camera & Physical Quirks
      {
        id: 'silent-mode',
        category: 'Quirks & Hardware',
        label: 'Silent Mode Bell',
        hint: 'Mutes ringer, shutter & lock clicks (Action Btn or Silent Switch)',
        statusText: settings.silentMode ? 'Silent' : 'Ring',
        isActive: settings.silentMode,
        settingsRoute: 'sounds',
        onToggle: () => onUpdateSettings({ silentMode: !settings.silentMode }),
      },
      {
        id: 'system-haptics',
        category: 'Quirks & Hardware',
        label: 'Taptic Engine LRA',
        hint: 'Synthesizes physical UIKit haptic detents & chassis recoil',
        statusText: settings.systemHaptics ? 'On' : 'Off',
        isActive: settings.systemHaptics,
        settingsRoute: 'sounds',
        onToggle: () => onUpdateSettings({ systemHaptics: !settings.systemHaptics }),
      },
      {
        id: 'haptics-in-silent',
        category: 'Quirks & Hardware',
        label: 'Play Haptics in Silent',
        hint: 'Controls whether Taptic LRA fires while Silent Mode is active',
        statusText: settings.hapticsPlayInSilent ? 'Play' : 'Muted',
        isActive: settings.hapticsPlayInSilent,
        settingsRoute: 'sounds',
        onToggle: () => onUpdateSettings({ hapticsPlayInSilent: !settings.hapticsPlayInSilent }),
      },
      {
        id: 'lock-sound',
        category: 'Quirks & Hardware',
        label: 'Lock Click Sound',
        hint: 'Plays classic iOS pneumatic lock click on Side Button sleep',
        statusText: settings.lockSoundEnabled ? 'On' : 'Off',
        isActive: settings.lockSoundEnabled,
        settingsRoute: 'sounds',
        onToggle: () => onUpdateSettings({ lockSoundEnabled: !settings.lockSoundEnabled }),
      },
      {
        id: 'camera-grid',
        category: 'Quirks & Hardware',
        label: 'Camera 3×3 Grid',
        hint: 'Rule-of-thirds composition lines inside Camera viewfinder',
        statusText: settings.cameraGrid ? 'On' : 'Off',
        isActive: settings.cameraGrid,
        settingsRoute: 'camera-settings',
        onToggle: () => onUpdateSettings({ cameraGrid: !settings.cameraGrid }),
      },
      {
        id: 'camera-level',
        category: 'Quirks & Hardware',
        label: 'Camera Horizon Level',
        hint: 'Gyroscope spirit-level bar inside Camera viewfinder',
        statusText: settings.cameraLevel ? 'On' : 'Off',
        isActive: settings.cameraLevel,
        settingsRoute: 'camera-settings',
        onToggle: () => onUpdateSettings({ cameraLevel: !settings.cameraLevel }),
      },
      {
        id: 'touch-indicators',
        category: 'Quirks & Hardware',
        label: 'Touch & Long-Press Rings',
        hint: 'Shows capacitive touch contact & 500ms Haptic Touch expansion',
        statusText: settings.showTouchIndicators ? 'On' : 'Off',
        isActive: settings.showTouchIndicators,
        settingsRoute: 'ax-touch',
        onToggle: () => onUpdateSettings({ showTouchIndicators: !settings.showTouchIndicators }),
      },
      {
        id: 'pinch-zoom-sim',
        category: 'Quirks & Hardware',
        label: '2-Finger Pinch Mode',
        hint: 'Mirrored dual-finger pinch-to-zoom (or hold Alt + drag)',
        statusText: settings.pinchModeEnabled ? 'On' : 'Alt',
        isActive: settings.pinchModeEnabled,
        onToggle: () => onUpdateSettings({ pinchModeEnabled: !settings.pinchModeEnabled }),
      },
    ],
    [onUpdateSettings, settings],
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.hint.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  }, [items, query]);

  const categories = [
    'Accessibility Vision',
    'Motor, Motion & Hearing',
    'Display & System',
    'Quirks & Hardware',
  ] as const;

  return (
    <aside
      aria-label="iOS 1:1 Options and Accessibility Shortcut Legend"
      className="pointer-events-auto w-[310px] xl:w-[348px] max-h-[calc(100vh-148px)] flex flex-col rounded-2xl bg-[#0F131A] border border-white/15 shadow-2xl opacity-[0.14] hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 overflow-hidden shrink-0"
    >
      {/* Top Legend Header */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-white/10 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Accessibility className="w-4 h-4 text-sky-400 shrink-0" />
            <h2 className="text-xs font-bold tracking-tight text-white truncate">
              1:1 Options & Accessibility Legend
            </h2>
          </div>
          <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
            Hover Active
          </span>
        </div>

        {/* Instant Physical Shortcut Trigger Buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerTaptic('medium', settings.systemHaptics, false);
              onTriggerAccessibilityShortcut();
            }}
            title="Simulate Triple-Click Side/Home Button to open Accessibility Shortcut"
            className="px-2 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-[10px] font-semibold text-sky-200 flex items-center justify-center gap-1 whitespace-nowrap transition-colors"
          >
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>3× Side AX</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerBackTap(2)}
            title="Simulate Double-Tap on back of iPhone"
            className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-semibold text-slate-200 flex items-center justify-center gap-1 whitespace-nowrap transition-colors"
          >
            <Hand className="w-3 h-3 shrink-0 text-amber-300" />
            <span>2× Back Tap</span>
          </button>

          <button
            type="button"
            onClick={onTriggerScreenshot}
            title="Simulate Side + Volume Up Screenshot"
            className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-semibold text-slate-200 flex items-center justify-center gap-1 whitespace-nowrap transition-colors"
          >
            <Smartphone className="w-3 h-3 shrink-0 text-emerald-300" />
            <span>Side+VolUp</span>
          </button>
        </div>

        {/* Search Filter */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter 39 iOS options, AX & quirks..."
            className="w-full h-7 pl-8 pr-2.5 rounded-lg bg-[#090B0F] border border-white/10 text-[11px] text-white placeholder:text-slate-500 outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Scrollable Live Interactive Legend */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-3.5 text-xs">
        {categories.map((cat) => {
          const group = filteredItems.filter((i) => i.category === cat);
          if (group.length === 0) return null;
          return (
            <div key={cat} className="space-y-1">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>{cat}</span>
                <span className="font-mono tabular-nums text-slate-500">{group.length}</span>
              </div>

              <div className="rounded-xl bg-[#090B0F] border border-white/10 divide-y divide-white/5 overflow-hidden">
                {group.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 hover:bg-white/[0.04] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        triggerTaptic('selection', settings.systemHaptics, false);
                        item.onToggle();
                      }}
                      title={item.hint}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="text-[11px] font-medium text-slate-100 truncate">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{item.hint}</div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          triggerTaptic('selection', settings.systemHaptics, false);
                          item.onToggle();
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono tabular-nums font-semibold transition-colors ${
                          item.isActive
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:text-slate-200'
                        }`}
                      >
                        {item.statusText}
                      </button>

                      {item.settingsRoute && (
                        <button
                          type="button"
                          onClick={() => onOpenSettingsRoute(item.settingsRoute!)}
                          title={`Open ${item.label} in iPhone Settings`}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        >
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Quick Hardware Gesture Cheatsheet Footer inside Legend */}
        <div className="rounded-xl bg-[#090B0F] border border-white/10 p-2.5 space-y-1 text-[10px] text-slate-400 leading-relaxed">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Sliders className="w-3 h-3 text-sky-400" />
            <span>Physical Hardware & Touch Quirks</span>
          </div>
          <p>
            <strong className="text-slate-200">Triple-Click Side / Home:</strong> Opens iOS
            Accessibility Shortcut or exits Guided Access.
          </p>
          <p>
            <strong className="text-slate-200">Double-Click Bezel:</strong> Fires accelerometer Back
            Tap. <strong className="text-slate-200">Alt + Drag:</strong> 2-finger pinch zoom.
          </p>
          <div className="pt-1 flex items-center justify-between border-t border-white/5">
            <button
              type="button"
              onClick={() => onOpenSettingsRoute('accessibility')}
              className="text-sky-400 hover:underline font-medium flex items-center gap-1"
            >
              <span>Open Full Accessibility Settings</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
            <Volume2 className="w-3 h-3 text-slate-500" />
          </div>
        </div>
      </div>
    </aside>
  );
}
