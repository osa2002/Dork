/**
 * Dynamic synthetic chime generator using Web Audio API.
 * Avoids 404 resource errors and works offline.
 */
export const playChime = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // Dynamic arpeggio chime (A major chord feel: E5 -> A5 -> C#6)
    // Oscillator 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 1.1);

    // Oscillator 2: A5 (880.00 Hz) at +120ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.00, now + 0.12);
    gain2.gain.setValueAtTime(0.2, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 1.3);

    // Oscillator 3: C#6 (1109.73 Hz) at +240ms
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(1109.73, now + 0.24);
    gain3.gain.setValueAtTime(0.25, now + 0.24);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.24);
    osc3.stop(now + 1.6);

  } catch (error) {
    console.warn("Audio Context playback failed or blocked by browser gesture permissions:", error);
  }
};

/**
 * Play a friendly upward arpeggio when a new customer enters the queue.
 */
export const playNewTicketSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // Nice friendly bubble-up bell arpeggio (C5 -> E5 -> G5)
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + index * 0.1);
      
      gain.gain.setValueAtTime(0.15, now + index * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + 0.6);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + index * 0.1);
      osc.stop(now + index * 0.1 + 0.7);
    });
  } catch (error) {
    console.warn("Audio playback failed:", error);
  }
};

/**
 * Play a soft double-tap chime when a ticket's status is changed.
 */
export const playStatusUpdateSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // Clean dual-chime with a slight frequency slide
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.3); // C#5 slide
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch (error) {
    console.warn("Audio playback failed:", error);
  }
};
