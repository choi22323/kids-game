/* 낱말 그림 표시와 업로드 처리 (FEATURES.md F-14) */
(function () {
  'use strict';
  const { h } = HG.dom;
  const urls = new Map(); // assetId -> objectURL
  const MAX_SRC = 5 * 1024 * 1024;
  const MAX_SIDE = 1024;
  const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  async function assetUrl(id) {
    if (urls.has(id)) return urls.get(id);
    const a = await HG.db.get('assets', id);
    if (!a || !a.blob) return null;
    const u = URL.createObjectURL(a.blob);
    urls.set(id, u);
    return u;
  }
  function forget(id) { if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); } }
  function forgetAll() { urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear(); }

  /** image 객체 → 표시 요소. 실패 시 이모지/대체텍스트 카드 */
  function render(image, o) {
    o = o || {};
    const cls = 'pic' + (o.cls ? ' ' + o.cls : '');
    const alt = (image && image.alt) || o.fallbackText || '';
    if (!image || !image.ref) return o.noFallback ? null : h('span', { class: cls + ' pic-text', role: 'img', 'aria-label': alt, text: alt });
    if (image.kind === 'emoji') return h('span', { class: cls + ' pic-emoji', role: 'img', 'aria-label': alt, text: image.ref });
    const img = h('img', { class: cls + ' pic-img', alt, draggable: 'false' });
    const fail = () => { img.replaceWith(h('span', { class: cls + ' pic-text', role: 'img', 'aria-label': alt, text: alt })); };
    img.addEventListener('error', fail);
    if (image.kind === 'builtin') img.src = 'assets/images/samples/' + image.ref.replace(/[^\w.-]/g, '');
    else if (image.kind === 'asset') assetUrl(image.ref).then((u) => { if (u) img.src = u; else fail(); }).catch(fail);
    return img;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const u = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(u); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(u); reject(new Error('DECODE')); };
      img.src = u;
    });
  }
  function toBlob(canvas, type, q) { return new Promise((res) => canvas.toBlob(res, type, q)); }

  /** 업로드 검사 → 축소·재인코딩(EXIF 제거) → 해시. @returns {{ok:boolean, error?:string, data?:object}} */
  async function processUpload(file) {
    if (!file) return { ok: false, error: '파일을 골라 주세요.' };
    if (!TYPES.includes(file.type)) return { ok: false, error: 'PNG, JPG, WebP 그림만 등록할 수 있습니다.' };
    if (file.size > MAX_SRC) return { ok: false, error: '그림 파일은 5MB 이하만 등록할 수 있습니다. (지금 ' + (file.size / 1048576).toFixed(1) + 'MB)' };
    let img;
    try { img = await loadImage(file); } catch (e) { return { ok: false, error: '그림 파일을 열 수 없습니다. 파일이 손상되었을 수 있습니다.' }; }
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), hgt = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = hgt;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    if (file.type === 'image/jpeg') ctx.fillRect(0, 0, w, hgt);
    ctx.drawImage(img, 0, 0, w, hgt);
    let blob = await toBlob(c, 'image/webp', 0.85);
    if (!blob || blob.type !== 'image/webp') { ctx.globalCompositeOperation = 'destination-over'; ctx.fillRect(0, 0, w, hgt); blob = await toBlob(c, 'image/jpeg', 0.85); }
    if (!blob) return { ok: false, error: '그림을 변환하지 못했습니다.' };
    const sha256 = await HG.hash.sha256Hex(await blob.arrayBuffer());
    return { ok: true, data: { blob, mime: blob.type, width: w, height: hgt, size: blob.size, sha256 } };
  }
  HG.images = { render, assetUrl, forget, forgetAll, processUpload, TYPES, MAX_SRC };
})();
