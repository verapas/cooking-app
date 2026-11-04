<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { playBeep, unlockAudio, vibrate } from '$lib/sound';
  import { releaseWakeLock, requestWakeLock } from '$lib/wakeLock';
  import { ensureNotificationPermission, notifyTimerDone } from '$lib/notify';
  import Icon from './Icon.svelte';

  let {
    durationSec,
    stepId,
    label,
    onDone
  }: {
    durationSec: number;
    stepId: number;
    label?: string;
    onDone?: () => void;
  } = $props();

  // Wichtig: Der Timer zählt nicht mehr „eine Sekunde pro Tick" herunter
  // (das stirbt, wenn das OS den Tab einfriert), sondern rechnet jeden
  // Tick gegen eine absolute Ziel-Uhrzeit (`endAt`). Kommende Tab aus dem
  // Hintergrund zurück, stimmt die Restzeit sofort wieder. Zusätzlich wird
  // der Zustand in der sessionStorage geparkt, damit der Timer das
  // Navigieren innerhalb der App überlebt.

  // Key wandert mit stepId mit (Schrittwechsel → anderer Speicherplatz);
  // im $effect-Zweig nicht vorzeitig lesen, daher Funktion statt Konstante
  let STORE_KEY = $derived(`step-timer:${stepId}`);

  interface StoredTimer {
    endAt: number; // Ziel-Zeitpunkt (epoch ms); 0 = pausiert
    remaining: number; // Restzeit beim Pause-Stopp
    total: number; // Grunddauer für den Kreis
    finished: boolean;
  }

  let total = $state(untrack(() => durationSec));
  let endAt = $state<number | null>(null); // laufend: Ziel-Timestamp; pausiert: null
  let pausedRemaining = $state<number | null>(null);
  let finished = $state(false);
  let now = $state(Date.now());
  let intervalId: ReturnType<typeof setInterval> | null = null;

  let remaining = $derived(
    endAt !== null ? Math.max(0, Math.ceil((endAt - now) / 1000)) : (pausedRemaining ?? total)
  );
  let running = $derived(endAt !== null);
  let display = $derived(fmt(remaining));
  // Kreis-Fortschritt: 0 = voll, 1 = leer
  let progress = $derived(total > 0 ? 1 - remaining / total : 0);
  const R = 44;
  const CIRC = 2 * Math.PI * R;

  function fmt(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function persist(): void {
    try {
      const data: StoredTimer = {
        endAt: endAt ?? 0,
        remaining: pausedRemaining ?? remaining,
        total,
        finished
      };
      sessionStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch {
      /* Storage voll/gesperrt – Timer läuft trotzdem weiter */
    }
  }

  function clearStore(): void {
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {
      /* ignorieren */
    }
  }

  function restore(): void {
    let data: StoredTimer | null = null;
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      data = raw ? (JSON.parse(raw) as StoredTimer) : null;
    } catch {
      data = null;
    }
    if (!data || !Number.isFinite(data.total) || data.total <= 0) return;
    total = data.total;
    if (data.finished || (data.endAt > 0 && data.endAt <= Date.now())) {
      // Während der Abwesenheit abgelaufen → als fertig markieren
      // (ohne erneut zu läuten)
      finished = true;
      endAt = null;
      pausedRemaining = 0;
    } else if (data.endAt > 0) {
      endAt = data.endAt;
      pausedRemaining = null;
      startInterval();
      void requestWakeLock();
    } else {
      pausedRemaining = data.remaining > 0 ? data.remaining : null;
    }
  }

  function tick(): void {
    now = Date.now();
    if (endAt !== null && now >= endAt) {
      finish();
    }
  }

  function startInterval(): void {
    stopInterval();
    intervalId = setInterval(tick, 500);
  }
  function stopInterval(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function finish(): void {
    endAt = null;
    pausedRemaining = 0;
    finished = true;
    stopInterval();
    releaseWakeLock();
    playBeep();
    vibrate([400, 150, 400]);
    // Notification vor allem, wenn die App gerade nicht sichtbar ist —
    // dann bringt der In-App-Bleep nichts.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      notifyTimerDone(label ?? '');
    }
    persist();
    onDone?.();
  }

  function start(): void {
    if (running || finished) return;
    unlockAudio(); // Autoplay-Policy: aus Nutzer-Geste entsperren
    void ensureNotificationPermission(); // gleich mit anfragen (User-Geste!)
    now = Date.now();
    endAt = now + Math.max(1, pausedRemaining ?? total) * 1000;
    pausedRemaining = null;
    startInterval();
    void requestWakeLock();
    persist();
  }
  function pause(): void {
    if (endAt === null) return;
    pausedRemaining = remaining;
    endAt = null;
    stopInterval();
    void releaseWakeLock();
    persist();
  }
  function reset(): void {
    stopInterval();
    endAt = null;
    pausedRemaining = null;
    finished = false;
    total = durationSec;
    void releaseWakeLock();
    clearStore();
  }

  // Prop-Reset: wenn der Schritt gewechselt wird (durationSec/stepId),
  // Zustand für den NEUEN Schritt aus der sessionStorage holen
  $effect(() => {
    durationSec;
    stepId;
    stopInterval();
    endAt = null;
    pausedRemaining = null;
    finished = false;
    total = durationSec;
    now = Date.now();
    restore();
    return () => void releaseWakeLock();
  });

  // Beim Zurückkehren in den Tab sofort nachziehen (der Timer lief auf
  // Zielzeit weiter, nur die Anzeige war eingefroren)
  function onVisibility(): void {
    now = Date.now();
    if (endAt !== null && now >= endAt) finish();
    else if (document.visibilityState === 'visible' && endAt !== null) {
      void requestWakeLock();
      persist();
    }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  function adjustTime(delta: number): void {
    const cur = remaining;
    const next = Math.max(0, cur + delta);
    if (endAt !== null) {
      endAt = now + next * 1000;
    } else {
      pausedRemaining = finished ? null : next;
    }
    // Grunddauer mitverschieben: vergangene Zeit bleibt erhalten, der Kreis
    // skaliert auf die neue Gesamtzeit (statt über 100 % hinauszulaufen)
    total = Math.max(next, total + delta);
    persist();
  }

  onDestroy(() => {
    stopInterval();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
    // Wake Lock NICHT freigeben: ein laufender Timer soll den Bildschirm
    // auch nach dem Wegnavigieren wachhalten — freigegeben wird beim
    // Finish/Reset bzw. vom Browser selbst beim Tab-Einfrieren.
  });
</script>

<div class="timer" class:finished class:running>
  <div class="ring">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle class="track" cx="50" cy="50" r={R} />
      <circle
        class="prog"
        cx="50" cy="50" r={R}
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
        <Icon name="play" size={18} filled /> {remaining < total ? 'Weiter' : 'Timer starten'}
      </button>
      {#if remaining < total}
        <button class="btn" onclick={reset} aria-label="Zurücksetzen"><Icon name="restart" size={18} /></button>
      {/if}
    {/if}
  </div>

  {#if !finished}
    <div class="adjust">
      <button class="adj" onclick={() => adjustTime(-300)} disabled={remaining < 300}>−5 Min</button>
      <button class="adj" onclick={() => adjustTime(-60)} disabled={remaining < 60}>−1 Min</button>
      <button class="adj" onclick={() => adjustTime(60)}>+1 Min</button>
      <button class="adj" onclick={() => adjustTime(300)}>+5 Min</button>
    </div>
  {/if}
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
  .adjust {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .adj {
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .adj:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .adj:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
