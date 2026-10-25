import { icons } from './icons.mjs';
import { escapeHtml } from './markdown.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatLastEdited(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, at ${hh}:${mm}`;
}

/** Vector-2022-like dropdown: a <details> element styled as a menu. */
function dropdown({ id, label, icon = '', iconOnly = false, cls = '', content, title = '' }) {
  return `<details class="vector-dropdown ${cls}" id="${id}">
<summary class="vector-dropdown-label${iconOnly ? ' icon-only' : ''}" title="${escapeHtml(title || label)}" aria-label="${escapeHtml(label)}">${icon}${iconOnly ? '' : `<span class="vector-dropdown-label-text">${label}</span>`}${!iconOnly && !cls.includes('no-chevron') ? icons.chevronDown : ''}</summary>
<div class="vector-dropdown-content">${content}</div>
</details>`;
}

function menuSection(heading, items) {
  return `<div class="vector-menu">${heading ? `<div class="vector-menu-heading">${heading}</div>` : ''}<ul class="vector-menu-content-list">${items.map(([label, href, extra = '']) =>
    `<li class="mw-list-item"><a href="${href}"${extra}><span>${label}</span></a></li>`).join('')}</ul></div>`;
}

export function mainMenu(base) {
  const w = (t) => `${base}wiki/${t}`;
  return `<div class="vector-pinnable-header"><div class="vector-pinnable-header-label">Main menu</div></div>` +
    menuSection('Navigation', [
      ['Main page', base],
      ['Contents', w('Alternopedia:Contents')],
      ['Current events', w('Portal:Current_events')],
      ['Random article', w('Special:Random')],
      ['About Alternopedia', w('Alternopedia:About')],
      ['Contact us', w('Alternopedia:Contact_us')],
    ]) +
    menuSection('Contribute', [
      ['Help', w('Help:Contents')],
      ['Learn to edit', w('Help:Introduction')],
      ['Community portal', w('Alternopedia:Community_portal')],
      ['Recent changes', w('Special:RecentChanges')],
      ['Upload file', w('Alternopedia:File_upload_wizard')],
      ['Special pages', w('Special:SpecialPages')],
    ]);
}

export function appearanceMenu() {
  const group = (name, title, options, note = '') => `<div class="vector-menu alt-appearance-group" data-pref="${name}">
<div class="vector-menu-heading">${title}</div>
<ul class="alt-radio-list">${options.map(([value, label]) =>
    `<li><label class="cdx-radio"><input type="radio" name="alt-pref-${name}" value="${value}"><span class="cdx-radio__icon"></span><span class="cdx-radio__label">${label}</span></label></li>`).join('')}</ul>${note ? `<p class="alt-appearance-note">${note}</p>` : ''}</div>`;
  return `<div class="vector-pinnable-header"><div class="vector-pinnable-header-label">Appearance</div><button type="button" class="vector-pinnable-header-toggle alt-appearance-hide">hide</button></div>` +
    group('text', 'Text', [['small', 'Small'], ['standard', 'Standard'], ['large', 'Large']]) +
    group('width', 'Width', [['standard', 'Standard'], ['wide', 'Wide']], 'The content is as wide as possible for your browser window.') +
    group('theme', 'Color <span class="alt-beta">(beta)</span>', [['os', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']], 'This timeline is always a little darker than yours.');
}

export function header(base) {
  const w = (t) => `${base}wiki/${t}`;
  const userMenu = `<ul class="vector-menu-content-list">
<li class="mw-list-item user-links-collapsible-item"><a href="${w('Special:Donate')}"><span>Donate</span></a></li>
<li class="mw-list-item user-links-collapsible-item"><a href="${w('Special:CreateAccount')}">${icons.user}<span>Create account</span></a></li>
<li class="mw-list-item user-links-collapsible-item"><a href="${w('Special:UserLogin')}"><span>Log in</span></a></li>
</ul>
<div class="vector-menu-heading">Pages for logged out editors <a href="${w('Help:Introduction')}" class="alt-learn-more">learn more</a></div>
<ul class="vector-menu-content-list">
<li class="mw-list-item"><a href="${w('Special:MyContributions')}"><span>Contributions</span></a></li>
<li class="mw-list-item"><a href="${w('Special:MyTalk')}"><span>Talk</span></a></li>
</ul>`;
  return `<div class="vector-header-container">
<header class="vector-header mw-header">
<div class="vector-header-start">
<nav class="vector-main-menu-landmark" aria-label="Site">
${dropdown({ id: 'vector-main-menu-dropdown', label: 'Main menu', icon: icons.menu, iconOnly: true, cls: 'vector-main-menu-dropdown', content: `<div id="vector-main-menu" class="vector-main-menu">${mainMenu(base)}</div>` })}
</nav>
<a href="${base}" class="mw-logo">
<img class="mw-logo-icon" src="${base}static/images/logo.svg" alt="" aria-hidden="true" height="50" width="50">
<span class="mw-logo-container">
<span class="mw-logo-wordmark">Alternopedia</span>
<span class="mw-logo-tagline">The Free Encyclopedia of Elsewhen</span>
</span>
</a>
</div>
<div class="vector-header-end">
<div id="p-search" role="search" class="vector-search-box">
<a href="${w('Special:Search')}" class="cdx-button cdx-button--icon-only search-toggle" title="Search Alternopedia" aria-label="Search">${icons.search}</a>
<div class="vector-typeahead-search-container">
<form action="${w('Special:Search')}" id="searchform" class="cdx-search-input cdx-search-input--has-end-button" autocomplete="off">
<div class="cdx-search-input__input-wrapper">
<div class="cdx-text-input cdx-text-input--has-start-icon">
<input class="cdx-text-input__input" type="search" name="search" placeholder="Search Alternopedia" aria-label="Search Alternopedia" autocapitalize="sentences" title="Search Alternopedia [alt-shift-f]" accesskey="f" id="searchInput" spellcheck="false">
<span class="cdx-text-input__icon cdx-text-input__start-icon">${icons.search}</span>
</div>
</div>
<button class="cdx-button cdx-search-input__end-button">Search</button>
<div class="cdx-menu alt-suggestions" role="listbox" hidden></div>
</form>
</div>
</div>
<nav class="vector-user-links" aria-label="Personal tools">
${dropdown({ id: 'vector-appearance-dropdown', label: 'Appearance', icon: icons.appearance, iconOnly: true, cls: 'vector-appearance-dropdown', content: `<div class="vector-appearance alt-appearance">${appearanceMenu()}</div>` })}
<ul class="vector-user-links-main">
<li class="mw-list-item"><a href="${w('Special:Donate')}"><span>Donate</span></a></li>
<li class="mw-list-item"><a href="${w('Special:CreateAccount')}"><span>Create account</span></a></li>
<li class="mw-list-item"><a href="${w('Special:UserLogin')}"><span>Log in</span></a></li>
</ul>
${dropdown({ id: 'vector-user-links-dropdown', label: 'Personal tools', icon: icons.ellipsis, iconOnly: true, cls: 'vector-user-menu', content: userMenu })}
</nav>
</div>
</header>
</div>`;
}

export function toolsMenu(base, title) {
  const w = (t) => `${base}wiki/${t}`;
  const enc = encodeURIComponent(title.replace(/ /g, '_'));
  return `<div class="vector-pinnable-header"><div class="vector-pinnable-header-label">Tools</div></div>` +
    menuSection('Actions', [['Read', '#'], ['Edit', '?action=edit'], ['View history', '?action=history']]) +
    menuSection('General', [
      ['What links here', w(`Special:WhatLinksHere/${enc}`)],
      ['Related changes', w('Special:RecentChanges')],
      ['Upload file', w('Alternopedia:File_upload_wizard')],
      ['Permanent link', '?oldid=1', ' data-toast="Permanent links are only permanent in your timeline."'],
      ['Page information', '?action=info', ' data-toast="Page information is classified until the next divergence."'],
      ['Cite this page', '#', ' data-toast="Please cite this page as: Alternopedia contributors (n.d.), in another timeline."'],
      ['Get shortened URL', '#', ' data-copy-url="1"'],
    ]) +
    menuSection('Print/export', [
      ['Download as PDF', '#', ' data-print="1"'],
      ['Printable version', '#', ' data-print="1"'],
    ]);
}

export function languagesMenu(count) {
  const langs = ['Deutsch', 'Español', 'Esperanto', 'Français', 'Italiano', 'Klingon (tlhIngan Hol)', 'Latina (vulgaris)',
    'Nederlands', 'Polski', 'Português', 'Suomi', 'Svenska', 'Türkçe', 'Українська', '日本語', '中文', 'Emu (Westralian)', 'Old Norse'];
  const shown = langs.slice(0, Math.max(1, Math.min(count, langs.length)));
  return `<ul class="vector-menu-content-list alt-lang-list">${shown.map(l =>
    `<li class="mw-list-item"><a href="#" data-toast="This article has not yet been translated into ${escapeHtml(l)} in your timeline."><span>${escapeHtml(l)}</span></a></li>`).join('')}</ul>
<div class="alt-lang-footer"><a href="#" data-toast="Interlanguage links are maintained by the Elsewhen Foundation.">Edit links</a></div>`;
}

function footer(base, lastEdited) {
  const w = (t) => `${base}wiki/${t}`;
  const last = lastEdited ? formatLastEdited(lastEdited) : null;
  return `<div class="mw-footer-container">
<footer id="footer" class="mw-footer">
<ul id="footer-info">
${last ? `<li id="footer-info-lastmod"> This page was last edited on ${last} <span class="anonymous-show">(UTC)</span>.</li>` : ''}
<li id="footer-info-copyright">Text is available under the <a href="${w('Alternopedia:Copyrights')}">Elsewhen Commons Attribution-ShareAlike License</a>; additional timelines may apply. By using this site, you agree to the <a href="${w('Alternopedia:Terms_of_Use')}">Terms of Use</a> and <a href="${w('Alternopedia:Privacy_policy')}">Privacy Policy</a>. Alternopedia is a parody: every article describes events from an alternate reality and is a work of fiction. Not affiliated with Wikipedia or the Wikimedia Foundation.</li>
</ul>
<ul id="footer-places">
<li><a href="${w('Alternopedia:Privacy_policy')}">Privacy policy</a></li>
<li><a href="${w('Alternopedia:About')}">About Alternopedia</a></li>
<li><a href="${w('Alternopedia:General_disclaimer')}">Disclaimers</a></li>
<li><a href="${w('Alternopedia:Contact_us')}">Contact Alternopedia</a></li>
<li><a href="${w('Alternopedia:Code_of_Conduct')}">Code of Conduct</a></li>
<li><a href="${w('Special:Statistics')}">Statistics</a></li>
<li><a href="${w('Alternopedia:Cookie_statement')}">Cookie statement</a></li>
<li id="footer-places-viewmode"><a href="#" class="alt-viewmode-toggle" data-mode="desktop">Desktop view</a></li>
</ul>
<ul id="footer-icons" class="noprint">
<li><a href="${w('Alternopedia:About')}" class="alt-footer-badge"><img src="${base}static/images/badge-foundation.svg" width="88" height="31" alt="Elsewhen Foundation" loading="lazy"></a></li>
<li><a href="${w('Alternopedia:About')}" class="alt-footer-badge"><img src="${base}static/images/badge-powered.svg" width="88" height="31" alt="Powered by Divergence" loading="lazy"></a></li>
</ul>
</footer>
</div>`;
}

/**
 * Full page layout.
 */
export function layout(o) {
  const {
    base, assetVersion, pageTitle, displayTitle, description = '', bodyClass = '',
    namespaceTabs = [], viewTabs = [], langCount = 0, toc = '', content = '', siteSub = true,
    contentSub = '', categories = '', lastEdited = null, pageData = null, hideTitle = false,
    ogImage = null, canonicalTitle = '', titleHtml = null, isMainPage = false, indicators = '',
  } = o;
  const titleTag = `${pageTitle} - Alternopedia`;
  const tab = (t) => `<li class="vector-tab-noicon mw-list-item${t.selected ? ' selected' : ''}${t.isNew ? ' new' : ''}"${t.id ? ` id="${t.id}"` : ''}><a href="${t.href}"${t.title ? ` title="${escapeHtml(t.title)}"` : ''}${t.accesskey ? ` accesskey="${t.accesskey}"` : ''}><span>${t.label}</span></a></li>`;
  const hasToc = Boolean(toc);
  return `<!DOCTYPE html>
<html class="client-nojs alt-text-small alt-width-standard" lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(titleTag)}</title>
<meta name="viewport" id="alt-viewport" content="width=device-width, initial-scale=1">
<meta name="alt-base" content="${base}">
<script>(function(){var d=document.documentElement;d.className=d.className.replace('client-nojs','client-js');try{var p=JSON.parse(localStorage.getItem('alt-prefs')||'{}');if(p.text)d.className=d.className.replace('alt-text-small','alt-text-'+p.text);if(p.width)d.className=d.className.replace('alt-width-standard','alt-width-'+p.width);d.setAttribute('data-theme',p.theme||'light');if(p.desktop){document.getElementById('alt-viewport').setAttribute('content','width=1120');d.className+=' alt-desktop-view';}if(p.appearanceHidden)d.className+=' alt-appearance-unpinned';if(p.tocHidden)d.className+=' alt-toc-unpinned';}catch(e){d.setAttribute('data-theme','light');}})();</script>
<link rel="stylesheet" href="${base}static/site.css?v=${assetVersion}">
<link rel="icon" href="${base}static/images/favicon.svg" type="image/svg+xml">
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:site_name" content="Alternopedia">
<meta property="og:title" content="${escapeHtml(titleTag)}">
<meta property="og:description" content="${escapeHtml(description)}">
${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
<meta name="theme-color" content="#eaecf0">
</head>
<body class="skin-vector skin-vector-2022 ${isMainPage ? 'page-Main_Page alt-main-page ' : ''}${hasToc ? 'alt-has-toc ' : ''}${bodyClass}">
<a class="mw-jump-link" href="#bodyContent">Jump to content</a>
${header(base)}
<div class="mw-page-container">
<div class="mw-page-container-inner">
<div class="vector-column-start">
${hasToc ? `<div class="vector-sticky-pinned-container"><nav id="mw-panel-toc" class="mw-table-of-contents-container" aria-label="Contents">${toc}</nav></div>` : ''}
</div>
<div class="mw-content-container">
<main id="content" class="mw-body">
<header class="mw-body-header vector-page-titlebar${hideTitle ? ' alt-title-hidden' : ''}">
${hasToc ? `<details class="vector-dropdown vector-page-titlebar-toc" id="vector-page-titlebar-toc"><summary class="vector-dropdown-label icon-only" aria-label="Toggle the table of contents" title="Toggle the table of contents">${icons.toc}</summary><div class="vector-dropdown-content">${toc}</div></details>` : ''}
<h1 id="firstHeading" class="firstHeading mw-first-heading">${titleHtml || `<span class="mw-page-title-main">${displayTitle}</span>`}</h1>
${langCount ? dropdown({ id: 'p-lang-btn', label: `${langCount} languages`, icon: icons.language, cls: 'mw-portlet-lang', content: languagesMenu(langCount) }) : ''}
</header>
<div class="vector-page-toolbar">
<div class="vector-page-toolbar-container">
<div id="left-navigation">
<nav aria-label="Namespaces"><ul class="vector-tabs" id="p-associated-pages">${namespaceTabs.map(tab).join('')}</ul></nav>
</div>
<div id="right-navigation">
<nav aria-label="Views"><ul class="vector-tabs" id="p-views">${viewTabs.map(tab).join('')}</ul></nav>
${dropdown({ id: 'vector-page-tools-dropdown', label: 'Tools', cls: 'vector-page-tools-dropdown', content: toolsMenu(base, canonicalTitle || pageTitle) })}
</div>
</div>
</div>
<div class="vector-column-end">
<div class="vector-sticky-pinned-container">
<nav class="vector-appearance-landmark alt-appearance alt-appearance-pinned" aria-label="Appearance">${appearanceMenu()}</nav>
</div>
</div>
<div id="bodyContent" class="vector-body" aria-labelledby="firstHeading">
<div class="vector-body-before-content">${indicators ? `<div class="mw-indicators">${indicators}</div>` : ''}${siteSub ? '<div id="siteSub" class="noprint">From Alternopedia, the free encyclopedia</div>' : ''}</div>
<div id="contentSub">${contentSub}</div>
<div id="mw-content-text" class="mw-body-content" lang="en" dir="ltr">${content}</div>
${categories}
</div>
</main>
</div>
${footer(base, lastEdited)}
</div>
</div>
<div class="alt-notifications" aria-live="polite"></div>
${pageData ? `<script type="application/json" id="alt-page-data">${JSON.stringify(pageData).replace(/</g, '\\u003c')}</script>` : ''}
<script src="${base}static/site.js?v=${assetVersion}" defer></script>
</body>
</html>
`;
}

export function tocHtml(headings) {
  // Group h3+ under preceding h2
  const items = [];
  for (const h of headings) {
    if (h.level === 2 || !items.length) items.push({ ...h, children: [] });
    else items[items.length - 1].children.push(h);
  }
  const li = (h, level, children = []) => `<li id="toc-${h.id}" class="vector-toc-list-item vector-toc-level-${level}${children.length ? ' vector-toc-list-item-expanded' : ''}">
<a class="vector-toc-link" href="#${h.id}"><div class="vector-toc-text"><span class="vector-toc-text-inner">${h.html.replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<a [^>]*>|<\/a>/g, '')}</span></div></a>${children.length ? `<button type="button" class="vector-toc-toggle" aria-expanded="true" aria-controls="toc-${h.id}-sublist" title="Toggle ${escapeHtml(h.text)} subsection">${icons.chevronDown}</button><ul id="toc-${h.id}-sublist" class="vector-toc-list">${children.map(c => li(c, 2)).join('')}</ul>` : ''}</li>`;
  return `<div id="vector-toc" class="vector-toc">
<div class="vector-pinnable-header vector-toc-pinnable-header"><h2 class="vector-pinnable-header-label">Contents</h2><button type="button" class="vector-pinnable-header-toggle alt-toc-hide">hide</button></div>
<ul class="vector-toc-contents">
<li id="toc-mw-content-text" class="vector-toc-list-item vector-toc-level-1 vector-toc-list-item-active"><a href="#" class="vector-toc-link"><div class="vector-toc-text">(Top)</div></a></li>
${items.map(h => li(h, 1, h.children)).join('\n')}
</ul>
</div>`;
}
