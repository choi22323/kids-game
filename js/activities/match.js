/* ③ 그림과 낱말 선 긋기 짝짓기 (FEATURES.md F-07)
   드래그 / 차례로 두 번 누르기 / 키보드(Tab+Enter) 세 가지 방식 */
(function () {
  'use strict';
  const { h, svg, clear } = HG.dom;
  const ui = HG.ui;

  function rounds(words, per) {
    const out = [];
    for (let i = 0; i < words.length && out.length < 3; i += per) out.push(words.slice(i, i + per));
    if (out.length > 1 && out[out.length - 1].length < 2) {
      const last = out.pop();
      if (out[out.length - 1].length + last.length <= 4) out[out.length - 1] = out[out.length - 1].concat(last);
    }
    return out;
  }
  function start(ctx) {
    const opt = (ctx.set.activityOptions && ctx.set.activityOptions.match) || {};
    let per = opt.pairsPerRound === 4 ? 4 : 3;
    if (HG.state.settings.fontScale >= 1.3 || window.innerHeight < 800) per = 3;
    const words = ctx.items.filter(HG.validate.hasImage);
    const rs = rounds(words, per);
    const total = rs.reduce((a, r) => a + r.length, 0);
    const results = [];
    let ri = 0;
    const root = h('div', { class: 'match' });
    ctx.stage.appendChild(root);
    let ro = null;

    function renderRound() {
      clear(root);
      const pairs = rs[ri];
      ctx.onProgress(results.length, total);
      let rightOrder = HG.act.shuffle(pairs);
      for (let k = 0; k < 5 && pairs.length > 1 && rightOrder.every((w, i) => w.id === pairs[i].id); k++) rightOrder = HG.act.shuffle(pairs);
      const leftOrder = HG.act.shuffle(pairs);
      const layer = svg('svg', { class: 'match-lines', 'aria-hidden': 'true' });
      const temp = svg('line', { class: 'match-temp' });
      const wrong = {}, fixed = [];
      let selected = null, drag = null, suppress = false, doneCount = 0;

      const card = (w, side) => h('button', { type: 'button', class: 'match-card match-' + side, dataset: { id: w.id, side },
        'aria-label': side === 'left' ? '그림: ' + ((w.image && w.image.alt) || w.text) : '낱말: ' + w.text },
      side === 'left' ? HG.images.render(w.image, { cls: 'match-pic', fallbackText: w.text }) : h('span', { class: 'match-word', text: w.text }),
      h('span', { class: 'match-dot', 'aria-hidden': 'true' }));
      const left = h('div', { class: 'match-col' }, leftOrder.map((w) => card(w, 'left')));
      const right = h('div', { class: 'match-col' }, rightOrder.map((w) => card(w, 'right')));
      root.append(h('p', { class: 'act-ask', text: '그림과 알맞은 낱말을 선으로 이어 주세요' }), h('div', { class: 'match-board' }, layer, left, h('div', { class: 'match-gap' }), right));
      const board = root.querySelector('.match-board');

      function dot(el) {
        const r = el.getBoundingClientRect(), b = board.getBoundingClientRect();
        return el.dataset.side === 'left' ? { x: r.right - b.left, y: r.top + r.height / 2 - b.top } : { x: r.left - b.left, y: r.top + r.height / 2 - b.top };
      }
      const cardOf = (id, side) => board.querySelector('.match-card[data-side="' + side + '"][data-id="' + CSS.escape(id) + '"]');
      function redraw() {
        while (layer.firstChild) layer.removeChild(layer.firstChild);
        fixed.forEach((id) => {
          const a = dot(cardOf(id, 'left')), b = dot(cardOf(id, 'right'));
          layer.appendChild(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'match-fixed' }));
        });
        if (drag && drag.moved) layer.appendChild(temp);
      }
      function select(el) {
        if (selected) { selected.classList.remove('is-selected'); selected.setAttribute('aria-pressed', 'false'); }
        selected = el;
        if (el) { el.classList.add('is-selected'); el.setAttribute('aria-pressed', 'true'); }
      }
      function connect(id, result, attempts) {
        const a = cardOf(id, 'left'), b = cardOf(id, 'right');
        [a, b].forEach((el) => { el.disabled = true; el.classList.add('is-matched'); });
        fixed.push(id);
        const w = pairs.find((p) => p.id === id);
        results.push({ itemId: id, text: w.text, attempts, result });
        doneCount++;
        ctx.onProgress(results.length, total);
        redraw();
        if (doneCount >= pairs.length) roundDone();
        else { const f = board.querySelector('.match-card:not(:disabled)'); if (f) f.focus(); }
      }
      function attempt(x, y) {
        const l = x.dataset.side === 'left' ? x : y;
        const r = l === x ? y : x;
        select(null);
        if (l.dataset.id === r.dataset.id) {
          const n = wrong[l.dataset.id] || 0;
          HG.feedback.show('correct', HG.feedback.praise());
          connect(l.dataset.id, n ? 'retry' : 'first', n + 1);
          return;
        }
        const n = (wrong[l.dataset.id] = (wrong[l.dataset.id] || 0) + 1);
        [l, r].forEach((el) => { el.classList.add('is-wrong'); setTimeout(() => el.classList.remove('is-wrong'), 700); });
        if (n >= 3) {
          const w = pairs.find((p) => p.id === l.dataset.id);
          HG.feedback.show('reveal', '함께 이어 봐요: ' + w.text, 1800);
          connect(l.dataset.id, 'revealed', n);
        } else HG.feedback.show('retry', HG.feedback.retryMsg());
      }
      board.addEventListener('pointerdown', (e) => {
        const c = e.target.closest('.match-card');
        if (!c || c.disabled || !e.isPrimary) return;
        drag = { card: c, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      });
      board.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12) { drag.moved = true; select(drag.card); }
        if (drag.moved) {
          const a = dot(drag.card), b = board.getBoundingClientRect();
          temp.setAttribute('x1', a.x); temp.setAttribute('y1', a.y);
          temp.setAttribute('x2', e.clientX - b.left); temp.setAttribute('y2', e.clientY - b.top);
          if (!temp.parentNode) layer.appendChild(temp);
        }
      });
      const endDrag = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag;
        drag = null;
        if (temp.parentNode) temp.parentNode.removeChild(temp);
        if (!d.moved) return;
        suppress = true;
        setTimeout(() => { suppress = false; }, 400);
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const t = el && el.closest('.match-card');
        if (t && !t.disabled && t.dataset.side !== d.card.dataset.side) attempt(d.card, t);
        else select(null);
      };
      board.addEventListener('pointerup', endDrag);
      board.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) { drag = null; if (temp.parentNode) temp.parentNode.removeChild(temp); select(null); } });
      board.addEventListener('click', (e) => {
        if (suppress) { suppress = false; return; }
        const c = e.target.closest('.match-card');
        if (!c || c.disabled) return;
        if (!selected || selected === c) select(selected === c ? null : c);
        else if (selected.dataset.side === c.dataset.side) select(c);
        else attempt(selected, c);
      });
      function skipRound() {
        pairs.forEach((w) => { if (!fixed.includes(w.id)) results.push({ itemId: w.id, text: w.text, attempts: wrong[w.id] || 0, result: 'skipped' }); });
        nextRound();
      }
      function roundDone() { bar(true); }
      function bar(done) {
        const last = ri + 1 >= rs.length;
        const nx = ui.btn(last ? '활동 마치기' : '다음 묶음', { variant: done ? 'accent' : 'secondary', icon: '▶', cls: 'icon-after', disabled: !done, onClick: nextRound });
        nx.dataset.role = 'next';
        ctx.bar([ui.btn('건너뛰기', { disabled: done, onClick: skipRound })], [], [nx]);
        if (done) setTimeout(() => nx.focus(), 50);
      }
      bar(false);
      if (ro) ro.disconnect();
      if (window.ResizeObserver) { ro = new ResizeObserver(redraw); ro.observe(board); }
    }
    function nextRound() {
      ri++;
      if (ri >= rs.length) { ctx.onFinish(results, { hintsUsed: 0 }); return; }
      renderRound();
    }
    if (!rs.length) { ctx.onFinish([], { hintsUsed: 0 }); return { destroy() { root.remove(); }, partial: () => [] }; }
    renderRound();
    return { destroy() { if (ro) ro.disconnect(); root.remove(); }, partial() { return results.slice(); } };
  }
  HG.activities.match = { id: 'match', start, rounds };
})();
