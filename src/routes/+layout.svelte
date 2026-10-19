<script lang="ts">
  import '../app.css';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import TopBar from '$lib/components/TopBar.svelte';
  import NavDrawer from '$lib/components/NavDrawer.svelte';
  import PWAInstall from '$lib/components/PWAInstall.svelte';
  import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';

  let { data, children } = $props();

  let scrollEl = $state<HTMLElement | null>(null);

  // .app-scroll ist ein eigener Scroll-Container im Layout — weder Browser
  // noch SvelteKit setzen ihn bei Navigation zurück (Scroll-Restoration
  // funktioniert nur auf window). Ohne Eingriff bliebe die alte Position
  // stehen: Rezept-Öffnen startete mitten auf der Seite statt oben.
  // Eigene Restore-Logik: Position vor dem Wegnavigieren merken (pro Pfad),
  // bei neuen Navigationen nach oben, bei Back/Forward wiederherstellen.
  const scrollPositions = new Map<string, number>();

  beforeNavigate((nav) => {
    if (scrollEl && nav.from?.url.pathname) {
      scrollPositions.set(nav.from.url.pathname, scrollEl.scrollTop);
    }
  });

  afterNavigate((nav) => {
    if (!scrollEl) return;
    const top =
      nav.type === 'popstate'
        ? scrollPositions.get(nav.to?.url.pathname ?? '') ?? 0
        : 0;
    scrollEl.scrollTo({ top });
    // War der Inhalt beim Restore noch nicht fertig layoutet (Lazy-Bilder),
    // konnte der Browser nur bis zur damaligen Maximalposition scrollen —
    // einmalig im nächsten Frame nachziehen.
    requestAnimationFrame(() => scrollEl?.scrollTo({ top }));
  });
</script>

<OfflineIndicator />
<TopBar categories={data.categories} />
<!--
  Vollheight-Flex-Layout: body ist display:flex/flex-direction:column.
  TopBar oben (nimmt ihren Platz + Safe-Area selbst), .app-scroll füllt
  den Rest und scrollt eigenständig → die Scrollbar beginnt unter dem
  Header. Höhe läuft rein über Flex, keine manuelle Viewport-Arithmetik
  (die auf iOS standalone mit black-translucent abgeschnitten hat).
-->
<div class="app-scroll" bind:this={scrollEl}>
  {@render children()}
</div>
<NavDrawer categories={data.categories} />
<PWAInstall />

<style>
  .app-scroll {
    /* Flex-Child von body: nimmt den Platz unter der TopBar ein. */
    flex: 1;
    min-height: 0; /* erlaubt dem Inhalt zu scrollen statt die Column
                      wachsen zu lassen */
    overflow-y: auto;
    overflow-x: hidden;
    /* Luft zwischen Header und erstem Inhalt (wirkt app-weit). */
    padding-top: 12px;
  }
</style>
