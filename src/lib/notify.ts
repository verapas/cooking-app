// === Benachrichtigungen & nativer Android-Timer ===
// Der In-App-Timer stirbt, wenn der Tab eingefroren wird. Daher zwei
// Auswege: (a) auf Android den System-Timer der Uhr-App starten (klingelt
// zuverlässig, auch bei gesperrtem Display — gestartete Timer werden
// dabei NICHT als gespeicherte Timer angelegt, sie laufen einfach ab),
// (b) Fallback: Web-Notification mit Signalton/Vibration, sobald der
// Tick-Code wieder laufen darf.

/** Läuft die App auf Android? (dort ist der Intent-Timer möglich) */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

/**
 * Intent-URI, die auf Android die Uhr-App einen Timer starten lässt.
 * SKIP_UI=1 → ohne Bestätigungsdialog, der Timer läuft sofort los.
 * LENGTH wird in Sekunden angegeben und auf >= 1 geklemmt.
 */
export function androidTimerUrl(seconds: number, label: string): string {
  const len = Math.max(1, Math.round(seconds));
  return (
    `intent:#Intent` +
    `;action=android.intent.action.SET_TIMER` +
    `;i.android.intent.extra.alarm.LENGTH=${len}` +
    `;S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(label)}` +
    `;i.android.intent.extra.alarm.SKIP_UI=1` +
    `;package=com.google.android.deskclock` +
    `;end`
  );
}

/**
 * Notification-PPermission anfordern (aus einer Nutzer-Geste heraus).
 * Liefert true, wenn Benachrichtigungen gezeigt werden dürfen.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'default') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * „Timer fertig"-Benachrichtigung zeigen. Bringt eigenen Signalton und
 * Vibration (sofern vom OS erlaubt) — wichtiger als der In-App-Bleep,
 * wenn die App im Hintergrund ist.
 */
export function notifyTimerDone(label: string): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification('⏲ Timer fertig!', {
      body: label || 'Die Zeit ist um.',
      icon: '/icon-192.png?v=2',
      badge: '/icon-192.png?v=2',
      tag: 'step-timer'
    });
    // Fokus zurück in die App, wenn jemand auf die Notification tippt
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* manche Browser verlangen den Service-Worker-Kontext – ignorieren */
  }
}
