/* 정답/다시/정답 보여 주기/완료 피드백: 시각 + 문구 + 소리 + live region (FEATURES.md F-09) */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const ICON = { correct: '✔', retry: '↻', reveal: '👀', complete: '★', info: 'ℹ' };
  const SOUND = { correct: 'correct', retry: 'retry', reveal: 'retry', complete: 'complete' };
  let timer = 0;

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function praise() { return pick(HG.state.settings.praiseMessages); }
  function retryMsg() { return pick(HG.state.settings.retryMessages); }

  function announce(text) {
    const live = document.getElementById('live');
    live.textContent = '';
    setTimeout(() => { live.textContent = text; }, 30);
  }
  function show(kind, text, ms) {
    const layer = document.getElementById('feedback-layer');
    clearTimeout(timer);
    clear(layer);
    const box = h('div', { class: 'fb fb-' + kind },
      h('div', { class: 'fb-icon', 'aria-hidden': 'true', text: ICON[kind] || '' }),
      h('div', { class: 'fb-text', text }));
    if ((kind === 'correct' || kind === 'complete') && !reducedMotion()) {
      for (let i = 0; i < 8; i++) box.appendChild(h('span', { class: 'fb-star', 'aria-hidden': 'true', text: '★', style: { '--i': String(i) } }));
    }
    layer.appendChild(box);
    layer.classList.add('is-on');
    if (SOUND[kind]) HG.audio.play(SOUND[kind]);
    announce(text);
    timer = setTimeout(() => { layer.classList.remove('is-on'); clear(layer); }, ms || 1300);
  }
  function hide() { const layer = document.getElementById('feedback-layer'); layer.classList.remove('is-on'); clear(layer); }
  function reducedMotion() {
    const m = HG.state.settings && HG.state.settings.reduceMotion;
    if (m === 'on') return true;
    if (m === 'off') return false;
    return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  HG.feedback = { show, hide, praise, retryMsg, announce, reducedMotion };
})();
