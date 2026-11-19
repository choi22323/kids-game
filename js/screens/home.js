/* S-01 홈 대시보드 (FEATURES.md F-01) */
(function () {
  'use strict';
  const { h } = HG.dom;
  const ui = HG.ui, F = HG.format, L = HG.labels;

  function startLesson(id) { HG.screens.run.enterFullscreen(); HG.router.go('/run/' + id); }

  async function mount(view) {
    const s = HG.state.settings;
    const today = F.todayStr();
    const [lessons, recs, topics, sets] = await Promise.all([HG.db.getAll('lessons'), HG.db.getAll('activityRecords'), HG.repo.topics(), HG.repo.sets()]);
    const topicsById = {}; topics.forEach((t) => { topicsById[t.id] = t; });
    const lastBackup = await HG.repo.getMeta('lastBackupAt');
    const inprog = lessons.find((l) => l.status === 'inProgress');
    const todays = lessons.filter((l) => l.date === today && (l.status === 'planned' || l.status === 'inProgress')).slice(0, 2);
    const week = recs.filter((r) => F.daysSince(r.startedAt) < 7);
    const answered = week.filter((r) => r.activity !== 'trace');
    const acc = answered.reduce((a, r) => a + (r.totalQuestions - r.skipped), 0);
    const ok = answered.reduce((a, r) => a + r.correctFirstTry + r.correctAfterRetry, 0);

    const scr = ui.screen('우리들의 즐거운 한글 교실', null, F.dateLabel(today));
    // 배너(하나만)
    let banner = null;
    const old = s.recordRetentionMonths ? recs.filter((r) => r.startedAt < F.monthsAgoISO(s.recordRetentionMonths)).length : 0;
    if (inprog) {
      banner = h('div', { class: 'banner' }, h('p', { text: "진행 중이던 수업 '" + inprog.title + "'이 있습니다. 이어서 할까요?" }),
        ui.btn('이어서 하기', { variant: 'primary', icon: '▶', cls: 'icon-after', onClick: () => startLesson(inprog.id) }));
    } else if (s.backupReminderDays && F.daysSince(lastBackup) > s.backupReminderDays) {
      banner = h('div', { class: 'banner' }, h('p', { text: lastBackup ? '마지막 백업 후 ' + F.daysSince(lastBackup) + '일이 지났습니다. 지금 백업해 두세요.' : '아직 백업한 적이 없습니다. 지금 백업해 두세요.' }),
        ui.btn('지금 백업', { variant: 'primary', icon: '💾', onClick: quickBackup }));
    } else if (old) {
      banner = h('div', { class: 'banner' }, h('p', { text: s.recordRetentionMonths + '개월이 지난 활동 기록 ' + old + '건이 있습니다. 백업 후 정리할까요?' }),
        ui.btn('기록 정리하러 가기', { onClick: () => HG.router.go('/admin/backup') }));
    }

    const todayCard = h('div', { class: 'card home-card' }, h('h2', { text: '오늘 수업' }));
    if (todays.length) {
      todays.forEach((l, i) => {
        const t = topicsById[l.topicId];
        todayCard.appendChild(h('div', { class: 'lesson-mini' },
          h('div', null, h('p', { class: 'strong', text: l.title }), h('p', { class: 'muted', text: (t ? t.name : '') + ' · ' + L.level[l.level] + ' · ' + l.activityPlan.map((x) => L.activityIcon[x.activity]).join(' ') })),
          i === 0 ? ui.btn(l.status === 'inProgress' ? '이어서 하기' : '수업 시작', { variant: 'primary', icon: '▶', cls: 'icon-after', onClick: () => startLesson(l.id) }) : null));
      });
    } else {
      todayCard.appendChild(h('p', { class: 'muted', text: '오늘 예정된 수업이 없습니다.' }));
      todayCard.appendChild(h('div', { class: 'btn-row' }, ui.btn('수업 계획 만들기', { icon: '📅', onClick: () => HG.router.go('/plans/new') }), ui.btn('빠른 시작', { icon: '▶', onClick: () => HG.router.go('/quick') })));
    }

    const quickCard = h('div', { class: 'card home-card' }, h('h2', { text: '빠른 시작' }), h('p', { class: 'muted', text: '주제를 고르면 바로 시작할 수 있습니다.' }));
    const tg = h('div', { class: 'topic-grid' });
    topics.slice(0, 6).forEach((t) => {
      const n = sets.filter((x) => x.topicId === t.id && !x.isHidden).length;
      tg.appendChild(ui.btn(t.name, { icon: L.topicIcon[t.icon], disabled: !n, onClick: () => HG.router.go('/quick/' + t.id) }));
    });
    quickCard.appendChild(tg);

    const statCard = h('div', { class: 'card home-card' }, h('h2', { text: '최근 7일' }));
    if (week.length) {
      statCard.appendChild(h('div', { class: 'kpis' },
        kpi('활동', week.length + '회'), kpi('모은 별', '★ ' + week.reduce((a, r) => a + r.stars, 0)), kpi('정답률', acc ? F.percent(ok / acc) : '—')));
    } else statCard.appendChild(h('p', { class: 'muted', text: '아직 진행한 활동이 없습니다.' }));

    const dataCard = h('div', { class: 'card home-card' }, h('h2', { text: '자료 관리' }),
      h('p', { text: lastBackup ? '마지막 백업: ' + F.dateTimeLabel(lastBackup) : '아직 백업한 적이 없습니다.' }));
    const usage = h('p', { class: 'muted' });
    dataCard.appendChild(usage);
    dataCard.appendChild(h('div', { class: 'btn-row' }, ui.btn('지금 백업', { variant: 'primary', icon: '💾', onClick: quickBackup })));
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((e) => { if (e && e.usage != null) usage.textContent = '저장 공간 사용: ' + (e.usage / 1048576).toFixed(1) + 'MB'; }).catch(() => {});
    }

    const home = h('div', { class: 'home' }, banner);
    scr.body.appendChild(home);
    view.appendChild(scr.el);
    HG.ui.pagedNodes(home, [todayCard, quickCard, statCard, dataCard], 4, 'paged-grid2');
  }
  function kpi(label, value) { return h('div', { class: 'kpi' }, h('span', { class: 'kpi-label', text: label }), h('span', { class: 'kpi-value', text: value })); }
  async function quickBackup() {
    try {
      const r = await HG.backup.saveBackup({ includeRecords: true, includeImages: true });
      HG.toast.show('백업 파일을 저장했습니다: ' + r.name);
      HG.router.rerender();
    } catch (e) {
      console.error(e);
      HG.dialog.alert('백업하지 못했습니다', '백업 파일을 만드는 중 문제가 생겼습니다. 다시 시도해 주세요.');
    }
  }
  HG.screens.home = { mount, startLesson, quickBackup };
})();
