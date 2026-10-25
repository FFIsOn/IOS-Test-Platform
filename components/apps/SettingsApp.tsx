'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Accessibility,
  BatteryCharging,
  Bell,
  Bluetooth,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Ear,
  Eye,
  Hand,
  Info,
  Lock,
  Moon,
  Plane,
  Radio,
  Search,
  Sliders,
  Smartphone,
  Sun,
  Type,
  Volume2,
  Wifi,
  Zap,
  ZoomIn,
} from 'lucide-react';
import {
  ACCESSIBILITY_SHORTCUT_DEFS,
  DEFAULT_IOS_SETTINGS,
  IPHONE_MODELS,
  type AccessibilityShortcutTarget,
  type ActionButtonRole,
  type BackTapAction,
  type BackgroundSoundId,
  type ColorFilterMode,
  type IOSSystemSettings,
  type IPhoneModelId,
  type SettingsRouteId,
} from '@/lib/core/iosState';
import {
  getHardwareMemoryBus,
  SABIntOffset,
  TITANIUM_FINISHES,
  triggerTaptic,
  writeIntSlot,
} from '@/lib/core/hardwareMemory';

export interface SettingsAppHandle {
  navigateToRoute: (route: SettingsRouteId) => void;
}

interface SettingsAppProps {
  settings: IOSSystemSettings;
  onUpdate: (patch: Partial<IOSSystemSettings>) => void;
  scrollToTopSignal: number;
}

function IOSSwitch({
  checked,
  onChange,
  haptics = true,
  showOnOffLabels = false,
  highContrast = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  haptics?: boolean;
  showOnOffLabels?: boolean;
  highContrast?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        triggerTaptic('selection', haptics, false);
        onChange(!checked);
      }}
      className={`relative w-[51px] h-[31px] rounded-full p-[2px] transition-colors duration-200 shrink-0 ${
        checked
          ? highContrast
            ? 'bg-[#248A3D]'
            : 'bg-[#34C759]'
          : highContrast
            ? 'bg-zinc-600'
            : 'bg-zinc-500/35'
      }`}
    >
      {/* Authentic iOS Accessibility On/Off Labels: '|' when ON, 'O' when OFF */}
      {showOnOffLabels && (
        <>
          <span
            className={`absolute left-[9px] top-1/2 -translate-y-1/2 w-[1.8px] h-[10px] rounded-full bg-white transition-opacity ${
              checked ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <span
            className={`absolute right-[7px] top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full border-[1.6px] border-white/85 transition-opacity ${
              checked ? 'opacity-0' : 'opacity-100'
            }`}
          />
        </>
      )}
      <div
        className={`relative z-10 w-[27px] h-[27px] rounded-full bg-white shadow-md transition-transform duration-200 ${
          checked ? 'translate-x-[20px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

const SettingsApp = forwardRef<SettingsAppHandle, SettingsAppProps>(function SettingsApp(
  { settings, onUpdate, scrollToTopSignal },
  ref,
) {
  const [route, setRoute] = useState<SettingsRouteId>('root');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showHardwareModelCode, setShowHardwareModelCode] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isDark = settings.darkMode;
  const modelSpec = IPHONE_MODELS[settings.deviceModel];
  const topPadStyle = { paddingTop: `${Math.max(28, modelSpec.safeTopPx)}px` };

  useImperativeHandle(
    ref,
    () => ({
      navigateToRoute: (target: SettingsRouteId) => {
        setRoute(target);
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      },
    }),
    [],
  );

  useEffect(() => {
    if (scrollToTopSignal > 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [scrollToTopSignal]);

  const goPage = (target: SettingsRouteId) => {
    triggerTaptic('light', settings.systemHaptics, false);
    setRoute(target);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const applyFrameRateThrottle = (lowPower: boolean, cap60: boolean) => {
    const bus = getHardwareMemoryBus();
    const skip = lowPower || cap60 ? 2 : 1;
    writeIntSlot(bus.i32, SABIntOffset.FRAME_SKIP_MODULO, skip, bus.isAtomicCapable);
  };

  const cardBg = isDark
    ? settings.increaseContrast
      ? 'bg-[#242428] border border-white/15'
      : 'bg-[#1C1C1E]'
    : settings.increaseContrast
      ? 'bg-white border border-zinc-300'
      : 'bg-white';
  const pageBg = isDark ? 'bg-black text-white' : 'bg-[#F2F2F7] text-zinc-900';
  const dividerCls = isDark
    ? settings.increaseContrast
      ? 'divide-white/25'
      : 'divide-white/10'
    : settings.increaseContrast
      ? 'divide-zinc-300'
      : 'divide-zinc-200';
  const mutedText = isDark
    ? settings.increaseContrast
      ? 'text-zinc-300'
      : 'text-zinc-400'
    : settings.increaseContrast
      ? 'text-zinc-700'
      : 'text-zinc-500';

  const renderSwitch = (checked: boolean, onChange: (v: boolean) => void) => (
    <IOSSwitch
      checked={checked}
      onChange={onChange}
      haptics={settings.systemHaptics}
      showOnOffLabels={settings.onOffLabels}
      highContrast={settings.increaseContrast}
    />
  );

  const renderHeader = (title: string, backTarget: SettingsRouteId = 'root', backLabel = 'Settings') => (
    <div
      style={topPadStyle}
      className={`sticky top-0 z-20 pb-2.5 px-4 flex items-center justify-between border-b ${
        isDark
          ? 'bg-black/95 border-white/10 text-white'
          : 'bg-[#F2F2F7]/95 border-black/10 text-zinc-900'
      }`}
    >
      <button
        type="button"
        onClick={() => goPage(backTarget)}
        className={`flex items-center gap-0.5 text-blue-500 text-sm font-medium min-h-[36px] pr-2 ${
          settings.buttonShapes ? 'underline decoration-blue-500 bg-blue-500/10 px-2 rounded-lg' : ''
        }`}
      >
        <ChevronLeft className="w-5 h-5 -ml-1.5" />
        <span>{backLabel}</span>
      </button>
      <span className="text-sm font-semibold truncate">{title}</span>
      <div className="w-14" />
    </div>
  );

  const toggleShortcutTarget = (id: AccessibilityShortcutTarget) => {
    triggerTaptic('selection', settings.systemHaptics, false);
    const exists = settings.accessibilityShortcutTargets.includes(id);
    const next = exists
      ? settings.accessibilityShortcutTargets.filter((item) => item !== id)
      : [...settings.accessibilityShortcutTargets, id];
    onUpdate({ accessibilityShortcutTargets: next });
  };

  const renderRoot = () => {
    const q = searchQuery.trim().toLowerCase();
    const matches = (keywords: string) => !q || keywords.toLowerCase().includes(q);

    return (
      <div style={topPadStyle} className="pb-12 px-4 space-y-5">
        <h1 className="text-2xl font-bold tracking-tight px-1">Settings</h1>

        {/* Search Input */}
        <div
          className={`flex items-center gap-2 px-3 h-9 rounded-xl ${
            isDark ? 'bg-[#1C1C1E]' : 'bg-zinc-200/80'
          }`}
        >
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Settings & Accessibility"
            className="bg-transparent text-sm outline-none flex-1 min-w-0"
          />
        </div>

        {/* Apple Account Profile Row */}
        {!q && (
          <button
            type="button"
            onClick={() => goPage('about')}
            className={`w-full ${cardBg} rounded-2xl p-3.5 flex items-center gap-3 text-left`}
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shrink-0">
              CP
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">CorePhone Developer</div>
              <div className={`text-xs ${mutedText} truncate`}>
                {modelSpec.name} · iCloud+ & Hardware Profile
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
          </button>
        )}

        {/* Group 1: Connectivity */}
        <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} overflow-hidden`}>
          {matches('airplane mode flight offline') && (
            <div className="flex items-center justify-between px-3.5 py-2.5 min-h-[46px]">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-white">
                  <Plane className="w-4 h-4" />
                </div>
                <span className="text-sm">Airplane Mode</span>
              </div>
              {renderSwitch(settings.airplaneMode, (val) =>
                onUpdate({
                  airplaneMode: val,
                  wifiEnabled: val ? false : true,
                  cellularEnabled: val ? false : true,
                }),
              )}
            </div>
          )}

          {matches('wifi wireless internet network') && (
            <button
              type="button"
              onClick={() => goPage('wifi')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                  <Wifi className="w-4 h-4" />
                </div>
                <span className="text-sm">Wi-Fi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${mutedText}`}>
                  {settings.airplaneMode || !settings.wifiEnabled ? 'Off' : settings.wifiNetwork}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
            </button>
          )}

          {matches('bluetooth airpods audio') && (
            <button
              type="button"
              onClick={() => goPage('bluetooth')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <Bluetooth className="w-4 h-4" />
                </div>
                <span className="text-sm">Bluetooth</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${mutedText}`}>
                  {settings.bluetoothEnabled ? 'On' : 'Off'}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
            </button>
          )}

          {matches('cellular 5g lte mobile data carrier') && (
            <button
              type="button"
              onClick={() => goPage('cellular')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#34C759] flex items-center justify-center text-white">
                  <Radio className="w-4 h-4" />
                </div>
                <span className="text-sm">Cellular</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${mutedText}`}>
                  {settings.airplaneMode || !settings.cellularEnabled
                    ? 'Off'
                    : settings.cellularMode}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
            </button>
          )}

          {matches('battery low power percentage charging health') && (
            <button
              type="button"
              onClick={() => goPage('battery')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#34C759] flex items-center justify-center text-white">
                  <BatteryCharging className="w-4 h-4" />
                </div>
                <span className="text-sm">Battery</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${mutedText} tabular-nums`}>
                  {settings.lowPowerMode ? 'Low Power' : `${settings.batteryLevel}%`}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
            </button>
          )}
        </div>

        {/* Group 2: Accessibility (Promoted for Rapid 1:1 Exploration) */}
        <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} overflow-hidden`}>
          {matches(
            'accessibility shortcut triple click invert color filter zoom voice motion cues back tap assistive touch guided access background sounds on off labels contrast transparency',
          ) && (
            <button
              type="button"
              onClick={() => goPage('accessibility')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                  <Accessibility className="w-4 h-4" />
                </div>
                <span className="text-sm">Accessibility</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs tabular-nums ${mutedText}`}>
                  {settings.accessibilityShortcutTargets.length} Shortcuts
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
            </button>
          )}

          {matches('shortcut triple click side home button guided access') && (
            <button
              type="button"
              onClick={() => goPage('ax-shortcut')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                  <Lock className="w-4 h-4" />
                </div>
                <span className="text-sm">Accessibility Shortcut</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${mutedText}`}>Triple-Click</span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
            </button>
          )}
        </div>

        {/* Group 3: Physical Hardware, Display, Control Center & Sounds */}
        <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} overflow-hidden`}>
          {modelSpec.hasActionButton &&
            matches('action button silent flashlight shortcut rail') && (
              <button
                type="button"
                onClick={() => goPage('action-button')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="text-sm">Action Button</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs capitalize ${mutedText}`}>
                    {settings.actionButtonRole}
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
              </button>
            )}

          {matches('control center swipe apps toggles') && (
            <button
              type="button"
              onClick={() => goPage('control-center')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-zinc-600 flex items-center justify-center text-white">
                  <Sliders className="w-4 h-4" />
                </div>
                <span className="text-sm">Control Center</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          )}

          {matches('display brightness dark mode true tone night shift always on bold text size auto lock') && (
            <button
              type="button"
              onClick={() => goPage('display')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center text-white">
                  <Sun className="w-4 h-4" />
                </div>
                <span className="text-sm">Display & Brightness</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          )}

          {matches('wallpaper background titanium aurora lock screen model frame') && (
            <button
              type="button"
              onClick={() => goPage('wallpaper')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center text-white">
                  <Smartphone className="w-4 h-4" />
                </div>
                <span className="text-sm">Wallpaper & Chassis</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          )}

          {matches('standby landscape clock night dock') && (
            <button
              type="button"
              onClick={() => goPage('standby')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="text-sm">StandBy</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          )}

          {matches('sounds haptics silent ringer volume taptic keyboard lock sound') && (
            <button
              type="button"
              onClick={() => goPage('sounds')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-rose-500 flex items-center justify-center text-white">
                  <Volume2 className="w-4 h-4" />
                </div>
                <span className="text-sm">Sounds & Haptics</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          )}

          {matches('focus do not disturb sleep work') && (
            <button
              type="button"
              onClick={() => goPage('focus')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Moon className="w-4 h-4" />
                </div>
                <span className="text-sm">Focus</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs uppercase ${mutedText}`}>
                  {settings.focusMode === 'off' ? 'Off' : settings.focusMode}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
            </button>
          )}
        </div>

        {/* Group 4: General, Camera & Safari */}
        <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} overflow-hidden`}>
          {matches('general about model serial storage reset ios 18') && (
            <button
              type="button"
              onClick={() => goPage('about')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-zinc-500 flex items-center justify-center text-white">
                  <Info className="w-4 h-4" />
                </div>
                <span className="text-sm">General & About</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          )}

          {matches('camera grid level horizon fusion') && (
            <button
              type="button"
              onClick={() => goPage('camera-settings')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center text-white">
                  <Camera className="w-4 h-4" />
                </div>
                <span className="text-sm">Camera</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          )}

          {matches('safari browser search engine address bar proxy') && (
            <button
              type="button"
              onClick={() => goPage('safari')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 min-h-[46px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                  <Compass className="w-4 h-4" />
                </div>
                <span className="text-sm">Safari</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSubPage = () => {
    switch (route) {
      case 'wifi':
        return (
          <>
            {renderHeader('Wi-Fi')}
            <div className="p-4 space-y-4">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">Wi-Fi</span>
                  {renderSwitch(settings.wifiEnabled && !settings.airplaneMode, (v) =>
                    onUpdate({ wifiEnabled: v, airplaneMode: false }),
                  )}
                </div>
              </div>
              {settings.wifiEnabled && !settings.airplaneMode && (
                <div>
                  <div className={`text-xs px-3 pb-1.5 ${mutedText}`}>Networks</div>
                  <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                    {['Cupertino-6E', 'Apple-Visitor-5GHz', 'Studio-Mesh-Pro'].map((net) => (
                      <button
                        key={net}
                        type="button"
                        onClick={() => onUpdate({ wifiNetwork: net })}
                        className="w-full flex items-center justify-between py-3 text-sm"
                      >
                        <span
                          className={
                            settings.wifiNetwork === net ? 'font-semibold text-blue-500' : ''
                          }
                        >
                          {net}
                        </span>
                        <Wifi className="w-4 h-4 opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        );

      case 'bluetooth':
        return (
          <>
            {renderHeader('Bluetooth')}
            <div className="p-4 space-y-4">
              <div className={`${cardBg} rounded-2xl px-3.5 py-3 flex items-center justify-between`}>
                <span className="text-sm">Bluetooth</span>
                {renderSwitch(settings.bluetoothEnabled, (v) => onUpdate({ bluetoothEnabled: v }))}
              </div>
              {settings.bluetoothEnabled && (
                <div>
                  <div className={`text-xs px-3 pb-1.5 ${mutedText}`}>My Devices</div>
                  <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                    <div className="flex items-center justify-between py-3 text-sm">
                      <span>AirPods Pro (USB-C)</span>
                      <span className={`text-xs ${mutedText}`}>Connected</span>
                    </div>
                    <div className="flex items-center justify-between py-3 text-sm">
                      <span>Apple Watch Ultra 2</span>
                      <span className={`text-xs ${mutedText}`}>Connected</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        );

      case 'cellular':
        return (
          <>
            {renderHeader('Cellular')}
            <div className="p-4 space-y-4">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">Cellular Data</span>
                  {renderSwitch(settings.cellularEnabled && !settings.airplaneMode, (v) =>
                    onUpdate({ cellularEnabled: v, airplaneMode: false }),
                  )}
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">Personal Hotspot</span>
                  {renderSwitch(settings.personalHotspot, (v) => onUpdate({ personalHotspot: v }))}
                </div>
              </div>
              <div>
                <div className={`text-xs px-3 pb-1.5 ${mutedText}`}>Voice & Data Mode</div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                  {(['5G UW', '5G Auto', 'LTE'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdate({ cellularMode: mode })}
                      className="w-full flex items-center justify-between py-3 text-sm"
                    >
                      <span>{mode}</span>
                      {settings.cellularMode === mode && (
                        <span className="text-blue-500 font-semibold text-xs">Selected</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );

      case 'battery':
        return (
          <>
            {renderHeader('Battery')}
            <div className="p-4 space-y-4">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">Battery Percentage</span>
                  {renderSwitch(settings.showBatteryPercentage, (v) =>
                    onUpdate({ showBatteryPercentage: v }),
                  )}
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Low Power Mode</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Caps ProMotion to 60Hz & pauses Always-On Display
                    </div>
                  </div>
                  {renderSwitch(settings.lowPowerMode, (v) => {
                    onUpdate({ lowPowerMode: v });
                    applyFrameRateThrottle(v, settings.limitFrameRate60Hz);
                  })}
                </div>
              </div>

              <div>
                <div className={`text-xs px-3 pb-1.5 ${mutedText}`}>
                  Battery Health & Charging Limit
                </div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                  <div className="flex items-center justify-between py-3 text-sm">
                    <span>Maximum Capacity</span>
                    <span className={`tabular-nums ${mutedText}`}>100%</span>
                  </div>
                  <div className="flex items-center justify-between py-3 text-sm">
                    <span>Cycle Count</span>
                    <span className={`tabular-nums ${mutedText}`}>14</span>
                  </div>
                  <div className="py-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Charge Limit</span>
                      <span className="text-blue-500 font-semibold tabular-nums">
                        {settings.chargeLimit}%
                      </span>
                    </div>
                    <div className="flex justify-between gap-1">
                      {([80, 85, 90, 95, 100] as const).map((lim) => (
                        <button
                          key={lim}
                          type="button"
                          onClick={() => onUpdate({ chargeLimit: lim })}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium tabular-nums ${
                            settings.chargeLimit === lim
                              ? 'bg-blue-500 text-white'
                              : 'bg-zinc-500/15'
                          }`}
                        >
                          {lim}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        );

      case 'action-button': {
        const roles: Array<{ id: ActionButtonRole; label: string; desc: string }> = [
          {
            id: 'silent',
            label: 'Silent Mode',
            desc: 'Switch between Silent and Ring for calls and alerts.',
          },
          {
            id: 'flashlight',
            label: 'Flashlight',
            desc: 'Turn on the rear Adaptive True Tone LED beam & Dynamic Island slider.',
          },
          {
            id: 'accessibility',
            label: 'Accessibility Shortcut',
            desc: 'Open your Accessibility Shortcut menu with a 450ms hold.',
          },
          {
            id: 'camera',
            label: 'Camera',
            desc: 'Jump straight into the 48MP Fusion Camera viewfinder.',
          },
          {
            id: 'safari',
            label: 'Open Safari',
            desc: 'Launch Mobile Safari directly to browse web URLs.',
          },
          {
            id: 'focus',
            label: 'Focus (Do Not Disturb)',
            desc: 'Silence incoming alerts and show the Focus icon in Status Bar.',
          },
          {
            id: 'calculator',
            label: 'Calculator',
            desc: 'Open Calculator immediately with Press & Hold.',
          },
        ];

        return (
          <>
            {renderHeader('Action Button')}
            <div className="p-4 space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-indigo-950/70 text-white border border-white/10 space-y-1.5">
                <div className="text-xs text-indigo-300 font-medium">
                  Physical Upper-Left Rail Button
                </div>
                <div className="text-base font-bold">Press and Hold (450ms) to Trigger</div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Short-tapping nudges Dynamic Island to prevent pocket presses; holding 450ms triggers your selected action.
                </p>
              </div>

              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      triggerTaptic('rigid', settings.systemHaptics, false);
                      onUpdate({ actionButtonRole: r.id });
                    }}
                    className="w-full py-3 text-left flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{r.label}</div>
                      <div className={`text-[11px] ${mutedText}`}>{r.desc}</div>
                    </div>
                    {settings.actionButtonRole === r.id && (
                      <span className="text-xs font-semibold text-blue-500 shrink-0">Active</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        );
      }

      case 'control-center':
        return (
          <>
            {renderHeader('Control Center')}
            <div className="p-4 space-y-4">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3 gap-3">
                  <div>
                    <div className="text-sm">Access Within Apps</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Allow pulling down Control Center while using apps; when off, only accessible from Home Screen
                    </div>
                  </div>
                  {renderSwitch(settings.controlCenterInApps, (v) =>
                    onUpdate({ controlCenterInApps: v }),
                  )}
                </div>
              </div>
              <p className={`text-xs px-2 leading-relaxed ${mutedText}`}>
                Control Center also includes a quick Accessibility Shortcut tile to trigger your configured Accessibility options without pressing physical buttons.
              </p>
            </div>
          </>
        );

      case 'camera-settings':
        return (
          <>
            {renderHeader('Camera')}
            <div className="p-4 space-y-4">
              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>Composition</div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm">Grid</div>
                      <div className={`text-[11px] ${mutedText}`}>
                        3×3 rule-of-thirds overlay in Camera viewfinder
                      </div>
                    </div>
                    {renderSwitch(settings.cameraGrid, (v) => onUpdate({ cameraGrid: v }))}
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm">Level</div>
                      <div className={`text-[11px] ${mutedText}`}>
                        Horizontal spirit level guide in Camera viewfinder
                      </div>
                    </div>
                    {renderSwitch(settings.cameraLevel, (v) => onUpdate({ cameraLevel: v }))}
                  </div>
                </div>
              </div>
            </div>
          </>
        );

      case 'display':
        return (
          <>
            {renderHeader('Display & Brightness')}
            <div className="p-4 space-y-4 pb-10">
              <div className={`${cardBg} rounded-2xl p-4 grid grid-cols-2 gap-3`}>
                <button
                  type="button"
                  onClick={() => onUpdate({ darkMode: false })}
                  className={`p-3 rounded-xl border text-center space-y-2 ${
                    !settings.darkMode
                      ? 'border-blue-500 ring-2 ring-blue-500/25'
                      : 'border-current/10'
                  }`}
                >
                  <div className="h-14 rounded-lg bg-zinc-100 border border-black/10 mx-auto w-11" />
                  <div className="text-xs font-medium">Light</div>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ darkMode: true })}
                  className={`p-3 rounded-xl border text-center space-y-2 ${
                    settings.darkMode
                      ? 'border-blue-500 ring-2 ring-blue-500/25'
                      : 'border-current/10'
                  }`}
                >
                  <div className="h-14 rounded-lg bg-zinc-900 border border-white/15 mx-auto w-11" />
                  <div className="text-xs font-medium">Dark</div>
                </button>
              </div>

              {/* Typography: Text Size & Bold Text */}
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="py-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-sm">Text Size (Dynamic Type)</span>
                    <span className={`tabular-nums font-mono ${mutedText}`}>
                      {Math.round(settings.textScale * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs">A</span>
                    <input
                      type="range"
                      min={88}
                      max={116}
                      step={4}
                      value={Math.round(settings.textScale * 100)}
                      onChange={(e) =>
                        onUpdate({ textScale: Number(e.target.value) / 100 })
                      }
                      className="flex-1 accent-blue-500"
                    />
                    <span className="text-base font-semibold">A</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-bold">Bold Text</span>
                  {renderSwitch(settings.boldText, (v) => onUpdate({ boldText: v }))}
                </div>
              </div>

              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="py-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-sm">Brightness</span>
                    <span className={`tabular-nums ${mutedText}`}>{settings.brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={100}
                    value={settings.brightness}
                    onChange={(e) => onUpdate({ brightness: Number(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">True Tone</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Adapts display white point to ambient studio lighting
                    </div>
                  </div>
                  {renderSwitch(settings.trueTone, (v) => onUpdate({ trueTone: v }))}
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">Night Shift</span>
                  {renderSwitch(settings.nightShift, (v) => onUpdate({ nightShift: v }))}
                </div>
                {settings.nightShift && (
                  <div className="py-3 space-y-1.5">
                    <div className="flex justify-between text-[11px] opacity-70">
                      <span>Less Warm</span>
                      <span>More Warm</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={95}
                      value={settings.nightShiftWarmth}
                      onChange={(e) => onUpdate({ nightShiftWarmth: Number(e.target.value) })}
                      className="w-full accent-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Auto-Lock & Raise to Wake */}
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="py-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Auto-Lock</span>
                    <span className={`text-xs tabular-nums ${mutedText}`}>
                      {settings.autoLockSeconds === 0
                        ? 'Never'
                        : `${settings.autoLockSeconds} Seconds`}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { v: 30, label: '30s' },
                        { v: 60, label: '1m' },
                        { v: 120, label: '2m' },
                        { v: 0, label: 'Never' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => onUpdate({ autoLockSeconds: opt.v })}
                        className={`py-1.5 rounded-lg text-xs font-medium tabular-nums ${
                          settings.autoLockSeconds === opt.v
                            ? 'bg-blue-500 text-white'
                            : 'bg-zinc-500/15'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">Raise to Wake</span>
                  {renderSwitch(settings.raiseToWake, (v) => onUpdate({ raiseToWake: v }))}
                </div>
              </div>

              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Always-On Display</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Dims Lock Screen to 1Hz on Pro OLED models
                    </div>
                  </div>
                  {renderSwitch(settings.alwaysOnDisplay, (v) =>
                    onUpdate({ alwaysOnDisplay: v }),
                  )}
                </div>
                {settings.alwaysOnDisplay && (
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm">Show Wallpaper in Always-On</span>
                    {renderSwitch(settings.aodShowWallpaper, (v) =>
                      onUpdate({ aodShowWallpaper: v }),
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        );

      case 'wallpaper':
        return (
          <>
            {renderHeader('Wallpaper & Chassis')}
            <div className="p-4 space-y-4 pb-10">
              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>Emulated iPhone Frame</div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                  {(Object.keys(IPHONE_MODELS) as IPhoneModelId[]).map((mId) => {
                    const m = IPHONE_MODELS[mId];
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          triggerTaptic('selection', settings.systemHaptics, false);
                          onUpdate({ deviceModel: m.id });
                        }}
                        className="w-full flex items-center justify-between py-2.5 text-left"
                      >
                        <div>
                          <div className="text-sm font-medium">{m.name}</div>
                          <div className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
                            {m.logicalWidth}×{m.logicalHeight}pt · @{m.dpr}x · {m.diagonal}
                          </div>
                        </div>
                        {settings.deviceModel === m.id && (
                          <span className="text-xs font-semibold text-blue-500">Active</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>iOS 18 Wallpaper</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onUpdate({ wallpaperId: 'titanium' })}
                    className={`p-3 rounded-2xl border text-left ${cardBg} ${
                      settings.wallpaperId === 'titanium'
                        ? 'border-blue-500 ring-2 ring-blue-500/25'
                        : 'border-current/10'
                    }`}
                  >
                    <div className="h-24 rounded-xl bg-gradient-to-br from-stone-900 via-amber-900/60 to-black mb-2" />
                    <div className="text-xs font-semibold">Desert Titanium</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate({ wallpaperId: 'aurora' })}
                    className={`p-3 rounded-2xl border text-left ${cardBg} ${
                      settings.wallpaperId === 'aurora'
                        ? 'border-blue-500 ring-2 ring-blue-500/25'
                        : 'border-current/10'
                    }`}
                  >
                    <div className="h-24 rounded-xl bg-gradient-to-br from-blue-900 via-slate-400 to-rose-300 mb-2" />
                    <div className="text-xs font-semibold">Sapphire Aurora</div>
                  </button>
                </div>
              </div>

              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>Hardware Band Finish</div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                  {Object.values(TITANIUM_FINISHES).map((spec) => (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => onUpdate({ chassisFinish: spec.id })}
                      className="w-full flex items-center justify-between py-3 text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ background: spec.cssBandGradient }}
                        />
                        <span>{spec.label}</span>
                      </div>
                      {settings.chassisFinish === spec.id && (
                        <span className="text-xs font-semibold text-blue-500">Selected</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );

      case 'standby':
        return (
          <>
            {renderHeader('StandBy')}
            <div className="p-4 space-y-4">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">StandBy</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Activates automatically when iPhone is Locked + Landscape + Charging
                    </div>
                  </div>
                  {renderSwitch(settings.standByEnabled, (v) =>
                    onUpdate({ standByEnabled: v }),
                  )}
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">Night Mode (Red Tint)</span>
                  {renderSwitch(settings.standByNightRed, (v) =>
                    onUpdate({ standByNightRed: v }),
                  )}
                </div>
              </div>
            </div>
          </>
        );

      case 'sounds':
        return (
          <>
            {renderHeader('Sounds & Haptics')}
            <div className="p-4 space-y-4 pb-10">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-rose-500" />
                    <span className="text-sm">Silent Mode</span>
                  </div>
                  {renderSwitch(settings.silentMode, (v) => onUpdate({ silentMode: v }))}
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Play Haptics in Silent Mode</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Fires Taptic detents even when Ringer is muted
                    </div>
                  </div>
                  {renderSwitch(settings.hapticsPlayInSilent, (v) =>
                    onUpdate({ hapticsPlayInSilent: v }),
                  )}
                </div>
                <div className="py-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-sm">Ringer and Alerts</span>
                    <span className={`tabular-nums ${mutedText}`}>{settings.ringerVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.ringerVolume}
                    onChange={(e) => {
                      onUpdate({ ringerVolume: Number(e.target.value) });
                      triggerTaptic('light', settings.systemHaptics, !settings.silentMode);
                    }}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>

              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">Keyboard Clicks</span>
                  {renderSwitch(settings.keyboardClicks, (v) =>
                    onUpdate({ keyboardClicks: v }),
                  )}
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">Keyboard Haptics</span>
                  {renderSwitch(settings.keyboardHaptics, (v) =>
                    onUpdate({ keyboardHaptics: v }),
                  )}
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">Lock Sound</span>
                  {renderSwitch(settings.lockSoundEnabled, (v) =>
                    onUpdate({ lockSoundEnabled: v }),
                  )}
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">System Haptics</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Linear Resonant Actuator detents for switches & controls
                    </div>
                  </div>
                  {renderSwitch(settings.systemHaptics, (v) => onUpdate({ systemHaptics: v }))}
                </div>
              </div>
            </div>
          </>
        );

      case 'focus':
        return (
          <>
            {renderHeader('Focus')}
            <div className="p-4 space-y-3">
              {(
                [
                  { id: 'off', label: 'Off (Normal Alerts)' },
                  { id: 'dnd', label: 'Do Not Disturb' },
                  { id: 'work', label: 'Work Focus' },
                  { id: 'sleep', label: 'Sleep Focus' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onUpdate({ focusMode: f.id })}
                  className={`w-full ${cardBg} rounded-2xl p-3.5 flex items-center justify-between text-sm`}
                >
                  <span className="font-medium">{f.label}</span>
                  {settings.focusMode === f.id && (
                    <span className="text-xs font-semibold text-indigo-400">Active</span>
                  )}
                </button>
              ))}
            </div>
          </>
        );

      /* =====================================================================
       * FULL iOS 18 ACCESSIBILITY SUITE (Vision, Physical/Motor, Hearing, General)
       * =================================================================== */
      case 'accessibility':
        return (
          <>
            {renderHeader('Accessibility')}
            <div className="p-4 space-y-4 pb-12">
              {/* Vision */}
              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>Vision</div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => goPage('ax-display')}
                    className="w-full flex items-center justify-between px-3.5 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                        <Type className="w-4 h-4" />
                      </div>
                      <span>Display & Text Size</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goPage('ax-zoom')}
                    className="w-full flex items-center justify-between px-3.5 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                        <ZoomIn className="w-4 h-4" />
                      </div>
                      <span>Zoom</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs ${mutedText}`}>
                        {settings.accessibilityZoom ? 'On' : 'Off'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </div>
                  </button>
                </div>
              </div>

              {/* Physical and Motor */}
              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>Physical and Motor</div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => goPage('ax-touch')}
                    className="w-full flex items-center justify-between px-3.5 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center text-white">
                        <Hand className="w-4 h-4" />
                      </div>
                      <span>Touch & Back Tap</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goPage('ax-motion')}
                    className="w-full flex items-center justify-between px-3.5 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                        <Eye className="w-4 h-4" />
                      </div>
                      <span>Motion & Eye Tracking</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
              </div>

              {/* Hearing */}
              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>Hearing</div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => goPage('ax-hearing')}
                    className="w-full flex items-center justify-between px-3.5 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                        <Ear className="w-4 h-4" />
                      </div>
                      <span>Audio & Background Sounds</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs ${mutedText}`}>
                        {settings.backgroundSounds ? settings.backgroundSoundType : 'Off'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </div>
                  </button>
                </div>
              </div>

              {/* General: Guided Access & Triple-Click Accessibility Shortcut */}
              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>General</div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => goPage('ax-shortcut')}
                    className="w-full flex items-center justify-between px-3.5 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                        <Accessibility className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div>Accessibility Shortcut & Guided Access</div>
                        <div className={`text-[11px] ${mutedText}`}>
                          Triple-click {modelSpec.hasHomeButton ? 'Home' : 'Side'} Button
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          </>
        );

      case 'ax-display':
        return (
          <>
            {renderHeader('Display & Text Size', 'accessibility', 'Accessibility')}
            <div className="p-4 space-y-4 pb-12">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-bold">Bold Text</span>
                  {renderSwitch(settings.boldText, (v) => onUpdate({ boldText: v }))}
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Button Shapes</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Underlines & tints navigation action buttons
                    </div>
                  </div>
                  {renderSwitch(settings.buttonShapes, (v) => onUpdate({ buttonShapes: v }))}
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">On/Off Labels</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Draws | and ○ indicators inside every iOS switch
                    </div>
                  </div>
                  {renderSwitch(settings.onOffLabels, (v) => onUpdate({ onOffLabels: v }))}
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Reduce Transparency</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Makes Dock, Control Center & banners solid opaque
                    </div>
                  </div>
                  {renderSwitch(settings.reduceTransparency, (v) =>
                    onUpdate({ reduceTransparency: v }),
                  )}
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">Increase Contrast</span>
                  {renderSwitch(settings.increaseContrast, (v) =>
                    onUpdate({ increaseContrast: v }),
                  )}
                </div>
              </div>

              {/* Invert Colors */}
              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>Invert & White Point</div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm">Smart Invert</div>
                      <div className={`text-[11px] ${mutedText}`}>
                        Reverses UI colors while keeping wallpaper & photos natural
                      </div>
                    </div>
                    {renderSwitch(settings.smartInvert, (v) =>
                      onUpdate({ smartInvert: v, classicInvert: v ? false : settings.classicInvert }),
                    )}
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm">Classic Invert</span>
                    {renderSwitch(settings.classicInvert, (v) =>
                      onUpdate({ classicInvert: v, smartInvert: v ? false : settings.smartInvert }),
                    )}
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm">Reduce White Point</div>
                      <div className={`text-[11px] ${mutedText}`}>
                        Reduces intensity of bright colors below minimum brightness
                      </div>
                    </div>
                    {renderSwitch(settings.reduceWhitePoint, (v) =>
                      onUpdate({ reduceWhitePoint: v }),
                    )}
                  </div>
                  {settings.reduceWhitePoint && (
                    <div className="py-3 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span>Intensity</span>
                        <span className={`tabular-nums font-mono ${mutedText}`}>
                          {settings.reduceWhitePointIntensity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={25}
                        max={95}
                        value={settings.reduceWhitePointIntensity}
                        onChange={(e) =>
                          onUpdate({ reduceWhitePointIntensity: Number(e.target.value) })
                        }
                        className="w-full accent-blue-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Color Filters */}
              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>Color Filters</div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                  {(
                    [
                      { id: 'none', label: 'Off (True Display P3)' },
                      { id: 'grayscale', label: 'Grayscale' },
                      { id: 'protanopia', label: 'Red/Green Filter (Protanopia)' },
                      { id: 'deuteranopia', label: 'Green/Red Filter (Deuteranopia)' },
                      { id: 'tritanopia', label: 'Blue/Yellow Filter (Tritanopia)' },
                    ] as Array<{ id: ColorFilterMode; label: string }>
                  ).map((cf) => (
                    <button
                      key={cf.id}
                      type="button"
                      onClick={() => onUpdate({ colorFilter: cf.id })}
                      className="w-full flex items-center justify-between py-3 text-sm"
                    >
                      <span>{cf.label}</span>
                      {settings.colorFilter === cf.id && (
                        <Check className="w-4 h-4 text-blue-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );

      case 'ax-zoom':
        return (
          <>
            {renderHeader('Zoom', 'accessibility', 'Accessibility')}
            <div className="p-4 space-y-4">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Zoom</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Magnifies the screen & spawns the floating iOS Zoom controller
                    </div>
                  </div>
                  {renderSwitch(settings.accessibilityZoom, (v) =>
                    onUpdate({ accessibilityZoom: v }),
                  )}
                </div>
                <div className="py-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-sm">Maximum Zoom Level</span>
                    <span className={`font-mono tabular-nums ${mutedText}`}>
                      {settings.accessibilityZoomLevel.toFixed(2)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min={125}
                    max={240}
                    step={5}
                    value={Math.round(settings.accessibilityZoomLevel * 100)}
                    onChange={(e) =>
                      onUpdate({ accessibilityZoomLevel: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            </div>
          </>
        );

      case 'ax-touch': {
        const backTapOptions: Array<{ id: BackTapAction; label: string }> = [
          { id: 'none', label: 'None' },
          { id: 'screenshot', label: 'Screenshot' },
          { id: 'flashlight', label: 'Flashlight' },
          { id: 'control-center', label: 'Control Center' },
          { id: 'reachability', label: 'Reachability' },
          { id: 'accessibility-shortcut', label: 'Accessibility Shortcut' },
          { id: 'safari', label: 'Open Safari' },
          { id: 'camera', label: 'Open Camera' },
        ];

        return (
          <>
            {renderHeader('Touch', 'accessibility', 'Accessibility')}
            <div className="p-4 space-y-4 pb-12">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">AssistiveTouch</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Floating magnetic on-screen hardware puck
                    </div>
                  </div>
                  {renderSwitch(settings.assistiveTouchEnabled, (v) =>
                    onUpdate({ assistiveTouchEnabled: v }),
                  )}
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Reachability</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Swipe down on bottom Home Bar to lower top of screen
                    </div>
                  </div>
                  {renderSwitch(settings.reachabilityEnabled, (v) =>
                    onUpdate({ reachabilityEnabled: v }),
                  )}
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Tap to Wake</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Wake sleeping screen by tapping OLED panel
                    </div>
                  </div>
                  {renderSwitch(settings.tapToWake, (v) => onUpdate({ tapToWake: v }))}
                </div>
              </div>

              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>
                  Back Tap (Double-Tap Rear Frame Bezel or Legend Trigger)
                </div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                  <div className="py-3 space-y-1.5">
                    <div className="text-xs font-semibold">Double Tap Action</div>
                    <div className="flex flex-wrap gap-1.5">
                      {backTapOptions.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onUpdate({ backTapDouble: opt.id })}
                          className={`px-2.5 py-1 rounded-lg text-xs ${
                            settings.backTapDouble === opt.id
                              ? 'bg-blue-500 text-white font-semibold'
                              : 'bg-zinc-500/15'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="py-3 space-y-1.5">
                    <div className="text-xs font-semibold">Triple Tap Action</div>
                    <div className="flex flex-wrap gap-1.5">
                      {backTapOptions.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onUpdate({ backTapTriple: opt.id })}
                          className={`px-2.5 py-1 rounded-lg text-xs ${
                            settings.backTapTriple === opt.id
                              ? 'bg-blue-500 text-white font-semibold'
                              : 'bg-zinc-500/15'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      }

      case 'ax-motion':
        return (
          <>
            {renderHeader('Motion & Eye Tracking', 'accessibility', 'Accessibility')}
            <div className="p-4 space-y-4">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm">Reduce Motion</span>
                  {renderSwitch(settings.reduceMotion, (v) => onUpdate({ reduceMotion: v }))}
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Show Vehicle Motion Cues</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      iOS 18 animated screen-edge dots that shift with device tilt
                    </div>
                  </div>
                  {renderSwitch(settings.vehicleMotionCues, (v) =>
                    onUpdate({ vehicleMotionCues: v }),
                  )}
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Eye Tracking</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Displays on-screen gaze tracking reticle ring
                    </div>
                  </div>
                  {renderSwitch(settings.eyeTrackingEnabled, (v) =>
                    onUpdate({ eyeTrackingEnabled: v }),
                  )}
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Limit Frame Rate</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Sets maximum display refresh rate to 60 fps
                    </div>
                  </div>
                  {renderSwitch(settings.limitFrameRate60Hz, (v) => {
                    onUpdate({ limitFrameRate60Hz: v });
                    applyFrameRateThrottle(settings.lowPowerMode, v);
                  })}
                </div>
              </div>
            </div>
          </>
        );

      case 'ax-hearing':
        return (
          <>
            {renderHeader('Audio & Visual', 'accessibility', 'Accessibility')}
            <div className="p-4 space-y-4">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Background Sounds</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Plays calming ambient sound via Web Audio synthesizer
                    </div>
                  </div>
                  {renderSwitch(settings.backgroundSounds, (v) =>
                    onUpdate({ backgroundSounds: v }),
                  )}
                </div>
                <div className="py-3 space-y-2">
                  <div className="text-xs font-medium">Sound Profile</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'rain', label: 'Rain' },
                        { id: 'ocean', label: 'Ocean' },
                        { id: 'dark-noise', label: 'Dark Noise' },
                      ] as Array<{ id: BackgroundSoundId; label: string }>
                    ).map((snd) => (
                      <button
                        key={snd.id}
                        type="button"
                        onClick={() => onUpdate({ backgroundSoundType: snd.id })}
                        className={`py-2 rounded-xl text-xs font-medium ${
                          settings.backgroundSoundType === snd.id
                            ? 'bg-blue-500 text-white'
                            : 'bg-zinc-500/15'
                        }`}
                      >
                        {snd.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">LED Flash for Alerts</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Strobes rear True Tone camera flash when timers or alerts fire
                    </div>
                  </div>
                  {renderSwitch(settings.ledFlashForAlerts, (v) =>
                    onUpdate({ ledFlashForAlerts: v }),
                  )}
                </div>
              </div>
            </div>
          </>
        );

      case 'ax-shortcut':
        return (
          <>
            {renderHeader('Accessibility Shortcut', 'accessibility', 'Accessibility')}
            <div className="p-4 space-y-4 pb-12">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium">Guided Access</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Keeps iPhone locked in a single app; triple-click Side Button to exit
                    </div>
                  </div>
                  {renderSwitch(settings.guidedAccessEnabled, (v) =>
                    onUpdate({ guidedAccessEnabled: v }),
                  )}
                </div>
              </div>

              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>
                  Triple-Click the {modelSpec.hasHomeButton ? 'Home' : 'Side'} Button For:
                </div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                  {ACCESSIBILITY_SHORTCUT_DEFS.map((item) => {
                    const checked = settings.accessibilityShortcutTargets.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleShortcutTarget(item.id)}
                        className="w-full py-3 flex items-center justify-between gap-3 text-left"
                      >
                        <div>
                          <div className="text-sm font-medium">{item.label}</div>
                          <div className={`text-[11px] ${mutedText}`}>{item.description}</div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                            checked
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'border-zinc-500/40'
                          }`}
                        >
                          {checked && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className={`text-[11px] px-2 pt-2 leading-relaxed ${mutedText}`}>
                  If 1 option is selected, triple-clicking toggles it immediately. If multiple options are selected, triple-clicking opens the iOS Accessibility Shortcut menu sheet.
                </p>
              </div>
            </div>
          </>
        );

      case 'safari':
        return (
          <>
            {renderHeader('Safari')}
            <div className="p-4 space-y-4">
              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>Search Engine</div>
                <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                  {(
                    [
                      { id: 'wikipedia', label: 'Wikipedia Search' },
                      { id: 'duckduckgo', label: 'DuckDuckGo HTML' },
                      { id: 'bing', label: 'Bing Mobile' },
                    ] as const
                  ).map((eng) => (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() => onUpdate({ safariSearchEngine: eng.id })}
                      className="w-full flex items-center justify-between py-3 text-sm"
                    >
                      <span>{eng.label}</span>
                      {settings.safariSearchEngine === eng.id && (
                        <span className="text-xs font-semibold text-blue-500">Default</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className={`text-xs px-2 pb-1.5 ${mutedText}`}>Tabs Layout</div>
                <div className={`${cardBg} rounded-2xl p-3.5 grid grid-cols-2 gap-3`}>
                  <button
                    type="button"
                    onClick={() => onUpdate({ safariAddressBarLayout: 'bottom' })}
                    className={`p-3 rounded-xl border text-center space-y-1.5 ${
                      settings.safariAddressBarLayout === 'bottom'
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-current/10'
                    }`}
                  >
                    <Sliders className="w-4 h-4 mx-auto opacity-70" />
                    <div className="text-xs font-medium">Tab Bar (Bottom)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate({ safariAddressBarLayout: 'top' })}
                    className={`p-3 rounded-xl border text-center space-y-1.5 ${
                      settings.safariAddressBarLayout === 'top'
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-current/10'
                    }`}
                  >
                    <Sliders className="w-4 h-4 mx-auto opacity-70 rotate-180" />
                    <div className="text-xs font-medium">Single Tab (Top)</div>
                  </button>
                </div>
              </div>

              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5`}>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm">Mobile Safari Proxy Engine</div>
                    <div className={`text-[11px] ${mutedText}`}>
                      Bypasses X-Frame-Options so real external URLs render inside Safari
                    </div>
                  </div>
                  {renderSwitch(settings.safariUseProxy, (v) =>
                    onUpdate({ safariUseProxy: v }),
                  )}
                </div>
              </div>
            </div>
          </>
        );

      case 'about':
        return (
          <>
            {renderHeader('About')}
            <div className="p-4 space-y-4">
              <div className={`${cardBg} rounded-2xl divide-y ${dividerCls} px-3.5 text-sm`}>
                <div className="flex items-center justify-between py-3">
                  <span>Name</span>
                  <span className={mutedText}>{modelSpec.name}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span>iOS Version</span>
                  <span className={`tabular-nums ${mutedText}`}>18.1 (22B83)</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span>Model Name</span>
                  <span className={mutedText}>{modelSpec.name}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span>Viewport & Pixel Ratio</span>
                  <span className={`font-mono text-xs tabular-nums ${mutedText}`}>
                    {modelSpec.logicalWidth}×{modelSpec.logicalHeight} (@{modelSpec.dpr}x)
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span>Physical Resolution</span>
                  <span className={`font-mono text-xs tabular-nums ${mutedText}`}>
                    {modelSpec.physicalResolution}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerTaptic('light', settings.systemHaptics, false);
                    setShowHardwareModelCode((v) => !v);
                  }}
                  className="w-full flex items-center justify-between py-3"
                >
                  <span>Model Number</span>
                  <span className={`font-mono text-xs ${mutedText}`}>
                    {showHardwareModelCode
                      ? modelSpec.modelNumberSku
                      : modelSpec.modelNumberRetail}
                  </span>
                </button>
                <div className="flex items-center justify-between py-3">
                  <span>Serial Number</span>
                  <span className={`font-mono text-xs ${mutedText}`}>K9W7X4Q2MV</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span>Capacity</span>
                  <span className={`tabular-nums ${mutedText}`}>256 GB</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerTaptic('warning', true, true);
                  onUpdate(DEFAULT_IOS_SETTINGS);
                  applyFrameRateThrottle(false, false);
                }}
                className={`w-full ${cardBg} rounded-2xl py-3 text-sm font-medium text-rose-500 text-center`}
              >
                Reset All Settings to Factory Defaults
              </button>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={scrollRef}
      className={`w-full h-full overflow-y-auto no-scrollbar select-none ${pageBg}`}
    >
      {route === 'root' ? renderRoot() : renderSubPage()}
    </div>
  );
});

export default SettingsApp;
