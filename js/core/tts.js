/* 한국어 읽어 주기 — 브라우저 내장 음성(speechSynthesis)만 사용한다.
   외부 음성 서비스는 쓰지 않는다. 인터넷 없이 읽으려면 컴퓨터에 한국어 음성이 설치되어 있어야 한다(확인 필요).
   온라인 전용 음성(localService=false)은 오프라인에서 실패할 수 있어 기기 내장 음성을 우선 고른다. */
(function () {
  'use strict';
  const supported = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let voice = null;
  let listeners = [];
  function pick() {
    if (!supported()) return null;
    const ko = speechSynthesis.getVoices().filter((v) => /^ko/i.test(v.lang));
    voice = ko.find((v) => v.localService) || ko[0] || null;
    listeners.forEach((f) => f(voice));
    return voice;
  }
  if (supported()) {
    pick();
    speechSynthesis.addEventListener('voiceschanged', pick);
  }
  /** @returns {boolean} 읽기를 시작했는지 */
  function speak(text, opts) {
    opts = opts || {};
    if (!supported()) { if (opts.onend) opts.onend(false); return false; }
    stop();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    if (voice) { try { u.voice = voice; } catch (e) { /* 음성 지정 실패 시 lang으로 고름 */ } }
    u.rate = opts.rate || (HG.state.settings && HG.state.settings.ttsRate) || 0.85;
    u.pitch = 1;
    u.volume = 1;
    let done = false;
    const end = (ok) => { if (done) return; done = true; if (opts.onend) opts.onend(ok); };
    u.onend = () => end(true);
    u.onerror = () => end(false);
    if (opts.onstart) u.onstart = opts.onstart;
    speechSynthesis.speak(u);
    return true;
  }
  let seq = 0; // 진행 중인 '또박또박 읽기'를 멈추기 위한 번호
  let timer = 0;
  /**
   * 한 글자씩 또박또박 읽기: 글자마다 따로 읽고 사이를 쉰다(띄어쓰기는 더 길게 쉼).
   * opts.onIndex(i)는 지금 읽는 글자의 칸 번호(띄어쓰기 포함)를 알려 준다.
   */
  function speakSyllables(text, opts) {
    opts = opts || {};
    if (!supported()) { if (opts.onend) opts.onend(false); return false; }
    stop();
    const my = ++seq;
    const chars = Array.from(String(text).normalize('NFC').trim());
    const gap = opts.gap == null ? 450 : opts.gap;
    const wordGap = opts.wordGap == null ? 900 : opts.wordGap;
    let i = 0, anyOk = false;
    const nextChar = () => {
      if (my !== seq) return;
      while (i < chars.length && /\s/.test(chars[i])) { i++; }
      if (i >= chars.length) { if (opts.onIndex) opts.onIndex(-1); if (opts.onend) opts.onend(anyOk); return; }
      const idx = i;
      if (opts.onIndex) opts.onIndex(idx);
      if (idx === 0 && opts.onstart) opts.onstart();
      const u = new SpeechSynthesisUtterance(chars[idx]);
      u.lang = 'ko-KR';
      if (voice) { try { u.voice = voice; } catch (e) { /* 무시 */ } }
      u.rate = opts.rate || 0.7;
      u.pitch = 1; u.volume = 1;
      let fired = false;
      const after = (ok) => {
        if (fired || my !== seq) return;
        fired = true;
        if (ok) anyOk = true;
        i = idx + 1;
        const pause = i < chars.length && /\s/.test(chars[i]) ? wordGap : gap;
        timer = setTimeout(nextChar, pause);
      };
      u.onend = () => after(true);
      u.onerror = () => after(false);
      speechSynthesis.speak(u);
    };
    nextChar();
    return true;
  }
  function stop() { seq++; clearTimeout(timer); if (supported()) speechSynthesis.cancel(); }
  HG.tts = {
    supported, speak, speakSyllables, stop, pick,
    voice: () => voice,
    voiceLabel: () => (voice ? voice.name + (voice.localService ? ' (이 컴퓨터)' : ' (인터넷 필요할 수 있음)') : ''),
    onVoice(f) { listeners.push(f); return () => { listeners = listeners.filter((x) => x !== f); }; }
  };
})();
