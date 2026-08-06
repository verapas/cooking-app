import type { Handle } from '@sveltejs/kit';
import { seedCategoriesIfEmpty } from '$lib/server/seed';

// === Server-Hook ===
//
// Kein App-Login mehr — der Zugriffsschutz liegt auf Infrastrukturebene
// (Reverse Proxy / VPN / internes Netz), siehe README. Dieser Hook macht
// nur noch zwei Dinge:
//   1. Beim allerersten Request die Standard-Kategorien anlegen
//      (idempotent — nur wenn die Tabelle leer ist).
//   2. Die Anfrage durchreichen.
let categoriesSeeded = false;

export const handle: Handle = async ({ event, resolve }) => {
  if (!categoriesSeeded) {
    categoriesSeeded = true;
    try {
      await seedCategoriesIfEmpty();
    } catch (err) {
      // Falls die DB noch nicht bereit ist, nicht den ganzen Request
      // abwürgen — der nächste Versuch klappt dann.
      console.error('Kategorien-Seed fehlgeschlagen:', err);
    }
  }
  return resolve(event);
};
