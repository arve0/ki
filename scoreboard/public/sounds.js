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
    // Super Mario mynt-lyd: rask "ping pong" (B5 → E6)
    const notes = [
      { freq: 987.77, dur: 0.08 },  // B5 (ping)
      { freq: 1318.51, dur: 0.18 }, // E6 (pong, ringer ut)
    ];
    const gap = 0.01;

    let t = ctx.currentTime;
    notes.forEach(({ freq, dur }) => {

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
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
