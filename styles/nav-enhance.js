/* nav-enhance.js — shared across all 15 styles.
   Adds keyboard ← / → and mouse back/forward (side) buttons to move between
   chapters while READING, by locating and clicking each site's own prev/next
   control. Capture phase + stopImmediatePropagation so sites that already bind
   the arrows don't advance twice. Gated to the reader view, so arrows on the
   library/detail pages are left untouched. */
(function () {
  "use strict";
  if (window.__navEnhanced) return;
  window.__navEnhanced = true;

  var NEXT_TXT = /next|下一[章节節回篇页頁]|后一|後一|下篇/i;
  var PREV_TXT = /prev|previous|上一[章节節回篇页頁]|前一|上篇/i;
  var NEXT_GLYPH = ["›", "»", "→", "▶", "⟩", "〉", "►"];
  var PREV_GLYPH = ["‹", "«", "←", "◀", "⟨", "〈", "◄"];
  // controls that are NOT chapter nav and must never be triggered
  var SKIP = /font|size|字号|字體|字体|a\+|a-|a−|theme|模式|back|返回|library|书架|書架|book\b|contents|目录|目錄|章节列表|home|首页|首頁|close|关闭|jack|archive/i;
  var START = /start reading|jack in|begin reading|read now|开始阅读|閱讀|进入阅读|开始阅读|开卷/i;

  function vis(el) {
    if (!el || el.offsetParent === null) return false;
    var r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }
  function clickables() {
    return [].slice.call(document.querySelectorAll('button, a, [role="button"], [data-nav], .nav-btn'))
             .filter(vis);
  }

  // Only navigate while actually reading: the library shows several long book
  // cards, the detail page shows a "start reading" control — exclude both.
  function inReader() {
    var els = clickables();
    for (var i = 0; i < els.length; i++) {
      if (START.test((els[i].getAttribute("aria-label") || "") + " " + (els[i].textContent || ""))) return false;
    }
    var longCards = els.filter(function (el) { return (el.textContent || "").trim().length > 40; });
    return longCards.length < 4;
  }

  function find(dir) {
    var txt = dir === "next" ? NEXT_TXT : PREV_TXT;
    var glyph = dir === "next" ? NEXT_GLYPH : PREV_GLYPH;
    var match = null, els = clickables();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var s = ((el.getAttribute("aria-label") || "") + " " +
               (el.getAttribute("title") || "") + " " +
               (el.textContent || "")).trim();
      if (SKIP.test(s)) continue;
      var hit = txt.test(s);
      if (!hit) { for (var g = 0; g < glyph.length; g++) { if (s.indexOf(glyph[g]) !== -1) { hit = true; break; } } }
      if (hit) match = el;          // keep the last visible match (chapter nav sits low)
    }
    return match;
  }

  function go(dir) {
    if (!inReader()) return false;
    var el = find(dir);
    if (!el) return false;
    if (el.disabled || el.getAttribute("aria-disabled") === "true") return true; // at an end: swallow, don't scroll
    el.click();
    return true;
  }

  function typing() {
    var a = document.activeElement;
    return a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
  }

  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typing()) return;
    var dir = e.key === "ArrowRight" ? "next" : e.key === "ArrowLeft" ? "prev" : null;
    if (!dir) return;
    if (go(dir)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);                          // capture: pre-empt any per-site arrow handler

  // mouse back (button 3) / forward (button 4) side buttons → prev / next
  function side(e) {
    var dir = e.button === 4 ? "next" : e.button === 3 ? "prev" : null;
    if (!dir) return;
    if (go(dir)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
  document.addEventListener("mouseup", side, true);
  document.addEventListener("auxclick", side, true);
  document.addEventListener("mousedown", function (e) {   // cancel browser history nav on side buttons
    if ((e.button === 3 || e.button === 4) && inReader() && find(e.button === 4 ? "next" : "prev")) e.preventDefault();
  }, true);

  // touch: horizontal swipe changes chapter (phones/tablets have no arrows or side buttons)
  var sx = 0, sy = 0, st = 0, tracking = false;
  document.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) { tracking = false; return; }
    var t = e.touches[0];
    sx = t.clientX; sy = t.clientY; st = Date.now(); tracking = true;
  }, { passive: true, capture: true });
  document.addEventListener("touchend", function (e) {
    if (!tracking) return;
    tracking = false;
    var t = (e.changedTouches && e.changedTouches[0]); if (!t) return;
    var dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st;
    if (dt > 800) return;                                  // too slow to be a swipe
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.6) return;  // not a clear horizontal swipe
    // swipe left (finger moves left, content advances) → next; swipe right → prev
    go(dx < 0 ? "next" : "prev");
  }, { passive: true, capture: true });
})();

/* =====================================================================
   Reading Companion — shared, theme-agnostic reading layer (2026-06-23).
   Added once here so EVERY style (01–30) gets it with no per-file edits.
   Three features, all defensive (never throw, degrade gracefully):
     1. Hands-free AUTO-SCROLL with adjustable speed  (key A; [ ] speed)
     2. Live TIME-REMAINING estimate for the chapter
     3. RESUME — remembers scroll position per chapter (localStorage)
   Only surfaces in the reader view, detected purely from the DOM so it
   works regardless of each style's markup.
   ===================================================================== */
(function () {
  "use strict";
  if (window.__readingCompanion) return;
  window.__readingCompanion = true;

  var WPM = 240;
  var SPD = [0.5, 0.9, 1.5, 2.4, 3.6];   // px per ~16ms frame
  var speedIdx = 2, playing = false, raf = 0, acc = 0;
  var cachedWords = 0, lastKey = "", saveT = 0, hideT = 0;

  function vis(el) {
    // offsetParent === null already rules out display:none (the inactive
    // SPA views), so a positive box size is enough — don't gate on the
    // viewport, which is unreliable in headless/odd-size contexts.
    if (!el || el.offsetParent === null) return false;
    var r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }
  function wc(s) { s = (s || "").trim(); return s ? s.split(/\s+/).length : 0; }

  // Largest single block of prose currently visible, grouped by parent.
  // In a reader this is the chapter (hundreds+ words); on library/detail
  // pages prose is short or scattered, so the max stays small.
  function longestProse() {
    var map = null, best = 0, bestEl = null, i, el, p, w;
    try { map = new Map(); } catch (e) { map = null; }
    var blocks = document.querySelectorAll('p, [class*="stanza"], pre');
    var byParent = [];
    function add(par, words, node) {
      if (!par) return;
      for (var k = 0; k < byParent.length; k++) if (byParent[k].el === par) { byParent[k].w += words; return; }
      byParent.push({ el: par, w: words });
    }
    for (i = 0; i < blocks.length; i++) {
      p = blocks[i];
      if (!vis(p)) continue;
      w = wc(p.textContent);
      if (w < 3) continue;
      add(p.parentElement, w, p);
    }
    for (i = 0; i < byParent.length; i++) if (byParent[i].w > best) { best = byParent[i].w; bestEl = byParent[i].el; }
    return { words: best, el: bestEl };
  }

  var START = /start reading|jack in|begin reading|read now|开始阅读|閱讀|进入阅读|开卷|enter the desert|break the seal|descend|fall toward|pull from the fire|board now|decrypt transcript|admit to|open the channel|open the slab|engage/i;
  function ctaPresent() {
    var els = document.querySelectorAll('button, a, [role="button"]');
    for (var i = 0; i < els.length; i++) {
      if (!vis(els[i])) continue;
      if (START.test((els[i].getAttribute("aria-label") || "") + " " + (els[i].textContent || ""))) return true;
    }
    return false;
  }
  // The reader bar is the ONLY view across all styles with A+/A- font
  // controls and a chapter-jump <select> — a length-independent signal.
  function fontCtrl() {
    var bs = document.querySelectorAll("button"), i;
    for (i = 0; i < bs.length; i++) {
      if (!vis(bs[i])) continue;
      if (/^a\s*[-+−–—＋]$/i.test((bs[i].textContent || "").trim())) return true;
    }
    return false;
  }
  function inReader() {
    if (ctaPresent()) return false;          // library/detail expose a "start" CTA
    if (fontCtrl()) return true;             // reader bar present
    return longestProse().words > 95;        // fallback: one long prose block
  }

  function readerHeading() {
    var hs = document.querySelectorAll("h1, h2"), cand = "";
    for (var i = 0; i < hs.length; i++) {
      if (!vis(hs[i])) continue;
      var t = (hs[i].textContent || "").trim();
      if (t && t.length < 90) { cand = t; break; }
    }
    return cand;
  }
  function slug(s) { return (s || "").toLowerCase().replace(/\s+/g, "-").replace(/[^\w一-鿿-]/g, "").slice(0, 60); }
  function chapterKey() { return slug(document.title) + "::" + slug(readerHeading()); }

  function scrollFrac() {
    var h = document.documentElement.scrollHeight - innerHeight;
    return h > 0 ? Math.min(1, Math.max(0, scrollY / h)) : 0;
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ---------- UI ----------
  var pill, btnPlay, speedDots, timeTxt, toast, built = false;
  function build() {
    if (built) return; built = true;
    var css = document.createElement("style");
    css.textContent =
      '.rc-pill{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;' +
      'display:none;align-items:center;gap:10px;padding:8px 12px;border-radius:999px;' +
      'background:rgba(18,18,20,.84);color:#fff;border:1px solid rgba(255,255,255,.18);' +
      'box-shadow:0 10px 34px rgba(0,0,0,.5);-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px);' +
      'font-family:ui-monospace,"JetBrains Mono",Menlo,monospace;font-size:11px;letter-spacing:.04em;' +
      'opacity:0;transition:opacity .35s;user-select:none}' +
      '.rc-pill.show{opacity:1}.rc-pill.dim{opacity:.18}' +
      '.rc-pill button{all:unset;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center}' +
      '.rc-b{width:26px;height:26px;border-radius:50%;border:1px solid rgba(255,255,255,.22)!important;font-size:12px;transition:background .15s}' +
      '.rc-b:hover{background:rgba(255,255,255,.16)}' +
      '.rc-play{width:30px;height:30px;background:rgba(255,255,255,.14)}' +
      '.rc-dots{display:flex;gap:3px;align-items:center}' +
      '.rc-dots i{width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,.3);transition:background .15s,transform .15s}' +
      '.rc-dots i.on{background:#fff;transform:scale(1.25)}' +
      '.rc-time{opacity:.78;white-space:nowrap;min-width:64px;text-align:center}' +
      '.rc-sep{width:1px;height:16px;background:rgba(255,255,255,.18)}' +
      '.rc-toast{position:fixed;left:50%;bottom:64px;transform:translateX(-50%) translateY(8px);z-index:2147483000;' +
      'display:none;align-items:center;gap:10px;padding:9px 14px;border-radius:999px;cursor:pointer;' +
      'background:rgba(18,18,20,.9);color:#fff;border:1px solid rgba(255,255,255,.2);box-shadow:0 10px 30px rgba(0,0,0,.5);' +
      '-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px);font-family:ui-monospace,monospace;font-size:11px;' +
      'letter-spacing:.05em;opacity:0;transition:opacity .35s,transform .35s}' +
      '.rc-toast.show{display:flex;opacity:1;transform:translateX(-50%) translateY(0)}' +
      '.rc-toast b{color:#9fe} @media print{.rc-pill,.rc-toast{display:none!important}}';
    document.head.appendChild(css);

    pill = document.createElement("div"); pill.className = "rc-pill"; pill.setAttribute("aria-label", "Reading companion");
    btnPlay = mk("button", "rc-play", "▶"); btnPlay.title = "Auto-scroll (A)"; btnPlay.setAttribute("aria-label", "Toggle auto-scroll");
    var slower = mk("button", "rc-b", "−"); slower.title = "Slower ([)"; slower.setAttribute("aria-label", "Slower");
    var faster = mk("button", "rc-b", "+"); faster.title = "Faster (])"; faster.setAttribute("aria-label", "Faster");
    speedDots = document.createElement("div"); speedDots.className = "rc-dots";
    for (var i = 0; i < SPD.length; i++) speedDots.appendChild(document.createElement("i"));
    timeTxt = document.createElement("div"); timeTxt.className = "rc-time"; timeTxt.textContent = "";
    var sep = document.createElement("div"); sep.className = "rc-sep";
    pill.appendChild(btnPlay); pill.appendChild(slower); pill.appendChild(speedDots); pill.appendChild(faster);
    pill.appendChild(sep); pill.appendChild(timeTxt);
    document.body.appendChild(pill);

    toast = document.createElement("div"); toast.className = "rc-toast";
    toast.innerHTML = '<span>↩ <b>Resume</b> where you left off</span>';
    document.body.appendChild(toast);

    btnPlay.onclick = function () { playing ? pause() : play(); };
    slower.onclick = function () { setSpeed(speedIdx - 1); };
    faster.onclick = function () { setSpeed(speedIdx + 1); };
    pill.addEventListener("mouseenter", function () { wake(); });
    toast.onclick = function () { resumeJump(); };
    renderSpeed();
  }
  function mk(t, c, txt) { var e = document.createElement(t); e.className = c; e.textContent = txt; return e; }
  function renderSpeed() { if (!speedDots) return; var d = speedDots.children; for (var i = 0; i < d.length; i++) d[i].className = i === speedIdx ? "on" : ""; }
  function setSpeed(i) { speedIdx = Math.max(0, Math.min(SPD.length - 1, i)); renderSpeed(); wake(); }

  // ---------- auto-scroll ----------
  function loop() {
    raf = requestAnimationFrame(loop);
    acc += SPD[speedIdx];
    var dy = Math.floor(acc); acc -= dy;
    if (dy > 0) {
      var before = scrollY; scrollBy(0, dy);
      if (scrollY === before) { pause(); }    // reached the end
    }
  }
  function play() {
    if (playing || !inReader()) return;
    playing = true; acc = 0; if (!raf) raf = requestAnimationFrame(loop);
    if (btnPlay) btnPlay.textContent = "⏸"; wake();
  }
  function pause() {
    playing = false; if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (btnPlay) btnPlay.textContent = "▶";
  }

  // ---------- time + resume ----------
  function refreshTime() {
    if (!timeTxt) return;
    var m = (1 - scrollFrac()) * cachedWords / WPM;
    timeTxt.textContent = cachedWords ? (m < 1 ? "<1 min left" : "≈ " + Math.round(m) + " min left") : "";
  }
  function savePos() {
    var now = Date.now(); if (now - saveT < 700) return; saveT = now;
    var f = scrollFrac();
    if (f > 0.03 && f < 0.97) lsSet("rc:" + chapterKey(), f.toFixed(3));
    else if (f >= 0.97) lsSet("rc:" + chapterKey(), "");   // finished → clear
  }
  function offerResume() {
    var saved = parseFloat(lsGet("rc:" + chapterKey()) || "0");
    if (saved > 0.06 && saved < 0.96 && scrollFrac() < 0.05) {
      toast._f = saved; toast.classList.add("show");
      clearTimeout(toast._t); toast._t = setTimeout(function () { toast.classList.remove("show"); }, 7000);
    } else { toast.classList.remove("show"); }
  }
  function resumeJump() {
    var h = document.documentElement.scrollHeight - innerHeight;
    scrollTo({ top: (toast._f || 0) * h, behavior: "smooth" });
    toast.classList.remove("show");
  }

  // ---------- visibility / activity ----------
  function wake() {
    if (!pill) return; pill.classList.add("show"); pill.classList.remove("dim");
    clearTimeout(hideT); hideT = setTimeout(function () { if (!playing) pill.classList.add("dim"); }, 3200);
  }
  function tick() {
    var r = inReader();
    if (!pill) return;
    if (r) {
      pill.style.display = "flex";
      var k = chapterKey();
      if (k !== lastKey) {                 // entered a new chapter
        lastKey = k; cachedWords = longestProse().words; acc = 0;
        if (playing) { /* keep rolling */ }
        refreshTime(); offerResume(); wake();
      }
    } else {
      pill.style.display = "none"; pill.classList.remove("show");
      if (playing) pause();
      lastKey = "";
      if (toast) toast.classList.remove("show");
    }
  }

  // cheap guard so we don't run heavy detection on every scroll event
  function inReaderCheapHint() { return pill && pill.style.display !== "none"; }
  function onScroll() { if (!inReaderCheapHint()) return; refreshTime(); savePos(); if (!playing) wake(); }

  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var a = document.activeElement;
    if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
    if (pill && pill.style.display === "none") return;
    if (e.key === "a" || e.key === "A") { e.preventDefault(); playing ? pause() : play(); }
    else if (e.key === "]") { setSpeed(speedIdx + 1); }
    else if (e.key === "[") { setSpeed(speedIdx - 1); }
    else if (e.key === "Escape" && playing) { pause(); }
    else if ((e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Home") && playing) { pause(); }
  });
  addEventListener("wheel", function (e) { if (playing && e.deltaY < -1) pause(); }, { passive: true });
  addEventListener("mousemove", function () { if (inReaderCheapHint()) wake(); }, { passive: true });
  addEventListener("scroll", onScroll, { passive: true });

  function boot() { build(); setInterval(tick, 600); tick(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
