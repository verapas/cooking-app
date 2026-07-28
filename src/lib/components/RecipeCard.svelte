<script lang="ts">
  import type { RecipeListItem } from '$lib/types';

  let { recipe }: { recipe: RecipeListItem } = $props();

  let totalMin = $derived(
    (recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0)
  );

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

<a class="card recipecard" href="/recipe/{recipe.id}">
  <div class="thumb">
    {#if recipe.image_url}
      <img src={recipe.image_url} alt="" loading="lazy" />
    {:else}
      <div class="thumb-emoji" aria-hidden="true">🍽️</div>
    {/if}
  </div>
  <div class="body">
    {#if recipe.category_name}
      <span class="catchip">{recipe.category_name}</span>
    {/if}
    <h3 class="title">{recipe.title}</h3>
    <div class="meta">
      {#if totalMin > 0}<span>⏱ {formatTime(totalMin)}</span>{/if}
      <span>👥 {recipe.base_servings}</span>
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

  .thumb-emoji {
    font-size: 2.6rem;
    opacity: 0.85;
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
</style>
