/* 받아쓰기 — 문장을 읽어 주면 받아쓰기 칸에 손으로 쓴다.
   [다시 듣기]로 몇 번이든 다시 듣고, [다 썼어요]를 누르면 바로 아래에 '같은 모양의 정답 칸'이 나타나
   칸끼리 비교하며 스스로(또는 강사와 함께) 확인한다. 손글씨 자동 채점은 하지 않는다.
   필기 획은 화면에만 그리고 저장하지 않는다 (SECURITY.md §2.1). */
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
  /** n칸을 한 줄 최대 max칸으로 고르게 나눔: rowsOf(13) → [7, 6] */
  function rowsOf(n, max) {
    max = max || 10;
    if (n <= max) return [n];
    const r = Math.ceil(n / max), base = Math.floor(n / r), extra = n % r;
    return Array.from({ length: r }, (_, i) => base + (i < extra ? 1 : 0));
  }
  /** 화면 크기에 맞춰 칸이 가장 크게 보이는 줄 나눔을 고른다 (휴대폰 세로: 줄을 늘림, 가로·칠판: 한 줄에 많이) */
  function fit(n, aw, ah, opts) {
    let best = null;
    for (let max = 10; max >= 3; max--) {
      const rows = rowsOf(n, max);
      const perRow = Math.max(...rows);
      const nRows = rows.length * opts.copies;
      const size = Math.floor(Math.min((aw - opts.gap * (perRow - 1)) / perRow, (ah - opts.labelH - opts.rgap * (nRows - 1)) / nRows, 220));
      if (!best || size > best.size) best = { rows, perRow, size };
    }
    return best;
  }

  function start(ctx) {
    const base = Math.max(10, Math.round(HG.state.settings.traceStrokeWidth * 0.75));
    const css = getComputedStyle(document.documentElement);
    const inkColor = css.getPropertyValue('--color-ink-stroke').trim() || '#172332';
    const guideColor = css.getPropertyValue('--color-guide').trim() || '#C9C2B4';
    const answerColor = css.getPropertyValue('--color-navy').trim() || '#1E3A5F';
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
      s = { item, strokes: [], cur: null, active: null, rect: null, revealed: false, listens: 0, attempts: 0, layout: null };
      const listenBtn = ui.btn('다시 듣기', { variant: 'primary', icon: '🔊', cls: 'btn-listen', onClick: () => listen() });
      const slowBtn = ui.btn('천천히 한 글자씩', { icon: '🐢', onClick: () => listen(true) });
      // 들은 횟수·읽는 중 안내는 높이·너비가 고정된 한 줄에 둔다 (글이 바뀌어도 쓰는 칸이 움직이지 않게)
      s.count = h('span', { class: 'dict-count', text: '들은 횟수: 0번' });
      s.status = h('span', { class: 'dict-status', 'aria-live': 'polite' });
      const info = h('p', { class: 'dict-info' }, s.count, s.status);
      const top = h('div', { class: 'dict-top' },
        h('p', { class: 'act-ask', text: (idx + 1) + '번 문장 — 잘 듣고 받아 써 보세요' }),
        h('div', { class: 'btn-row center' }, listenBtn, slowBtn),
        info);
      if (!HG.tts.supported() || !HG.tts.voice()) {
        top.appendChild(h('div', { class: 'notice dict-novoice' },
          h('span', { class: 'dict-novoice-text', text: '한국어 음성이 없어요. 강사님이 읽어 주세요.' }),
          ui.btn('강사용 문장 보기', { onClick: () => HG.dialog.alert('강사용 — ' + (idx + 1) + '번 문장', item.text) })));
      }
      s.area = h('div', { class: 'dict-area' });
      s.answer = h('div', { class: 'sr-only', 'aria-live': 'polite' });
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
    /** 칸 배치. 정답을 보여 줄 때는 내 칸 아래에 '▼ 정답' 줄과 같은 크기의 정답 칸을 둔다 */
    function layout() {
      if (!s || !s.area.isConnected) return;
      const cs = cells(s.item.text);
      const aw = s.area.clientWidth, ah = s.area.clientHeight;
      const small = aw < 700 || ah < 420;
      const gap = small ? 6 : 10;
      // 정답 칸을 아래에 둘 자리가 모자라면(휴대폰 가로 등) 내 칸 안에 정답을 흐리게 겹쳐 보여 준다
      let mode = 'below';
      let f = fit(cs.length, aw, ah, { copies: s.revealed ? 2 : 1, gap, rgap: s.revealed ? 8 : (small ? 12 : 24), labelH: s.revealed ? (small ? 32 : 44) : 0 });
      if (s.revealed && f.size < 48) {
        const o = fit(cs.length, aw, ah, { copies: 1, gap, rgap: small ? 12 : 24, labelH: small ? 32 : 44 });
        if (o.size > f.size * 1.3) { mode = 'overlay'; f = o; }
      }
      const rows = f.rows, perRow = f.perRow;
      const rgap = s.revealed && mode === 'below' ? 8 : (small ? 12 : 24);
      const labelH = s.revealed ? (small ? 32 : 44) : 0;
      const size = Math.max(28, f.size);
      const W = perRow * size + (perRow - 1) * gap;
      const H = rows.length * size + (rows.length - 1) * rgap; // 내가 쓰는 칸 영역
      if (s.layout && s.layout.size !== size) {
        const k = size / s.layout.size;
        s.strokes.forEach((st) => st.pts.forEach((p) => { p.x *= k; p.y *= k; }));
      }
      const place = (top) => { const out = []; let ci = 0; rows.forEach((n, r) => { for (let i = 0; i < n; i++) { out.push({ x: i * (size + gap), y: top + r * (size + rgap), size, ch: cs[ci] }); ci++; } }); return out; };
      const boxes = place(0);
      s.layout = { W, H, size, boxes, mode };
      clear(s.area);
      const totalH = !s.revealed ? H : mode === 'below' ? H * 2 + labelH : H + labelH;
      const row = h('div', { class: 'dict-row', style: { width: W + 'px', height: totalH + 'px' } });
      s.boxEls = boxes.map((b) => {
        const el = h('div', { class: 'trace-box is-cross' + (b.ch === ' ' ? ' is-space' : ''), style: { left: b.x + 'px', top: b.y + 'px', width: b.size + 'px', height: b.size + 'px' } });
        row.appendChild(el);
        return el;
      });
      if (s.revealed && mode === 'overlay') {
        row.appendChild(h('div', { class: 'dict-answer-label', style: { top: H + 'px', height: labelH + 'px', width: W + 'px' }, text: '정답: ' + s.item.text }));
      } else if (s.revealed) {
        row.appendChild(h('div', { class: 'dict-answer-label', style: { top: H + 'px', height: labelH + 'px', width: W + 'px' }, text: '▼ 정답과 비교해 보세요' }));
        place(H + labelH).forEach((b) => row.appendChild(h('div', { class: 'trace-box is-cross is-answer' + (b.ch === ' ' ? ' is-space' : ''), 'aria-hidden': 'true',
          style: { left: b.x + 'px', top: b.y + 'px', width: b.size + 'px', height: b.size + 'px', 'font-size': Math.round(b.size * 0.72) + 'px' } }, b.ch === ' ' ? '' : b.ch)));
      }
      const dpr = window.devicePixelRatio || 1;
      s.guide = h('canvas', { class: 'trace-guide', 'aria-hidden': 'true' });
      s.ink = h('canvas', { class: 'trace-ink', role: 'img', 'aria-label': '받아쓰기 칸 ' + cs.length + '칸 (띄어쓰기 포함)' });
      [s.guide, s.ink].forEach((c) => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.setProperty('width', W + 'px'); c.style.setProperty('height', H + 'px'); row.appendChild(c); });
      s.area.appendChild(row);
      if (ro && !s.observed) { ro.observe(s.area); s.observed = true; }
      lastArea = s.area.clientWidth + 'x' + s.area.clientHeight;
      s.gctx = s.guide.getContext('2d'); s.gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.ictx = s.ink.getContext('2d', { desynchronized: true }) || s.ink.getContext('2d');
      s.ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.ictx.lineCap = 'round'; s.ictx.lineJoin = 'round'; s.ictx.strokeStyle = inkColor; s.ictx.fillStyle = inkColor;
      s.strokes.forEach((st) => { for (let i = 0; i < st.pts.length; i++) segment(s.ictx, st, i); if (st.ended) tail(s.ictx, st); });
      if (s.revealed && mode === 'overlay') drawGuide(answerColor, 0.55);
      else if (opt().dictGuide === 'always') drawGuide();
      bindInk();
    }
    /** (선택) 쓸 때부터 칸 안에 흐린 글씨 */
    function drawGuide(color, alpha) {
      const c = s.gctx;
      c.clearRect(0, 0, s.layout.W, s.layout.H);
      c.fillStyle = color || guideColor;
      c.globalAlpha = alpha == null ? 1 : alpha;
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
      if (s.revealed) { s.revealed = false; s.answer.textContent = ''; bar(); layout(); }
    }
    function submit() {
      if (!s.strokes.length) { HG.toast.show('들은 문장을 칸에 써 볼까요?'); HG.feedback.announce('들은 문장을 칸에 써 볼까요?'); return; }
      s.attempts++;
      s.revealed = true;
      bar();
      layout();
      s.answer.textContent = '정답: ' + s.item.text;
      results[idx] = { itemId: s.item.id, text: s.item.text, attempts: s.attempts, result: s.attempts > 1 ? 'retry' : 'first', listens: s.listens };
      HG.feedback.show('correct', HG.feedback.praise() + ' 아래 정답과 비교해 보세요.', 1600);
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
    let lastArea = '', raf = 0;
    const ro = window.ResizeObserver ? new ResizeObserver(() => {
      if (!s || !s.area || !s.area.isConnected || !s.layout) return;
      const k = s.area.clientWidth + 'x' + s.area.clientHeight;
      if (k === lastArea) return;
      lastArea = k;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(layout);
    }) : null;
    render();
    return {
      destroy() { HG.tts.stop(); window.removeEventListener('resize', onResize); if (ro) ro.disconnect(); root.remove(); },
      partial() { return results.filter(Boolean); },
      listen: () => listen()
    };
  }
  HG.activities.dictation = { id: 'dictation', start, cells, rowsOf, fit };
})();
