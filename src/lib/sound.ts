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

/** Haptisches Feedback, falls unterstützt. */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* nicht unterstützt – ignorieren */
  }
}
