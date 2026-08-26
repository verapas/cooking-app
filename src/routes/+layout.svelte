<script lang="ts">
  import '../app.css';
  import TopBar from '$lib/components/TopBar.svelte';
  import NavDrawer from '$lib/components/NavDrawer.svelte';
  import PWAInstall from '$lib/components/PWAInstall.svelte';
  import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';

  let { data, children } = $props();
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
<div class="app-scroll">
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
