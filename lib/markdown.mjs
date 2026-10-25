// A small, dependency-free Markdown + wiki-markup renderer tailored for Alternopedia articles.
//
// Supported block syntax:
//   ## Heading / ### Subheading / #### Sub-subheading
//   paragraphs, - unordered lists, 1. ordered lists (one nesting level via 2-space indent)
//   > blockquotes, | pipe | tables |, raw HTML blocks (lines starting with "<")
//   [[File:name.svg|thumb|right|220px|Caption]]   (on its own line)
//   {{main|Title}}  {{see also|A|B}}  {{further|Title}}  {{quote|Text|Author}}  {{clear}}
// Supported inline syntax:
//   [[Target]]  [[Target|label]]  [[Target]]s (blend link)  [label](https://external)
//   **bold**  *italic*  [^refKey] (citation)  {{cn}} (citation needed)  {{nowrap|text}}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function stripTags(html) {
  return String(html).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export function headingId(text, used) {
  let id = stripTags(text).trim().replace(/\s+/g, '_').replace(/["'<>&]/g, '');
  let base = id, n = 2;
  while (used.has(id)) id = `${base}_${n++}`;
  used.add(id);
  return id;
}

/**
 * ctx = {
 *   link(title) -> { href, exists, title }          resolve an internal wiki link
 *   file(name) -> url                                 resolve an image file
 *   cite(key) -> html                                 register a citation, returns <sup> html
 *   onLink(title)                                     optional callback for every internal link
 * }
 */
export function renderInline(text, ctx) {
  const slots = [];
  const put = (html) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = String(text);

  // Citations first, so they can sit right after links.
  s = s.replace(/\[\^([\w.-]+)\]/g, (_, key) => put(ctx.cite ? ctx.cite(key) : ''));

  s = s.replace(/\{\{\s*(cn|citation needed|fact)\s*\}\}/gi, () => put(
    '<sup class="noprint Inline-Template Template-Fact" style="white-space:nowrap;">[<i>' +
    '<a href="#" class="cn-link" title="Alternopedia:Citation needed">' +
    '<span title="This claim needs references to reliable sources from this timeline.">citation needed</span>' +
    '</a></i>]</sup>'));

  s = s.replace(/\{\{\s*nowrap\s*\|([^}]*)\}\}/gi, (_, inner) => put(
    `<span class="nowrap">${renderInline(inner, ctx)}</span>`));

  s = s.replace(/\{\{\s*lang\s*\|[^|}]*\|([^}]*)\}\}/gi, (_, inner) => put(
    `<i lang="xx">${renderInline(inner, ctx)}</i>`));

  // Wiki links, including "blend" suffixes like [[emu]]s
  s = s.replace(/\[\[([^\]|]+?)(?:\|([^\]]*?))?\]\]([a-z]*)/g, (m, target, label, suffix) => {
    if (/^(File|Image):/i.test(target)) return m; // handled at block level
    const anchorIdx = target.indexOf('#');
    let page = target, anchor = '';
    if (anchorIdx >= 0) { page = target.slice(0, anchorIdx); anchor = target.slice(anchorIdx + 1); }
    let text;
    if (label === undefined) text = page ? target : anchor;
    else if (label === '') text = page.replace(/\s*\(.*\)\s*$/, ''); // pipe trick [[Foo (bar)|]] -> Foo
    else text = label;
    text = renderInline(text + (suffix || ''), ctx);
    if (!page) {
      return put(`<a href="#${escapeHtml(anchor.replace(/ /g, '_'))}">${text}</a>`);
    }
    const r = ctx.link(page);
    if (ctx.onLink) ctx.onLink(r.title, r.exists);
    const href = r.href + (anchor ? '#' + encodeURIComponent(anchor.replace(/ /g, '_')) : '');
    if (r.exists) {
      return put(`<a href="${href}" title="${escapeHtml(r.title)}">${text}</a>`);
    }
    return put(`<a href="${href}" class="new" title="${escapeHtml(r.title)} (page does not exist)">${text}</a>`);
  });

  // External links [label](url)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => put(
    `<a rel="nofollow" class="external text" href="${escapeHtml(url)}">${renderInline(label, ctx)}</a>`));

  // Bold + italic
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])/g, '$1<i>$2</i>');

  // Restore slots (may be nested)
  for (let i = 0; i < 4 && s.includes('\u0000'); i++) {
    s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => slots[Number(n)]);
  }
  return s;
}

function parseFileTag(line) {
  const m = line.trim().match(/^\[\[(?:File|Image):([^\]]+)\]\]$/i);
  if (!m) return null;
  // split on | but not inside nested [[ ]]
  const parts = [];
  let depth = 0, cur = '';
  for (let i = 0; i < m[1].length; i++) {
    const c = m[1][i], c2 = m[1].slice(i, i + 2);
    if (c2 === '[[') { depth++; cur += c2; i++; continue; }
    if (c2 === ']]') { depth--; cur += c2; i++; continue; }
    if (c === '|' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  const file = parts.shift().trim();
  const opt = { file, type: 'thumb', align: null, width: null, caption: '', alt: '', upright: null };
  for (const p of parts) {
    const t = p.trim();
    if (/^(thumb|thumbnail|frame|frameless)$/i.test(t)) opt.type = t.toLowerCase().startsWith('thumb') ? 'thumb' : t.toLowerCase();
    else if (/^(left|right|center|none)$/i.test(t)) opt.align = t.toLowerCase();
    else if (/^\d+px$/i.test(t)) opt.width = parseInt(t, 10);
    else if (/^alt=/i.test(t)) opt.alt = t.slice(4);
    else if (/^upright/i.test(t)) opt.upright = t;
    else opt.caption = p;
  }
  return opt;
}

export function renderFigure(opt, ctx) {
  const src = ctx.file(opt.file);
  const width = opt.width || 220;
  const align = opt.align || (opt.type === 'thumb' ? 'right' : 'none');
  const cap = opt.caption ? renderInline(opt.caption, ctx) : '';
  const alt = escapeHtml(opt.alt || stripTags(cap));
  const capAttr = escapeHtml(stripTags(cap));
  if (opt.type === 'frameless') {
    return `<span class="mw-default-size mw-halign-${align}" typeof="mw:File"><a href="${src}" class="mw-file-description" data-caption="${capAttr}"><img alt="${alt}" src="${src}" width="${width}" class="mw-file-element" loading="lazy"></a></span>`;
  }
  return `<figure class="mw-default-size mw-halign-${align}" typeof="mw:File/Thumb"><a href="${src}" class="mw-file-description" data-caption="${capAttr}"><img alt="${alt}" src="${src}" width="${width}" class="mw-file-element" loading="lazy"></a><figcaption>${cap}</figcaption></figure>`;
}

function splitTemplateArgs(inner) {
  const parts = [];
  let depth = 0, cur = '';
  for (let i = 0; i < inner.length; i++) {
    const c2 = inner.slice(i, i + 2);
    if (c2 === '[[' || c2 === '{{') { depth++; cur += c2; i++; continue; }
    if (c2 === ']]' || c2 === '}}') { depth--; cur += c2; i++; continue; }
    if (inner[i] === '|' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += inner[i];
  }
  parts.push(cur);
  return parts.map(p => p.trim());
}

function renderBlockTemplate(line, ctx) {
  const m = line.trim().match(/^\{\{([\s\S]*)\}\}$/);
  if (!m) return null;
  const [name, ...args] = splitTemplateArgs(m[1]);
  const n = name.toLowerCase();
  const link = (t) => renderInline(`[[${t}]]`, ctx);
  if (n === 'main' || n === 'main article') {
    return `<div role="note" class="hatnote navigation-not-searchable">Main article${args.length > 1 ? 's' : ''}: ${args.map(link).join(', ')}</div>`;
  }
  if (n === 'see also') {
    return `<div role="note" class="hatnote navigation-not-searchable">See also: ${args.map(link).join(', ')}</div>`;
  }
  if (n === 'further') {
    return `<div role="note" class="hatnote navigation-not-searchable">Further information: ${args.map(link).join(', ')}</div>`;
  }
  if (n === 'hatnote') {
    return `<div role="note" class="hatnote navigation-not-searchable">${renderInline(args.join('|'), ctx)}</div>`;
  }
  if (n === 'quote' || n === 'blockquote') {
    const [text, author, source] = args;
    const cite = author ? `<div class="templatequotecite">— <cite>${renderInline(author, ctx)}${source ? ', ' + renderInline(source, ctx) : ''}</cite></div>` : '';
    return `<blockquote class="templatequote"><p>${renderInline(text || '', ctx)}</p>${cite}</blockquote>`;
  }
  if (n === 'clear') return '<div style="clear:both;"></div>';
  return null;
}

function renderTable(lines, ctx) {
  const rows = lines.map(l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
  let caption = '';
  let header = rows[0];
  let body = rows.slice(1);
  if (body.length && body[0].every(c => /^:?-{2,}:?$/.test(c))) {
    body = body.slice(1);
  } else {
    header = null;
    body = rows;
  }
  let html = '<table class="wikitable">';
  if (caption) html += `<caption>${renderInline(caption, ctx)}</caption>`;
  if (header) html += '<thead><tr>' + header.map(c => `<th>${renderInline(c, ctx)}</th>`).join('') + '</tr></thead>';
  html += '<tbody>' + body.map(r => '<tr>' + r.map(c => `<td>${renderInline(c, ctx)}</td>`).join('') + '</tr>').join('') + '</tbody>';
  return html + '</table>';
}

/**
 * Render a markdown document. Returns { html, headings: [{level, id, text, html}] }.
 */
export function renderMarkdown(src, ctx) {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const headings = [];
  const usedIds = ctx.usedIds || new Set();
  let para = [];
  let sectionIndex = 0;

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(' ').trim();
    if (text) out.push(`<p>${renderInline(text, ctx)}</p>`);
    para = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { flushPara(); i++; continue; }

    // HTML comments
    if (trimmed.startsWith('<!--')) {
      flushPara();
      while (i < lines.length && !lines[i].includes('-->')) i++;
      i++;
      continue;
    }

    // Headings
    const h = trimmed.match(/^(#{2,4})\s+(.+?)\s*#*$/);
    if (h) {
      flushPara();
      const level = h[1].length;
      const inner = renderInline(h[2], ctx);
      const id = headingId(inner, usedIds);
      sectionIndex++;
      headings.push({ level, id, text: stripTags(inner), html: inner });
      out.push(`<div class="mw-heading mw-heading${level}"><h${level} id="${id}">${inner}</h${level}>` +
        `<span class="mw-editsection"><span class="mw-editsection-bracket">[</span>` +
        `<a href="?action=edit&amp;section=${sectionIndex}" title="Edit section: ${escapeHtml(stripTags(inner))}"><span>edit</span></a>` +
        `<span class="mw-editsection-bracket">]</span></span></div>`);
      i++;
      continue;
    }

    // File embeds
    const fileOpt = parseFileTag(trimmed);
    if (fileOpt) {
      flushPara();
      out.push(renderFigure(fileOpt, ctx));
      i++;
      continue;
    }

    // Block templates (single line)
    if (trimmed.startsWith('{{') && trimmed.endsWith('}}') && !/^\{\{\s*(cn|citation needed|fact|nowrap|lang)\b/i.test(trimmed)) {
      const tpl = renderBlockTemplate(trimmed, ctx);
      if (tpl) { flushPara(); out.push(tpl); i++; continue; }
    }

    // Tables
    if (trimmed.startsWith('|')) {
      flushPara();
      const tbl = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) tbl.push(lines[i++]);
      out.push(renderTable(tbl, ctx));
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      flushPara();
      const q = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) q.push(lines[i++].trim().replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${renderInline(q.join(' '), ctx)}</p></blockquote>`);
      continue;
    }

    // Lists
    const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      flushPara();
      const ordered = /\d/.test(li[2]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (m) {
          const indent = m[1].length;
          if (indent >= 2 && items.length) {
            const last = items[items.length - 1];
            last.children.push({ ordered: /\d/.test(m[2]), text: m[3] });
          } else {
            items.push({ text: m[3], children: [] });
          }
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1].text += ' ' + lines[i].trim();
          i++;
        } else break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>` + items.map(it => {
        let inner = renderInline(it.text, ctx);
        if (it.children.length) {
          const ctag = it.children[0].ordered ? 'ol' : 'ul';
          inner += `<${ctag}>` + it.children.map(c => `<li>${renderInline(c.text, ctx)}</li>`).join('') + `</${ctag}>`;
        }
        return `<li>${inner}</li>`;
      }).join('') + `</${tag}>`);
      continue;
    }

    // Raw HTML block
    if (/^<(div|table|figure|section|aside|p|span|center|blockquote|dl)\b/i.test(trimmed)) {
      flushPara();
      const block = [];
      while (i < lines.length && lines[i].trim()) block.push(lines[i++]);
      out.push(block.join('\n'));
      continue;
    }

    para.push(trimmed);
    i++;
  }
  flushPara();
  return { html: out.join('\n'), headings };
}
