// === Screen Wake Lock ===
// Hält den Bildschirm an, solange ein Timer läuft (beim Kochen wichtig,
// damit das Display nicht ausgeht). Hinweis: Wake Lock geht verloren, wenn
// der Tab inaktiv wird – für V1 reichen request beim Start / release am Ende.

/* eslint-disable @typescript-eslint/no-explicit-any */
let wakeLock: any = null;

export async function requestWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  try {
    wakeLock = await (navigator as any).wakeLock.request('screen');
  } catch {
    /* User-Agent hat abgelehnt – ignorieren */
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    await wakeLock?.release();
  } catch {
    /* ignorieren */
  }
  wakeLock = null;
}
