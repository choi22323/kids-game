/* S-15 문제 세트 목록 (FEATURES.md F-12) */
(function () {
  'use strict';
  const { h } = HG.dom;
  const ui = HG.ui, L = HG.labels, V = HG.validate;
  const filt = { topicId: '', level: '', q: '', hidden: false };

  async function mount(view) {
    const [topics, all] = await Promise.all([HG.repo.topics(), HG.repo.sets()]);
    const topicsById = {}; topics.forEach((t) => { topicsById[t.id] = t; });
    const scr = ui.screen('문제 세트', [ui.btn('관리자 설정', { icon: '◀', onClick: () => HG.router.go('/admin') }), ui.btn('새 세트', { variant: 'primary', icon: '＋', onClick: () => HG.router.go('/admin/sets/new') })]);
    const list = h('div', { class: 'card-grid' });
    const side = h('div', { class: 'filter-bar' });
    scr.body.append(side, list);
    view.appendChild(scr.el);
    const search = ui.input({ value: filt.q, placeholder: '제목 검색', ariaLabel: '제목 검색', onInput: (e) => { filt.q = e.target.value; apply(); } });
    side.append(
      ui.select([{ value: '', label: '전체 주제' }].concat(topics.map((t) => ({ value: t.id, label: t.name }))), filt.topicId, (v) => { filt.topicId = v; apply(); }, '주제'),
      ui.select([{ value: '', label: '전체 수준' }].concat(L.levels.map((v) => ({ value: v, label: L.level[v] }))), filt.level, (v) => { filt.level = v; apply(); }, '수준'),
      search,
      ui.toggle('숨긴 세트 보기', filt.hidden, (v) => { filt.hidden = v; apply(); }));
    const pl = ui.pagedList({ list, pager: scr.foot, items: [], max: 8,
      empty: () => ui.emptyState('조건에 맞는 문제 세트가 없습니다.', [ui.btn('필터 초기화', { onClick: () => { Object.assign(filt, { topicId: '', level: '', q: '', hidden: false }); HG.router.rerender(); } }), ui.btn('새 세트 만들기', { variant: 'primary', onClick: () => HG.router.go('/admin/sets/new') })]),
      render: card });
    function apply() {
      const q = filt.q.trim();
      const items = all.filter((s) => (!filt.topicId || s.topicId === filt.topicId) && (!filt.level || s.level === filt.level) && (filt.hidden || !s.isHidden) && (!q || s.title.includes(q)))
        .sort((a, b) => (topicsById[a.topicId] ? topicsById[a.topicId].order : 99) - (topicsById[b.topicId] ? topicsById[b.topicId].order : 99) || L.levels.indexOf(a.level) - L.levels.indexOf(b.level) || a.title.localeCompare(b.title));
      pl.setItems(items);
    }
    function card(s) {
      const av = V.availability(s);
      const t = topicsById[s.topicId];
      return h('div', { class: 'card set-card' + (s.isHidden ? ' is-hidden' : '') },
        h('p', { class: 'strong', text: s.title }),
        h('p', { class: 'muted' }, (t ? t.name : '주제 없음') + ' · ' + L.level[s.level] + ' ', s.isBuiltIn ? ui.badge('🔒 기본 자료', 'gold') : null, s.isHidden ? ui.badge('숨김') : null),
        h('p', { class: 'muted', text: '낱말 ' + s.words.length + ' · 문장 ' + s.sentences.length + ' · ' + L.activities.filter((a) => av[a]).map((a) => L.activityIcon[a]).join(' ') }),
        h('div', { class: 'btn-row' },
          ui.btn(s.isBuiltIn ? '보기' : '편집', { variant: 'primary', onClick: () => HG.router.go('/admin/sets/' + s.id) }),
          ui.btn('복제', { onClick: () => duplicate(s) }),
          ui.btn(s.isHidden ? '보이기' : '숨김', { onClick: () => toggleHidden(s) }),
          s.isBuiltIn ? null : ui.btn('삭제', { variant: 'danger', onClick: () => remove(s) })));
    }
    async function duplicate(s) {
      const c = await HG.screens.adminSets.duplicate(s);
      HG.toast.show("복제했습니다: '" + c.title + "'");
      HG.router.go('/admin/sets/' + c.id);
    }
    async function toggleHidden(s) {
      s.isHidden = !s.isHidden;
      await HG.db.put('problemSets', s);
      HG.toast.show(s.isHidden ? '숨겼습니다. 빠른 시작·수업 계획 목록에 나오지 않습니다.' : '다시 보이게 했습니다.');
      apply();
    }
    async function remove(s) {
      const plans = await HG.repo.plansUsingSet(s.id);
      const msg = "'" + s.title + "' 세트를 삭제할까요?" + (plans.length ? '\n이 세트를 사용하는 예정 수업 계획이 ' + plans.length + '개 있습니다. 계획에는 "삭제된 세트"로 표시됩니다.' : '');
      if (!(await HG.dialog.confirm('세트 삭제', msg, { ok: '삭제', danger: true }))) return;
      await HG.db.del('problemSets', s.id);
      all.splice(all.indexOf(s), 1);
      apply();
      HG.toast.show('삭제했습니다.', { undo: async () => { await HG.db.put('problemSets', s); all.push(s); apply(); } });
    }
    apply();
  }
  async function duplicate(s) {
    const c = JSON.parse(JSON.stringify(s));
    Object.assign(c, { id: HG.ids.uuid(), title: (s.title.length > 24 ? s.title.slice(0, 24) : s.title) + ' (복사본)', isBuiltIn: false, isHidden: false, sourceSetId: s.id });
    await HG.db.put('problemSets', HG.repo.touch(c, true));
    return c;
  }
  HG.screens.adminSets = { mount, duplicate };
})();
