# Alternopedia — notes for AI assistants

Humorous alternate-history encyclopedia in English, styled like Wikipedia (Vector 2022). Static site, zero dependencies, Node 18+.

- Build: `node build.mjs` (output `dist/`). Preview: `node serve.mjs`. The build prints warnings for missing citations or unknown navboxes; fix them.
- New articles: one file in `content/articles/`, JSON frontmatter + Markdown. Follow `docs/writing-articles.md` exactly (format, tone, prompt template).
- Content rules: short articles (300–450 words of body text) in a light, relaxed tone with frequent punchlines, inside the Wikipedia layout; change one thing about real history; no invented quotes/actions for real living people; invented references from invented publications; anonymous editors in history use documentation IPs (192.0.2.x, 198.51.100.x, 203.0.113.x).
- Images: original SVGs in `static/images/` only. No copyrighted photos, logos or characters; never use Wikipedia's name or puzzle-globe logo.
- After adding an article, add it to the `elsewhen` navbox (`content/navboxes.json`) and consider the Main Page (`content/main-page.json`).
- Keep the site working under a sub-path (GitHub Pages sets `BASE_PATH=/alternopedia/`): always build URLs through `wikiUrl()` / `fileUrl()` in `build.mjs` and `BASE` in `static/site.js`.
