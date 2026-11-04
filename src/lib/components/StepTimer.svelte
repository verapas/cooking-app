<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { unlockAudio } from '$lib/sound';
  import { releaseWakeLock, requestWakeLock } from '$lib/wakeLock';
  import { ensureNotificationPermission } from '$lib/notify';
  import { alarm, fireTimerDone, fmtCountdown, silenceAlarm, unwatchTimer, watchTimer } from '$lib/alarm.svelte';
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

  // Schrittwechsel zerstört die Komponente komplett ({#key current.id} im
  // Stepper) → stepId ist pro Instanz KONSTANT, der Key kann statisch sein.
  // svelte-ignore state_referenced_locally
  const STORE_KEY = `step-timer:${stepId}`;

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
  // Reset ist ausgegraut, bis der Timer mindestens einmal gestartet wurde
  let started = $derived(running || pausedRemaining !== null);
  // Kreis-Fortschritt: 0 = Start (Ring voll), 1 = abgelaufen (Ring leer).
  // Der Bogen beginnt bei 12 Uhr VOLL und schrumpft im Uhrzeigersinn:
  // Der negative dashoffset hält das Bogen-ENDE bei 12 Uhr fixiert und
  // lässt die Startkante im Uhrzeigersinn nachlaufen.
  let progress = $derived(total > 0 ? 1 - remaining / total : 0);
  const R = 44;
  const CIRC = 2 * Math.PI * R;

  function fmt(s: number): string {
    return fmtCountdown(s);
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
      // Wieder beim app-weiten Watcher anmelden (Neuladen der Seite etc.)
      watchTimer(stepId, endAt, total, label ?? '');
      void requestWakeLock();
    } else {
      pausedRemaining = data.remaining > 0 ? data.remaining : null;
    }
  }

  function tick(): void {
    now = Date.now();
    if (endAt !== null && now >= endAt) {
      finish();
      return;
    }
    // Von außen gestoppt (Stopp-Button in der TopBar)? → lokal zurücksetzen
    if (endAt !== null && (alarm.running === null || alarm.running.stepId !== stepId)) {
      stopInterval();
      endAt = null;
      pausedRemaining = null;
      finished = false;
      total = durationSec;
      clearStore();
      void releaseWakeLock();
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
    // Läutet global (Ton, Vibration, Notification, TopBar-Wecker) — aber
    // nur, wenn nicht schon der app-weite Watcher in alarm.svelte.ts
    // gefeuert hat (z. B. während man auf einer anderen Seite war).
    fireTimerDone(stepId);
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
    // App-weit beobachten lassen: klingelt auch, wenn man von der
    // Rezept-Seite weg navigiert (die Komponente ist dann zerstört)
    watchTimer(stepId, endAt, total, label ?? '');
    void requestWakeLock();
    persist();
  }
  function pause(): void {
    if (endAt === null) return;
    pausedRemaining = remaining;
    endAt = null;
    stopInterval();
    unwatchTimer(stepId);
    void releaseWakeLock();
    persist();
  }
  function reset(): void {
    stopInterval();
    silenceAlarm();
    unwatchTimer(stepId);
    endAt = null;
    pausedRemaining = null;
    finished = false;
    total = durationSec;
    void releaseWakeLock();
    clearStore();
  }

  // WICHTIG — kein $effect fürs Initialisieren mehr:
  // Ein Effect, der State schreibt (endAt/total/…) und dabei Module-State
  // berührt (restore() → watchTimer() → alarm.running), kann sich selbst
  // invalidieren und in einer Endlosschleife landen (bis zu 500+ Läufe,
  // die Svelte-Runtime bricht dann still oder mit effect_update_depth_
  // exceeded → „App eingefroren"). Daher: Restore EINMALIG SYNCHRON beim
  // Komponenten-Setup. Der Schrittwechsel erzeugt ohnehin eine frische
  // Instanz ({#key current.id} im Stepper) — ein Prop-Beobachtungs-Effect
  // ist damit überflüssig.
  restore();

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
      // Watcher über die neue Zielzeit informieren
      watchTimer(stepId, endAt, total, label ?? '');
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
    // Bewusst NICHT unwatchen/auslösen: Ein laufender Timer soll auch nach
    // dem Wegnavigieren weiterlaufen und läuten — der app-weite Watcher in
    // alarm.svelte.ts übernimmt. Auch das Wake Lock bleibt (der Browser
    // gibt es beim Tab-Einfrieren selbst frei).
  });
</script>

<div class="timer" class:finished class:running>
  {#if finished}
    <span class="done"><Icon name="check" size={16} /> Zeit ist um!</span>
    <button class="ctl" onclick={reset} aria-label="Timer zurücksetzen" title="Zurücksetzen">
      <Icon name="restart" size={18} />
    </button>
  {:else}
    <div class="left">
      <div class="ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle class="track" cx="50" cy="50" r={R} />
        <circle
          class="prog"
          cx="50" cy="50" r={R}
          stroke-dasharray={CIRC}
          stroke-dashoffset={-CIRC * progress}
        />
        </svg>
        <span class="ringicon"><Icon name="timer" size={26} /></span>
      </div>
      <div class="col">
        <span class="time">{display}</span>
        <div class="adjust">
          <button class="adj" onclick={() => adjustTime(-60)} disabled={remaining < 60} aria-label="Eine Minute abziehen" title="−1 Minute">−1</button>
          <button class="adj" onclick={() => adjustTime(-300)} disabled={remaining < 300} aria-label="Fünf Minuten abziehen" title="−5 Minuten">−5</button>
          <button class="adj" onclick={() => adjustTime(300)} aria-label="Fünf Minuten hinzufügen" title="+5 Minuten">+5</button>
          <button class="adj" onclick={() => adjustTime(60)} aria-label="Eine Minute hinzufügen" title="+1 Minute">+1</button>
        </div>
      </div>
    </div>
    <div class="right">
      <button
        class="ctl"
        onclick={reset}
        disabled={!started}
        aria-label="Timer zurücksetzen"
        title={started ? 'Zurücksetzen' : 'Starte den Timer zuerst'}
      >
        <Icon name="restart" size={18} />
      </button>
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
    </div>
  {/if}
</div>

<style>
  .timer {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 10px 10px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 16px;
  }
  .left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 6px;
    /* Zeit leicht nach oben versetzt über den Buttons (Uhr ragt tiefer) */
    margin-top: -6px;
  }
  .ring {
    position: relative;
    width: 54px;
    height: 54px;
    flex-shrink: 0;
  }
  .ringicon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-dim);
  }
  .timer.running .ringicon {
    color: var(--accent);
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
    font-size: 1.35rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    line-height: 1.1;
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
    gap: 5px;
  }
  .adj {
    padding: 4px 9px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
  }
  .adj:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .adj:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .right {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
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
  .ctl:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .ctl:disabled:hover {
    border-color: var(--border);
    color: var(--text);
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
