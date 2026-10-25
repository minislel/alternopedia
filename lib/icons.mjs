// Small inline SVG icons (20x20) in the style of Wikimedia Codex. Drawn for Alternopedia.
const svg = (d, extra = '') => `<svg class="alt-icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"${extra}>${d}</svg>`;

export const icons = {
  menu: svg('<path d="M1 3h18v2H1zm0 6h18v2H1zm0 6h18v2H1z"/>'),
  search: svg('<path d="M12.2 13.6a7 7 0 1 1 1.4-1.4l5.4 5.4-1.4 1.4zM3 8a5 5 0 1 0 10 0A5 5 0 0 0 3 8"/>'),
  ellipsis: svg('<circle cx="3" cy="10" r="2"/><circle cx="10" cy="10" r="2"/><circle cx="17" cy="10" r="2"/>'),
  chevronDown: svg('<path d="m17.5 4.75-7.5 7.5-7.5-7.5L1 6.25l9 9 9-9z"/>', ' class="alt-icon alt-icon-small"'),
  language: svg('<path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18m6.9 8h-3.4a14 14 0 0 0-1.3-5.6A7 7 0 0 1 16.9 9M10 17c-.9 0-2.3-2.4-2.5-6h5c-.2 3.6-1.6 6-2.5 6m-2.5-8C7.7 5.4 9.1 3 10 3s2.3 2.4 2.5 6zM7.8 3.4A14 14 0 0 0 6.5 9H3.1a7 7 0 0 1 4.7-5.6M3.1 11h3.4a14 14 0 0 0 1.3 5.6A7 7 0 0 1 3.1 11m9.1 5.6a14 14 0 0 0 1.3-5.6h3.4a7 7 0 0 1-4.7 5.6"/>'),
  appearance: svg('<path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 16V3a7 7 0 0 1 0 14"/>'),
  toc: svg('<path d="M3 3h2v2H3zm4 0h10v2H7zM3 9h2v2H3zm4 0h10v2H7zm-4 6h2v2H3zm4 0h10v2H7z"/>'),
  close: svg('<path d="m4.3 2.9 5.7 5.7 5.7-5.7 1.4 1.4-5.7 5.7 5.7 5.7-1.4 1.4-5.7-5.7-5.7 5.7-1.4-1.4 5.7-5.7-5.7-5.7z"/>'),
  user: svg('<path d="M10 11c-5.9 0-8 3-8 5v3h16v-3c0-2-2.1-5-8-5"/><circle cx="10" cy="5.5" r="4.5"/>'),
  next: svg('<path d="M7 1 5.6 2.5 13 10l-7.4 7.5L7 19l9-9z"/>'),
  info: svg('<path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18m1 15H9V8h2zm0-10H9V4h2z"/>'),
};
