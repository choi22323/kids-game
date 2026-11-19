/* S-05 수업 모드 셸 + S-10 활동 결과 (FEATURES.md F-04, F-10) */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const ui = HG.ui;
  const L = HG.labels;
  let st = null;

  function enterFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }
  function fail(view, msg) {
    view.appendChild(h('section', { class: 'screen run-fail' }, ui.emptyState(msg, [ui.btn('홈으로', { variant: 'primary', onClick: () => HG.router.go('/home') })])));
  }

  async function mount(view, params) {
    const id = params.id;
    st = { view, lesson: null, steps: [], setsById: await HG.repo.setsMap(), stepIndex: 0, inst: null, cur: null, stars: 0, title: '' };
    if (id === 'quick') {
      let cfg = HG.state.quick;
      if (!cfg) { try { cfg = JSON.parse(sessionStorage.getItem('hg.quick')); } catch (e) { cfg = null; } }
      if (!cfg || !cfg.setId || !Array.isArray(cfg.activities) || !cfg.activities.length) { fail(view, '빠른 시작 정보가 없습니다. 다시 골라 주세요.'); return; }
      st.steps = cfg.activities.map((a, i) => ({ order: i, activity: a, problemSetId: cfg.setId }));
      st.title = '빠른 시작';
    } else {
      const l = await HG.db.get('lessons', id);
      if (!l) { fail(view, '수업 계획을 찾을 수 없습니다.'); return; }
      if (l.status === 'done' || l.status === 'canceled') { fail(view, '이미 마쳤거나 취소된 수업입니다. 수업 계획에서 [복제]해 다시 진행해 주세요.'); return; }
      st.lesson = l;
      st.steps = l.activityPlan.slice().sort((a, b) => a.order - b.order);
      st.title = l.title;
      const resume = await HG.repo.getMeta('resumeState');
      if (l.status === 'inProgress' && resume && resume.lessonId === l.id) {
        st.stepIndex = Math.max(0, Math.min(resume.stepIndex, st.steps.length - 1));
        st.stars = resume.stars || 0;
      }
      if (l.status === 'planned') {
        l.status = 'inProgress';
        l.startedAt = HG.format.nowISO();
        await HG.db.put('lessons', HG.repo.touch(l));
      }
      await saveResume(st.stepIndex);
    }
    buildShell();
    showIntro(st.stepIndex);
    st.keyHandler = onKey;
    document.addEventListener('keydown', st.keyHandler);
    st.offSettings = HG.events.on('settings', paintControls);
  }

  function buildShell() {
    st.titleEl = h('div', { class: 'run-title' });
    st.progEl = h('div', { class: 'run-progress', 'aria-live': 'polite' });
    st.fontBtn = ui.btn('가+', { ariaLabel: '글자 크기 바꾸기', onClick: cycleFont });
    st.soundBtn = ui.btn('', { onClick: toggleSound });
    const exit = ui.longPress('나가기', 2000, exitFlow, { icon: '⏏' });
    st.stage = h('div', { class: 'run-stage' });
    st.barL = h('div', { class: 'run-bar-l' });
    st.barC = h('div', { class: 'run-bar-c' });
    st.barR = h('div', { class: 'run-bar-r' });
    const root = h('section', { class: 'run' },
      h('header', { class: 'run-top' }, st.titleEl, st.progEl, h('div', { class: 'run-controls' }, st.fontBtn, st.soundBtn, exit)),
      st.stage,
      h('footer', { class: 'run-bar' }, st.barL, st.barC, st.barR));
    st.view.appendChild(root);
    paintControls();
  }
  function paintControls() {
    if (!st || !st.soundBtn) return;
    const on = HG.state.settings.soundEnabled;
    st.soundBtn.textContent = on ? '🔊 소리' : '🔇 소리';
    st.soundBtn.setAttribute('aria-label', on ? '소리 끄기' : '소리 켜기');
    st.soundBtn.setAttribute('aria-pressed', String(on));
    const scale = HG.state.settings.fontScale;
    st.fontBtn.textContent = scale >= 1.3 ? '가 보통' : scale >= 1.15 ? '가++' : '가+';
  }
  async function cycleFont(dir) {
    const steps = [1, 1.15, 1.3];
    const i = steps.indexOf(HG.state.settings.fontScale);
    const ni = typeof dir === 'number' ? Math.max(0, Math.min(2, i + dir)) : (i + 1) % 3;
    await HG.repo.setSetting('fontScale', steps[ni]);
    HG.toast.show('글자 크기: ' + ['보통', '크게', '아주 크게'][ni]);
    window.dispatchEvent(new Event('resize'));
  }
  async function toggleSound() {
    await HG.repo.setSetting('soundEnabled', !HG.state.settings.soundEnabled);
    HG.toast.show(HG.state.settings.soundEnabled ? '소리를 켰습니다.' : '소리를 껐습니다.');
  }
  function setBar(left, center, right) {
    [[st.barL, left], [st.barC, center], [st.barR, right]].forEach(([el, list]) => { clear(el); (list || []).forEach((b) => el.appendChild(b)); });
  }
  function setTitle(main, sub) { clear(st.titleEl); st.titleEl.append(h('strong', { text: main }), sub ? h('span', { class: 'run-sub', text: ' · ' + sub }) : null); }
  function setProgress(cur, total, label) {
    clear(st.progEl);
    if (!total) return;
    const dots = h('span', { class: 'dots', 'aria-hidden': 'true' });
    if (total <= 12) for (let i = 0; i < total; i++) dots.appendChild(h('span', { class: 'dot' + (i < cur ? ' is-done' : i === cur ? ' is-cur' : '') }));
    st.progEl.append(dots, h('span', { class: 'prog-num', text: (label || '') + Math.min(cur + 1, total) + ' / ' + total }));
  }

  function stepInfo(i) {
    const step = st.steps[i];
    const set = st.setsById[step.problemSetId];
    const av = set ? HG.validate.availability(set) : null;
    return { step, set, ok: !!(set && av && av[step.activity]), reason: !set ? '이 활동의 문제를 불러오지 못했습니다. (삭제된 세트)' : av && !av[step.activity] ? av.reason[step.activity] : '' };
  }
  function showIntro(i) {
    st.stepIndex = i;
    const { step, set, ok, reason } = stepInfo(i);
    clear(st.stage);
    setTitle(st.title, '활동 ' + (i + 1) + ' / ' + st.steps.length);
    setProgress(0, 0);
    const count = set ? (step.activity === 'blank' ? set.sentences.length : step.activity === 'match' ? set.words.filter(HG.validate.hasImage).length : set.words.length) : 0;
    st.stage.appendChild(h('div', { class: 'intro' },
      h('div', { class: 'intro-icon', 'aria-hidden': 'true', text: L.activityIcon[step.activity] }),
      h('p', { class: 'intro-step', text: '활동 ' + (i + 1) }),
      h('h1', { class: 'intro-name', text: L.activity[step.activity] }),
      set ? h('p', { class: 'intro-set', text: set.title + ' · ' + count + (step.activity === 'blank' ? '문장' : '낱말') }) : null,
      h('p', { class: 'intro-msg', text: ok ? '준비되셨으면 시작해 볼까요?' : reason })));
    const prev = i > 0 ? ui.btn('이전 활동', { icon: '◀', onClick: () => showIntro(i - 1) }) : null;
    if (prev) prev.dataset.role = 'prev';
    const go = ok ? ui.btn('시작하기', { variant: 'primary', icon: '▶', cls: 'icon-after', onClick: () => startActivity(i) })
      : ui.btn(i + 1 < st.steps.length ? '건너뛰기' : '수업 마치기', { variant: 'accent', icon: '▶', cls: 'icon-after', onClick: () => advance(i) });
    go.dataset.role = 'next';
    setBar(prev ? [prev] : [], [], [go]);
    setTimeout(() => go.focus(), 30);
  }
  function buildPool(set) {
    const pool = set.words.map((w) => ({ text: w.text, sameSet: true }));
    Object.values(st.setsById).forEach((s) => {
      if (s.id === set.id || s.topicId !== set.topicId) return;
      s.words.forEach((w) => pool.push({ text: w.text, sameSet: false }));
    });
    if (pool.length < 8) Object.values(st.setsById).forEach((s) => { if (s.id !== set.id) s.words.forEach((w) => pool.push({ text: w.text, sameSet: false })); });
    return pool;
  }
  function startActivity(i) {
    const { step, set } = stepInfo(i);
    let items = (step.activity === 'blank' ? set.sentences : set.words).slice().sort((a, b) => a.order - b.order);
    if (HG.state.settings.shuffleQuestions) items = HG.act.shuffle(items);
    clear(st.stage);
    setTitle(L.activity[step.activity], set.title);
    const startedAt = HG.format.nowISO();
    st.cur = { i, step, set, startedAt };
    st.inst = HG.activities[step.activity].start({
      stage: st.stage, set, items, pool: buildPool(set), bar: setBar,
      onProgress: (c, t) => setProgress(c, t),
      onFinish: (results, meta) => finishActivity(results, meta)
    });
  }
  async function saveRecord(results, meta, completed) {
    const c = st.cur;
    if (!results.length) return null;
    const rec = HG.scoring.buildRecord({ items: results, activity: c.step.activity, set: c.set, lessonId: st.lesson ? st.lesson.id : null,
      startedAt: c.startedAt, hintsUsed: (meta && meta.hintsUsed) || (st.inst && st.inst.hints ? st.inst.hints() : 0), completed });
    try { await HG.db.put('activityRecords', rec); } catch (e) { HG.toast.show('기록을 저장하지 못했습니다. 저장 공간을 확인해 주세요.'); }
    return rec;
  }
  async function finishActivity(results, meta) {
    const c = st.cur;
    const rec = await saveRecord(results, meta, true);
    if (st.inst) { st.inst.destroy(); st.inst = null; }
    if (rec) st.stars += rec.stars;
    await saveResume(c.i + 1);
    showResult(c.i, rec);
  }
  function showResult(i, rec) {
    HG.feedback.hide();
    clear(st.stage);
    setProgress(0, 0);
    const stars = rec ? rec.stars : 0;
    const total = rec ? rec.totalQuestions : 0;
    let line = '';
    if (rec) {
      const n = total - rec.skipped;
      if (rec.activity === 'trace') line = n + '개 낱말을 정성껏 따라 쓰셨어요.';
      else if (rec.correctFirstTry) line = total + '문제 중 ' + rec.correctFirstTry + '문제를 바로 맞히셨어요.';
      else line = n + '문제를 끝까지 함께 하셨어요.';
    }
    const starRow = h('div', { class: 'result-stars', role: 'img', 'aria-label': '별 ' + stars + '개' });
    for (let k = 0; k < 3; k++) starRow.appendChild(h('span', { class: 'rstar' + (k < stars ? ' is-on' : ''), style: { '--k': String(k) }, 'aria-hidden': 'true', text: '★' }));
    const msg = stars ? (stars === 3 ? '오늘도 멋지게 해내셨어요!' : stars === 2 ? '참 잘하셨어요!' : '끝까지 함께해 주셔서 고맙습니다!') : '다음에 함께 해 봐요.';
    st.stage.appendChild(h('div', { class: 'result' }, starRow, h('h1', { class: 'result-msg', text: msg }), line ? h('p', { class: 'result-line', text: line }) : null,
      h('p', { class: 'result-class', text: '우리 반 별 ★ ' + st.stars + '개' })));
    if (stars) { HG.audio.play('complete'); HG.feedback.announce(msg + ' 별 ' + stars + '개'); }
    const last = i + 1 >= st.steps.length;
    const again = ui.btn('한 번 더 하기', { icon: '↺', onClick: () => startActivity(i) });
    const nx = ui.btn(last ? '수업 마치기' : '다음 활동', { variant: 'accent', icon: '▶', cls: 'icon-after', onClick: () => advance(i) });
    nx.dataset.role = 'next';
    setBar([again], [], [nx]);
    setTimeout(() => nx.focus(), 30);
  }
  function advance(i) {
    if (i + 1 < st.steps.length) showIntro(i + 1);
    else finishLesson();
  }
  async function saveResume(stepIndex) {
    if (!st.lesson) return;
    await HG.repo.setMeta('resumeState', { lessonId: st.lesson.id, stepIndex, stars: st.stars });
  }
  async function finishLesson() {
    const setIds = Array.from(new Set(st.steps.map((s) => s.problemSetId))).filter((id) => st.setsById[id]);
    if (st.lesson) {
      const l = await HG.db.get('lessons', st.lesson.id);
      if (l) { l.status = 'done'; l.endedAt = HG.format.nowISO(); await HG.db.put('lessons', HG.repo.touch(l)); }
      await HG.repo.setMeta('resumeState', null);
    }
    HG.state.lastRun = { lessonId: st.lesson ? st.lesson.id : null, setIds, stars: st.stars, title: st.title };
    try { sessionStorage.setItem('hg.lastRun', JSON.stringify(HG.state.lastRun)); } catch (e) { /* 무시 */ }
    HG.router.go('/summary/' + (st.lesson ? st.lesson.id : 'quick'));
  }
  async function exitFlow() {
    if (HG.pin.isSet() && !(await HG.pin.ask('수업 모드를 나가려면 PIN을 입력해 주세요.'))) return;
    if (st.inst) {
      const v = await HG.dialog.open({ title: '수업 모드 나가기', body: '지금까지 한 내용을 저장하고 나갈까요?',
        actions: [{ label: '계속하기', value: 'stay', focus: true }, { label: '저장하고 나가기', value: 'save', variant: 'primary' }] });
      if (v !== 'save') return;
      await saveRecord(st.inst.partial(), null, false);
      st.inst.destroy();
      st.inst = null;
    }
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    HG.router.go(st.lesson ? '/plans' : '/home');
  }
  function onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const click = (role) => { const b = st.view.querySelector('.run-bar [data-role="' + role + '"]:not(:disabled)'); if (b) { e.preventDefault(); b.click(); } };
    if (e.key === 'ArrowRight' || e.key === 'PageDown') click('next');
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') click('prev');
    else if (e.key === 'm' || e.key === 'M' || e.key === 'ㅡ') { e.preventDefault(); toggleSound(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); cycleFont(1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); cycleFont(-1); }
  }
  function unmount() {
    if (!st) return;
    if (st.inst) { try { st.inst.destroy(); } catch (e) { /* 무시 */ } }
    if (st.keyHandler) document.removeEventListener('keydown', st.keyHandler);
    if (st.offSettings) st.offSettings();
    st = null;
  }
  HG.screens.run = { mount, unmount, enterFullscreen };
})();
