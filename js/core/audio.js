/* Web Audio 효과음 합성 — 음원 파일·외부 리소스 없음 (FEATURES.md F-09) */
(function () {
  'use strict';
  let ctx = null, master = null, playing = 0;
  const NOTE = { C4: 261.63, E4: 329.63, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5 };

  function ensure() {
    const s = HG.state.settings;
    if (!s || !s.soundEnabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination); } catch (e) { ctx = null; return null; }
    }
    master.gain.value = s.volume;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(freq, at, dur, type, level) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(master);
    o.start(at); o.stop(at + dur + 0.03);
  }
  const SOUNDS = {
    correct: [[NOTE.C5, 0, 0.28, 'sine', 0.5], [NOTE.E5, 0.12, 0.36, 'sine', 0.5]],
    retry: [[NOTE.E4, 0, 0.22, 'triangle', 0.32], [NOTE.C4, 0.15, 0.3, 'triangle', 0.32]],
    complete: [[NOTE.C5, 0, 0.3, 'sine', 0.45], [NOTE.E5, 0.16, 0.3, 'sine', 0.45], [NOTE.G5, 0.32, 0.3, 'sine', 0.45], [NOTE.C6, 0.48, 0.5, 'sine', 0.45]],
    click: [[880, 0, 0.04, 'square', 0.05]]
  };
  const LEN = { correct: 0.5, retry: 0.5, complete: 1.0, click: 0.05 };

  function play(name) {
    const c = ensure();
    if (!c || !SOUNDS[name]) return false;
    if (playing >= 2) return false; // 중첩 최대 2개
    playing++;
    const t = c.currentTime + 0.01;
    try { SOUNDS[name].forEach(([f, d, dur, type, lv]) => tone(f, t + d, dur, type, lv)); } catch (e) { playing--; return false; }
    setTimeout(() => { playing = Math.max(0, playing - 1); }, LEN[name] * 1000);
    return true;
  }
  /** 자동재생 정책: 첫 사용자 제스처에서 컨텍스트를 깨운다 */
  function unlockOnGesture() {
    const f = () => { ensure(); };
    window.addEventListener('pointerdown', f, { passive: true });
    window.addEventListener('keydown', f);
  }
  HG.audio = { play, ensure, unlockOnGesture };
})();
