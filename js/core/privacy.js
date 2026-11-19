/* 개인정보 의심 패턴 경고 (SECURITY.md §2.3). 보조 장치이며 최종 확인은 강사가 한다. */
(function () {
  'use strict';
  const PATTERNS = [
    { id: 'rrn', re: /\d{6}[-\s]?[1-8]\d{6}/, msg: '주민등록번호처럼 보이는 내용이 있습니다. 이 내용은 저장할 수 없습니다.', block: true },
    { id: 'phone', re: /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/, msg: '전화번호처럼 보이는 내용이 있습니다.' },
    { id: 'birth', re: /(19|20)\d{2}[.\-/년\s]+\d{1,2}[.\-/월\s]+\d{1,2}/, msg: '생년월일처럼 보이는 내용이 있습니다.' },
    { id: 'email', re: /[\w.+-]+@[\w-]+\.[\w.]+/, msg: '이메일 주소처럼 보이는 내용이 있습니다.' },
    { id: 'name', re: /[가-힣]{2,4}\s?어르신|[가-힣]{2,4}\s씨(?![가-힣])/, msg: '사람 이름처럼 보이는 내용이 있습니다.' }
  ];
  /** @returns {{block:boolean, messages:string[]}} */
  function check(texts) {
    const list = (Array.isArray(texts) ? texts : [texts]).filter((t) => typeof t === 'string' && t);
    const found = new Map();
    list.forEach((t) => {
      PATTERNS.forEach((p) => { if (p.re.test(t)) found.set(p.id, p); });
    });
    // 주민등록번호가 걸리면 같은 숫자열이 전화번호로 중복 경고되지 않게 한다
    if (found.has('rrn')) found.delete('phone');
    const arr = Array.from(found.values());
    return { block: arr.some((p) => p.block), messages: arr.map((p) => p.msg) };
  }
  /** 경고가 있으면 대화상자로 확인. 저장해도 되면 true */
  async function confirmSave(texts) {
    const r = check(texts);
    if (!r.messages.length) return true;
    const body = r.messages.join('\n') + '\n어르신 성함·연락처 등 개인정보는 입력하지 마세요.';
    if (r.block) { await HG.dialog.alert('개인정보 주의', body); return false; }
    return HG.dialog.confirm('개인정보 주의', body + '\n그래도 저장할까요?', { ok: '그래도 저장', cancel: '다시 고치기' });
  }
  HG.privacy = { PATTERNS, check, confirmSave };
})();
