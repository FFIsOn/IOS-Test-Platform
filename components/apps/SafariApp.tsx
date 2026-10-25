'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  ArrowUp,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  FileText,
  Globe,
  Lock,
  Plus,
  PlusSquare,
  RotateCw,
  Search,
  Share,
  ShieldAlert,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import {
  IPHONE_MODELS,
  SAFARI_FAVORITES,
  type ActiveKeyboardSession,
  type DevConsoleEntry,
  type DevDomNodeSummary,
  type DevInspectedElement,
  type DevNetworkEntry,
  type HomeWebClip,
  type IOSSystemSettings,
  type SafariTab,
} from '@/lib/core/iosState';
import { triggerTaptic } from '@/lib/core/hardwareMemory';

export interface SafariAppHandle {
  navigateToUrl: (url: string) => void;
  scrollToTop: () => void;
  sendKeyboardInsert: (text: string) => void;
  sendKeyboardBackspace: () => void;
  sendKeyboardEnter: () => void;
  sendKeyboardTabField: (direction: -1 | 1) => void;
  dismissKeyboard: () => void;
  evalJavaScript: (code: string) => void;
  queryDomSelector: (selector: string) => void;
  setPinchZoomDelta: (scaleMultiplier: number) => void;
}

interface SafariAppProps {
  settings: IOSSystemSettings;
  onUpdateSettings: (patch: Partial<IOSSystemSettings>) => void;
  onAddWebClip: (clip: HomeWebClip) => void;
  initialPendingUrl?: string | null;
  onConsumeInitialUrl?: () => void;
  inspectElementActive: boolean;
  onKeyboardSessionChange: (session: ActiveKeyboardSession | null) => void;
  onConsoleEntry: (entry: DevConsoleEntry) => void;
  onDomTreeUpdate: (nodes: DevDomNodeSummary[]) => void;
  onElementSelected: (el: DevInspectedElement) => void;
  onNetworkEntry: (entry: DevNetworkEntry) => void;
}

interface ReaderPayload {
  title: string;
  paragraphs: string[];
}

function normalizeInputToUrl(raw: string, engine: IOSSystemSettings['safariSearchEngine']): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const looksLikeUrl =
    /^https?:\/\//i.test(trimmed) ||
    (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(trimmed) && !trimmed.includes(' '));

  if (looksLikeUrl) {
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  const encoded = encodeURIComponent(trimmed);
  if (engine === 'duckduckgo') {
    return `https://html.duckduckgo.com/html/?q=${encoded}`;
  }
  if (engine === 'bing') {
    return `https://www.bing.com/search?q=${encoded}`;
  }
  return `https://en.m.wikipedia.org/w/index.php?search=${encoded}`;
}

function getDisplayDomain(url: string): string {
  if (!url) return 'Start Page';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const SafariApp = forwardRef<SafariAppHandle, SafariAppProps>(function SafariApp(
  {
    settings,
    onUpdateSettings,
    onAddWebClip,
    initialPendingUrl,
    onConsumeInitialUrl,
    inspectElementActive,
    onKeyboardSessionChange,
    onConsoleEntry,
    onDomTreeUpdate,
    onElementSelected,
    onNetworkEntry,
  },
  ref,
) {
  const [tabs, setTabs] = useState<SafariTab[]>([
    {
      id: 'tab-1',
      url: '',
      title: 'Start Page',
      history: [''],
      historyIndex: 0,
      isPrivate: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [addressInput, setAddressInput] = useState<string>('');
  const [isEditingUrl, setIsEditingUrl] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [barCollapsed, setBarCollapsed] = useState<boolean>(false);
  const [pageZoom, setPageZoom] = useState<number>(100);
  const [desktopSite, setDesktopSite] = useState<boolean>(false);
  const [readerMode, setReaderMode] = useState<boolean>(false);
  const [readerData, setReaderData] = useState<ReaderPayload | null>(null);
  const [proxiedSrcDoc, setProxiedSrcDoc] = useState<string>('');
  const [showAaMenu, setShowAaMenu] = useState<boolean>(false);
  const [showShareSheet, setShowShareSheet] = useState<boolean>(false);
  const [showTabGrid, setShowTabGrid] = useState<boolean>(false);
  const [bookmarks, setBookmarks] = useState<Array<{ title: string; url: string }>>([
    { title: 'iPhone — Wikipedia', url: 'https://en.m.wikipedia.org/wiki/IPhone' },
    { title: 'DuckDuckGo Search', url: 'https://html.duckduckgo.com/html/' },
    { title: 'HTTPBin Web Form Test', url: 'https://httpbin.org/forms/post' },
    { title: 'Hacker News', url: 'https://news.ycombinator.com' },
  ]);
  const [showBookmarks, setShowBookmarks] = useState<boolean>(false);
  const [copiedBanner, setCopiedBanner] = useState<string | null>(null);
  const [pullOffset, setPullOffset] = useState<number>(0);

  const pullStartYRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const startScrollRef = useRef<HTMLDivElement | null>(null);
  const addressInputElRef = useRef<HTMLInputElement | null>(null);
  const isEditingUrlRef = useRef<boolean>(false);
  const addressValRef = useRef<string>('');

  const modelSpec = IPHONE_MODELS[settings.deviceModel];
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const isOffline =
    settings.networkProfile === 'offline' ||
    settings.airplaneMode ||
    (!settings.wifiEnabled && !settings.cellularEnabled);

  useEffect(() => {
    isEditingUrlRef.current = isEditingUrl;
  }, [isEditingUrl]);

  useEffect(() => {
    addressValRef.current = addressInput;
  }, [addressInput]);

  // Sync Developer Mode Inspect Element flag into active iframe
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'IOS_DEV_SET_INSPECT', enabled: inspectElementActive },
        '*',
      );
    }
  }, [inspectElementActive, proxiedSrcDoc]);

  const fetchViaProxy = useCallback(
    async (targetUrl: string, useDesktop: boolean) => {
      if (!targetUrl || isOffline) {
        setProxiedSrcDoc('');
        setReaderData(null);
        if (isOffline && targetUrl) {
          onNetworkEntry({
            id: `net-${Date.now()}`,
            url: targetUrl,
            method: 'GET',
            status: 0,
            durationMs: 0,
            sizeBytes: 0,
            profile: settings.networkProfile,
            timestamp: new Date().toLocaleTimeString([], {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          });
        }
        return;
      }

      setIsLoading(true);
      setLoadProgress(22);
      const timer1 = window.setTimeout(() => setLoadProgress(68), 180);

      try {
        if (!settings.safariUseProxy) {
          setProxiedSrcDoc('');
          setLoadProgress(100);
          window.setTimeout(() => setIsLoading(false), 260);
          return;
        }

        const resp = await fetch(
          `/api/proxy?url=${encodeURIComponent(targetUrl)}&mode=json&desktop=${useDesktop ? '1' : '0'}&throttle=${settings.networkProfile}`,
        );
        const data = await resp.json();
        setLoadProgress(95);

        onNetworkEntry({
          id: `net-${Date.now()}`,
          url: data?.finalUrl || targetUrl,
          method: 'GET',
          status: data?.status ?? resp.status,
          durationMs: data?.durationMs ?? 45,
          sizeBytes: data?.sizeBytes ?? 0,
          profile: settings.networkProfile,
          timestamp: new Date().toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        });

        if (data && typeof data.html === 'string') {
          setProxiedSrcDoc(data.html);
          setReaderData(data.reader || null);
          const resolvedTitle = data.title || getDisplayDomain(data.finalUrl || targetUrl);
          setTabs((prev) =>
            prev.map((t) => (t.id === activeTabId ? { ...t, title: resolvedTitle } : t)),
          );
        }
      } catch {
        setProxiedSrcDoc(
          `<html><body style="font-family:-apple-system,sans-serif;padding:48px 24px;text-align:center;color:#8e8e93;"><h2 style="color:#111;font-size:18px;">Safari Can’t Open the Page</h2><p style="font-size:14px;">The network connection was interrupted.</p></body></html>`,
        );
      } finally {
        window.clearTimeout(timer1);
        setLoadProgress(100);
        window.setTimeout(() => {
          setIsLoading(false);
          setLoadProgress(0);
        }, 220);
      }
    },
    [activeTabId, isOffline, onNetworkEntry, settings.networkProfile, settings.safariUseProxy],
  );

  const navigateTo = useCallback(
    (rawInput: string, pushHistory = true) => {
      triggerTaptic('light', settings.systemHaptics, false);
      setShowAaMenu(false);
      setShowShareSheet(false);
      setShowBookmarks(false);
      setBarCollapsed(false);
      setIsEditingUrl(false);
      onKeyboardSessionChange(null);

      const finalUrl = rawInput ? normalizeInputToUrl(rawInput, settings.safariSearchEngine) : '';
      setAddressInput(finalUrl);

      if (!finalUrl) {
        setReaderMode(false);
        setProxiedSrcDoc('');
        onDomTreeUpdate([]);
      }

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTabId) return t;
          if (!pushHistory) {
            return {
              ...t,
              url: finalUrl,
              title: finalUrl ? getDisplayDomain(finalUrl) : 'Start Page',
            };
          }
          const sliced = t.history.slice(0, t.historyIndex + 1);
          const nextHistory = [...sliced, finalUrl];
          return {
            ...t,
            url: finalUrl,
            title: finalUrl ? getDisplayDomain(finalUrl) : 'Start Page',
            history: nextHistory,
            historyIndex: nextHistory.length - 1,
          };
        }),
      );

      if (finalUrl) {
        fetchViaProxy(finalUrl, desktopSite);
      }
    },
    [
      activeTabId,
      desktopSite,
      fetchViaProxy,
      onDomTreeUpdate,
      onKeyboardSessionChange,
      settings.safariSearchEngine,
      settings.systemHaptics,
    ],
  );

  useImperativeHandle(
    ref,
    () => ({
      navigateToUrl: (url: string) => {
        navigateTo(url, true);
      },
      scrollToTop: () => {
        setBarCollapsed(false);
        if (startScrollRef.current) {
          startScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'IOS_SCROLL_TO_TOP' }, '*');
        }
      },
      sendKeyboardInsert: (text: string) => {
        if (isEditingUrlRef.current) {
          const next = addressValRef.current + text;
          setAddressInput(next);
          onKeyboardSessionChange({
            source: 'native',
            inputType: 'url',
            enterKeyLabel: 'Go',
            value: next,
            placeholder: 'Search or enter website name',
            canTabPrev: false,
            canTabNext: false,
          });
          addressInputElRef.current?.focus();
        } else if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'IOS_KB_INSERT', text }, '*');
        }
      },
      sendKeyboardBackspace: () => {
        if (isEditingUrlRef.current) {
          const next = addressValRef.current.slice(0, -1);
          setAddressInput(next);
          onKeyboardSessionChange({
            source: 'native',
            inputType: 'url',
            enterKeyLabel: 'Go',
            value: next,
            placeholder: 'Search or enter website name',
            canTabPrev: false,
            canTabNext: false,
          });
          addressInputElRef.current?.focus();
        } else if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'IOS_KB_BACKSPACE' }, '*');
        }
      },
      sendKeyboardEnter: () => {
        if (isEditingUrlRef.current) {
          navigateTo(addressValRef.current, true);
        } else if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'IOS_KB_ENTER' }, '*');
        }
      },
      sendKeyboardTabField: (direction: -1 | 1) => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'IOS_KB_TAB_FIELD', direction }, '*');
        }
      },
      dismissKeyboard: () => {
        setIsEditingUrl(false);
        onKeyboardSessionChange(null);
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'IOS_KB_DISMISS' }, '*');
        }
      },
      evalJavaScript: (code: string) => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'IOS_DEV_EVAL_JS', code }, '*');
        } else {
          onConsoleEntry({
            id: `con-${Date.now()}`,
            level: 'warn',
            message: 'Open a web page in Safari before evaluating page scripts.',
            source: 'Safari',
            timestamp: new Date().toLocaleTimeString([], {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          });
        }
      },
      queryDomSelector: (selector: string) => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: 'IOS_DEV_QUERY_SELECTOR', selector },
            '*',
          );
        }
      },
      setPinchZoomDelta: (scaleMultiplier: number) => {
        setPageZoom((prev) => {
          const next = Math.max(50, Math.min(250, Math.round(prev * scaleMultiplier)));
          if ((next === 50 || next === 250 || next === 100) && next !== prev) {
            triggerTaptic('selection', settings.systemHaptics, false);
          }
          return next;
        });
      },
    }),
    [navigateTo, onConsoleEntry, onKeyboardSessionChange, settings.systemHaptics],
  );

  // Consume initial URL when Safari mounts from cold start
  useEffect(() => {
    if (!initialPendingUrl) return;
    const id = window.setTimeout(() => {
      navigateTo(initialPendingUrl, true);
      onConsumeInitialUrl?.();
    }, 0);
    return () => window.clearTimeout(id);
  }, [initialPendingUrl, navigateTo, onConsumeInitialUrl]);

  // Listen to postMessage events from proxied web page (Navigation, Web Input Keyboard Popout, Console, DOM Inspector!)
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const payload = ev.data;
      if (!payload || typeof payload !== 'object') return;

      if (payload.type === 'IOS_SAFARI_NAVIGATE' && typeof payload.url === 'string') {
        navigateTo(payload.url, true);
      } else if (payload.type === 'IOS_SAFARI_META' && typeof payload.title === 'string') {
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, title: payload.title } : t)),
        );
      } else if (payload.type === 'IOS_SAFARI_SCROLL' && typeof payload.delta === 'number') {
        if (payload.scrollY > 48 && payload.delta > 8) {
          setBarCollapsed(true);
        } else if (payload.delta < -8 || payload.scrollY <= 20) {
          setBarCollapsed(false);
        }
      } else if (payload.type === 'IOS_WEB_INPUT_FOCUS' && payload.session) {
        setIsEditingUrl(false);
        setBarCollapsed(false);
        onKeyboardSessionChange(payload.session as ActiveKeyboardSession);
      } else if (payload.type === 'IOS_DEV_CONSOLE' && typeof payload.message === 'string') {
        onConsoleEntry({
          id: `con-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          level: payload.level || 'log',
          message: payload.message,
          source: payload.source || 'page',
          timestamp: new Date().toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        });
      } else if (payload.type === 'IOS_DEV_DOM_TREE' && Array.isArray(payload.nodes)) {
        onDomTreeUpdate(payload.nodes as DevDomNodeSummary[]);
      } else if (payload.type === 'IOS_DEV_ELEMENT_SELECTED' && payload.element) {
        onElementSelected(payload.element as DevInspectedElement);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [
    activeTabId,
    navigateTo,
    onConsoleEntry,
    onDomTreeUpdate,
    onElementSelected,
    onKeyboardSessionChange,
  ]);

  const goBack = () => {
    if (activeTab.historyIndex <= 0) return;
    const nextIdx = activeTab.historyIndex - 1;
    const prevUrl = activeTab.history[nextIdx];
    triggerTaptic('light', settings.systemHaptics, false);
    setBarCollapsed(false);
    onKeyboardSessionChange(null);
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              historyIndex: nextIdx,
              url: prevUrl,
              title: prevUrl ? getDisplayDomain(prevUrl) : 'Start Page',
            }
          : t,
      ),
    );
    setAddressInput(prevUrl);
    if (prevUrl) fetchViaProxy(prevUrl, desktopSite);
    else setProxiedSrcDoc('');
  };

  const goForward = () => {
    if (activeTab.historyIndex >= activeTab.history.length - 1) return;
    const nextIdx = activeTab.historyIndex + 1;
    const nextUrl = activeTab.history[nextIdx];
    triggerTaptic('light', settings.systemHaptics, false);
    setBarCollapsed(false);
    onKeyboardSessionChange(null);
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              historyIndex: nextIdx,
              url: nextUrl,
              title: nextUrl ? getDisplayDomain(nextUrl) : 'Start Page',
            }
          : t,
      ),
    );
    setAddressInput(nextUrl);
    if (nextUrl) fetchViaProxy(nextUrl, desktopSite);
    else setProxiedSrcDoc('');
  };

  const reloadCurrent = () => {
    triggerTaptic('rigid', settings.systemHaptics, false);
    if (activeTab.url) {
      fetchViaProxy(activeTab.url, desktopSite);
    }
  };

  const createNewTab = (isPrivate = false) => {
    triggerTaptic('selection', settings.systemHaptics, false);
    const id = `tab-${Date.now()}`;
    const newTab: SafariTab = {
      id,
      url: '',
      title: isPrivate ? 'Private Start Page' : 'Start Page',
      history: [''],
      historyIndex: 0,
      isPrivate,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
    setAddressInput('');
    setProxiedSrcDoc('');
    setReaderMode(false);
    setShowTabGrid(false);
    onKeyboardSessionChange(null);
  };

  const closeTab = (id: string) => {
    triggerTaptic('light', settings.systemHaptics, false);
    if (tabs.length === 1) {
      navigateTo('', false);
      setShowTabGrid(false);
      return;
    }
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id) {
      const next = remaining[remaining.length - 1];
      setActiveTabId(next.id);
      setAddressInput(next.url);
      if (next.url) fetchViaProxy(next.url, desktopSite);
      else setProxiedSrcDoc('');
    }
  };

  const isDark = settings.darkMode || activeTab.isPrivate;
  const barOnTop = settings.safariAddressBarLayout === 'top';
  const topSafeStyle = { paddingTop: `${modelSpec.safeTopPx}px` };
  const bottomBarPadCls = modelSpec.hasHomeButton ? 'pb-2' : 'pb-6';

  const handleTouchStartPull = (e: React.TouchEvent | React.MouseEvent) => {
    const el = startScrollRef.current;
    if (el && el.scrollTop <= 0) {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      pullStartYRef.current = clientY;
    }
  };

  const handleTouchMovePull = (e: React.TouchEvent | React.MouseEvent) => {
    if (pullStartYRef.current === null) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const dy = clientY - pullStartYRef.current;
    if (dy > 0) {
      const damped = Math.min(78, Math.pow(dy, 0.76) * 2.1);
      setPullOffset(damped);
    }
  };

  const handleTouchEndPull = () => {
    if (pullOffset > 54 && activeTab.url) {
      reloadCurrent();
    }
    pullStartYRef.current = null;
    setPullOffset(0);
  };

  const beginAddressEdit = () => {
    const currentVal = activeTab.url;
    setAddressInput(currentVal);
    setIsEditingUrl(true);
    onKeyboardSessionChange({
      source: 'native',
      inputType: 'url',
      enterKeyLabel: 'Go',
      value: currentVal,
      placeholder: 'Search or enter website name',
      canTabPrev: false,
      canTabNext: false,
    });
  };

  const renderAddressBar = () => {
    if (barCollapsed && !barOnTop && activeTab.url) {
      return (
        <button
          type="button"
          onClick={() => {
            triggerTaptic('selection', settings.systemHaptics, false);
            setBarCollapsed(false);
          }}
          className={`mx-auto ${modelSpec.hasHomeButton ? 'mb-2' : 'mb-5'} px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-md transition-all ${
            isDark
              ? 'bg-zinc-900/95 text-zinc-200 border border-white/10'
              : 'bg-white/95 text-zinc-800 border border-black/10'
          }`}
        >
          <Lock className="w-3 h-3 opacity-60" />
          <span className="truncate max-w-[180px]">{getDisplayDomain(activeTab.url)}</span>
        </button>
      );
    }

    return (
      <div
        style={barOnTop ? topSafeStyle : undefined}
        className={`w-full px-3 ${barOnTop ? 'pb-2 border-b' : `pt-2 ${bottomBarPadCls} border-t`} transition-colors z-30 ${
          isDark
            ? 'bg-zinc-950/95 border-white/10 text-zinc-100'
            : 'bg-zinc-100/95 border-black/10 text-zinc-900'
        }`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigateTo(addressInput, true);
          }}
          className={`relative flex items-center h-10 rounded-xl px-3 gap-2 shadow-sm border ${
            activeTab.isPrivate
              ? 'bg-zinc-900 border-indigo-500/40'
              : isDark
                ? 'bg-zinc-800/95 border-white/10'
                : 'bg-white border-black/10'
          }`}
        >
          {activeTab.url && !isEditingUrl && (
            <button
              type="button"
              onClick={() => {
                triggerTaptic('selection', settings.systemHaptics, false);
                setShowAaMenu((v) => !v);
                setShowShareSheet(false);
              }}
              className="text-xs font-semibold px-1.5 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 shrink-0"
              title="Page Settings, Zoom & Reader View"
            >
              Aa
            </button>
          )}

          {!isEditingUrl ? (
            <button
              type="button"
              onClick={beginAddressEdit}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm truncate py-1"
            >
              {activeTab.url ? (
                <>
                  <Lock className="w-3 h-3 text-zinc-400 shrink-0" />
                  <span className="truncate font-medium">{getDisplayDomain(activeTab.url)}</span>
                  {pageZoom !== 100 && (
                    <span className="text-[10px] text-blue-400 font-mono tabular-nums ml-1">
                      {pageZoom}%
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="text-zinc-400 truncate">Search or enter website name</span>
                </>
              )}
            </button>
          ) : (
            <input
              ref={addressInputElRef}
              type="text"
              autoFocus
              value={addressInput}
              onChange={(e) => {
                setAddressInput(e.target.value);
                onKeyboardSessionChange({
                  source: 'native',
                  inputType: 'url',
                  enterKeyLabel: 'Go',
                  value: e.target.value,
                  placeholder: 'Search or enter website name',
                  canTabPrev: false,
                  canTabNext: false,
                });
              }}
              placeholder="https://example.com or search..."
              className="flex-1 bg-transparent text-sm outline-none min-w-0"
            />
          )}

          {isEditingUrl && addressInput ? (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setAddressInput('');
              }}
              className="p-1 text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : activeTab.url ? (
            <button
              type="button"
              onClick={reloadCurrent}
              className="p-1 text-zinc-400 hover:text-blue-500 transition-colors shrink-0"
              title="Reload Page"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
            </button>
          ) : null}

          {isLoading && (
            <div className="absolute left-2 right-2 bottom-0 h-[2px] overflow-hidden rounded-full">
              <div
                className="h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
          )}
        </form>

        <div className="flex items-center justify-between px-2 pt-2">
          <button
            type="button"
            disabled={activeTab.historyIndex <= 0}
            onClick={goBack}
            className="min-w-[40px] min-h-[34px] flex items-center justify-center text-blue-500 disabled:opacity-30"
            title="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            disabled={activeTab.historyIndex >= activeTab.history.length - 1}
            onClick={goForward}
            className="min-w-[40px] min-h-[34px] flex items-center justify-center text-blue-500 disabled:opacity-30"
            title="Forward"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerTaptic('selection', settings.systemHaptics, false);
              setShowShareSheet((v) => !v);
              setShowAaMenu(false);
            }}
            className="min-w-[40px] min-h-[34px] flex items-center justify-center text-blue-500"
            title="Share & Add to Home Screen"
          >
            <Share className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerTaptic('selection', settings.systemHaptics, false);
              setShowBookmarks((v) => !v);
            }}
            className="min-w-[40px] min-h-[34px] flex items-center justify-center text-blue-500"
            title="Bookmarks"
          >
            <Bookmark className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerTaptic('selection', settings.systemHaptics, false);
              setShowTabGrid(true);
            }}
            className="min-w-[40px] min-h-[34px] flex items-center justify-center text-blue-500 relative"
            title="Tab Switcher"
          >
            <span className="w-5 h-5 rounded-[5px] border-[1.75px] border-current text-[10px] font-bold flex items-center justify-center tabular-nums">
              {tabs.length}
            </span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      onWheel={(e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.06 : 0.94;
          setPageZoom((prev) => Math.max(50, Math.min(250, Math.round(prev * factor))));
        }
      }}
      className={`w-full h-full flex flex-col relative select-none ${
        isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
      }`}
    >
      {barOnTop && renderAddressBar()}

      <div
        ref={startScrollRef}
        style={!barOnTop ? topSafeStyle : undefined}
        onMouseDown={handleTouchStartPull}
        onMouseMove={handleTouchMovePull}
        onMouseUp={handleTouchEndPull}
        onMouseLeave={handleTouchEndPull}
        onTouchStart={handleTouchStartPull}
        onTouchMove={handleTouchMovePull}
        onTouchEnd={handleTouchEndPull}
        className="flex-1 relative overflow-y-auto no-scrollbar"
      >
        {pullOffset > 8 && (
          <div
            className="flex items-center justify-center text-xs text-zinc-400 overflow-hidden transition-all"
            style={{ height: `${pullOffset}px` }}
          >
            <RotateCw
              className={`w-4 h-4 mr-1.5 ${pullOffset > 54 ? 'text-blue-500 animate-spin' : ''}`}
            />
            <span>{pullOffset > 54 ? 'Release to Reload' : 'Pull to Refresh'}</span>
          </div>
        )}

        {copiedBanner && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-medium shadow-lg border border-white/10">
            {copiedBanner}
          </div>
        )}

        {isOffline && activeTab.url ? (
          <div className="h-full flex flex-col items-center justify-center px-8 text-center">
            <WifiOff className="w-10 h-10 text-zinc-400 mb-3" />
            <h2 className="text-base font-semibold mb-1.5">
              Safari Cannot Open the Page Because Your iPhone Is Offline
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-5">
              Offline network profile or Airplane Mode is active. Switch back to Wi-Fi, LTE, or 3G to load web pages.
            </p>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  networkProfile: 'wifi',
                  airplaneMode: false,
                  wifiEnabled: true,
                  cellularEnabled: true,
                })
              }
              className="px-4 py-2 rounded-lg bg-blue-500 text-white text-xs font-semibold"
            >
              Restore Wi-Fi Connection
            </button>
          </div>
        ) : !activeTab.url ? (
          <div className="px-5 pt-4 pb-10 space-y-6">
            {activeTab.isPrivate && (
              <div className="p-4 rounded-2xl bg-zinc-900 border border-white/10 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldAlert className="w-4 h-4 text-indigo-400" />
                  <span>Private Browsing</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Safari won’t remember the pages you visit, your search history, or your AutoFill information.
                </p>
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold text-zinc-400 mb-3">Favorites</h3>
              <div className="grid grid-cols-4 gap-x-3 gap-y-4">
                {SAFARI_FAVORITES.map((fav) => (
                  <button
                    key={fav.url}
                    type="button"
                    onClick={() => navigateTo(fav.url, true)}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-bold shadow-sm group-active:scale-95 transition-transform"
                      style={{ backgroundColor: fav.bg, color: fav.fg }}
                    >
                      {fav.short}
                    </div>
                    <span className="text-[11px] font-medium truncate w-full text-center opacity-90">
                      {fav.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-zinc-400 mb-2">
                Interactive Web Input &amp; Form Testing
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo('https://html.duckduckgo.com/html/', true)}
                  className={`p-3 rounded-xl text-left text-xs border transition-colors ${
                    isDark
                      ? 'bg-zinc-900/70 border-white/10 hover:bg-zinc-800'
                      : 'bg-white border-black/5 hover:bg-zinc-100'
                  }`}
                >
                  <div className="font-semibold mb-0.5">Search Box Test</div>
                  <div className="text-zinc-400 truncate">Tap input to pop keyboard</div>
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('https://httpbin.org/forms/post', true)}
                  className={`p-3 rounded-xl text-left text-xs border transition-colors ${
                    isDark
                      ? 'bg-zinc-900/70 border-white/10 hover:bg-zinc-800'
                      : 'bg-white border-black/5 hover:bg-zinc-100'
                  }`}
                >
                  <div className="font-semibold mb-0.5">Multi-Field Form</div>
                  <div className="text-zinc-400 truncate">Test &lt; / &gt; field tabbing</div>
                </button>
              </div>
            </div>

            <div
              className={`p-3.5 rounded-2xl flex items-center gap-3 border ${
                isDark ? 'bg-zinc-900/80 border-white/10' : 'bg-white border-black/5'
              }`}
            >
              <Compass className="w-6 h-6 text-blue-500 shrink-0" />
              <p className="text-xs leading-snug opacity-80">
                Tap any text field inside a website to summon the iOS Software Keyboard, or hold Alt/Option while dragging to pinch-zoom.
              </p>
            </div>
          </div>
        ) : readerMode ? (
          <div
            className={`min-h-full px-6 py-6 space-y-4 ${
              isDark ? 'bg-[#161618] text-zinc-100' : 'bg-[#FBF8F1] text-zinc-900'
            }`}
            style={{ fontSize: `${Math.round(15 * (pageZoom / 100))}px` }}
          >
            <div className="text-xs uppercase tracking-wider opacity-50 font-medium">
              {getDisplayDomain(activeTab.url)} · Reader View
            </div>
            <h1 className="text-xl font-bold leading-snug">
              {readerData?.title || activeTab.title}
            </h1>
            {readerData && readerData.paragraphs.length > 0 ? (
              readerData.paragraphs.map((p, idx) => (
                <p key={idx} className="leading-relaxed opacity-90">
                  {p}
                </p>
              ))
            ) : (
              <p className="text-sm opacity-70">
                Reader View could not extract long-form article text from this page. Switch back to standard web view via the Aa menu.
              </p>
            )}
          </div>
        ) : (
          <div className="w-full h-full bg-white relative overflow-hidden">
            <iframe
              ref={iframeRef}
              title={activeTab.title}
              src={settings.safariUseProxy ? undefined : activeTab.url}
              srcDoc={settings.safariUseProxy ? proxiedSrcDoc : undefined}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              className="w-full h-full border-0 bg-white origin-top-left"
              style={
                pageZoom !== 100
                  ? {
                      width: `${10000 / pageZoom}%`,
                      height: `${10000 / pageZoom}%`,
                      transform: `scale(${pageZoom / 100})`,
                    }
                  : undefined
              }
            />
          </div>
        )}
      </div>

      {/* Aa Page Settings Popover */}
      {showAaMenu && (
        <div
          className={`absolute ${barOnTop ? 'top-24' : 'bottom-28'} left-4 right-4 z-40 rounded-2xl p-3 shadow-2xl border space-y-2 ${
            isDark
              ? 'bg-zinc-900 border-white/15 text-zinc-100'
              : 'bg-white border-black/10 text-zinc-900'
          }`}
        >
          <div className="flex items-center justify-between border-b border-current/10 pb-2">
            <button
              type="button"
              onClick={() => setPageZoom((z) => Math.max(50, z - 15))}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-current/10"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setPageZoom(100)}
              className="text-xs font-mono tabular-nums font-semibold"
              title="Tap to Reset Zoom to 100%"
            >
              {pageZoom}%
            </button>
            <button
              type="button"
              onClick={() => setPageZoom((z) => Math.min(250, z + 15))}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-current/10"
            >
              A+
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setReaderMode((r) => !r);
              setShowAaMenu(false);
            }}
            className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-current/5 text-xs font-medium"
          >
            <span>{readerMode ? 'Hide Reader View' : 'Show Reader View'}</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </button>

          <button
            type="button"
            onClick={() => {
              const nextDesktop = !desktopSite;
              setDesktopSite(nextDesktop);
              setShowAaMenu(false);
              if (activeTab.url) fetchViaProxy(activeTab.url, nextDesktop);
            }}
            className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-current/5 text-xs font-medium"
          >
            <span>{desktopSite ? 'Request Mobile Website' : 'Request Desktop Website'}</span>
            <Globe className="w-4 h-4 text-blue-500" />
          </button>

          <button
            type="button"
            onClick={() => {
              const nextProxy = !settings.safariUseProxy;
              onUpdateSettings({ safariUseProxy: nextProxy });
              setShowAaMenu(false);
              if (activeTab.url && nextProxy) fetchViaProxy(activeTab.url, desktopSite);
            }}
            className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-current/5 text-xs font-medium"
          >
            <span>Engine: {settings.safariUseProxy ? 'Mobile Safari Proxy' : 'Direct iFrame'}</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </button>

          <button
            type="button"
            onClick={() => {
              onUpdateSettings({
                safariAddressBarLayout: barOnTop ? 'bottom' : 'top',
              });
              setShowAaMenu(false);
            }}
            className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-current/5 text-xs font-medium"
          >
            <span>{barOnTop ? 'Move Address Bar to Bottom' : 'Move Address Bar to Top'}</span>
            <ArrowUp className={`w-4 h-4 ${barOnTop ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}

      {/* iOS Share Sheet */}
      {showShareSheet && (
        <div className="absolute inset-0 z-40 bg-black/50 flex flex-col justify-end">
          <div
            className={`rounded-t-3xl p-4 space-y-3 border-t ${
              isDark ? 'bg-zinc-900 border-white/10' : 'bg-zinc-100 border-black/10'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-current/10">
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">
                  {activeTab.title || 'Safari Start Page'}
                </div>
                <div className="text-[11px] opacity-60 truncate">
                  {activeTab.url || 'favorites://start'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShareSheet(false)}
                className="w-7 h-7 rounded-full bg-current/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  if (activeTab.url && navigator.clipboard) {
                    navigator.clipboard.writeText(activeTab.url).catch(() => {});
                  }
                  setCopiedBanner('Copied URL to Clipboard');
                  window.setTimeout(() => setCopiedBanner(null), 1800);
                  setShowShareSheet(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-medium ${
                  isDark ? 'bg-zinc-800' : 'bg-white'
                }`}
              >
                <span>Copy Link</span>
                <Copy className="w-4 h-4 opacity-70" />
              </button>

              <button
                type="button"
                disabled={!activeTab.url}
                onClick={() => {
                  if (!activeTab.url) return;
                  setBookmarks((prev) => [
                    { title: activeTab.title || getDisplayDomain(activeTab.url), url: activeTab.url },
                    ...prev.filter((b) => b.url !== activeTab.url),
                  ]);
                  setCopiedBanner('Added to Bookmarks');
                  window.setTimeout(() => setCopiedBanner(null), 1800);
                  setShowShareSheet(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-medium disabled:opacity-40 ${
                  isDark ? 'bg-zinc-800' : 'bg-white'
                }`}
              >
                <span>Add Bookmark</span>
                <Bookmark className="w-4 h-4 opacity-70" />
              </button>

              <button
                type="button"
                disabled={!activeTab.url}
                onClick={() => {
                  if (!activeTab.url) return;
                  onAddWebClip({
                    id: `clip-${Date.now()}`,
                    title: getDisplayDomain(activeTab.url).split('.')[0].slice(0, 10) || 'Web App',
                    url: activeTab.url,
                    accentColor: '#2563EB',
                  });
                  setCopiedBanner('Added Icon to Home Screen');
                  window.setTimeout(() => setCopiedBanner(null), 2000);
                  setShowShareSheet(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-medium disabled:opacity-40 ${
                  isDark ? 'bg-zinc-800' : 'bg-white'
                }`}
              >
                <span>Add to Home Screen</span>
                <PlusSquare className="w-4 h-4 opacity-70" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bookmarks Drawer */}
      {showBookmarks && (
        <div
          style={topSafeStyle}
          className={`absolute inset-0 z-40 flex flex-col ${
            isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
          }`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-current/10">
            <span className="text-sm font-semibold">Bookmarks</span>
            <button
              type="button"
              onClick={() => setShowBookmarks(false)}
              className="text-xs font-semibold text-blue-500"
            >
              Done
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {bookmarks.map((bm) => (
              <button
                key={bm.url}
                type="button"
                onClick={() => navigateTo(bm.url, true)}
                className={`w-full text-left p-3 rounded-xl border ${
                  isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-black/5'
                }`}
              >
                <div className="text-xs font-semibold truncate">{bm.title}</div>
                <div className="text-[11px] text-zinc-400 truncate">{bm.url}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab Grid Switcher */}
      {showTabGrid && (
        <div
          style={topSafeStyle}
          className={`absolute inset-0 z-50 flex flex-col pb-6 px-4 ${
            isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-200 text-zinc-900'
          }`}
        >
          <div className="flex items-center justify-between mb-3 pt-2">
            <span className="text-xs font-semibold opacity-70">{tabs.length} Tabs</span>
            <button
              type="button"
              onClick={() => createNewTab(true)}
              className="text-xs font-semibold text-indigo-400"
            >
              + Private
            </button>
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 content-start">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setAddressInput(tab.url);
                  if (tab.url) fetchViaProxy(tab.url, desktopSite);
                  else setProxiedSrcDoc('');
                  setShowTabGrid(false);
                }}
                className={`rounded-2xl p-3 border cursor-pointer flex flex-col justify-between h-36 transition-transform active:scale-95 ${
                  tab.id === activeTabId
                    ? 'border-blue-500 ring-2 ring-blue-500/30'
                    : 'border-current/10'
                } ${isDark ? 'bg-zinc-900' : 'bg-white'}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold truncate">{tab.title}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  {tab.url ? getDisplayDomain(tab.url) : 'Favorites'}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-current/10">
            <button
              type="button"
              onClick={() => createNewTab(false)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-500"
            >
              <Plus className="w-4 h-4" />
              <span>New Tab</span>
            </button>
            <button
              type="button"
              onClick={() => setShowTabGrid(false)}
              className="text-xs font-bold text-blue-500"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {!barOnTop && renderAddressBar()}
    </div>
  );
});

export default SafariApp;
