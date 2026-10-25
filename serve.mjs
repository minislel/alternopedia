#!/usr/bin/env node
// Tiny static server for local preview of ./dist — mimics GitHub Pages / Vercel clean URLs.
// Usage: node serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
// Optional sub-path, e.g. `node serve.mjs 4173 /alternopedia/` after building with BASE_PATH=/alternopedia/
const PREFIX = (process.argv[3] || process.env.BASE_PATH || '/').replace(/\/?$/, '/');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function tryFile(p) {
  try { const st = fs.statSync(p); if (st.isFile()) return p; if (st.isDirectory()) return tryFile(path.join(p, 'index.html')); } catch {}
  return null;
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (PREFIX !== '/') {
    if (!urlPath.startsWith(PREFIX) && urlPath + '/' !== PREFIX) { res.writeHead(302, { Location: PREFIX }).end(); return; }
    urlPath = '/' + urlPath.slice(PREFIX.length);
  }
  const target = path.join(ROOT, urlPath);
  if (!target.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  const file = tryFile(target) || tryFile(target + '.html');
  const send = (p, status = 200) => {
    res.writeHead(status, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(p).pipe(res);
  };
  if (file) send(file); else send(path.join(ROOT, '404.html'), 404);
}).listen(PORT, () => console.log(`Alternopedia preview: http://localhost:${PORT}/`));
