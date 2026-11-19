/* 받아쓰기 내장 문장 (시험용). 애국가 1절을 10문장으로 나눔.
   애국가 가사는 국가 상징 자료로 널리 공개되어 있으나, 교육 자료 사용 범위는 기관에서 확인 필요. */
(function () {
  'use strict';
  const SEED_VERSION = 5;
  const T0 = '2026-11-19T00:00:00.000Z';
  const ANTHEM_1 = ['동해 물과', '백두산이', '마르고 닳도록', '하느님이 보우하사', '우리나라 만세',
    '무궁화 삼천리', '화려 강산', '대한 사람', '대한으로', '길이 보전하세'];
  // 4학년 2학기 받아쓰기 급수표 '2. 우리말 우리글' 86~95 (사진에서 옮겨 적음 — 87번 등 문장 확인 필요)
  const WOORIMAL = ['못하는 상황을 안타까워했다.', '혀가 윗잇몸에 닿는 모양', '체계적으로 만든 문자이기', '밤낮으로 열심히 익혔습니다.', '이제 겨우 나흘째인데',
    '시간보다도 짧을 것입니다.', '네 몫의 뱃삯을 가져오너라.', '고명을 얹어 장식한 음식', '네 말을 많이 끊으면 좋니?', '책값이 없어서 어렵습니다.'];
  const WOORIMAL_GROUP = '2. 우리말 우리글';
  // 번호마다 한 문제(한 문장)씩 따로 고를 수 있게 문제 묶음을 나눈다
  const SETS = WOORIMAL.map((text, i) => ({
    id: 'seed-woorimal-' + (86 + i), kind: 'dictation', group: WOORIMAL_GROUP, groupOrder: 1, no: 86 + i,
    title: (86 + i) + '번', description: '4학년 2학기 받아쓰기 ' + WOORIMAL_GROUP + ' ' + (86 + i) + '번',
    isBuiltIn: true, isHidden: false,
    sentences: [{ id: 's' + (86 + i), text, order: 0 }],
    createdAt: T0, updatedAt: T0
  })).concat([{
    id: 'seed-anthem-1', kind: 'dictation', title: '애국가 1절', description: '시험용 — 애국가 1절을 10문장으로 나누었습니다.',
    isBuiltIn: true, isHidden: false,
    sentences: ANTHEM_1.map((text, i) => ({ id: 's' + (i + 1), text, order: i })),
    group: '애국가 1절', groupOrder: 0, no: 1,
    createdAt: T0, updatedAt: T0
  }]);
  const TOPICS = [];
  /** 이전 버전에 있던 내장 묶음(지금은 번호별로 나뉨) */
  const OBSOLETE = ['seed-woorimal-2'];

  async function install(force) {
    const cur = (await HG.repo.getMeta('seedVersion')) || 0;
    if (!force && cur >= SEED_VERSION) return false;
    await HG.db.write(['problemSets', 'meta'], (tx) => {
      SETS.forEach((s) => tx.objectStore('problemSets').put(JSON.parse(JSON.stringify(s))));
      OBSOLETE.forEach((id) => tx.objectStore('problemSets').delete(id));
      tx.objectStore('meta').put({ key: 'seedVersion', value: SEED_VERSION });
    });
    return true;
  }
  /** 받아쓰기 세트만 (이전 버전의 다른 자료는 제외) */
  async function dictationSets() {
    return (await HG.db.getAll('problemSets')).filter((s) => s.kind === 'dictation' && !s.isHidden);
  }
  /** 홈 화면용: 같은 group끼리 묶고 번호순 정렬 → [{ name, sets: [...] }] */
  async function dictationGroups() {
    const map = new Map();
    (await dictationSets()).forEach((s) => {
      const g = s.group || s.title;
      if (!map.has(g)) map.set(g, { name: g, order: s.groupOrder == null ? 99 : s.groupOrder, sets: [] });
      map.get(g).sets.push(s);
    });
    const groups = Array.from(map.values());
    groups.forEach((g) => g.sets.sort((a, b) => (a.no || 0) - (b.no || 0)));
    return groups.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }
  HG.seed = { SEED_VERSION, SETS, TOPICS, ANTHEM_1, WOORIMAL, OBSOLETE, install, dictationSets, dictationGroups };
})();
