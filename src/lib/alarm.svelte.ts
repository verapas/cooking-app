// Alarm & Timer-Watching (Svelte 5 universal reactivity – in .svelte.ts nutzbar).
//
// Läuten: `alarm.ringing` zeigt den Wecker-Button in der TopBar (Klick =
// `silenceAlarm()` stoppt den Ton).
//
// Watching: Ein laufender Timer muss auch läuten, wenn man die Rezept-Seite
// verlassen hat — die StepTimer-Komponente ist dann zerstört. Dieses Modul
// tickt app-weit selbst (es überlebt Navigation, solange die App offen ist)
// und feuert im Fälligkeitsfall Ton/Vibration/Notification und schreibt den
// Fertig-Zustand in die sessionStorage, aus der StepTimer beim Zurückkehren
// wiederherstellt (gleiches Format wie dort).

import { playAlarm, vibrate } from '$lib/sound';
import { notifyTimerDone } from '$lib/notify';

export const alarm = $state({
  ringing: false,
  stop: null as (() => void) | null,
  // Laufender Timer für die TopBar-Anzeige (null = keiner läuft)
  running: null as null | { stepId: number; endAt: number; label: string },
  // Wird vom Watcher-Interval getickt, damit die TopBar die Restzeit
  // reaktiv darstellen kann
  now: Date.now()
});

/** Alarm ausschalten (TopBar-Button): ruft die Stopp-Funktion des Timers. */
export function silenceAlarm(): void {
  alarm.stop?.();
}

/** Laufenden Timer anhalten (TopBar-Stopp): abmelden + Speicher aufräumen. */
export function stopRunningTimer(): void {
  const r = alarm.running;
  if (!r) return;
  unwatchTimer(r.stepId);
  try {
    sessionStorage.removeItem(`step-timer:${r.stepId}`);
  } catch {
    /* ignorieren */
  }
}

function startRinging(): void {
  const stopper = playAlarm();
  alarm.ringing = true;
  alarm.stop = () => {
    stopper();
    alarm.ringing = false;
    alarm.stop = null;
  };
  // playAlarm gibt nach ~30 s von selbst auf → Anzeige mit ausblenden
  setTimeout(() => alarm.stop?.(), 30500);
}

// === App-weites Timer-Watching ===

interface Watch {
  stepId: number;
  endAt: number;
  total: number;
  label: string;
}

const watchers = new Map<number, Watch>();
let tickId: ReturnType<typeof setInterval> | null = null;

function fire(w: Watch): void {
  try {
    sessionStorage.setItem(
      `step-timer:${w.stepId}`,
      JSON.stringify({ endAt: 0, remaining: 0, total: w.total, finished: true })
    );
  } catch {
    /* ignorieren */
  }
  vibrate([500, 200, 500, 200, 500, 200, 500]);
  // Notification nur, wenn die App gerade nicht sichtbar ist
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    notifyTimerDone(w.label);
  }
  startRinging();
}

function ensureTicking(): void {
  if (tickId || typeof window === 'undefined') return;
  tickId = setInterval(() => {
    alarm.now = Date.now();
    for (const [stepId, w] of watchers) {
      if (alarm.now >= w.endAt) {
        watchers.delete(stepId);
        fire(w);
      }
    }
    if (watchers.size === 0 && tickId) {
      clearInterval(tickId);
      tickId = null;
    }
  }, 500);
}

/** Timer (neu) anmelden — überschreibt eine bestehende Anmeldung. */
export function watchTimer(stepId: number, endAt: number, total: number, label: string): void {
  watchers.set(stepId, { stepId, endAt, total, label });
  alarm.running = { stepId, endAt, label };
  ensureTicking();
}

/** Timer abmelden (Pause/Reset/Schrittwechsel/Stopp aus der TopBar). */
export function unwatchTimer(stepId: number): void {
  watchers.delete(stepId);
  if (alarm.running?.stepId === stepId) {
    alarm.running = null;
  }
}

/**
 * Fälligkeits-Ereignis auslösen (von StepTimer ODER vom Watcher hier).
 * Klingelt nur, wenn dieser Timer noch angemeldt ist — wer zuerst feuert,
 * gewinnt, ein doppeltes Läuten ist ausgeschlossen.
 */
export function fireTimerDone(stepId: number): void {
  const w = watchers.get(stepId);
  if (!w) return;
  watchers.delete(stepId);
  if (alarm.running?.stepId === stepId) alarm.running = null;
  fire(w);
}
