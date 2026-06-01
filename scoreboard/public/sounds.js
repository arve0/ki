'use strict';

/**
 * Plays a chiptune power-up sequence using the Web Audio API.
 * No external libraries required.
 *
 * Browsers block AudioContext until a user gesture has occurred.
 * We create one shared context and resume it on the first interaction.
 */

let _audioCtx = null;

function getAudioContext() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _audioCtx;
}

// Unlock the AudioContext on first user gesture (click or keydown).
// This is required by all modern browsers.
function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  document.removeEventListener('click', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);
}
document.addEventListener('click', unlockAudio);
document.addEventListener('keydown', unlockAudio);

function playPowerUp() {
  const ctx = getAudioContext();

  // Resume if suspended (e.g. page was backgrounded).
  const play = () => {
    // Rask stigende arpeggio: C5→E5→G5→C6
    const notes = [
      { freq: 523.25, dur: 0.05 },  // C5
      { freq: 659.25, dur: 0.05 },  // E5
      { freq: 783.99, dur: 0.05 },  // G5
      { freq: 1046.50, dur: 0.12 }, // C6 (ring ut)
    ];
    const gap = 0.01;

    let t = ctx.currentTime;
    notes.forEach(({ freq, dur }) => {

      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.005);
      gain.gain.setValueAtTime(0.3, t + dur * 0.6);
      gain.gain.linearRampToValueAtTime(0, t + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + dur);

      t += dur + gap;
    });
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(play);
  } else {
    play();
  }
}
