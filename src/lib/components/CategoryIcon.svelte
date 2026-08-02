<script lang="ts">
  import Icon from './Icon.svelte';
  import { isIconKey, type IconName } from '$lib/icons';

  let {
    icon,
    size = 24
  }: {
    icon: string | null | undefined;
    size?: number | string;
  } = $props();

  let isSvg = $derived(isIconKey(icon));
</script>

{#if isSvg}
  <Icon name={icon as IconName} {size} />
{:else if icon}
  <span class="emoji">{icon}</span>
{:else}
  <Icon name="list" {size} />
{/if}

<style>
  .emoji {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
</style>
