import { NextRequest, NextResponse } from 'next/server';

const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

const THROTTLE_CONFIG: Record<string, { rttMs: number; bytesPerSec: number }> = {
  wifi: { rttMs: 10, bytesPerSec: 30_000_000 },
  lte: { rttMs: 65, bytesPerSec: 3_000_000 },
  '3g': { rttMs: 320, bytesPerSec: 200_000 },
  'slow-3g': { rttMs: 780, bytesPerSec: 50_000 },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  if (/^10\./.test(lower) || /^192\.168\./.test(lower) || /^169\.254\./.test(lower)) {
    return true;
  }
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)) {
    return true;
  }
  return false;
}

function extractReaderText(html: string): { title: string; paragraphs: string[] } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Untitled Page';

  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

  const pMatches = Array.from(cleaned.matchAll(/<(p|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/gi));
  const paragraphs: string[] = [];

  for (let i = 0; i < pMatches.length && paragraphs.length < 60; i++) {
    const text = pMatches[i][2]
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 28) {
      paragraphs.push(text);
    }
  }

  return { title: rawTitle, paragraphs };
}

function injectSafariBridge(html: string, finalUrl: string): string {
  const parsed = new URL(finalUrl);
  const baseHref = `${parsed.origin}${parsed.pathname.replace(/[^/]*$/, '')}`;

  const bridgeSnippet = `
<base href="${baseHref}">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover">
<style>
  html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
  body { max-width: 100vw; overflow-x: hidden; transition: padding-bottom 0.2s ease; }
  body.ios-kb-open { padding-bottom: 270px !important; }
  img, video, iframe { max-width: 100%; height: auto; }
  #__ios_inspector_box {
    position: fixed;
    pointer-events: none;
    z-index: 2147483646;
    background: rgba(59, 130, 246, 0.22);
    border: 1.5px solid #2563EB;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);
    display: none;
    transition: all 0.06s ease-out;
  }
  #__ios_inspector_label {
    position: fixed;
    pointer-events: none;
    z-index: 2147483647;
    background: #0f172a;
    color: #f8fafc;
    font: 600 11px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.18);
    display: none;
    white-space: nowrap;
  }
</style>
<script>
(function() {
  try {
    var activeInputEl = null;
    var inspectMode = false;
    var overlayBox = null;
    var overlayLabel = null;

    function post(payload) {
      window.parent.postMessage(payload, '*');
    }

    function formatArg(a) {
      if (a === null) return 'null';
      if (a === undefined) return 'undefined';
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.name + ': ' + a.message;
      try {
        return JSON.stringify(a);
      } catch (e) {
        return String(a);
      }
    }

    // 1. Intercept Console Logs & Uncaught Errors for Developer Mode
    ['log', 'info', 'warn', 'error'].forEach(function(level) {
      var orig = console[level];
      console[level] = function() {
        var args = Array.prototype.slice.call(arguments);
        post({
          type: 'IOS_DEV_CONSOLE',
          level: level,
          message: args.map(formatArg).join(' '),
          source: location.hostname || 'page'
        });
        if (orig) orig.apply(console, arguments);
      };
    });

    window.addEventListener('error', function(ev) {
      post({
        type: 'IOS_DEV_CONSOLE',
        level: 'error',
        message: (ev.message || 'Runtime Error') + (ev.lineno ? ' (line ' + ev.lineno + ')' : ''),
        source: 'window.onerror'
      });
    });

    // 2. Build DOM Tree Snapshot & Element Inspector
    function buildSelector(el) {
      if (!el || !el.tagName) return 'body';
      var s = el.tagName.toLowerCase();
      if (el.id) s += '#' + el.id;
      else if (el.className && typeof el.className === 'string') {
        var cls = el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2);
        if (cls.length) s += '.' + cls.join('.');
      }
      return s;
    }

    function collectDomSummary() {
      var nodes = [];
      function walk(el, depth) {
        if (!el || !el.tagName || nodes.length >= 90 || depth > 7) return;
        var tag = el.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || el.id === '__ios_inspector_box' || el.id === '__ios_inspector_label') return;
        var txt = '';
        for (var i = 0; i < el.childNodes.length; i++) {
          if (el.childNodes[i].nodeType === 3) txt += el.childNodes[i].nodeValue;
        }
        nodes.push({
          tag: tag,
          id: el.id || '',
          classes: typeof el.className === 'string' ? el.className.trim() : '',
          textPreview: txt.replace(/\\s+/g, ' ').trim().slice(0, 48),
          depth: depth,
          selector: buildSelector(el)
        });
        for (var c = 0; c < el.children.length; c++) {
          walk(el.children[c], depth + 1);
        }
      }
      if (document.body) walk(document.body, 0);
      post({ type: 'IOS_DEV_DOM_TREE', nodes: nodes });
    }

    function ensureOverlay() {
      if (!overlayBox && document.body) {
        overlayBox = document.createElement('div');
        overlayBox.id = '__ios_inspector_box';
        overlayLabel = document.createElement('div');
        overlayLabel.id = '__ios_inspector_label';
        document.body.appendChild(overlayBox);
        document.body.appendChild(overlayLabel);
      }
    }

    function inspectElementNode(el) {
      if (!el || !el.tagName || el.id === '__ios_inspector_box' || el.id === '__ios_inspector_label') return;
      ensureOverlay();
      var r = el.getBoundingClientRect();
      if (overlayBox && overlayLabel) {
        overlayBox.style.display = 'block';
        overlayBox.style.left = r.left + 'px';
        overlayBox.style.top = r.top + 'px';
        overlayBox.style.width = Math.max(2, r.width) + 'px';
        overlayBox.style.height = Math.max(2, r.height) + 'px';

        overlayLabel.style.display = 'block';
        overlayLabel.textContent = buildSelector(el) + ' · ' + Math.round(r.width) + '×' + Math.round(r.height);
        overlayLabel.style.left = Math.max(4, Math.min(window.innerWidth - 180, r.left)) + 'px';
        overlayLabel.style.top = Math.max(4, r.top - 24) + 'px';
      }

      var cs = window.getComputedStyle(el);
      var attrs = [];
      if (el.attributes) {
        for (var i = 0; i < Math.min(el.attributes.length, 8); i++) {
          attrs.push({ name: el.attributes[i].name, value: String(el.attributes[i].value).slice(0, 80) });
        }
      }
      post({
        type: 'IOS_DEV_ELEMENT_SELECTED',
        element: {
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          classes: typeof el.className === 'string' ? el.className.trim() : '',
          selector: buildSelector(el),
          width: Math.round(r.width),
          height: Math.round(r.height),
          top: Math.round(r.top),
          left: Math.round(r.left),
          attributes: attrs,
          computedStyles: {
            display: cs.display,
            position: cs.position,
            color: cs.color,
            backgroundColor: cs.backgroundColor,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            padding: cs.padding,
            margin: cs.margin,
            borderRadius: cs.borderRadius
          },
          innerTextPreview: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
        }
      });
    }

    document.addEventListener('mousemove', function(e) {
      if (!inspectMode) return;
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (el) inspectElementNode(el);
    }, true);

    // 3. iOS Pop-Out Software Keyboard Bridge for Web Inputs!
    function isEditable(el) {
      if (!el || !el.tagName) return false;
      var t = el.tagName.toLowerCase();
      if (t === 'textarea') return !el.disabled && !el.readOnly;
      if (t === 'input') {
        var type = (el.getAttribute('type') || 'text').toLowerCase();
        var nonText = ['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'color', 'hidden', 'image'];
        return nonText.indexOf(type) === -1 && !el.disabled && !el.readOnly;
      }
      return el.isContentEditable === true;
    }

    function getEditableList() {
      var all = document.querySelectorAll('input, textarea, [contenteditable="true"]');
      var list = [];
      for (var i = 0; i < all.length; i++) {
        if (isEditable(all[i])) list.push(all[i]);
      }
      return list;
    }

    function syncKeyboardState(el) {
      var list = getEditableList();
      var idx = list.indexOf(el);
      var rawType = (el.getAttribute && el.getAttribute('type')) ? el.getAttribute('type').toLowerCase() : 'text';
      var inputType = el.tagName.toLowerCase() === 'textarea'
        ? 'textarea'
        : (rawType === 'search' ? 'search' : rawType === 'url' ? 'url' : rawType === 'email' ? 'email' : rawType === 'number' || rawType === 'tel' ? 'number' : rawType === 'password' ? 'password' : 'text');
      var enterLabel = inputType === 'search' || (el.form && rawType === 'text') ? 'Search' : inputType === 'url' ? 'Go' : 'Return';
      var val = el.isContentEditable ? (el.innerText || '') : (el.value || '');

      post({
        type: 'IOS_WEB_INPUT_FOCUS',
        session: {
          source: 'web',
          inputType: inputType,
          enterKeyLabel: enterLabel,
          value: val,
          placeholder: (el.getAttribute && el.getAttribute('placeholder')) || el.name || el.tagName.toLowerCase(),
          canTabPrev: idx > 0,
          canTabNext: idx !== -1 && idx < list.length - 1
        }
      });
    }

    function setNativeValue(el, nextVal) {
      if (!el) return;
      if (el.isContentEditable) {
        el.innerText = nextVal;
      } else {
        var proto = el.tagName.toLowerCase() === 'textarea'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        var desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) {
          desc.set.call(el, nextVal);
        } else {
          el.value = nextVal;
        }
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      syncKeyboardState(el);
    }

    document.addEventListener('focusin', function(e) {
      var el = e.target;
      if (isEditable(el)) {
        activeInputEl = el;
        if (document.body) document.body.classList.add('ios-kb-open');
        setTimeout(function() {
          try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (err) {}
        }, 80);
        syncKeyboardState(el);
      }
    }, true);

    document.addEventListener('input', function(e) {
      if (e.target === activeInputEl && isEditable(activeInputEl)) {
        syncKeyboardState(activeInputEl);
      }
    }, true);

    function notifyReady() {
      post({
        type: 'IOS_SAFARI_META',
        title: document.title || location.hostname,
        url: ${JSON.stringify(finalUrl)}
      });
      console.info('[WebKit] Navigated to ' + ${JSON.stringify(finalUrl)});
      collectDomSummary();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', notifyReady);
    } else {
      notifyReady();
    }

    var lastScrollY = 0;
    window.addEventListener('scroll', function() {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      if (Math.abs(y - lastScrollY) > 10) {
        post({
          type: 'IOS_SAFARI_SCROLL',
          scrollY: y,
          delta: y - lastScrollY
        });
        lastScrollY = y;
      }
    }, { passive: true });

    // Listen to parent iOS Hardware, Keyboard & Inspector Commands
    window.addEventListener('message', function(ev) {
      var d = ev.data;
      if (!d || typeof d !== 'object') return;

      if (d.type === 'IOS_SCROLL_TO_TOP') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (d.type === 'IOS_DEV_SET_INSPECT') {
        inspectMode = !!d.enabled;
        if (!inspectMode && overlayBox && overlayLabel) {
          overlayBox.style.display = 'none';
          overlayLabel.style.display = 'none';
        }
        if (inspectMode) collectDomSummary();
      } else if (d.type === 'IOS_DEV_QUERY_SELECTOR' && d.selector) {
        try {
          var found = document.querySelector(d.selector);
          if (found) {
            found.scrollIntoView({ behavior: 'smooth', block: 'center' });
            inspectElementNode(found);
          }
        } catch (err) {}
      } else if (d.type === 'IOS_DEV_EVAL_JS' && typeof d.code === 'string') {
        try {
          var res = (0, eval)(d.code);
          post({
            type: 'IOS_DEV_CONSOLE',
            level: 'result',
            message: '← ' + formatArg(res),
            source: 'REPL'
          });
        } catch (err) {
          post({
            type: 'IOS_DEV_CONSOLE',
            level: 'error',
            message: String(err),
            source: 'REPL'
          });
        }
      } else if (d.type === 'IOS_KB_INSERT' && activeInputEl) {
        var cur = activeInputEl.isContentEditable ? (activeInputEl.innerText || '') : (activeInputEl.value || '');
        setNativeValue(activeInputEl, cur + d.text);
      } else if (d.type === 'IOS_KB_BACKSPACE' && activeInputEl) {
        var curVal = activeInputEl.isContentEditable ? (activeInputEl.innerText || '') : (activeInputEl.value || '');
        setNativeValue(activeInputEl, curVal.slice(0, -1));
      } else if (d.type === 'IOS_KB_CLEAR' && activeInputEl) {
        setNativeValue(activeInputEl, '');
      } else if (d.type === 'IOS_KB_ENTER' && activeInputEl) {
        if (activeInputEl.tagName.toLowerCase() === 'textarea') {
          var cv = activeInputEl.value || '';
          setNativeValue(activeInputEl, cv + '\\n');
        } else if (activeInputEl.form) {
          if (typeof activeInputEl.form.requestSubmit === 'function') {
            activeInputEl.form.requestSubmit();
          } else {
            activeInputEl.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
        } else {
          activeInputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        }
      } else if (d.type === 'IOS_KB_TAB_FIELD' && activeInputEl) {
        var list = getEditableList();
        var i = list.indexOf(activeInputEl);
        var nextEl = list[i + (d.direction || 1)];
        if (nextEl) nextEl.focus();
      } else if (d.type === 'IOS_KB_DISMISS') {
        if (activeInputEl && activeInputEl.blur) activeInputEl.blur();
        activeInputEl = null;
        if (document.body) document.body.classList.remove('ios-kb-open');
      }
    });

    document.addEventListener('click', function(e) {
      if (inspectMode) {
        e.preventDefault();
        e.stopPropagation();
        inspectElementNode(e.target);
        return;
      }

      var clickedEditable = e.target && e.target.closest ? e.target.closest('input, textarea, [contenteditable="true"]') : null;
      if (clickedEditable && isEditable(clickedEditable)) {
        activeInputEl = clickedEditable;
        if (document.body) document.body.classList.add('ios-kb-open');
        syncKeyboardState(clickedEditable);
        return;
      }

      var target = e.target;
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }
      if (target && target.href) {
        var href = target.getAttribute('href') || '';
        if (href.startsWith('#') || href.startsWith('javascript:')) return;
        e.preventDefault();
        post({
          type: 'IOS_SAFARI_NAVIGATE',
          url: target.href
        });
      }
    }, true);

    document.addEventListener('submit', function(e) {
      var form = e.target;
      if (form && form.tagName === 'FORM') {
        e.preventDefault();
        var action = form.action || ${JSON.stringify(finalUrl)};
        var fd = new FormData(form);
        var params = new URLSearchParams();
        fd.forEach(function(val, key) {
          if (typeof val === 'string') params.append(key, val);
        });
        var sep = action.indexOf('?') === -1 ? '?' : '&';
        var dest = params.toString() ? (action + sep + params.toString()) : action;
        post({
          type: 'IOS_SAFARI_NAVIGATE',
          url: dest
        });
      }
    }, true);
  } catch (err) {}
})();
</script>`;

  const stripped = html.replace(
    /<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,
    '',
  );

  if (/<head[^>]*>/i.test(stripped)) {
    return stripped.replace(/<head[^>]*>/i, (match) => `${match}${bridgeSnippet}`);
  }
  return `<!DOCTYPE html><html><head>${bridgeSnippet}</head><body>${stripped}</body></html>`;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const rawUrl = req.nextUrl.searchParams.get('url') || '';
  const mode = req.nextUrl.searchParams.get('mode') || 'html';
  const desktopUa = req.nextUrl.searchParams.get('desktop') === '1';
  const throttle = req.nextUrl.searchParams.get('throttle') || 'wifi';

  if (throttle === 'offline') {
    return NextResponse.json(
      { ok: false, status: 0, error: 'Simulated Offline Mode active in Developer Tools.' },
      { status: 503 },
    );
  }

  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol) || isBlockedHost(targetUrl.hostname)) {
    return NextResponse.json(
      { error: 'Safari cannot open local or restricted network addresses.' },
      { status: 403 },
    );
  }

  const profile = THROTTLE_CONFIG[throttle] || THROTTLE_CONFIG.wifi;

  try {
    // Apply simulated RTT latency for 3G / Slow-3G / LTE network testing
    if (profile.rttMs > 20) {
      await sleep(profile.rttMs);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const upstream = await fetch(targetUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': desktopUa
          ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
          : IPHONE_SAFARI_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeout);

    const contentType = upstream.headers.get('content-type') || 'text/html';
    const finalUrl = upstream.url || targetUrl.toString();
    const rawBody = await upstream.text();
    const byteLength = Buffer.byteLength(rawBody, 'utf8');

    // Simulate downstream transfer pacing on throttled 3G connections (capped at 1.4s max so UI stays responsive)
    if (throttle === '3g' || throttle === 'slow-3g') {
      const transferDelay = Math.min(1400, Math.round((byteLength / profile.bytesPerSec) * 1000));
      if (transferDelay > 25) {
        await sleep(transferDelay);
      }
    }

    const durationMs = Date.now() - startedAt;

    if (contentType.includes('application/json') || contentType.includes('text/plain')) {
      const escaped = rawBody
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const wrappedHtml = injectSafariBridge(
        `<html><head><title>${targetUrl.hostname}</title></head><body style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 13px; padding: 16px; white-space: pre-wrap; word-break: break-word; background: #fff; color: #111;">${escaped}</body></html>`,
        finalUrl,
      );
      if (mode === 'json') {
        return NextResponse.json({
          ok: true,
          status: upstream.status,
          durationMs,
          sizeBytes: byteLength,
          finalUrl,
          title: targetUrl.hostname,
          html: wrappedHtml,
          reader: { title: targetUrl.hostname, paragraphs: [rawBody.slice(0, 3000)] },
        });
      }
      return new NextResponse(wrappedHtml, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const bridgedHtml = injectSafariBridge(rawBody, finalUrl);
    const reader = extractReaderText(rawBody);

    if (mode === 'json') {
      return NextResponse.json({
        ok: true,
        status: upstream.status,
        durationMs,
        sizeBytes: byteLength,
        finalUrl,
        title: reader.title || targetUrl.hostname,
        html: bridgedHtml,
        reader,
      });
    }

    return new NextResponse(bridgedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : 'Server stopped responding';
    const fallbackHtml = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Safari Can’t Open the Page</title>
<style>
  body {
    margin: 0;
    padding: 64px 28px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    background: #ffffff;
    color: #8e8e93;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 70vh;
  }
  h1 {
    font-size: 20px;
    font-weight: 600;
    color: #1c1c1e;
    margin: 0 0 12px;
  }
  p {
    font-size: 14px;
    line-height: 1.45;
    max-width: 280px;
    margin: 0;
  }
</style>
</head>
<body>
  <h1>Safari Can’t Open the Page</h1>
  <p>Safari can’t open the page “${targetUrl.hostname}” because the server could not be reached (${message}).</p>
</body>
</html>`;

    if (mode === 'json') {
      return NextResponse.json({
        ok: false,
        status: 502,
        durationMs,
        sizeBytes: fallbackHtml.length,
        finalUrl: targetUrl.toString(),
        title: 'Safari Can’t Open the Page',
        html: fallbackHtml,
        reader: { title: 'Unavailable', paragraphs: [] },
      });
    }

    return new NextResponse(fallbackHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
