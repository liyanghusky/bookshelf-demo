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
})();
