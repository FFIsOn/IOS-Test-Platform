'use client';

import React, { useRef, useState } from 'react';
import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Delete,
  Globe,
  Mic,
} from 'lucide-react';
import type { ActiveKeyboardSession, IOSSystemSettings } from '@/lib/core/iosState';
import { triggerTaptic } from '@/lib/core/hardwareMemory';

interface IOSKeyboardProps {
  session: ActiveKeyboardSession;
  settings: IOSSystemSettings;
  hasHomeIndicator: boolean;
  onInsertText: (text: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  onTabField: (direction: -1 | 1) => void;
  onDismiss: () => void;
}

const QWERTY_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const NUM_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
  ['.', ',', '?', '!', "'"],
];

const SYM_ROWS = [
  ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
  ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'],
  ['.', ',', '?', '!', "'"],
];

export default function IOSKeyboard({
  session,
  settings,
  hasHomeIndicator,
  onInsertText,
  onBackspace,
  onEnter,
  onTabField,
  onDismiss,
}: IOSKeyboardProps) {
  const [layer, setLayer] = useState<'alpha' | 'num' | 'sym'>('alpha');
  const [shiftState, setShiftState] = useState<'lower' | 'upper' | 'caps'>('upper');
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [trackpadMode, setTrackpadMode] = useState<boolean>(false);

  const lastShiftTapRef = useRef<number>(0);
  const spaceHoldTimerRef = useRef<number | null>(null);
  const backspaceIntervalRef = useRef<number | null>(null);

  const isDark = settings.darkMode;

  const fireKeyFeedback = () => {
    triggerTaptic('keyboard', settings.keyboardHaptics, settings.keyboardClicks);
  };

  const handleCharPress = (rawKey: string) => {
    fireKeyFeedback();
    const out =
      layer === 'alpha' && shiftState !== 'lower' ? rawKey.toUpperCase() : rawKey;
    onInsertText(out);
    if (layer === 'alpha' && shiftState === 'upper') {
      setShiftState('lower');
    }
  };

  const handleShiftPress = () => {
    fireKeyFeedback();
    const now = Date.now();
    if (now - lastShiftTapRef.current < 300) {
      setShiftState('caps');
    } else {
      setShiftState((prev) => (prev === 'lower' ? 'upper' : 'lower'));
    }
    lastShiftTapRef.current = now;
  };

  // Predictive QuickType suggestions tailored to URL vs Search vs Prose
  const suggestions =
    session.inputType === 'url'
      ? ['https://', '.com', '.org']
      : session.inputType === 'email'
        ? ['@gmail.com', '@icloud.com', '.com']
        : session.value.trim().length === 0
          ? ['The', 'I', 'Hello']
          : [
              session.value.split(/\s+/).pop() || 'iOS',
              session.inputType === 'search' ? 'iPhone' : 'thanks',
              session.inputType === 'search' ? 'wiki' : 'today',
            ];

  const activeRows =
    session.inputType === 'number'
      ? NUM_ROWS
      : layer === 'alpha'
        ? QWERTY_ROWS
        : layer === 'num'
          ? NUM_ROWS
          : SYM_ROWS;

  const kbSurface = isDark
    ? 'bg-[#1C1C1E]/98 text-white border-white/10'
    : 'bg-[#D1D3D9]/98 text-black border-black/10';
  const charKeyCls = isDark
    ? 'bg-[#4A4A4C] text-white shadow-[0_1px_0_rgba(0,0,0,0.55)]'
    : 'bg-white text-black shadow-[0_1px_0_rgba(0,0,0,0.3)]';
  const fnKeyCls = isDark
    ? 'bg-[#2C2C2E] text-white shadow-[0_1px_0_rgba(0,0,0,0.55)]'
    : 'bg-[#AEB3BE] text-black shadow-[0_1px_0_rgba(0,0,0,0.3)]';

  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      className={`absolute inset-x-0 bottom-0 z-[48] border-t select-none transition-transform duration-200 ease-out animate-in slide-in-from-bottom-4 ${kbSurface}`}
    >
      {/* =====================================================================
       * 1. SAFARI WEBKIT FORM ACCESSORY BAR (<  >   QuickType   Done)
       * =================================================================== */}
      <div
        className={`flex items-center justify-between px-2.5 h-9 border-b text-xs ${
          isDark ? 'bg-[#252528] border-white/10' : 'bg-[#E5E7EB] border-black/10'
        }`}
      >
        {/* Left < / > Field Switcher (Exact WebKit Mobile Safari Quirk!) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={!session.canTabPrev}
            onClick={() => {
              fireKeyFeedback();
              onTabField(-1);
            }}
            className="w-7 h-7 rounded flex items-center justify-center text-blue-500 disabled:opacity-30"
            title="Previous Input Field"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!session.canTabNext}
            onClick={() => {
              fireKeyFeedback();
              onTabField(1);
            }}
            className="w-7 h-7 rounded flex items-center justify-center text-blue-500 disabled:opacity-30"
            title="Next Input Field"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Center QuickType Bar */}
        <div className="flex-1 flex items-center justify-around px-2 divide-x divide-current/15 overflow-hidden">
          {suggestions.map((sug, i) => (
            <button
              key={`${sug}-${i}`}
              type="button"
              onClick={() => {
                fireKeyFeedback();
                onInsertText(
                  session.inputType === 'url' || sug.startsWith('@') || sug.startsWith('.')
                    ? sug
                    : `${sug} `,
                );
              }}
              className="flex-1 py-1 px-1.5 text-[11px] font-medium truncate text-center hover:opacity-80"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Right Blue Done Button */}
        <button
          type="button"
          onClick={() => {
            triggerTaptic('light', settings.systemHaptics, false);
            onDismiss();
          }}
          className="px-2 py-1 text-xs font-bold text-blue-500 shrink-0"
        >
          Done
        </button>
      </div>

      {/* =====================================================================
       * 2. MAIN KEYBOARD MATRIX (With Key-Pop Callout & Spacebar Trackpad Mode)
       * =================================================================== */}
      <div className="px-1.5 pt-2 pb-1 space-y-2 relative">
        {trackpadMode && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-medium opacity-60">
              Trackpad Cursor Mode — Release to Resume Typing
            </span>
          </div>
        )}

        {/* Row 1 */}
        <div className="grid grid-cols-10 gap-1">
          {activeRows[0].map((k) => {
            const label =
              layer === 'alpha' && shiftState !== 'lower' ? k.toUpperCase() : k;
            const isPopped = pressedKey === k && !trackpadMode;
            return (
              <button
                key={k}
                type="button"
                onPointerDown={() => setPressedKey(k)}
                onPointerUp={() => {
                  setPressedKey(null);
                  handleCharPress(k);
                }}
                onPointerLeave={() => setPressedKey(null)}
                className={`relative h-[39px] rounded-[6px] text-[17px] font-normal flex items-center justify-center transition-transform ${charKeyCls}`}
              >
                <span className={trackpadMode ? 'opacity-0' : 'opacity-100'}>{label}</span>
                {/* Authentic iOS Key Magnification Callout Pop-up */}
                {isPopped && (
                  <div
                    className={`absolute -top-11 left-1/2 -translate-x-1/2 w-10 h-11 rounded-lg flex items-center justify-center text-2xl font-medium shadow-xl border z-30 pointer-events-none ${
                      isDark
                        ? 'bg-[#5A5A5E] text-white border-white/15'
                        : 'bg-white text-black border-black/10'
                    }`}
                  >
                    {label}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Row 2 */}
        <div
          className={`flex justify-center gap-1 ${
            layer === 'alpha' && session.inputType !== 'number' ? 'px-3.5' : ''
          }`}
        >
          {activeRows[1].map((k) => {
            const label =
              layer === 'alpha' && shiftState !== 'lower' ? k.toUpperCase() : k;
            const isPopped = pressedKey === k && !trackpadMode;
            return (
              <button
                key={k}
                type="button"
                onPointerDown={() => setPressedKey(k)}
                onPointerUp={() => {
                  setPressedKey(null);
                  handleCharPress(k);
                }}
                onPointerLeave={() => setPressedKey(null)}
                className={`relative flex-1 h-[39px] rounded-[6px] text-[17px] font-normal flex items-center justify-center ${charKeyCls}`}
              >
                <span className={trackpadMode ? 'opacity-0' : 'opacity-100'}>{label}</span>
                {isPopped && (
                  <div
                    className={`absolute -top-11 left-1/2 -translate-x-1/2 w-10 h-11 rounded-lg flex items-center justify-center text-2xl font-medium shadow-xl border z-30 pointer-events-none ${
                      isDark
                        ? 'bg-[#5A5A5E] text-white border-white/15'
                        : 'bg-white text-black border-black/10'
                    }`}
                  >
                    {label}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Row 3: Shift / #+= + Letters + Backspace */}
        <div className="flex items-center gap-1.5">
          {layer === 'alpha' && session.inputType !== 'number' ? (
            <button
              type="button"
              onClick={handleShiftPress}
              className={`w-[40px] h-[39px] rounded-[6px] flex items-center justify-center shrink-0 ${
                shiftState !== 'lower'
                  ? 'bg-white text-black shadow'
                  : fnKeyCls
              }`}
              title="Shift (Double-tap for Caps Lock)"
            >
              <ArrowUp
                className={`w-4 h-4 ${shiftState === 'caps' ? 'underline stroke-[2.6]' : ''}`}
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                fireKeyFeedback();
                setLayer((prev) => (prev === 'num' ? 'sym' : 'num'));
              }}
              className={`w-[40px] h-[39px] rounded-[6px] text-xs font-semibold flex items-center justify-center shrink-0 ${fnKeyCls}`}
            >
              {layer === 'num' ? '#+=' : '123'}
            </button>
          )}

          <div className="flex-1 flex items-center gap-1">
            {activeRows[2].map((k) => {
              const label =
                layer === 'alpha' && shiftState !== 'lower' ? k.toUpperCase() : k;
              const isPopped = pressedKey === k && !trackpadMode;
              return (
                <button
                  key={k}
                  type="button"
                  onPointerDown={() => setPressedKey(k)}
                  onPointerUp={() => {
                    setPressedKey(null);
                    handleCharPress(k);
                  }}
                  onPointerLeave={() => setPressedKey(null)}
                  className={`relative flex-1 h-[39px] rounded-[6px] text-[17px] font-normal flex items-center justify-center ${charKeyCls}`}
                >
                  <span className={trackpadMode ? 'opacity-0' : 'opacity-100'}>{label}</span>
                  {isPopped && (
                    <div
                      className={`absolute -top-11 left-1/2 -translate-x-1/2 w-10 h-11 rounded-lg flex items-center justify-center text-2xl font-medium shadow-xl border z-30 pointer-events-none ${
                        isDark
                          ? 'bg-[#5A5A5E] text-white border-white/15'
                          : 'bg-white text-black border-black/10'
                      }`}
                    >
                      {label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onPointerDown={() => {
              fireKeyFeedback();
              onBackspace();
              backspaceIntervalRef.current = window.setInterval(() => {
                fireKeyFeedback();
                onBackspace();
              }, 95);
            }}
            onPointerUp={() => {
              if (backspaceIntervalRef.current) {
                window.clearInterval(backspaceIntervalRef.current);
                backspaceIntervalRef.current = null;
              }
            }}
            onPointerLeave={() => {
              if (backspaceIntervalRef.current) {
                window.clearInterval(backspaceIntervalRef.current);
                backspaceIntervalRef.current = null;
              }
            }}
            className={`w-[40px] h-[39px] rounded-[6px] flex items-center justify-center shrink-0 active:opacity-80 ${fnKeyCls}`}
            title="Delete (Hold to Repeat)"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>

        {/* Row 4: 123/ABC + Spacebar (Hold for Trackpad!) + URL Keys + Go/Search/Return */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => {
              fireKeyFeedback();
              setLayer((prev) => (prev === 'alpha' ? 'num' : 'alpha'));
            }}
            className={`w-[44px] h-[39px] rounded-[6px] text-xs font-semibold flex items-center justify-center shrink-0 ${fnKeyCls}`}
          >
            {layer === 'alpha' ? '123' : 'ABC'}
          </button>

          {session.inputType === 'url' ? (
            <>
              <button
                type="button"
                onClick={() => handleCharPress('.')}
                className={`w-9 h-[39px] rounded-[6px] text-base font-medium ${charKeyCls}`}
              >
                .
              </button>
              <button
                type="button"
                onClick={() => handleCharPress('/')}
                className={`w-9 h-[39px] rounded-[6px] text-base font-medium ${charKeyCls}`}
              >
                /
              </button>
              <button
                type="button"
                onClick={() => handleCharPress('.com')}
                className={`flex-1 h-[39px] rounded-[6px] text-xs font-semibold ${charKeyCls}`}
              >
                .com
              </button>
            </>
          ) : (
            <button
              type="button"
              onPointerDown={() => {
                spaceHoldTimerRef.current = window.setTimeout(() => {
                  triggerTaptic('medium', settings.systemHaptics, false);
                  setTrackpadMode(true);
                }, 420);
              }}
              onPointerUp={() => {
                if (spaceHoldTimerRef.current) {
                  window.clearTimeout(spaceHoldTimerRef.current);
                  spaceHoldTimerRef.current = null;
                }
                if (trackpadMode) {
                  setTrackpadMode(false);
                } else {
                  handleCharPress(' ');
                }
              }}
              onPointerLeave={() => {
                if (spaceHoldTimerRef.current) window.clearTimeout(spaceHoldTimerRef.current);
                setTrackpadMode(false);
              }}
              className={`flex-1 h-[39px] rounded-[6px] text-sm font-normal flex items-center justify-center ${charKeyCls}`}
              title="Space (Hold 420ms for Trackpad Mode)"
            >
              <span className={trackpadMode ? 'opacity-0' : 'opacity-90'}>space</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              triggerTaptic('rigid', settings.systemHaptics, settings.keyboardClicks);
              onEnter();
            }}
            className={`px-3.5 min-w-[74px] h-[39px] rounded-[6px] text-xs font-semibold flex items-center justify-center shrink-0 ${
              session.enterKeyLabel === 'Go' || session.enterKeyLabel === 'Search'
                ? 'bg-blue-500 text-white shadow'
                : fnKeyCls
            }`}
          >
            {session.enterKeyLabel.toLowerCase()}
          </button>
        </div>

        {/* Bottom Globe & Dictation Chin (When Device Has Home Indicator Bar) */}
        {hasHomeIndicator ? (
          <div className="flex items-center justify-between px-4 pt-1.5 pb-5 opacity-70">
            <Globe className="w-4 h-4" />
            <Mic className="w-4 h-4" />
          </div>
        ) : (
          <div className="h-1" />
        )}
      </div>
    </div>
  );
}
