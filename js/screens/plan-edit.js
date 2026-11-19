/* S-04 수업 계획 편집 (FEATURES.md F-03) */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const ui = HG.ui, L = HG.labels, F = HG.format, V = HG.validate;
  let st = null;

  async function mount(view, params) {
    const [topics, sets] = await Promise.all([HG.repo.topics(), HG.repo.sets()]);
    const setsById = {}; sets.forEach((s) => { setsById[s.id] = s; });
    let l = params.id === 'new' ? null : await HG.db.get('lessons', params.id);
    const isNew = !l;
    if (params.id !== 'new' && !l) { view.appendChild(ui.emptyState('수업 계획을 찾을 수 없습니다.', [ui.btn('목록으로', { onClick: () => HG.router.go('/plans') })])); return; }
    if (!l) {
      const topicId = topics[0] ? topics[0].id : '';
      l = { id: HG.ids.uuid(), date: F.todayStr(), title: '', topicId, level: 'beginner', activityPlan: [], status: 'planned', participantCount: null, memo: '', startedAt: null, endedAt: null };
      l.activityPlan = defaultSteps(sets, topicId, 'beginner');
    }
    st = { view, l: JSON.parse(JSON.stringify(l)), isNew, topics, sets, setsById, dirty: false, tab: 'info', readOnly: l.status === 'done' || l.status === 'inProgress' || l.status === 'canceled' };
    render();
  }
  function candidates(topicId, level) { return st.sets.filter((s) => s.topicId === topicId && s.level === level && !s.isHidden); }
  function defaultSteps(sets, topicId, level) {
    const c = sets.filter((s) => s.topicId === topicId && s.level === level && !s.isHidden);
    if (!c[0]) return [];
    const av = V.availability(c[0]);
    return L.activities.filter((a) => av[a]).map((a, i) => ({ order: i, activity: a, problemSetId: c[0].id }));
  }
  function render() {
    clear(st.view);
    const l = st.l;
    const title = st.isNew ? '새 수업 계획' : st.readOnly ? '수업 계획 보기' : '수업 계획 편집';
    const scr = ui.screen(title, null, st.readOnly ? '상태: ' + L.status[l.status] + ' — 마쳤거나 진행 중인 계획은 고칠 수 없습니다.' : null);
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    const panels = {};
    [['info', '기본 정보'], ['steps', '활동 순서 (' + l.activityPlan.length + ')']].forEach(([k, label]) => {
      tabs.appendChild(h('button', { type: 'button', role: 'tab', class: 'tab' + (st.tab === k ? ' is-cur' : ''), 'aria-selected': String(st.tab === k), text: label,
        on: { click: () => { st.tab = k; render(); } } }));
      panels[k] = h('div', { class: 'tab-panel', role: 'tabpanel', hidden: st.tab !== k });
    });
    scr.body.appendChild(h('div', { class: 'editor' }, tabs, panels.info, panels.steps));
    st.view.appendChild(scr.el);
    infoPanel(panels.info);
    stepsPanel(panels.steps);
    const foot = h('div', { class: 'btn-row end' });
    foot.appendChild(ui.btn('목록으로', { icon: '◀', onClick: () => HG.router.go('/plans') }));
    if (st.readOnly) {
      if (l.status === 'canceled') foot.appendChild(ui.btn('다시 예정으로', { onClick: () => setStatus('planned') }));
      foot.appendChild(ui.btn('복제', { variant: 'primary', onClick: duplicate }));
    } else {
      if (!st.isNew && l.status === 'planned') foot.appendChild(ui.btn('취소 처리', { onClick: () => setStatus('canceled') }));
      foot.appendChild(ui.btn('저장', { variant: 'primary', icon: '✔', onClick: () => save(false) }));
      foot.appendChild(ui.btn('저장하고 수업 시작', { variant: 'accent', icon: '▶', onClick: () => save(true) }));
    }
    scr.foot.appendChild(foot);
    if (st.errors) { ui.showErrors(st.view, st.errors.filter((e) => (e.tab || 'info') === st.tab)); }
  }
  const mark = () => { st.dirty = true; };
  function infoPanel(p) {
    const l = st.l, ro = st.readOnly;
    const date = ui.input({ type: 'date', value: l.date, onInput: (e) => { l.date = e.target.value; mark(); } });
    const title = ui.input({ value: l.title, max: 30, placeholder: '예: 시장에 가요', onInput: (e) => { l.title = e.target.value; mark(); } });
    const topic = ui.select(st.topics.map((t) => ({ value: t.id, label: t.name })), l.topicId, (v) => {
      l.topicId = v; l.activityPlan = defaultSteps(st.sets, v, l.level); mark(); render();
    }, '주제');
    const level = ui.segmented(L.levels.map((v) => ({ value: v, label: L.level[v] })), l.level, (v) => {
      l.level = v; l.activityPlan = defaultSteps(st.sets, l.topicId, v); mark(); render();
    }, '수준');
    level.dataset.field = 'level';
    const people = ui.input({ type: 'number', value: l.participantCount == null ? '' : l.participantCount, inputmode: 'numeric', placeholder: '인원 수만(선택)',
      onInput: (e) => { const v = e.target.value.trim(); l.participantCount = v === '' ? null : Number(v); mark(); } });
    people.min = '0'; people.max = '30';
    const memo = ui.input({ value: l.memo, max: 200, placeholder: '수업 메모(선택)', onInput: (e) => { l.memo = e.target.value; mark(); } });
    [date, title, topic, people, memo].forEach((el) => { el.disabled = ro; });
    if (ro) level.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    p.appendChild(h('div', { class: 'form-grid' },
      ui.field('날짜', date, { field: 'date' }), ui.field('제목', title, { field: 'title' }),
      ui.field('주제', topic, { field: 'topicId' }), h('div', { class: 'field' }, h('span', { class: 'label', text: '수준' }), h('div', { class: 'field-input' }, level)),
      ui.field('참여 인원', people, { field: 'participantCount' }), ui.field('메모', memo, { field: 'memo' })));
    p.appendChild(h('p', { class: 'notice', text: '⚠ 어르신 성함·연락처 등 개인정보는 적지 마세요. 참여 인원은 숫자만 적습니다.' }));
  }
  function stepsPanel(p) {
    const l = st.l, ro = st.readOnly;
    const cands = candidates(l.topicId, l.level);
    const errs = (st.errors || []).filter((e) => e.tab === 'steps');
    if (errs.length) p.appendChild(ui.errorSummary(errs));
    const list = h('div', { class: 'list' });
    const pager = h('div');
    p.appendChild(list);
    const tools = h('div', { class: 'btn-row' }, pager);
    if (!ro) tools.appendChild(ui.btn('활동 추가', { icon: '＋', disabled: l.activityPlan.length >= 8 || !cands.length, onClick: () => {
      const set = cands[0];
      const av = V.availability(set);
      const a = L.activities.find((x) => av[x]) || 'trace';
      l.activityPlan.push({ order: l.activityPlan.length, activity: a, problemSetId: set.id });
      mark(); st.tab = 'steps'; render();
    } }));
    p.appendChild(tools);
    if (!cands.length) p.appendChild(h('p', { class: 'notice', text: '이 주제·수준에는 문제 세트가 없습니다. 관리자 설정에서 세트를 먼저 만들어 주세요.' }));
    ui.pagedList({ list, pager, items: l.activityPlan, max: 4,
      empty: () => ui.emptyState('활동이 없습니다. [활동 추가]를 눌러 주세요.'),
      render: (s, i) => {
        const set = st.setsById[s.problemSetId];
        const opts = cands.slice();
        if (set && !opts.includes(set)) opts.unshift(set);
        const setSel = ui.select((set ? [] : [{ value: '', label: '삭제된 세트 — 다시 골라 주세요' }]).concat(opts.map((x) => ({ value: x.id, label: x.title }))), set ? set.id : '', (v) => { s.problemSetId = v; mark(); st.tab = 'steps'; render(); }, (i + 1) + '번째 활동 세트');
        const actSel = ui.select(L.activities.map((a) => ({ value: a, label: L.activityIcon[a] + ' ' + L.activityShort[a] })), s.activity, (v) => { s.activity = v; mark(); st.tab = 'steps'; render(); }, (i + 1) + '번째 활동 종류');
        const av = set ? V.availability(set) : null;
        const warn = !set ? '삭제된 세트가 있습니다. 다른 세트를 골라 주세요.' : !av[s.activity] ? av.reason[s.activity] : '';
        [setSel, actSel].forEach((el) => { el.disabled = ro; });
        const move = (d) => { const j = i + d; [l.activityPlan[i], l.activityPlan[j]] = [l.activityPlan[j], l.activityPlan[i]]; l.activityPlan.forEach((x, k) => { x.order = k; }); mark(); st.tab = 'steps'; render(); };
        const row = h('div', { class: 'card step-row' + (warn ? ' is-warn' : ''), dataset: { field: 'activityPlan.' + i }, tabindex: '-1' },
          h('span', { class: 'step-no', text: String(i + 1) }), actSel, setSel,
          ro ? null : h('div', { class: 'btn-row' },
            ui.btn('', { icon: '▲', ariaLabel: '위로', disabled: i === 0, onClick: () => move(-1) }),
            ui.btn('', { icon: '▼', ariaLabel: '아래로', disabled: i === l.activityPlan.length - 1, onClick: () => move(1) }),
            ui.btn('', { icon: '✕', ariaLabel: '빼기', variant: 'danger', onClick: () => { l.activityPlan.splice(i, 1); l.activityPlan.forEach((x, k) => { x.order = k; }); mark(); st.tab = 'steps'; render(); } })),
          warn ? h('p', { class: 'step-warn', text: '⚠ ' + warn }) : null);
        return row;
      } }).draw();
  }
  async function save(andStart) {
    const l = st.l;
    l.title = V.clean(l.title);
    l.memo = V.clean(l.memo);
    if (l.participantCount != null && !Number.isFinite(l.participantCount)) l.participantCount = NaN;
    const r = V.lesson(l, { setsById: st.setsById, topicIds: st.topics.map((t) => t.id) });
    st.errors = r.errors;
    if (r.errors.length) {
      st.tab = r.errors[0].tab || 'info';
      render();
      HG.feedback.announce('고칠 내용이 ' + r.errors.length + '건 있습니다.');
      return;
    }
    if (!(await HG.privacy.confirmSave([l.title, l.memo]))) return;
    await HG.db.put('lessons', HG.repo.touch(l, st.isNew));
    st.dirty = false;
    HG.toast.show('저장했습니다.');
    if (andStart) HG.screens.home.startLesson(l.id);
    else HG.router.go('/plans');
  }
  async function setStatus(s) {
    if (s === 'canceled' && !(await HG.dialog.confirm('수업 취소', '이 수업 계획을 취소 처리할까요?', { ok: '취소 처리' }))) return;
    const l = await HG.db.get('lessons', st.l.id);
    if (!l) return;
    l.status = s;
    await HG.db.put('lessons', HG.repo.touch(l));
    st.dirty = false;
    HG.router.rerender();
  }
  async function duplicate() {
    const c = JSON.parse(JSON.stringify(st.l));
    Object.assign(c, { id: HG.ids.uuid(), title: st.l.title.slice(0, 25) + ' 복사', status: 'planned', date: F.todayStr(), startedAt: null, endedAt: null });
    await HG.db.put('lessons', HG.repo.touch(c, true));
    st.dirty = false;
    HG.router.go('/plans/' + c.id);
  }
  async function canLeave() {
    if (!st || !st.dirty) return true;
    const ok = await HG.dialog.confirm('저장하지 않은 내용', '저장하지 않은 내용이 있습니다. 그래도 나갈까요?', { ok: '나가기', cancel: '계속 편집' });
    if (ok) st.dirty = false;
    return ok;
  }
  HG.screens.planEdit = { mount, canLeave, unmount() { st = null; } };
})();
