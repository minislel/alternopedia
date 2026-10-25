/* Alternopedia client script: search, menus, TOC, appearance, history/source views and the 404 router. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var BASE = (doc.querySelector('meta[name="alt-base"]') || {}).content || '/';
  var dataEl = doc.getElementById('alt-page-data');
  var PAGE = {};
  try { PAGE = dataEl ? JSON.parse(dataEl.textContent) : {}; } catch (e) { PAGE = {}; }
  var params = new URLSearchParams(location.search);
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // ------------------------------------------------------------------ utils
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var NAMESPACES = /^(Special|Category|Talk|Help|Portal|Alternopedia|File|User|Template)$/i;
  function normTitle(t) {
    t = String(t || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    var c = t.indexOf(':');
    if (c > 0 && NAMESPACES.test(t.slice(0, c))) {
      var ns = t.slice(0, c), rest = t.slice(c + 1).trim();
      return ns.charAt(0).toUpperCase() + ns.slice(1).toLowerCase() + ':' + rest.charAt(0).toUpperCase() + rest.slice(1);
    }
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function wikiUrl(t) {
    return BASE + 'wiki/' + encodeURIComponent(normTitle(t).replace(/ /g, '_')).replace(/%3A/gi, ':').replace(/%2F/gi, '/');
  }
  function fmtDate(iso, withTime) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0');
    var day = d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
    return withTime === false ? day : hh + ':' + mm + ', ' + day;
  }
  function fmtNum(n) { return Number(n).toLocaleString('en-US'); }
  function getPrefs() { try { return JSON.parse(localStorage.getItem('alt-prefs') || '{}') || {}; } catch (e) { return {}; } }
  function setPrefs(p) { try { localStorage.setItem('alt-prefs', JSON.stringify(p)); } catch (e) { /* storage unavailable */ } }
  function updatePrefs(patch) { var p = getPrefs(); for (var k in patch) p[k] = patch[k]; setPrefs(p); return p; }

  var indexPromise = null;
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(BASE + 'search-index.json').then(function (r) {
        if (!r.ok) throw new Error('index ' + r.status);
        return r.json();
      }).catch(function (e) { indexPromise = null; throw e; });
    }
    return indexPromise;
  }

  // ------------------------------------------------------------------ notifications
  function toast(msg) {
    var box = $('.alt-notifications');
    if (!box) return;
    var n = doc.createElement('div');
    n.className = 'alt-notification';
    n.setAttribute('role', 'status');
    n.innerHTML = msg;
    box.appendChild(n);
    var close = function () {
      n.classList.add('is-leaving');
      setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 260);
    };
    n.addEventListener('click', close);
    setTimeout(close, 5200);
  }

  // ------------------------------------------------------------------ dropdowns
  function closeDropdowns(except) {
    $$('details.vector-dropdown[open]').forEach(function (d) { if (d !== except && !d.contains(except)) d.removeAttribute('open'); });
  }
  doc.addEventListener('toggle', function (e) {
    if (e.target.matches && e.target.matches('details.vector-dropdown') && e.target.open) closeDropdowns(e.target);
  }, true);
  doc.addEventListener('click', function (e) {
    var inside = e.target.closest && e.target.closest('details.vector-dropdown');
    closeDropdowns(inside || null);
    if (inside && e.target.closest('.vector-dropdown-content a[href^="#"]:not([href="#"])')) inside.removeAttribute('open');
  });
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDropdowns(null); closeLightbox(); }
  });

  // ------------------------------------------------------------------ generic actions
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    if (a.hasAttribute('data-toast')) { e.preventDefault(); toast(esc(a.getAttribute('data-toast'))); return; }
    if (a.hasAttribute('data-print')) { e.preventDefault(); closeDropdowns(null); window.print(); return; }
    if (a.hasAttribute('data-copy-url')) {
      e.preventDefault();
      var url = location.origin + location.pathname;
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast('Short URL copied: <b>' + esc(url) + '</b>'); }, function () { toast(esc(url)); });
      else toast(esc(url));
      return;
    }
    if (a.classList.contains('cn-link')) { e.preventDefault(); toast('<b>Citation needed.</b> The only known source for this claim is in a different timeline.'); return; }
    if (a.classList.contains('mp-year')) { e.preventDefault(); toast('Articles about individual years are still being written in this timeline.'); return; }
    if (a.classList.contains('alt-viewmode-toggle')) {
      e.preventDefault();
      var p = getPrefs();
      updatePrefs({ desktop: !p.desktop });
      location.reload();
      return;
    }
    if (a.classList.contains('mw-file-description') && a.querySelector('img')) { e.preventDefault(); openLightbox(a); }
  });

  // view mode link in footer
  (function () {
    var link = $('.alt-viewmode-toggle');
    if (!link) return;
    var desktop = root.classList.contains('alt-desktop-view');
    if (desktop) { link.textContent = 'Mobile view'; }
    else if (window.innerWidth >= 720) { link.parentNode.style.display = 'none'; }
  })();

  // ------------------------------------------------------------------ appearance
  function applyPrefs() {
    var p = getPrefs();
    root.classList.remove('alt-text-small', 'alt-text-standard', 'alt-text-large', 'alt-width-standard', 'alt-width-wide');
    root.classList.add('alt-text-' + (p.text || 'small'), 'alt-width-' + (p.width || 'standard'));
    root.setAttribute('data-theme', p.theme || 'light');
    root.classList.toggle('alt-appearance-unpinned', Boolean(p.appearanceHidden));
    root.classList.toggle('alt-toc-unpinned', Boolean(p.tocHidden));
    $$('.alt-appearance-group').forEach(function (g) {
      var name = g.getAttribute('data-pref');
      var val = p[name] || { text: 'small', width: 'standard', theme: 'light' }[name];
      $$('input', g).forEach(function (i) { i.checked = i.value === val; });
    });
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', root.getAttribute('data-theme') === 'dark' ? '#101418' : '#eaecf0');
  }
  doc.addEventListener('change', function (e) {
    var g = e.target.closest && e.target.closest('.alt-appearance-group');
    if (!g) return;
    var patch = {};
    patch[g.getAttribute('data-pref')] = e.target.value;
    updatePrefs(patch);
    applyPrefs();
  });
  doc.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('.alt-appearance-hide')) { updatePrefs({ appearanceHidden: true }); applyPrefs(); toast('Appearance moved to the <b>' + 'paintbrush' + '</b> menu in the header.'); }
    else if (t.closest('.alt-appearance-pin')) { updatePrefs({ appearanceHidden: false }); applyPrefs(); closeDropdowns(null); }
    else if (t.closest('.alt-toc-hide')) { updatePrefs({ tocHidden: true }); applyPrefs(); }
    else if (t.closest('.alt-toc-pin')) { updatePrefs({ tocHidden: false }); applyPrefs(); closeDropdowns(null); }
  });
  // In dropdown copies, swap "hide" for "move to sidebar"
  $$('#vector-appearance-dropdown .alt-appearance-hide').forEach(function (b) {
    b.className = 'vector-pinnable-header-toggle alt-appearance-pin'; b.textContent = 'move to sidebar';
  });
  $$('#vector-page-titlebar-toc .alt-toc-hide').forEach(function (b) {
    b.className = 'vector-pinnable-header-toggle alt-toc-pin'; b.textContent = 'move to sidebar';
  });
  applyPrefs();

  // ------------------------------------------------------------------ TOC
  doc.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.vector-toc-toggle');
    if (btn) {
      e.preventDefault();
      var li = btn.parentNode;
      var open = !li.classList.contains('vector-toc-list-item-expanded');
      li.classList.toggle('vector-toc-list-item-expanded', open);
      btn.setAttribute('aria-expanded', String(open));
      return;
    }
    var top = e.target.closest && e.target.closest('#toc-mw-content-text > a');
    if (top) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); history.replaceState(null, '', location.pathname + location.search); }
    var link = e.target.closest && e.target.closest('.vector-page-titlebar-toc .vector-toc-link');
    if (link) closeDropdowns(null);
  });
  (function scrollSpy() {
    var headings = $$('.mw-parser-output .mw-heading h2[id], .mw-parser-output .mw-heading h3[id]');
    if (!headings.length || !$('.vector-toc')) return;
    var current = null, ticking = false;
    function update() {
      ticking = false;
      var active = null;
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top < 90) active = headings[i]; else break;
      }
      var id = active ? active.id : 'mw-content-text';
      if (id === current) return;
      current = id;
      $$('.vector-toc-list-item-active').forEach(function (el) { el.classList.remove('vector-toc-list-item-active'); });
      $$('.vector-toc [id="toc-' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]').forEach(function (el) {
        el.classList.add('vector-toc-list-item-active');
        var parent = el.parentNode && el.parentNode.closest('.vector-toc-list-item');
        if (parent) { parent.classList.add('vector-toc-list-item-active'); parent.classList.add('vector-toc-list-item-expanded'); }
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  })();

  // ------------------------------------------------------------------ search
  (function search() {
    var form = $('#searchform');
    var input = $('#searchInput');
    var menu = $('.alt-suggestions');
    var header = $('.vector-header');
    if (!form || !input || !menu) return;
    var items = [], active = -1, lastQ = '';

    $('.search-toggle').addEventListener('click', function (e) {
      e.preventDefault();
      header.classList.add('alt-search-open');
      input.focus();
    });
    input.addEventListener('focus', function () { loadIndex().catch(function () {}); });
    input.addEventListener('blur', function () {
      setTimeout(function () {
        if (doc.activeElement && form.contains(doc.activeElement)) return;
        hide();
        if (!input.value) header.classList.remove('alt-search-open');
      }, 180);
    });

    function hide() { menu.hidden = true; active = -1; }
    function highlight(title, q) {
      var i = title.toLowerCase().indexOf(q.toLowerCase());
      if (i < 0) return esc(title);
      return esc(title.slice(0, i)) + '<b>' + esc(title.slice(i, i + q.length)) + '</b>' + esc(title.slice(i + q.length));
    }
    function compute(idx, q) {
      var ql = q.toLowerCase();
      var cands = [];
      idx.articles.forEach(function (a) { cands.push({ t: a.dt || a.t, u: a.u, d: a.d, i: a.i }); });
      Object.keys(idx.redirects || {}).forEach(function (r) {
        var tgt = idx.articles.filter(function (a) { return a.t === idx.redirects[r]; })[0];
        if (tgt) cands.push({ t: r, u: tgt.u + '?redirect=' + encodeURIComponent(r.replace(/ /g, '_')), d: 'Redirect to ' + tgt.t, i: tgt.i, redirect: tgt.t });
      });
      var scored = [];
      cands.forEach(function (c) {
        var tl = c.t.toLowerCase(), s = -1;
        if (tl.indexOf(ql) === 0) s = 0;
        else if ((' ' + tl).indexOf(' ' + ql) >= 0) s = 1;
        else if (tl.indexOf(ql) > 0) s = 2;
        if (s >= 0) scored.push({ c: c, s: s + (c.redirect ? .5 : 0) });
      });
      scored.sort(function (a, b) { return a.s - b.s || a.c.t.localeCompare(b.c.t); });
      var seen = {}, out = [];
      scored.forEach(function (x) {
        var key = x.c.redirect || x.c.t;
        if (seen[key]) return;
        seen[key] = true;
        out.push(x.c);
      });
      return out.slice(0, 10);
    }
    function render(q) {
      loadIndex().then(function (idx) {
        if (q !== input.value.trim()) return;
        items = compute(idx, q);
        active = -1;
        var html = items.map(function (it, n) {
          return '<a class="alt-suggestion" role="option" href="' + esc(it.u) + '" data-n="' + n + '">' +
            '<span class="alt-suggestion-thumb"' + (it.i ? ' style="background-image:url(\'' + esc(it.i) + '\')"' : '') + '>' + (it.i ? '' : '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5 1a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm0 3h10v1H5zm0 2h10v1H5zm0 2h10v1H5zm0 2h10v1H5zm0 2h7v1H5z"/></svg>') + '</span>' +
            '<span class="alt-suggestion-text"><span class="alt-suggestion-title">' + highlight(it.t, q) + '</span>' +
            (it.d ? '<span class="alt-suggestion-desc">' + esc(it.d) + '</span>' : '') + '</span></a>';
        }).join('');
        html += '<a class="alt-suggestion alt-suggestion-footer" href="' + wikiUrl('Special:Search') + '?search=' + encodeURIComponent(q) + '&fulltext=1" data-n="' + items.length + '">' +
          '<span class="alt-suggestion-thumb"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M12.2 13.6a7 7 0 1 1 1.4-1.4l5.4 5.4-1.4 1.4zM3 8a5 5 0 1 0 10 0A5 5 0 0 0 3 8"/></svg></span>' +
          '<span class="alt-suggestion-text"><span class="alt-suggestion-title">Search for pages containing <b>' + esc(q) + '</b></span></span></a>';
        menu.innerHTML = html;
        menu.hidden = false;
      }).catch(function () { hide(); });
    }
    input.addEventListener('input', function () {
      var q = input.value.trim();
      if (q === lastQ) return;
      lastQ = q;
      if (!q) { hide(); return; }
      render(q);
    });
    input.addEventListener('keydown', function (e) {
      var links = $$('.alt-suggestion', menu);
      if (menu.hidden || !links.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = e.key === 'ArrowDown' ? (active + 1) % links.length : (active <= 0 ? links.length - 1 : active - 1);
        links.forEach(function (l, i) { l.classList.toggle('is-active', i === active); });
      } else if (e.key === 'Escape') { hide(); }
    });
    form.addEventListener('submit', function (e) {
      var links = $$('.alt-suggestion', menu);
      if (!menu.hidden && active >= 0 && links[active]) { e.preventDefault(); location.href = links[active].href; return; }
      var q = input.value.trim();
      if (!q) { e.preventDefault(); return; }
      e.preventDefault();
      loadIndex().then(function (idx) {
        var t = normTitle(q);
        var hit = idx.articles.filter(function (a) { return a.t.toLowerCase() === t.toLowerCase(); })[0];
        if (hit) { location.href = hit.u; return; }
        var rk = Object.keys(idx.redirects || {}).filter(function (r) { return r.toLowerCase() === t.toLowerCase(); })[0];
        if (rk) { location.href = wikiUrl(idx.redirects[rk]) + '?redirect=' + encodeURIComponent(rk.replace(/ /g, '_')); return; }
        location.href = wikiUrl('Special:Search') + '?search=' + encodeURIComponent(q);
      }).catch(function () { location.href = wikiUrl('Special:Search') + '?search=' + encodeURIComponent(q); });
    });
  })();

  // ------------------------------------------------------------------ lightbox
  var lightbox = null;
  function openLightbox(a) {
    closeLightbox();
    var img = a.querySelector('img');
    var src = a.getAttribute('href') || img.src;
    var name = decodeURIComponent(src.split('/').pop());
    lightbox = doc.createElement('div');
    lightbox.className = 'alt-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.innerHTML = '<button class="alt-lightbox-close" aria-label="Close"><svg class="alt-icon" width="20" height="20" viewBox="0 0 20 20"><path d="m4.3 2.9 5.7 5.7 5.7-5.7 1.4 1.4-5.7 5.7 5.7 5.7-1.4 1.4-5.7-5.7-5.7 5.7-1.4-1.4 5.7-5.7-5.7-5.7z"/></svg></button>' +
      '<div class="alt-lightbox-stage"><img src="' + esc(src) + '" alt=""></div>' +
      '<div class="alt-lightbox-bar"><div class="alt-lb-name">File:' + esc(name) + '</div>' +
      (a.getAttribute('data-caption') ? '<div>' + esc(a.getAttribute('data-caption')) + '</div>' : '') +
      '<div style="color:#54595d;font-size:.8em;margin-top:.4em">Illustration made for Alternopedia · Elsewhen Commons</div></div>';
    doc.body.appendChild(lightbox);
    doc.body.style.overflow = 'hidden';
    lightbox.addEventListener('click', function (e) { if (!e.target.closest('.alt-lightbox-bar') && e.target.tagName !== 'IMG') closeLightbox(); });
  }
  function closeLightbox() {
    if (lightbox) { lightbox.parentNode.removeChild(lightbox); lightbox = null; doc.body.style.overflow = ''; }
  }

  // ------------------------------------------------------------------ page chrome helpers (used by views and router)
  function tabsHtml(list) {
    return list.map(function (t) {
      return '<li class="vector-tab-noicon mw-list-item' + (t.selected ? ' selected' : '') + (t.isNew ? ' new' : '') + '"><a href="' + esc(t.href) + '"><span>' + t.label + '</span></a></li>';
    }).join('');
  }
  function setPage(o) {
    if (o.docTitle) doc.title = o.docTitle + ' - Alternopedia';
    var h1 = $('#firstHeading');
    if (h1 && o.titleHtml != null) h1.innerHTML = o.titleHtml;
    if (o.nsTabs) $('#p-associated-pages').innerHTML = tabsHtml(o.nsTabs);
    if (o.viewTabs) $('#p-views').innerHTML = tabsHtml(o.viewTabs);
    if (o.sub != null) $('#contentSub').innerHTML = o.sub;
    var siteSub = $('#siteSub');
    if (siteSub) siteSub.style.display = o.siteSub ? '' : 'none';
    if (o.content != null) $('#mw-content-text').innerHTML = o.content;
    if (o.hideToc) {
      doc.body.classList.remove('alt-has-toc');
      $$('.vector-column-start nav, .vector-page-titlebar-toc').forEach(function (n) { n.parentNode.removeChild(n); });
    }
    var cat = $('#catlinks');
    if (o.hideCategories && cat) cat.parentNode.removeChild(cat);
    var ind = $('.mw-indicators');
    if (o.hideIndicators && ind) ind.parentNode.removeChild(ind);
    if (o.hideLang) { var l = $('#p-lang-btn'); if (l) l.parentNode.removeChild(l); }
    if (doc.body.classList.contains('alt-main-page') && o.titleHtml != null) {
      doc.body.classList.remove('alt-main-page');
      $('.vector-page-titlebar').classList.remove('alt-title-hidden');
    }
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ history & source views
  function historyHtml(title, entries) {
    var list = entries.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    var prevSize = 0;
    list.forEach(function (e) { e._diff = e.size - prevSize; prevSize = e.size; });
    list.reverse();
    var rows = list.map(function (e, i) {
      var diff = e._diff;
      var cls = diff > 0 ? 'mw-plusminus-pos' : diff < 0 ? 'mw-plusminus-neg' : 'mw-plusminus-null';
      var diffTxt = (diff > 0 ? '+' : diff < 0 ? '−' : '') + fmtNum(Math.abs(diff));
      if (Math.abs(diff) > 500) diffTxt = '<strong>' + diffTxt + '</strong>';
      var userUrl = wikiUrl('User:' + e.user);
      var isIp = /^\d+\.\d+\.\d+\.\d+$|:/.test(e.user);
      return '<li><span class="mw-history-histlinks">(' + (i === 0 ? 'cur' : '<a href="#" data-toast="Diffs between timelines are not supported.">cur</a>') + ' | ' +
        (i === list.length - 1 ? 'prev' : '<a href="#" data-toast="Diffs between timelines are not supported.">prev</a>') + ')</span> ' +
        '<input type="radio" disabled aria-label="Select revision"> ' +
        '<a href="#" class="mw-changeslist-date" data-toast="Old revisions are archived in the other timeline.">' + esc(fmtDate(e.date)) + '</a> ' +
        '<span class="history-user"><a href="' + userUrl + '" class="' + (isIp ? 'mw-anonuserlink' : 'new') + '">' + esc(e.user) + '</a> <span class="mw-usertoollinks">(<a href="' + wikiUrl('User talk:' + e.user) + '" class="new">talk</a> | <a href="#" data-toast="Contributions from other timelines are hidden.">contribs</a>)</span></span> ' +
        (e.minor ? '<abbr class="minoredit" title="This is a minor edit">m</abbr> ' : '') +
        '<span class="history-size">' + fmtNum(e.size) + ' bytes</span> <span class="' + cls + '">' + diffTxt + '</span> ' +
        (e.summary ? '<span class="comment">(' + esc(e.summary) + ')</span> ' : '') +
        (e.tags ? '<span class="mw-tag-markers">Tags: ' + esc(e.tags) + '</span> ' : '') +
        (i === 0 ? '' : '<span class="mw-history-undo">(<a href="#" data-toast="You cannot undo history from here. Many have tried.">undo</a>)</span>') +
        '</li>';
    }).join('');
    return '<div class="mw-parser-output">' +
      '<div class="alt-filter-box">Filter revisions by date or tag — unavailable for visitors from other timelines.</div>' +
      '<div class="mw-history-legend">For any version listed below, click on its date to view it. For more help, see <a href="' + wikiUrl('Help:Page history') + '" class="new">Help:Page history</a> and <a href="' + wikiUrl('Help:Edit summary') + '" class="new">Help:Edit summary</a>.<br>' +
      '(cur) = difference from current version, (prev) = difference from preceding version, m = minor edit, → = section edit, ← = automatic edit summary</div>' +
      '<div class="mw-pager-navigation-bar">(newest | oldest) View (newer 50 | older 50) (20 | 50 | 100 | 250 | 500)</div>' +
      '<ul class="mw-contributions-list">' + rows + '</ul>' +
      '<div class="mw-pager-navigation-bar">(newest | oldest) View (newer 50 | older 50) (20 | 50 | 100 | 250 | 500)</div></div>';
  }

  function articleViews() {
    if (PAGE.type !== 'article' && PAGE.type !== 'main') return;
    var title = PAGE.title;
    var action = params.get('action');
    var readUrl = PAGE.type === 'main' ? BASE : wikiUrl(title);
    var nsTabs = PAGE.type === 'main'
      ? [{ label: 'Main Page', href: BASE, selected: true }, { label: 'Talk', href: wikiUrl('Talk:Main Page') }]
      : [{ label: 'Article', href: readUrl, selected: true }, { label: 'Talk', href: wikiUrl('Talk:' + title), isNew: true }];
    var editLabel = PAGE.type === 'main' ? 'View source' : 'Edit';

    if (action === 'history') {
      setPage({
        docTitle: title + ': Revision history',
        titleHtml: '<span class="mw-page-title-main">' + esc(title) + '</span>: Revision history',
        nsTabs: nsTabs,
        viewTabs: [{ label: 'Read', href: readUrl }, { label: editLabel, href: '?action=edit' }, { label: 'View history', href: '?action=history', selected: true }],
        sub: '<a href="#" data-toast="The logs are kept in the other timeline.">View logs for this page</a> (<a href="#" data-toast="The filter log is also in the other timeline.">view filter log</a>)',
        siteSub: false,
        content: historyHtml(title, PAGE.history && PAGE.history.length ? PAGE.history : [{ date: PAGE.lastEdited || new Date().toISOString(), user: 'Elsewhen bot', size: (PAGE.source || '').length, summary: 'Created page' }]),
        hideToc: true, hideCategories: true, hideIndicators: true, hideLang: true,
      });
      return;
    }
    if (action === 'edit' || action === 'submit') {
      setPage({
        docTitle: 'View source for ' + title,
        titleHtml: 'View source for <span class="mw-page-title-main">' + esc(title) + '</span>',
        nsTabs: nsTabs,
        viewTabs: [{ label: 'Read', href: readUrl }, { label: editLabel, href: '?action=edit', selected: true }, { label: 'View history', href: '?action=history' }],
        sub: '← <a href="' + readUrl + '">' + esc(title) + '</a>',
        siteSub: false,
        content: '<div class="mw-parser-output"><p>You do not have permission to edit this page, for the following reason:</p>' +
          '<table class="fmbox" role="presentation"><tbody><tr><td class="mbox-image"><svg width="36" height="36" viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="8.5" width="13" height="10" rx="1.5" fill="#bebebe" stroke="#797979"/><path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="#797979" stroke-width="2"/></svg></td>' +
          '<td>This page has been <b>timeline-protected</b>. Only editors who were born in this timeline can change its history. Edits from your timeline would cause a paradox and have been disabled as a precaution.</td></tr></tbody></table>' +
          '<p>You can view and copy the source of this page.</p>' +
          '<textarea class="alt-source-box" readonly spellcheck="false" aria-label="Page source">' + esc(PAGE.source || '') + '</textarea>' +
          '<p>Return to <a href="' + readUrl + '">' + esc(title) + '</a>.</p></div>',
        hideToc: true, hideCategories: true, hideIndicators: true, hideLang: true,
      });
      return;
    }
    if (action) {
      toast('That action is not available in this timeline.');
    }
    var redirect = params.get('redirect');
    if (redirect && redirect !== 'no' && PAGE.type === 'article') {
      $('#contentSub').innerHTML = '<span class="mw-redirectedfrom">(Redirected from <a href="' + wikiUrl(redirect) + '?redirect=no" class="mw-redirect">' + esc(normTitle(redirect)) + '</a>)</span>';
    }
  }

  // ------------------------------------------------------------------ main page rotation
  function mainPage() {
    if (PAGE.type !== 'main' || params.get('action')) return;
    var now = new Date();
    var dayNumber = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
    ['tfa', 'potd'].forEach(function (g) {
      var els = $$('.mp-rotate[data-rotate="' + g + '"]');
      if (!els.length) return;
      var pick = (dayNumber + (g === 'potd' ? 1 : 0)) % els.length;
      els.forEach(function (el, i) { el.hidden = i !== pick; });
    });
    var dateLink = $('.alt-otd-date');
    if (dateLink) dateLink.textContent = MONTHS[now.getMonth()] + ' ' + now.getDate();
    var intro = $('.alt-otd-intro');
    if (intro) {
      try {
        var intros = JSON.parse(intro.getAttribute('data-intros') || '{}');
        var mmdd = String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        var full = now.getFullYear() + '-' + mmdd;
        if (intros[full] || intros[mmdd]) intro.innerHTML = intros[full] || intros[mmdd];
      } catch (e) { /* keep default intro */ }
    }
    var items = $$('.alt-otd-list li');
    if (items.length > 5) {
      // deterministic daily shuffle
      var seed = dayNumber * 9301 + 49297;
      var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      var order = items.map(function (el, i) { return { el: el, r: rnd(), i: i }; });
      order.sort(function (a, b) { return a.r - b.r; });
      var chosen = order.slice(0, 5).map(function (x) { return x.el; });
      chosen.sort(function (a, b) { return parseInt(a.querySelector('.mp-year').textContent, 10) - parseInt(b.querySelector('.mp-year').textContent, 10); });
      var list = $('.alt-otd-list');
      items.forEach(function (el) { el.hidden = true; });
      chosen.forEach(function (el) { el.hidden = false; list.appendChild(el); });
    }
  }

  // ------------------------------------------------------------------ router (404 page)
  function router() {
    if (PAGE.type !== 'router') return;
    var prefix = BASE + 'wiki/';
    var path = location.pathname;
    var raw;
    if (path.indexOf(prefix) === 0) raw = path.slice(prefix.length);
    else raw = path.slice(BASE.length) || 'Main Page';
    try { raw = decodeURIComponent(raw); } catch (e) { /* keep raw */ }
    raw = raw.replace(/\.html$/, '');
    var title = normTitle(raw);
    var colon = title.indexOf(':');
    var ns = colon > 0 && NAMESPACES.test(title.slice(0, colon)) ? title.slice(0, colon) : '';
    var name = ns ? title.slice(colon + 1) : title;

    var projectPages = PAGE.projectPages || {};
    if (projectPages[title]) {
      setPage({
        docTitle: title,
        titleHtml: '<span class="mw-page-title-namespace">' + esc(ns) + '</span><span class="mw-page-title-separator">:</span><span class="mw-page-title-main">' + esc(name) + '</span>',
        nsTabs: [{ label: ns === 'Help' ? 'Help page' : ns === 'Portal' ? 'Portal' : 'Project page', href: location.pathname, selected: true }, { label: 'Talk', href: wikiUrl('Talk:' + title), isNew: true }],
        viewTabs: [{ label: 'Read', href: location.pathname, selected: true }, { label: 'View source', href: '?action=edit' }, { label: 'View history', href: '?action=history' }],
        sub: '', siteSub: true,
        content: '<div class="mw-parser-output">' + projectPages[title] + '</div>',
        hideToc: true,
      });
      return;
    }

    if (ns === 'Special') {
      special(name.split('/')[0], name.split('/').slice(1).join('/'));
      return;
    }

    loadIndex().then(function (idx) {
      if (ns === 'Category') return categoryPage(idx, name);
      if (ns === 'Talk' || ns === 'User' || /talk$/i.test(ns)) return missingPage(idx, title, ns, name);
      if (!ns) {
        var rk = Object.keys(idx.redirects || {}).filter(function (r) { return r.toLowerCase() === title.toLowerCase(); })[0];
        if (rk && params.get('redirect') !== 'no') {
          location.replace(wikiUrl(idx.redirects[rk]) + '?redirect=' + encodeURIComponent(rk.replace(/ /g, '_')));
          return;
        }
        if (rk) return redirectPage(rk, idx.redirects[rk]);
        var hit = idx.articles.filter(function (a) { return a.t.toLowerCase() === title.toLowerCase(); })[0];
        if (hit) { location.replace(hit.u + location.search + location.hash); return; }
      }
      missingPage(idx, title, ns, name);
    }).catch(function () { missingPage({ articles: [], redirects: {}, redlinks: {} }, title, ns, name); });
  }

  function redirectPage(from, to) {
    setPage({
      docTitle: from,
      titleHtml: '<span class="mw-page-title-main">' + esc(from) + '</span>',
      nsTabs: [{ label: 'Article', href: location.pathname, selected: true }, { label: 'Talk', href: wikiUrl('Talk:' + from), isNew: true }],
      viewTabs: [{ label: 'Read', href: location.pathname, selected: true }, { label: 'Edit', href: '?action=edit' }, { label: 'View history', href: '?action=history' }],
      sub: 'Redirect page', siteSub: true, hideToc: true,
      content: '<div class="mw-parser-output"><div class="redirectMsg"><p>Redirect to:</p><ul class="redirectText"><li><a href="' + wikiUrl(to) + '">' + esc(to) + '</a></li></ul></div></div>',
    });
  }

  function missingPage(idx, title, ns, name) {
    var isTalk = ns === 'Talk' || /talk$/i.test(ns);
    var linking = (idx.redlinks && idx.redlinks[title]) || [];
    var q = encodeURIComponent(name);
    var what = isTalk ? 'a talk page' : ns === 'User' ? 'a user page' : ns ? 'a page' : 'an article';
    var nsTabs = isTalk
      ? [{ label: 'Article', href: wikiUrl(name), isNew: !idx.articles.some(function (a) { return a.t === normTitle(name); }) }, { label: 'Talk', href: location.pathname, selected: true, isNew: true }]
      : [{ label: ns === 'User' ? 'User page' : ns ? 'Page' : 'Article', href: location.pathname, selected: true, isNew: true }, { label: 'Talk', href: wikiUrl('Talk:' + title), isNew: true }];
    var html = '<div class="mw-parser-output"><div class="noarticletext mw-content-ltr"><table class="fmbox fmbox-system" role="presentation"><tbody><tr>' +
      '<td class="mbox-image"><svg width="40" height="40" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#36c"/><path fill="#fff" d="M9 8h2v7H9zm0-3h2v2H9z"/></svg></td><td class="mbox-text">' +
      '<p><b>Alternopedia does not have ' + what + ' with this exact name.</b> ' +
      (isTalk ? 'Nobody in this timeline has argued about it yet — which, for an encyclopedia, is a historic first.' :
        'It may already exist in a neighbouring timeline. Please <a href="' + wikiUrl('Special:Search') + '?search=' + q + '&fulltext=1"><i>search for ' + esc(name) + '</i></a> in Alternopedia to check for alternative titles or spellings.') + '</p>' +
      '<ul>' +
      (isTalk ? '' : '<li><a href="' + wikiUrl('Special:UserLogin') + '">Log in or create an account</a> to start the <i>' + esc(name) + '</i> article, alternatively use the <a href="' + wikiUrl('Alternopedia:File upload wizard') + '">Article Wizard</a>, or wait for it to diverge on its own.</li>') +
      '<li>Search for "<a href="' + wikiUrl('Special:Search') + '?search=' + q + '&fulltext=1">' + esc(name) + '</a>" in existing articles.</li>' +
      '<li>Look for pages within Alternopedia that <a href="' + wikiUrl('Special:WhatLinksHere/' + title) + '">link to this title</a>' + (linking.length ? ' — <b>' + linking.length + ' page' + (linking.length > 1 ? 's' : '') + '</b> already ' + (linking.length > 1 ? 'do' : 'does') + ', so this is a <a href="' + wikiUrl('Special:WantedPages') + '">wanted article</a>.' : '.') + '</li>' +
      '</ul><p style="font-size:90%">Other reasons this message may be displayed: If a page was recently created here, it may not be visible yet because of a delay in synchronising timelines; wait a few minutes or try the <a href="?action=purge">purge function</a>. Titles on Alternopedia are case sensitive except for the first character.</p>' +
      '</td></tr></tbody></table></div></div>';
    setPage({
      docTitle: title,
      titleHtml: '<span class="mw-page-title-main">' + esc(title) + '</span>',
      nsTabs: nsTabs,
      viewTabs: [{ label: 'Read', href: location.pathname, selected: true }, { label: 'Create', href: '?action=edit' }],
      sub: '', siteSub: false, hideToc: true, content: html,
    });
    if (params.get('action') === 'edit') toast('Creating pages is reserved for editors from this timeline.');
  }

  function categoryPage(idx, name) {
    var members = idx.articles.filter(function (a) { return (a.c || []).indexOf(normTitle(name)) >= 0; }).sort(function (a, b) { return a.t.localeCompare(b.t); });
    var html;
    if (!members.length) {
      html = '<div class="mw-parser-output"><p>This category currently contains no pages or media.</p></div>';
    } else {
      var groups = {};
      members.forEach(function (m) { var L = (m.dt || m.t).charAt(0).toUpperCase(); (groups[L] = groups[L] || []).push(m); });
      html = '<div class="mw-parser-output"><div id="mw-pages"><h2 style="font-family:var(--font-serif);font-weight:normal;border-bottom:1px solid var(--border-base);font-size:1.5em;margin:.6em 0 .3em">Pages in category "' + esc(name) + '"</h2>' +
        '<p>The following ' + members.length + ' page' + (members.length > 1 ? 's are' : ' is') + ' in this category, out of ' + members.length + ' total.</p><div class="alt-router-list">' +
        Object.keys(groups).sort().map(function (L) {
          return '<div style="break-inside:avoid"><h3 style="margin:.4em 0 .1em">' + esc(L) + '</h3><ul>' + groups[L].map(function (m) { return '<li><a href="' + m.u + '">' + esc(m.dt || m.t) + '</a></li>'; }).join('') + '</ul></div>';
        }).join('') + '</div></div></div>';
    }
    setPage({
      docTitle: 'Category:' + name,
      titleHtml: '<span class="mw-page-title-namespace">Category</span><span class="mw-page-title-separator">:</span><span class="mw-page-title-main">' + esc(name) + '</span>',
      nsTabs: [{ label: 'Category', href: location.pathname, selected: true, isNew: !members.length }, { label: 'Talk', href: wikiUrl('Category talk:' + name), isNew: true }],
      viewTabs: [{ label: 'Read', href: location.pathname, selected: true }, { label: 'Edit', href: '?action=edit' }, { label: 'View history', href: '?action=history' }],
      sub: '', siteSub: true, hideToc: true, content: html,
    });
  }

  function specialShell(name, title, content, sub) {
    setPage({
      docTitle: title,
      titleHtml: esc(title),
      nsTabs: [{ label: 'Special page', href: location.pathname + location.search, selected: true }],
      viewTabs: [],
      sub: sub || '', siteSub: false, hideToc: true, content: '<div class="mw-parser-output">' + content + '</div>',
    });
  }

  function snippetFor(text, terms) {
    var lower = text.toLowerCase();
    var pos = -1;
    terms.forEach(function (t) { var p = lower.indexOf(t); if (p >= 0 && (pos < 0 || p < pos)) pos = p; });
    var start = Math.max(0, pos - 70);
    var snip = text.slice(start, start + 230);
    if (start > 0) snip = '…' + snip.slice(snip.indexOf(' ') + 1);
    var html = esc(snip);
    terms.forEach(function (t) {
      if (!t) return;
      html = html.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<span class="searchmatch">$1</span>');
    });
    return html + '…';
  }

  function special(name, sub) {
    var key = name.toLowerCase().replace(/[\s_]/g, '');
    if (key === 'random' || key === 'randompage') {
      loadIndex().then(function (idx) {
        var a = idx.articles[Math.floor(Math.random() * idx.articles.length)];
        location.replace(a.u);
      });
      specialShell(name, 'Random article', '<p>Picking a random article from this timeline…</p>');
      return;
    }
    if (key === 'search') return searchPage();
    loadIndex().then(function (idx) {
      var arts = idx.articles.slice().sort(function (a, b) { return (a.dt || a.t).localeCompare(b.dt || b.t); });
      if (key === 'allpages' || key === 'contents') {
        specialShell(name, 'All pages', '<p>Every article currently known to this timeline:</p><ul class="alt-router-list">' +
          arts.map(function (a) { return '<li><a href="' + a.u + '">' + esc(a.dt || a.t) + '</a></li>'; }).join('') +
          Object.keys(idx.redirects).sort().map(function (r) { return '<li><i><a href="' + wikiUrl(r) + '?redirect=no" class="mw-redirect">' + esc(r) + '</a></i></li>'; }).join('') + '</ul>');
      } else if (key === 'recentchanges') {
        var all = [];
        idx.articles.forEach(function (a) {
          var h = (a.h || []).slice().sort(function (x, y) { return new Date(x.date) - new Date(y.date); });
          var prev = 0;
          h.forEach(function (e) { all.push({ t: a.dt || a.t, u: a.u, e: e, d: e.size - prev }); prev = e.size; });
        });
        all.sort(function (x, y) { return new Date(y.e.date) - new Date(x.e.date); });
        var day = '', html = '<p>Track the most recent changes to the history of this timeline on this page.</p>';
        all.slice(0, 60).forEach(function (r) {
          var d = fmtDate(r.e.date, false);
          if (d !== day) { if (day) html += '</ul>'; day = d; html += '<div class="alt-rc-day">' + esc(d) + '</div><ul class="mw-contributions-list">'; }
          var cls = r.d > 0 ? 'mw-plusminus-pos' : r.d < 0 ? 'mw-plusminus-neg' : 'mw-plusminus-null';
          var t = new Date(r.e.date);
          html += '<li>(<a href="' + r.u + '?action=history">diff</a> | <a href="' + r.u + '?action=history">hist</a>) . . ' + (r.e.minor ? '<abbr class="minoredit">m</abbr>' : '') +
            ' <a href="' + r.u + '"><b>' + esc(r.t) + '</b></a>; ' + String(t.getUTCHours()).padStart(2, '0') + ':' + String(t.getUTCMinutes()).padStart(2, '0') +
            ' . . <span class="' + cls + '">(' + (r.d > 0 ? '+' : r.d < 0 ? '−' : '') + fmtNum(Math.abs(r.d)) + ')</span> . . <a href="' + wikiUrl('User:' + r.e.user) + '" class="new">' + esc(r.e.user) + '</a> ' +
            (r.e.summary ? '<span class="comment">(' + esc(r.e.summary) + ')</span>' : '') + '</li>';
        });
        html += '</ul>';
        specialShell(name, 'Recent changes', html);
      } else if (key === 'whatlinkshere') {
        var target = normTitle(sub || params.get('target') || '');
        var linkers = arts.filter(function (a) { return (a.l || []).some(function (l) { return normTitle(l) === target; }); });
        specialShell(name, 'Pages that link to "' + target + '"', target ? (linkers.length ?
          '<p>The following pages link to <a href="' + wikiUrl(target) + '">' + esc(target) + '</a>:</p><ul>' + linkers.map(function (a) { return '<li><a href="' + a.u + '">' + esc(a.dt || a.t) + '</a></li>'; }).join('') + '</ul>' :
          '<p>No pages in this timeline link to <a href="' + wikiUrl(target) + '">' + esc(target) + '</a>.</p>') : '<p>Specify a page title.</p>', '← <a href="' + wikiUrl(target) + '">' + esc(target) + '</a>');
      } else if (key === 'wantedpages') {
        var wanted = Object.keys(idx.redlinks || {}).map(function (t) { return { t: t, n: idx.redlinks[t].length }; })
          .sort(function (a, b) { return b.n - a.n || a.t.localeCompare(b.t); });
        specialShell(name, 'Wanted pages', '<p>The following pages are linked from articles in this timeline but have not been written yet. Each one is waiting to diverge.</p><ol>' +
          wanted.map(function (w) { return '<li><a href="' + wikiUrl(w.t) + '" class="new">' + esc(w.t) + '</a> (<a href="' + wikiUrl('Special:WhatLinksHere/' + w.t) + '">' + w.n + ' link' + (w.n > 1 ? 's' : '') + '</a>)</li>'; }).join('') + '</ol>');
      } else if (key === 'statistics') {
        var edits = idx.articles.reduce(function (s, a) { return s + (a.h || []).length; }, 0);
        var words = idx.articles.reduce(function (s, a) { return s + (a.w || 0); }, 0);
        specialShell(name, 'Statistics', '<table class="wikitable"><tbody>' +
          '<tr><th colspan="2">Page statistics</th></tr><tr><td>Content pages</td><td style="text-align:right">' + fmtNum(idx.articles.length) + '</td></tr>' +
          '<tr><td>Redirects</td><td style="text-align:right">' + fmtNum(Object.keys(idx.redirects).length) + '</td></tr>' +
          '<tr><td>Wanted pages (red links)</td><td style="text-align:right">' + fmtNum(Object.keys(idx.redlinks).length) + '</td></tr>' +
          '<tr><td>Words of alternate history</td><td style="text-align:right">' + fmtNum(words) + '</td></tr>' +
          '<tr><th colspan="2">Edit statistics</th></tr><tr><td>Page edits in this timeline</td><td style="text-align:right">' + fmtNum(edits) + '</td></tr>' +
          '<tr><td>Page edits in all timelines</td><td style="text-align:right">∞</td></tr>' +
          '<tr><th colspan="2">User statistics</th></tr><tr><td>Registered users</td><td style="text-align:right">48,117,302</td></tr><tr><td>Active registered users</td><td style="text-align:right">118,215</td></tr>' +
          '<tr><td>Users who remember it differently</td><td style="text-align:right">all of them</td></tr></tbody></table>');
      } else if (key === 'userlogin' || key === 'createaccount') {
        specialShell(name, key === 'userlogin' ? 'Log in' : 'Create account', '<table class="fmbox" role="presentation"><tbody><tr><td class="mbox-image"><svg width="36" height="36" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#36c"/><path fill="#fff" d="M9 8h2v7H9zm0-3h2v2H9z"/></svg></td><td>' +
          '<p><b>Accounts are not available to visitors from your timeline.</b></p><p>Your identity would have to be verified by your counterpart in this timeline, who is currently busy. Alternopedia can be read freely without an account.</p>' +
          '<p>Return to the <a href="' + BASE + '">Main Page</a>.</p></td></tr></tbody></table>');
      } else if (key === 'donate') {
        specialShell(name, 'Donate', '<p><b>The Elsewhen Foundation cannot accept money from your timeline</b> — the exchange rate is undefined.</p><p>If you would like to help, consider donating an article instead: the <a href="' + wikiUrl('Special:WantedPages') + '">wanted pages</a> list shows every topic that is already linked but not yet written.</p>');
      } else if (key === 'specialpages') {
        specialShell(name, 'Special pages', '<ul>' + [['All pages', 'Special:AllPages'], ['Random article', 'Special:Random'], ['Recent changes', 'Special:RecentChanges'], ['Search', 'Special:Search'], ['Statistics', 'Special:Statistics'], ['Wanted pages', 'Special:WantedPages']]
          .map(function (x) { return '<li><a href="' + wikiUrl(x[1]) + '">' + x[0] + '</a></li>'; }).join('') + '</ul>');
      } else {
        specialShell(name, 'No such special page', '<p>You have requested an invalid special page.</p><p>A list of valid special pages can be found at <a href="' + wikiUrl('Special:SpecialPages') + '">Special:SpecialPages</a>.</p><p>Return to the <a href="' + BASE + '">Main Page</a>.</p>');
      }
    }).catch(function () { specialShell(name, 'Error', '<p>The search index could not be loaded from this timeline.</p>'); });
  }

  function searchPage() {
    var q = (params.get('search') || '').trim();
    var full = params.get('fulltext');
    var formHtml = '<form class="alt-searchpage-form" action="' + wikiUrl('Special:Search') + '" method="get"><input type="search" name="search" value="' + esc(q) + '" aria-label="Search Alternopedia" autofocus><input type="hidden" name="fulltext" value="1"><button type="submit">Search</button></form>';
    if (!q) { specialShell('Search', 'Search', formHtml + '<p class="results-info">Enter a search term to look through this timeline.</p>'); return; }
    loadIndex().then(function (idx) {
      var t = normTitle(q);
      var exact = idx.articles.filter(function (a) { return a.t.toLowerCase() === t.toLowerCase(); })[0];
      var rk = Object.keys(idx.redirects || {}).filter(function (r) { return r.toLowerCase() === t.toLowerCase(); })[0];
      if (!full) {
        if (exact) { location.replace(exact.u); return; }
        if (rk) { location.replace(wikiUrl(idx.redirects[rk]) + '?redirect=' + encodeURIComponent(rk.replace(/ /g, '_'))); return; }
      }
      var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      var results = idx.articles.map(function (a) {
        var tl = a.t.toLowerCase(), xl = (a.x || '').toLowerCase(), score = 0, all = true;
        terms.forEach(function (term) {
          var inTitle = tl.indexOf(term) >= 0;
          var count = xl.split(term).length - 1;
          if (!inTitle && !count) all = false;
          score += (inTitle ? 50 : 0) + Math.min(count, 20);
        });
        return { a: a, score: all ? score : 0 };
      }).filter(function (r) { return r.score > 0; }).sort(function (x, y) { return y.score - x.score; });
      var html = formHtml;
      if (exact || rk) html += '<p class="mw-search-exists">There is a page named "<a href="' + (exact ? exact.u : wikiUrl(rk)) + '"><b>' + esc(exact ? (exact.dt || exact.t) : rk) + '</b></a>" on Alternopedia</p>';
      else html += '<p class="mw-search-createlink"><b>Create the page "<a href="' + wikiUrl(t) + '" class="new">' + esc(t) + '</a>" on this wiki!</b> See also the search results found.</p>';
      if (!results.length) {
        html += '<p class="results-info">There were no results matching the query in this timeline.</p>';
      } else {
        html += '<div class="results-info">Results 1 – ' + results.length + ' of ' + results.length + '</div><ul class="mw-search-results">' + results.map(function (r) {
          var a = r.a;
          return '<li class="mw-search-result">' + (a.i ? '<div class="mw-search-result-thumb" style="background-image:url(\'' + esc(a.i) + '\')"></div>' : '') +
            '<div><div class="mw-search-result-heading"><a href="' + a.u + '">' + esc(a.dt || a.t) + '</a></div>' +
            '<div class="searchresult">' + snippetFor(a.x || '', terms) + '</div>' +
            '<div class="mw-search-result-data">' + Math.max(1, Math.round(a.b / 1024)) + ' KB (' + fmtNum(a.w) + ' words) - ' + esc(fmtDate(a.e)) + '</div></div></li>';
        }).join('') + '</ul>';
      }
      specialShell('Search', 'Search results', html);
    }).catch(function () { specialShell('Search', 'Search results', formHtml + '<p>The search index could not be loaded.</p>'); });
  }

  // ------------------------------------------------------------------ boot
  articleViews();
  mainPage();
  router();
})();
