<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { playAlarm, unlockAudio, vibrate } from '$lib/sound';
  import { releaseWakeLock, requestWakeLock } from '$lib/wakeLock';
  import { ensureNotificationPermission, notifyTimerDone } from '$lib/notify';
  import { alarm } from '$lib/alarm.svelte';
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
  // Läuft der Wecker, stoppt ihn das Zurücksetzen/der Schrittwechsel
  let stopAlarm: (() => void) | null = null;

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

  function stopAlarmSound(): void {
    stopAlarm?.();
    stopAlarm = null;
    // Globale Anzeige (TopBar-Wecker) mit ausblenden
    alarm.ringing = false;
    alarm.stop = null;
  }

  function finish(): void {
    endAt = null;
    pausedRemaining = 0;
    finished = true;
    stopInterval();
    releaseWakeLock();
    stopAlarmSound();
    stopAlarm = playAlarm();
    vibrate([500, 200, 500, 200, 500, 200, 500]);
    // Wecker-Symbol in der TopBar zeigen; Klick dort stoppt den Ton.
    // playAlarm gibt nach ~30 s von selbst auf → Anzeige mit ausblenden.
    alarm.ringing = true;
    alarm.stop = stopAlarmSound;
    setTimeout(() => {
      if (alarm.stop === stopAlarmSound) stopAlarmSound();
    }, 30500);
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
    stopAlarmSound();
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
    stopAlarmSound();
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
    stopAlarmSound();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
    // Wake Lock NICHT freigeben: ein laufender Timer soll den Bildschirm
    // auch nach dem Wegnavigieren wachhalten — freigegeben wird beim
    // Finish/Reset bzw. vom Browser selbst beim Tab-Einfrieren.
  });
</script>

<div class="timer" class:finished class:running>
  {#if finished}
    <span class="done"><Icon name="check" size={16} /> Zeit ist um!</span>
    <button class="ctl" onclick={reset} aria-label="Timer zurücksetzen" title="Zurücksetzen">
      <Icon name="restart" size={18} />
    </button>
  {:else}
    <div class="ring" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <circle class="track" cx="50" cy="50" r={R} />
        <circle
          class="prog"
          cx="50" cy="50" r={R}
          stroke-dasharray={CIRC}
          stroke-dashoffset={CIRC * (1 - progress)}
        />
      </svg>
    </div>
    <span class="time">{display}</span>
    <div class="adjust">
      <button class="adj" onclick={() => adjustTime(-60)} disabled={remaining < 60} aria-label="Eine Minute abziehen" title="−1 Min">−1</button>
      <button class="adj" onclick={() => adjustTime(60)} aria-label="Eine Minute hinzufügen" title="+1 Min">+1</button>
      <button class="adj" onclick={() => adjustTime(-300)} disabled={remaining < 300} aria-label="Fünf Minuten abziehen" title="−5 Min">−5</button>
      <button class="adj" onclick={() => adjustTime(300)} aria-label="Fünf Minuten hinzufügen" title="+5 Min">+5</button>
    </div>
    <button
      class="ctl ctl-primary"
      onclick={running ? pause : start}
      aria-label={running ? 'Timer pausieren' : remaining < total ? 'Timer fortsetzen' : 'Timer starten'}
      title={running ? 'Pause' : 'Start'}
    >
      {#if running}
        <Icon name="pause" size={18} />
      {:else}
        <Icon name="play" size={18} filled />
      {/if}
    </button>
    {#if remaining < total}
      <button class="ctl" onclick={reset} aria-label="Timer zurücksetzen" title="Zurücksetzen">
        <Icon name="restart" size={18} />
      </button>
    {/if}
  {/if}
</div>

<style>
  .timer {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 16px;
  }
  .ring {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }
  .ring svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }
  .track {
    fill: none;
    stroke: var(--surface-3);
    stroke-width: 10;
  }
  .prog {
    fill: none;
    stroke: var(--accent);
    stroke-width: 10;
    stroke-linecap: round;
    transition: stroke-dashoffset 1s linear;
  }
  .timer.finished .prog {
    stroke: var(--success);
  }
  .time {
    font-size: 1.15rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
  .timer.finished .time {
    color: var(--success);
  }
  .done {
    color: var(--success);
    font-weight: 600;
    flex: 1;
  }
  .adjust {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }
  .adj {
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
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
  .ctl {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .ctl:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .ctl-primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--surface);
  }
  .ctl-primary:hover {
    filter: brightness(1.1);
    color: var(--surface);
  }
</style>
