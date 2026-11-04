<script lang="ts">
  import { page } from '$app/state';
  import { toggleDrawer } from '$lib/nav.svelte';
  import { alarm, fmtCountdown, silenceAlarm, stopRunningTimer } from '$lib/alarm.svelte';
  import CategoryIcon from './CategoryIcon.svelte';
  import Icon from './Icon.svelte';
  import type { Category } from '$lib/types';

  let { categories = [] }: { categories?: Category[] } = $props();

  // Zeigt den aktuell in der Navigation ausgewählten Punkt (wie NavDrawer).
  // CategoryIcon rendert Icon-Registry-Keys UND Kategorie-Emojis — deshalb
  // einheitlich für feste Nav-Icons und Kategorien nutzbar.
  let current = $derived.by(() => {
    const path = page.url.pathname;
    if (path === '/favorites') return { label: 'Favoriten', icon: 'star' };
    if (path.startsWith('/public')) return { label: 'Öffentlich', icon: 'globe' };
    if (path === '/chat') return { label: 'Neues Rezept (KI)', icon: 'sparkles' };
    if (path === '/settings/ai') return { label: 'KI-Einstellungen', icon: 'sparkles' };
    if (path === '/settings/tools') return { label: 'Küchenutensilien', icon: 'pot' };
    if (path.startsWith('/settings')) return { label: 'Einstellungen', icon: 'settings' };
    if (path.startsWith('/category/')) {
      const slug = decodeURIComponent(path.split('/')[2] ?? '');
      const cat = categories.find((c) => c.slug === slug);
      if (cat) return { label: cat.name, icon: cat.icon };
    }
    // Fallback (Startseite + Seiten ohne eigenen Nav-Punkt, z. B. Rezept-Detail)
    return { label: 'Alle Rezepte', icon: 'home' };
  });

  // Restzeit des laufenden Timers (der Watcher in alarm.svelte.ts tickt
  // `alarm.now` im Halbssekundentakt, solange ein Timer läuft)
  let runningRemaining = $derived(
    alarm.running ? Math.max(0, Math.ceil((alarm.running.endAt - alarm.now) / 1000)) : 0
  );
  const runningDisplay = $derived(fmtCountdown(runningRemaining));
</script>

<header class="topbar">
  <button
    class="burger"
    onclick={toggleDrawer}
    aria-label="Menü öffnen"
    aria-haspopup="true"
  >
    <span></span><span></span><span></span>
  </button>
  <span class="title">
    <span class="logo"><CategoryIcon icon={current.icon} size={20} /></span>
    {current.label}
  </span>
  {#if alarm.running}
    <span class="runningtimer" title={alarm.running.label || 'Timer läuft'}>
      <span class="rt-time"><Icon name="timer" size={14} /> {runningDisplay}</span>
      <button
        class="rt-stop"
        onclick={stopRunningTimer}
        aria-label="Timer stoppen"
        title="Timer stoppen"
      >
        <Icon name="stop" size={12} filled />
      </button>
    </span>
  {/if}
  {#if alarm.ringing}
    <button
      class="alarm"
      onclick={silenceAlarm}
      aria-label="Timer-Alarm ausschalten"
      title="Timer ausschalten"
    >
      <Icon name="timer" size={24} />
    </button>
  {/if}
</header>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 12px;
    /* Content-Höhe bleibt 56px; der Notch (safe-area-inset-top) kommt
       ZUSÄTZLICH oben drauf statt in die 56px gequetscht zu werden
       (deshalb content-box, nicht border-box wie global sonst). */
    box-sizing: content-box;
    height: 56px;
    padding: 0 12px;
    padding-top: env(safe-area-inset-top);
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .burger {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: var(--tap);
    height: var(--tap);
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 10px;
    flex-shrink: 0;
  }
  .burger span {
    display: block;
    width: 22px;
    height: 2px;
    background: var(--text);
    border-radius: 2px;
  }
  .title {
    font-weight: 700;
    font-size: 1.05rem;
    color: var(--text);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    /* Lange Titel (Kategorie-/Seitennamen) sauber abschneiden statt umbrechen */
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .logo {
    color: var(--accent);
    display: inline-flex;
    flex-shrink: 0;
  }
  .runningtimer {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .rt-time {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border: 1px solid var(--accent);
    border-radius: 999px;
    color: var(--accent);
    font-size: 0.82rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .rt-stop {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: none;
    background: var(--accent);
    color: var(--surface);
    cursor: pointer;
    flex-shrink: 0;
  }
  .rt-stop:active {
    opacity: 0.6;
  }
  .alarm {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--tap);
    height: var(--tap);
    padding: 10px;
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    flex-shrink: 0;
    animation: wobble 0.5s ease-in-out infinite;
    transform-origin: 50% 60%;
  }
  .alarm:active {
    opacity: 0.6;
  }
  @keyframes wobble {
    0%, 100% { transform: rotate(-14deg); }
    50% { transform: rotate(14deg); }
  }
</style>
