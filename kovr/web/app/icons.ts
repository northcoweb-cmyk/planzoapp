/**
 * Inline SVG icons.
 *
 * Hand-drawn 24x24 strokes rather than an icon package: KOVR ships no
 * runtime dependencies, and inlining keeps the shell to a single request.
 */

import { raw } from './dom.js';
import type { RawHtml } from './dom.js';

const PATHS: Readonly<Record<string, string>> = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5"/>',
  sports: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/><path d="M5 6.5c3 2 11 2 14 0M5 17.5c3-2 11-2 14 0"/>',
  slip: '<path d="M6 3h12a1 1 0 0 1 1 1v16l-2.5-1.6L14 20l-2-1.4L10 20l-2.5-1.6L5 20V4a1 1 0 0 1 1-1Z"/><path d="M9 8h6M9 12h6"/>',
  bets: '<path d="M3 8.5A2.5 2.5 0 0 0 5.5 6H19a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 0 3 15.5Z"/><path d="M10 9v6"/>',
  wallet: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v1.5"/><path d="M3 7.5V18a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5.5"/><circle cx="16.5" cy="13.5" r="1.2"/>',
  profile: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  activity: '<path d="M3 12h4l2.5-6 5 13L17 12h4"/>',

  combat: '<path d="M7 7.5A2.5 2.5 0 0 1 9.5 5h4A4.5 4.5 0 0 1 18 9.5V13a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4Z"/><path d="M7 17v1.5A1.5 1.5 0 0 0 8.5 20h5a1.5 1.5 0 0 0 1.5-1.5V17"/><path d="M11 9v3"/>',
  football: '<ellipse cx="12" cy="12" rx="9" ry="5.6" transform="rotate(-38 12 12)"/><path d="M9.5 14.5 14.5 9.5M10.5 11l1.4 1.4M12.1 9.4l1.4 1.4M11.9 13.2l1.4 1.4"/>',
  basketball: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3.4 9.5c4 1.2 13.2 1.2 17.2 0M3.4 14.5c4-1.2 13.2-1.2 17.2 0"/>',
  baseball: '<circle cx="12" cy="12" r="9"/><path d="M7 4.6C8.8 7 9.4 10 8.6 13.2 8 15.6 6.8 17.7 5 19.4M17 4.6c-1.8 2.4-2.4 5.4-1.6 8.6.6 2.4 1.8 4.5 3.6 6.2"/>',
  hockey: '<path d="M3 6.5c0-1.1 4-2 9-2s9 .9 9 2-4 2-9 2-9-.9-9-2Z"/><path d="M3 6.5v10c0 1.1 4 2 9 2s9-.9 9-2v-10"/>',
  soccer: '<circle cx="12" cy="12" r="9"/><path d="m12 8 3.4 2.5-1.3 4h-4.2l-1.3-4Z"/><path d="M12 3v5M4.2 9.6 8.6 10.5M19.8 9.6 15.4 10.5M7.4 19.6 9.9 14.5M16.6 19.6 14.1 14.5"/>',
  tennis: '<circle cx="12" cy="12" r="9"/><path d="M5.2 5.8A9 9 0 0 1 8.9 12a9 9 0 0 1-3.7 6.2M18.8 5.8A9 9 0 0 0 15.1 12a9 9 0 0 0 3.7 6.2"/>',
  golf: '<path d="M11 21V4l7.5 3.6L11 11"/><path d="M7 20.5c1-1 2.5-1.5 4-1.5s3 .5 4 1.5"/>',
  motorsport: '<path d="M4 15.5 6 10a2 2 0 0 1 1.9-1.4h8.2A2 2 0 0 1 18 10l2 5.5"/><path d="M3 15.5h18v2.2a1 1 0 0 1-1 1h-2.2a1 1 0 0 1-1-1v-.7H7.2v.7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>',
  cricket: '<path d="M14.5 3.5 20.5 9.5 10 20a2 2 0 0 1-2.8 0l-3.2-3.2a2 2 0 0 1 0-2.8Z"/><circle cx="6" cy="6" r="2.2"/>',
  rugby: '<ellipse cx="12" cy="12" rx="9" ry="5.6" transform="rotate(-38 12 12)"/><path d="M9 15 15 9"/>',
  generic: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.8 1.6"/>',

  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  alert: '<path d="M12 4.5 21 19.5H3Z"/><path d="M12 10v4M12 16.8v.2"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.5 4v4.5H16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.4 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  ticket: '<path d="M4 8.5A2.5 2.5 0 0 0 6.5 6H19a1 1 0 0 1 1 1v2.2a2.8 2.8 0 0 0 0 5.6V17a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 0 4 15.5Z"/>',
  empty: '<path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  shield: '<path d="M12 3 20 6v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  tools: '<path d="M14.5 6.5a3.5 3.5 0 0 1 4.8 4.4L21 12.6 12.6 21 4 12.4l8.4-8.4 1.7 1.7A3.5 3.5 0 0 1 14.5 6.5Z"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>',
  upload: '<path d="M12 20V9M7.5 13.5 12 9l4.5 4.5"/><path d="M4.5 4.5h15"/>',
  rewards: '<path d="M12 3 14.5 8.5 20.5 9.3 16 13.2 17.2 19.2 12 16.1 6.8 19.2 8 13.2 3.5 9.3 9.5 8.5Z"/>',
  crown: '<path d="M4 8.5 8 12l4-6 4 6 4-3.5V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/><path d="M5 20.5h14"/>',
  tag: '<path d="M4 4h7.5a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-6.5 6.5a1 1 0 0 1-1.4 0l-8-8A1 1 0 0 1 4 11.5Z"/><circle cx="8.5" cy="8.5" r="1.3"/>',
  gift: '<rect x="4" y="9.5" width="16" height="10.5" rx="1"/><path d="M4 13.5h16M12 9.5v10.5"/><path d="M12 9.5c-1-3-3-4.5-4.5-3.5S6.5 9.5 12 9.5c5.5 0 5-2.5 3.5-3.5S13 6.5 12 9.5Z"/>',
  history: '<path d="M4 12a8 8 0 1 1 2.6 5.9"/><path d="M4 8v4h4"/><path d="M12 8v4l3 2"/>',
  headset: '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.3"/><rect x="17" y="13" width="4" height="6" rx="1.3"/><path d="M20 19a4 4 0 0 1-4 3h-2"/>',
  logout: '<path d="M9 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h3"/><path d="M13 8l4 4-4 4M17 12H9"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
};

/** Render an icon. An unknown name falls back to the neutral mark. */
export function icon(name: string, size = 24): RawHtml {
  const body = PATHS[name] ?? PATHS['generic'] ?? '';
  return raw(
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
      `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`,
  );
}

/** Icon for a sport category, by the id KOVR assigned it. */
export function categoryIcon(categoryId: string, size = 24): RawHtml {
  const known: Readonly<Record<string, string>> = {
    combat: 'combat',
    football: 'football',
    basketball: 'basketball',
    baseball: 'baseball',
    hockey: 'hockey',
    soccer: 'soccer',
    tennis: 'tennis',
    golf: 'golf',
    motorsport: 'motorsport',
    cricket: 'cricket',
    rugby: 'rugby',
  };
  return icon(known[categoryId] ?? 'generic', size);
}

/**
 * The KOVR mark: a bold K split white and red, crossed by the brand swoosh.
 * Drawn to fit the viewBox exactly so it never clips at small sizes.
 */
export function brandMark(size = 26): RawHtml {
  return raw(
    `<svg class="brand__mark" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">` +
      `<defs>` +
      `<linearGradient id="kovrRed" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0%" stop-color="#FF2A38"/><stop offset="100%" stop-color="#96070F"/></linearGradient>` +
      `<linearGradient id="kovrWhite" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#AEB3BC"/></linearGradient>` +
      `</defs>` +
      `<path d="M12 6h13v52H12z" fill="url(#kovrWhite)"/>` +
      `<path d="M27 32 49 6h13L38 32z" fill="url(#kovrRed)"/>` +
      `<path d="M38 32 62 58H49L27 32z" fill="url(#kovrRed)"/>` +
      `<path d="M4 47c15-12 34-18 57-19v6C40 35 21 42 6 51z" fill="#E8121F"/>` +
      `</svg>`,
  );
}
