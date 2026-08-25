<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
</script>

<svelte:head>
  <title>Einstellungen – Koch-App</title>
</svelte:head>

<main class="container settings">
  <a href="/" class="back-link"><Icon name="back" size={16} /> Zurück</a>

  <h1>Einstellungen</h1>
  <p class="dim">Wähle einen Bereich aus:</p>

  <div class="options">
    <a href="/settings/ai" class="option">
      <span class="ic ic-ai"><Icon name="sparkles" size={24} /></span>
      <span class="txt">
        <span class="title">KI-Einstellungen</span>
        <span class="sub">Anbieter, Modell &amp; API-Key für den Rezept-Assistenten</span>
      </span>
      <span class="go"><Icon name="forward" size={18} /></span>
    </a>

    <a href="/settings/tools" class="option">
      <span class="ic"><Icon name="pot" size={24} /></span>
      <span class="txt">
        <span class="title">Küchenutensilien</span>
        <span class="sub">Was steht in deiner Küche? Die KI berücksichtigt es beim Vorschlagen von Rezepten</span>
      </span>
      <span class="go"><Icon name="forward" size={18} /></span>
    </a>
  </div>
</main>

<style>
  .settings {
    padding-top: 16px;
  }
  .settings h1 {
    margin-top: 14px;
  }
  .dim {
    color: var(--dim);
    margin-bottom: 16px;
  }
  .options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    text-decoration: none;
    color: var(--text);
    transition: border-color 0.15s ease;
  }
  .option:hover {
    border-color: var(--accent);
  }
  .ic {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--accent);
  }
  .ic-ai {
    color: var(--accent);
  }
  .txt {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .title {
    font-weight: 600;
    font-size: 1.05rem;
  }
  .sub {
    font-size: 0.85rem;
    color: var(--dim);
  }
  .go {
    margin-left: auto;
    color: var(--dim);
    display: inline-flex;
    flex-shrink: 0;
  }
  .option:hover .go {
    color: var(--accent);
  }
</style>
