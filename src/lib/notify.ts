// === Benachrichtigungen für den Schritt-Timer ===
// Der In-App-Timer stirbt, wenn der Tab eingefroren wird. Wenn die Zeit
// dann im Hintergrund abläuft (Android lässt gedrosselte Tabs ~1×/Minute
// ticken, irgendwann läuft der Finish-Tick), holt eine Web-Notification
// mit Signalton und Vibration den Nutzer zurück.

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
