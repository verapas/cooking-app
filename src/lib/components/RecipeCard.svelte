<script lang="ts">
  import type { RecipeListItem } from '$lib/types';
  import { untrack } from 'svelte';
  import { handleUnauthorized } from '$lib/api';
  import Icon from './Icon.svelte';

  let {
    recipe,
    onPinChange
  }: {
    recipe: RecipeListItem;
    /** Optionale Rückmeldung an die Liste: Karte live umsortieren. */
    onPinChange?: (id: number, pinned: boolean) => void;
  } = $props();

  let totalMin = $derived(
    (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0)
  );

  let isFavorite = $state(untrack(() => recipe.is_favorite));
  let isOptimistic = $state(false);
  let isPinned = $state(untrack(() => recipe.is_pinned));
  let pinOptimistic = $state(false);

  async function toggleFavorite(e: Event) {
    e.preventDefault();
    e.stopPropagation();

    const newFavorite = !isFavorite;
    isOptimistic = true;
    isFavorite = newFavorite;

    try {
      const res = await fetch(`/api/recipes/${recipe.id}/favorite`, {
        method: 'POST',
        credentials: 'include'
      });

      if (handleUnauthorized(res)) return;
      if (!res.ok) {
        isFavorite = !newFavorite;
      }
    } catch {
      isFavorite = !newFavorite;
    } finally {
      isOptimistic = false;
    }
  }

  async function togglePin(e: Event) {
    e.preventDefault();
    e.stopPropagation();

    const newPinned = !isPinned;
    pinOptimistic = true;
    isPinned = newPinned;
    onPinChange?.(recipe.id, newPinned);

    try {
      const res = await fetch(`/api/recipes/${recipe.id}/pin`, {
        method: 'POST',
        credentials: 'include'
      });

      if (handleUnauthorized(res)) return;
      if (!res.ok) {
        isPinned = !newPinned;
        onPinChange?.(recipe.id, !newPinned);
      }
    } catch {
      isPinned = !newPinned;
      onPinChange?.(recipe.id, !newPinned);
    } finally {
      pinOptimistic = false;
    }
  }

  function formatTime(m: number): string {
    if (m <= 0) return '';
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const rest = m % 60;
      return rest ? `${h}h ${rest}m` : `${h}h`;
    }
    return `${m} min`;
  }
</script>

<a class="card recipecard" class:pinned={isPinned} href="/recipe/{recipe.id}">
  <div class="thumb">
    {#if recipe.image_url}
      <img src={recipe.image_url} alt="" loading="lazy" />
    {:else}
      <div class="thumb-icon" aria-hidden="true"><Icon name="plate" size={56} /></div>
    {/if}
    <button
      class="pin-btn"
      class:pin-active={isPinned}
      aria-label={isPinned ? 'Pin lösen' : 'Rezept anpinnen'}
      onclick={togglePin}
    >
      <Icon name="pin" size={18} filled={isPinned} />
    </button>
    <button
      class="fav-btn"
      class:fav-active={isFavorite}
      aria-label={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
      onclick={toggleFavorite}
    >
      <Icon name="star" size={18} filled={isFavorite} />
    </button>
  </div>
  <div class="body">
    {#if recipe.category_name}
      <span class="catchip">{recipe.category_name}</span>
    {/if}
    <h3 class="title">{recipe.title}</h3>
    <div class="meta">
      {#if totalMin > 0}<span class="meta-item"><Icon name="timer" size={14} /> {formatTime(totalMin)}</span>{/if}
      <span class="meta-item"><Icon name="users" size={14} /> {recipe.base_servings}</span>
    </div>
  </div>
</a>

<style>
  .recipecard {
    display: block;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    transition: transform 0.08s ease, border-color 0.15s ease;
  }

  .recipecard:active {
    transform: scale(0.98);
  }

  /* Angepinnt („heute kochen"): volle Breite über alle Grid-Spalten,
     horizontal.layoutet (Bild links, Inhalt rechts) — prägnanter als
     die normalen Karten. Orange wie immer aus --accent (#ff7a3d aus
     app.css); die rgba-Werte entsprechen ihm für Verläufe. */
  .recipecard.pinned {
    grid-column: 1 / -1;
    display: flex;
    align-items: stretch;
    border-color: var(--accent);
    /* Buttons an der Karte verankern (rechts), nicht am Bild (links) */
    position: relative;
    /* Feste Höhe, unabhängig vom Bildformat: Basis ist die Höhe einer
       normalen Karte (Thumb-Anteil = Spaltenbreite × 3/4; 2 Spalten:
       Grid = 100vw − 32px Padding − 14px Gap → Faktor 3/8, plus Body),
       davon 2/3 — die Pin-Karte bleibt eine Zeile niedriger. */
    height: calc(((100vw - 46px) * 3 / 8 + 106px) * 2 / 3);
  }

  @media (min-width: 560px) {
    .recipecard.pinned {
      /* 3 Spalten: Spaltenbreite = (Grid − 2×14px Gap)/3 → Thumb-Höhe
         = Grid/4, plus Body; ebenfalls 2/3. Grid auf 608px gedeckelt. */
      height: calc(((min(100vw - 32px, 608px) - 28px) / 4 + 106px) * 2 / 3);
    }
  }

  .recipecard.pinned .thumb {
    flex: 0 0 40%;
    aspect-ratio: auto;
    /* static, damit Pin/Stern-Buttons (absolute) zur Karte anklebern
       statt zum Thumb — sie rutschen so an den rechten Kartenrand. */
    position: static;
  }

  .recipecard.pinned .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 14px 16px;
    background: linear-gradient(90deg, rgba(255, 122, 61, 0.16), rgba(255, 122, 61, 0.04) 60%, transparent);
  }

  .recipecard.pinned .title {
    font-size: 1.12rem;
  }

  .thumb {
    position: relative;
    aspect-ratio: 4 / 3;
    background: linear-gradient(135deg, var(--surface-3), var(--surface-2));
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb-icon {
    color: var(--text-faint);
    opacity: 0.8;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fav-btn,
  .pin-btn {
    position: absolute;
    top: 8px;
    background: rgba(15, 12, 8, 0.85);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-sm);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-dim);
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .fav-btn:hover,
  .pin-btn:hover {
    transform: scale(1.05);
    background: rgba(15, 12, 8, 0.95);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .fav-btn:active,
  .pin-btn:active {
    transform: scale(0.95);
  }

  .fav-btn {
    right: 8px;
  }

  .pin-btn {
    /* Direkt links neben dem Favoriten-Stern (32px Button + 8px Abstand) */
    right: 48px;
  }

  .fav-btn.fav-active {
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.3);
  }

  .pin-btn.pin-active {
    color: var(--accent);
    border-color: rgba(255, 122, 61, 0.45);
  }

  .body {
    padding: 10px 12px 12px;
  }

  .catchip {
    display: inline-block;
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--accent);
    margin-bottom: 2px;
  }

  .title {
    font-size: 0.98rem;
    margin: 0 0 6px;
    /* 2 Zeilen clamp */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .meta {
    display: flex;
    gap: 10px;
    font-size: 0.78rem;
    color: var(--text-dim);
  }
  .meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
</style>
