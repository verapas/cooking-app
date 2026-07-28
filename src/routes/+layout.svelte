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
{@render children()}
<NavDrawer categories={data.categories} />
<PWAInstall />
