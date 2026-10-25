# Writing Alternopedia articles

Every article is one Markdown file in `content/articles/`. The file name does not matter (use a slug like `great-emu-war.md`); files starting with `_` are ignored. Run `npm run build` and the article appears at `/wiki/<Title_with_underscores>`.

Red links are the to-do list: any `[[Link]]` to a page that doesn't exist yet shows up in red and on **Special:WantedPages**. Write an article with that title and every red link to it turns blue.

## The tone

- Start from something real (a phone, a tower, a war) and change **one** thing. Follow the consequences with a straight face.
- Write like a real encyclopedia: neutral, dry, specific numbers, dates, places. The joke works because the article believes itself.
- Keep real history accurate up to the point of divergence.
- Don't put invented words or actions on **real living people**. Use roles ("the company's annual report", "a field engineer") or invented people with plausible names.
- References are invented too, from invented publications (*The Cupertino Ledger*, *Journal of Counterfactual Astronomy*). Don't attribute fake quotes to real newspapers.
- A few `{{cn}}` (citation needed) tags on the silliest claims are part of the style.

## File format

```markdown
---
{
  "title": "Great Emu War",
  "displayTitle": "Great Emu War",
  "description": "One-line summary shown in search suggestions",
  "redirects": ["Emu War", "Old Nugget"],
  "lastEdited": "2026-10-20T03:12:00Z",
  "languages": 54,
  "indicators": ["featured"],
  "hatnote": "For the public holiday, see [[Emu Day]].",
  "notices": [
    { "type": "style", "text": "This article **may be too sweet**.", "small": "(September 2026)" }
  ],
  "infobox": {
    "title": "Great Emu War",
    "subtitle": "optional italic line",
    "color": "#b0c4de",
    "image": "emu-flag.svg",
    "imageWidth": 240,
    "caption": "Flag of the Emu Autonomous Region",
    "rows": [
      { "label": "Date", "value": "2 November – 11 December 1932" },
      { "label": "Result", "value": ["Decisive emu victory", "Treaty of Campion"] },
      { "header": "Belligerents" },
      { "cols": ["Commonwealth of Australia", "Emus"] },
      { "full": "A full-width centred row" }
    ]
  },
  "references": {
    "johnson": "Pembroke, Alistair (1988). *Feathers and Fire*. Perth: Swan River Press. pp. 61–102."
  },
  "categories": ["Conflicts in 1932", "Emus"],
  "navbox": "elsewhen",
  "history": [
    { "date": "2005-12-10T08:00:00Z", "user": "Wheatbelt Historian", "size": 2950, "summary": "Created page" },
    { "date": "2026-10-20T03:12:00Z", "user": "192.0.2.15", "size": 11458, "minor": true, "summary": "funny edit summary" }
  ]
}
---
The **Great Emu War** was ... [^johnson]

## Background

Text with [[Western Australia]], [[Emu]]s, [[Great Emu War#Treaty of Campion|a section link]] and a claim.{{cn}}

[[File:emu-flag.svg|thumb|right|220px|Caption for an image inside the article]]

## References

{{reflist}}
```

The frontmatter is **JSON** (not YAML): double quotes, no trailing commas, escape inner quotes as `\"`. The build stops with a clear error if it's invalid.

Only `title` is required. Everything else is optional.

| Field | Meaning |
|---|---|
| `title` | Page title. The URL is built from it (first letter capitalised, spaces → `_`). |
| `displayTitle` | How the title is shown, e.g. `iPhone (cancelled project)` for the title `IPhone (cancelled project)`. |
| `redirects` | Other titles that lead here; the page shows "(Redirected from …)". |
| `indicators` | Icons at the top right: `featured` (gold star), `good` (green star), `semi` (padlock). |
| `notices` | Maintenance boxes. `type`: `content` (orange), `style` (yellow), `notice` (blue), `cite`, `disputed`, `delete`. |
| `infobox` | Right-hand box. `color` tints the title and section headers. Row types: `label`/`value` (value may be a list), `header`, `cols` (2 columns, `\n` for line breaks), `full`, `images`. |
| `references` | Map of key → citation. Cite with `[^key]`. Numbers follow the order of first use; repeated use gives `^ a b` backlinks. |
| `navbox` | Name of a box from `content/navboxes.json`, shown at the end of the article. |
| `history` | Entries for *View history* (also used by Special:RecentChanges). Use documentation IPs (`192.0.2.x`, `198.51.100.x`, `203.0.113.x`) for anonymous editors. |
| `languages` | Number shown on the "N languages" button. |

## Markup

| Write | Get |
|---|---|
| `[[Title]]`, `[[Title\|label]]`, `[[Emu]]s` | Internal link (red if the page doesn't exist) |
| `[[Title#Section\|label]]` | Link to a section |
| `[label](https://…)` | External link |
| `**bold**`, `*italic*` | Bold, italic |
| `[^key]` | Citation from `references` |
| `{{cn}}` | [citation needed] |
| `## Heading`, `### Subheading` | Sections (feed the table of contents) |
| `{{main\|Title}}`, `{{see also\|A\|B}}`, `{{further\|Title}}` | Hatnotes under a heading |
| `{{quote\|Text\|Author\|Source}}` | Block quotation |
| `[[File:name.svg\|thumb\|right\|260px\|Caption]]` | Thumbnail image (own line) |
| `\| a \| b \|` pipe tables | Wikitable |
| `{{reflist}}` | Where the reference list goes |

Images live in `static/images/`. Use your own SVG/PNG drawings, never copyrighted photos or logos.

## Main page

`content/main-page.json` controls the Main Page:

- `featured`: today's featured article. Rotates daily through the list. Each entry has `article`, optional `blurb` (inline markup) and `image`.
- `dyk`: *Did you know* hooks (each starts after "... ").
- `itn`: *In the news* items, `ongoing`, `recentDeaths`.
- `otd`: *On this day* events (5 are picked daily), `intros` keyed by `YYYY-MM-DD` or `MM-DD`.
- `potd`: featured pictures, rotating daily.

## Prompt for generating a new article with an AI

> Write an Alternopedia article (humorous alternate-history encyclopedia, deadpan Wikipedia style, English) about **TOPIC**. Change exactly one thing about the real history and follow the consequences seriously. Keep real facts accurate up to the divergence. Do not invent quotes or actions for real living people; use roles or invented people. Invent all references from invented publications. Output a single Markdown file following `docs/writing-articles.md`: JSON frontmatter with title, description, redirects, lastEdited, languages, infobox (6–12 rows), 4–8 references, 3–5 categories, `"navbox": "elsewhen"`, and 3–5 history entries with funny edit summaries; then a two-paragraph lead, 4–6 sections (`##`/`###`), one table or `{{quote}}`, 2–3 `{{cn}}` tags, "See also" and "References" with `{{reflist}}`. Link to existing articles where natural: LIST OF EXISTING TITLES.

After adding an article, add it to the `elsewhen` navbox in `content/navboxes.json` and, if you like, to the Main Page.
