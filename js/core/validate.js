/* 입력 검증 규칙 (DATA_MODEL.md §4와 1:1). 오류=저장 불가, 경고=확인 후 저장 가능 */
(function () {
  'use strict';
  const H = HG.hangul;
  const LEVELS = ['beginner', 'intermediate', 'advanced'];
  const ACTS = ['trace', 'chosung', 'match', 'blank'];
  const LIMITS = {
    setTitle: [1, 30], setDesc: [0, 100], words: [4, 20], wordSyll: [1, 8], hint: [0, 30], alt: [1, 30],
    sentences: [0, 12], sentence: [4, 40], answer: [1, 10], topicName: [1, 12], lessonTitle: [1, 30],
    memo: [0, 200], steps: [1, 8], participant: [0, 30], tag: [1, 10], tags: [0, 5], assetLabel: [1, 30]
  };

  /** V-01 */
  function clean(s) {
    if (typeof s !== 'string') return '';
    return s.normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').trim();
  }
  const len = (s) => Array.from(s || '').length;
  function countOccurrences(text, sub) {
    if (!sub) return 0;
    let n = 0, i = 0;
    while ((i = text.indexOf(sub, i)) !== -1) { n++; i += sub.length; }
    return n;
  }
  function hasImage(w) { return !!(w && w.image && w.image.ref); }

  function availability(set) {
    const o = (set && set.activityOptions) || {};
    const words = (set && set.words) || [];
    const imgs = words.filter(hasImage).length;
    const sent = ((set && set.sentences) || []).length;
    const r = { reason: {} };
    const chk = (act, ok, why) => {
      const en = !o[act] || o[act].enabled !== false;
      r[act] = en && ok;
      if (!en) r.reason[act] = '이 세트에서 사용하지 않도록 설정한 활동입니다.';
      else if (!ok) r.reason[act] = why;
    };
    chk('trace', words.length >= 3, '낱말이 3개 미만입니다.');
    chk('chosung', words.length >= 3, '낱말이 3개 미만입니다.');
    chk('match', imgs >= 3, '그림이 있는 낱말이 3개 미만입니다.');
    chk('blank', sent >= 1, '문장이 없습니다.');
    return r;
  }

  function problemSet(set, ctx) {
    ctx = ctx || {};
    const errors = [], warnings = [];
    const E = (field, msg, tab) => errors.push({ field, msg, tab: tab || 'info' });
    const W = (field, msg, tab) => warnings.push({ field, msg, tab: tab || 'info' });
    const tl = len(set.title);
    if (tl < 1 || tl > 30) E('title', '제목은 1~30자로 입력해 주세요 (지금 ' + tl + '자)');
    if (!set.topicId || (ctx.topicIds && !ctx.topicIds.includes(set.topicId))) E('topicId', '주제를 골라 주세요');
    if (!LEVELS.includes(set.level)) E('level', '수준을 골라 주세요');
    if (len(set.description) > 100) E('description', '설명은 100자 이하로 입력해 주세요');

    const words = set.words || [];
    if (words.length < 4) E('words', '낱말을 4개 이상 넣어 주세요 (지금 ' + words.length + '개)', 'words');
    if (words.length > 20) E('words', '낱말은 20개까지 넣을 수 있습니다', 'words');
    const seen = {};
    words.forEach((w, i) => {
      const f = 'words.' + i + '.';
      const n = H.syllableCount(w.text);
      if (n < 1) E(f + 'text', (i + 1) + '번째 낱말을 입력해 주세요', 'words');
      else if (n > 8) E(f + 'text', '낱말은 8글자까지 입력할 수 있습니다 (지금 ' + n + '글자)', 'words');
      else if (seen[w.text]) E(f + 'text', "'" + w.text + "'가 이미 있습니다", 'words');
      else if (!H.isAllHangul(w.text)) W(f + 'text', "'" + w.text + "'에 한글이 아닌 글자가 있습니다", 'words');
      seen[w.text] = true;
      if (len(w.hint) > 30) E(f + 'hint', '힌트는 30자 이하로 입력해 주세요', 'words');
      if (w.image && w.image.kind === 'emoji' && len(w.image.ref) > 8) E(f + 'image', '이모지는 1개만 넣어 주세요', 'words');
    });

    const sents = set.sentences || [];
    if (sents.length > 12) E('sentences', '문장은 12개까지 넣을 수 있습니다', 'sentences');
    sents.forEach((s, i) => {
      const f = 'sentences.' + i + '.';
      const no = (i + 1) + '번째 문장: ';
      const sl = len(s.text);
      if (sl < 4 || sl > 40) E(f + 'text', no + '문장은 4~40자로 입력해 주세요 (지금 ' + sl + '자)', 'sentences');
      const al = len(s.answer);
      if (al < 1 || al > 10) E(f + 'answer', no + '정답은 1~10자로 입력해 주세요', 'sentences');
      else {
        const c = countOccurrences(s.text || '', s.answer);
        if (c === 0) E(f + 'answer', no + "문장에 정답 '" + s.answer + "'가 없습니다. 문장 안에 '" + s.answer + "'를 넣어 주세요", 'sentences');
        else if (c > 1) E(f + 'answer', no + "정답 '" + s.answer + "'가 문장에 " + c + '번 나옵니다. 더 긴 낱말로 정해 주세요', 'sentences');
      }
      const d = s.distractors || [];
      if (d.length !== 2 || d.some((x) => len(x) < 1 || len(x) > 10)) E(f + 'distractors', no + '다른 보기 2개를 각각 1~10자로 입력해 주세요', 'sentences');
      else if (d[0] === d[1] || d.includes(s.answer)) E(f + 'distractors', no + '보기에 같은 낱말이 있습니다', 'sentences');
      else if (al >= 1 && d.some((x) => H.hasFinal(x) !== H.hasFinal(s.answer))) {
        W(f + 'distractors', no + '보기의 받침이 정답과 달라 조사로 답을 짐작할 수 있습니다', 'sentences');
      }
    });
    const tags = set.tags || [];
    if (tags.length > 5 || tags.some((t) => len(t) < 1 || len(t) > 10)) E('tags', '태그는 1~10자, 5개까지 넣을 수 있습니다');
    return { errors, warnings };
  }

  function topic(t, all) {
    const errors = [];
    const n = len(t.name);
    if (n < 1 || n > 12) errors.push({ field: 'name', msg: '주제 이름은 1~12자로 입력해 주세요' });
    else if ((all || []).some((o) => o.id !== t.id && o.name === t.name)) errors.push({ field: 'name', msg: "'" + t.name + "' 주제가 이미 있습니다" });
    if (!HG.labels.topicIcons.includes(t.icon)) errors.push({ field: 'icon', msg: '아이콘을 골라 주세요' });
    return { errors, warnings: [] };
  }

  function lesson(l, ctx) {
    ctx = ctx || {};
    const errors = [], warnings = [];
    const E = (field, msg, tab) => errors.push({ field, msg, tab: tab || 'info' });
    if (!HG.format.isValidYmd(l.date)) E('date', '날짜를 다시 확인해 주세요');
    const tl = len(l.title);
    if (tl < 1 || tl > 30) E('title', '제목은 1~30자로 입력해 주세요 (지금 ' + tl + '자)');
    if (!l.topicId || (ctx.topicIds && !ctx.topicIds.includes(l.topicId))) E('topicId', '주제를 골라 주세요');
    if (!LEVELS.includes(l.level)) E('level', '수준을 골라 주세요');
    if (l.participantCount != null && !(Number.isInteger(l.participantCount) && l.participantCount >= 0 && l.participantCount <= 30)) {
      E('participantCount', '참여 인원은 0~30 사이 숫자로 입력해 주세요');
    }
    if (len(l.memo) > 200) E('memo', '메모는 200자 이하로 입력해 주세요');
    const steps = l.activityPlan || [];
    if (steps.length < 1) E('activityPlan', '활동을 1개 이상 넣어 주세요', 'steps');
    if (steps.length > 8) E('activityPlan', '활동은 8개까지 넣을 수 있습니다', 'steps');
    steps.forEach((s, i) => {
      const f = 'activityPlan.' + i;
      if (!ACTS.includes(s.activity)) { E(f, (i + 1) + '번째 활동을 골라 주세요', 'steps'); return; }
      const set = ctx.setsById && ctx.setsById[s.problemSetId];
      if (!set) { E(f, (i + 1) + '번째 활동의 문제 세트를 골라 주세요 (삭제된 세트일 수 있습니다)', 'steps'); return; }
      const av = availability(set);
      if (!av[s.activity]) E(f, (i + 1) + '번째: 이 세트로는 ' + HG.labels.activityShort[s.activity] + '을(를) 할 수 없습니다. ' + av.reason[s.activity], 'steps');
    });
    return { errors, warnings };
  }

  HG.validate = { LEVELS, ACTS, LIMITS, clean, len, countOccurrences, hasImage, availability, problemSet, topic, lesson };
})();
