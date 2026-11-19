/* 받아쓰기 — 문장을 읽어 주면 받아쓰기 칸에 손으로 쓴다.
   [다시 듣기]로 몇 번이든 다시 듣고, [다 썼어요]를 누르면 정답이 칸 위에 나타나 스스로 비교한다.
   필기 획은 화면에만 그리고 저장하지 않는다 (SECURITY.md §2.1). 손글씨 자동 채점은 하지 않는다. */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const ui = HG.ui;
  const FONT = '"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR",sans-serif';

  // ---- 필기(곡선 보정) ----
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  function segment(c, st, i) {
    const p = st.pts;
    if (i === 0) { c.beginPath(); c.arc(p[0].x, p[0].y, p[0].w / 2, 0, Math.PI * 2); c.fill(); return; }
    c.lineWidth = p[i].w;
    c.beginPath();
    if (i === 1) { const m = mid(p[0], p[1]); c.moveTo(p[0].x, p[0].y); c.lineTo(m.x, m.y); }
    else { const m1 = mid(p[i - 2], p[i - 1]), m2 = mid(p[i - 1], p[i]); c.moveTo(m1.x, m1.y); c.quadraticCurveTo(p[i - 1].x, p[i - 1].y, m2.x, m2.y); }
    c.stroke();
  }
  function tail(c, st) {
    const p = st.pts, n = p.length;
    if (n < 2) return;
    const m = mid(p[n - 2], p[n - 1]);
    c.lineWidth = p[n - 1].w;
    c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(p[n - 1].x, p[n - 1].y); c.stroke();
  }

  /** 문장 → 받아쓰기 칸(띄어쓰기도 한 칸). 칸이 너무 많으면 두 줄 */
  function cells(text) { return Array.from(HG.hangul.norm(text).trim()); }
  function rowsOf(n) { return n <= 10 ? [n] : [Math.ceil(n / 2), Math.floor(n / 2)]; }

  function start(ctx) {
    const base = Math.max(10, Math.round(HG.state.settings.traceStrokeWidth * 0.75));
    const css = getComputedStyle(document.documentElement);
    const inkColor = css.getPropertyValue('--color-ink-stroke').trim() || '#172332';
    const answerColor = css.getPropertyValue('--color-gold').trim() || '#B8893A';
    const guideColor = css.getPropertyValue('--color-guide').trim() || '#C9C2B4';
    const opt = () => HG.state.settings;
    const results = [];
    let idx = 0;
    const root = h('div', { class: 'dict' });
    ctx.stage.appendChild(root);
    let s = null; // 현재 문제 상태

    function render() {
      clear(root);
      HG.tts.stop();
      const item = ctx.items[idx];
      ctx.onProgress(idx, ctx.items.length);
      s = { item, strokes: [], cur: null, active: null, rect: null, revealed: false, listens: 0, attempts: 0, layout: null, marks: null, correct: null };
      const listenBtn = ui.btn('다시 듣기', { variant: 'primary', icon: '🔊', cls: 'btn-listen', onClick: () => listen() });
      const slowBtn = ui.btn('천천히 한 글자씩', { icon: '🐢', onClick: () => listen(true) });
      s.count = h('p', { class: 'dict-count', 'aria-live': 'polite' });
      s.status = h('p', { class: 'dict-status', 'aria-live': 'polite' });
      const top = h('div', { class: 'dict-top' },
        h('p', { class: 'act-ask', text: (idx + 1) + '번 문장 — 잘 듣고 받아 써 보세요' }),
        h('div', { class: 'btn-row center' }, listenBtn, slowBtn),
        s.count, s.status);
      if (!HG.tts.supported() || !HG.tts.voice()) {
        top.appendChild(h('div', { class: 'notice dict-novoice' },
          h('span', { text: '한국어 음성이 없어요. 강사님이 읽어 주세요.' }),
          ui.btn('강사용 문장 보기', { onClick: () => HG.dialog.alert('강사용 — ' + (idx + 1) + '번 문장', item.text) })));
      }
      s.area = h('div', { class: 'dict-area' });
      s.answer = h('div', { class: 'dict-answer', 'aria-live': 'polite' });
      root.append(top, s.area, s.answer);
      bar();
      requestAnimationFrame(() => { layout(); setTimeout(() => listen(), 350); });
    }
    /** slow=true: 한 글자씩 또박또박(읽는 칸에 불이 들어옴), 아니면 문장 전체를 설정 속도로 */
    function listen(slow) {
      s.listens++;
      s.count.textContent = '들은 횟수: ' + s.listens + '번';
      const mark = (i) => { (s.boxEls || []).forEach((el, k) => el.classList.toggle('is-reading', k === i)); };
      const common = {
        onstart: () => { s.status.textContent = slow ? '🐢 한 글자씩 읽고 있습니다…' : '🔊 읽고 있습니다…'; },
        onend: (ok) => { mark(-1); s.status.textContent = ok ? '' : '소리를 내지 못했습니다.'; }
      };
      const started = slow
        ? HG.tts.speakSyllables(s.item.text, Object.assign({ rate: Math.min(0.8, HG.state.settings.ttsRate), onIndex: mark }, common))
        : HG.tts.speak(s.item.text, common);
      if (!started) s.status.textContent = '이 브라우저는 읽어 주기를 지원하지 않습니다.';
    }
    function layout() {
      if (!s || !s.area.isConnected) return;
      const cs = cells(s.item.text);
      const rows = rowsOf(cs.length);
      const aw = s.area.clientWidth, ah = s.area.clientHeight;
      const gap = 10, rgap = 24;
      const perRow = Math.max(...rows);
      const size = Math.max(90, Math.floor(Math.min((aw - gap * (perRow - 1)) / perRow, (ah - rgap * (rows.length - 1)) / rows.length, 220)));
      const W = perRow * size + (perRow - 1) * gap, H = rows.length * size + (rows.length - 1) * rgap;
      if (s.layout && s.layout.size !== size) {
        const k = size / s.layout.size;
        s.strokes.forEach((st) => st.pts.forEach((p) => { p.x *= k; p.y *= k; }));
      }
      const boxes = [];
      let ci = 0;
      rows.forEach((n, r) => { for (let i = 0; i < n; i++) { boxes.push({ x: i * (size + gap), y: r * (size + rgap), size, ch: cs[ci] }); ci++; } });
      s.layout = { W, H, size, boxes };
      clear(s.area);
      const row = h('div', { class: 'dict-row', style: { width: W + 'px', height: H + 'px' } });
      s.boxEls = boxes.map((b, i) => {
        const m = s.marks && s.marks[i];
        const el = h('div', { class: 'trace-box is-cross' + (b.ch === ' ' ? ' is-space' : '') + (m ? (m.ok ? ' is-ok' : ' is-bad') : ''), style: { left: b.x + 'px', top: b.y + 'px', width: b.size + 'px', height: b.size + 'px' } },
          m ? h('span', { class: 'box-mark', 'aria-hidden': 'true', text: (m.ok ? '✔' : '?') + (m.pct != null ? ' ' + m.pct + '%' : '') }) : null);
        row.appendChild(el);
        return el;
      });
      const dpr = window.devicePixelRatio || 1;
      s.guide = h('canvas', { class: 'trace-guide', 'aria-hidden': 'true' });
      s.ink = h('canvas', { class: 'trace-ink', role: 'img', 'aria-label': '받아쓰기 칸 ' + cs.length + '칸 (띄어쓰기 포함)' });
      [s.guide, s.ink].forEach((c) => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.setProperty('width', W + 'px'); c.style.setProperty('height', H + 'px'); row.appendChild(c); });
      s.area.appendChild(row);
      s.gctx = s.guide.getContext('2d'); s.gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.ictx = s.ink.getContext('2d', { desynchronized: true }) || s.ink.getContext('2d');
      s.ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.ictx.lineCap = 'round'; s.ictx.lineJoin = 'round'; s.ictx.strokeStyle = inkColor; s.ictx.fillStyle = inkColor;
      s.strokes.forEach((st) => { for (let i = 0; i < st.pts.length; i++) segment(s.ictx, st, i); if (st.ended) tail(s.ictx, st); });
      if (s.revealed && opt().dictGuide !== 'off') drawAnswer(answerColor, 0.45);
      else if (opt().dictGuide === 'always') drawAnswer(guideColor, 1);
      bindInk();
    }
    function drawAnswer(color, alpha) {
      const c = s.gctx;
      c.clearRect(0, 0, s.layout.W, s.layout.H);
      c.fillStyle = color;
      c.globalAlpha = alpha;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      s.layout.boxes.forEach((b) => {
        if (b.ch === ' ') return;
        c.font = '500 ' + Math.round(b.size * 0.72) + 'px ' + FONT;
        c.fillText(b.ch, b.x + b.size / 2, b.y + b.size * 0.53);
      });
      c.globalAlpha = 1;
    }
    function width(e) { return e.pointerType === 'pen' && e.pressure > 0 ? base * (0.8 + 0.4 * e.pressure) : base; }
    function addPoint(e) {
      const p = { x: e.clientX - s.rect.left, y: e.clientY - s.rect.top, w: width(e) };
      const pts = s.cur.pts;
      if (pts.length) { const l = pts[pts.length - 1]; if (Math.abs(l.x - p.x) + Math.abs(l.y - p.y) < 1) return; }
      pts.push(p);
      segment(s.ictx, s.cur, pts.length - 1);
    }
    function bindInk() {
      const ink = s.ink;
      ink.addEventListener('pointerdown', (e) => {
        if (s.revealed || s.active !== null || !e.isPrimary) return;
        e.preventDefault();
        s.active = e.pointerId;
        try { ink.setPointerCapture(s.active); } catch (err) { /* 무시 */ }
        s.rect = ink.getBoundingClientRect();
        s.cur = { pts: [], ended: false };
        s.strokes.push(s.cur);
        addPoint(e);
      });
      ink.addEventListener('pointermove', (e) => {
        if (e.pointerId !== s.active || !s.cur) return;
        const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
        (list.length ? list : [e]).forEach(addPoint);
      });
      const end = (e) => {
        if (s.active === null || e.pointerId !== s.active) return;
        if (s.cur) { s.cur.ended = true; tail(s.ictx, s.cur); }
        s.active = null; s.cur = null;
      };
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => ink.addEventListener(ev, end));
    }
    function erase() {
      s.strokes = [];
      if (s.ictx) s.ictx.clearRect(0, 0, s.layout.W, s.layout.H);
      if (s.revealed) { s.revealed = false; s.marks = null; s.correct = null; clear(s.answer); layout(); bar(); }
    }
    /** 칸별 판정: 잉크를 배율 1 캔버스에 다시 그려 HG.hw로 비교 */
    function judge() {
      const { W, H, boxes } = s.layout;
      const c = document.createElement('canvas');
      c.width = Math.ceil(W); c.height = Math.ceil(H);
      const x = c.getContext('2d');
      x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#000'; x.fillStyle = '#000';
      s.strokes.forEach((st) => { for (let i = 0; i < st.pts.length; i++) segment(x, st, i); if (st.ended) tail(x, st); });
      return boxes.map((b) => HG.hw.judgeBox(c, b, { minPct: opt().dictMinPct }));
    }
    function showAnswer() {
      clear(s.answer);
      const judged = !!s.marks;
      const line = h('p', { class: 'dict-answer-text' });
      if (judged) {
        const txt = s.overridden ? (s.correct ? '✔ 정답으로 인정 (강사 판정)' : '? 틀림으로 판정 (강사 판정)') : s.correct ? '✔ 정확하게 쓰셨어요' : '? 다시 확인해 볼 글자가 있어요';
        line.appendChild(h('span', { class: 'dict-verdict ' + (s.correct ? 'is-ok' : 'is-bad'), text: txt }));
      }
      line.appendChild(h('span', { class: 'dict-label', text: '정답: ' }));
      Array.from(HG.hangul.norm(s.item.text).trim()).forEach((ch, i) => {
        const m = judged && !s.overridden && s.marks[i];
        line.appendChild(h('span', { class: m && !m.ok ? 'ch-bad' : '', text: ch === ' ' ? (m && !m.ok ? '∨' : '\u00A0\u00A0') : ch }));
      });
      s.answer.appendChild(line);
    }
    function submit() {
      if (!s.strokes.length) { HG.toast.show('들은 문장을 칸에 써 볼까요?'); HG.feedback.announce('들은 문장을 칸에 써 볼까요?'); return; }
      s.attempts++;
      s.revealed = true;
      s.overridden = false;
      if (opt().dictJudge) {
        s.marks = judge();
        HG.activities.dictation.lastMarks = s.marks; // 점검용(개발자 도구에서 확인)
        s.correct = s.marks.every((m) => m.ok);
      } else { s.marks = null; s.correct = null; }
      layout();
      showAnswer();
      record();
      if (s.correct === null) HG.feedback.show('correct', HG.feedback.praise() + ' 정답과 비교해 보세요.', 1600);
      else if (s.correct) HG.feedback.show('correct', '정확하게 쓰셨어요! ' + HG.feedback.praise(), 1600);
      else {
        const bad = s.marks.filter((m) => !m.ok).length;
        HG.feedback.show('retry', bad + '칸을 다시 확인해 볼까요?', 1800);
      }
      bar();
    }
    function record() {
      const res = s.correct === false ? 'wrong' : s.attempts > 1 ? 'retry' : 'first';
      results[idx] = { itemId: s.item.id, text: s.item.text, attempts: s.attempts, result: res, listens: s.listens };
    }
    /** 강사 판정 바꾸기 */
    function override() {
      s.correct = !s.correct;
      s.overridden = true;
      record();
      showAnswer();
      HG.feedback.announce(s.correct ? '정답으로 바꾸었습니다.' : '틀린 답으로 바꾸었습니다.');
      bar();
    }
    function skip() {
      if (!results[idx]) results[idx] = { itemId: s.item.id, text: s.item.text, attempts: s.attempts, result: 'skipped', listens: s.listens };
      next();
    }
    function next() {
      HG.tts.stop();
      idx++;
      if (idx >= ctx.items.length) {
        ctx.onFinish(ctx.items.map((it, i) => results[i] || { itemId: it.id, text: it.text, attempts: 0, result: 'skipped' }), { hintsUsed: 0 });
        return;
      }
      render();
    }
    function bar() {
      const last = idx + 1 >= ctx.items.length;
      if (s.revealed) {
        const nx = ui.btn(last ? '받아쓰기 마치기' : '다음 문장', { variant: 'accent', icon: '▶', cls: 'icon-after', onClick: next });
        nx.dataset.role = 'next';
        const center = [ui.btn('다시 듣기', { icon: '🔊', onClick: () => listen() })];
        if (s.correct !== null) center.push(ui.btn(s.correct ? '틀림으로 바꾸기' : '맞음으로 바꾸기', { cls: 'btn-sm-text', ariaLabel: (s.correct ? '틀림으로 바꾸기' : '맞음으로 바꾸기') + ' (강사 판정)', onClick: override }));
        ctx.bar([ui.btn('다시 써 보기', { icon: '↺', onClick: erase })], center, [nx]);
        setTimeout(() => nx.focus(), 50);
      } else {
        const sub = ui.btn('다 썼어요', { variant: 'primary', icon: '✔', onClick: submit });
        sub.dataset.role = 'next';
        ctx.bar([ui.btn('건너뛰기', { onClick: skip })], [ui.btn('지우기', { icon: '⌫', onClick: erase })], [sub]);
      }
    }
    const onResize = () => { if (s && s.layout) layout(); };
    window.addEventListener('resize', onResize);
    render();
    return {
      destroy() { HG.tts.stop(); window.removeEventListener('resize', onResize); root.remove(); },
      partial() { return results.filter(Boolean); },
      listen: () => listen()
    };
  }
  HG.activities.dictation = { id: 'dictation', start, cells, rowsOf };
})();
