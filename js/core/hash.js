/* SHA-256(체크섬·중복 감지), PBKDF2(PIN). Web Crypto 미지원 시 SHA-256은 JS 폴백 */
(function () {
  'use strict';
  const enc = new TextEncoder();
  function toBytes(x) {
    if (typeof x === 'string') return enc.encode(x);
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    return x;
  }
  function hex(buf) { return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join(''); }
  function hexToBytes(h) {
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }
  let K = null, H0 = null;
  function initConsts() {
    const primes = [];
    for (let n = 2; primes.length < 64; n++) if (primes.every((p) => n % p)) primes.push(n);
    const frac = (x) => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
    K = primes.map((p) => frac(Math.cbrt(p)));
    H0 = primes.slice(0, 8).map((p) => frac(Math.sqrt(p)));
  }
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  function sha256js(input) {
    if (!K) initConsts();
    const bytes = toBytes(input);
    const l = bytes.length;
    const total = ((l + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(total);
    m.set(bytes);
    m[l] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 4, (l * 8) >>> 0);
    dv.setUint32(total - 8, Math.floor((l * 8) / 4294967296));
    const h = H0.slice();
    const w = new Uint32Array(64);
    for (let i = 0; i < total; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    return h.map((x) => x.toString(16).padStart(8, '0')).join('');
  }
  const hasSubtle = () => !!(window.crypto && crypto.subtle && window.isSecureContext !== false);
  async function sha256Hex(input) {
    const bytes = toBytes(input);
    if (hasSubtle()) {
      try { return hex(await crypto.subtle.digest('SHA-256', bytes)); } catch (e) { /* 폴백 */ }
    }
    return sha256js(bytes);
  }
  async function pbkdf2Hex(pin, saltHex, iterations) {
    if (!hasSubtle()) throw new Error('Web Crypto를 사용할 수 없습니다');
    const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations: iterations || 100000 }, key, 256);
    return hex(bits);
  }
  function randomHex(n) {
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return hex(b.buffer);
  }
  HG.hash = { sha256Hex, sha256js, pbkdf2Hex, randomHex, hasSubtle };
})();
