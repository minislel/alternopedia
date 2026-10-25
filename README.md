# Alternopedia

**The free encyclopedia of Elsewhen** — a Wikipedia-style site whose articles describe a timeline that went slightly differently. The iPhone was cancelled, the iceberg sank, the emus won.

Live: **https://alternopedia.vercel.app** (also on GitHub Pages: https://minislel.github.io/alternopedia/)

The layout imitates the MediaWiki *Vector 2022* skin (header, search with suggestions, sticky table of contents, Appearance menu with dark mode, infoboxes, references, navboxes, categories, View history and View source). Name, logo and all content are original; every article is fiction. Not affiliated with Wikipedia or the Wikimedia Foundation.

## Run locally

Requires Node.js 18+. No dependencies.

```bash
npm run dev      # build into dist/ and serve at http://localhost:4173
npm run build    # build only
```

## Add an article

1. Create `content/articles/<slug>.md` (JSON frontmatter + Markdown). See **[docs/writing-articles.md](docs/writing-articles.md)** for the format, markup and an AI prompt template.
2. Add it to the `elsewhen` navbox in `content/navboxes.json` and, optionally, to `content/main-page.json`.
3. `npm run build`. Red links on other pages turn blue automatically.

**Special:WantedPages** on the site lists every red link, i.e. topics already referenced but not yet written.

## Project layout

```
build.mjs              static site generator (zero dependencies)
serve.mjs              local preview server with clean URLs and 404 routing
lib/                   Markdown/wiki renderer, page templates, icons
content/articles/      one Markdown file per article
content/main-page.json Main Page sections
content/navboxes.json  navigation boxes
content/project-pages.json  Alternopedia:/Help:/Portal: pages
static/                CSS, JS, images (all SVGs drawn for this project)
```

Pages under `Special:`, `Category:`, `Talk:` and project namespaces are rendered client-side by `404.html`, so they work on any static host.

## Deploy

- **GitHub Pages**: pushes to `main` deploy automatically (`.github/workflows/pages.yml`). The workflow sets `BASE_PATH` for the `/alternopedia/` sub-path.
- **Vercel**: project `alternopedia` is connected to this repo; every push to `main` deploys to https://alternopedia.vercel.app (settings in `vercel.json`).
