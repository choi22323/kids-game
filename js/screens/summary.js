/* S-11 수업 마무리 요약 */
(function () {
  'use strict';
  const { h } = HG.dom;
  const ui = HG.ui;

  async function mount(view, params) {
    let run = HG.state.lastRun;
    if (!run) { try { run = JSON.parse(sessionStorage.getItem('hg.lastRun')); } catch (e) { run = null; } }
    const setsById = await HG.repo.setsMap();
    let setIds = [], stars = 0, lessonId = null;
    if (params.id !== 'quick') {
      const l = await HG.db.get('lessons', params.id);
      if (l) {
        lessonId = l.id;
        setIds = Array.from(new Set(l.activityPlan.map((s) => s.problemSetId)));
        const recs = await HG.db.getAllByIndex('activityRecords', 'lessonId', l.id);
        stars = run && run.lessonId === l.id ? run.stars : recs.filter((r) => !l.startedAt || r.startedAt >= l.startedAt).reduce((a, r) => a + r.stars, 0);
      }
    } else if (run) { setIds = run.setIds || []; stars = run.stars || 0; }
    const sets = setIds.map((id) => setsById[id]).filter(Boolean);
    const words = [], sentences = [];
    sets.forEach((s) => {
      s.words.forEach((w) => { if (!words.includes(w.text)) words.push(w.text); });
      s.sentences.forEach((x) => sentences.push(x.text));
    });
    const printTarget = lessonId ? 'lesson-' + lessonId : sets[0] ? 'set-' + sets[0].id : 'choose';
    const root = h('section', { class: 'summary' },
      h('h1', { class: 'summary-title', text: '오늘도 정말 수고 많으셨습니다!' }),
      h('div', { class: 'summary-stars' }, h('span', { class: 'big-star', 'aria-hidden': 'true', text: '★' }),
        h('span', { class: 'summary-star-text', text: '우리 반 별 ' + stars + '개' })),
      h('div', { class: 'summary-body' },
        h('div', { class: 'summary-col' }, h('h2', { text: '오늘 배운 낱말' }), h('div', { class: 'chips' }, words.slice(0, 12).map((t) => h('span', { class: 'chip', text: t })))),
        sentences.length ? h('div', { class: 'summary-col' }, h('h2', { text: '오늘 배운 문장' }), h('ul', { class: 'summary-sent' }, sentences.slice(0, 4).map((t) => h('li', { text: t })))) : null),
      h('div', { class: 'btn-row summary-actions' },
        ui.btn('홈으로', { icon: '🏠', onClick: () => HG.router.go('/home') }),
        ui.btn('학습지 만들기', { variant: 'primary', icon: '🖨', onClick: () => HG.router.go('/print/' + printTarget) })));
    view.appendChild(root);
    if (stars) HG.audio.play('complete');
  }
  HG.screens.summary = { mount };
})();
