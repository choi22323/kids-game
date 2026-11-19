/* ① 깍두기 칸 글씨 따라쓰기 (FEATURES.md F-05)
   Pointer Events + getCoalescedEvents + 중점 quadraticCurveTo 곡선 보정, lineCap/lineJoin round.
   필기 획은 판정에만 쓰고 저장하지 않는다 (SECURITY.md §2.1). */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const ui = HG.ui;
  const FONT = '"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR",sans-serif';
  const CELL = 6;

  function chunks(text) {
    const s = HG.hangul.syllables(text);
    const out = [];
    for (let i = 0; i < s.length; i += 4) out.push(s.slice(i, i + 4));
    return out.length ? out : [['']];
  }
  function drawGlyphs(c, letters, boxes, color, strokeW) {
    c.fillStyle = color;
    c.strokeStyle = color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    letters.forEach((ch, i) => {
      const b = boxes[i];
      c.font = '500 ' + Math.round(b.size * 0.74) + 'px ' + FONT;
      const cx = b.x + b.size / 2, cy = b.y + b.size * 0.53;
      c.fillText(ch, cx, cy);
      if (strokeW) { c.lineWidth = strokeW; c.strokeText(ch, cx, cy); }
    });
  }
  function cellsOf(canvas, W, H) {
    const d = canvas.getContext('2d').getImageData(0, 0, W, H).data;
    const gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL);
    const cells = new Uint8Array(gw * gh);
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      if (d[(y * W + x) * 4 + 3] > 96) cells[Math.floor(y / CELL) * gw + Math.floor(x / CELL)] = 1;
    }
    return { cells, gw, gh };
  }
  /** 순수 계산: 글자 칸별 덧쓰기 비율(coverage)과 칸 밖 잉크 비율(outside) */
  function coverageFromMasks(g, t, k, gw, gh, ranges) {
    const near = (x, y) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < gw && yy < gh && k[yy * gw + xx]) return true;
      }
      return false;
    };
    const per = ranges.map(([x0, x1]) => {
      let tot = 0, cov = 0;
      for (let y = 0; y < gh; y++) for (let x = Math.max(0, x0); x < Math.min(gw, x1); x++) {
        if (g[y * gw + x]) { tot++; if (near(x, y)) cov++; }
      }
      return tot ? cov / tot : 0;
    });
    let ink = 0, out = 0;
    for (let i = 0; i < k.length; i++) if (k[i]) { ink++; if (!t[i]) out++; }
    return { perLetter: per, coverage: per.length ? per.reduce((a, b) => a + b, 0) / per.length : 0, outside: ink ? out / ink : 0, inkCells: ink };
  }
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
  function replay(c, st) { for (let i = 0; i < st.pts.length; i++) segment(c, st, i); if (st.ended) tail(c, st); }
  function inkStyle(c, color) { c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = color; c.fillStyle = color; }

  function start(ctx) {
    const opt = (ctx.set.activityOptions && ctx.set.activityOptions.trace) || {};
    const repeat = Math.min(3, Math.max(1, opt.repeat || 1));
    const grid = opt.gridStyle || 'cross';
    const base = HG.state.settings.traceStrokeWidth;
    const css = getComputedStyle(document.documentElement);
    const guideColor = css.getPropertyValue('--color-guide').trim() || '#C9C2B4';
    const inkColor = css.getPropertyValue('--color-ink-stroke').trim() || '#172332';

    const screens = [];
    ctx.items.forEach((w) => {
      for (let r = 0; r < repeat; r++) {
        const cs = chunks(w.text);
        cs.forEach((letters, ci) => screens.push({ w, r, letters, ci, cn: cs.length }));
      }
    });
    const res = {}; // key -> {w, r, chunks:{ci:{coverage,outside}|'skip'}, attempts}
    let idx = 0, strokes = [], cur = null, active = null, rect = null, warned = false, done = false, layout = null;
    let guide, ink, ictx, area, row;
    const root = h('div', { class: 'trace' });
    ctx.stage.appendChild(root);
    const keyOf = (s) => s.w.id + '#' + s.r;

    function render() {
      clear(root);
      strokes = []; cur = null; active = null; warned = false; done = false; layout = null;
      const s = screens[idx];
      ctx.onProgress(idx, screens.length);
      const pic = s.w.image ? HG.images.render(s.w.image, { cls: 'trace-pic', noFallback: true }) : null;
      const label = HG.act.josa("'" + s.w.text + "'", '을', '를');
      root.appendChild(h('div', { class: 'trace-prompt' }, pic,
        h('p', { class: 'trace-msg', text: label.replace(/'(.+)'/, '‘$1’') + ' 따라 써 보세요' + (s.cn > 1 ? ' (' + (s.ci + 1) + '/' + s.cn + ')' : '') })));
      area = h('div', { class: 'trace-area' });
      row = h('div', { class: 'trace-row' });
      guide = h('canvas', { class: 'trace-guide', 'aria-hidden': 'true' });
      ink = h('canvas', { class: 'trace-ink', role: 'img', 'aria-label': s.letters.join('') + ' 글씨를 따라 쓰는 칸' });
      area.appendChild(row);
      root.appendChild(area);
      bindInk();
      bar();
      requestAnimationFrame(layoutRow);
    }
    function layoutRow() {
      if (!area || !area.isConnected) return;
      const s = screens[idx];
      const n = s.letters.length;
      const aw = area.clientWidth, ah = area.clientHeight;
      const gap = Math.max(16, Math.round(aw * 0.015));
      const size = Math.max(120, Math.floor(Math.min((aw - gap * (n - 1)) / n, ah, 440)));
      const W = n * size + (n - 1) * gap, H = size;
      const dpr = window.devicePixelRatio || 1;
      if (layout && layout.size !== size) {
        const k = size / layout.size;
        strokes.forEach((st) => st.pts.forEach((p) => { p.x *= k; p.y *= k; }));
      }
      const boxes = s.letters.map((_, i) => ({ x: i * (size + gap), y: 0, size }));
      layout = { W, H, size, gap, boxes };
      clear(row);
      row.style.setProperty('width', W + 'px');
      row.style.setProperty('height', H + 'px');
      boxes.forEach((b) => row.appendChild(h('div', { class: 'trace-box' + (grid === 'cross' ? ' is-cross' : ''), style: { left: b.x + 'px', width: b.size + 'px', height: b.size + 'px' } })));
      [guide, ink].forEach((c) => {
        c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
        c.style.setProperty('width', W + 'px'); c.style.setProperty('height', H + 'px');
        row.appendChild(c);
      });
      const g = guide.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGlyphs(g, s.letters, boxes, guideColor);
      ictx = ink.getContext('2d', { desynchronized: true }) || ink.getContext('2d');
      ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
      inkStyle(ictx, inkColor);
      strokes.forEach((st) => replay(ictx, st));
    }
    function width(e) {
      if (e.pointerType === 'pen' && e.pressure > 0) return base * (0.8 + 0.4 * e.pressure);
      return base;
    }
    function addPoint(e) {
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top, w: width(e) };
      const pts = cur.pts;
      if (pts.length) { const l = pts[pts.length - 1]; if (Math.abs(l.x - p.x) + Math.abs(l.y - p.y) < 1) return; }
      pts.push(p);
      segment(ictx, cur, pts.length - 1);
    }
    function endStroke(e) {
      if (active === null || (e && e.pointerId !== active)) return;
      if (cur) { cur.ended = true; tail(ictx, cur); }
      active = null; cur = null;
    }
    function bindInk() {
      ink.addEventListener('pointerdown', (e) => {
        if (done || active !== null || !e.isPrimary || !ictx) return;
        e.preventDefault();
        active = e.pointerId;
        try { ink.setPointerCapture(active); } catch (err) { /* 무시 */ }
        rect = ink.getBoundingClientRect();
        cur = { pts: [], ended: false };
        strokes.push(cur);
        addPoint(e);
      });
      ink.addEventListener('pointermove', (e) => {
        if (e.pointerId !== active || !cur) return;
        const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
        (list.length ? list : [e]).forEach(addPoint);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => ink.addEventListener(ev, endStroke));
    }
    function erase() {
      strokes = []; warned = false;
      if (done) { done = false; delete (res[keyOf(screens[idx])] || { chunks: {} }).chunks[screens[idx].ci]; bar(); }
      if (ictx) ictx.clearRect(0, 0, layout.W, layout.H);
    }
    function measure() {
      const s = screens[idx];
      const { W, H, boxes } = layout;
      const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
      const gc = mk(); drawGlyphs(gc.getContext('2d'), s.letters, boxes, '#000');
      const tc = mk(); drawGlyphs(tc.getContext('2d'), s.letters, boxes, '#000', base * 1.6);
      const kc = mk(); const kx = kc.getContext('2d'); inkStyle(kx, '#000'); strokes.forEach((st) => replay(kx, st));
      const G = cellsOf(gc, W, H), T = cellsOf(tc, W, H), K = cellsOf(kc, W, H);
      const ranges = boxes.map((b) => [Math.floor(b.x / CELL), Math.ceil((b.x + b.size) / CELL)]);
      return coverageFromMasks(G.cells, T.cells, K.cells, G.gw, G.gh, ranges);
    }
    function entry(s) {
      const k = keyOf(s);
      if (!res[k]) res[k] = { w: s.w, r: s.r, cn: s.cn, chunks: {}, attempts: 0 };
      return res[k];
    }
    function submit() {
      if (!strokes.length) { HG.toast.show('글씨를 따라 써 볼까요?'); HG.feedback.announce('글씨를 따라 써 볼까요?'); return; }
      const m = measure();
      if (m.coverage < 0.1 && !warned) { warned = true; HG.feedback.show('retry', '조금 더 따라 써 볼까요?'); return; }
      const e = entry(screens[idx]);
      e.attempts++;
      e.chunks[screens[idx].ci] = { coverage: m.coverage, outside: m.outside };
      done = true;
      HG.feedback.show('correct', HG.feedback.praise());
      bar(true);
    }
    function skip() {
      const e = entry(screens[idx]);
      if (!e.chunks[screens[idx].ci]) e.chunks[screens[idx].ci] = 'skip';
      next();
    }
    function next() {
      idx++;
      if (idx >= screens.length) { ctx.onFinish(collect(false), { hintsUsed: 0 }); return; }
      render();
    }
    function prev() { if (idx > 0) { idx--; render(); } }
    function collect(partialOnly) {
      const out = [];
      const keys = [];
      screens.forEach((s) => { const k = keyOf(s); if (!keys.includes(k)) keys.push(k); });
      keys.forEach((k) => {
        const e = res[k];
        if (!e) { if (!partialOnly) { const s = screens.find((x) => keyOf(x) === k); out.push({ itemId: s.w.id + (s.r ? '#' + (s.r + 1) : ''), text: s.w.text, attempts: 0, result: 'skipped' }); } return; }
        const vals = Object.values(e.chunks).filter((v) => v !== 'skip');
        const id = e.w.id + (e.r ? '#' + (e.r + 1) : '');
        if (!vals.length) { out.push({ itemId: id, text: e.w.text, attempts: e.attempts, result: 'skipped' }); return; }
        const coverage = vals.reduce((a, v) => a + v.coverage, 0) / e.cn;
        const outside = vals.reduce((a, v) => a + v.outside, 0) / vals.length;
        out.push({ itemId: id, text: e.w.text, attempts: e.attempts, result: 'first', coverage, outside });
      });
      return out;
    }
    function bar(afterDone) {
      const prevB = ui.btn('이전', { icon: '◀', disabled: idx === 0, onClick: prev });
      prevB.dataset.role = 'prev';
      if (afterDone) {
        const nx = ui.btn(idx + 1 >= screens.length ? '활동 마치기' : '다음', { variant: 'accent', icon: '▶', cls: 'icon-after', onClick: next });
        nx.dataset.role = 'next';
        ctx.bar([prevB], [ui.btn('다시 쓰기', { icon: '↺', onClick: erase })], [nx]);
        setTimeout(() => nx.focus(), 50);
      } else {
        const sub = ui.btn('다 썼어요', { variant: 'primary', icon: '✔', onClick: submit });
        sub.dataset.role = 'next';
        ctx.bar([prevB], [ui.btn('지우기', { icon: '⌫', onClick: erase }), ui.btn('건너뛰기', { onClick: skip })], [sub]);
      }
    }
    const onResize = () => { if (layout) layoutRow(); };
    window.addEventListener('resize', onResize);
    render();
    return {
      destroy() { window.removeEventListener('resize', onResize); root.remove(); },
      partial() { return collect(true); }
    };
  }
  HG.activities.trace = { id: 'trace', start, coverageFromMasks, chunks };
})();
