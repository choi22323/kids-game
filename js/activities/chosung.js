/* ② 초성 보고 낱말 맞히기 (FEATURES.md F-06) */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const ui = HG.ui;

  /** 오답 처리 공통 상태기: 1회 안내 → 2회 힌트 → 3회(또는 남은 오답 없음) 정답 보여 주기 */
  function quiz(ctx, cfg) {
    const results = [];
    let idx = 0, hints = 0;
    const root = h('div', { class: cfg.cls });
    ctx.stage.appendChild(root);

    function render() {
      clear(root);
      const q = cfg.questions[idx];
      ctx.onProgress(idx, cfg.questions.length);
      const st = { attempts: 0, wrong: new Set(), done: false, hinted: false };
      const view = cfg.renderQuestion(q, root);
      const opts = h('div', { class: 'options', role: 'group', 'aria-label': '보기' });
      HG.act.arrowNav(opts);
      const btns = {};
      q.options.forEach((text) => {
        const b = h('button', { type: 'button', class: 'option', on: { click: () => choose(text) } }, h('span', { class: 'option-text', text }), h('span', { class: 'option-mark', 'aria-hidden': 'true' }));
        btns[text] = b;
        opts.appendChild(b);
      });
      root.appendChild(opts);

      function showHint() {
        if (st.hinted) return;
        st.hinted = true; hints++;
        view.hint();
      }
      function finish(result) {
        st.done = true;
        results[idx] = { itemId: q.id, text: q.answer, attempts: st.attempts + (result === 'revealed' ? 0 : 1), result };
        Object.values(btns).forEach((b) => { b.disabled = true; });
        btns[q.answer].disabled = false;
        btns[q.answer].setAttribute('aria-disabled', 'true');
        view.solved();
        bar(true);
      }
      function choose(text) {
        if (st.done || st.wrong.has(text)) return;
        if (text === q.answer) {
          const result = st.reveal ? 'revealed' : st.attempts === 0 ? 'first' : 'retry';
          btns[text].classList.add('is-correct');
          btns[text].querySelector('.option-mark').textContent = '✔ 정답!';
          HG.feedback.show('correct', HG.feedback.praise());
          finish(result);
          return;
        }
        st.attempts++;
        st.wrong.add(text);
        const b = btns[text];
        b.classList.add('is-dim');
        b.disabled = true;
        b.querySelector('.option-mark').textContent = '다시 해 볼까요?';
        const left = q.options.filter((o) => o !== q.answer && !st.wrong.has(o)).length;
        if (st.attempts >= 3) {
          btns[q.answer].classList.add('is-correct');
          btns[q.answer].querySelector('.option-mark').textContent = '함께 읽어 봐요';
          HG.feedback.show('reveal', '함께 읽어 봐요: ' + q.answer, 1800);
          finish('revealed');
        } else if (st.attempts >= 2 || left === 0) {
          showHint();
          if (left === 0) {
            st.reveal = true;
            btns[q.answer].classList.add('is-guide');
            HG.feedback.show('retry', '거의 다 왔어요! 이 낱말을 눌러 보세요.', 1800);
          } else HG.feedback.show('retry', '거의 다 왔어요! 힌트를 보여 드릴게요.', 1600);
        } else {
          HG.feedback.show('retry', HG.feedback.retryMsg());
        }
        const nextFocus = opts.querySelector('button:not(:disabled)');
        if (nextFocus) nextFocus.focus();
      }
      function skip() {
        if (!st.done) results[idx] = { itemId: q.id, text: q.answer, attempts: st.attempts, result: 'skipped' };
        next();
      }
      function bar(done) {
        const nx = ui.btn(idx + 1 >= cfg.questions.length ? '활동 마치기' : '다음', { variant: done ? 'accent' : 'secondary', icon: '▶', cls: 'icon-after', disabled: !done, onClick: next });
        nx.dataset.role = 'next';
        const center = [ui.btn('힌트 보기', { icon: '💡', disabled: done || st.hinted, onClick: () => { showHint(); bar(false); } })];
        ctx.bar([ui.btn('건너뛰기', { disabled: done, onClick: skip })], center, [nx]);
        if (done) setTimeout(() => nx.focus(), 50);
      }
      bar(false);
      setTimeout(() => { const f = opts.querySelector('button'); if (f && document.activeElement === document.body) f.focus(); }, 30);
    }
    function next() {
      idx++;
      if (idx >= cfg.questions.length) {
        const all = cfg.questions.map((q, i) => results[i] || { itemId: q.id, text: q.answer, attempts: 0, result: 'skipped' });
        ctx.onFinish(all, { hintsUsed: hints });
        return;
      }
      render();
    }
    render();
    return { destroy() { root.remove(); }, partial() { return results.filter(Boolean); }, hints: () => hints };
  }

  function start(ctx) {
    const opt = (ctx.set.activityOptions && ctx.set.activityOptions.chosung) || {};
    const n = opt.optionCount === 4 ? 4 : 3;
    const showImg = opt.showImageHint !== false;
    const questions = ctx.items.map((w) => ({
      id: w.id, answer: w.text, word: w,
      options: HG.act.shuffle([w.text].concat(HG.act.pickDistractors(w.text, ctx.pool, n - 1)))
    }));
    return quiz(ctx, {
      cls: 'chosung',
      questions,
      renderQuestion(q, root) {
        const cho = HG.hangul.getChosung(q.answer);
        const choEl = h('div', { class: 'cho-text', role: 'img', 'aria-label': '초성 ' + HG.hangul.chosungSpeech(cho) },
          Array.from(cho).map((c) => h('span', { class: c === ' ' ? 'cho-gap' : 'cho-ch', 'aria-hidden': 'true', text: c === ' ' ? '' : c })));
        const hintEl = h('p', { class: 'cho-hint', 'aria-live': 'polite' });
        const pic = showImg && q.word.image ? HG.images.render(q.word.image, { cls: 'cho-pic', noFallback: true }) : null;
        root.appendChild(h('div', { class: 'cho-top' }, pic, h('div', { class: 'cho-main' }, h('p', { class: 'act-ask', text: '초성을 보고 알맞은 낱말을 골라 주세요' }), choEl, hintEl)));
        return {
          hint() {
            const s = HG.hangul.syllables(q.answer);
            const shown = s[0] + HG.hangul.getChosung(s.slice(1).join(''));
            hintEl.textContent = '힌트: ' + shown + (q.word.hint ? ' · ' + q.word.hint : '');
          },
          solved() { hintEl.textContent = q.answer; hintEl.classList.add('is-answer'); }
        };
      }
    });
  }
  HG.activities.chosung = { id: 'chosung', start };
  HG.act.quiz = quiz;
})();
