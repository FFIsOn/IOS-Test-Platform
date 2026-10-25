'use client';

import React, { useState } from 'react';
import {
  Activity,
  Code2,
  Crosshair,
  Hand,
  Play,
  Search,
  Terminal,
  Trash2,
  Wifi,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  IPHONE_MODELS,
  NETWORK_PROFILES,
  type DevConsoleEntry,
  type DevDomNodeSummary,
  type DevInspectedElement,
  type DevNetworkEntry,
  type HapticEventEntry,
  type IOSSystemSettings,
  type NetworkProfileId,
} from '@/lib/core/iosState';

interface DeveloperInspectorProps {
  settings: IOSSystemSettings;
  onUpdateSettings: (patch: Partial<IOSSystemSettings>) => void;
  inspectElementActive: boolean;
  onToggleInspectElement: (next: boolean) => void;
  domNodes: DevDomNodeSummary[];
  inspectedElement: DevInspectedElement | null;
  onSelectDomSelector: (selector: string) => void;
  consoleEntries: DevConsoleEntry[];
  onClearConsole: () => void;
  onEvalJavaScript: (code: string) => void;
  networkEntries: DevNetworkEntry[];
  onClearNetwork: () => void;
  hapticEvents: HapticEventEntry[];
  onClose: () => void;
}

export default function DeveloperInspector({
  settings,
  onUpdateSettings,
  inspectElementActive,
  onToggleInspectElement,
  domNodes,
  inspectedElement,
  onSelectDomSelector,
  consoleEntries,
  onClearConsole,
  onEvalJavaScript,
  networkEntries,
  onClearNetwork,
  hapticEvents,
  onClose,
}: DeveloperInspectorProps) {
  const [activeTab, setActiveTab] = useState<'elements' | 'console' | 'network'>('elements');
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'error' | 'warn' | 'log'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replInput, setReplInput] = useState<string>('navigator.userAgent');

  const modelSpec = IPHONE_MODELS[settings.deviceModel];
  const filteredConsole = consoleEntries.filter((entry) => {
    const levelOk =
      consoleFilter === 'all' ||
      entry.level === consoleFilter ||
      (consoleFilter === 'log' && (entry.level === 'info' || entry.level === 'result'));
    const queryOk =
      !searchQuery.trim() ||
      entry.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.source.toLowerCase().includes(searchQuery.toLowerCase());
    return levelOk && queryOk;
  });

  return (
    <aside className="w-full lg:w-[470px] xl:w-[520px] h-[540px] lg:h-[calc(100vh-132px)] max-h-[760px] bg-[#0F131A] border border-white/10 rounded-xl flex flex-col overflow-hidden pointer-events-auto shrink-0 shadow-2xl">
      {/* Top Inspector Header & Tabs */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-[#141922]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleInspectElement(!inspectElementActive)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              inspectElementActive
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Hover & Click HTML Elements Inside Safari to Inspect"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{inspectElementActive ? 'Inspecting...' : 'Inspect'}</span>
          </button>

          <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg ml-1">
            <button
              type="button"
              onClick={() => setActiveTab('elements')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'elements' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Elements</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('console')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'console' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Console</span>
              {consoleEntries.length > 0 && (
                <span className="text-[10px] font-mono tabular-nums opacity-70">
                  ({consoleEntries.length})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('network')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap ${
                activeTab === 'network' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Network & Touch</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10"
          title="Close Developer Mode"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sub-header Device Viewport Readout */}
      <div className="px-3.5 py-1.5 bg-[#0B0E14] border-b border-white/10 flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
        <span>
          {modelSpec.name} · {modelSpec.logicalWidth}×{modelSpec.logicalHeight}pt @{modelSpec.dpr}x
        </span>
        <span>
          Net: {NETWORK_PROFILES[settings.networkProfile].label} ({NETWORK_PROFILES[settings.networkProfile].rttMs}ms)
        </span>
      </div>

      {/* =====================================================================
       * TAB 1: HTML ELEMENTS & COMPUTED STYLES INSPECTOR
       * =================================================================== */}
      {activeTab === 'elements' && (
        <div className="flex-1 flex flex-col min-h-0 divide-y divide-white/10">
          {/* Upper Half: Live DOM Tree */}
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
            {domNodes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 text-slate-400 font-sans">
                <Code2 className="w-7 h-7 mb-2 opacity-40" />
                <p className="text-xs font-medium text-slate-200 mb-1">
                  No Web Document Loaded Yet
                </p>
                <p className="text-[11px] leading-relaxed">
                  Open Safari on the iPhone and visit any website (or click a Favorite) to inspect its live HTML DOM tree and computed CSS styles.
                </p>
              </div>
            ) : (
              domNodes.map((node, idx) => (
                <button
                  key={`${node.selector}-${idx}`}
                  type="button"
                  onClick={() => onSelectDomSelector(node.selector)}
                  style={{ paddingLeft: `${Math.min(node.depth * 12, 72) + 6}px` }}
                  className={`w-full text-left py-1 pr-2 rounded hover:bg-blue-500/15 flex items-baseline gap-1.5 truncate ${
                    inspectedElement?.selector === node.selector
                      ? 'bg-blue-500/20 text-blue-200'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="text-sky-400">&lt;{node.tag}</span>
                  {node.id && <span className="text-amber-300">#{node.id}</span>}
                  {node.classes && (
                    <span className="text-emerald-400 truncate max-w-[150px]">
                      .{node.classes.split(/\s+/).join('.')}
                    </span>
                  )}
                  <span className="text-sky-400">&gt;</span>
                  {node.textPreview && (
                    <span className="text-slate-500 truncate text-[11px]">{node.textPreview}</span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Lower Half: Selected Element Box Metrics & Computed CSS */}
          <div className="h-[220px] overflow-y-auto p-3.5 bg-[#0B0E14] text-xs space-y-2.5">
            {inspectedElement ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-sky-400 truncate">
                    {inspectedElement.selector}
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-amber-300 shrink-0">
                    {inspectedElement.width} × {inspectedElement.height} px @ ({inspectedElement.left},{' '}
                    {inspectedElement.top})
                  </span>
                </div>

                {inspectedElement.attributes.length > 0 && (
                  <div className="text-[11px] font-mono text-slate-400 space-x-2 truncate">
                    {inspectedElement.attributes.map((a) => (
                      <span key={a.name}>
                        <span className="text-purple-300">{a.name}</span>=&quot;{a.value}&quot;
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-white/10 font-mono text-[11px]">
                  {Object.entries(inspectedElement.computedStyles).map(([prop, val]) => (
                    <div key={prop} className="flex items-center justify-between gap-2 truncate">
                      <span className="text-slate-400">{prop}:</span>
                      <span className="text-slate-200 truncate tabular-nums">{val}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs text-center px-4">
                Click &ldquo;Inspect&rdquo; in the top-left and hover/click any element inside Safari (or select a node above) to view box dimensions &amp; computed CSS.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
       * TAB 2: JAVASCRIPT CONSOLE & INTERACTIVE REPL
       * =================================================================== */}
      {activeTab === 'console' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Console Filter Bar */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1 bg-black/40 border border-white/10 rounded-md px-2 h-7">
              <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter logs..."
                className="bg-transparent text-xs outline-none flex-1 min-w-0 text-slate-200"
              />
            </div>

            <div className="flex items-center gap-1 text-[11px]">
              {(['all', 'error', 'warn', 'log'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setConsoleFilter(lvl)}
                  className={`px-2 py-1 rounded capitalize ${
                    consoleFilter === lvl
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClearConsole}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              title="Clear Console"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Log Stream */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5 font-mono text-xs">
            {filteredConsole.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 font-sans text-xs px-6 text-center">
                No JavaScript console messages matching filter. Run an expression below or browse a page in Safari.
              </div>
            ) : (
              filteredConsole.map((item) => (
                <div
                  key={item.id}
                  className={`px-3 py-2 flex items-start justify-between gap-3 ${
                    item.level === 'error'
                      ? 'bg-red-950/30 text-red-300'
                      : item.level === 'warn'
                        ? 'bg-amber-950/25 text-amber-200'
                        : item.level === 'result'
                          ? 'bg-blue-950/20 text-sky-300'
                          : 'text-slate-200'
                  }`}
                >
                  <span className="break-all leading-relaxed">{item.message}</span>
                  <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                    {item.timestamp}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Live JS REPL Prompt */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!replInput.trim()) return;
              onEvalJavaScript(replInput.trim());
            }}
            className="p-2.5 bg-[#141922] border-t border-white/10 flex items-center gap-2 font-mono text-xs"
          >
            <span className="text-blue-400 font-bold">&gt;</span>
            <input
              type="text"
              value={replInput}
              onChange={(e) => setReplInput(e.target.value)}
              placeholder="Evaluate JS in Safari (e.g. document.title)"
              className="flex-1 bg-transparent outline-none text-slate-100 min-w-0"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-sans text-[11px] font-semibold flex items-center gap-1 shrink-0"
            >
              <Play className="w-3 h-3" />
              <span>Run</span>
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
       * TAB 3: NETWORK SPEED THROTTLING, TOUCH/PINCH SIMULATOR & HAPTIC LOG
       * =================================================================== */}
      {activeTab === 'network' && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
          {/* Network Throttling Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">
                Network Link Conditioner (Real Proxy Throttling)
              </span>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                {NETWORK_PROFILES[settings.networkProfile].downlinkLabel}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {(Object.keys(NETWORK_PROFILES) as NetworkProfileId[]).map((pid) => {
                const prof = NETWORK_PROFILES[pid];
                const active = settings.networkProfile === pid;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        networkProfile: pid,
                        airplaneMode: pid === 'offline',
                        wifiEnabled: pid === 'wifi',
                        cellularEnabled: pid !== 'offline',
                        cellularMode: pid === 'lte' ? 'LTE' : '5G UW',
                      })
                    }
                    className={`p-2 rounded-lg border text-center transition-colors ${
                      active
                        ? 'bg-blue-600/25 border-blue-500 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-semibold truncate">{prof.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                      {prof.rttMs}ms
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Realistic Touch & Multi-Touch Pinch-to-Zoom Controls */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="font-semibold text-slate-200">
              Capacitive Touch &amp; Multi-Touch Gesture Simulation
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ showTouchIndicators: !settings.showTouchIndicators })
                }
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  settings.showTouchIndicators
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Hand className="w-3.5 h-3.5" />
                  <span>Touch Contact Ripples</span>
                </span>
                <span className="text-[10px] font-bold uppercase">
                  {settings.showTouchIndicators ? 'On' : 'Off'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ pinchModeEnabled: !settings.pinchModeEnabled })
                }
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  settings.pinchModeEnabled
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                    : 'bg-white/5 border-white/10 text-slate-300'
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>2-Finger Pinch (or Alt)</span>
                </span>
                <span className="text-[10px] font-bold uppercase">
                  {settings.pinchModeEnabled ? 'Active' : 'Hold Alt'}
                </span>
              </button>
            </div>
          </div>

          {/* Network Requests Waterfall Table */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">HTTP Proxy Requests</span>
              <button
                type="button"
                onClick={onClearNetwork}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Clear
              </button>
            </div>

            {networkEntries.length === 0 ? (
              <div className="py-5 text-center text-slate-500 border border-white/5 rounded-lg">
                Navigate to any URL in Safari to measure throttled TTFB &amp; payload transfer.
              </div>
            ) : (
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <table className="w-full text-left font-mono text-[11px] tabular-nums">
                  <thead className="bg-white/5 text-slate-400">
                    <tr>
                      <th className="py-1.5 px-2.5">Status</th>
                      <th className="py-1.5 px-2.5">Host / Path</th>
                      <th className="py-1.5 px-2.5 text-right">Size</th>
                      <th className="py-1.5 px-2.5 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {networkEntries.map((req) => (
                      <tr key={req.id} className="hover:bg-white/5">
                        <td
                          className={`py-1.5 px-2.5 font-semibold ${
                            req.status >= 200 && req.status < 400
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {req.status || 'ERR'}
                        </td>
                        <td className="py-1.5 px-2.5 truncate max-w-[180px] text-slate-200">
                          {req.url.replace(/^https?:\/\//, '')}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-400">
                          {(req.sizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-amber-300">
                          {req.durationMs} ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Live Haptic Feedback Telemetry */}
          <div className="pt-3 border-t border-white/10 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>Taptic Engine Feedback Events</span>
            </div>
            <div className="space-y-1 font-mono text-[11px] text-slate-400 tabular-nums">
              {hapticEvents.length === 0 ? (
                <div className="text-slate-500">Tap buttons, keys, or switches to log LRA impulses.</div>
              ) : (
                hapticEvents.slice(0, 5).map((h) => (
                  <div key={h.id} className="flex items-center justify-between py-0.5">
                    <span className="text-slate-300">{h.generator}</span>
                    <span>{h.timestamp}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
