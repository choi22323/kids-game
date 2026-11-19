/* 손글씨 칸별 정답 판정 (보조 기능) — 외부 라이브러리·인터넷 없이 모양 비교로 판정한다.
   방법: 칸 안 잉크와 '정답 글자' 및 '헷갈리기 쉬운 글자'(초성·중성·받침을 하나씩 바꾼 글자 약 50개)를
   같은 크기(32×32)로 맞춘 뒤 양방향 거리(chamfer distance)로 비교한다.
   정답 글자가 가장 비슷하고, 일정 기준보다 가까울 때만 '정답'으로 본다.
   한계: 필기 습관에 따라 틀리게 판정될 수 있으므로 강사가 판정을 바꿀 수 있게 한다(확인 필요). */
(function () {
  'use strict';
  const N = 32, PAD = 3;
  const FONT = '"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR",sans-serif';
  const BASE = 0xAC00;
  const JONG_TRY = [0, 1, 4, 7, 8, 16, 17, 19, 21, 27];
  const THRESHOLD = 4; // 거리 제곱 평균 상한(완전히 다른 낙서 거르기). 현장 필기로 조정 필요
  const MARGIN = 0.1;
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

  /** 캔버스의 (x,y,w,h) 영역 잉크를 32×32 이진 격자로 정규화. 잉크가 없으면 null */
  function normalize(src, x, y, w, hgt) {
    const sctx = src.getContext('2d');
    const d = sctx.getImageData(x, y, w, hgt).data;
    let x0 = w, y0 = hgt, x1 = -1, y1 = -1, count = 0;
    for (let yy = 0; yy < hgt; yy++) for (let xx = 0; xx < w; xx++) {
      if (d[(yy * w + xx) * 4 + 3] > 64) { count++; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    }
    if (count < 12) return null;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const scale = (N - PAD * 2) / Math.max(bw, bh);
    const dw = bw * scale, dh = bh * scale;
    const c = document.createElement('canvas');
    c.width = N; c.height = N;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, x + x0, y + y0, bw, bh, (N - dw) / 2, (N - dh) / 2, dw, dh);
    const g = ctx.getImageData(0, 0, N, N).data;
    const out = new Uint8Array(N * N);
    let on = 0;
    for (let i = 0; i < N * N; i++) if (g[i * 4 + 3] > 40) { out[i] = 1; on++; }
    return on ? out : null;
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
  /** 거리 제곱(최대 4px에서 자름) 평균: 빠지거나 더해진 작은 획도 크게 반영된다 */
  function meanTo(a, dtB) { let s = 0, n = 0; for (let i = 0; i < a.length; i++) if (a[i]) { const d = Math.min(dtB[i], 4); s += d * d; n++; } return n ? s / n : 99; }
  /** 글자 모양(글꼴)을 정규화한 격자 + 거리 변환 (캐시) */
  function glyph(ch) {
    if (glyphCache.has(ch)) return glyphCache.get(ch);
    const S = 96;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '500 ' + Math.round(S * 0.8) + 'px ' + FONT;
    ctx.fillText(ch, S / 2, S / 2);
    const bin = normalize(c, 0, 0, S, S);
    const g = bin ? { bin, dt: distance(bin) } : null;
    glyphCache.set(ch, g);
    return g;
  }
  function similarity(ink, inkDt, ch) {
    const g = glyph(ch);
    if (!g) return 99;
    return (meanTo(ink, g.dt) + meanTo(g.bin, inkDt)) / 2;
  }
  /**
   * 칸 하나 판정
   * @param {HTMLCanvasElement} canvas 잉크가 그려진 캔버스(배율 1)
   * @param {{x:number,y:number,size:number,ch:string}} box
   * @returns {{ok:boolean, reason:string, score?:number, best?:string}}
   */
  function judgeBox(canvas, box, opts) {
    const margin = (opts && opts.margin != null) ? opts.margin : MARGIN;
    const m = Math.round(box.size * 0.04);
    const ink = normalize(canvas, Math.round(box.x) + m, Math.round(box.y) + m, Math.round(box.size) - m * 2, Math.round(box.size) - m * 2);
    if (box.ch === ' ') return ink ? { ok: false, reason: 'space' } : { ok: true, reason: 'space-ok' };
    if (!ink) return { ok: false, reason: 'empty' };
    if (!isSyl(box.ch)) return { ok: true, reason: 'not-hangul' }; // 숫자·문장부호는 판정하지 않음
    const inkDt = distance(ink);
    let best = null, bestScore = Infinity;
    const target = similarity(ink, inkDt, box.ch);
    candidates(box.ch).forEach((c) => {
      if (c === box.ch) return;
      const sc = similarity(ink, inkDt, c);
      if (sc < bestScore) { bestScore = sc; best = c; }
    });
    // 정답 글자가 다른 후보보다 margin 이상 덜 비슷하면 '다른 글자'로 본다
    const ok = target <= bestScore + margin && target <= THRESHOLD;
    return { ok, reason: ok ? 'match' : target > THRESHOLD ? 'unclear' : 'other', score: Math.round(target * 100) / 100, other: Math.round(bestScore * 100) / 100, best: target <= bestScore ? box.ch : best };
  }
  HG.hw = { candidates, judgeBox, normalize, THRESHOLD, decompose, compose };
})();
