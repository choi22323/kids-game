/* S-03 수업 계획 목록 (FEATURES.md F-03) */
(function () {
  'use strict';
  const { h } = HG.dom;
  const ui = HG.ui, L = HG.labels, F = HG.format;

  async function mount(view) {
    const [lessons, topics] = await Promise.all([HG.db.getAll('lessons'), HG.repo.topicsMap()]);
    lessons.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    const scr = ui.screen('수업 계획', [ui.btn('새 계획', { variant: 'primary', icon: '＋', onClick: () => HG.router.go('/plans/new') })]);
    const list = h('div', { class: 'list' });
    scr.body.appendChild(list);
    view.appendChild(scr.el);
    const pl = ui.pagedList({
      list, pager: scr.foot, items: lessons, max: 6,
      empty: () => ui.emptyState('아직 만든 수업 계획이 없습니다.', [ui.btn('새 계획 만들기', { variant: 'primary', onClick: () => HG.router.go('/plans/new') })]),
      render: (l) => {
        const t = topics[l.topicId];
        const acts = [];
        if (l.status === 'planned') acts.push(ui.btn('수업 시작', { variant: 'primary', icon: '▶', onClick: () => HG.screens.home.startLesson(l.id) }));
        if (l.status === 'inProgress') acts.push(ui.btn('이어서 하기', { variant: 'primary', icon: '▶', onClick: () => HG.screens.home.startLesson(l.id) }));
        if (l.status === 'done') acts.push(ui.btn('학습지', { icon: '🖨', onClick: () => HG.router.go('/print/lesson-' + l.id) }));
        acts.push(ui.btn(l.status === 'planned' || l.status === 'canceled' ? '편집' : '보기', { onClick: () => HG.router.go('/plans/' + l.id) }));
        acts.push(ui.btn('복제', { onClick: () => duplicate(l) }));
        if (l.status !== 'inProgress') acts.push(ui.btn('삭제', { variant: 'danger', onClick: () => remove(l) }));
        return h('div', { class: 'card row-card' },
          h('div', { class: 'row-info' },
            h('p', null, h('span', { class: 'strong', text: l.title }), ' ', ui.badge(L.status[l.status], l.status)),
            h('p', { class: 'muted', text: F.dateLabel(l.date) + ' · ' + (t ? t.name : '삭제된 주제') + ' · ' + L.level[l.level] + ' · ' + l.activityPlan.map((x) => L.activityIcon[x.activity]).join(' ') })),
          h('div', { class: 'btn-row' }, acts));
      }
    });
    pl.draw();
    async function duplicate(l) {
      const c = JSON.parse(JSON.stringify(l));
      Object.assign(c, { id: HG.ids.uuid(), title: (l.title.slice(0, 25) + ' 복사'), status: 'planned', date: F.todayStr(), startedAt: null, endedAt: null });
      await HG.db.put('lessons', HG.repo.touch(c, true));
      HG.toast.show('복제했습니다. 날짜를 확인해 주세요.');
      HG.router.go('/plans/' + c.id);
    }
    async function remove(l) {
      if (!(await HG.dialog.confirm('수업 계획 삭제', "'" + l.title + "' 계획을 삭제할까요?\n이 수업의 활동 기록은 통계에 그대로 남습니다.", { ok: '삭제', danger: true }))) return;
      await HG.db.del('lessons', l.id);
      pl.setItems(lessons.splice(lessons.indexOf(l), 1) && lessons);
      HG.toast.show('삭제했습니다.', { undo: async () => { await HG.db.put('lessons', l); HG.router.rerender(); } });
    }
  }
  HG.screens.plans = { mount };
})();
