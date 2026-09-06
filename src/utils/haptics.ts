/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let globalAudioCtx: AudioContext | null = null;

/**
 * Triggers a subtle premium haptic feedback.
 * Uses browser navigator.vibrate for mobile devices, and falls back to a highly optimized,
 * cached audio synthesizer pop on desktop to prevent audio context leaks and performance lag.
 */
export function triggerHapticFeedback() {
  try {
    // 1. Mobile Hardware Vibrate (extremely lightweight)
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(5);
    }
    
    // 2. Audio feedback fallback
    if (typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!globalAudioCtx) {
        globalAudioCtx = new AudioContextClass();
      }
      
      if (globalAudioCtx) {
        // Resume if suspended by browser autoplay/autoplay-security policies
        if (globalAudioCtx.state === 'suspended') {
          globalAudioCtx.resume();
        }
        
        const audioCtx = globalAudioCtx;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        
        // Very subtle volume (0.05) and ultra-short duration (0.04s) for a premium tactile click feel
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.04);
      }
    }
  } catch (e) {
    // Fail silently to prevent throwing exceptions in offline/restricted environments
  }
}
