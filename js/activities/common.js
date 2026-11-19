/* 활동 공통 도우미 */
(function () {
  'use strict';
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  /** 받침에 따라 조사 선택: josa('사과','을','를') → '사과를' */
  function josa(word, withFinal, noFinal) { return word + (HG.hangul.hasFinal(word) ? withFinal : noFinal); }
  /** 초성 활동 오답 보기: 같은 세트 우선, 초성이 같은 낱말 제외, 글자 수 같은 것 우선 */
  function pickDistractors(answer, pool, k) {
    const cho = HG.hangul.getChosung(answer);
    const len = HG.hangul.syllableCount(answer);
    const seen = new Set([answer]);
    const cands = [];
    shuffle(pool).forEach((p) => {
      if (seen.has(p.text)) return;
      seen.add(p.text);
      if (HG.hangul.getChosung(p.text) === cho) return;
      let score = 0;
      if (p.sameSet) score += 4;
      if (HG.hangul.syllableCount(p.text) === len) score += 2;
      if (HG.hangul.getChosung(p.text)[0] !== cho[0]) score += 1;
      cands.push({ text: p.text, score });
    });
    cands.sort((a, b) => b.score - a.score);
    return cands.slice(0, k).map((c) => c.text);
  }
  /** 보기 버튼 묶음에서 방향키 이동 */
  function arrowNav(container) {
    container.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const btns = Array.from(container.querySelectorAll('button:not(:disabled)'));
      const i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      e.stopPropagation();
      const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
      btns[(i + d + btns.length) % btns.length].focus();
    });
  }
  HG.act = { shuffle, josa, pickDistractors, arrowNav };
})();
