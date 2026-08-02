<script lang="ts">
  import { icons, type IconName } from '$lib/icons';

  let {
    name,
    size = 24,
    filled = false,
    class: cls = ''
  }: {
    name: IconName;
    size?: number | string;
    filled?: boolean;
    class?: string;
  } = $props();
</script>

<svg
  class="icon {cls}"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={filled ? 'currentColor' : 'none'}
  stroke={filled ? 'none' : 'currentColor'}
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {@html icons[name]}
</svg>

<style>
  .icon {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
  }
</style>
