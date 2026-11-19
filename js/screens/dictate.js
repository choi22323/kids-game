/* 받아쓰기 진행 화면 (수업 모드): 소개 → 문장별 받아쓰기 → 결과 */
(function () {
  'use strict';
  const { h, clear } = HG.dom;
  const ui = HG.ui;
  let st = null;

  function enterFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }
  async function mount(view, params) {
    const set = await HG.db.get('problemSets', params.id);
    st = { view, set, inst: null, next: null };
    if (set && set.group) {
      const g = (await HG.seed.dictationGroups()).find((x) => x.name === set.group);
      const i = g ? g.sets.findIndex((x) => x.id === set.id) : -1;
      if (g && i >= 0 && i + 1 < g.sets.length) st.next = g.sets[i + 1];
    }
    if (!set || set.kind !== 'dictation') {
      view.appendChild(h('section', { class: 'screen run-fail' }, ui.emptyState('받아쓰기 문장을 찾을 수 없습니다.', [ui.btn('홈으로', { variant: 'primary', onClick: () => HG.router.go('/home') })])));
      return;
    }
    st.titleEl = h('div', { class: 'run-title' });
    st.progEl = h('div', { class: 'run-progress', 'aria-live': 'polite' });
    st.fontBtn = ui.btn('가+', { ariaLabel: '글자 크기 바꾸기', onClick: () => cycleFont() });
    st.soundBtn = ui.btn('', { onClick: toggleSound });
    st.stage = h('div', { class: 'run-stage' });
    st.barL = h('div', { class: 'run-bar-l' }); st.barC = h('div', { class: 'run-bar-c' }); st.barR = h('div', { class: 'run-bar-r' });
    view.appendChild(h('section', { class: 'run' },
      h('header', { class: 'run-top' }, st.titleEl, st.progEl, h('div', { class: 'run-controls' }, st.fontBtn, st.soundBtn, ui.longPress('나가기', 2000, exitFlow, { icon: '⏏' }))),
      st.stage, h('footer', { class: 'run-bar' }, st.barL, st.barC, st.barR)));
    paint();
    st.off = HG.events.on('settings', paint);
    st.key = onKey;
    document.addEventListener('keydown', st.key);
    intro();
  }
  function paint() {
    if (!st || !st.soundBtn) return;
    const on = HG.state.settings.soundEnabled;
    st.soundBtn.textContent = on ? '🔔 효과음' : '🔕 효과음';
    st.soundBtn.setAttribute('aria-label', on ? '효과음 끄기' : '효과음 켜기');
    const sc = HG.state.settings.fontScale;
    st.fontBtn.textContent = sc >= 1.3 ? '가 보통' : sc >= 1.15 ? '가++' : '가+';
  }
  async function cycleFont(dir) {
    const steps = [1, 1.15, 1.3];
    const i = steps.indexOf(HG.state.settings.fontScale);
    const ni = typeof dir === 'number' ? Math.max(0, Math.min(2, i + dir)) : (i + 1) % 3;
    await HG.repo.setSetting('fontScale', steps[ni]);
    HG.toast.show('글자 크기: ' + ['보통', '크게', '아주 크게'][ni]);
    window.dispatchEvent(new Event('resize'));
  }
  async function toggleSound() { await HG.repo.setSetting('soundEnabled', !HG.state.settings.soundEnabled); }
  function setBar(l, c, r) { [[st.barL, l], [st.barC, c], [st.barR, r]].forEach(([el, list]) => { clear(el); (list || []).forEach((b) => el.appendChild(b)); }); }
  function setTitle(t) { clear(st.titleEl); st.titleEl.appendChild(h('strong', { text: t })); }
  function setProgress(cur, total) {
    clear(st.progEl);
    if (!total) return;
    const dots = h('span', { class: 'dots', 'aria-hidden': 'true' });
    for (let i = 0; i < total && total <= 12; i++) dots.appendChild(h('span', { class: 'dot' + (i < cur ? ' is-done' : i === cur ? ' is-cur' : '') }));
    st.progEl.append(dots, h('span', { class: 'prog-num', text: Math.min(cur + 1, total) + ' / ' + total }));
  }
  const fullTitle = () => (st.set.group && st.set.group !== st.set.title ? st.set.group + ' · ' + st.set.title : st.set.title);
  function intro() {
    clear(st.stage);
    setTitle('받아쓰기 · ' + fullTitle());
    setProgress(0, 0);
    const hasVoice = HG.tts.supported() && HG.tts.voice();
    st.stage.appendChild(h('div', { class: 'intro' },
      h('div', { class: 'intro-icon', 'aria-hidden': 'true', text: '👂' }),
      h('h1', { class: 'intro-name', text: '받아쓰기' }),
      h('p', { class: 'intro-set', text: fullTitle() + ' · ' + st.set.sentences.length + '문장' }),
      h('p', { class: 'intro-msg', text: hasVoice ? '문장을 읽어 드리면 칸에 받아 써 보세요. 몇 번이든 다시 들을 수 있습니다.' : '한국어 읽어 주기 음성이 없어 강사님이 문장을 읽어 주셔야 합니다.' })));
    const go = ui.btn('시작하기', { variant: 'primary', icon: '▶', cls: 'icon-after', onClick: begin });
    go.dataset.role = 'next';
    setBar([], [], [go]);
    setTimeout(() => go.focus(), 30);
  }
  function begin() {
    clear(st.stage);
    setTitle('받아쓰기 · ' + fullTitle());
    st.startedAt = HG.format.nowISO();
    const items = st.set.sentences.slice().sort((a, b) => a.order - b.order);
    st.inst = HG.activities.dictation.start({ stage: st.stage, items, bar: setBar, onProgress: setProgress, onFinish: finish });
  }
  async function save(results, completed) {
    if (!results.length) return null;
    const rec = HG.scoring.buildRecord({ items: results, activity: 'dictation', set: st.set, lessonId: null, startedAt: st.startedAt, completed });
    try { await HG.db.put('activityRecords', rec); } catch (e) { HG.toast.show('기록을 저장하지 못했습니다.'); }
    return rec;
  }
  async function finish(results) {
    const rec = await save(results, true);
    if (st.inst) { st.inst.destroy(); st.inst = null; }
    HG.feedback.hide();
    clear(st.stage);
    setProgress(0, 0);
    const done = results.filter((r) => r.result !== 'skipped').length;
    const stars = rec ? rec.stars : 0;
    const row = h('div', { class: 'result-stars', role: 'img', 'aria-label': '별 ' + stars + '개' });
    for (let k = 0; k < 3; k++) row.appendChild(h('span', { class: 'rstar' + (k < stars ? ' is-on' : ''), style: { '--k': String(k) }, 'aria-hidden': 'true', text: '★' }));
    const right = results.filter((r) => r.result === 'first' || r.result === 'retry').length;
    const single = results.length === 1;
    const msg = single ? (right ? '정확하게 쓰셨어요!' : done ? '끝까지 써 주셔서 고맙습니다!' : '다음에 함께 해 봐요.')
      : done === results.length ? '모든 문장을 받아 쓰셨어요!' : done ? '끝까지 함께해 주셔서 고맙습니다!' : '다음에 함께 해 봐요.';
    const line = single ? fullTitle() + ' 받아쓰기를 마쳤습니다.' : results.length + '문장 중 ' + done + '문장을 받아 쓰셨어요.';
    st.stage.appendChild(h('div', { class: 'result' }, row, h('h1', { class: 'result-msg', text: msg }), h('p', { class: 'result-line', text: line })));
    if (stars) HG.audio.play('complete');
    const again = ui.btn(single ? '이 문제 다시' : '처음부터 다시', { icon: '↺', onClick: intro });
    const home = ui.btn('홈으로', { variant: st.next ? 'secondary' : 'accent', icon: '🏠', onClick: () => HG.router.go('/home') });
    const right2 = [home];
    if (st.next) {
      const nx = ui.btn('다음 문제: ' + st.next.title, { variant: 'accent', icon: '▶', cls: 'icon-after', onClick: () => HG.router.go('/dictate/' + st.next.id) });
      nx.dataset.role = 'next';
      right2.push(nx);
    } else home.dataset.role = 'next';
    setBar([again], [], right2);
    setTimeout(() => (st.view.querySelector('.run-bar [data-role="next"]') || home).focus(), 30);
  }
  async function exitFlow() {
    if (HG.pin.isSet() && !(await HG.pin.ask('나가려면 PIN을 입력해 주세요.'))) return;
    if (st.inst) {
      const v = await HG.dialog.open({ title: '받아쓰기 나가기', body: '지금까지 한 내용을 저장하고 나갈까요?',
        actions: [{ label: '계속하기', value: 'stay', focus: true }, { label: '저장하고 나가기', value: 'save', variant: 'primary' }] });
      if (v !== 'save') return;
      await save(st.inst.partial(), false);
      st.inst.destroy(); st.inst = null;
    }
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    HG.router.go('/home');
  }
  function onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { const b = st.view.querySelector('.run-bar [data-role="next"]:not(:disabled)'); if (b) { e.preventDefault(); b.click(); } }
    else if (e.key === 'r' || e.key === 'R' || e.key === 'ㄱ') { if (st.inst) { e.preventDefault(); st.inst.listen(); } }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); cycleFont(1); }
    else if (e.key === '-') { e.preventDefault(); cycleFont(-1); }
  }
  function unmount() {
    if (!st) return;
    if (st.inst) st.inst.destroy();
    if (st.key) document.removeEventListener('keydown', st.key);
    if (st.off) st.off();
    HG.tts.stop();
    st = null;
  }
  HG.screens.dictate = { mount, unmount, enterFullscreen };
})();
