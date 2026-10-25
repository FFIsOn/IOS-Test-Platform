'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { uniqBy } from 'lodash';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Code2,
  Compass,
  PlugZap,
  RotateCw,
  Smartphone,
  Wifi,
  X,
  ZoomIn,
} from 'lucide-react';
import TitaniumStageCanvas from '@/components/hardware/TitaniumStageCanvas';
import IPhoneDevice, { type IPhoneDeviceHandle } from '@/components/ios/IPhoneDevice';
import HoverOptionsLegend from '@/components/ios/HoverOptionsLegend';
import DeveloperInspector from '@/components/dev/DeveloperInspector';
import {
  DEFAULT_IOS_SETTINGS,
  INITIAL_NOTES,
  INITIAL_PHOTOS,
  IPHONE_MODELS,
  NETWORK_PROFILES,
  type CapturedPhoto,
  type DevConsoleEntry,
  type DevDomNodeSummary,
  type DevInspectedElement,
  type DevNetworkEntry,
  type HapticEventEntry,
  type HomeWebClip,
  type IOSSystemSettings,
  type IPhoneModelId,
  type NoteItem,
} from '@/lib/core/iosState';
import {
  getHardwareMemoryBus,
  SABFloatOffset,
  SABIntOffset,
  subscribeTapticEvents,
  TITANIUM_FINISHES,
  triggerTaptic,
  writeIntSlot,
} from '@/lib/core/hardwareMemory';

export default function SimulatorWorkspace() {
  const [settings, setSettings] = useState<IOSSystemSettings>(DEFAULT_IOS_SETTINGS);
  const [inspect3D, setInspect3D] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [showQuirksGuide, setShowQuirksGuide] = useState<boolean>(false);

  // Built-in Developer Mode & WebKit Inspector State
  const [devModeOpen, setDevModeOpen] = useState<boolean>(false);
  const [inspectElementActive, setInspectElementActive] = useState<boolean>(false);
  const [domNodes, setDomNodes] = useState<DevDomNodeSummary[]>([]);
  const [inspectedElement, setInspectedElement] = useState<DevInspectedElement | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<DevConsoleEntry[]>([
    {
      id: 'boot-1',
      level: 'info',
      message: 'WebKit Remote Inspector attached — select any webpage input to test iOS Keyboard or toggle Inspect Element.',
      source: 'WebKit',
      timestamp: '00:00:00',
    },
  ]);
  const [networkEntries, setNetworkEntries] = useState<DevNetworkEntry[]>([]);
  const [hapticEvents, setHapticEvents] = useState<HapticEventEntry[]>([]);

  // Quick URL Launch from Host Studio Bar -> pushes directly into Mobile Safari
  const [quickUrlInput, setQuickUrlInput] = useState<string>(
    'https://html.duckduckgo.com/html/',
  );

  // Persistent iOS User Data Stores
  const [notes, setNotes] = useState<NoteItem[]>(INITIAL_NOTES);
  const [photos, setPhotos] = useState<CapturedPhoto[]>(INITIAL_PHOTOS);
  const [webClips, setWebClips] = useState<HomeWebClip[]>([]);

  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const deviceRef = useRef<IPhoneDeviceHandle | null>(null);

  // Subscribe to real-time Taptic Engine LRA actuator events for Developer Mode telemetry
  useEffect(() => {
    const unsubscribe = subscribeTapticEvents((generatorLabel, pattern) => {
      setHapticEvents((prev) => [
        {
          id: `hap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          generator: generatorLabel,
          pattern,
          timestamp: new Date().toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        },
        ...prev.slice(0, 39),
      ]);
    });
    return unsubscribe;
  }, []);

  const handleUpdateSettings = useCallback((patch: Partial<IOSSystemSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      const bus = getHardwareMemoryBus();
      writeIntSlot(
        bus.i32,
        SABIntOffset.ORIENTATION_LANDSCAPE,
        next.isLandscape ? 1 : 0,
        bus.isAtomicCapable,
      );
      writeIntSlot(
        bus.i32,
        SABIntOffset.CHARGER_ATTACHED,
        next.isCharging ? 1 : 0,
        bus.isAtomicCapable,
      );
      const skip = next.lowPowerMode || next.limitFrameRate60Hz ? 2 : 1;
      writeIntSlot(bus.i32, SABIntOffset.FRAME_SKIP_MODULO, skip, bus.isAtomicCapable);
      return next;
    });
  }, []);

  // Subtle zero-allocation pointer gyroscope tilt written directly into SharedArrayBuffer
  const handleStagePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const bus = getHardwareMemoryBus();
    const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
    bus.f32[SABFloatOffset.TARGET_TILT_X] = ny * 0.22;
    bus.f32[SABFloatOffset.TARGET_TILT_Y] = nx * 0.28;
  }, []);

  // Keyboard shortcut 'H' to collapse/expand bottom control dock (when not typing in inputs)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Realistic slow battery charge simulation (low tick rate)
  useEffect(() => {
    const id = window.setInterval(() => {
      setSettings((prev) => {
        if (prev.isCharging) {
          if (prev.batteryLevel >= prev.chargeLimit) return prev;
          return { ...prev, batteryLevel: Math.min(prev.chargeLimit, prev.batteryLevel + 1) };
        }
        return prev;
      });
    }, 18000);
    return () => window.clearInterval(id);
  }, []);

  const launchUrlInSafari = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrlInput.trim()) return;
    setInspect3D(false);
    deviceRef.current?.openUrlInSafari(quickUrlInput.trim());
  };

  const activeModel = IPHONE_MODELS[settings.deviceModel];
  const activeNet = NETWORK_PROFILES[settings.networkProfile];

  // Dynamically fit taller Pro Max (932pt) vs compact SE (667pt + chin) inside desktop viewport
  const deviceScaleCls =
    settings.deviceModel === 'iphone-14-pro-max'
      ? 'scale-[0.63] sm:scale-[0.68] md:scale-[0.72] xl:scale-[0.75] 2xl:scale-[0.82]'
      : settings.deviceModel === 'iphone-se'
        ? 'scale-[0.74] sm:scale-[0.80] md:scale-[0.84] xl:scale-[0.88] 2xl:scale-[0.95]'
        : 'scale-[0.68] sm:scale-[0.74] md:scale-[0.78] xl:scale-[0.82] 2xl:scale-[0.90]';

  return (
    <div
      onPointerMove={handleStagePointerMove}
      className="relative w-screen h-screen overflow-hidden bg-[#0B0D10] text-slate-100 flex flex-col justify-between"
    >
      {/* Isolated WebGL 3D Hardware Stage Container */}
      <TitaniumStageCanvas
        deviceModel={settings.deviceModel}
        finishId={settings.chassisFinish}
        inspect3D={inspect3D}
        isLandscape={settings.isLandscape}
        isCharging={settings.isCharging}
        flashlightOn={settings.flashlightOn}
        flashlightIntensity={settings.flashlightIntensity}
      />

      {/* =====================================================================
       * STRICT 3-ZONE TOP BAR CONTRACT (Solid surface — zero backdrop-filter over WebGL)
       * =================================================================== */}
      <header className="relative z-30 flex items-center justify-between gap-8 px-6 py-3 bg-[#0B0D10]/95 border-b border-white/10">
        {/* Zone 1: Single text wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setInspect3D(false);
          }}
          className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          CorePhone Pro
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setInspect3D(false)}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              !inspect3D && !devModeOpen ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            Interactive OS
          </button>
          <button
            type="button"
            onClick={() => {
              setInspect3D(false);
              setDevModeOpen((v) => !v);
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              devModeOpen ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            Developer Mode
          </button>
          <button
            type="button"
            onClick={() => setInspect3D(true)}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              inspect3D ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            3D Chassis
          </button>
          <button
            type="button"
            onClick={() => setShowQuirksGuide(true)}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Hardware Quirks
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerTaptic('warning', true, true);
              handleUpdateSettings(DEFAULT_IOS_SETTINGS);
              setInspectElementActive(false);
              setInspect3D(false);
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-white rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            Reset Device
          </button>
        </div>
      </header>

      {/* =====================================================================
       * MAIN WORKSPACE STAGE (Editorial / Dev Mode + 1:1 iPhone Frame + Transparent-Until-Hovered Legend)
       * =================================================================== */}
      <main className="relative z-20 flex-1 min-h-0 w-full max-w-[1440px] mx-auto px-5 flex items-center justify-between gap-4 pointer-events-none">
        {!inspect3D ? (
          <>
            {devModeOpen ? (
              /* Built-in WebKit Developer Mode Panel (DOM Elements, Network Throttling, JS Console) */
              <DeveloperInspector
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                inspectElementActive={inspectElementActive}
                onToggleInspectElement={setInspectElementActive}
                domNodes={domNodes}
                inspectedElement={inspectedElement}
                onSelectDomSelector={(selector) => deviceRef.current?.queryDomSelector(selector)}
                consoleEntries={consoleEntries}
                onClearConsole={() => setConsoleEntries([])}
                onEvalJavaScript={(code) => deviceRef.current?.evalJavaScript(code)}
                networkEntries={networkEntries}
                onClearNetwork={() => setNetworkEntries([])}
                hapticEvents={hapticEvents}
                onClose={() => {
                  setDevModeOpen(false);
                  setInspectElementActive(false);
                }}
              />
            ) : (
              /* Left Studio Editorial & Direct URL Dispatcher */
              <section className="hidden xl:flex flex-col justify-center w-[360px] shrink-0 space-y-4 pointer-events-auto">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                  <span className="text-slate-200 font-sans font-medium">{activeModel.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {activeModel.logicalWidth}×{activeModel.logicalHeight}pt @{activeModel.dpr}x
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeNet.label}</span>
                </div>

                <h1
                  className="text-3xl font-bold tracking-tight text-white leading-[1.12]"
                  style={{ textWrap: 'balance' }}
                >
                  Zero-lag iOS hardware, touch & WebKit studio in your browser.
                </h1>

                <p className="text-sm text-slate-300 leading-relaxed">
                  Switch between authentic iPhone frames, triple-click the Side Button for the iOS Accessibility Shortcut, hover the ghosted legend on the right for all 39 live 1:1 options, or hold{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs text-white">
                    Alt
                  </kbd>{' '}
                  + drag to pinch-zoom.
                </p>

                {/* Direct Host-to-Safari URL Bar CTA */}
                <form onSubmit={launchUrlInSafari} className="space-y-2 pt-1">
                  <label htmlFor="host-url-bar" className="block text-xs font-medium text-slate-400">
                    Open Any Live URL Inside {activeModel.shortName} Safari
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="host-url-bar"
                      ref={urlInputRef}
                      type="text"
                      value={quickUrlInput}
                      onChange={(e) => setQuickUrlInput(e.target.value)}
                      placeholder="https://example.com or search..."
                      className="flex-1 h-10 px-3.5 rounded-lg bg-[#141820] border border-white/15 text-sm text-white outline-none focus:border-blue-500 min-w-0"
                    />
                    <button
                      type="submit"
                      className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Compass className="w-4 h-4" />
                      <span>Visit URL</span>
                    </button>
                  </div>
                </form>

                {/* Quick Access to Developer Mode */}
                <div className="pt-2 border-t border-white/10 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDevModeOpen(true)}
                    className="px-3.5 py-2 rounded-lg bg-[#141820] hover:bg-[#1b212c] border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Open Web Inspector & Network Throttle</span>
                  </button>
                </div>
              </section>
            )}

            {/* Center Interactive 1:1 iPhone Hardware Frame */}
            <section className="flex-1 flex items-center justify-center pointer-events-auto min-w-0">
              <div className={`origin-center ${deviceScaleCls} transition-transform duration-300`}>
                <IPhoneDevice
                  ref={deviceRef}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  notes={notes}
                  onUpdateNotes={setNotes}
                  photos={photos}
                  onAddPhoto={(photo) => setPhotos((prev) => [photo, ...prev])}
                  webClips={webClips}
                  onAddWebClip={(clip) =>
                    setWebClips((prev) => uniqBy([...prev, clip], 'url'))
                  }
                  onRemoveWebClip={(id) => setWebClips((prev) => prev.filter((c) => c.id !== id))}
                  inspectElementActive={inspectElementActive}
                  onConsoleEntry={(entry) =>
                    setConsoleEntries((prev) => [...prev.slice(-149), entry])
                  }
                  onDomTreeUpdate={setDomNodes}
                  onElementSelected={setInspectedElement}
                  onNetworkEntry={(entry) =>
                    setNetworkEntries((prev) => [entry, ...prev.slice(0, 49)])
                  }
                />
              </div>
            </section>

            {/* Right Main-Screen Master Options Legend (Transparent Until Hovered Over!) */}
            <div className="hidden md:flex items-center">
              <HoverOptionsLegend
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onOpenSettingsRoute={(route) => deviceRef.current?.openSettingsRoute(route)}
                onTriggerAccessibilityShortcut={() =>
                  deviceRef.current?.triggerAccessibilityShortcut()
                }
                onTriggerBackTap={(taps) => deviceRef.current?.triggerBackTap(taps)}
                onTriggerScreenshot={() => deviceRef.current?.triggerScreenshot()}
              />
            </div>
          </>
        ) : (
          /* 3D Chassis Inspection Mode */
          <div className="self-start mt-4 bg-[#12151B]/95 border border-white/10 rounded-xl px-4 py-2.5 pointer-events-auto">
            <div className="text-xs font-semibold text-white">
              360° {activeModel.name} Hardware Stage
            </div>
            <div className="text-[11px] text-slate-400">
              Drag anywhere to orbit · Scroll to zoom · Switch iPhone models or finishes in dock below
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
       * UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK (No backdrop-filter over WebGL!)
       * =================================================================== */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 w-full max-w-[min(1180px,96vw)] flex flex-col items-center pointer-events-none">
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          className="pointer-events-auto mb-1.5 px-3 py-1 rounded-md bg-[#12151B]/95 border border-white/10 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Hardware & Dev Dock (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Dock (H)</span>
            </>
          )}
        </button>

        <div
          className={`pointer-events-auto w-full bg-[#12151B]/95 border border-white/10 rounded-2xl px-3.5 py-2 shadow-2xl flex flex-wrap items-center justify-between gap-2.5 transition-transform duration-200 ${
            dockCollapsed
              ? 'translate-y-[140%] opacity-0 pointer-events-none'
              : 'translate-y-0 opacity-100'
          }`}
        >
          {/* 1. Authentic iPhone Model Frame Selector */}
          <div className="flex items-center gap-1 bg-[#0B0D10] p-1 rounded-xl border border-white/10">
            {(Object.keys(IPHONE_MODELS) as IPhoneModelId[]).map((modelId) => {
              const spec = IPHONE_MODELS[modelId];
              const active = settings.deviceModel === modelId;
              return (
                <button
                  key={modelId}
                  type="button"
                  onClick={() => {
                    triggerTaptic('selection', settings.systemHaptics, false);
                    handleUpdateSettings({ deviceModel: modelId });
                  }}
                  title={`${spec.name} (${spec.logicalWidth}×${spec.logicalHeight}pt @${spec.dpr}x)`}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {spec.shortName}
                </button>
              );
            })}
          </div>

          {/* 2. Chassis Band Finish Swatches */}
          <div className="hidden sm:flex items-center gap-1.5">
            {Object.values(TITANIUM_FINISHES).map((spec) => (
              <button
                key={spec.id}
                type="button"
                onClick={() => {
                  triggerTaptic('selection', settings.systemHaptics, false);
                  handleUpdateSettings({ chassisFinish: spec.id });
                }}
                title={spec.label}
                className={`w-5 h-5 rounded-full border transition-transform ${
                  settings.chassisFinish === spec.id
                    ? 'scale-110 ring-2 ring-blue-500 border-white'
                    : 'border-white/25 opacity-80 hover:opacity-100'
                }`}
                style={{ background: spec.cssBandGradient }}
              />
            ))}
          </div>

          {/* 3. Touch, Network, Hardware & Developer Mode Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Two-Finger Pinch Simulation Toggle */}
            <button
              type="button"
              onClick={() => {
                triggerTaptic('selection', settings.systemHaptics, false);
                handleUpdateSettings({ pinchModeEnabled: !settings.pinchModeEnabled });
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                settings.pinchModeEnabled
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
              }`}
              title="Toggle 2-Finger Pinch-to-Zoom Simulation (or hold Alt/Option + drag on screen)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>{settings.pinchModeEnabled ? 'Pinch Active' : 'Pinch (Alt)'}</span>
            </button>

            {/* Quick Network Speed Cycler */}
            <button
              type="button"
              onClick={() => {
                const order = ['wifi', 'lte', '3g', 'slow-3g', 'offline'] as const;
                const nextIdx = (order.indexOf(settings.networkProfile) + 1) % order.length;
                triggerTaptic('selection', settings.systemHaptics, false);
                handleUpdateSettings({ networkProfile: order[nextIdx] });
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono tabular-nums flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                settings.networkProfile === 'offline'
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : settings.networkProfile !== 'wifi'
                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
              }`}
              title="Click to cycle Network Speed Simulation (Wi-Fi -> LTE -> 3G -> Slow 3G -> Offline)"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>{activeNet.label}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (settings.orientationLocked) {
                  triggerTaptic('warning', settings.systemHaptics, false);
                  return;
                }
                triggerTaptic('light', settings.systemHaptics, false);
                handleUpdateSettings({ isLandscape: !settings.isLandscape });
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Rotate Portrait / Landscape"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{settings.isLandscape ? 'Portrait' : 'Rotate'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const nextCharging = !settings.isCharging;
                handleUpdateSettings({ isCharging: nextCharging });
                if (nextCharging) {
                  deviceRef.current?.notifyChargingStarted();
                }
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                settings.isCharging
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
              }`}
            >
              <PlugZap className="w-3.5 h-3.5" />
              <span>MagSafe</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInspect3D(false);
                deviceRef.current?.triggerScreenshot();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Capture Screenshot"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Screenshot</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInspect3D(false);
                setDevModeOpen((v) => !v);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                devModeOpen
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 hover:bg-white/15 text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Dev Mode</span>
            </button>

            <button
              type="button"
              onClick={() => setInspect3D((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                inspect3D
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{inspect3D ? '1:1 OS' : '3D'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
       * HARDWARE, GESTURES & DEVELOPER QUIRKS GUIDE MODAL
       * =================================================================== */}
      {showQuirksGuide && (
        <div
          onClick={() => setShowQuirksGuide(false)}
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl bg-[#14171F] border border-white/15 p-6 space-y-4 text-slate-200 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-bold text-white">
                iPhone Frame Architecture, Multi-Touch Gestures & Developer Mode
              </h2>
              <button
                type="button"
                onClick={() => setShowQuirksGuide(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-xs leading-relaxed">
              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <div className="font-semibold text-white">4 Authentic iPhone Models</div>
                <p className="text-slate-400">
                  Switch between iPhone 16 Pro (393×852 Dynamic Island + Action Button), 14 Pro Max (430×932 + Silent Switch), iPhone 13 (390×844 Notch), and iPhone SE (375×667 + Touch ID Home Button).
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <div className="font-semibold text-white">Web & Native Pop-Out Keyboard</div>
                <p className="text-slate-400">
                  Clicking any input, search bar, or textarea inside a visited webpage in Safari pops up the iOS Software Keyboard with Safari’s &lt; / &gt; field bar, QuickType, and key-pop magnification.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <div className="font-semibold text-white">Touch, Long-Press & Pinch-to-Zoom</div>
                <p className="text-slate-400">
                  Hold 500ms for Haptic Touch pulses. Hold Alt (Option) + drag—or toggle Pinch in the dock—for Xcode-Simulator dual-touch pinch-to-zoom on webpages and photos.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 space-y-1">
                <div className="font-semibold text-white">WebKit Developer Mode</div>
                <p className="text-slate-400">
                  Inspect live HTML elements & box dimensions inside Safari, throttle network link speed (Wi-Fi, LTE, 3G, Slow 3G, Offline), view JS console logs, and evaluate REPL expressions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
