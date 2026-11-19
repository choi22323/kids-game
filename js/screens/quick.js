/* S-02 빠른 시작: 주제 → 수준 → 세트·활동 */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const ui = HG.ui, L = HG.labels;
  let st = null;

  async function mount(view, params) {
    const [topics, sets] = await Promise.all([HG.repo.topics(), HG.repo.sets()]);
    st = { view, topics, sets: sets.filter((s) => !s.isHidden), step: 1, topicId: null, level: null, setId: null, acts: [] };
    if (params.topic && topics.some((t) => t.id === params.topic)) { st.topicId = params.topic; st.step = 2; }
    render();
  }
  function steps() {
    const names = ['주제', '수준', '활동'];
    return h('ol', { class: 'stepper-line', 'aria-label': '진행 단계' }, names.map((n, i) =>
      h('li', { class: i + 1 === st.step ? 'is-cur' : i + 1 < st.step ? 'is-done' : '', 'aria-current': i + 1 === st.step ? 'step' : null, text: (i + 1) + ' ' + n })));
  }
  function render() {
    clear(st.view);
    const back = st.step > 1 ? ui.btn('이전', { icon: '◀', onClick: () => { st.step--; render(); } }) : ui.btn('홈으로', { icon: '🏠', onClick: () => HG.router.go('/home') });
    const scr = ui.screen('빠른 시작', [back]);
    scr.head.querySelector('.screen-title').appendChild(steps());
    st.view.appendChild(scr.el);
    if (st.step === 1) stepTopic(scr);
    else if (st.step === 2) stepLevel(scr);
    else stepSet(scr);
  }
  function stepTopic(scr) {
    const list = h('div', { class: 'tile-grid' });
    scr.body.appendChild(h('div', { class: 'fill' }, h('p', { class: 'lead', text: '오늘 공부할 주제를 골라 주세요.' }), list));
    ui.pagedList({ list, pager: scr.foot, items: st.topics, max: 6, render: (t) => {
      const n = st.sets.filter((s) => s.topicId === t.id).length;
      return ui.btn(t.name, { cls: 'tile', icon: L.topicIcon[t.icon], disabled: !n, ariaLabel: t.name + ' (세트 ' + n + '개)',
        onClick: () => { st.topicId = t.id; st.step = 2; render(); } });
    } }).draw();
  }
  function stepLevel(scr) {
    const t = st.topics.find((x) => x.id === st.topicId);
    const row = h('div', { class: 'level-row' });
    L.levels.forEach((lv) => {
      const n = st.sets.filter((s) => s.topicId === st.topicId && s.level === lv).length;
      row.appendChild(ui.btn(L.level[lv], { cls: 'tile', disabled: !n, ariaLabel: L.level[lv] + ' (세트 ' + n + '개)',
        onClick: () => { st.level = lv; st.setId = null; st.step = 3; render(); } }));
      row.lastChild.appendChild(h('span', { class: 'tile-sub', text: '세트 ' + n + '개' }));
    });
    scr.body.appendChild(h('div', { class: 'fill' }, h('p', { class: 'lead', text: (t ? t.name : '') + ' — 수준을 골라 주세요.' }), row));
  }
  function stepSet(scr) {
    const sets = st.sets.filter((s) => s.topicId === st.topicId && s.level === st.level);
    if (!st.setId && sets[0]) { st.setId = sets[0].id; st.acts = null; }
    const list = h('div', { class: 'list' });
    const actBox = h('div', { class: 'card act-box' });
    const pager = h('div');
    scr.body.appendChild(h('div', { class: 'split' }, h('div', { class: 'split-main' }, h('p', { class: 'lead', text: '문제 세트를 골라 주세요.' }), list, pager), actBox));
    const pl = ui.pagedList({ list, pager, items: sets, max: 4, render: (s) => {
      const sel = s.id === st.setId;
      const b = h('button', { type: 'button', class: 'set-pick' + (sel ? ' is-selected' : ''), 'aria-pressed': String(sel),
        on: { click: () => { st.setId = s.id; st.acts = null; pl.refresh(); drawActs(); } } },
      h('span', { class: 'strong', text: s.title }), h('span', { class: 'muted', text: '낱말 ' + s.words.length + ' · 문장 ' + s.sentences.length + (s.isBuiltIn ? ' · 기본 자료' : '') }));
      return b;
    } });
    pl.draw();
    function drawActs() {
      clear(actBox);
      const set = sets.find((s) => s.id === st.setId);
      if (!set) { actBox.appendChild(h('p', { text: '세트를 골라 주세요.' })); return; }
      const av = HG.validate.availability(set);
      if (!st.acts) st.acts = L.activities.filter((a) => av[a]);
      actBox.appendChild(h('h2', { text: '할 활동' }));
      const g = h('div', { class: 'act-toggles' });
      L.activities.forEach((a) => {
        const on = st.acts.includes(a);
        const b = ui.toggle(L.activityIcon[a] + ' ' + L.activityShort[a], on, (v) => {
          st.acts = v ? L.activities.filter((x) => x === a || st.acts.includes(x)) : st.acts.filter((x) => x !== a);
          go.disabled = !st.acts.length;
        });
        if (!av[a]) { b.disabled = true; b.title = av.reason[a]; b.setAttribute('aria-label', L.activityShort[a] + ': ' + av.reason[a]); }
        g.appendChild(b);
      });
      const go = ui.btn('시작하기', { variant: 'primary', icon: '▶', cls: 'icon-after', disabled: !st.acts.length, onClick: start });
      actBox.append(g, h('div', { class: 'btn-row end' }, go));
    }
    drawActs();
  }
  function start() {
    const cfg = { topicId: st.topicId, level: st.level, setId: st.setId, activities: st.acts.slice() };
    HG.state.quick = cfg;
    try { sessionStorage.setItem('hg.quick', JSON.stringify(cfg)); } catch (e) { /* 무시 */ }
    HG.screens.run.enterFullscreen();
    HG.router.go('/run/quick');
  }
  HG.screens.quick = { mount, unmount() { st = null; } };
})();
