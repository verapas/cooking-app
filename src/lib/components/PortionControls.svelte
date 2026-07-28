<script lang="ts">
  let {
    baseServings,
    servings = $bindable()
  }: {
    baseServings: number;
    servings: number;
  } = $props();

  function dec() {
    servings = Math.max(1, servings - 1);
  }
  function inc() {
    servings = Math.min(50, servings + 1);
  }
</script>

<div class="portions">
  <div class="left">
    <span class="lab">Portionen</span>
    {#if servings !== baseServings}
      <span class="base">(Basis: {baseServings})</span>
    {/if}
  </div>
  <div class="ctrl">
    <button
      class="btn round"
      onclick={dec}
      aria-label="Weniger Portionen"
      disabled={servings <= 1}
    >
      −
    </button>
    <span class="num" aria-live="polite">{servings}</span>
    <button
      class="btn round"
      onclick={inc}
      aria-label="Mehr Portionen"
      disabled={servings >= 50}
    >
      +
    </button>
  </div>
</div>

<style>
  .portions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    margin-top: 14px;
  }
  .left {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .lab {
    color: var(--text-dim);
    font-size: 0.95rem;
  }
  .base {
    color: var(--text-faint);
    font-size: 0.8rem;
  }
  .ctrl {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .round {
    min-width: 42px;
    height: 42px;
    padding: 0;
    border-radius: 999px;
    font-size: 1.4rem;
    line-height: 1;
  }
  .num {
    font-size: 1.4rem;
    font-weight: 700;
    min-width: 1.5em;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
</style>
