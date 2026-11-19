/* 한글 처리: 초성 추출, 받침 판정, 음절 수 (FEATURES.md F-06) */
(function () {
  'use strict';
  const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const CHO_NAME = { 'ㄱ': '기역', 'ㄲ': '쌍기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄸ': '쌍디귿', 'ㄹ': '리을', 'ㅁ': '미음', 'ㅂ': '비읍', 'ㅃ': '쌍비읍', 'ㅅ': '시옷', 'ㅆ': '쌍시옷', 'ㅇ': '이응', 'ㅈ': '지읒', 'ㅉ': '쌍지읒', 'ㅊ': '치읓', 'ㅋ': '키읔', 'ㅌ': '티읕', 'ㅍ': '피읖', 'ㅎ': '히읗' };
  const BASE = 0xAC00, LAST = 0xD7A3;

  const norm = (s) => String(s == null ? '' : s).normalize('NFC');
  function isSyllable(ch) { const c = ch.charCodeAt(0); return c >= BASE && c <= LAST; }
  function getChosung(text) {
    return Array.from(norm(text), (ch) => (isSyllable(ch) ? CHO[Math.floor((ch.charCodeAt(0) - BASE) / 588)] : ch)).join('');
  }
  /** 마지막 한글 음절의 받침 유무 */
  function hasFinal(text) {
    const chars = Array.from(norm(text)).filter(isSyllable);
    if (!chars.length) return false;
    return (chars[chars.length - 1].charCodeAt(0) - BASE) % 28 !== 0;
  }
  function syllables(text) { return Array.from(norm(text).replace(/\s/g, '')); }
  function syllableCount(text) { return syllables(text).length; }
  function isAllHangul(text) { return Array.from(norm(text)).every((ch) => /\s/.test(ch) || isSyllable(ch)); }
  function chosungSpeech(cho) {
    return Array.from(cho).map((c) => CHO_NAME[c] || (c === ' ' ? '띄우고' : c)).join(' ');
  }
  HG.hangul = { CHO, getChosung, hasFinal, syllables, syllableCount, isSyllable, isAllHangul, chosungSpeech, norm };
})();
