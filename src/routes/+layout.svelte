<script lang="ts">
  import '../app.css';
  import TopBar from '$lib/components/TopBar.svelte';
  import NavDrawer from '$lib/components/NavDrawer.svelte';

  let { data, children } = $props();
</script>

<TopBar />
{@render children()}
<NavDrawer categories={data.categories} />
