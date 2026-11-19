/* 손글씨 칸별 정답 판정 (보조 기능) — 외부 라이브러리·인터넷 없이 모양 비교로 판정한다.
   방법: 칸 안 잉크와 '정답 글자' 및 '헷갈리기 쉬운 글자'(초성·중성·받침을 하나씩 바꾼 글자 약 50개)를
   같은 크기(48×48)로 맞춘 뒤 '일치도(%)'를 구한다.
   일치도가 기준(기본 60%) 이상이고, 다른 글자가 훨씬 더 비슷하지 않으면 '정답'으로 본다.
   한계: 필기 습관에 따라 틀리게 판정될 수 있으므로 강사가 판정을 바꿀 수 있게 한다(확인 필요). */
(function () {
  'use strict';
  const N = 48;
  const FONT = '"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR",sans-serif';
  const BASE = 0xAC00;
  const JONG_TRY = [0, 1, 4, 7, 8, 16, 17, 19, 21, 27];
  const glyphCache = new Map();

  const isSyl = (ch) => { const c = ch.charCodeAt(0); return c >= BASE && c <= 0xD7A3; };
  function decompose(ch) { const k = ch.charCodeAt(0) - BASE; return [Math.floor(k / 588), Math.floor((k % 588) / 28), k % 28]; }
  function compose(c, j, t) { return String.fromCharCode(BASE + (c * 21 + j) * 28 + t); }
  /** 정답 글자와 헷갈리기 쉬운 글자 목록(정답 포함) */
  function candidates(ch) {
    if (!isSyl(ch)) return [ch];
    const [c, j, t] = decompose(ch);
    const out = new Set([ch]);
    for (let x = 0; x < 19; x++) out.add(compose(x, j, t));
    for (let x = 0; x < 21; x++) out.add(compose(c, x, t));
    JONG_TRY.concat([t]).forEach((x) => out.add(compose(c, j, x)));
    return Array.from(out);
  }

  /** Zhang-Suen 세선화: 획을 1픽셀 가운데 선으로 */
  function thin(img) {
    const a = img.slice();
    const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : a[y * N + x]);
    let changed = true;
    while (changed) {
      changed = false;
      for (let pass = 0; pass < 2; pass++) {
        const del = [];
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          if (!a[y * N + x]) continue;
          const q = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
          const b = q.reduce((t, v) => t + v, 0);
          if (b < 2 || b > 6) continue;
          let t = 0;
          for (let k = 0; k < 8; k++) if (!q[k] && q[(k + 1) % 8]) t++;
          if (t !== 1) continue;
          if (pass === 0 ? (q[0] && q[2] && q[4]) || (q[2] && q[4] && q[6]) : (q[0] && q[2] && q[6]) || (q[0] && q[4] && q[6])) continue;
          del.push(y * N + x);
        }
        if (del.length) { changed = true; del.forEach((i) => { a[i] = 0; }); }
      }
    }
    return a;
  }
  /** 3-4 거리 변환(가까운 잉크까지의 거리, 픽셀 단위) */
  function distance(bin) {
    const INF = 1e6, dt = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) dt[i] = bin[i] ? 0 : INF;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (x > 0) dt[i] = Math.min(dt[i], dt[i - 1] + 3);
      if (y > 0) dt[i] = Math.min(dt[i], dt[i - N] + 3);
      if (x > 0 && y > 0) dt[i] = Math.min(dt[i], dt[i - N - 1] + 4);
      if (x < N - 1 && y > 0) dt[i] = Math.min(dt[i], dt[i - N + 1] + 4);
    }
    for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) {
      const i = y * N + x;
      if (x < N - 1) dt[i] = Math.min(dt[i], dt[i + 1] + 3);
      if (y < N - 1) dt[i] = Math.min(dt[i], dt[i + N] + 3);
      if (x < N - 1 && y < N - 1) dt[i] = Math.min(dt[i], dt[i + N + 1] + 4);
      if (x > 0 && y < N - 1) dt[i] = Math.min(dt[i], dt[i + N - 1] + 4);
    }
    for (let i = 0; i < N * N; i++) dt[i] /= 3;
    return dt;
  }
  /** 칸(가로세로 같은 정사각형)을 48×48 격자로 줄여 잉크 여부를 구한다 — 늘리지 않으므로 위치·크기가 그대로 반영됨 */
  function gridOf(src, x, y, size) {
    const c = document.createElement('canvas');
    c.width = N; c.height = N;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, x, y, size, size, 0, 0, N, N);
    const g = ctx.getImageData(0, 0, N, N).data;
    const out = new Uint8Array(N * N);
    let on = 0;
    for (let i = 0; i < N * N; i++) if (g[i * 4 + 3] > 40) { out[i] = 1; on++; }
    return on >= 4 ? out : null;
  }
  /** 정답 글자를 칸 안 표준 위치(받아쓰기 칸 안내 글씨와 같은 자리)에 크기 배율 sc로 그린 격자 (캐시) */
  function glyph(ch, sc) {
    sc = sc || 1;
    const key = ch + '|' + sc;
    if (glyphCache.has(key)) return glyphCache.get(key);
    const S = 128;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '500 ' + Math.round(S * 0.72 * sc) + 'px ' + FONT;
    ctx.fillText(ch, S / 2, S * 0.53);
    const bin = gridOf(c, 0, 0, S);
    const g = bin ? { bin, dt: distance(bin), skel: thin(bin) } : null;
    glyphCache.set(key, g);
    return g;
  }
  const TOL = 1.2; // 48칸 격자에서 '획 위에 있다'고 보는 거리(약 칸의 2.5%)
  /** 일치도(%): ①쓴 획이 정답 글자 획 위에 있는 비율 ②정답 글자의 가운데 선이 쓴 획으로 덮인 비율의 조화평균.
      정답 글자를 (dx, dy)칸 옮겨 비교한다. 가운데 선과 비교하므로 획 굵기 차이에 덜 흔들린다. */
  function matchPct(ink, inkDt, g, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    let a = 0, an = 0, b = 0, bn = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const gx = x - dx, gy = y - dy;
      const inside = gx >= 0 && gy >= 0 && gx < N && gy < N;
      const j = gy * N + gx;
      if (ink[i]) { an++; if (inside && g.dt[j] <= TOL) a++; }
      if (inside && g.skel[j]) { bn++; if (inkDt[i] <= TOL) b++; }
    }
    const p = an ? a / an : 0, r = bn ? b / bn : 0;
    return p + r ? Math.round((2 * p * r) / (p + r) * 100) : 0;
  }
  const SCALES = [0.75, 0.9, 1, 1.15];
  const SHIFT = 4; // ±4칸(칸 크기의 약 8%)까지 위치 차이 허용
  /** 정답 글자에 대해 가장 잘 맞는 크기·위치를 찾는다 */
  function bestFit(ink, inkDt, ch) {
    let best = { pct: 0, sc: 1, dx: 0, dy: 0 };
    SCALES.forEach((sc) => {
      const g = glyph(ch, sc);
      if (!g) return;
      for (let dy = -SHIFT; dy <= SHIFT; dy++) for (let dx = -SHIFT; dx <= SHIFT; dx++) {
        const v = matchPct(ink, inkDt, g, dx, dy);
        if (v > best.pct) best = { pct: v, sc, dx, dy };
      }
    });
    return best;
  }
  const MIN_PCT = 60;   // 맞음 기준 일치도(설정에서 바꿀 수 있음)
  const GUARD = 3;      // 다른 글자가 이만큼(%p) 더 비슷하면 '다른 글자'로 판정
  /**
   * 칸 하나 판정
   * @param {HTMLCanvasElement} canvas 잉크가 그려진 캔버스(배율 1)
   * @param {{x:number,y:number,size:number,ch:string}} box
   * @param {{minPct?:number, guard?:number}} [opts]
   * @returns {{ok:boolean, reason:string, pct?:number, best?:string, bestPct?:number}}
   */
  function judgeBox(canvas, box, opts) {
    opts = opts || {};
    const minPct = opts.minPct == null ? MIN_PCT : opts.minPct;
    const guard = opts.guard == null ? GUARD : opts.guard;
    const ink = gridOf(canvas, Math.round(box.x), Math.round(box.y), Math.round(box.size));
    if (box.ch === ' ') return ink ? { ok: false, reason: 'space' } : { ok: true, reason: 'space-ok' };
    if (!ink) return { ok: false, reason: 'empty', pct: 0 };
    if (!isSyl(box.ch)) return { ok: true, reason: 'not-hangul' }; // 숫자·문장부호는 판정하지 않음
    const inkDt = distance(ink);
    const fit = bestFit(ink, inkDt, box.ch);
    const pct = fit.pct;
    // 헷갈리는 글자는 정답 글자에 가장 잘 맞은 크기·위치(±1칸)로 비교
    let best = box.ch, bestPct = pct;
    candidates(box.ch).forEach((c) => {
      if (c === box.ch) return;
      const g = glyph(c, fit.sc);
      if (!g) return;
      let v = 0;
      for (let dy = fit.dy - 1; dy <= fit.dy + 1; dy++) for (let dx = fit.dx - 1; dx <= fit.dx + 1; dx++) v = Math.max(v, matchPct(ink, inkDt, g, dx, dy));
      if (v > bestPct) { bestPct = v; best = c; }
    });
    const other = bestPct - pct >= guard;
    const ok = pct >= minPct && !other;
    return { ok, reason: ok ? 'match' : other ? 'other' : 'low', pct, best, bestPct };
  }
  HG.hw = { candidates, judgeBox, matchPct, MIN_PCT, GUARD, decompose, compose };
})();
