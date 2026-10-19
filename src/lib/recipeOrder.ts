// === Pin-Reihenfolge im Client (Live-Reorder) ===
//
// Beim Anpinnen/Lösen wird die Liste sofort umsortiert, damit die Karte
// sichtbar nach oben rutscht — ohne die Server-Sortierung komplett
// nachzubauen. Beim nächsten Laden sortiert der Server ohnehin neu
// (queries.ts: is_pinned → pinned_at → is_favorite → Titel).

import type { RecipeListItem } from './types';

/**
 * Setzt den Pin-Zustand eines Rezepts in der Liste und verschiebt die
 * Karte an die passende Stelle: Pin → ganz nach oben (neuester Pin
 * zuerst, wie der Server), Lösen → an den Anfang des ungepinnten
 * Blocks, direkt unter den verbleibenden Pins.
 */
export function applyPinReorder(
  list: RecipeListItem[],
  id: number,
  pinned: boolean
): RecipeListItem[] {
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return list;

  const item: RecipeListItem = {
    ...list[idx],
    is_pinned: pinned,
    pinned_at: pinned ? new Date().toISOString() : null
  };
  const rest = list.filter((r) => r.id !== id);

  if (pinned) {
    rest.unshift(item);
  } else {
    const firstUnpinned = rest.findIndex((r) => !r.is_pinned);
    rest.splice(firstUnpinned === -1 ? rest.length : firstUnpinned, 0, item);
  }
  return rest;
}
