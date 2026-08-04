<script lang="ts">
  import '../app.css';
  import TopBar from '$lib/components/TopBar.svelte';
  import NavDrawer from '$lib/components/NavDrawer.svelte';
  import PWAInstall from '$lib/components/PWAInstall.svelte';
  import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';

  let { data, children } = $props();
</script>

<OfflineIndicator />
<TopBar />
<!--
  Vollheight-Flex-Layout: TopBar oben (feste 56px), Inhalt darunter
  scrollt eigenständig → die Scrollbar beginnt unter dem Header statt
  über die volle Seitenhöhe zu laufen.
-->
<div class="app-scroll">
  {@render children()}
</div>
<NavDrawer categories={data.categories} />
<PWAInstall />

<style>
  .app-scroll {
    /* Höhe = Viewport minus TopBar-Höhe (56px). */
    height: calc(100vh - 56px);
    height: calc(100dvh - 56px);
    overflow-y: auto;
    overflow-x: hidden;
    /* Luft zwischen Header und erstem Inhalt (wirkt app-weit). */
    padding-top: 12px;
  }
</style>
