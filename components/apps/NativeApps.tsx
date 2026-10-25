'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Camera as CameraIcon,
  ChevronLeft,
  Plus,
  RotateCcw,
  Sun,
  Trash2,
} from 'lucide-react';
import {
  IPHONE_MODELS,
  type CapturedPhoto,
  type IOSSystemSettings,
  type NoteItem,
} from '@/lib/core/iosState';
import { triggerTaptic } from '@/lib/core/hardwareMemory';

/* ============================================================================
 * 1. iOS 18 CALCULATOR APP
 * Includes exact iPhone quirk: swipe left/right across display digits to delete!
 * ========================================================================== */
export function CalculatorApp({ settings }: { settings: IOSSystemSettings }) {
  const [display, setDisplay] = useState<string>('0');
  const [expression, setExpression] = useState<string>('');
  const [prevVal, setPrevVal] = useState<number | null>(null);
  const [operator, setOperator] = useState<'+' | '-' | '×' | '÷' | null>(null);
  const [resetNext, setResetNext] = useState<boolean>(false);
  const swipeXRef = useRef<number | null>(null);

  const tapKey = (cb: () => void) => {
    triggerTaptic('keyboard', settings.keyboardHaptics, settings.keyboardClicks);
    cb();
  };

  const handleDigit = (d: string) => {
    tapKey(() => {
      if (resetNext) {
        setDisplay(d === '.' ? '0.' : d);
        setResetNext(false);
        return;
      }
      if (d === '.' && display.includes('.')) return;
      if (display === '0' && d !== '.') setDisplay(d);
      else if (display.length < 11) setDisplay(display + d);
    });
  };

  const compute = (a: number, b: number, op: '+' | '-' | '×' | '÷'): number => {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    return b === 0 ? NaN : a / b;
  };

  const handleOp = (nextOp: '+' | '-' | '×' | '÷') => {
    tapKey(() => {
      const current = parseFloat(display);
      if (prevVal !== null && operator && !resetNext) {
        const res = compute(prevVal, current, operator);
        const formatted = Number.isNaN(res) ? 'Error' : String(Number(res.toPrecision(9)));
        setDisplay(formatted);
        setPrevVal(Number.isNaN(res) ? null : res);
      } else {
        setPrevVal(current);
      }
      setOperator(nextOp);
      setExpression(`${display} ${nextOp}`);
      setResetNext(true);
    });
  };

  const handleEquals = () => {
    tapKey(() => {
      if (prevVal === null || !operator) return;
      const current = parseFloat(display);
      const res = compute(prevVal, current, operator);
      const formatted = Number.isNaN(res) ? 'Error' : String(Number(res.toPrecision(9)));
      setExpression(`${prevVal} ${operator} ${current}`);
      setDisplay(formatted);
      setPrevVal(null);
      setOperator(null);
      setResetNext(true);
    });
  };

  const handleBackspaceSwipe = () => {
    if (resetNext || display === 'Error') return;
    triggerTaptic('light', settings.systemHaptics, false);
    if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  return (
    <div className="w-full h-full bg-black text-white flex flex-col justify-end px-4 pb-10 pt-14 select-none">
      {/* Swipe-on-display-to-backspace region (Authentic iOS Calculator Quirk!) */}
      <div
        onMouseDown={(e) => {
          swipeXRef.current = e.clientX;
        }}
        onMouseUp={(e) => {
          if (swipeXRef.current !== null && Math.abs(e.clientX - swipeXRef.current) > 26) {
            handleBackspaceSwipe();
          }
          swipeXRef.current = null;
        }}
        onTouchStart={(e) => {
          swipeXRef.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (
            swipeXRef.current !== null &&
            e.changedTouches[0] &&
            Math.abs(e.changedTouches[0].clientX - swipeXRef.current) > 26
          ) {
            handleBackspaceSwipe();
          }
          swipeXRef.current = null;
        }}
        className="text-right px-2 pb-4 cursor-ew-resize"
        title="Swipe horizontally across numbers to delete last digit"
      >
        <div className="text-sm text-zinc-400 h-5 tabular-nums truncate">{expression}</div>
        <div className="text-5xl font-light tracking-tight tabular-nums truncate">{display}</div>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() =>
            tapKey(() => {
              if (display !== '0') {
                setDisplay('0');
              } else {
                setPrevVal(null);
                setOperator(null);
                setExpression('');
              }
            })
          }
          className="h-16 rounded-full bg-[#A5A5A5] text-black text-xl font-medium active:brightness-125"
        >
          {display !== '0' ? 'C' : 'AC'}
        </button>
        <button
          type="button"
          onClick={() =>
            tapKey(() =>
              setDisplay((d) => (d.startsWith('-') ? d.slice(1) : d === '0' ? '0' : `-${d}`)),
            )
          }
          className="h-16 rounded-full bg-[#A5A5A5] text-black text-xl font-medium active:brightness-125"
        >
          +/-
        </button>
        <button
          type="button"
          onClick={() => tapKey(() => setDisplay(String(parseFloat(display) / 100)))}
          className="h-16 rounded-full bg-[#A5A5A5] text-black text-xl font-medium active:brightness-125"
        >
          %
        </button>
        <button
          type="button"
          onClick={() => handleOp('÷')}
          className={`h-16 rounded-full text-2xl font-medium ${
            operator === '÷' && resetNext ? 'bg-white text-[#FF9F0A]' : 'bg-[#FF9F0A] text-white'
          }`}
        >
          ÷
        </button>

        {['7', '8', '9'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleDigit(n)}
            className="h-16 rounded-full bg-[#333333] text-white text-2xl font-normal active:bg-zinc-600 tabular-nums"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleOp('×')}
          className={`h-16 rounded-full text-2xl font-medium ${
            operator === '×' && resetNext ? 'bg-white text-[#FF9F0A]' : 'bg-[#FF9F0A] text-white'
          }`}
        >
          ×
        </button>

        {['4', '5', '6'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleDigit(n)}
            className="h-16 rounded-full bg-[#333333] text-white text-2xl font-normal active:bg-zinc-600 tabular-nums"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleOp('-')}
          className={`h-16 rounded-full text-2xl font-medium ${
            operator === '-' && resetNext ? 'bg-white text-[#FF9F0A]' : 'bg-[#FF9F0A] text-white'
          }`}
        >
          −
        </button>

        {['1', '2', '3'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleDigit(n)}
            className="h-16 rounded-full bg-[#333333] text-white text-2xl font-normal active:bg-zinc-600 tabular-nums"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleOp('+')}
          className={`h-16 rounded-full text-2xl font-medium ${
            operator === '+' && resetNext ? 'bg-white text-[#FF9F0A]' : 'bg-[#FF9F0A] text-white'
          }`}
        >
          +
        </button>

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="col-span-2 h-16 rounded-full bg-[#333333] text-white text-2xl font-normal text-left pl-7 active:bg-zinc-600 tabular-nums"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => handleDigit('.')}
          className="h-16 rounded-full bg-[#333333] text-white text-2xl font-normal active:bg-zinc-600"
        >
          .
        </button>
        <button
          type="button"
          onClick={handleEquals}
          className="h-16 rounded-full bg-[#FF9F0A] text-white text-2xl font-medium active:brightness-110"
        >
          =
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
 * 2. iOS 18 CLOCK APP (Timer syncs live into Dynamic Island when minimized!)
 * ========================================================================== */
export function ClockApp({
  settings,
  timerSecondsLeft,
  timerRunning,
  onStartTimer,
  onPauseTimer,
  onCancelTimer,
}: {
  settings: IOSSystemSettings;
  timerSecondsLeft: number;
  timerRunning: boolean;
  onStartTimer: (seconds: number) => void;
  onPauseTimer: () => void;
  onCancelTimer: () => void;
}) {
  const [tab, setTab] = useState<'timer' | 'stopwatch'>('timer');
  const [presetSec, setPresetSec] = useState<number>(60);
  const [swMs, setSwMs] = useState<number>(0);
  const [swRunning, setSwRunning] = useState<boolean>(false);
  const [laps, setLaps] = useState<number[]>([]);

  useEffect(() => {
    if (!swRunning) return;
    const id = window.setInterval(() => {
      setSwMs((prev) => prev + 30);
    }, 30);
    return () => window.clearInterval(id);
  }, [swRunning]);

  const fmtTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const fmtSw = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-full bg-black text-white flex flex-col pt-14 pb-8 px-5 select-none">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">{tab === 'timer' ? 'Timers' : 'Stopwatch'}</h1>
        <div className="flex bg-zinc-900 p-1 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setTab('timer')}
            className={`px-3 py-1 rounded-md font-medium ${
              tab === 'timer' ? 'bg-zinc-700 text-white' : 'text-zinc-400'
            }`}
          >
            Timer
          </button>
          <button
            type="button"
            onClick={() => setTab('stopwatch')}
            className={`px-3 py-1 rounded-md font-medium ${
              tab === 'stopwatch' ? 'bg-zinc-700 text-white' : 'text-zinc-400'
            }`}
          >
            Stopwatch
          </button>
        </div>
      </div>

      {tab === 'timer' ? (
        <div className="flex-1 flex flex-col items-center justify-between py-4">
          <div className="w-52 h-52 rounded-full border-4 border-amber-500/80 flex flex-col items-center justify-center">
            <div className="text-5xl font-light font-mono tabular-nums">
              {fmtTimer(timerSecondsLeft > 0 ? timerSecondsLeft : presetSec)}
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              {timerRunning ? 'Live in Dynamic Island' : 'Ready'}
            </div>
          </div>

          <div className="flex gap-2 w-full justify-center">
            {[15, 60, 180, 300].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  triggerTaptic('selection', settings.systemHaptics, false);
                  setPresetSec(s);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium tabular-nums ${
                  presetSec === s ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-300'
                }`}
              >
                {s < 60 ? `${s}s` : `${s / 60}m`}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between w-full px-4">
            <button
              type="button"
              onClick={() => {
                triggerTaptic('light', settings.systemHaptics, false);
                onCancelTimer();
              }}
              className="w-16 h-16 rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                triggerTaptic('rigid', settings.systemHaptics, false);
                if (timerRunning) onPauseTimer();
                else onStartTimer(timerSecondsLeft > 0 ? timerSecondsLeft : presetSec);
              }}
              className={`w-16 h-16 rounded-full text-xs font-semibold ${
                timerRunning
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {timerRunning ? 'Pause' : 'Start'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="py-10 text-center text-5xl font-light font-mono tabular-nums">
            {fmtSw(swMs)}
          </div>
          <div className="flex justify-between px-4 pb-5 border-b border-white/10">
            <button
              type="button"
              onClick={() => {
                if (swRunning) setLaps((prev) => [swMs, ...prev]);
                else {
                  setSwMs(0);
                  setLaps([]);
                }
              }}
              className="w-16 h-16 rounded-full bg-zinc-800 text-xs font-semibold"
            >
              {swRunning ? 'Lap' : 'Reset'}
            </button>
            <button
              type="button"
              onClick={() => setSwRunning((r) => !r)}
              className={`w-16 h-16 rounded-full text-xs font-semibold ${
                swRunning
                  ? 'bg-rose-500/25 text-rose-400'
                  : 'bg-emerald-500/25 text-emerald-400'
              }`}
            >
              {swRunning ? 'Stop' : 'Start'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/10 text-xs pt-2">
            {laps.map((l, i) => (
              <div key={i} className="flex justify-between py-2 font-mono tabular-nums">
                <span>Lap {laps.length - i}</span>
                <span>{fmtSw(l)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 3. iOS 18 NOTES APP
 * ========================================================================== */
export function NotesApp({
  settings,
  notes,
  onUpdateNotes,
}: {
  settings: IOSSystemSettings;
  notes: NoteItem[];
  onUpdateNotes: (next: NoteItem[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDark = settings.darkMode;
  const activeNote = notes.find((n) => n.id === selectedId) || null;

  const createNote = () => {
    triggerTaptic('light', settings.systemHaptics, false);
    const item: NoteItem = {
      id: `note-${Date.now()}`,
      title: 'New Note',
      body: '',
      updatedAt: 'Just now',
    };
    onUpdateNotes([item, ...notes]);
    setSelectedId(item.id);
  };

  if (activeNote) {
    return (
      <div
        className={`w-full h-full flex flex-col pt-12 pb-8 px-4 ${
          isDark ? 'bg-black text-white' : 'bg-white text-zinc-900'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-current/10">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-0.5 text-amber-500 text-sm font-medium"
          >
            <ChevronLeft className="w-5 h-5 -ml-1.5" />
            <span>Notes</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdateNotes(notes.filter((n) => n.id !== activeNote.id));
              setSelectedId(null);
            }}
            className="text-rose-500 p-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <input
          type="text"
          value={activeNote.title}
          onChange={(e) => {
            triggerTaptic('keyboard', settings.keyboardHaptics, settings.keyboardClicks);
            onUpdateNotes(
              notes.map((n) =>
                n.id === activeNote.id
                  ? { ...n, title: e.target.value, updatedAt: 'Edited just now' }
                  : n,
              ),
            );
          }}
          className="text-lg font-bold bg-transparent outline-none pt-3 pb-2"
        />
        <textarea
          value={activeNote.body}
          onChange={(e) => {
            triggerTaptic('keyboard', settings.keyboardHaptics, settings.keyboardClicks);
            onUpdateNotes(
              notes.map((n) =>
                n.id === activeNote.id
                  ? { ...n, body: e.target.value, updatedAt: 'Edited just now' }
                  : n,
              ),
            );
          }}
          placeholder="Start typing..."
          className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed"
        />
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col pt-14 pb-8 px-4 select-none ${
        isDark ? 'bg-black text-white' : 'bg-[#F2F2F7] text-zinc-900'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Notes</h1>
        <button
          type="button"
          onClick={createNote}
          className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2.5">
        {notes.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setSelectedId(n.id)}
            className={`w-full text-left p-3.5 rounded-2xl ${
              isDark ? 'bg-[#1C1C1E]' : 'bg-white'
            }`}
          >
            <div className="text-sm font-semibold truncate">{n.title || 'Untitled'}</div>
            <div className="text-xs opacity-60 truncate mt-0.5">{n.body || 'No additional text'}</div>
            <div className="text-[10px] opacity-40 mt-1">{n.updatedAt}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * 4. iOS 18 CAMERA APP (Tap-to-focus yellow reticle + exposure sun + 0.5x..5x)
 * ========================================================================== */
export function CameraApp({
  settings,
  onCapturePhoto,
}: {
  settings: IOSSystemSettings;
  onCapturePhoto: (photo: CapturedPhoto) => void;
}) {
  const [zoom, setZoom] = useState<number>(1);
  const [exposureEv, setExposureEv] = useState<number>(0);
  const [focusBox, setFocusBox] = useState<{ x: number; y: number } | null>(null);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [frontLens, setFrontLens] = useState<boolean>(false);

  const snapPhoto = () => {
    triggerTaptic('shutter', settings.systemHaptics, !settings.silentMode);
    setShutterFlash(true);
    window.setTimeout(() => setShutterFlash(false), 120);

    onCapturePhoto({
      id: `cam-${Date.now()}`,
      title: frontLens ? 'TrueDepth 12MP Capture' : `Fusion ${zoom}x Capture`,
      timestamp: 'Just now',
      kind: 'camera',
      accentGradient: frontLens
        ? 'linear-gradient(145deg, #1e293b 0%, #475569 50%, #0f172a 100%)'
        : zoom >= 5
          ? 'linear-gradient(145deg, #0b132b 0%, #1c2541 50%, #5bc0be 100%)'
          : 'linear-gradient(145deg, #1f1c18 0%, #8e7962 50%, #2b2d42 100%)',
      caption: `${frontLens ? '23 mm TrueDepth' : zoom === 0.5 ? '13 mm' : zoom === 1 ? '24 mm' : zoom === 2 ? '48 mm' : '120 mm'} • EV ${exposureEv >= 0 ? `+${exposureEv.toFixed(1)}` : exposureEv.toFixed(1)}`,
    });
  };

  return (
    <div className="w-full h-full bg-black text-white flex flex-col justify-between pt-12 pb-8 select-none relative overflow-hidden">
      {/* Top Camera HUD */}
      <div className="flex items-center justify-between px-5 z-20 text-xs font-mono">
        <span className="px-1.5 py-0.5 rounded bg-white/15">RAW MAX</span>
        <button
          type="button"
          onClick={() => {
            triggerTaptic('selection', settings.systemHaptics, false);
            setFrontLens((f) => !f);
          }}
          className="px-2 py-1 rounded bg-zinc-800 text-[11px] flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{frontLens ? 'TrueDepth Front' : '48MP Rear Fusion'}</span>
        </button>
      </div>

      {/* Viewfinder Area with Tap-to-Focus Reticle */}
      <div
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          triggerTaptic('selection', settings.systemHaptics, false);
          setFocusBox({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }}
        className="relative flex-1 my-3 mx-2 rounded-2xl overflow-hidden bg-zinc-900 cursor-crosshair flex items-center justify-center"
      >
        <div
          className="w-full h-full transition-all duration-300 flex flex-col items-center justify-center relative"
          style={{
            transform: `scale(${0.92 + zoom * 0.14})`,
            filter: `brightness(${1 + exposureEv * 0.25})`,
            background: frontLens
              ? 'radial-gradient(circle at 50% 38%, #64748b 0%, #1e293b 45%, #090d16 88%)'
              : 'radial-gradient(circle at 38% 35%, #c8a987 0%, #463a31 38%, #0d1017 85%)',
          }}
        >
          {/* Rule-of-thirds Camera Grid (toggled in Settings -> Camera) */}
          {settings.cameraGrid && (
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
              {Array.from({ length: 9 }).map((_, idx) => (
                <div key={idx} className="border border-white/15" />
              ))}
            </div>
          )}

          {/* Horizon Spirit Level Bar (toggled in Settings -> Camera) */}
          {settings.cameraLevel && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center gap-2 pointer-events-none">
              <div className="w-6 h-[1.5px] bg-amber-400/90" />
              <div className="w-10 h-[1.5px] bg-amber-400" />
              <div className="w-6 h-[1.5px] bg-amber-400/90" />
            </div>
          )}
          <CameraIcon className="w-10 h-10 text-white/30 mb-2" />
          <span className="text-[11px] font-mono text-white/60">
            {frontLens ? 'TrueDepth ƒ/1.9' : `${zoom}x Optical`} • Tap Anywhere for AF/AE Lock
          </span>
        </div>

        {/* Authentic iPhone Yellow AF Focus Box + Exposure Sun Slider */}
        {focusBox && (
          <div
            className="absolute w-16 h-16 border border-amber-400 pointer-events-auto"
            style={{
              left: `${Math.min(Math.max(focusBox.x - 32, 8), 240)}px`,
              top: `${Math.min(Math.max(focusBox.y - 32, 8), 320)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExposureEv((ev) => (ev >= 1.2 ? -1.0 : Number((ev + 0.4).toFixed(1))))}
              className="absolute -right-6 top-1/2 -translate-y-1/2 text-amber-400 p-1"
              title="Adjust Exposure Bias"
            >
              <Sun className="w-4 h-4" />
            </button>
          </div>
        )}

        {shutterFlash && <div className="absolute inset-0 bg-white z-30" />}
      </div>

      {/* Optical Zoom Ring & Shutter Controls */}
      <div className="space-y-4 px-5 z-20">
        <div className="flex items-center justify-center gap-2">
          {[0.5, 1, 2, 5].map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => {
                triggerTaptic('selection', settings.systemHaptics, false);
                setZoom(z);
              }}
              className={`w-8 h-8 rounded-full text-[11px] font-bold tabular-nums transition-transform ${
                zoom === z
                  ? 'bg-zinc-800 text-amber-400 scale-110 border border-amber-400/40'
                  : 'bg-zinc-900/80 text-white/80'
              }`}
            >
              {z}
              {zoom === z ? '×' : ''}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={snapPhoto}
            className="w-16 h-16 rounded-full border-4 border-white p-1 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Take Photo"
          >
            <div className="w-full h-full rounded-full bg-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 5. iOS 18 PHOTOS APP (Displays Camera Snaps & Side+VolUp Screenshots)
 * ========================================================================== */
export function PhotosApp({
  settings,
  photos,
  pinchZoomScale = 1,
  onResetPinchZoom,
}: {
  settings: IOSSystemSettings;
  photos: CapturedPhoto[];
  pinchZoomScale?: number;
  onResetPinchZoom?: () => void;
}) {
  const [selected, setSelected] = useState<CapturedPhoto | null>(null);
  const [localZoom, setLocalZoom] = useState<number>(1);
  const isDark = settings.darkMode;
  const topPad = Math.max(30, IPHONE_MODELS[settings.deviceModel].safeTopPx);

  const combinedZoom = Math.max(0.75, Math.min(3.5, localZoom * pinchZoomScale));

  if (selected) {
    return (
      <div
        style={{ paddingTop: `${topPad}px` }}
        className={`w-full h-full flex flex-col pb-8 px-4 ${
          isDark ? 'bg-black text-white' : 'bg-white text-zinc-900'
        }`}
      >
        <div className="flex items-center justify-between pb-3 z-10">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setLocalZoom(1);
              onResetPinchZoom?.();
            }}
            className="flex items-center gap-0.5 text-blue-500 text-sm font-medium"
          >
            <ChevronLeft className="w-5 h-5 -ml-1.5" />
            <span>Library</span>
          </button>
          <span className="text-xs opacity-60 tabular-nums">
            {combinedZoom !== 1 ? `${Math.round(combinedZoom * 100)}% · ` : ''}
            {selected.timestamp}
          </span>
        </div>

        <div
          onDoubleClick={() => {
            triggerTaptic('selection', settings.systemHaptics, false);
            setLocalZoom((z) => (z > 1 ? 1 : 2));
            onResetPinchZoom?.();
          }}
          className="flex-1 rounded-2xl my-2 overflow-hidden flex items-center justify-center relative cursor-zoom-in"
          title="Double-tap or Pinch (Hold Alt + Drag) to Zoom"
        >
          <div
            className="w-full h-full flex flex-col items-center justify-center p-6 text-white text-center shadow-inner transition-transform duration-150"
            style={{
              background: selected.accentGradient,
              transform: `scale(${combinedZoom})`,
            }}
          >
            <div className="text-base font-bold mb-1">{selected.title}</div>
            <div className="text-xs opacity-80 font-mono">{selected.caption}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ paddingTop: `${topPad}px` }}
      className={`w-full h-full flex flex-col pb-8 px-4 select-none ${
        isDark ? 'bg-black text-white' : 'bg-white text-zinc-900'
      }`}
    >
      <div className="mb-3">
        <h1 className="text-2xl font-bold">Photos</h1>
        <p className="text-xs opacity-60 tabular-nums">{photos.length} Items in Recents</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 overflow-y-auto pb-6">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p)}
            className="aspect-[3/4] rounded-xl p-3 flex flex-col justify-end text-left text-white relative overflow-hidden group"
            style={{ background: p.accentGradient }}
          >
            <div className="text-[10px] uppercase tracking-wider opacity-75">
              {p.kind === 'screenshot' ? 'Screenshot' : 'HEIF'}
            </div>
            <div className="text-xs font-semibold leading-tight truncate">{p.title}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
