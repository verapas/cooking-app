<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { playBeep, unlockAudio, vibrate } from '$lib/sound';
  import { releaseWakeLock, requestWakeLock } from '$lib/wakeLock';
  import Icon from './Icon.svelte';

  let {
    durationSec,
    onDone
  }: {
    durationSec: number;
    onDone?: () => void;
  } = $props();

  // Dauer ist für diese Instanz fest → bewusst nur Initialwert (untrack).
  let remaining = $state(untrack(() => durationSec));
  let running = $state(false);
  let finished = $state(false);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  let display = $derived(fmt(remaining));
  // Kreis-Fortschritt: 0 = voll, 1 = leer
  let progress = $derived(durationSec > 0 ? 1 - remaining / durationSec : 0);
  const R = 44;
  const CIRC = 2 * Math.PI * R;

  function fmt(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function tick(): void {
    if (remaining <= 1) {
      remaining = 0;
      stopInterval();
      finished = true;
      running = false;
      releaseWakeLock();
      playBeep();
      vibrate([400, 150, 400]);
      onDone?.();
    } else {
      remaining -= 1;
    }
  }

  function start(): void {
    if (running || finished) return;
    unlockAudio(); // Autoplay-Policy: aus Nutzer-Geste entsperren
    running = true;
    void requestWakeLock();
    intervalId = setInterval(tick, 1000);
  }
  function pause(): void {
    running = false;
    stopInterval();
    void releaseWakeLock();
  }
  function stopInterval(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
  function reset(): void {
    stopInterval();
    running = false;
    finished = false;
    remaining = durationSec;
    void releaseWakeLock();
  }

  onDestroy(() => {
    stopInterval();
    void releaseWakeLock();
  });
</script>

<div class="timer" class:finished class:running>
  <div class="ring">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle class="track" cx="50" cy="50" r={R} />
      <circle
        class="prog"
        cx="50"
        cy="50"
        r={R}
        stroke-dasharray={CIRC}
        stroke-dashoffset={CIRC * (1 - progress)}
      />
    </svg>
    <div class="time">{display}</div>
  </div>

  <div class="actions">
    {#if finished}
      <span class="done"><Icon name="check" size={18} /> Zeit ist um!</span>
      <button class="btn" onclick={reset}><Icon name="restart" size={18} /> Zurücksetzen</button>
    {:else if running}
      <button class="btn" onclick={pause}><Icon name="pause" size={18} /> Pause</button>
    {:else}
      <button class="btn btn-primary bigbtn" onclick={start}>
        <Icon name="play" size={18} filled /> {remaining < durationSec ? 'Weiter' : 'Timer starten'}
      </button>
      {#if remaining < durationSec}
        <button class="btn" onclick={reset} aria-label="Zurücksetzen"><Icon name="restart" size={18} /></button>
      {/if}
    {/if}
  </div>
</div>

<style>
  .timer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 16px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 16px;
  }
  .ring {
    position: relative;
    width: 130px;
    height: 130px;
  }
  .ring svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }
  .track {
    fill: none;
    stroke: var(--surface-3);
    stroke-width: 8;
  }
  .prog {
    fill: none;
    stroke: var(--accent);
    stroke-width: 8;
    stroke-linecap: round;
    transition: stroke-dashoffset 1s linear;
  }
  .timer.finished .prog {
    stroke: var(--success);
  }
  .time {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .timer.finished .time {
    color: var(--success);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .done {
    color: var(--success);
    font-weight: 600;
  }
  .bigbtn {
    padding-left: 24px;
    padding-right: 24px;
  }
</style>
