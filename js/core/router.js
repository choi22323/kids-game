/* 해시 라우터 + 화면 생명주기 (UI_UX.md §3.2) */
(function () {
  'use strict';
  const routes = [];
  let current = null; // {screen, path}
  let ignoreNext = false;
  let lastHash = '';

  function add(pattern, screenName, opts) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ re, keys, screenName, opts: opts || {} });
  }
  function match(path) {
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) { const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); return { r, params }; }
    }
    return null;
  }
  function go(path) { location.hash = '#' + path; }
  function replace(path) { ignoreNext = false; history.replaceState(null, '', '#' + path); handle(); }

  async function handle() {
    if (ignoreNext) { ignoreNext = false; return; }
    const path = location.hash.slice(1) || '/home';
    if (current && current.screen.canLeave) {
      const ok = await current.screen.canLeave();
      if (!ok) { ignoreNext = true; location.hash = lastHash; return; }
    }
    const m = match(path) || match('/home');
    if (m.r.opts.admin && HG.pin.isSet() && !HG.state.adminUnlocked) {
      const ok = await HG.pin.ask('관리자 설정을 열려면 PIN을 입력해 주세요.');
      if (!ok) { ignoreNext = true; location.hash = lastHash && lastHash !== location.hash ? lastHash : '#/home'; if (!lastHash) handle(); return; }
      HG.state.adminUnlocked = true;
    }
    if (current && current.screen.unmount) { try { current.screen.unmount(); } catch (e) { console.error(e); } }
    HG.feedback.hide();
    const view = document.getElementById('view');
    HG.dom.clear(view);
    document.body.classList.toggle('run-mode', !!m.r.opts.run);
    if (m.r.opts.run) HG.state.adminUnlocked = false;
    HG.events.emit('route', { path, section: m.r.opts.section || '' });
    const screen = HG.screens[m.r.screenName];
    current = { screen, path };
    lastHash = '#' + path;
    try {
      await screen.mount(view, m.params);
    } catch (e) {
      console.error(e);
      view.appendChild(HG.ui.emptyState('화면을 여는 중 문제가 생겼습니다. 홈으로 돌아가 다시 시도해 주세요.', [HG.ui.btn('홈으로', { variant: 'primary', onClick: () => go('/home') })]));
    }
    if (!m.r.opts.run) view.focus({ preventScroll: true });
  }
  function start() { window.addEventListener('hashchange', handle); handle(); }
  function rerender() { if (current) { const p = current.path; current = null; replace(p); } }
  HG.router = { add, go, replace, start, rerender, current: () => current };
})();
