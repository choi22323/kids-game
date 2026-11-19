/* ④ 생활 속 빈칸 문장 완성하기 (FEATURES.md F-08) */
(function () {
  'use strict';
  const { h } = HG.dom;

  /** 문장을 [앞, 정답, 뒤]로 나눈다(정답은 정확히 1회 등장해야 함) */
  function split(text, answer) {
    const i = text.indexOf(answer);
    if (i < 0) return null;
    return [text.slice(0, i), answer, text.slice(i + answer.length)];
  }
  function start(ctx) {
    const questions = ctx.items.filter((s) => split(s.text, s.answer)).map((s) => ({
      id: s.id, answer: s.answer, sentence: s,
      options: HG.act.shuffle([s.answer].concat(s.distractors.slice(0, 2)))
    }));
    return HG.act.quiz(ctx, {
      cls: 'blank',
      questions,
      renderQuestion(q, root) {
        const [before, , after] = split(q.sentence.text, q.answer);
        const n = HG.hangul.syllableCount(q.answer);
        const blank = h('span', { class: 'blank-box', style: { '--n': String(Math.max(2, n)) }, 'aria-label': '빈칸' }, h('span', { class: 'blank-in', text: '' }));
        const sentence = h('p', { class: 'blank-sentence' }, before, blank, after);
        root.appendChild(h('div', { class: 'blank-top' }, h('p', { class: 'act-ask', text: '빈칸에 알맞은 낱말을 골라 주세요' }), sentence));
        return {
          hint() { blank.firstChild.textContent = HG.hangul.syllables(q.answer)[0] + ' …'; blank.classList.add('is-hint'); },
          solved() {
            blank.firstChild.textContent = q.answer;
            blank.classList.remove('is-hint');
            blank.classList.add('is-filled');
            blank.removeAttribute('aria-label');
            sentence.classList.add('is-done');
            HG.feedback.announce('완성 문장: ' + q.sentence.text);
          }
        };
      }
    });
  }
  HG.activities.blank = { id: 'blank', start, split };
})();
