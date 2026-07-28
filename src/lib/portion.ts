// === Portionen-Skalierung & Formatierung ===
import type { Ingredient } from './types';

/** Skalierungsfaktor aus Basis- und gewählten Portionen. */
export function scaleFactor(baseServings: number, servings: number): number {
  if (!baseServings || baseServings <= 0) return 1;
  return servings / baseServings;
}

/**
 * Formatiert eine (ggf. skalierte) Menge hübsch.
 * - null/0 → '' (z. B. „nach Geschmack" – Menge wird weggelassen)
 * - < 10  → gerundet auf Viertel (0.25 / 0.5 / 0.75)
 * - ≥ 10  → ganzzahlig
 */
export function formatQuantity(quantity: number | null | undefined, factor = 1): string {
  if (quantity == null || quantity === 0) return '';
  const scaled = quantity * factor;
  if (scaled === 0) return '';

  if (Number.isInteger(scaled)) return String(scaled);

  if (scaled < 10) {
    const r = Math.round(scaled * 4) / 4; // auf Viertel
    return String(r);
  }
  return String(Math.round(scaled));
}

/** „100 g Mehl" / „2 Stück Eier" / „Pfeffer (nach Geschmack)". */
export function formatIngredient(ing: Ingredient, factor: number): string {
  const q = formatQuantity(ing.quantity, factor);
  const unit = ing.unit?.trim() ?? '';
  if (!q) {
    return unit ? `${ing.name} (${unit})` : ing.name;
  }
  return unit ? `${q} ${unit} ${ing.name}` : `${q} ${ing.name}`;
}

/** Sekunden → „10 Min." / „45 Sek.". */
export function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return '';
  if (sec >= 60) return `${Math.round(sec / 60)} Min.`;
  return `${sec} Sek.`;
}
