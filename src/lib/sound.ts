// === Sound (Web Audio API) ===
// Erzeugt einen Doppel-Bleep ohne Audio-Asset. Browsers autoplay-Policy
// verlangt, dass der AudioContext aus einer Nutzer-Geste heraus entsperrt
// wird → beim Klick auf „Start" unlockAudio() aufrufen.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

/** Context aus einer Nutzer-Geste heraus entsperren/erzeugen. */
export function unlockAudio(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

/** Kurzer aufsteigender Doppel-Bleep („Timer fertig"). */
export function playBeep(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const tones = [880, 1320];
  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.18;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.28, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.17);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });
}

/**
 * Küchenwecker-Alarm: „Piep-Piep-Piep … Pause …" mehrere Runden lang,
 * bis `stop()` gerufen wird (max. 30 s, dann gibt es von selbst auf).
 * Lauter und „körperreicher" als playBeep (Dreieck-Welle + Oberton),
 * aber bewusst im mittleren Frequenzband — prägnant, nicht schrill.
 * Liefert eine Stop-Funktion zurück (z. B. beim „Zurücksetzen").
 */
export function playAlarm(): () => void {
  const ctx = getCtx();
  if (!ctx) return () => {};
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

  const BEEP = 0.12; // Dauer eines Piepsers
  const GAP = 0.08; // Pause zwischen Piepsern
  const ROUND = 3 * (BEEP + GAP) + 0.9; // 3 Piepser, dann lange Pause
  const MAX_ROUNDS = 20; // ~30 Sekunden

  let master: GainNode | null = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  let t = ctx.currentTime + 0.05;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    for (let beep = 0; beep < 3; beep++) {
      // Grundton + leiser Obenton = vollerer, „echter Piepser"-Klang
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 1568; // G6 – deutlich hörbar, nicht schrill
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 3136; // Oktave dazu, halbe Lautstärke

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.7, t + 0.01);
      gain.gain.setValueAtTime(0.7, t + BEEP - 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + BEEP);

      const gain2 = ctx.createGain();
      gain2.gain.value = 0.35;

      osc.connect(gain);
      osc2.connect(gain2).connect(gain);
      gain.connect(master);
      osc.start(t);
      osc2.start(t);
      osc.stop(t + BEEP + 0.02);
      osc2.stop(t + BEEP + 0.02);
      t += BEEP + GAP;
    }
    t += 0.9; // Runden-Pause
  }

  let stopped = false;
  return () => {
    if (stopped || !master) return;
    stopped = true;
    try {
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
      setTimeout(() => master?.disconnect(), 150);
      master = null;
    } catch {
      /* ignorieren */
    }
  };
}

/** Haptisches Feedback, falls unterstützt. */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* nicht unterstützt – ignorieren */
  }
}
