// Alarm-State (Svelte 5 universal reactivity – in .svelte.ts nutzbar).
// StepTimer setzt `ringing` beim Ablauf und hinterlegt seine Stopp-Funktion,
// die TopBar zeigt daraufhin den Wecker-Button oben rechts (Klick = aus).
export const alarm = $state({
  ringing: false,
  stop: null as (() => void) | null
});

/** Alarm ausschalten (TopBar-Button): ruft die Stopp-Funktion des Timers. */
export function silenceAlarm(): void {
  alarm.stop?.();
}
