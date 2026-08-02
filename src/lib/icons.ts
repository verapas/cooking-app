// === SVG-Icon-Registry ===
// Linien-Icons (24x24, stroke=currentColor, stroke-width=2). Ein zentraler Ort
// für alle UI-Icons. In `Icon.svelte` via `{@html}` gerendert.
// Kategorie-Icons (Suppen, Pasta, …) sind hier ebenfalls gelistet, damit das
// `icon`-Feld einer Kategorie wahlweise einen dieser Keys (→ SVG) ODER ein
// rohes Emoji (→ Text-Fallback) enthalten kann (siehe `CategoryIcon.svelte`).

export const icons = {
  // Marke & Navigation
  pot: '<path d="M5 10h14"/><path d="M5 10v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/><path d="M3 10h2"/><path d="M19 10h2"/><path d="M9 7c0-1 1-1 1-2s-1-1-1-2"/><path d="M14 7c0-1 1-1 1-2s-1-1-1-2"/>',
  home: '<path d="m3 9.5 9-6.5 9 6.5"/><path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M9.5 21v-6h5v6"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  lock: '<rect x="4.5" y="11" width="15" height="9.5" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',

  // Richtung & Status
  back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  forward: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  play: '<path d="m7 4 12 8-12 8z"/>',
  pause: '<rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 3v4h4"/>',
  warning: '<path d="M12 3 22 20 2 20z"/><path d="M12 9v5"/><path d="M12 17.5h.01"/>',
  hourglass: '<path d="M6 3h12"/><path d="M6 21h12"/><path d="M6 3c0 4 3.5 5 6 7 2.5-2 6-3 6-7"/><path d="M6 21c0-4 3.5-5 6-7 2.5 2 6 3 6 7"/>',

  // Medien & Eingaben
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  note: '<path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M8.5 13h7"/><path d="M8.5 16.5h4.5"/>',
  trash: '<path d="M3.5 6h17"/><path d="M8.5 6V4.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1V6"/><path d="M18.5 6l-1 13a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8L5.5 6"/><path d="M10 10.5v6"/><path d="M14 10.5v6"/>',
  image: '<rect x="3" y="3.5" width="18" height="17" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-7.5 7.5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10.5 18.5h3"/>',
  settings: '<path d="M4 7h7"/><path d="M15 7h5"/><circle cx="13" cy="7" r="2.2"/><path d="M4 17h3"/><path d="M11 17h9"/><circle cx="9" cy="17" r="2.2"/>',

  // Rezept-Ansicht
  book: '<path d="M12 7v13"/><path d="M2 5.5A2 2 0 0 1 4 3.5h6V19H4a2 2 0 0 1-2-2z"/><path d="M22 5.5A2 2 0 0 0 20 3.5h-6V19h6a2 2 0 0 0 2-2z"/>',
  list: '<path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2.5 3.5h2.2l2.1 11.6a1.8 1.8 0 0 0 1.8 1.5h8.4a1.8 1.8 0 0 0 1.8-1.4l1.4-7.2H6"/>',
  chef: '<path d="M6 19h12"/><path d="M6.5 19v-3.2A4.2 4.2 0 0 1 5 8.2 4.4 4.4 0 0 1 12.5 5 4.4 4.4 0 0 1 19 8.2a4.2 4.2 0 0 1-1.5 7.6V19"/>',
  timer: '<path d="M10 2.5h4"/><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.8 1.6"/>',
  users: '<path d="M15 20v-1.5a4 4 0 0 0-4-4H6.5a4 4 0 0 0-4 4V20"/><circle cx="8.75" cy="7.5" r="3.5"/><path d="M20.5 20v-1.5a4 4 0 0 0-3-3.8"/><path d="M14.5 4.2a4 4 0 0 1 0 7.6"/>',
  celebrate: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',

  // Essen / Kategorie-Icons
  soup: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M3 11h18"/><path d="M9 7c0-1 1-1 1-2s-1-1-1-2"/><path d="M13 7c0-1 1-1 1-2s-1-1-1-2"/>',
  salad: '<path d="M3 11h18l-1.2 2.2A8 8 0 0 1 13 17.5h-2A8 8 0 0 1 4.2 13.2z"/><path d="M9 7c1.5-1.5 4-1 5 1.5"/><path d="M13 5c1.5-1 3.5-.5 4 1.5"/>',
  bread: '<path d="M6 9a3.5 3.5 0 0 1 3.5-3.5h5A3.5 3.5 0 0 1 18 9v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9.5 9v11"/><path d="M14.5 9v11"/>',
  pasta: '<path d="M3 11h18"/><path d="M4.5 11a7.5 7.5 0 0 0 15 0"/><path d="M9 3v8"/><path d="M12 3v8"/><path d="M15 3v8"/>',
  plate: '<path d="M4 4v6.5a3 3 0 0 0 3 3 3 3 0 0 0 3-3V4"/><path d="M7 13.5V20"/><path d="M17.5 14.5c-1.7 0-3.5-1.8-3.5-4.8 0-3.5 1.8-7.2 3.5-7.2s3.5 3.7 3.5 7.2c0 3-1.8 4.8-3.5 4.8z"/><path d="M17.5 14.5V20"/>',
  cake: '<path d="M4 20h16v-6.5a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3z"/><path d="M4 14.5c1.8 0 1.8 1.7 3.5 1.7s1.7-1.7 3.5-1.7 1.8 1.7 3.5 1.7 1.7-1.7 3.5-1.7"/><path d="M12 7.5V5"/><path d="M12 4.5h.01"/>',
  snack: '<circle cx="12" cy="12" r="8.2"/><path d="M8.5 9.5h.01" stroke-width="2.6"/><path d="M13.5 8.5h.01" stroke-width="2.6"/><path d="M15 13h.01" stroke-width="2.6"/><path d="M9.5 14.5h.01" stroke-width="2.6"/>'
} as const satisfies Record<string, string>;

export type IconName = keyof typeof icons;

export function isIconKey(value: unknown): value is IconName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(icons, value);
}
