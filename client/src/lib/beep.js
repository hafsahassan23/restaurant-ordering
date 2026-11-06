let ctx;

/** Short beep for new orders. Sound is optional: errors are ignored. */
export function beep() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    /* ignore */
  }
}