/* ═══════════════ 라인 아이콘 (24px 그리드, currentColor) ═══════════════ */
"use strict";

const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4.6" transform="rotate(-22 12 12)"/><circle cx="20.2" cy="8.4" r="1.4" fill="currentColor" stroke="none"/>',
  calendar: '<rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  star: '<path d="m12 3.6 2.55 5.2 5.7.83-4.13 4.02.98 5.68L12 16.65l-5.1 2.68.98-5.68L3.75 9.63l5.7-.83z"/>',
  flame: '<path d="M12 21.2c-3.8 0-6.4-2.5-6.4-6 0-3.3 2.3-5.3 3.7-7.5.4 1.6 1.2 2.6 2.3 3.1.1-3.2 1.5-5.8 3.9-7.9-.3 3.1 1.4 5 2.7 6.9 1 1.5 1.8 3 1.8 5.2 0 3.6-2.6 6.2-8 6.2z"/>',
  chevDown: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>', chevLeft: '<path d="m14.5 6-6 6 6 6"/>', chevRight: '<path d="m9.5 6 6 6-6 6"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 12a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.9-12M9.5 7V4.5h5V7"/>',
  repeat: '<path d="m17 3 3 3-3 3"/><path d="M4 11.5v-.5a5 5 0 0 1 5-5h11M7 21l-3-3 3-3"/><path d="M20 12.5v.5a5 5 0 0 1-5 5H4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  note: '<path d="M5 6.5h14M5 11.5h14M5 16.5h9"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>', upload: '<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  edit: '<path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  install: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 7.5v7M9 11.5l3 3 3-3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  sparkle: '<path d="M12 3.5 13.9 9 19.5 11l-5.6 2-1.9 5.5-1.9-5.5L4.5 11l5.6-2z"/>',
  alert: '<path d="M12 9.5v4M12 17h.01"/><path d="M10.3 4.2 3 17.2A2 2 0 0 0 4.7 20.2h14.6a2 2 0 0 0 1.7-3l-7.3-13a2 2 0 0 0-3.4 0z"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  orbitBack: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4.5h4.5"/>',
  dot: '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><circle cx="12" cy="12" r="2.5"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.4a2.4 2.4 0 0 1 4.6 1c0 1.6-2.3 2.1-2.3 3.5M12 17h.01"/>',
  move: '<path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>',
  zoom: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4M8.5 11h5M11 8.5v5"/>',
  hand: '<path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10m0-4.5a1.5 1.5 0 0 1 3 0V10m0-3a1.5 1.5 0 0 1 3 0v6.5c0 4-2.5 7-6.5 7-2.6 0-4.3-1.3-5.6-3.4L4 14c-.6-1 .6-2.2 1.6-1.6L8 14"/>',
};
function ico(name, size = 18, extra = "") {
  return `<svg class="ico ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}
