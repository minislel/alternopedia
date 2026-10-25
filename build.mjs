#!/usr/bin/env node
// Alternopedia static site generator. Zero dependencies — run with `node build.mjs`.
// Output goes to ./dist. Set BASE_PATH (e.g. "/alternopedia/") when hosting under a sub-path.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { renderMarkdown, renderInline, escapeHtml, stripTags } from './lib/markdown.mjs';
import { layout, tocHtml } from './lib/templates.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'dist');

let BASE = process.env.BASE_PATH || '/';
if (!BASE.startsWith('/')) BASE = '/' + BASE;
if (!BASE.endsWith('/')) BASE += '/';

const warnings = [];
const warn = (msg) => warnings.push(msg);

// ---------------------------------------------------------------------------
// Title helpers (MediaWiki-ish: first letter case-insensitive, spaces == underscores)

export function normTitle(t) {
  t = String(t).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const colon = t.indexOf(':');
  if (colon > 0 && /^(Special|Category|Talk|Help|Portal|Alternopedia|File|User|Template)$/i.test(t.slice(0, colon))) {
    const ns = t.slice(0, colon);
    const rest = t.slice(colon + 1).trim();
    return ns.charAt(0).toUpperCase() + ns.slice(1).toLowerCase() + ':' + (rest.charAt(0).toUpperCase() + rest.slice(1));
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const titleKey = (t) => normTitle(t);
const slugOf = (t) => normTitle(t).replace(/ /g, '_');
const encodeSlug = (slug) => encodeURIComponent(slug).replace(/%3A/gi, ':').replace(/%2F/gi, '/');
const wikiUrl = (t) => `${BASE}wiki/${encodeSlug(slugOf(t))}`;
const fileUrl = (name) => `${BASE}static/images/${encodeURIComponent(name)}`;

// ---------------------------------------------------------------------------
// Load content

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(path.join(CONTENT, p), 'utf8')); }
  catch (e) { throw new Error(`Cannot read content/${p}: ${e.message}`); }
}

function parseArticle(file) {
  const raw = fs.readFileSync(path.join(CONTENT, 'articles', file), 'utf8').replace(/\r\n?/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`content/articles/${file}: missing "---" JSON frontmatter block`);
  let meta;
  try { meta = JSON.parse(m[1]); }
  catch (e) { throw new Error(`content/articles/${file}: frontmatter is not valid JSON (${e.message})`); }
  if (!meta.title) throw new Error(`content/articles/${file}: frontmatter needs a "title"`);
  return { file, meta, body: m[2], raw, title: normTitle(meta.title) };
}

const mainPageCfg = readJSON('main-page.json');
const navboxes = readJSON('navboxes.json');
const articles = fs.readdirSync(path.join(CONTENT, 'articles'))
  .filter(f => f.endsWith('.md') && !f.startsWith('_'))
  .sort()
  .map(parseArticle);

const pages = new Map();       // key -> article
const redirects = new Map();   // key -> target title
for (const a of articles) {
  const k = titleKey(a.title);
  if (pages.has(k)) throw new Error(`Duplicate article title "${a.title}" (${a.file} and ${pages.get(k).file})`);
  pages.set(k, a);
}
for (const a of articles) {
  for (const r of a.meta.redirects || []) {
    const k = titleKey(r);
    if (pages.has(k)) warn(`Redirect "${r}" in ${a.file} shadows an existing article; ignored.`);
    else redirects.set(k, a.title);
  }
}
const categoryMembers = new Map();
for (const a of articles) for (const c of a.meta.categories || []) {
  const k = normTitle(c);
  if (!categoryMembers.has(k)) categoryMembers.set(k, []);
  categoryMembers.get(k).push(a.title);
}

function resolveLink(raw) {
  const t = normTitle(raw);
  const ns = t.includes(':') ? t.slice(0, t.indexOf(':')) : '';
  if (ns === 'Category') {
    const name = t.slice(9);
    return { title: t, href: wikiUrl(t), exists: categoryMembers.has(normTitle(name)) };
  }
  if (ns === 'Special') return { title: t, href: wikiUrl(t), exists: true };
  if (ns) return { title: t, href: wikiUrl(t), exists: ROUTER_PAGES.has(t) };
  if (pages.has(t)) return { title: t, href: wikiUrl(t), exists: true };
  if (redirects.has(t)) return { title: t, href: wikiUrl(redirects.get(t)), exists: true };
  return { title: t, href: wikiUrl(t), exists: false };
}

// Project pages (Alternopedia:, Help:, Portal:) are rendered client-side by the router (404 page)
const projectPagesRaw = readJSON('project-pages.json');
const ROUTER_PAGES = new Set(Object.keys(projectPagesRaw).map(normTitle));

// ---------------------------------------------------------------------------
// Rendering helpers

function makeCtx(article, redlinks, outlinks) {
  const refs = article?.meta.references || {};
  const order = [];
  const uses = new Map();
  return {
    usedIds: new Set(),
    link: resolveLink,
    file: fileUrl,
    onLink(title, exists) {
      outlinks?.add(title);
      if (!exists && redlinks && !title.includes(':')) {
        if (!redlinks.has(title)) redlinks.set(title, new Set());
        redlinks.get(title).add(article ? article.title : 'Main Page');
      }
    },
    cite(key) {
      if (!(key in refs)) warn(`${article?.file}: citation [^${key}] has no entry in "references"`);
      if (!uses.has(key)) { order.push(key); uses.set(key, 0); }
      const n = order.indexOf(key) + 1;
      const k = uses.get(key);
      uses.set(key, k + 1);
      return `<sup id="cite_ref-${key}-${k}" class="reference"><a href="#cite_note-${key}"><span class="cite-bracket">[</span>${n}<span class="cite-bracket">]</span></a></sup>`;
    },
    referencesHtml() {
      for (const key of Object.keys(refs)) if (!uses.has(key)) { order.push(key); uses.set(key, 0); }
      if (!order.length) return '';
      const noCiteCtx = { ...this, cite: () => '' };
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      return `<div class="reflist"><div class="mw-references-wrap${order.length > 10 ? ' mw-references-columns' : ''}"><ol class="references">${order.map(key => {
        const count = uses.get(key);
        let back;
        if (count === 0) back = '<span class="mw-cite-backlink">^</span>';
        else if (count === 1) back = `<span class="mw-cite-backlink"><b><a href="#cite_ref-${key}-0">^</a></b></span>`;
        else back = `<span class="mw-cite-backlink">^ ${Array.from({ length: count }, (_, i) => `<a href="#cite_ref-${key}-${i}"><sup><i><b>${letters[i] || i}</b></i></sup></a>`).join(' ')}</span>`;
        return `<li id="cite_note-${key}">${back} <span class="reference-text">${renderInline(refs[key] || '<i>Reference lost in transit between timelines.</i>', noCiteCtx)}</span></li>`;
      }).join('')}</ol></div></div>`;
    },
  };
}

function renderInfobox(ib, ctx) {
  if (!ib) return '';
  const accent = ib.color || '#cedff2';
  const rows = [];
  rows.push(`<tr><th colspan="2" class="infobox-above"${ib.color !== null ? ` style="background-color:${accent}"` : ''}>${renderInline(ib.title, ctx)}</th></tr>`);
  if (ib.subtitle) rows.push(`<tr><td colspan="2" class="infobox-subheader">${renderInline(ib.subtitle, ctx)}</td></tr>`);
  const img = (im) => `<span class="mw-default-size"><a href="${fileUrl(im.file)}" class="mw-file-description" data-caption="${escapeHtml(stripTags(renderInline(im.caption || '', ctx)))}"><img src="${fileUrl(im.file)}" width="${im.width || 250}" alt="${escapeHtml(im.alt || stripTags(im.caption || ''))}" class="mw-file-element"></a></span>`;
  if (ib.image) {
    rows.push(`<tr><td colspan="2" class="infobox-image">${img({ file: ib.image, width: ib.imageWidth, caption: ib.caption, alt: ib.alt })}${ib.caption ? `<div class="infobox-caption">${renderInline(ib.caption, ctx)}</div>` : ''}</td></tr>`);
  }
  for (const r of ib.rows || []) {
    if (r.header) rows.push(`<tr><th colspan="2" class="infobox-header" style="background-color:${r.color || accent}">${renderInline(r.header, ctx)}</th></tr>`);
    else if (r.images) rows.push(`<tr><td colspan="2" class="infobox-image"><div class="alt-infobox-images">${r.images.map(im => `<div>${img(im)}${im.caption ? `<div class="infobox-caption">${renderInline(im.caption, ctx)}</div>` : ''}</div>`).join('')}</div></td></tr>`);
    else if (r.cols) rows.push(`<tr>${r.cols.map(c => `<td class="infobox-data alt-infobox-col" style="width:${Math.floor(100 / r.cols.length)}%">${renderInline(c, ctx).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`);
    else if (r.full) rows.push(`<tr><td colspan="2" class="infobox-full-data">${renderInline(r.full, ctx)}</td></tr>`);
    else if (r.label) rows.push(`<tr><th scope="row" class="infobox-label">${renderInline(r.label, ctx)}</th><td class="infobox-data">${(Array.isArray(r.value) ? r.value.map(v => renderInline(v, ctx)).join('<br>') : renderInline(String(r.value ?? ''), ctx))}</td></tr>`);
  }
  if (ib.below) rows.push(`<tr><td colspan="2" class="infobox-below">${renderInline(ib.below, ctx)}</td></tr>`);
  return `<table class="infobox ${ib.class || ''}"><tbody>${rows.join('')}</tbody></table>`;
}

const AMBOX_ICONS = {
  content: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path fill="#f28500" d="M20 3 38 36H2z"/><path fill="#fff" d="M18.2 14h3.6l-.6 12h-2.4zM20 28.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4"/></svg>',
  style: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#fc3"/><path fill="#202122" d="M12 27.5 26.6 13l2.4 2.4L14.4 30l-3.2.8z"/></svg>',
  notice: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#36c"/><path fill="#fff" d="M18 17h4v12h-4zm0-6h4v4h-4z"/></svg>',
  cite: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path fill="#a2a9b1" d="M6 8h12c2 0 2 1 2 2v22c-1-1-2-1.5-4-1.5H6zm28 0H22c-2 0-2 1-2 2v22c1-1 2-1.5 4-1.5h10z"/><circle cx="29" cy="27" r="8" fill="#36c"/><path fill="#fff" d="M28 30h2v2h-2zm-2.6-6.2c.4-1.9 1.8-2.8 3.6-2.8 2 0 3.4 1.2 3.4 2.9 0 2.2-2.4 2.3-2.4 4.1h-2c0-2.6 2.3-2.7 2.3-4 0-.7-.5-1.2-1.3-1.2-.9 0-1.4.5-1.6 1.4z"/></svg>',
  disputed: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path fill="#72777d" d="M19 4h2v4h12l-5 10a6 6 0 0 0 12 0l-5-10h-.5V8H35V6H21V4zM7 8 2 18a6 6 0 0 0 12 0L9 8zm13 2h-1v24h-6v2h14v-2h-6z"/></svg>',
  delete: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#b32424"/><path fill="#fff" d="m13 11 7 7 7-7 2 2-7 7 7 7-2 2-7-7-7 7-2-2 7-7-7-7z"/></svg>',
};

function renderNotices(notices, ctx) {
  return (notices || []).map(n => {
    const type = n.type || 'notice';
    const cls = { content: 'ambox-content', style: 'ambox-style', notice: 'ambox-notice', cite: 'ambox-content', disputed: 'ambox-content', delete: 'ambox-delete' }[type] || 'ambox-notice';
    return `<table class="box ambox ${cls}" role="presentation"><tbody><tr><td class="mbox-image">${AMBOX_ICONS[type] || AMBOX_ICONS.notice}</td><td class="mbox-text"><div class="mbox-text-span">${renderInline(n.text, ctx)}${n.small ? ` <span class="hide-when-compact"><small><i>${renderInline(n.small, ctx)}</i></small></span>` : ''}</div></td></tr></tbody></table>`;
  }).join('');
}

function renderNavbox(name, ctx) {
  const nb = navboxes[name];
  if (!nb) { if (name) warn(`Unknown navbox "${name}"`); return ''; }
  return `<div role="navigation" class="navbox" aria-label="Navbox"><table class="nowraplinks navbox-inner"><tbody>
<tr><th scope="col" class="navbox-title" colspan="2"><div class="navbar plainlinks"><ul><li><abbr title="View this template">v</abbr></li><li><abbr title="Discuss this template">t</abbr></li><li><abbr title="Edit this template">e</abbr></li></ul></div><div class="navbox-title-text">${renderInline(nb.title, ctx)}</div></th></tr>
${nb.groups.map((g, i) => `<tr><th scope="row" class="navbox-group">${renderInline(g.label, ctx)}</th><td class="navbox-list ${i % 2 ? 'navbox-even' : 'navbox-odd'}"><div><ul>${g.links.map(l => `<li>${renderInline(l, ctx)}</li>`).join('')}</ul></div></td></tr>`).join('\n')}
${nb.below ? `<tr><td class="navbox-abovebelow" colspan="2"><div>${renderInline(nb.below, ctx)}</div></td></tr>` : ''}
</tbody></table></div>`;
}

function renderCategories(cats) {
  if (!cats || !cats.length) return '';
  return `<div id="catlinks" class="catlinks" data-mw="interface"><div id="mw-normal-catlinks" class="mw-normal-catlinks"><a href="${wikiUrl('Help:Category')}" title="Help:Category">Categories</a>: <ul>${cats.map(c => {
    const t = 'Category:' + normTitle(c);
    return `<li><a href="${wikiUrl(t)}" title="${escapeHtml(t)}">${escapeHtml(normTitle(c))}</a></li>`;
  }).join('')}</ul></div></div>`;
}

const INDICATORS = {
  featured: `<div class="mw-indicator" id="mw-indicator-featured-star"><span typeof="mw:File"><a href="${BASE}wiki/Alternopedia:Featured_articles" title="This is a featured article. Click here for more information."><svg width="20" height="20" viewBox="0 0 20 20" aria-label="This is a featured article"><path fill="#f2b31b" stroke="#a57a10" stroke-width=".8" d="m10 1.2 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L10 15.1 4.6 18l1.1-6.1-4.5-4.3 6.1-.8z"/></svg></a></span></div>`,
  semi: `<div class="mw-indicator" id="mw-indicator-pp-default"><span typeof="mw:File"><a href="${BASE}wiki/Alternopedia:Protection_policy" title="This article is semi-protected to prevent edits from other timelines."><svg width="20" height="20" viewBox="0 0 20 20" aria-label="Semi-protected"><rect x="3.5" y="8.5" width="13" height="10" rx="1.5" fill="#bebebe" stroke="#797979"/><path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="#797979" stroke-width="2"/></svg></a></span></div>`,
  good: `<div class="mw-indicator" id="mw-indicator-good-star"><span typeof="mw:File"><a href="${BASE}wiki/Alternopedia:Good_articles" title="This is a good article. Click here for more information."><svg width="20" height="20" viewBox="0 0 20 20" aria-label="This is a good article"><circle cx="10" cy="10" r="8.5" fill="#2e8b57"/><path fill="#fff" d="m10 4 1.8 3.7 4 .5-3 2.9.8 4L10 13.2l-3.6 1.9.8-4-3-2.9 4-.5z"/></svg></a></span></div>`,
};

function defaultHistory(a) {
  const when = a.meta.lastEdited || '2026-10-20T12:00:00Z';
  return [{ date: when, user: 'Elsewhen bot', summary: 'Created page in this timeline', size: Buffer.byteLength(a.body) }];
}

// ---------------------------------------------------------------------------
// Articles

const redlinks = new Map();
const searchIndex = [];
const outlinksByArticle = new Map();
const renderedArticles = [];

for (const a of articles) {
  const outlinks = new Set();
  const ctx = makeCtx(a, redlinks, outlinks);
  const m = a.meta;

  const hatnote = m.hatnote ? `<div role="note" class="hatnote navigation-not-searchable">${renderInline(m.hatnote, ctx)}</div>` : '';
  const notices = renderNotices(m.notices, ctx);
  const infobox = renderInfobox(m.infobox, ctx);

  let body = a.body;
  const hasReflistTag = /\{\{\s*reflist\s*\}\}/i.test(body);
  body = body.replace(/^\s*\{\{\s*reflist\s*\}\}\s*$/gim, '<div data-alt-reflist></div>');
  if (!hasReflistTag && Object.keys(m.references || {}).length) body += '\n\n## References\n\n<div data-alt-reflist></div>\n';
  const { html: bodyHtml, headings } = renderMarkdown(body, ctx);
  const refsHtml = ctx.referencesHtml();
  const navbox = m.navbox ? renderNavbox(m.navbox, ctx) : '';
  const finalBody = bodyHtml.replace('<div data-alt-reflist></div>', refsHtml);

  // Lead / sections split for the "lead" (used by the main page and search snippets)
  const firstH2 = finalBody.indexOf('<div class="mw-heading');
  const leadHtml = firstH2 >= 0 ? finalBody.slice(0, firstH2) : finalBody;
  const leadParas = [...leadHtml.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(x => x[1]);

  const indicators = (m.indicators || []).map(k => INDICATORS[k] || '').join('');
  const content = `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr">${hatnote}${notices}${infobox}${finalBody}${navbox}</div>`;

  const slug = slugOf(a.title);
  const history = (m.history && m.history.length ? m.history : defaultHistory(a));
  const plain = stripTags(finalBody.replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<span class="mw-editsection">[\s\S]*?<\/span><\/span>/g, '').replace(/<ol class="references">[\s\S]*?<\/ol>/g, ''))
    .replace(/\s+/g, ' ').trim();
  const displayTitle = m.displayTitle ? m.displayTitle : escapeHtml(a.title);

  const html = layout({
    base: BASE,
    assetVersion: '__ASSET_VERSION__',
    pageTitle: a.title,
    canonicalTitle: a.title,
    displayTitle,
    description: m.description || stripTags(leadParas[0] || '').slice(0, 200),
    namespaceTabs: [
      { label: 'Article', href: wikiUrl(a.title), selected: true, id: 'ca-nstab-main', accesskey: 'c' },
      { label: 'Talk', href: wikiUrl('Talk:' + a.title), isNew: true, id: 'ca-talk', title: 'Discussion about the content page (page does not exist)', accesskey: 't' },
    ],
    viewTabs: [
      { label: 'Read', href: wikiUrl(a.title), selected: true, id: 'ca-view' },
      { label: m.protection === 'full' ? 'View source' : 'Edit', href: '?action=edit', id: 'ca-edit', accesskey: 'e' },
      { label: 'View history', href: '?action=history', id: 'ca-history', accesskey: 'h' },
    ],
    langCount: m.languages ?? 0,
    toc: headings.length ? tocHtml(headings) : '',
    content,
    indicators,
    categories: renderCategories(m.categories),
    lastEdited: m.lastEdited,
    ogImage: m.infobox?.image ? fileUrl(m.infobox.image) : null,
    pageData: { type: 'article', title: a.title, source: a.raw, history, lastEdited: m.lastEdited || null },
  });

  renderedArticles.push({ slug, html });
  outlinksByArticle.set(a.title, outlinks);
  searchIndex.push({
    t: a.title,
    dt: m.displayTitle ? stripTags(m.displayTitle) : a.title,
    u: wikiUrl(a.title),
    d: m.description || '',
    i: m.infobox?.image ? fileUrl(m.infobox.image) : null,
    c: (m.categories || []).map(normTitle),
    x: plain,
    w: plain.split(' ').length,
    b: Buffer.byteLength(a.raw),
    e: m.lastEdited || null,
    h: history,
    l: [...outlinks],
    f: Boolean(m.featured || (m.indicators || []).includes('featured')),
    lead: leadParas[0] ? leadParas[0].replace(/<sup[\s\S]*?<\/sup>/g, '') : '',
  });
}

// ---------------------------------------------------------------------------
// Main page

function articleByTitle(t) {
  const k = titleKey(t);
  return pages.get(k) || (redirects.has(k) ? pages.get(titleKey(redirects.get(k))) : null);
}

function renderMainPage() {
  const cfg = mainPageCfg;
  const ctx = makeCtx(null, redlinks, null);
  ctx.cite = () => '';
  const inl = (s) => renderInline(s, ctx);
  const mpImage = (im, cls = '') => im ? `<div class="mp-img ${cls}"><span class="mw-default-size"><a href="${fileUrl(im.file)}" class="mw-file-description" data-caption="${escapeHtml(stripTags(inl(im.caption || '')))}"><img src="${fileUrl(im.file)}" width="${im.width || 100}" alt="${escapeHtml(stripTags(inl(im.caption || '')))}" class="mw-file-element"></a></span>${im.caption ? `<div class="mp-img-caption">${inl(im.caption)}</div>` : ''}</div>` : '';

  // Today's featured article (rotates daily on the client)
  const tfaEntries = cfg.featured.map((f, i) => {
    const art = articleByTitle(f.article);
    if (!art) warn(`main-page.json: featured article "${f.article}" not found`);
    const idx = searchIndex.find(s => s.t === art?.title);
    const blurb = f.blurb ? inl(f.blurb) : (idx?.lead || '');
    const image = f.image || (art?.meta.infobox?.image ? { file: art.meta.infobox.image, width: 100 } : null);
    return `<div class="mp-rotate" data-rotate="tfa" data-index="${i}"${i ? ' hidden' : ''}>
${mpImage(image ? { ...image, caption: image.caption } : null, 'mp-img-left')}
<p>${blurb} (<b><a href="${wikiUrl(art?.title || f.article)}" title="${escapeHtml(art?.title || f.article)}">Full&nbsp;article...</a></b>)</p>
<div class="tfa-recent">Recently featured: <ul>${cfg.featured.filter((_, j) => j !== i).slice(0, 3).map(o => `<li>${inl(`[[${o.article}]]`)}</li>`).join('')}</ul></div>
</div>`;
  }).join('\n');

  const dyk = cfg.dyk;
  const itn = cfg.itn;
  const otd = cfg.otd;
  const potd = cfg.potd;

  const otdEvents = otd.events.map((e, i) => `<li data-otd-index="${i}"${i >= 5 ? ' hidden' : ''}><a href="#" class="mp-year">${escapeHtml(e.year)}</a> – ${inl(e.text)}</li>`).join('');

  const potdEntries = potd.map((p, i) => `<div class="mp-rotate" data-rotate="potd" data-index="${i}"${i ? ' hidden' : ''}>
<div class="mp-potd-inner">
<div class="mp-potd-img"><span class="mw-default-size"><a href="${fileUrl(p.file)}" class="mw-file-description" data-caption="${escapeHtml(stripTags(inl(p.caption)))}"><img src="${fileUrl(p.file)}" width="${p.width || 380}" alt="${escapeHtml(p.title)}" class="mw-file-element"></a></span></div>
<div class="mp-potd-text"><p>${inl(p.caption)}</p><p><small>${inl(p.credit || '')}</small></p>
<div class="potd-recent">Recently featured: <ul>${potd.filter((_, j) => j !== i).slice(0, 3).map(o => `<li>${inl(o.title)}</li>`).join('')}</ul></div>
<div class="hlist mp-more"><ul><li><a href="${wikiUrl('Alternopedia:Picture of the day/Archive')}">Archive</a></li><li><b><a href="${wikiUrl('Alternopedia:Featured pictures')}">More featured pictures</a></b></li></ul></div>
</div></div></div>`).join('\n');

  const content = `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr">
<div id="mp-topbanner" class="mp-bordered">
<div id="mp-welcomecount">
<div id="mp-welcome">Welcome to <a href="${wikiUrl('Alternopedia:About')}" title="Alternopedia">Alternopedia</a>,</div>
<div id="mp-free">the <a href="${wikiUrl('Free content')}" class="new">free</a> encyclopedia of a timeline that <a href="${wikiUrl('Help:Introduction')}">anyone can edit</a>.</div>
<div id="articlecount"><ul><li><a href="${wikiUrl('Special:ActiveUsers')}">${escapeHtml(cfg.welcome.editors)}</a>&nbsp;active editors</li><li><a href="${wikiUrl('Special:Statistics')}">${articles.length.toLocaleString('en-US')}</a> articles in <a href="${wikiUrl('English language')}" class="new">English</a> <span class="alt-small">(more arriving from the other timeline)</span></li></ul></div>
</div>
</div>
<div id="mp-upper">
<div id="mp-left" class="MainPageBG mp-box">
<h2 id="mp-tfa-h2" class="mp-h2"><span id="From_today's_featured_article"></span>From today's featured article</h2>
<div id="mp-tfa" class="mp-contains-float">${tfaEntries}
<div class="hlist mp-more"><ul><li><a href="${wikiUrl('Alternopedia:Today\'s featured article/Archive')}">Archive</a></li><li><a href="#" data-toast="Featured articles are delivered by owl in this timeline.">By email</a></li><li><b><a href="${wikiUrl('Alternopedia:Featured articles')}">More featured articles</a></b></li><li><a href="${wikiUrl('Alternopedia:About')}">About</a></li></ul></div>
</div>
<h2 id="mp-dyk-h2" class="mp-h2"><span id="Did_you_know_..."></span>Did you know&nbsp;...</h2>
<div id="mp-dyk" class="mp-contains-float">
${mpImage(dyk.image, 'mp-img-right')}
<ul>${dyk.hooks.map(h => `<li>... ${inl(h)}</li>`).join('')}</ul>
<div class="hlist mp-more"><ul><li><b><a href="${wikiUrl('Alternopedia:Did you know')}">Archive</a></b></li><li><a href="${wikiUrl('Alternopedia:Did you know')}">Start a new article</a></li><li><a href="${wikiUrl('Alternopedia:Did you know')}">Nominate an article</a></li></ul></div>
</div>
</div>
<div id="mp-right" class="MainPageBG mp-box">
<h2 id="mp-itn-h2" class="mp-h2"><span id="In_the_news"></span>In the news</h2>
<div id="mp-itn" class="mp-contains-float">
${mpImage(itn.image, 'mp-img-right')}
<ul>${itn.items.map(h => `<li>${inl(h)}</li>`).join('')}</ul>
<div class="itn-footer"><div class="hlist"><b>Ongoing</b>: <ul>${itn.ongoing.map(o => `<li>${inl(o)}</li>`).join('')}</ul></div>
<div class="hlist"><b>Recent deaths</b>: <ul>${itn.recentDeaths.map(o => `<li>${inl(o)}</li>`).join('')}</ul></div></div>
<div class="hlist mp-more"><ul><li><b><a href="${wikiUrl('Portal:Current events')}">Nominate an article</a></b></li></ul></div>
</div>
<h2 id="mp-otd-h2" class="mp-h2"><span id="On_this_day"></span>On this day</h2>
<div id="mp-otd" class="mp-contains-float">
<p><b><a href="#" class="alt-otd-date">${otd.fallbackDate}</a></b>: <span class="alt-otd-intro" data-intros="${escapeHtml(JSON.stringify(Object.fromEntries(Object.entries(otd.intros || {}).map(([k, v]) => [k, inl(v)]))))}">${inl(otd.intro)}</span></p>
${mpImage(otd.image, 'mp-img-right')}
<ul class="alt-otd-list">${otdEvents}</ul>
<div class="hlist otd-births"><ul>${otd.births.map(b => `<li>${inl(b)}</li>`).join('')}</ul></div>
<div class="hlist mp-more"><ul><li><b><a href="${wikiUrl('Alternopedia:Selected anniversaries')}">More anniversaries</a></b></li><li><a href="${wikiUrl('Alternopedia:Selected anniversaries')}">Archive</a></li><li><a href="#" data-toast="Anniversaries arrive by carrier emu.">By email</a></li><li><a href="${wikiUrl('List of days of the year')}" class="new">List of days of the year</a></li><li><a href="${wikiUrl('List of 25th Hours of the year')}" class="new">List of 25th Hours</a></li></ul></div>
</div>
</div>
</div>
<div id="mp-lower" class="MainPageBG mp-box">
<h2 id="mp-tfp-h2" class="mp-h2"><span id="Today's_featured_picture"></span>Today's featured picture</h2>
<div id="mp-tfp">${potdEntries}</div>
</div>
<div id="mp-bottom" class="MainPageBG">
<h2 id="mp-other" class="mp-h2 mp-h2-plain">Other areas of Alternopedia</h2>
<div id="mp-other-content"><ul>${cfg.otherAreas.map(o => `<li><b>${inl(o.link)}</b> – ${inl(o.text)}</li>`).join('')}</ul></div>
<h2 id="mp-sister" class="mp-h2 mp-h2-plain">Alternopedia's sister projects</h2>
<div id="mp-sister-content"><p>Alternopedia is written by volunteer editors and hosted by the <a href="${wikiUrl('Alternopedia:About')}">Elsewhen Foundation</a>, a non-profit organization that also hosts a range of other volunteer projects:</p>
<div class="alt-sister-grid">${cfg.sisters.map(s => `<div class="alt-sister"><span class="alt-sister-logo" style="background:${s.color}">${s.glyph}</span><div><b><a href="#" data-toast="${escapeHtml(s.name)} is only available in the timeline next door.">${escapeHtml(s.name)}</a></b><br>${escapeHtml(s.text)}</div></div>`).join('')}</div>
</div>
<h2 id="mp-lang" class="mp-h2 mp-h2-plain">Alternopedia languages</h2>
<div id="mp-lang-content"><p>This Alternopedia is written in English. Many other Alternopedias are available; some of the largest are listed below.</p>
<ul class="alt-lang-tiers">${cfg.languages.map(l => `<li><b>${escapeHtml(l.tier)}</b><div class="hlist"><ul>${l.items.map(x => `<li><a href="#" data-toast="This language edition exists only in a neighbouring timeline.">${escapeHtml(x)}</a></li>`).join('')}</ul></div></li>`).join('')}</ul>
</div>
</div>
</div>`;

  return layout({
    base: BASE,
    assetVersion: '__ASSET_VERSION__',
    pageTitle: 'Alternopedia, the free encyclopedia of Elsewhen',
    canonicalTitle: 'Main Page',
    displayTitle: 'Main Page',
    description: 'Alternopedia is a humorous encyclopedia of an alternate timeline: familiar history, slightly different outcomes.',
    namespaceTabs: [
      { label: 'Main Page', href: BASE, selected: true, id: 'ca-nstab-main' },
      { label: 'Talk', href: wikiUrl('Talk:Main Page'), id: 'ca-talk' },
    ],
    viewTabs: [
      { label: 'Read', href: BASE, selected: true, id: 'ca-view' },
      { label: 'View source', href: '?action=edit', id: 'ca-viewsource' },
      { label: 'View history', href: '?action=history', id: 'ca-history' },
    ],
    langCount: 0,
    hideTitle: true,
    siteSub: false,
    isMainPage: true,
    content,
    lastEdited: cfg.lastEdited,
    ogImage: fileUrl('logo.svg'),
    pageData: { type: 'main', title: 'Main Page', otdCount: 5, history: cfg.history || [], source: '{{Main Page}}\n<!-- The Main Page is assembled from content/main-page.json -->' },
  });
}

// ---------------------------------------------------------------------------
// Router page (404.html) — renders Special:, Category:, Talk:, project pages and "no such article" client-side

function renderRouterPage() {
  const projectPages = readJSON('project-pages.json');
  const ctx = makeCtx(null, null, null);
  ctx.cite = () => '';
  const rendered = {};
  for (const [title, md] of Object.entries(projectPages)) {
    rendered[normTitle(title)] = renderMarkdown(Array.isArray(md) ? md.join('\n') : md, ctx).html;
  }
  return layout({
    base: BASE,
    assetVersion: '__ASSET_VERSION__',
    pageTitle: 'Alternopedia',
    canonicalTitle: 'Special:Router',
    displayTitle: '<span class="alt-router-title">Alternopedia</span>',
    description: 'Alternopedia — the free encyclopedia of another timeline.',
    namespaceTabs: [{ label: 'Article', href: '#', selected: true, id: 'ca-nstab-main' }, { label: 'Talk', href: '#', id: 'ca-talk', isNew: true }],
    viewTabs: [{ label: 'Read', href: '#', selected: true, id: 'ca-view' }, { label: 'Create', href: '?action=edit', id: 'ca-edit' }],
    bodyClass: 'alt-router-page',
    content: `<div class="mw-parser-output alt-router-output"><div class="noarticletext mw-content-ltr"><p><b>Alternopedia does not have a page with this exact name.</b> Please enable JavaScript, or return to the <a href="${BASE}">Main Page</a>.</p></div></div>`,
    pageData: { type: 'router', projectPages: rendered },
  });
}

// ---------------------------------------------------------------------------
// Write output

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

rmrf(OUT);
fs.mkdirSync(path.join(OUT, 'wiki'), { recursive: true });
copyDir(path.join(ROOT, 'static'), path.join(OUT, 'static'));

const assetVersion = crypto.createHash('sha1')
  .update(fs.readFileSync(path.join(ROOT, 'static', 'site.css')))
  .update(fs.readFileSync(path.join(ROOT, 'static', 'site.js')))
  .digest('hex').slice(0, 10);
const finalize = (html) => html.replaceAll('__ASSET_VERSION__', assetVersion);

for (const r of renderedArticles) {
  fs.writeFileSync(path.join(OUT, 'wiki', `${r.slug}.html`), finalize(r.html));
}
const mainHtml = finalize(renderMainPage());
fs.writeFileSync(path.join(OUT, 'index.html'), mainHtml);
fs.writeFileSync(path.join(OUT, 'wiki', 'Main_Page.html'), mainHtml);
fs.writeFileSync(path.join(OUT, '404.html'), finalize(renderRouterPage()));

const redlinkObj = {};
for (const [t, srcs] of redlinks) redlinkObj[t] = [...srcs].filter(Boolean);
const redirectObj = {};
for (const [k, v] of redirects) redirectObj[k] = v;
fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify({
  generated: new Date().toISOString(),
  base: BASE,
  articles: searchIndex,
  redirects: redirectObj,
  redlinks: redlinkObj,
}));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log(`Alternopedia built: ${articles.length} articles, ${redirects.size} redirects, ${redlinks.size} red links → dist/ (base ${BASE})`);
if (warnings.length) {
  console.warn('\nWarnings:');
  for (const w of warnings) console.warn('  - ' + w);
}
