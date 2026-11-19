/* S-13 통계 — 개인 식별 없는 활동 단위 집계 (FEATURES.md F-02) */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const ui = HG.ui, F = HG.format, L = HG.labels;
  const filt = { period: 'month', from: '', to: '', topicId: '', level: '', activity: '' };

  function range(f, now) {
    now = now || new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    let start;
    if (f.period === 'week') start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    else if (f.period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (f.period === 'quarter') start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    else {
      if (!F.isValidYmd(f.from) || !F.isValidYmd(f.to)) return { error: '날짜를 다시 확인해 주세요.' };
      start = F.ymdToDate(f.from);
      const e = F.ymdToDate(f.to);
      if (e < start) return { error: '끝나는 날이 시작하는 날보다 빠릅니다.' };
      let endD = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
      const limit = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
      let capped = false;
      if (endD > limit) { endD = limit; capped = true; }
      return { start, end: endD, capped };
    }
    return { start, end };
  }
  /** 순수 집계 함수 (단위 테스트 대상) */
  function compute(records, lessons, f, rg) {
    const inR = (iso) => { const d = new Date(iso); return d >= rg.start && d < rg.end; };
    const recs = records.filter((r) => inR(r.startedAt) && (!f.topicId || r.topicId === f.topicId) && (!f.level || r.level === f.level) && (!f.activity || r.activity === f.activity));
    const lessonsDone = lessons.filter((l) => l.status === 'done' && F.isValidYmd(l.date) && F.ymdToDate(l.date) >= rg.start && F.ymdToDate(l.date) < rg.end && (!f.topicId || l.topicId === f.topicId) && (!f.level || l.level === f.level)).length;
    const quiz = recs.filter((r) => r.activity !== 'trace');
    const answered = quiz.reduce((a, r) => a + r.totalQuestions - r.skipped, 0);
    const correct = quiz.reduce((a, r) => a + r.correctFirstTry + r.correctAfterRetry, 0);
    const byAct = {};
    L.activities.forEach((a) => { byAct[a] = recs.filter((r) => r.activity === a).length; });
    const tr = recs.filter((r) => r.activity === 'trace' && typeof r.avgCoverage === 'number');
    const words = {};
    recs.forEach((r) => r.itemResults.forEach((it) => {
      if (it.result === 'skipped') return;
      const w = words[it.text] || (words[it.text] = { text: it.text, total: 0, hard: 0 });
      w.total++;
      if (it.result === 'retry' || it.result === 'revealed') w.hard++;
    }));
    const hard = Object.values(words).filter((w) => w.total >= 3 && w.hard > 0).map((w) => Object.assign(w, { ratio: w.hard / w.total }))
      .sort((a, b) => b.ratio - a.ratio || b.total - a.total || a.text.localeCompare(b.text)).slice(0, 5);
    return {
      lessons: lessonsDone, activities: recs.length, accuracy: answered ? correct / answered : null,
      stars: recs.reduce((a, r) => a + r.stars, 0), avgStars: recs.length ? recs.reduce((a, r) => a + r.stars, 0) / recs.length : null,
      traceCoverage: tr.length ? tr.reduce((a, r) => a + r.avgCoverage, 0) / tr.length : null, byAct, hard
    };
  }

  async function mount(view) {
    const [records, lessons, topics] = await Promise.all([HG.db.getAll('activityRecords'), HG.db.getAll('lessons'), HG.repo.topics()]);
    const scr = ui.screen('통계', [ui.btn('인쇄', { icon: '🖨', onClick: () => HG.screens.print.printNode(out.cloneNode(true), true) })], '이 통계에는 어르신 개인별 정보가 없습니다. 수업 운영 참고용입니다.');
    const bar = h('div', { class: 'filter-bar' });
    const out = h('div', { class: 'stats-out' });
    scr.body.append(bar, out);
    view.appendChild(scr.el);
    const custom = h('div', { class: 'btn-row', hidden: filt.period !== 'custom' });
    const from = ui.input({ type: 'date', value: filt.from, ariaLabel: '시작일', onInput: (e) => { filt.from = e.target.value; draw(); } });
    const to = ui.input({ type: 'date', value: filt.to, ariaLabel: '종료일', onInput: (e) => { filt.to = e.target.value; draw(); } });
    custom.append(from, h('span', { text: '~' }), to);
    bar.append(
      ui.segmented([{ value: 'week', label: '이번 주' }, { value: 'month', label: '이번 달' }, { value: 'quarter', label: '3개월' }, { value: 'custom', label: '직접' }], filt.period, (v) => {
        filt.period = v; custom.hidden = v !== 'custom';
        if (v === 'custom' && !filt.from) { filt.from = F.todayStr(new Date(Date.now() - 29 * 86400000)); filt.to = F.todayStr(); from.value = filt.from; to.value = filt.to; }
        draw();
      }, '기간'),
      custom,
      ui.select([{ value: '', label: '전체 주제' }].concat(topics.map((t) => ({ value: t.id, label: t.name }))), filt.topicId, (v) => { filt.topicId = v; draw(); }, '주제'),
      ui.select([{ value: '', label: '전체 수준' }].concat(L.levels.map((v) => ({ value: v, label: L.level[v] }))), filt.level, (v) => { filt.level = v; draw(); }, '수준'),
      ui.select([{ value: '', label: '전체 활동' }].concat(L.activities.map((v) => ({ value: v, label: L.activityShort[v] }))), filt.activity, (v) => { filt.activity = v; draw(); }, '활동'));
    function draw() {
      clear(out);
      const rg = range(filt);
      if (rg.error) { out.appendChild(ui.emptyState(rg.error)); return; }
      const r = compute(records, lessons, filt, rg);
      if (!r.activities && !r.lessons) { out.appendChild(ui.emptyState('선택한 기간에 기록이 없습니다.')); return; }
      const kpi = (l, v) => h('div', { class: 'card kpi' }, h('span', { class: 'kpi-label', text: l }), h('span', { class: 'kpi-value', text: v }));
      const max = Math.max(1, ...Object.values(r.byAct));
      out.append(
        rg.capped ? h('p', { class: 'notice small', text: '기간은 최대 1년까지 볼 수 있어 1년으로 줄였습니다.' }) : null,
        h('div', { class: 'kpis' }, kpi('마친 수업', r.lessons + '회'), kpi('활동 진행', r.activities + '회'), kpi('평균 정답률', r.accuracy == null ? '—' : F.percent(r.accuracy)),
          kpi('모은 별', '★ ' + r.stars), kpi('따라쓰기 평균', r.traceCoverage == null ? '—' : F.percent(r.traceCoverage))),
        h('div', { class: 'stats-two' },
          h('div', { class: 'card' }, h('h2', { text: '활동별 진행 횟수' }), h('div', { class: 'bars' }, L.activities.map((a) =>
            h('div', { class: 'bar-row' }, h('span', { class: 'bar-label', text: L.activityShort[a] }),
              h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill', style: { width: (r.byAct[a] / max * 100) + '%' } })), h('span', { class: 'bar-val', text: r.byAct[a] + '회' }))))),
          h('div', { class: 'card' }, h('h2', { text: '자주 어려워한 낱말' }),
            r.hard.length ? h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { text: '낱말' }), h('th', { text: '어려워한 비율' }), h('th', { text: '출제' }))),
              h('tbody', null, r.hard.map((w) => h('tr', null, h('td', { text: w.text }), h('td', { text: F.percent(w.ratio) }), h('td', { text: w.total + '회' })))))
              : h('p', { class: 'muted', text: '3회 이상 나온 낱말 중 어려워한 낱말이 없습니다.' }))));
    }
    draw();
  }
  HG.screens.stats = { mount, compute, range };
})();
